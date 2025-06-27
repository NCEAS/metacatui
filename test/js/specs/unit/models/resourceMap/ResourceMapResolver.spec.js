define([
  "/test/js/specs/shared/clean-state.js",
  "models/resourceMap/ResourceMapResolver",
], (cleanState, ResourceMapResolver) => {
  const should = chai.should();
  const expect = chai.expect;

  describe("ResourceMapResolver Test Suite", () => {
    const state = cleanState(
      () => {
        const sandbox = sinon.createSandbox();
        const rmr = new ResourceMapResolver({ nodeId: "testNode" });
        return { sandbox, rmr };
      },
      beforeEach,
      afterEach,
    );

    afterEach(() => {
      state.sandbox.restore();
    });

    describe("Instantiation & option validation", () => {
      it("creates an instance with defaults", () => {
        state.rmr.should.be.instanceof(ResourceMapResolver);
        state.rmr.nodeId.should.equal("testNode");
        state.rmr.storage.should.exist;
        state.rmr.maxSteps.should.equal(200);
        state.rmr.maxFetchTime.should.equal(45000);
        state.rmr.eventLog.logs.size.should.equal(0);
        state.rmr.eventLog.consoleLevel.should.equal("info");
      });
    });

    describe("containsPid static helper", () => {
      it("returns true when the PID is present in memberIds", () => {
        const rmModel = new Backbone.Model({ memberIds: ["a", "b", "c"] });
        ResourceMapResolver.containsPid(rmModel, "b").should.be.true;
      });

      it("returns false when the PID is missing or model is null", () => {
        const rmModel = new Backbone.Model({ memberIds: ["x", "y"] });
        ResourceMapResolver.containsPid(rmModel, "z").should.be.false;
        ResourceMapResolver.containsPid(null, "x").should.be.false;
      });
    });

    describe("checkStorage()", () => {
      it("resolves with a resMap value when storage contains a mapping", async () => {
        const { sandbox, rmr } = state;
        sandbox.stub(rmr.storage, "getItem").resolves("rm_pid_123");
        const result = await rmr.checkStorage("obj_pid_123");
        result.rm.should.equal("rm_pid_123");
      });

      it("resolves with null when storage has no mapping", async () => {
        const { sandbox, rmr } = state;
        sandbox.stub(rmr.storage, "getItem").resolves(null);
        const result = await rmr.checkStorage("obj_pid_456");
        should.equal(result.rm, null);
      });
    });

    describe("guessPid()", () => {
      it("returns the guessed PID when verify resolves true", async () => {
        const { sandbox, rmr } = state;
        sandbox.stub(rmr, "verify").resolves(true);

        const guessed = await rmr.guessPid("myObjPid");
        guessed.should.equal("resource_map_myObjPid");
        rmr.verify.calledOnceWithExactly("resource_map_myObjPid", "myObjPid")
          .should.be.true;
      });

      it("returns null when verify resolves false", async () => {
        const { sandbox, rmr } = state;
        sandbox.stub(rmr, "verify").resolves(false);

        const guessed = await rmr.guessPid("anotherPid");
        should.equal(guessed, null);
      });
    });

    describe("status()", () => {
      it("stores the obj-resMap pair when resMap is provided", () => {
        const { sandbox, rmr } = state;
        sandbox.stub(rmr.storage, "setItem").resolves();
        sandbox.stub(rmr, "log").returns({});
        sandbox.stub(rmr, "trigger");

        const result = rmr.status("obj123", "foundAndValid", "rm123");
        result.success.should.be.true;
        rmr.storage.setItem.calledOnceWithExactly("obj123", "rm123").should.be
          .true;
        rmr.trigger.calledTwice.should.be.true;
      });

      it("does not store when resMap is null", () => {
        const { sandbox, rmr } = state;
        sandbox.stub(rmr.storage, "setItem").resolves();
        sandbox.stub(rmr, "log").returns({});
        sandbox.stub(rmr, "trigger");

        const result = rmr.status("obj999", "allMiss", null);
        result.success.should.be.false;
        rmr.storage.setItem.called.should.be.false;
      });
    });

    describe("resolve() control-flow", () => {
      it("returns immediately on an index match", async () => {
        const { sandbox, rmr } = state;

        sandbox
          .stub(rmr, "searchIndex")
          .resolves({ rm: "rmFromIndex", meta: {} });
        sandbox.stub(rmr, "status").callsFake((pid, status, rm) => ({
          success: true,
          pid,
          rm,
        }));

        const result = await rmr.resolve("objPid");
        result.should.deep.equal({
          success: true,
          pid: "objPid",
          rm: "rmFromIndex",
        });

        rmr.searchIndex.calledOnce.should.be.true;
      });

      it("delegates to resolveFromSeriesId when the pid is a SID", async () => {
        const { sandbox, rmr } = state;

        sandbox
          .stub(rmr, "searchIndex")
          .resolves({ rm: null, meta: { isSid: true } });
        sandbox.stub(rmr, "status").returns({});
        sandbox
          .stub(rmr, "resolveFromSeriesId")
          .resolves({ success: true, pid: "sid123", rm: "rmSid123" });

        const result = await rmr.resolve("sid123");
        result.should.deep.equal({
          success: true,
          pid: "sid123",
          rm: "rmSid123",
        });

        rmr.resolveFromSeriesId.calledOnceWithExactly("sid123").should.be.true;
      });

      it("checks storage when index search returns no resMap", async () => {
        const { sandbox, rmr } = state;

        sandbox
          .stub(rmr, "searchIndex")
          .resolves({ rm: null, meta: { isSid: false } });
        sandbox.stub(rmr, "checkStorage").resolves({ rm: "rmFromStorage" });
        sandbox
          .stub(rmr, "status")
          .returns({ success: true, rm: "rmFromStorage" });
        sandbox.stub(rmr, "verify").resolves(true);

        const result = await rmr.resolve("objPid");
        result.should.deep.equal({
          success: true,
          rm: "rmFromStorage",
        });

        rmr.checkStorage.calledOnceWithExactly("objPid").should.be.true;
      });

      it("walks sysmeta when storage check returns no resMap", async () => {
        const { sandbox, rmr } = state;

        sandbox
          .stub(rmr, "searchIndex")
          .resolves({ rm: null, meta: { isSid: false } });
        sandbox.stub(rmr, "checkStorage").resolves({ rm: null });
        sandbox
          .stub(rmr, "walkSysmeta")
          .resolves({ rm: "rmFromSysmeta", meta: {} });
        sandbox
          .stub(rmr, "status")
          .returns({ success: true, rm: "rmFromSysmeta" });
        sandbox.stub(rmr, "verify").resolves(true);

        const result = await rmr.resolve("objPid");
        result.should.deep.equal({
          success: true,
          rm: "rmFromSysmeta",
        });

        rmr.walkSysmeta.calledOnceWithExactly("objPid").should.be.true;
      });

      it("guesses PID when sysmeta walk returns no resMap", async () => {
        const { sandbox, rmr } = state;

        sandbox
          .stub(rmr, "searchIndex")
          .resolves({ rm: null, meta: { isSid: false } });
        sandbox.stub(rmr, "checkStorage").resolves({ rm: null });
        sandbox.stub(rmr, "walkSysmeta").resolves({ rm: null, meta: {} });
        sandbox.stub(rmr, "guessPid").resolves("guessedRM");
        sandbox.stub(rmr, "status").returns({ success: true, rm: "guessedRM" });
        sandbox.stub(rmr, "verify").resolves(true);

        const result = await rmr.resolve("objPid");
        result.should.deep.equal({
          success: true,
          rm: "guessedRM",
        });

        rmr.guessPid.calledOnceWithExactly("objPid").should.be.true;
      });

      it("returns allMiss when no resMap is found", async () => {
        const { sandbox, rmr } = state;

        sandbox
          .stub(rmr, "searchIndex")
          .resolves({ rm: null, meta: { isSid: false } });
        sandbox.stub(rmr, "checkStorage").resolves({ rm: null });
        sandbox.stub(rmr, "walkSysmeta").resolves({ rm: null, meta: {} });
        sandbox.stub(rmr, "guessPid").resolves(null);
        sandbox.stub(rmr, "status").returns({ success: false, rm: null });
        sandbox.stub(rmr, "verify").resolves(true);

        const result = await rmr.resolve("objPid");
        result.should.deep.equal({
          success: false,
          rm: null,
        });

        rmr.searchIndex.calledOnceWithExactly("objPid").should.be.true;
        rmr.checkStorage.calledOnceWithExactly("objPid").should.be.true;
        rmr.walkSysmeta.calledOnceWithExactly("objPid").should.be.true;
        rmr.guessPid.calledOnceWithExactly("objPid").should.be.true;
      });
    });

    /*
     * -----------------------------------------------------------------
     *   EXTRA UNIT TESTS – verify(), status events, resolveFromSeriesId
     * -----------------------------------------------------------------
     */

    describe("verify()", () => {
      it("returns true when the resource map model contains the PID", async () => {
        const { sandbox, rmr } = state;
        const model = new Backbone.Model({ memberIds: ["pidTrue"] });

        sandbox.stub(rmr, "fetchResourceMap").resolves({ model, status: 200 });
        sandbox.stub(rmr, "status"); // we just assert it was called

        const result = await rmr.verify("rm123", "pidTrue");
        result.should.be.true;

        rmr.fetchResourceMap.calledOnceWithExactly("rm123").should.be.true;
        rmr.status.calledOnce.should.be.true;
      });

      it("returns false when the model does not list the PID as a member", async () => {
        const { sandbox, rmr } = state;
        const model = new Backbone.Model({ memberIds: [] });

        sandbox.stub(rmr, "fetchResourceMap").resolves({ model, status: 200 });
        sandbox.stub(rmr, "status");

        const result = await rmr.verify("rm123", "missingPid");
        result.should.be.false;

        rmr.status.calledOnce.should.be.true;
      });
    });

    describe("status() Backbone events", () => {
      it("emits both generic and PID-specific status events", () => {
        const { sandbox, rmr } = state;
        const genericSpy = sandbox.spy();
        const specificSpy = sandbox.spy();

        rmr.once("status", genericSpy);
        rmr.once("status:objEvt", specificSpy);

        const res = rmr.status("objEvt", "customStatus", "rmEvt");
        res.success.should.be.true;

        genericSpy.calledOnce.should.be.true;
        specificSpy.calledOnce.should.be.true;
      });
    });

    describe("resolveFromSeriesId()", () => {
      it("delegates to resolve() when sysmeta contains an identifier", async () => {
        const { sandbox, rmr } = state;

        sandbox.stub(rmr.versionTracker, "getNth").resolves({
          sysMeta: { identifier: "pidFromSid" },
        });
        sandbox.stub(rmr, "status");
        sandbox.stub(rmr, "resolve").resolves({
          success: true,
          pid: "pidFromSid",
          rm: "rmFromSid",
        });

        const result = await rmr.resolveFromSeriesId("sidPID");
        result.should.deep.equal({
          success: true,
          pid: "pidFromSid",
          rm: "rmFromSid",
        });

        rmr.versionTracker.getNth.calledOnceWithExactly(
          "sidPID",
          0,
          false,
          true,
        ).should.be.true;
        rmr.resolve.calledOnceWithExactly("pidFromSid").should.be.true;
      });

      it("returns a no-PID status when sysmeta lacks an identifier", async () => {
        const { sandbox, rmr } = state;

        sandbox.stub(rmr.versionTracker, "getNth").resolves({ sysMeta: {} });
        sandbox.stub(rmr, "status").returns({
          success: false,
          pid: "sidOnly",
          rm: null,
        });

        const result = await rmr.resolveFromSeriesId("sidOnly");
        result.should.deep.equal({
          success: false,
          pid: "sidOnly",
          rm: null,
        });

        rmr.status.calledOnce.should.be.true;
      });
    });
  });
});
