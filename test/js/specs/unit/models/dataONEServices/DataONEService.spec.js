define([
  "/test/js/specs/shared/clean-state.js",
  "models/dataONEServices/DataONEService",
  "models/PersistentStorage",
  "md5",
], (cleanState, DataONEService, PersistentStorage, md5) => {
  const should = chai.should();
  const expect = chai.expect;

  const makeStore = (sandbox, cached = null) => ({
    getItem: sandbox.stub().resolves(cached),
    setItem: sandbox.stub().resolves(),
    removeItem: sandbox.stub().resolves(),
    clear: sandbox.stub().resolves(),
  });

  describe("DataONEService", () => {
    const state = cleanState(
      () => {
        const sandbox = sinon.createSandbox();
        const store = makeStore(sandbox);
        sandbox.stub(PersistentStorage, "get").returns(store);
        const service = new DataONEService({ baseUrl: "https://example.org" });

        return { sandbox, store, service };
      },
      beforeEach,
      afterEach,
    );

    afterEach(() => {
      state.sandbox.restore();
      DataONEService.instances = new Map();
    });

    describe("construction and singletons", () => {
      it("requires a baseUrl", () => {
        expect(() => new DataONEService()).to.throw(/baseUrl/);
      });

      it("returns singletons per baseUrl", () => {
        const a = DataONEService.get({ baseUrl: "https://a" });
        const b = DataONEService.get({ baseUrl: "https://a" });
        const c = DataONEService.get({ baseUrl: "https://b" });
        a.should.equal(b);
        a.should.not.equal(c);
      });
    });

    describe("scope keys and store config", () => {
      it("builds scope keys from tokens", () => {
        DataONEService.scopeKey(null).should.equal("public");
        DataONEService.scopeKey("abc").should.equal(`auth:${md5("abc")}`);
      });

      it("uses explicit namespaces when provided", () => {
        const service = new DataONEService({
          baseUrl: "https://example.org",
          storageConfig: { namespace: "custom" },
        });

        service.getStore("tok");
        const options = PersistentStorage.get.firstCall.args[0];
        options.namespace.should.equal("custom");
        expect(options.namespaceOptions).to.equal(undefined);
      });

      it("builds namespace options when namespace is not provided", () => {
        const service = new DataONEService({
          baseUrl: "https://example.org",
          storageConfig: { domain: "dataone", endpoint: "sysmeta" },
        });

        service.getStore("tok");
        const options = PersistentStorage.get.firstCall.args[0];
        options.namespaceOptions.scope.should.equal(`auth:${md5("tok")}`);
        options.namespaceOptions.baseUrl.should.equal("https://example.org");
      });
    });

    describe("token resolution", () => {
      it("returns explicit tokens", async () => {
        const token = await state.service.resolveToken({ token: "abc" });
        token.should.equal("abc");
      });

      it("returns null when auth is false", async () => {
        const token = await state.service.resolveToken({ auth: false });
        expect(token).to.equal(null);
      });

      it("delegates to getToken when needed", async () => {
        state.service.getToken = state.sandbox.stub().resolves("tok");
        const token = await state.service.resolveToken({});
        token.should.equal("tok");
      });
    });

    describe("request/download/upload", () => {
      it("passes resolved tokens to the client request", async () => {
        state.service.getToken = state.sandbox.stub().resolves("tok");
        const reqStub = state.sandbox
          .stub(state.service.client, "request")
          .resolves({ data: "ok" });

        await state.service.request({ path: "/x" });
        reqStub.firstCall.args[0].token.should.equal("tok");
      });

      it("returns cached values when available", async () => {
        const store = makeStore(state.sandbox, "cached");
        state.sandbox.stub(state.service, "getStore").returns(store);
        const reqStub = state.sandbox
          .stub(state.service.client, "request")
          .resolves({ data: "fresh" });

        const result = await state.service.download("/cached", {
          useCache: true,
          auth: false,
        });
        result.should.equal("cached");
        reqStub.called.should.be.false;
      });

      it("skips cache when private data persistence is disabled", async () => {
        const service = new DataONEService({
          baseUrl: "https://example.org",
          persistPrivate: false,
        });
        service.getToken = state.sandbox.stub().resolves("tok");
        const reqStub = state.sandbox
          .stub(service.client, "request")
          .resolves({ data: "fresh" });
        const storeStub = state.sandbox.stub(service, "getStore");

        await service.download("/private", { useCache: true, auth: true });
        reqStub.calledOnce.should.be.true;
        storeStub.called.should.be.false;
      });

      it("stores downloaded values when cache is enabled", async () => {
        const store = makeStore(state.sandbox, null);
        state.sandbox.stub(state.service, "getStore").returns(store);
        state.sandbox
          .stub(state.service.client, "request")
          .resolves({ data: "fresh" });

        const result = await state.service.download("/fresh", {
          useCache: true,
          cacheTtlMs: 50,
          auth: false,
        });
        result.should.equal("fresh");
        store.setItem.calledOnceWith("/fresh", "fresh", {
          ttlMs: 50,
        }).should.be.true;
      });

      it("uploads and updates cache when allowed", async () => {
        const service = new DataONEService({
          baseUrl: "https://example.org",
          persistPrivate: true,
        });
        const store = makeStore(state.sandbox, null);
        state.sandbox.stub(service, "getStore").returns(store);
        const reqStub = state.sandbox
          .stub(service.client, "request")
          .resolves({ data: "ok" });

        await service.upload("/upload", { body: "payload", token: "tok" });
        reqStub.firstCall.args[0].method.should.equal("PUT");
        store.setItem.calledOnceWith("/upload", "payload").should.be.true;
      });
    });

    describe("cache helpers", () => {
      it("getCached returns null when cache is not allowed", async () => {
        const service = new DataONEService({
          baseUrl: "https://example.org",
          persistPrivate: false,
        });
        service.getToken = state.sandbox.stub().resolves("tok");
        const result = await service.getCached("/x", { auth: true });
        expect(result).to.equal(null);
      });

      it("getCached reads from the store when allowed", async () => {
        const service = new DataONEService({
          baseUrl: "https://example.org",
          persistPrivate: true,
        });
        const store = makeStore(state.sandbox, "cached");
        state.sandbox.stub(service, "getStore").returns(store);

        const result = await service.getCached("/x", { token: "tok" });
        result.should.equal("cached");
      });

      it("setCached writes to the store when allowed", async () => {
        const service = new DataONEService({
          baseUrl: "https://example.org",
          persistPrivate: true,
        });
        const store = makeStore(state.sandbox, null);
        state.sandbox.stub(service, "getStore").returns(store);

        const result = await service.setCached("/x", "value", {
          token: "tok",
          ttlMs: 10,
        });
        result.should.equal("value");
        store.setItem.calledOnceWith("/x", "value", { ttlMs: 10 }).should.be
          .true;
      });

      it("isCached reflects cached status", async () => {
        const service = new DataONEService({
          baseUrl: "https://example.org",
          persistPrivate: true,
        });
        const store = makeStore(state.sandbox, "cached");
        state.sandbox.stub(service, "getStore").returns(store);

        const cached = await service.isCached("/x", { token: "tok" });
        cached.should.equal(true);
      });

      it("removeCached and clearCache proxy to store", async () => {
        const service = new DataONEService({
          baseUrl: "https://example.org",
          persistPrivate: true,
        });
        const store = makeStore(state.sandbox, null);
        state.sandbox.stub(service, "getStore").returns(store);

        await service.removeCached("/x", { token: "tok" });
        await service.clearCache({ token: "tok" });

        store.removeItem.calledOnceWith("/x").should.be.true;
        store.clear.calledOnce.should.be.true;
      });

      it("resolveCacheKey prefers explicit cache keys", () => {
        DataONEService.resolveCacheKey("/x", "override").should.equal(
          "override",
        );
        DataONEService.resolveCacheKey("/x", null).should.equal("/x");
      });
    });
  });
});
