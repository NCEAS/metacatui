define([
  "/test/js/specs/shared/clean-state.js",
  "models/resourceMap/ResourceMapResolver",
  "models/sysmeta/SysMeta",
  "collections/SolrResults",
  "common/QueryService",
], (cleanState, ResourceMapResolver, SysMeta, SolrResults, QueryService) => {
  const should = chai.should();
  const expect = chai.expect;

  describe("ResourceMapResolver Test Suite", () => {
    const state = cleanState(
      () => {
        const sandbox = sinon.createSandbox();
        const rmr = new ResourceMapResolver({
          consoleLevel: "info",
          metaServiceUrl: "https://example.org/sysmeta",
        });
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
        state.rmr.storage.should.exist;
        state.rmr.maxSteps.should.equal(200);
        state.rmr.maxFetchTime.should.equal(45000);
        state.rmr.eventLog.logs.size.should.equal(0);
        state.rmr.eventLog.consoleLevel.should.equal("info");
        state.rmr.versionTracker.should.exist;
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

    describe("static log helpers", () => {
      it("checkLogForMultipleRMs returns false for empty or single rm arrays", () => {
        ResourceMapResolver.checkLogForMultipleRMs({
          events: [{ meta: { rms: [] } }, { meta: { rms: ["rm.1"] } }],
        }).should.equal(false);
      });

      it("checkLogForMultipleRMs returns true only for 2+ rms", () => {
        ResourceMapResolver.checkLogForMultipleRMs({
          events: [{ meta: { rms: ["rm.1", "rm.2"] } }],
        }).should.equal(true);
      });
    });

    describe("searchIndex()", () => {
      it("escapes PID values when building the Solr query", async () => {
        const pid = 'pid:"v1"+(x/y)';
        const setQuery = state.sandbox.stub(SolrResults.prototype, "setQuery");
        state.sandbox.stub(SolrResults.prototype, "setfields");
        state.sandbox.stub(SolrResults.prototype, "queryPromise").resolves();
        state.sandbox.stub(SolrResults.prototype, "toJSON").returns([]);
        state.sandbox.stub(SolrResults.prototype, "getNumFound").returns(0);

        await ResourceMapResolver.searchIndex(pid);

        const escapedPid = QueryService.escapeLucene(pid);
        setQuery.calledOnceWithExactly(
          `id:"${escapedPid}" OR seriesId:"${escapedPid}"`,
        ).should.be.true;
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
        sandbox.stub(rmr, "addToStorage").resolves();
        sandbox.stub(rmr, "log").returns({});
        sandbox.stub(rmr, "trigger");

        const result = rmr.status("obj123", "foundAndValid", "rm123");
        result.success.should.be.true;
        rmr.addToStorage.calledOnceWithExactly("obj123", "rm123").should.be
          .true;
        rmr.trigger.calledTwice.should.be.true;
      });

      it("does not store when resMap is null", () => {
        const { sandbox, rmr } = state;
        sandbox.stub(rmr, "addToStorage").resolves();
        sandbox.stub(rmr, "log").returns({});
        sandbox.stub(rmr, "trigger");

        const result = rmr.status("obj999", "allMiss", null);
        result.success.should.be.false;
        rmr.addToStorage.called.should.be.false;
      });

      it("does not flag multipleRMs when rms metadata is empty or single-item", () => {
        const { sandbox, rmr } = state;
        const log = {
          events: [{ meta: { rms: [] } }, { meta: { rms: ["rm.single"] } }],
        };
        sandbox.stub(rmr, "log").returns(log);
        sandbox.stub(rmr, "trigger");

        const result = rmr.status("obj999", "allMiss", null);
        should.equal(result.multipleRMs, undefined);
      });

      it("logs addToStorage failures without throwing", async () => {
        const { sandbox, rmr } = state;
        const persistError = new Error("persist failed");
        sandbox.stub(rmr, "addToStorage").rejects(persistError);
        sandbox.stub(rmr, "log").returns({ events: [] });
        sandbox.stub(rmr, "trigger");
        const logStub = sandbox.stub(rmr.eventLog, "consoleLog");

        rmr.status("obj123", "foundAndValid", "rm123");
        await Promise.resolve();

        logStub.calledOnce.should.be.true;
        logStub.firstCall.args[0].should.match(/Failed to persist RM/);
        logStub.firstCall.args[3].should.equal(persistError);
      });
    });

    describe("resolve() control-flow", () => {
      it("returns immediately on an index match", async () => {
        const { sandbox, rmr } = state;

        sandbox
          .stub(ResourceMapResolver, "searchIndex")
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

        ResourceMapResolver.searchIndex.calledOnce.should.be.true;
      });

      it("continues resolution when index search throws", async () => {
        const { sandbox, rmr } = state;
        const indexError = new Error("index unavailable");
        sandbox.stub(ResourceMapResolver, "searchIndex").rejects(indexError);
        sandbox.stub(rmr, "checkStorage").resolves({ rm: "rmFromStorage" });
        sandbox.stub(rmr, "verify").resolves(true);
        const statusStub = sandbox
          .stub(rmr, "status")
          .callsFake((pid, _s, rm) => ({
            success: !!rm,
            pid,
            rm,
          }));
        const logStub = sandbox.stub(rmr.eventLog, "consoleLog");

        const result = await rmr.resolve("objPid");
        result.should.deep.equal({
          success: true,
          pid: "objPid",
          rm: "rmFromStorage",
        });

        logStub.calledOnce.should.be.true;
        statusStub.firstCall.args[3].indexError.should.equal(true);
        statusStub.firstCall.args[3].error.should.equal("index unavailable");
      });

      it("delegates to resolveFromSeriesId when the pid is a SID", async () => {
        const { sandbox, rmr } = state;

        sandbox
          .stub(ResourceMapResolver, "searchIndex")
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
          .stub(ResourceMapResolver, "searchIndex")
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
          .stub(ResourceMapResolver, "searchIndex")
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
          .stub(ResourceMapResolver, "searchIndex")
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
          .stub(ResourceMapResolver, "searchIndex")
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

        ResourceMapResolver.searchIndex.calledOnceWithExactly("objPid").should
          .be.true;
        rmr.checkStorage.calledOnceWithExactly("objPid").should.be.true;
        rmr.walkSysmeta.calledOnceWithExactly("objPid").should.be.true;
        rmr.guessPid.calledOnceWithExactly("objPid").should.be.true;
      });

      it("returns unauthorized when sysmeta walk reports 401", async () => {
        const { sandbox, rmr } = state;

        sandbox
          .stub(ResourceMapResolver, "searchIndex")
          .resolves({ rm: null, meta: { isSid: false } });
        sandbox.stub(rmr, "checkStorage").resolves({ rm: null });
        sandbox
          .stub(rmr, "walkSysmeta")
          .resolves({ rm: null, meta: { unauthorized: true } });
        sandbox.stub(rmr, "status").returns({ success: false, rm: null });

        const result = await rmr.resolve("objPid");
        result.success.should.equal(false);

        rmr.walkSysmeta.calledOnceWithExactly("objPid").should.be.true;
      });

      it("handles multiple resource maps from index", async () => {
        const { sandbox, rmr } = state;

        sandbox.stub(ResourceMapResolver, "searchIndex").resolves({
          rm: null,
          meta: { isSid: false, rms: ["rm1", "rm2"] },
        });
        sandbox.stub(rmr, "multiRMCheck").resolves({
          pid: "objPid",
          rm: "rm2",
          meta: {},
        });
        sandbox.stub(rmr, "status").returns({ success: true, rm: "rm2" });

        const result = await rmr.resolve("objPid");
        result.rm.should.equal("rm2");
        rmr.multiRMCheck.calledOnce.should.be.true;
      });
    });

    describe("walkSysmeta()", () => {
      it("returns gracefully when prior-version index lookup throws", async () => {
        const { sandbox, rmr } = state;
        const indexError = new Error("solr down");
        sandbox
          .stub(rmr.versionTracker, "getPrev")
          .onFirstCall()
          .resolves("pid.0");
        sandbox.stub(ResourceMapResolver, "searchIndex").rejects(indexError);
        const logStub = sandbox.stub(rmr.eventLog, "consoleLog");

        const result = await rmr.walkSysmeta("pid.1");

        should.equal(result.rm, null);
        result.meta.stepsBack.should.equal(1);
        result.meta.indexError.should.equal(true);
        result.meta.error.should.equal("solr down");
        result.meta.pastPids.should.deep.equal(["pid.0"]);
        logStub.calledOnce.should.be.true;
      });
    });

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

        rmr.once("update", genericSpy);
        rmr.once("update:objEvt", specificSpy);

        const res = rmr.status("objEvt", "customStatus", "rmEvt");
        res.success.should.be.true;

        genericSpy.calledOnce.should.be.true;
        specificSpy.calledOnce.should.be.true;
      });
    });

    describe("multiRMCheck()", () => {
      it("resolves to the latest RM when the given RMs are all versions of each other", async () => {
        const { sandbox, rmr } = state;
        sandbox.stub(rmr.versionTracker, "getAllVersions").resolves({
          prev: { versions: ["rm0"], chainComplete: true },
          next: {
            versions: ["rm2"],
            chainComplete: true,
            endIsPrivate: false,
            endNotFound: false,
          },
        });

        const result = await rmr.multiRMCheck("objPid", ["rm1", "rm2"]);

        result.should.deep.equal({ pid: "objPid", rm: "rm2", meta: {} });
      });

      it("flags RMs that are not versions of each other", async () => {
        const { sandbox, rmr } = state;
        sandbox.stub(rmr.versionTracker, "getAllVersions").resolves({
          prev: { versions: [], chainComplete: true },
          next: {
            versions: ["rmB"],
            chainComplete: true,
            endIsPrivate: false,
            endNotFound: false,
          },
        });

        const result = await rmr.multiRMCheck("objPid", ["rmA", "rmC"]);
        result.should.deep.equal({
          pid: "objPid",
          rm: null,
          meta: { multipleRMsNotVersions: true },
        });
      });

      it("flags when all RMs are versions of each other but all are obsoleted", async () => {
        const { sandbox, rmr } = state;
        sandbox.stub(rmr.versionTracker, "getAllVersions").resolves({
          prev: { versions: ["r0"], chainComplete: true },
          next: {
            versions: ["r2", "r3"],
            chainComplete: true,
            endIsPrivate: false,
            endNotFound: false,
          },
        });

        const result = await rmr.multiRMCheck("objPid", ["r1", "r2"]);

        result.should.deep.equal({
          pid: "objPid",
          rm: null,
          meta: { multipleRMsAllObsoleted: true },
        });
      });

      it("returns chainIncomplete details when latest RM cannot be confirmed", async () => {
        const { sandbox, rmr } = state;
        sandbox.stub(rmr.versionTracker, "getAllVersions").resolves({
          prev: { versions: [], chainComplete: true },
          next: {
            versions: ["rm2"],
            chainComplete: false,
            endIsPrivate: true,
            endNotFound: false,
          },
        });

        const result = await rmr.multiRMCheck("objPid", ["rm1", "rm2"]);

        result.should.deep.equal({
          pid: "objPid",
          rm: null,
          meta: { chainIncomplete: true, unauthorized: true },
        });
      });
    });

    describe("resolveFromSeriesId()", () => {
      it("delegates to resolve() when sysmeta contains an identifier", async () => {
        const { sandbox, rmr } = state;

        sandbox
          .stub(rmr.versionTracker, "getSysMeta")
          .resolves(new SysMeta({ identifier: "pidFromSid" }));
        sandbox.stub(rmr, "status");
        sandbox.stub(rmr, "resolve").resolves({
          success: true,
          pid: "pidFromSid",
          rm: "rmFromSid",
        });
        sandbox.stub(rmr, "verify").resolves(true);

        const result = await rmr.resolveFromSeriesId("sidPID");
        result.should.deep.equal({
          success: true,
          pid: "pidFromSid",
          rm: "rmFromSid",
        });

        rmr.resolve.calledOnceWithExactly("pidFromSid").should.be.true;
      });

      it("does not remove external update listeners for the resolved PID", async () => {
        const { sandbox, rmr } = state;
        const externalSpy = sandbox.spy();
        rmr.on("update:pidFromSid", externalSpy);

        sandbox.stub(rmr, "getPidForSid").resolves("pidFromSid");
        sandbox.stub(rmr, "resolve").callsFake(async (pid) => {
          rmr.trigger(`update:${pid}`, {
            pid,
            status: "step",
            rm: null,
            meta: {},
          });
          return { success: false, pid };
        });

        await rmr.resolveFromSeriesId("sidPID");
        externalSpy.calledOnce.should.be.true;

        rmr.trigger("update:pidFromSid", {
          pid: "pidFromSid",
          status: "after",
          rm: null,
          meta: {},
        });
        externalSpy.calledTwice.should.be.true;
      });

      it("returns a no-PID status when sysmeta lacks an identifier", async () => {
        const { sandbox, rmr } = state;

        sandbox.stub(rmr, "getPidForSid").resolves(null);
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

    describe("addToStorage()", () => {
      it("clears and retries on quota errors", async () => {
        const { sandbox, rmr } = state;
        const quotaErr = new Error("QuotaExceededError");
        sandbox.stub(rmr.storage, "setItem");
        rmr.storage.setItem.onCall(0).rejects(quotaErr);
        rmr.storage.setItem.onCall(1).resolves("rm123");
        sandbox.stub(rmr, "clearStorage").resolves();

        const result = await rmr.addToStorage("pid", "rm123");

        result.should.equal("rm123");
        rmr.clearStorage.calledOnce.should.be.true;
        rmr.storage.setItem.callCount.should.equal(2);
      });
    });
  });
});
