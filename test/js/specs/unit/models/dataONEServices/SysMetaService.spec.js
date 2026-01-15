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
        service.storageConfig.endpoint.should.equal("sysmeta");
        service.storageConfig.name.should.equal("MetacatUI_SysMetaService");
        service.client.allowedHttpMethods.should.include("POST");
        service.client.responseTypes.should.include("text");
      });

      it("merges storage overrides", () => {
        const service = new SysMetaService({
          baseUrl: "https://example.org/sysmeta",
          storageConfig: { ttlMs: 5000, endpoint: "custom" },
        });
        service.storageConfig.ttlMs.should.equal(5000);
        service.storageConfig.endpoint.should.equal("custom");
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
    });

    describe("invalidate", () => {
      it("removes cached entries for a PID", async () => {
        const service = new SysMetaService({
          baseUrl: "https://example.org/sysmeta",
        });
        const removeStub = state.sandbox
          .stub(service, "removeCached")
          .resolves();

        await service.invalidate("pid.1", { token: "tok" });
        removeStub.calledOnceWith("pid.1", { token: "tok" }).should.be.true;
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

        await service.upload(xml, { token: "tok" });

        const opts = reqStub.firstCall.args[0];
        opts.method.should.equal("POST");
        opts.path.should.equal("");
        opts.headers["Content-Type"].should.equal("application/xml");
        opts.body.should.equal(xml);
        opts.token.should.equal("tok");
      });
    });
  });
});
