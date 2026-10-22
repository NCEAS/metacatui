define([
  "/test/js/specs/shared/clean-state.js",
  "models/UserModel",
  "common/QueryService",
], (cleanState, UserModel, QueryService) => {
  const should = chai.should();
  const expect = chai.expect;

  describe("UserModel Test Suite", () => {
    const state = cleanState(() => {
      const sandbox = sinon.createSandbox();
      const user = new UserModel();
      return { sandbox, user };
    }, beforeEach);

    afterEach(() => {
      state.sandbox.restore();
    });

    describe("portal creation", () => {
      let config;
      let query;

      beforeEach(() => {
        config = MetacatUI.appModel.toJSON();
        MetacatUI.appModel.set({
          enableCreatePortals: true,
          limitPortalsToSubjects: [],
          portalLimit: -1,
        });
        state.user.set(
          {
            loggedIn: true,
            allIdentitiesAndGroups: ["portal-owner"],
          },
          { silent: true },
        );
        query = state.sandbox
          .stub(QueryService, "queryWithFetch")
          .resolves({ response: { numFound: 2 } });
      });

      afterEach(() => {
        state.user.off(
          "change:allIdentitiesAndGroups change:checked",
          state.user.isAuthorizedCreatePortal,
        );
        MetacatUI.appModel.clear({ silent: true });
        MetacatUI.appModel.set(config, { silent: true });
      });

      function checkPermission() {
        return new Promise((resolve) => {
          state.user.once("change:isAuthorizedCreatePortal", () => {
            resolve(state.user.get("isAuthorizedCreatePortal"));
          });
          state.user.isAuthorizedCreatePortal();
        });
      }

      it("checks portal creation settings", async () => {
        for (const [
          loggedIn,
          enableCreatePortals,
          subjects,
          identities,
          authorized,
        ] of [
          [true, true, [], [], true],
          [false, true, [], [], false],
          [true, false, [], [], false],
          [true, true, ["allowed-group"], ["another-user"], false],
          [true, true, ["allowed-group"], ["allowed-group"], true],
          [true, true, ["allowed-user"], ["allowed-user"], true],
        ]) {
          MetacatUI.appModel.set({
            enableCreatePortals,
            limitPortalsToSubjects: subjects,
          });
          state.user.set(
            { loggedIn, allIdentitiesAndGroups: identities },
            { silent: true },
          );
          expect(await checkPermission()).to.equal(authorized);
        }
        expect(query.called).to.equal(false);
      });

      it("waits for user identities before counting portals", async () => {
        MetacatUI.appModel.set({
          limitPortalsToSubjects: ["allowed-group"],
          portalLimit: 3,
        });
        state.user.set("allIdentitiesAndGroups", []);
        const permission = checkPermission();
        expect(state.user.get("isAuthorizedCreatePortal")).to.equal(null);
        expect(query.called).to.equal(false);

        state.user.set("allIdentitiesAndGroups", ["allowed-group"]);
        state.user.set("checked", true);
        expect(await permission).to.equal(true);
        expect(query.calledOnce).to.equal(true);
      });

      it("denies portal creation when identity loading has already finished without identities", async () => {
        state.user.set({ checked: true, allIdentitiesAndGroups: [] });

        for (const settings of [
          { limitPortalsToSubjects: ["allowed-group"], portalLimit: -1 },
          { limitPortalsToSubjects: [], portalLimit: 3 },
        ]) {
          MetacatUI.appModel.set(settings);
          // check permission to create portal
          expect(await checkPermission()).to.equal(false);
        }
        expect(query.called).to.equal(false);
      });

      it("denies portal creation when both identity lookup requests fail", async () => {
        MetacatUI.appModel.set({
          accountsUrl: "https://accounts.example/",
          portalLimit: 3,
        });
        state.user.set({
          username: "portal-owner",
          checked: false,
          allIdentitiesAndGroups: [],
        });
        const ajax = state.sandbox.stub($, "ajax").callsFake(({ error }) => {
          error({ status: 500 });
        });
        // check permission to create portal
        const permission = checkPermission();
        expect(state.user.get("isAuthorizedCreatePortal")).to.equal(null);

        state.user.getInfo();

        expect(await permission).to.equal(false);
        expect(state.user.get("checked")).to.equal(true);
        expect(ajax.calledTwice).to.equal(true);
        expect(query.called).to.equal(false);
      });

      it("skips the count for unlimited settings or a zero limit", async () => {
        for (const portalLimit of [undefined, null, false, "", NaN, -1, 0]) {
          MetacatUI.appModel.set("portalLimit", portalLimit);
          expect(await checkPermission()).to.equal(portalLimit !== 0);
        }
        expect(query.called).to.equal(false);
      });

      it("checks portal limits with a count query", async () => {
        for (const [portalLimit, authorized] of [
          [1, false],
          [2, false],
          [3, true],
        ]) {
          MetacatUI.appModel.set("portalLimit", portalLimit);
          expect(await checkPermission()).to.equal(authorized);
        }
        expect(query.callCount).to.equal(3);
        const options = query.firstCall.args[0];
        expect(options.rows).to.equal(0);
        expect(options.useAuth).to.equal(true);
        expect(options.filterQueries).to.deep.equal([
          "formatId:*dataone.org/portals*",
          "-obsoletedBy:*",
        ]);
        const q = decodeURIComponent(options.q);
        for (const field of [
          "rightsHolder",
          "writePermission",
          "changePermission",
        ]) {
          expect(q).to.contain(`${field}:portal\\-owner`);
        }
      });

      it("skips the count when the user isn't allowed to create portals", async () => {
        MetacatUI.appModel.set({
          portalLimit: 3,
          limitPortalsToSubjects: ["another-user"],
        });
        expect(await checkPermission()).to.equal(false);
        expect(query.called).to.equal(false);
      });

      it("denies portal creation when the count request fails", async () => {
        MetacatUI.appModel.set("portalLimit", 3);
        query.rejects(new Error("Query service unavailable"));
        expect(await checkPermission()).to.equal(false);
      });

      it("keeps portal creation disabled if the user signs out during the count", async () => {
        MetacatUI.appModel.set("portalLimit", 3);
        const permission = checkPermission();
        state.user.set("loggedIn", false, { silent: true });
        expect(await permission).to.equal(false);
      });
    });

    describe("getToken()", () => {
      it("does not leave authentication checks incomplete after a custom callback succeeds", () => {
        const { sandbox, user } = state;

        sandbox.stub($, "ajax").callsFake(({ success }) => {
          success("refreshed-token");
        });

        user.set({
          checked: true,
          tokenChecked: true,
        });

        user.getToken((token) => {
          user.set("token", token);
          user.trigger("change:token");
        });

        user.get("token").should.equal("refreshed-token");
        user.get("checked").should.be.true;
        user.get("tokenChecked").should.be.true;
      });
    });

    describe("getTokenPromise()", () => {
      it("applies exponential timeout backoff and increments the timeout counter", async () => {
        const { sandbox, user } = state;
        const getTokenStub = sandbox.stub(user, "getToken");
        let timeoutCallback;
        let timeoutMs;

        sandbox.stub(globalThis, "setTimeout").callsFake((callback, ms) => {
          timeoutCallback = callback;
          timeoutMs = ms;
          return 1;
        });

        user.set("tokenTimeoutCounter", 2);

        const errorPromise = user.getTokenPromise(25).catch((e) => e);

        getTokenStub.calledOnce.should.be.true;
        timeoutMs.should.equal(100);

        timeoutCallback();

        const error = await errorPromise;
        error.message.should.equal("token check timed out");
        user.get("tokenTimeoutCounter").should.equal(3);
      });

      it("stops retrying after repeated timeouts and resets state after five minutes", async () => {
        const { sandbox, user } = state;
        const getTokenStub = sandbox.stub(user, "getToken");
        let resetCallback;
        let resetDelay;

        sandbox.stub(globalThis, "setTimeout").callsFake((callback, ms) => {
          resetCallback = callback;
          resetDelay = ms;
          return 1;
        });

        user.set({
          tokenChecked: false,
          tokenTimeoutCounter: 4,
        });

        const error = await user.getTokenPromise().catch((e) => e);

        error.message.should.equal("token check failed too many times");
        user.get("tokenChecked").should.be.true;
        getTokenStub.called.should.be.false;
        resetDelay.should.equal(5 * 60 * 1000);

        resetCallback();

        user.get("tokenChecked").should.be.false;
        user.get("tokenTimeoutCounter").should.equal(0);
      });
    });
  });
});
