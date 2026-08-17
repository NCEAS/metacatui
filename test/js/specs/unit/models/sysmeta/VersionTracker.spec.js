define([
  "/test/js/specs/shared/clean-state.js",
  "/test/js/specs/shared/concurrency-tracker.js",
  "models/sysmeta/VersionTracker",
  "models/dataONEServices/SysMetaService",
], (cleanState, trackConcurrency, VersionTracker, SysMetaService) => {
  const should = chai.should();
  const expect = chai.expect;

  const makeSysMeta = (nextPid = null, prevPid = null) => ({
    obsoletedBy: nextPid,
    obsoletes: prevPid,
  });

  const makeIdentifiedSysMeta = (
    identifier,
    nextPid = null,
    prevPid = null,
  ) => ({
    identifier,
    obsoletedBy: nextPid,
    obsoletes: prevPid,
  });

  const makeDatedSysMeta = ({
    identifier,
    dateUploaded,
    nextPid = null,
    prevPid = null,
  }) => ({
    identifier,
    dateUploaded,
    obsoletedBy: nextPid,
    obsoletes: prevPid,
  });

  describe("VersionTracker", () => {
    const state = cleanState(
      () => {
        const sandbox = sinon.createSandbox();
        const originalMetacatUI = globalThis.MetacatUI;
        if (!originalMetacatUI) {
          globalThis.MetacatUI = {
            root: "",
            appModel: {
              get: sandbox.stub().callsFake((key) => {
                if (key === "metaServiceUrl") return "https://example.org";
                if (key === "alternateRepositories") return [];
                return null;
              }),
              getActiveAltRepo: sandbox.stub().returns(null),
              isDOI: sandbox.stub().returns(false),
            },
            appUserModel: { get: sandbox.stub().returns(false) },
            nodeModel: { get: sandbox.stub(), length: 0 },
          };
        }
        const vt = new VersionTracker({
          metaServiceUrl: "https://example.org/sysmeta/",
        });
        const service = vt.sysMetaService;
        sandbox.stub(service, "download");
        sandbox.stub(service, "isCached").resolves(false);
        sandbox.stub(service, "removeCached").resolves();
        sandbox.stub(service, "clearCache").resolves(true);
        return { sandbox, vt, service, originalMetacatUI };
      },
      beforeEach,
      afterEach,
    );

    afterEach(() => {
      state.sandbox.restore();
      if (typeof state.originalMetacatUI !== "undefined") {
        globalThis.MetacatUI = state.originalMetacatUI;
      }
    });

    describe("construction and singleton", () => {
      it("throws on invalid TTL", () => {
        expect(() => {
          new VersionTracker({ ttlMs: 0, metaServiceUrl: "https://x" });
        }).to.throw(/ttlMs/i);
      });

      it("throws on non-finite TTL values", () => {
        expect(() => {
          new VersionTracker({ ttlMs: Infinity, metaServiceUrl: "https://x" });
        }).to.throw(/ttlMs/i);
        expect(() => {
          new VersionTracker({ ttlMs: NaN, metaServiceUrl: "https://x" });
        }).to.throw(/ttlMs/i);
      });

      it("allows null TTL for non-expiring cache", () => {
        const vt = new VersionTracker({
          ttlMs: null,
          metaServiceUrl: "https://example.org/sysmeta",
        });
        expect(vt.ttlMs).to.equal(null);
        expect(vt.sysMetaService.storageConfig.ttlMs).to.equal(null);
      });

      it("throws on invalid maxChainHops", () => {
        expect(() => {
          new VersionTracker({ maxChainHops: 0, metaServiceUrl: "https://x" });
        }).to.throw("Invalid maxChainHops provided to VersionTracker");
      });

      it("normalizes metaServiceUrl and configures SysMetaService", () => {
        const vt = new VersionTracker({
          metaServiceUrl: "https://example.org/sysmeta///",
          ttlMs: 123,
          maxChainHops: 3,
        });

        vt.metaServiceUrl.should.equal("https://example.org/sysmeta");
        vt.sysMetaService.storageConfig.ttlMs.should.equal(123);
        vt.sysMetaService.persistPrivate.should.equal(true);
      });

      it("defaults maxChainHops to 200 when not provided", () => {
        const vt = new VersionTracker({
          metaServiceUrl: "https://example.org/sysmeta",
        });
        vt.MAX_CHAIN_HOPS.should.equal(200);
      });

      it("falls back to appModel metaServiceUrl when option is omitted", () => {
        const originalMetacatUI = globalThis.MetacatUI;
        globalThis.MetacatUI = {
          ...(originalMetacatUI || {}),
          appModel: {
            get: state.sandbox
              .stub()
              .returns("https://fallback.example.org/meta///"),
            getActiveAltRepo: state.sandbox.stub().returns(null),
            isDOI: state.sandbox.stub().returns(false),
          },
          appUserModel: (originalMetacatUI &&
            originalMetacatUI.appUserModel) || {
            get: state.sandbox.stub().returns(false),
          },
          nodeModel: (originalMetacatUI && originalMetacatUI.nodeModel) || {
            get: state.sandbox.stub(),
            length: 0,
          },
        };
        try {
          const vt = new VersionTracker();
          vt.metaServiceUrl.should.equal("https://fallback.example.org/meta");
        } finally {
          globalThis.MetacatUI = originalMetacatUI;
        }
      });

      it("throws when no metaServiceUrl is available", () => {
        const originalMetacatUI = globalThis.MetacatUI;
        globalThis.MetacatUI = {
          ...(originalMetacatUI || {}),
          appModel: {
            get: state.sandbox.stub().returns(""),
            getActiveAltRepo: state.sandbox.stub().returns(null),
            isDOI: state.sandbox.stub().returns(false),
          },
          appUserModel: (originalMetacatUI &&
            originalMetacatUI.appUserModel) || {
            get: state.sandbox.stub().returns(false),
          },
          nodeModel: (originalMetacatUI && originalMetacatUI.nodeModel) || {
            get: state.sandbox.stub(),
            length: 0,
          },
        };
        try {
          expect(() => new VersionTracker()).to.throw(
            "VersionTracker: metaServiceUrl is required",
          );
        } finally {
          globalThis.MetacatUI = originalMetacatUI;
        }
      });

      it("exposes Backbone-style events", () => {
        state.vt.events.should.have.property("trigger");
        state.vt.events.should.have.property("on");
      });
    });

    describe("service passthroughs", () => {
      it("getSysMeta forwards options to SysMetaService.download", async () => {
        const options = { useCache: false, cacheKey: "pid.1-nocache" };
        const sysMeta = makeSysMeta("pid.2", "pid.0");
        state.service.download.resolves(sysMeta);

        const result = await state.vt.getSysMeta("pid.1", options);

        expect(result).to.equal(sysMeta);
        state.service.download.calledOnceWith("pid.1", options).should.be.true;
      });

      it("sysMetaIsCached delegates to SysMetaService.isCached", async () => {
        state.service.isCached.resolves(true);
        const isCached = await state.vt.sysMetaIsCached("pid.1");
        isCached.should.equal(true);
        state.service.isCached.calledOnceWith("pid.1").should.be.true;
      });

      it("getNext and getPrev delegate to getAdjacent and forward options", async () => {
        const adjacentStub = state.sandbox.stub(state.vt, "getAdjacent");
        const options = { useCache: false, cacheKey: "pid.1-test" };
        adjacentStub.onCall(0).resolves("pid.2");
        adjacentStub.onCall(1).resolves("pid.0");

        const next = await state.vt.getNext("pid.1", options);
        const prev = await state.vt.getPrev("pid.1", options);

        next.should.equal("pid.2");
        prev.should.equal("pid.0");
        adjacentStub.firstCall.args.should.deep.equal(["pid.1", true, options]);
        adjacentStub.secondCall.args.should.deep.equal([
          "pid.1",
          false,
          options,
        ]);
      });
    });

    describe("getAdjacent", () => {
      it("throws on invalid PID", async () => {
        let caught;
        try {
          await state.vt.getAdjacent("", true);
        } catch (err) {
          caught = err;
        }

        expect(caught).to.be.instanceof(Error);
        expect(caught.message).to.match(/Invalid PID/i);
      });

      it("returns the next PID when forward is true", async () => {
        state.service.download.resolves(makeSysMeta("next.1", "prev.1"));

        const next = await state.vt.getAdjacent("pid.1", true);
        next.should.equal("next.1");
        state.service.isCached.called.should.be.false;
        state.service.removeCached.called.should.be.false;
      });

      it("returns the previous PID when forward is false", async () => {
        state.service.download.resolves(makeSysMeta("next.1", "prev.1"));

        const prev = await state.vt.getAdjacent("pid.1", false);
        prev.should.equal("prev.1");
      });

      it("re-fetches when cached and no adjacent PID", async () => {
        state.service.download
          .onCall(0)
          .resolves(makeSysMeta(null, null))
          .onCall(1)
          .resolves(makeSysMeta("pid.2", null));
        state.service.isCached.resolves(true);

        const next = await state.vt.getAdjacent("pid.1", true);
        next.should.equal("pid.2");
        state.service.removeCached.calledOnceWith("pid.1").should.be.true;
        state.service.download.callCount.should.equal(2);
      });

      it("does not invalidate cache when not cached and no adjacent PID", async () => {
        const options = { useCache: false };
        state.service.download.resolves(makeSysMeta(null, null));

        const result = await state.vt.getAdjacent("pid.1", true, options);

        expect(result).to.equal(null);
        state.service.download.calledOnceWith("pid.1", options).should.be.true;
        state.service.isCached.called.should.be.false;
        state.service.removeCached.called.should.be.false;
      });

      it("passes options to both fetches when re-checking stale cache", async () => {
        const options = { cacheKey: "pid.1-key" };
        state.service.download
          .onCall(0)
          .resolves(makeSysMeta(null, null))
          .onCall(1)
          .resolves(makeSysMeta("pid.2", null));
        state.service.isCached.resolves(true);

        const result = await state.vt.getAdjacent("pid.1", true, options);

        result.should.equal("pid.2");
        state.service.download.callCount.should.equal(2);
        state.service.download.firstCall.args.should.deep.equal([
          "pid.1",
          options,
        ]);
        state.service.download.secondCall.args.should.deep.equal([
          "pid.1",
          options,
        ]);
      });

      it("propagates cache invalidation errors", async () => {
        const cacheError = new Error("cache remove failed");
        state.service.download.resolves(makeSysMeta(null, null));
        state.service.isCached.resolves(true);
        state.service.removeCached.rejects(cacheError);

        let caught;
        try {
          await state.vt.getAdjacent("pid.1", true);
        } catch (err) {
          caught = err;
        }

        expect(caught).to.equal(cacheError);
        state.service.download.callCount.should.equal(1);
      });
    });

    describe("getVersions", () => {
      it("collects versions and marks chainComplete", async () => {
        const adjacentStub = state.sandbox.stub(state.vt, "getAdjacent");
        const notifyStub = state.sandbox.stub(state.vt, "notify").resolves();
        state.sandbox.stub(state.vt, "isEndOfChain").resolves(true);

        adjacentStub.onCall(0).resolves("pid.2");
        adjacentStub.onCall(1).resolves("pid.3");
        adjacentStub.onCall(2).resolves(null);

        const record = await state.vt.getVersions("pid.1", 3);

        record.versions.should.deep.equal(["pid.2", "pid.3"]);
        record.completedSteps.should.equal(2);
        record.chainComplete.should.equal(true);
        notifyStub.callCount.should.equal(4);
      });

      it("supports negative steps", async () => {
        const adjacentStub = state.sandbox.stub(state.vt, "getAdjacent");
        state.sandbox.stub(state.vt, "notify").resolves();
        state.sandbox.stub(state.vt, "isEndOfChain").resolves(false);

        adjacentStub.onCall(0).resolves("pid.0");
        adjacentStub.onCall(1).resolves(null);

        const record = await state.vt.getVersions("pid.1", -2);

        record.versions.should.deep.equal(["pid.0"]);
        record.completedSteps.should.equal(-1);
      });

      it("throws when startPid is invalid", async () => {
        let caught;
        try {
          await state.vt.getVersions("", 1);
        } catch (err) {
          caught = err;
        }

        expect(caught).to.be.instanceof(Error);
        caught.message.should.match(/Invalid PID/i);
      });

      it("throws when steps is not an integer", async () => {
        let caught;
        try {
          await state.vt.getVersions("pid.1", 1.5);
        } catch (err) {
          caught = err;
        }

        expect(caught).to.be.instanceof(Error);
        caught.message.should.match(/Steps must be an integer/);
      });

      it("marks endIsPrivate on 401 errors", async () => {
        const error = new Error("private");
        error.status = 401;
        state.sandbox.stub(state.vt, "getAdjacent").rejects(error);

        const record = await state.vt.getVersions("pid.1", 2);
        record.endIsPrivate.should.equal(true);
        record.endNotFound.should.equal(false);
        record.chainComplete.should.equal(false);
      });

      it("marks endNotFound on 404 errors", async () => {
        const error = new Error("missing");
        error.status = 404;
        state.sandbox.stub(state.vt, "getAdjacent").rejects(error);

        const record = await state.vt.getVersions("pid.1", 2);
        record.endNotFound.should.equal(true);
        record.endIsPrivate.should.equal(false);
        record.chainComplete.should.equal(false);
      });

      it("rethrows unknown errors", async () => {
        const error = new Error("boom");
        error.status = 500;
        state.sandbox.stub(state.vt, "getAdjacent").rejects(error);

        let caught;
        try {
          await state.vt.getVersions("pid.1", 2);
        } catch (err) {
          caught = err;
        }

        expect(caught).to.equal(error);
      });

      it("handles zero steps without fetching adjacent versions", async () => {
        const options = { useCache: false, cacheKey: "zero-steps" };
        const adjacentStub = state.sandbox
          .stub(state.vt, "getAdjacent")
          .resolves("pid.2");
        const notifyStub = state.sandbox.stub(state.vt, "notify").resolves();
        const endStub = state.sandbox
          .stub(state.vt, "isEndOfChain")
          .resolves(true);

        const record = await state.vt.getVersions("pid.1", 0, options);

        record.versions.should.deep.equal([]);
        record.completedSteps.should.equal(0);
        record.chainComplete.should.equal(true);
        adjacentStub.called.should.be.false;
        notifyStub.calledOnceWith("pid.1", "pid.1", 0, null, options).should.be
          .true;
        endStub.calledOnceWith("pid.1", false, options).should.be.true;
      });

      it("passes status codes from traversal errors to notify", async () => {
        const error = new Error("missing");
        error.status = 404;
        state.sandbox.stub(state.vt, "getAdjacent").rejects(error);
        const notifyStub = state.sandbox.stub(state.vt, "notify").resolves();

        await state.vt.getVersions("pid.1", 2);

        notifyStub.callCount.should.equal(2);
        notifyStub.firstCall.args.should.deep.equal([
          "pid.1",
          "pid.1",
          0,
          null,
          {},
        ]);
        notifyStub.secondCall.args[0].should.equal("pid.1");
        should.equal(notifyStub.secondCall.args[1], null);
        notifyStub.secondCall.args[2].should.equal(1);
        notifyStub.secondCall.args[3].should.equal(404);
      });

      it("passes options to getAdjacent, notify, and isEndOfChain", async () => {
        const options = { useCache: false, signal: { aborted: false } };
        const adjacentStub = state.sandbox
          .stub(state.vt, "getAdjacent")
          .resolves(null);
        const notifyStub = state.sandbox.stub(state.vt, "notify").resolves();
        const endStub = state.sandbox
          .stub(state.vt, "isEndOfChain")
          .resolves(true);

        await state.vt.getVersions("pid.1", 1, options);

        adjacentStub.calledOnceWith("pid.1", true, options).should.be.true;
        notifyStub.firstCall.args.should.deep.equal([
          "pid.1",
          "pid.1",
          0,
          null,
          options,
        ]);
        notifyStub.secondCall.args.should.deep.equal([
          "pid.1",
          null,
          1,
          null,
          options,
        ]);
        endStub.calledOnceWith("pid.1", true, options).should.be.true;
      });

      it("does not check chainComplete after private/not-found endpoints", async () => {
        const error = new Error("private");
        error.status = 401;
        state.sandbox.stub(state.vt, "getAdjacent").rejects(error);
        state.sandbox.stub(state.vt, "notify").resolves();
        const endStub = state.sandbox
          .stub(state.vt, "isEndOfChain")
          .resolves(true);

        await state.vt.getVersions("pid.1", 1);
        endStub.called.should.be.false;
      });

      it("caps steps according to MAX_CHAIN_HOPS", async () => {
        state.vt.MAX_CHAIN_HOPS = 1;
        const adjacentStub = state.sandbox
          .stub(state.vt, "getAdjacent")
          .resolves("pid.2");
        state.sandbox.stub(state.vt, "notify").resolves();
        state.sandbox.stub(state.vt, "isEndOfChain").resolves(true);
        state.sandbox.stub(console, "warn");

        const record = await state.vt.getVersions("pid.1", 3);

        adjacentStub.calledOnce.should.be.true;
        record.requestedSteps.should.equal(3);
        record.completedSteps.should.equal(1);
        record.versions.should.deep.equal(["pid.2"]);
      });

      it("throws the first queued notify rejection", async () => {
        const firstError = new Error("first notify failure");
        const secondError = new Error("second notify failure");
        state.sandbox.stub(state.vt, "getAdjacent").resolves(null);
        state.sandbox.stub(state.vt, "isEndOfChain").resolves(true);
        const notifyStub = state.sandbox.stub(state.vt, "notify");
        notifyStub.onCall(0).rejects(firstError);
        notifyStub.onCall(1).rejects(secondError);

        let caught;
        try {
          await state.vt.getVersions("pid.1", 1);
        } catch (err) {
          caught = err;
        }

        expect(caught).to.equal(firstError);
        notifyStub.callCount.should.equal(2);
      });

      it("records a date conflict when the first adjacent version is chronologically earlier", async () => {
        const notifyStub = state.sandbox.stub(state.vt, "notify").resolves();
        state.sandbox.stub(state.vt, "isEndOfChain").resolves(true);
        state.sandbox
          .stub(state.vt, "getAdjacent")
          .onCall(0)
          .resolves("pid.2")
          .onCall(1)
          .resolves(null);

        state.sandbox.stub(state.vt, "getSysMeta").callsFake(async (pid) => {
          if (pid === "pid.1") {
            return makeDatedSysMeta({
              identifier: "pid.1",
              dateUploaded: "2024-01-02T00:00:00Z",
              nextPid: "pid.2",
            });
          }
          if (pid === "pid.2") {
            return makeDatedSysMeta({
              identifier: "pid.2",
              dateUploaded: "2024-01-01T00:00:00Z",
              prevPid: "pid.1",
            });
          }
          throw new Error(`Unexpected PID ${pid}`);
        });

        const record = await state.vt.getVersions("pid.1", 2);

        notifyStub.callCount.should.equal(3);
        record.versions.should.deep.equal(["pid.2"]);
        record.dateConflicts.should.have.length(1);
        record.dateConflicts[0].prevPid.should.equal("pid.1");
        record.dateConflicts[0].nextPid.should.equal("pid.2");
      });

      it("prefers traversal errors over notify rejections", async () => {
        const traversalError = new Error("boom");
        traversalError.status = 500;
        const notifyError = new Error("notify failed");
        state.sandbox.stub(state.vt, "getAdjacent").rejects(traversalError);
        const notifyStub = state.sandbox.stub(state.vt, "notify");
        notifyStub.rejects(notifyError);

        let caught;
        try {
          await state.vt.getVersions("pid.1", 2);
        } catch (err) {
          caught = err;
        }

        expect(caught).to.equal(traversalError);
        notifyStub.calledOnce.should.be.true;
      });
    });

    describe("helpers and accessors", () => {
      it("detectDateConflict returns a conflict when chain order and dates disagree", () => {
        const conflict = VersionTracker.detectDateConflict(
          makeDatedSysMeta({
            identifier: "older",
            dateUploaded: "2024-01-03T00:00:00Z",
          }),
          makeDatedSysMeta({
            identifier: "newer",
            dateUploaded: "2024-01-02T00:00:00Z",
          }),
          true,
        );

        expect(conflict).to.be.an("object");
        conflict.prevPid.should.equal("older");
        conflict.nextPid.should.equal("newer");
        conflict.timeDiffMs.should.be.greaterThan(0);
      });

      it("detectDateConflict returns false when dates are chronological", () => {
        const conflict = VersionTracker.detectDateConflict(
          makeDatedSysMeta({
            identifier: "older",
            dateUploaded: "2024-01-01T00:00:00Z",
          }),
          makeDatedSysMeta({
            identifier: "newer",
            dateUploaded: "2024-01-02T00:00:00Z",
          }),
          true,
        );

        expect(conflict).to.equal(false);
      });

      it("getAllVersionsOneDirection uses max chain hops", async () => {
        const stub = state.sandbox.stub(state.vt, "getVersions").resolves({});

        await state.vt.getAllVersionsOneDirection("pid.1", false);
        stub.calledOnceWith("pid.1", -state.vt.MAX_CHAIN_HOPS).should.be.true;
      });

      it("getNth returns null when chain is too short", async () => {
        state.sandbox.stub(state.vt, "getVersions").resolves({
          versions: ["pid.2"],
          completedSteps: 1,
        });

        const result = await state.vt.getNth("pid.1", 2);
        expect(result).to.equal(null);
      });

      it("getNth returns the final PID when chain is long enough", async () => {
        state.sandbox.stub(state.vt, "getVersions").resolves({
          versions: ["pid.2", "pid.3"],
          completedSteps: 2,
        });

        const result = await state.vt.getNth("pid.1", 2);
        expect(result).to.equal("pid.3");
      });

      it("getNth returns the same PID for zero steps without traversal", async () => {
        const versionsStub = state.sandbox.stub(state.vt, "getVersions");
        const result = await state.vt.getNth("pid.1", 0);
        result.should.equal("pid.1");
        versionsStub.called.should.be.false;
      });

      it("getNth throws on invalid PID", async () => {
        let caught;
        try {
          await state.vt.getNth("", 1);
        } catch (err) {
          caught = err;
        }

        expect(caught).to.be.instanceof(Error);
        caught.message.should.match(/Invalid PID/i);
      });

      it("getAllVersions returns prev and next records", async () => {
        const stub = state.sandbox.stub(state.vt, "getAllVersionsOneDirection");
        stub.onCall(0).resolves({ direction: "prev" });
        stub.onCall(1).resolves({ direction: "next" });

        const result = await state.vt.getAllVersions("pid.1");
        result.prev.direction.should.equal("prev");
        result.next.direction.should.equal("next");
      });

      it("getAllVersions forwards options to both traversals", async () => {
        const options = { useCache: false };
        const stub = state.sandbox.stub(state.vt, "getAllVersionsOneDirection");
        stub.onCall(0).resolves({ direction: "prev" });
        stub.onCall(1).resolves({ direction: "next" });

        await state.vt.getAllVersions("pid.1", options);

        stub.firstCall.args.should.deep.equal(["pid.1", false, options]);
        stub.secondCall.args.should.deep.equal(["pid.1", true, options]);
      });

      it("checkPidsInSameVersionChain returns chain membership details", async () => {
        state.sandbox.stub(state.vt, "getAllVersions").resolves({
          prev: { versions: ["pid.0"] },
          next: { versions: ["pid.2"], chainComplete: true },
        });

        const result = await state.vt.checkPidsInSameVersionChain([
          "pid.1",
          "pid.2",
        ]);

        result.should.deep.equal({
          pids: ["pid.1", "pid.2"],
          sameChain: true,
          chain: ["pid.0", "pid.1", "pid.2"],
          newestPid: "pid.2",
          newestInChain: "pid.2",
          chainComplete: true,
          endIsPrivate: false,
          endNotFound: false,
        });
      });

      it("checkPidsInSameVersionChain reports incomplete private ends", async () => {
        state.sandbox.stub(state.vt, "getAllVersions").resolves({
          prev: { versions: [] },
          next: {
            versions: ["pid.2"],
            chainComplete: false,
            endIsPrivate: true,
          },
        });

        const result = await state.vt.checkPidsInSameVersionChain([
          "pid.1",
          "pid.other",
        ]);

        result.sameChain.should.equal(false);
        result.newestPid.should.equal("pid.1");
        result.chainComplete.should.equal(false);
        result.endIsPrivate.should.equal(true);
      });

      it("checkPidsInSameVersionChain reports incomplete older ends", async () => {
        state.sandbox.stub(state.vt, "getAllVersions").resolves({
          prev: {
            versions: ["pid.0"],
            chainComplete: false,
            endNotFound: true,
          },
          next: { versions: ["pid.2"], chainComplete: true },
        });

        const result = await state.vt.checkPidsInSameVersionChain([
          "pid.1",
          "pid.2",
        ]);

        result.sameChain.should.equal(true);
        result.chainComplete.should.equal(false);
        result.endNotFound.should.equal(true);
      });

      it("isEndOfChain inspects sysmeta links", async () => {
        state.service.download.resolves(makeSysMeta("pid.2", null));

        const isEnd = await state.vt.isEndOfChain("pid.1", true);
        isEnd.should.equal(false);
      });

      it("isEndOfChain returns true when no adjacent link exists", async () => {
        state.service.download.resolves(makeSysMeta(null, null));
        const isEnd = await state.vt.isEndOfChain("pid.1", true);
        isEnd.should.equal(true);
      });

      it("getLatestVersion returns the last accessible PID", async () => {
        state.sandbox.stub(state.vt, "getAllVersionsOneDirection").resolves({
          versions: ["pid.2", "pid.3"],
          completedSteps: 2,
        });

        const latest = await state.vt.getLatestVersion("pid.1");
        latest.should.equal("pid.3");
      });

      it("returns self when no newer versions exist", async () => {
        state.sandbox.stub(state.vt, "getAllVersionsOneDirection").resolves({
          versions: [],
          completedSteps: 0,
        });

        const latest = await state.vt.getLatestVersion("pid.1");
        latest.should.equal("pid.1");
      });

      it("returns the resolved sysmeta identifier when a series ID has no newer versions", async () => {
        state.service.download.resolves(
          makeIdentifiedSysMeta("pid.1", null, null),
        );

        const latest = await state.vt.getLatestVersion("seriesId.1");

        latest.should.equal("pid.1");
      });

      it("returns the input PID when the starting sysmeta is not accessible", async () => {
        state.sandbox.stub(state.vt, "getAllVersionsOneDirection").resolves({
          versions: [],
          completedSteps: 0,
          endIsPrivate: true,
        });

        const latest = await state.vt.getLatestVersion("pid.1");

        latest.should.equal("pid.1");
        state.service.download.called.should.equal(false);
      });

      it("gets conclusive latest versions with bounded concurrency", async () => {
        const concurrency = trackConcurrency();
        const getAllVersions = state.sandbox.stub(
          state.vt,
          "getAllVersionsOneDirection",
        );
        getAllVersions.callsFake(
          concurrency.track((pid) => ({
            versions: [`${pid}.latest`],
            chainComplete: true,
          })),
        );

        const latest = await state.vt.getLatestVersions(
          ["pid.1", "pid.2", "pid.3", "pid.4"],
          { useCache: false, maxConcurrent: 2 },
        );

        latest.should.deep.equal([
          "pid.1.latest",
          "pid.2.latest",
          "pid.3.latest",
          "pid.4.latest",
        ]);
        concurrency.max.should.equal(2);
        getAllVersions
          .alwaysCalledWith(sinon.match.string, true, { useCache: false })
          .should.equal(true);
      });

      it("rejects an incomplete latest-version chain", async () => {
        state.sandbox.stub(state.vt, "getAllVersionsOneDirection").resolves({
          versions: ["pid.2"],
          chainComplete: false,
        });

        let caught;
        try {
          await state.vt.getLatestVersions(["pid.1"]);
        } catch (error) {
          caught = error;
        }

        caught.message.should.equal(
          'Cannot determine the latest version of "pid.1"',
        );
      });

      it("propagates aborts while getting latest versions", async () => {
        const abortError = Object.assign(new Error("Aborted"), {
          name: "AbortError",
        });
        state.sandbox
          .stub(state.vt, "getAllVersionsOneDirection")
          .rejects(abortError);

        let caught;
        try {
          await state.vt.getLatestVersions(["pid.1"]);
        } catch (error) {
          caught = error;
        }

        caught.should.equal(abortError);
      });

      it("clears cache via SysMetaService", async () => {
        const cleared = await state.vt.clearCache();
        cleared.should.equal(true);
        state.service.clearCache.calledOnce.should.be.true;
      });
    });

    describe("notify", () => {
      it("returns early when pid is missing", async () => {
        const triggerSpy = state.sandbox.spy(state.vt.events, "trigger");
        const getStub = state.sandbox.stub(state.vt, "getSysMeta");

        await state.vt.notify("", "pid.2", 1);

        triggerSpy.called.should.be.false;
        getStub.called.should.be.false;
      });

      it("emits update events with sysmeta", async () => {
        const updateSpy = sinon.spy();
        const updatePidSpy = sinon.spy();
        state.vt.events.on("versionFound", updateSpy);
        state.vt.events.on("versionFound:pid.1", updatePidSpy);
        state.sandbox
          .stub(state.vt, "getSysMeta")
          .resolves(makeSysMeta("pid.2", "pid.0"));

        await state.vt.notify("pid.1", "pid.2", 1);

        updateSpy.calledOnce.should.be.true;
        updatePidSpy.calledOnce.should.be.true;
        const sysMeta = updateSpy.firstCall.args[0];
        sysMeta.versionHistory["pid.1"].should.equal(1);
        sysMeta.errors.should.deep.equal([]);
      });

      it("sets status for private or missing sysmeta", async () => {
        const error = new Error("private");
        error.status = 401;
        state.sandbox.stub(state.vt, "getSysMeta").rejects(error);
        const updateSpy = sinon.spy();
        state.vt.events.on("versionFound", updateSpy);

        await state.vt.notify("pid.1", "pid.2", 1);
        const sysMeta = updateSpy.firstCall.args[0];
        sysMeta.identifier.should.equal("pid.2");
        sysMeta.errors.should.deep.equal([401]);
        sysMeta.versionHistory["pid.1"].should.equal(1);
      });

      it("sets status for missing (404) sysmeta", async () => {
        const error = new Error("missing");
        error.status = 404;
        state.sandbox.stub(state.vt, "getSysMeta").rejects(error);
        const updateSpy = sinon.spy();
        state.vt.events.on("versionFound", updateSpy);

        await state.vt.notify("pid.1", "pid.2", -1);

        const sysMeta = updateSpy.firstCall.args[0];
        sysMeta.identifier.should.equal("pid.2");
        sysMeta.errors.should.deep.equal([404]);
        sysMeta.versionHistory["pid.1"].should.equal(-1);
      });

      it("forwards options to getSysMeta when fetching notify payload", async () => {
        const options = { useCache: false, cacheKey: "notify" };
        const sysMeta = makeSysMeta("pid.3", "pid.1");
        const getStub = state.sandbox
          .stub(state.vt, "getSysMeta")
          .resolves(sysMeta);

        await state.vt.notify("pid.1", "pid.2", 1, null, options);

        getStub.calledOnceWith("pid.2", options).should.be.true;
      });

      it("logs and suppresses listener errors", async () => {
        const listenerError = new Error("listener failed");
        const logStub = state.sandbox.stub(console, "error");
        state.sandbox
          .stub(state.vt, "getSysMeta")
          .resolves(makeSysMeta("pid.3", "pid.1"));
        state.vt.events.on("versionFound", () => {
          throw listenerError;
        });

        await state.vt.notify("pid.1", "pid.2", 1);

        logStub.calledOnce.should.be.true;
        logStub.firstCall.args[0].should.match(/VersionTracker\.notify/);
        logStub.firstCall.args[1].should.equal(listenerError);
      });

      it("emits placeholder sysmeta when there is no adjacent PID and no status", async () => {
        const updateSpy = sinon.spy();
        const getStub = state.sandbox.stub(state.vt, "getSysMeta");
        state.vt.events.on("versionFound", updateSpy);

        await state.vt.notify("pid.1", null, 1, null);

        getStub.called.should.be.false;
        updateSpy.calledOnce.should.be.true;
        const sysMeta = updateSpy.firstCall.args[0];
        expect(sysMeta).to.exist;
        sysMeta.versionHistory["pid.1"].should.equal(1);
        sysMeta.errors.should.deep.equal([]);
      });

      it("emits placeholder sysmeta payload when status is provided without adjacent sysmeta", async () => {
        const updateSpy = sinon.spy();
        const getStub = state.sandbox.stub(state.vt, "getSysMeta");
        state.vt.events.on("versionFound", updateSpy);

        await state.vt.notify("pid.1", null, 1, 404);

        getStub.called.should.be.false;
        updateSpy.calledOnce.should.be.true;
        const sysMeta = updateSpy.firstCall.args[0];
        sysMeta.errors.should.deep.equal([404]);
      });

      it("rethrows unexpected errors", async () => {
        const error = new Error("boom");
        error.status = 500;
        state.sandbox.stub(state.vt, "getSysMeta").rejects(error);

        let caught;
        try {
          await state.vt.notify("pid.1", "pid.2", 1);
        } catch (err) {
          caught = err;
        }

        expect(caught).to.equal(error);
      });
    });

    describe("capSteps", () => {
      it("caps steps and preserves sign", () => {
        state.vt.MAX_CHAIN_HOPS = 2;
        state.sandbox.stub(console, "warn");

        state.vt.capSteps(5).should.equal(2);
        state.vt.capSteps(-5).should.equal(-2);
      });

      it("returns steps when max hops is Infinity", () => {
        state.vt.MAX_CHAIN_HOPS = Infinity;
        state.vt.capSteps(5).should.equal(5);
      });

      it("returns steps unchanged when under the cap", () => {
        state.vt.MAX_CHAIN_HOPS = 5;
        state.vt.capSteps(3).should.equal(3);
        state.vt.capSteps(-3).should.equal(-3);
      });
    });
  });
});
