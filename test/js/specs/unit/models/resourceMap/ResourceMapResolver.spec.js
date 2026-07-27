define([
  "/test/js/specs/shared/clean-state.js",
  "models/resourceMap/ResourceMapResolver",
  "models/dataONEServices/ObjectService",
  "models/resourceMap/ResourceMap",
  "models/sysmeta/SystemMetadata",
  "common/QueryService",
], (
  cleanState,
  ResourceMapResolver,
  ObjectService,
  ResourceMap,
  SysMeta,
  QueryService,
) => {
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

    describe("searchIndex()", () => {
      it("escapes PID values when building the Solr query", async () => {
        const pid = 'pid:"v1"+(x/y)';
        const queryWithFetch = state.sandbox
          .stub(QueryService, "queryWithFetch")
          .resolves({ response: { numFound: 0, docs: [] } });

        await ResourceMapResolver.searchIndex(pid);

        queryWithFetch.calledOnce.should.be.true;
        queryWithFetch.firstCall.args[0].q.should.equal(
          QueryService.buildIdQuery(pid),
        );
        queryWithFetch.firstCall.args[0].fields.should.include("dateUploaded");
      });

      it("returns a direct RM for a data PID when one RM is indexed", async () => {
        state.sandbox.stub(QueryService, "queryWithFetch").resolves({
          response: {
            numFound: 1,
            docs: [
              {
                id: "data.1",
                formatType: "DATA",
                resourceMap: ["rm.1"],
              },
            ],
          },
        });

        const result = await ResourceMapResolver.searchIndex("data.1");

        result.rm.should.equal("rm.1");
        result.meta.isData.should.equal(true);
      });

      const ORE_FORMAT_ID = "http://www.openarchives.org/ore/terms";
      [
        {
          from: "format type and format ID",
          fields: { formatType: "RESOURCE", formatId: ORE_FORMAT_ID },
        },
        { from: "format ID", fields: { formatId: ORE_FORMAT_ID } },
      ].forEach(({ from, fields }) => {
        it(`identifies a resource map PID from ${from}`, async () => {
          state.sandbox.stub(QueryService, "queryWithFetch").resolves({
            response: {
              numFound: 1,
              docs: [{ id: "resource_map_1", ...fields }],
            },
          });

          const result =
            await ResourceMapResolver.searchIndex("resource_map_1");

          result.rm.should.equal("resource_map_1");
          result.meta.isResourceMap.should.equal(true);
        });
      });

      it("does not classify a generic resource as a resource map", async () => {
        state.sandbox.stub(QueryService, "queryWithFetch").resolves({
          response: {
            numFound: 1,
            docs: [{ id: "generic-resource.1", formatType: "RESOURCE" }],
          },
        });

        const result =
          await ResourceMapResolver.searchIndex("generic-resource.1");

        should.equal(result.rm, null);
        should.equal(result.meta.isResourceMap, undefined);
      });

      it("does not overwrite a direct resource map match with indexed resourceMap values", async () => {
        state.sandbox.stub(QueryService, "queryWithFetch").resolves({
          response: {
            numFound: 1,
            docs: [
              {
                id: "resource_map_1",
                formatType: "RESOURCE",
                formatId: "http://www.openarchives.org/ore/terms",
                resourceMap: ["resource_map_other"],
              },
            ],
          },
        });

        const result = await ResourceMapResolver.searchIndex("resource_map_1");

        result.rm.should.equal("resource_map_1");
        result.meta.rms.should.deep.equal(["resource_map_other"]);
      });

      it("rejects index responses with duplicate documents for one PID", async () => {
        state.sandbox.stub(QueryService, "queryWithFetch").resolves({
          response: {
            numFound: 2,
            docs: [
              { id: "data.dup.1", formatType: "DATA" },
              { id: "data.dup.1", formatType: "DATA" },
            ],
          },
        });

        let caught = null;
        try {
          await ResourceMapResolver.searchIndex("data.dup.1");
        } catch (error) {
          caught = error;
        }

        expect(caught).to.be.instanceOf(Error);
        caught.message.should.match(/Multiple documents were found in index/);
      });
    });

    describe("fetchResourceMap()", () => {
      it("passes configured services when parsing a downloaded Resource Map", async () => {
        const originalMetacatUI = globalThis.MetacatUI;
        globalThis.MetacatUI = {
          ...(originalMetacatUI || {}),
          appModel: {
            get(key) {
              if (key === "resolveServiceUrl") {
                return "https://cn.example.org/cn/v2/resolve";
              }
              if (key === "objectServiceUrl") {
                return "https://mn.example.org/mn/v2/object";
              }
              return null;
            },
          },
        };
        const download = state.sandbox
          .stub(ObjectService.prototype, "download")
          .callsFake(function fakeDownload() {
            this.readBaseUrl.should.equal(
              "https://mn.example.org/mn/v2/object",
            );
            return "<rdf:RDF></rdf:RDF>";
          });
        const fromXml = state.sandbox.stub(ResourceMap, "fromXml").returns({
          getMemberPids: () => [],
        });

        try {
          await state.rmr.fetchResourceMap("resource_map_1", { timeoutMs: 0 });
        } finally {
          globalThis.MetacatUI = originalMetacatUI;
        }

        download.firstCall.args[1].timeoutMs.should.equal(0);
        sinon.assert.calledOnceWithExactly(
          fromXml,
          "resource_map_1",
          "<rdf:RDF></rdf:RDF>",
          {
            resolveServiceUrl: "https://cn.example.org/cn/v2/resolve",
            objectServiceUrl: "https://mn.example.org/mn/v2/object",
          },
        );
      });

      it("preserves structured ownership conflicts from verification fetches", async () => {
        const issues = [
          {
            code: "ambiguousResourceMapRoot",
            severity: "error",
            reason: "ambiguous",
          },
        ];
        const conflict = Object.assign(new Error("ambiguous owner"), {
          issues,
        });
        state.sandbox
          .stub(ObjectService.prototype, "download")
          .resolves("<rdf:RDF></rdf:RDF>");
        state.sandbox.stub(ResourceMap, "fromXml").throws(conflict);

        let caught = null;
        try {
          await state.rmr.fetchResourceMap("resource_map_1");
        } catch (error) {
          caught = error;
        }

        caught.should.equal(conflict);
        caught.issues.should.equal(issues);
      });
    });

    describe("trackMissingResourceMap()", () => {
      it("sends one PID-only analytics event", () => {
        const { sandbox, rmr } = state;
        const trackCustomEvent = sandbox.stub();
        rmr.eventLog.analyticsModel = { trackCustomEvent };

        rmr.trackMissingResourceMap("meta.1");

        sinon.assert.calledOnceWithExactly(
          trackCustomEvent,
          "resource_map_missing",
          { pid: "meta.1" },
        );
      });
    });

    describe("checkStorage()", () => {
      it("resolves with a resMap value when storage contains a mapping", async () => {
        const { sandbox, rmr } = state;
        sandbox.stub(rmr.storage, "getItem").resolves("rm_pid_123");
        const result = await rmr.checkStorage("obj_pid_123");
        result.should.equal("rm_pid_123");
      });

      it("resolves with null when storage has no mapping", async () => {
        const { sandbox, rmr } = state;
        sandbox.stub(rmr.storage, "getItem").resolves(null);
        const result = await rmr.checkStorage("obj_pid_456");
        should.equal(result, null);
      });
    });

    describe("guessPid()", () => {
      it("returns the guessed PID when verify resolves true", async () => {
        const { sandbox, rmr } = state;
        sandbox.stub(rmr, "verify").resolves(true);

        const guessed = await rmr.guessPid("myObjPid");
        guessed.should.equal("resource_map_myObjPid");
        rmr.verify.calledOnceWith("resource_map_myObjPid", "myObjPid").should.be
          .true;
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
        sandbox.stub(rmr, "log").returns({ events: [] });
        sandbox.stub(rmr.events, "trigger");

        const result = rmr.status("obj123", "foundAndValid", "rm123");
        result.success.should.be.true;
        rmr.addToStorage.calledOnceWithExactly("obj123", "rm123").should.be
          .true;
        rmr.events.trigger.calledTwice.should.be.true;
        rmr.events.trigger.firstCall.args[0].should.equal("update");
        rmr.events.trigger.secondCall.args[0].should.equal("update:obj123");
      });

      it("does not store when resMap is null", () => {
        const { sandbox, rmr } = state;
        sandbox.stub(rmr, "addToStorage").resolves();
        sandbox.stub(rmr, "log").returns({ events: [] });
        sandbox.stub(rmr.events, "trigger");

        const result = rmr.status("obj999", "allMiss", null);
        result.success.should.be.false;
        rmr.addToStorage.called.should.be.false;
      });

      it("derives failure flags from qualifying log metadata", () => {
        const { sandbox, rmr } = state;
        const log = sandbox.stub(rmr, "log");
        log.onFirstCall().returns({
          events: [{ meta: { rms: [] } }, { meta: { rms: ["rm.single"] } }],
        });
        log.onSecondCall().returns({
          events: [
            {
              meta: {
                unauthorized: true,
                rms: ["rm.1", "rm.2"],
              },
            },
          ],
        });
        sandbox.stub(rmr.events, "trigger");

        const ordinaryMiss = rmr.status("obj999", "allMiss", null);
        should.equal(ordinaryMiss.unauthorized, undefined);
        should.equal(ordinaryMiss.multipleRMs, undefined);

        const qualifiedMiss = rmr.status("obj999", "allMiss", null);
        qualifiedMiss.unauthorized.should.equal(true);
        qualifiedMiss.multipleRMs.should.equal(true);
      });

      it("logs addToStorage failures without throwing", async () => {
        const { sandbox, rmr } = state;
        const persistError = new Error("persist failed");
        sandbox.stub(rmr, "addToStorage").rejects(persistError);
        sandbox.stub(rmr, "log").returns({ events: [] });
        sandbox.stub(rmr.events, "trigger");
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
        sandbox.stub(rmr, "checkStorage").resolves("rmFromStorage");
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

        rmr.resolveFromSeriesId.calledOnceWith("sid123").should.be.true;
      });

      it("checks storage when index search returns no resMap", async () => {
        const { sandbox, rmr } = state;

        sandbox
          .stub(ResourceMapResolver, "searchIndex")
          .resolves({ rm: null, meta: { isSid: false } });
        sandbox.stub(rmr, "checkStorage").resolves("rmFromStorage");
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
        sandbox.stub(rmr, "checkStorage").resolves(null);
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

        rmr.walkSysmeta.calledOnceWith("objPid").should.be.true;
      });

      it("walks sysmeta when the storage check fails", async () => {
        const { sandbox, rmr } = state;

        sandbox
          .stub(ResourceMapResolver, "searchIndex")
          .resolves({ rm: null, meta: { isSid: false } });
        sandbox.stub(rmr, "checkStorage").rejects(new Error("storage failed"));
        sandbox
          .stub(rmr, "walkSysmeta")
          .resolves({ rm: "rmFromSysmeta", meta: {} });
        sandbox
          .stub(rmr, "status")
          .returns({ success: true, rm: "rmFromSysmeta" });
        sandbox.stub(rmr, "verify").resolves(true);
        const logStub = sandbox.stub(rmr.eventLog, "consoleLog");

        const result = await rmr.resolve("objPid");

        result.should.deep.equal({
          success: true,
          rm: "rmFromSysmeta",
        });
        rmr.walkSysmeta.calledOnceWith("objPid").should.be.true;
        logStub.calledOnce.should.be.true;
      });

      it("guesses PID when sysmeta walk returns no resMap", async () => {
        const { sandbox, rmr } = state;

        sandbox
          .stub(ResourceMapResolver, "searchIndex")
          .resolves({ rm: null, meta: { isSid: false } });
        sandbox.stub(rmr, "checkStorage").resolves(null);
        sandbox.stub(rmr, "walkSysmeta").resolves({ rm: null, meta: {} });
        sandbox.stub(rmr, "guessPid").resolves("guessedRM");
        sandbox.stub(rmr, "status").returns({ success: true, rm: "guessedRM" });

        const result = await rmr.resolve("objPid");
        result.should.deep.equal({
          success: true,
          rm: "guessedRM",
        });

        rmr.guessPid.calledOnceWith("objPid").should.be.true;
      });

      it("returns allMiss when no resMap is found", async () => {
        const { sandbox, rmr } = state;

        sandbox
          .stub(ResourceMapResolver, "searchIndex")
          .resolves({ rm: null, meta: { isSid: false } });
        sandbox.stub(rmr, "checkStorage").resolves(null);
        sandbox.stub(rmr, "walkSysmeta").resolves({ rm: null, meta: {} });
        sandbox.stub(rmr, "guessPid").resolves(null);
        sandbox.stub(rmr, "status").returns({ success: false, rm: null });

        const result = await rmr.resolve("objPid");
        result.should.deep.equal({
          success: false,
          rm: null,
        });

        ResourceMapResolver.searchIndex.calledOnceWith("objPid").should.be.true;
        rmr.checkStorage.calledOnceWithExactly("objPid").should.be.true;
        rmr.walkSysmeta.calledOnceWith("objPid").should.be.true;
        rmr.guessPid.calledOnceWith("objPid").should.be.true;
      });

      it("returns unauthorized when sysmeta walk reports 401", async () => {
        const { sandbox, rmr } = state;

        sandbox
          .stub(ResourceMapResolver, "searchIndex")
          .resolves({ rm: null, meta: { isSid: false } });
        sandbox.stub(rmr, "checkStorage").resolves(null);
        sandbox
          .stub(rmr, "walkSysmeta")
          .resolves({ rm: null, meta: { unauthorized: true } });
        sandbox.stub(rmr, "status").returns({ success: false, rm: null });

        const result = await rmr.resolve("objPid");
        result.success.should.equal(false);

        rmr.walkSysmeta.calledOnceWith("objPid").should.be.true;
      });

      it("handles multiple resource maps from index", async () => {
        const { sandbox, rmr } = state;

        sandbox.stub(ResourceMapResolver, "searchIndex").resolves({
          rm: null,
          meta: { isSid: false, rms: ["rm1", "rm2"] },
        });
        sandbox.stub(rmr, "multiRMCheck").resolves({
          rm: "rm2",
          meta: {},
        });
        sandbox.stub(rmr, "status").returns({ success: true, rm: "rm2" });

        const result = await rmr.resolve("objPid");
        result.rm.should.equal("rm2");
        rmr.multiRMCheck.calledOnce.should.be.true;
      });

      it("resolves a data PID via metadata links from isDocumentedBy", async () => {
        const { sandbox, rmr } = state;

        sandbox
          .stub(ResourceMapResolver, "searchIndex")
          .onCall(0)
          .resolves({
            rm: null,
            meta: {
              isSid: false,
              isData: true,
              isDocumentedBy: ["meta.1"],
              rms: [],
            },
          })
          .onCall(1)
          .resolves({
            rm: "rm.fromMeta",
            meta: {
              isSid: false,
              rms: ["rm.fromMeta"],
            },
          });

        sandbox.stub(rmr, "status").callsFake((pid, _status, rm) => ({
          success: !!rm,
          pid,
          rm: rm || null,
        }));
        sandbox.stub(rmr, "verify").resolves(true);

        const result = await rmr.resolve("data.1");
        result.should.deep.equal({
          success: true,
          pid: "data.1",
          rm: "rm.fromMeta",
        });

        ResourceMapResolver.searchIndex.firstCall.args[0].should.equal(
          "data.1",
        );
        ResourceMapResolver.searchIndex.secondCall.args[0].should.equal(
          "meta.1",
        );
      });

      it("preserves direct RM candidates when metadata lookup finds none", async () => {
        const { sandbox, rmr } = state;
        sandbox.stub(ResourceMapResolver, "searchIndex").resolves({
          rm: null,
          meta: {
            isData: true,
            isDocumentedBy: ["meta.1"],
            rms: ["rm.1", "rm.2"],
          },
        });
        sandbox.stub(rmr, "resolveFromMetadataPids").resolves({
          rm: null,
          meta: { rms: [] },
        });
        sandbox.stub(rmr, "multiRMCheck").resolves({
          rm: "rm.2",
          meta: {},
        });
        sandbox.stub(rmr, "status").returns({ success: true, rm: "rm.2" });

        const result = await rmr.resolve("data.1");

        result.rm.should.equal("rm.2");
        rmr.multiRMCheck.calledOnceWithExactly(["rm.1", "rm.2"], {}).should.be
          .true;
      });

      it("stops self-documentation cycles", async () => {
        const { sandbox, rmr } = state;
        const searchIndex = sandbox
          .stub(ResourceMapResolver, "searchIndex")
          .resolves({
            rm: null,
            meta: {
              isData: true,
              isDocumentedBy: ["data.1"],
              rms: ["rm.1", "rm.2"],
            },
          });
        sandbox.stub(rmr, "reducePidsToLatest").resolves(["data.1"]);
        sandbox.stub(rmr, "multiRMCheck").resolves({
          rm: "rm.2",
          meta: {},
        });
        sandbox.stub(rmr, "addToStorage").resolves();

        const result = await rmr.resolve("data.1");

        result.rm.should.equal("rm.2");
        searchIndex.callCount.should.equal(1);
        result.log.events
          .some(({ meta }) => meta?.resolutionCycle)
          .should.equal(true);
      });

      it("stops cycles across two metadata PIDs", async () => {
        const { sandbox, rmr } = state;
        const searchIndex = sandbox
          .stub(ResourceMapResolver, "searchIndex")
          .callsFake(async (pid) => ({
            rm: null,
            meta: {
              isData: true,
              isDocumentedBy: [pid === "meta.1" ? "meta.2" : "meta.1"],
              rms: [],
            },
          }));
        sandbox.stub(rmr, "reducePidsToLatest").callsFake(async (pids) => pids);
        sandbox.stub(rmr, "checkStorage").resolves(null);
        sandbox.stub(rmr, "walkSysmeta").resolves({ rm: null, meta: {} });
        sandbox.stub(rmr, "guessPid").resolves(null);

        const result = await rmr.resolve("meta.1");

        result.success.should.equal(false);
        searchIndex.callCount.should.equal(2);
        result.log.events
          .some(
            ({ meta }) => meta?.resolutionCycle && meta.cyclePid === "meta.1",
          )
          .should.equal(true);
      });
    });

    describe("metadata PID resolution", () => {
      it("retains nested ambiguous RM candidates", async () => {
        const { sandbox, rmr } = state;
        sandbox.stub(rmr, "reducePidsToLatest").resolves(["meta.1"]);
        sandbox.stub(rmr, "resolve").resolves({
          rm: "rm.1",
          meta: { rms: ["rm.1", "rm.2"] },
        });

        const result = await rmr.resolveFromMetadataPids(["meta.1"]);

        should.equal(result.rm, null);
        result.meta.rms.should.deep.equal(["rm.1", "rm.2"]);
      });

      it("keeps selected PIDs when a later version-chain lookup fails", async () => {
        const { sandbox, rmr } = state;
        sandbox
          .stub(rmr.versionTracker, "checkPidsInSameVersionChain")
          .onFirstCall()
          .resolves({
            sameChain: false,
            chain: ["meta.1"],
            newestPid: "meta.1.latest",
          })
          .onSecondCall()
          .rejects(new Error("version lookup failed"));

        const result = await rmr.reducePidsToLatest([
          "meta.1",
          "meta.2",
          "meta.3",
        ]);

        result.should.deep.equal(["meta.1.latest", "meta.2", "meta.3"]);
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

      it("returns gracefully when the forward walk errors transiently", async () => {
        const { sandbox, rmr } = state;
        // Backward walk finds an old RM one step back...
        sandbox.stub(rmr.versionTracker, "getPrev").resolves("pid.0");
        sandbox
          .stub(ResourceMapResolver, "searchIndex")
          .resolves({ rm: "rm.old" });
        // ...but walking forward to the current RM hits a transient 500.
        const transientError = new Error("sysmeta 500");
        transientError.status = 500;
        sandbox.stub(rmr.versionTracker, "getNth").rejects(transientError);
        const logStub = sandbox.stub(rmr.eventLog, "consoleLog");

        const result = await rmr.walkSysmeta("pid.1");

        // No hard rejection: returns null so resolve() can fall through to
        // the guess strategy, and the error is recorded, not thrown.
        should.equal(result.rm, null);
        result.meta.stepsBack.should.equal(1);
        result.meta.errors.should.deep.equal([500]);
        should.equal(result.meta.unauthorized, undefined);
        logStub.calledOnce.should.be.true;
      });
    });

    describe("verify()", () => {
      it("returns true when the resource map model contains the PID", async () => {
        const { sandbox, rmr } = state;
        const model = { getMemberPids: () => ["pidTrue"] };

        sandbox.stub(rmr, "fetchResourceMap").resolves({ model, status: 200 });
        sandbox.stub(rmr, "status"); // we just assert it was called

        const result = await rmr.verify("rm123", "pidTrue");
        result.should.be.true;

        rmr.fetchResourceMap.calledOnceWith("rm123").should.be.true;
        rmr.status.calledOnce.should.be.true;
      });

      it("returns false when the model does not list the PID as a member", async () => {
        const { sandbox, rmr } = state;
        const model = { getMemberPids: () => [] };

        sandbox.stub(rmr, "fetchResourceMap").resolves({ model, status: 200 });
        sandbox.stub(rmr, "status");

        const result = await rmr.verify("rm123", "missingPid");
        result.should.be.false;

        rmr.status.calledOnce.should.be.true;
      });

      it("requires the input PID when validating RM membership", async () => {
        const { sandbox, rmr } = state;
        const model = { getMemberPids: () => ["meta.2"] };

        sandbox.stub(rmr, "fetchResourceMap").resolves({ model, status: 200 });
        sandbox.stub(rmr, "status");

        const result = await rmr.verify("rm123", "data.1");
        result.should.be.false;

        rmr.status.calledOnce.should.be.true;
        should.not.exist(rmr.status.firstCall.args[3].matchedPid);
      });
    });

    describe("multiRMCheck()", () => {
      it("resolves to the latest RM when the given RMs are all versions of each other", async () => {
        const { sandbox, rmr } = state;
        sandbox
          .stub(rmr.versionTracker, "checkPidsInSameVersionChain")
          .resolves({
            sameChain: true,
            newestPid: "rm2",
            newestInChain: "rm2",
            chainComplete: true,
          });

        const result = await rmr.multiRMCheck(["rm1", "rm2"]);

        result.should.deep.equal({ rm: "rm2", meta: {} });
      });

      it("flags RMs that are not versions of each other", async () => {
        const { sandbox, rmr } = state;
        sandbox
          .stub(rmr.versionTracker, "checkPidsInSameVersionChain")
          .resolves({ sameChain: false, chainComplete: true });

        const result = await rmr.multiRMCheck(["rmA", "rmC"]);
        result.should.deep.equal({
          rm: null,
          meta: { multipleRMsNotVersions: true },
        });
      });

      it("flags when all RMs are versions of each other but all are obsoleted", async () => {
        const { sandbox, rmr } = state;
        sandbox
          .stub(rmr.versionTracker, "checkPidsInSameVersionChain")
          .resolves({
            sameChain: true,
            newestPid: "r2",
            newestInChain: "r3",
            chainComplete: true,
          });

        const result = await rmr.multiRMCheck(["r1", "r2"]);

        result.should.deep.equal({
          rm: null,
          meta: { multipleRMsAllObsoleted: true },
        });
      });

      it("returns chainIncomplete details when latest RM cannot be confirmed", async () => {
        const { sandbox, rmr } = state;
        sandbox
          .stub(rmr.versionTracker, "checkPidsInSameVersionChain")
          .resolves({ chainComplete: false, endIsPrivate: true });

        const result = await rmr.multiRMCheck(["rm1", "rm2"]);

        result.should.deep.equal({
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

        const result = await rmr.resolveFromSeriesId("sidPID");
        result.should.deep.equal({
          success: true,
          pid: "pidFromSid",
          rm: "rmFromSid",
        });

        rmr.resolve.calledOnceWith("pidFromSid").should.be.true;
      });

      it("does not remove external update listeners for the resolved PID", async () => {
        const { sandbox, rmr } = state;
        const externalSpy = sandbox.spy();
        rmr.events.on("update:pidFromSid", externalSpy);

        sandbox.stub(rmr, "getPidForSid").resolves("pidFromSid");
        sandbox.stub(rmr, "resolve").callsFake(async (pid) => {
          rmr.events.trigger(`update:${pid}`, {
            pid,
            status: "step",
            rm: null,
            meta: {},
          });
          return { success: false, pid };
        });

        await rmr.resolveFromSeriesId("sidPID");
        externalSpy.calledOnce.should.be.true;

        rmr.events.trigger("update:pidFromSid", {
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
        sandbox.stub(rmr.storage, "clear").resolves();

        const result = await rmr.addToStorage("pid", "rm123");

        result.should.equal("rm123");
        rmr.storage.clear.calledOnce.should.be.true;
        rmr.storage.setItem.callCount.should.equal(2);
      });
    });
  });
});
