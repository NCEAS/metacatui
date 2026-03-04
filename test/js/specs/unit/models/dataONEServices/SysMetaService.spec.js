define([
  "/test/js/specs/shared/clean-state.js",
  "models/dataONEServices/SysMetaService",
  "models/sysmeta/SysMeta",
], (cleanState, SysMetaService, SysMeta) => {
  const should = chai.should();

  const SAMPLE_XML =
    "<systemMetadata><identifier>sample.1</identifier></systemMetadata>";

  const makeResponse = (
    body,
    { status = 200, url = "https://example.org/sysmeta/pid.1" } = {},
  ) => {
    const response = new Response(body, { status });
    Object.defineProperty(response, "url", { value: url });
    return response;
  };

  describe("SysMetaService", () => {
    const state = cleanState(() => {
      const sandbox = sinon.createSandbox();
      return { sandbox };
    }, beforeEach);

    afterEach(() => {
      state.sandbox.restore();
      SysMetaService.instances = new Map();
      // delete globalThis.MetacatUI;
      if (globalThis.fetch && globalThis.fetch.restore) {
        globalThis.fetch.restore();
      }
    });

    describe("construction", () => {
      it("applies default client and storage config", () => {
        const service = new SysMetaService({
          baseUrl: "https://example.org/sysmeta",
        });
        service.storageConfig.ttlMs.should.equal(60 * 60 * 1000);
        service.storageConfig.schemaVersion.should.equal(1);
        service.storageConfig.instanceKeys.should.include("SysMetaService");
        service.storageConfig.instanceKeys.should.include(
          "https://example.org/sysmeta",
        );
        service.client.allowedHttpMethods.should.include("POST");
        service.client.responseTypes.should.include("text");
      });

      it("merges storage overrides", () => {
        const service = new SysMetaService({
          baseUrl: "https://example.org/sysmeta",
          storageConfig: {
            ttlMs: 5000,
            schemaVersion: 2,
            instanceKeys: ["custom"],
          },
        });
        service.storageConfig.ttlMs.should.equal(5000);
        service.storageConfig.schemaVersion.should.equal(2);
        service.storageConfig.instanceKeys.should.include("custom");
        service.storageConfig.instanceKeys.should.include("SysMetaService");
        service.storageConfig.instanceKeys.should.include(
          "https://example.org/sysmeta",
        );
      });
    });

    describe("download", () => {
      it("fetches XML and returns a SysMeta instance", async () => {
        state.sandbox
          .stub(globalThis, "fetch")
          .resolves(makeResponse(SAMPLE_XML));

        const service = new SysMetaService({
          baseUrl: "https://example.org/sysmeta",
        });
        const result = await service.download("pid.1", {
          auth: false,
          useCache: false,
        });

        result.should.be.instanceof(SysMeta);
        result.data.identifier.should.equal("sample.1");
      });

      it("sets seriesId when returned identifier differs from requested PID", async () => {
        state.sandbox
          .stub(globalThis, "fetch")
          .resolves(makeResponse(SAMPLE_XML));

        const service = new SysMetaService({
          baseUrl: "https://example.org/sysmeta",
        });
        const result = await service.download("series.1", {
          auth: false,
          useCache: false,
        });

        result.data.identifier.should.equal("sample.1");
        result.seriesId.should.equal("series.1");
      });

      it("returns cached XML when available", async () => {
        const service = new SysMetaService({
          baseUrl: "https://example.org/sysmeta",
        });
        const store = {
          getItem: state.sandbox.stub().resolves(SAMPLE_XML),
        };
        state.sandbox.stub(service, "getStore").returns(store);
        const reqStub = state.sandbox
          .stub(service.client, "request")
          .resolves({ data: "fresh" });

        const result = await service.download("pid.1", {
          auth: false,
          useCache: true,
        });

        result.data.identifier.should.equal("sample.1");
        reqStub.called.should.be.false;
      });

      it("uses explicit cache keys when provided", async () => {
        const service = new SysMetaService({
          baseUrl: "https://example.org/sysmeta",
        });
        const store = {
          getItem: state.sandbox.stub().resolves(null),
          setItem: state.sandbox.stub().resolves(),
        };
        state.sandbox.stub(service, "getStore").returns(store);
        state.sandbox
          .stub(service.client, "request")
          .resolves({ data: SAMPLE_XML });

        await service.download("pid.1", {
          auth: false,
          cacheKey: "custom-key",
        });

        store.getItem.calledOnceWith("custom-key").should.be.true;
      });

      it("encodes slashes in PIDs when building the URL", async () => {
        const fetchStub = state.sandbox
          .stub(globalThis, "fetch")
          .callsFake((url) => {
            url.should.equal("https://example.org/sysmeta/doi%3A10.5063%2Fabc");
            return Promise.resolve(makeResponse(SAMPLE_XML));
          });

        const service = new SysMetaService({
          baseUrl: "https://example.org/sysmeta",
        });
        await service.download("doi:10.5063/abc", {
          auth: false,
          useCache: false,
        });

        fetchStub.calledOnce.should.be.true;
      });

      it("invalidates cache and rejects when XML parsing fails", async () => {
        const service = new SysMetaService({
          baseUrl: "https://example.org/sysmeta",
        });
        state.sandbox.stub(service, "getCached").resolves(null);
        state.sandbox.stub(service, "request").resolves({ data: "<not-xml>" });
        state.sandbox.stub(service, "setCached").resolves("<not-xml>");
        const removeCachedStub = state.sandbox
          .stub(service, "removeCached")
          .resolves();
        state.sandbox.stub(SysMeta, "fromXml").throws(new Error("Bad XML"));

        try {
          await service.download("pid.bad", { auth: false, cacheKey: "k.bad" });
          should.fail("Expected SysMetaService.download to reject on parse failure");
        } catch (err) {
          err.message.should.match(
            /Failed to parse SysMeta XML for PID pid\.bad: Bad XML/,
          );
        }

        removeCachedStub.calledOnceWith("k.bad").should.be.true;
      });
    });

    describe("invalidate", () => {
      it("removes cached entries for a PID", async () => {
        const service = new SysMetaService({
          baseUrl: "https://example.org/sysmeta",
        });
        const removeStub = state.sandbox
          .stub(service, "removeCached")
          .resolves();

        await service.invalidate("pid.1");
        removeStub.calledOnceWith("pid.1").should.be.true;
      });

      it("no-ops without a PID", async () => {
        const service = new SysMetaService({
          baseUrl: "https://example.org/sysmeta",
        });
        const removeStub = state.sandbox
          .stub(service, "removeCached")
          .resolves();

        await service.invalidate("");
        removeStub.called.should.be.false;
      });
    });

    describe("upload", () => {
      it("posts XML with the correct headers", async () => {
        const service = new SysMetaService({
          baseUrl: "https://example.org/sysmeta",
        });
        const reqStub = state.sandbox
          .stub(service.client, "request")
          .resolves({ data: "ok" });
        const xml = "<systemMetadata></systemMetadata>";

        await service.upload(xml, { auth: false });

        const opts = reqStub.firstCall.args[0];
        opts.method.should.equal("POST");
        opts.path.should.equal("");
        opts.headers["Content-Type"].should.equal("application/xml");
        opts.body.should.equal(xml);
      });
    });

    describe("update", () => {
      it("puts multipart sysmeta updates with XHR transport", async () => {
        const service = new SysMetaService({
          baseUrl: "https://example.org/sysmeta",
        });
        const reqStub = state.sandbox
          .stub(service, "request")
          .resolves({ data: "ok" });
        const setCachedStub = state.sandbox
          .stub(service, "setCached")
          .resolves();
        const xml = "<systemMetadata></systemMetadata>";
        const onUploadProgress = state.sandbox.spy();
        const controller = new AbortController();

        await service.update("pid.1", xml, {
          auth: false,
          signal: controller.signal,
          onUploadProgress,
        });

        const opts = reqStub.firstCall.args[0];
        opts.method.should.equal("PUT");
        opts.path.should.equal("pid.1");
        opts.transport.should.equal("xhr");
        opts.dedupe.should.equal(false);
        opts.responseType.should.equal("text");
        opts.useCache.should.equal(false);
        opts.signal.should.equal(controller.signal);
        opts.onUploadProgress.should.equal(onUploadProgress);
        opts.body.should.be.instanceof(FormData);
        opts.body.get("pid").should.equal("pid.1");
        opts.body.get("sysmeta").should.be.instanceof(Blob);
        setCachedStub.called.should.be.false;
      });

      it("encodes slashes in PIDs when updating", async () => {
        const requests = [];
        class FakeXMLHttpRequest {
          open(method, url) {
            this.method = method;
            this.url = url;
          }

          setRequestHeader() {}

          getAllResponseHeaders() {
            return "";
          }

          send() {
            requests.push(this.url);
            this.status = 200;
            this.responseText = "ok";
            this.responseURL = this.url;
            this.onload();
          }
        }
        state.sandbox.stub(globalThis, "XMLHttpRequest").callsFake(() => {
          return new FakeXMLHttpRequest();
        });

        const service = new SysMetaService({
          baseUrl: "https://example.org/sysmeta",
        });
        const xml = "<systemMetadata></systemMetadata>";

        await service.update("doi:10.5063/abc", xml, { auth: false });
        requests[0].should.equal(
          "https://example.org/sysmeta/doi%3A10.5063%2Fabc",
        );
      });
    });
  });
});
