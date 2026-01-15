define([
  "/test/js/specs/shared/clean-state.js",
  "models/sysmeta/VersionTracker",
  "models/dataONEServices/SysMetaService",
], (cleanState, VersionTracker, SysMetaService) => {
  const should = chai.should();
  const expect = chai.expect;

  const makeSysMeta = (nextPid = null, prevPid = null) => ({
    data: {
      obsoletedBy: nextPid,
      obsoletes: prevPid,
    },
  });

  describe("VersionTracker", () => {
    const state = cleanState(
      () => {
        const sandbox = sinon.createSandbox();
        const service = {
          download: sandbox.stub(),
          isCached: sandbox.stub().resolves(false),
          removeCached: sandbox.stub().resolves(),
          clearCache: sandbox.stub().resolves(true),
        };
        sandbox.stub(SysMetaService, "get").returns(service);
        const vt = new VersionTracker({
          metaServiceUrl: "https://example.org/sysmeta/",
        });
        return { sandbox, vt, service };
      },
      beforeEach,
      afterEach,
    );

    afterEach(() => {
      state.sandbox.restore();
      VersionTracker.instances = new Map();
      // delete globalThis.MetacatUI;
    });

    describe("construction and singleton", () => {
      it("throws on invalid TTL", () => {
        expect(() => {
          new VersionTracker({ ttlMs: 0, metaServiceUrl: "https://x" });
        }).to.throw("Invalid TTL provided to VersionTracker");
      });

      it("throws on invalid maxChainHops", () => {
        expect(() => {
          new VersionTracker({ maxChainHops: 0, metaServiceUrl: "https://x" });
        }).to.throw("Invalid maxChainHops provided to VersionTracker");
      });

      it("normalizes metaServiceUrl and configures SysMetaService", () => {
        SysMetaService.get.resetHistory();
        const vt = new VersionTracker({
          metaServiceUrl: "https://example.org/sysmeta///",
          ttlMs: 123,
          maxChainHops: 3,
        });

        vt.metaServiceUrl.should.equal("https://example.org/sysmeta");
        SysMetaService.get.calledOnce.should.be.true;
        const args = SysMetaService.get.firstCall.args[0];
        args.baseUrl.should.equal("https://example.org/sysmeta");
        args.storageConfig.ttlMs.should.equal(123);
        args.persistPrivate.should.equal(true);
      });

      it("returns the same instance for the same URL", () => {
        const vt1 = VersionTracker.get("https://example.org/sysmeta/");
        const vt2 = VersionTracker.get("https://example.org/sysmeta");
        vt1.should.equal(vt2);
      });

      it("separates singleton instances by URL", () => {
        const vt1 = VersionTracker.get("https://example.org/sysmeta");
        const vt2 = VersionTracker.get("https://example.org/other");
        vt1.should.not.equal(vt2);
      });

      it("exposes Backbone-style events", () => {
        state.vt.events.should.have.property("trigger");
        state.vt.events.should.have.property("on");
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
        notifyStub.callCount.should.equal(3);
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
    });

    describe("helpers and accessors", () => {
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

      it("getAllVersions returns prev and next records", async () => {
        const stub = state.sandbox.stub(state.vt, "getAllVersionsOneDirection");
        stub.onCall(0).resolves({ direction: "prev" });
        stub.onCall(1).resolves({ direction: "next" });

        const result = await state.vt.getAllVersions("pid.1");
        result.prev.direction.should.equal("prev");
        result.next.direction.should.equal("next");
      });

      it("isEndOfChain inspects sysmeta links", async () => {
        state.service.download.resolves(makeSysMeta("pid.2", null));

        const isEnd = await state.vt.isEndOfChain("pid.1", true);
        isEnd.should.equal(false);
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

      it("clears cache via SysMetaService", async () => {
        const cleared = await state.vt.clearCache();
        cleared.should.equal(true);
        state.service.clearCache.calledOnce.should.be.true;
      });
    });

    describe("notify", () => {
      it("emits update events with sysmeta", async () => {
        const updateSpy = sinon.spy();
        const updatePidSpy = sinon.spy();
        state.vt.events.on("update", updateSpy);
        state.vt.events.on("update:pid.1", updatePidSpy);
        state.sandbox
          .stub(state.vt, "getSysMeta")
          .resolves(makeSysMeta("pid.2", "pid.0"));

        await state.vt.notify("pid.1", "pid.2", 1);

        updateSpy.calledOnce.should.be.true;
        updatePidSpy.calledOnce.should.be.true;
        const record = updateSpy.firstCall.args[0];
        record.pid.should.equal("pid.1");
        record.foundPid.should.equal("pid.2");
        expect(record.status).to.equal(undefined);
      });

      it("sets status for private or missing sysmeta", async () => {
        const error = new Error("private");
        error.status = 401;
        state.sandbox.stub(state.vt, "getSysMeta").rejects(error);
        const updateSpy = sinon.spy();
        state.vt.events.on("update", updateSpy);

        await state.vt.notify("pid.1", "pid.2", 1);
        const record = updateSpy.firstCall.args[0];
        record.status.should.equal(401);
        expect(record.foundSysMeta).to.equal(null);
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
    });
  });
});
