define([
  "/test/js/specs/shared/clean-state.js",
  "models/dataONEServices/DataONEService",
  "models/dataONEServices/DataONEHttpClient",
  "models/PersistentStorage",
  "md5",
], (cleanState, DataONEService, DataONEHttpClient, PersistentStorage, md5) => {
  const should = chai.should();
  const expect = chai.expect;

  const makeStore = (sandbox, cached = null) => ({
    getItem: sandbox.stub().resolves(cached),
    setItem: sandbox.stub().resolves(),
    removeItem: sandbox.stub().resolves(),
    clear: sandbox.stub().resolves(),
  });

  const makeClient = (sandbox) => ({
    request: sandbox.stub().resolves({ data: "ok" }),
  });

  describe("DataONEService", () => {
    const state = cleanState(
      () => {
        const sandbox = sinon.createSandbox();
        const store = makeStore(sandbox);
        const client = makeClient(sandbox);
        sandbox.stub(PersistentStorage, "get").returns(store);
        sandbox.stub(DataONEHttpClient, "get").returns(client);
        const service = new DataONEService({ baseUrl: "https://example.org/" });

        return { sandbox, store, client, service };
      },
      beforeEach,
      afterEach,
    );

    afterEach(() => {
      state.sandbox.restore();
    });

    describe("normalizeOptions", () => {
      it("requires a baseUrl", () => {
        expect(() => DataONEService.normalizeOptions()).to.throw(/baseUrl/);
      });

      it("rejects whitespace-only base URLs", () => {
        expect(() =>
          DataONEService.normalizeOptions({
            baseUrl: "   ",
          }),
        ).to.throw(/baseUrl/);
      });

      it("normalizes baseUrl and applies defaults", () => {
        const normalized = DataONEService.normalizeOptions({
          baseUrl: "https://example.org/",
        });

        normalized.baseUrl.should.equal("https://example.org");
        normalized.clientConfig.baseUrl.should.equal("https://example.org");
        normalized.storageConfig.instanceKeys.should.deep.equal([
          "https://example.org",
        ]);
        normalized.persistPrivate.should.equal(false);
        normalized.defaultAuth.should.equal(true);
      });

      it("preserves explicit storageConfig and boolean flags", () => {
        const normalized = DataONEService.normalizeOptions({
          baseUrl: "https://example.org",
          persistPrivate: true,
          defaultAuth: false,
          storageConfig: { schemaVersion: 0 },
        });

        normalized.storageConfig.schemaVersion.should.equal(0);
        normalized.persistPrivate.should.equal(true);
        normalized.defaultAuth.should.equal(false);
      });

      it("preserves provided storage instance keys", () => {
        const normalized = DataONEService.normalizeOptions({
          baseUrl: "https://example.org",
          storageConfig: { instanceKeys: ["k1", "k2"] },
        });

        normalized.storageConfig.instanceKeys.should.deep.equal(["k1", "k2"]);
      });
    });

    describe("header helpers", () => {
      it("mergeHeadersWithDefaults applies missing defaults case-insensitively", () => {
        const merged = DataONEService.mergeHeadersWithDefaults(
          {
            Authorization: "Bearer abc",
          },
          {
            Accept: "text/xml",
            "Content-Type": "application/xml",
          },
        );

        merged.Authorization.should.equal("Bearer abc");
        merged.Accept.should.equal("text/xml");
        merged["Content-Type"].should.equal("application/xml");
      });

      it("mergeHeadersWithDefaults preserves caller-provided headers", () => {
        const merged = DataONEService.mergeHeadersWithDefaults(
          {
            accept: "application/json",
          },
          {
            Accept: "text/xml",
          },
        );

        merged.accept.should.equal("application/json");
        should.not.exist(merged.Accept);
      });

      it("withDefaultAccept injects Accept only when absent", () => {
        const opts = DataONEService.withDefaultAccept({ path: "/x" });
        opts.headers.Accept.should.equal("text/xml");

        const explicit = DataONEService.withDefaultAccept({
          path: "/x",
          headers: {
            accept: "application/xml",
          },
        });
        explicit.headers.accept.should.equal("application/xml");
        should.not.exist(explicit.headers.Accept);
      });
    });

    describe("shared client helpers", () => {
      it("buildClientConfig normalizes baseUrl and unions default/override client arrays", () => {
        const config = DataONEService.buildClientConfig({
          defaults: {
            allowedHttpMethods: ["get"],
            responseTypes: ["blob"],
            headerNamesForDedup: ["Authorization"],
          },
          overrides: {
            allowedHttpMethods: ["put", " "],
            responseTypes: ["text"],
            headerNamesForDedup: ["Accept"],
          },
          baseUrl: "https://example.org/",
        });

        config.baseUrl.should.equal("https://example.org");
        config.allowedHttpMethods.should.deep.equal(["GET", "PUT"]);
        config.responseTypes.should.deep.equal(["blob", "text"]);
        config.headerNamesForDedup.should.deep.equal([
          "Authorization",
          "Accept",
        ]);
      });

      it("buildClientConfig omits empty arrays so the client keeps its defaults", () => {
        const config = DataONEService.buildClientConfig({
          baseUrl: "https://example.org",
        });

        config.should.not.have.property("allowedHttpMethods");
        config.should.not.have.property("responseTypes");
        config.should.not.have.property("headerNamesForDedup");
      });

      it("buildPidPath encodes the PID and appends a query string", () => {
        DataONEService.buildPidPath(" doi:10.5063/abc ").should.equal(
          "doi:10.5063%2Fabc",
        );
        DataONEService.buildPidPath("doi:10.5063/abc", {
          query: "action=write",
        }).should.equal("doi:10.5063%2Fabc?action=write");
      });

      it("pickRequestOptions only forwards defined request keys", () => {
        const options = DataONEService.pickRequestOptions({
          auth: false,
          signal: "sig",
          headers: { Accept: "text/plain" },
          ignored: true,
        });

        options.should.deep.equal({
          auth: false,
          signal: "sig",
          headers: { Accept: "text/plain" },
        });
      });

      it("normalizes PIDs and encodes them as single path segments", () => {
        DataONEService.normalizePid(" doi:10.5063/abc ").should.equal(
          "doi:10.5063/abc",
        );
        DataONEService.encodePidPath(" doi:10.5063/abc ").should.equal(
          "doi:10.5063%2Fabc",
        );
      });

      it("uses the subclass name in default PID validation errors", () => {
        class ExampleService extends DataONEService {}

        expect(() => ExampleService.normalizePid("")).to.throw(
          /ExampleService: pid is required/,
        );
      });

      it("classifies ambiguous write errors", () => {
        [
          { name: "TimeoutError" },
          { networkError: true },
          {},
          { status: 0 },
          { status: 408 },
          { status: 500 },
          { status: 503 },
        ].forEach((error) => {
          DataONEService.isAmbiguousWriteError(error).should.equal(true);
        });
      });

      it("does not classify client authorization errors as ambiguous writes", () => {
        [400, 401, 403].forEach((status) => {
          DataONEService.isAmbiguousWriteError({ status }).should.equal(false);
        });
      });
    });

    describe("descriptor helpers", () => {
      class DescribedService extends DataONEService {}
      DescribedService.config = {
        endpoint: "described",
        appModelKeys: ["primaryUrl", "fallbackUrl"],
        client: {
          timeoutMs: 1234,
          methods: ["GET", "POST"],
          responseTypes: ["text"],
          dedupeHeaders: ["Authorization"],
        },
        storage: { ttlMs: 500 },
        persistPrivate: false,
        defaultAuth: false,
      };

      it("resolveBaseUrl prefers an explicit URL", () => {
        DescribedService.resolveBaseUrl(
          "https://explicit.example.org/",
        ).should.equal("https://explicit.example.org");
      });

      it("resolveBaseUrl walks appModelKeys in order", () => {
        state.sandbox.stub(globalThis, "MetacatUI").value({
          appModel: {
            get(key) {
              return key === "fallbackUrl"
                ? "https://fallback.example.org"
                : null;
            },
          },
        });

        DescribedService.resolveBaseUrl().should.equal(
          "https://fallback.example.org",
        );
      });

      it("clientDefaults maps the descriptor client block to client option names", () => {
        DescribedService.clientDefaults().should.deep.equal({
          timeoutMs: 1234,
          allowedHttpMethods: ["GET", "POST"],
          responseTypes: ["text"],
          headerNamesForDedup: ["Authorization"],
        });
      });

      it("buildStorageConfig namespaces instance keys by service name and base URL", () => {
        const storageConfig = DescribedService.buildStorageConfig(
          { instanceKeys: ["caller"] },
          "https://example.org",
        );

        storageConfig.ttlMs.should.equal(500);
        storageConfig.instanceKeys.should.deep.equal([
          "caller",
          "DescribedService",
          "https://example.org",
        ]);
      });

      it("optionsFromDescriptor builds normalized super() options", () => {
        const options = DescribedService.optionsFromDescriptor({
          baseUrl: "https://example.org/",
        });

        options.baseUrl.should.equal("https://example.org");
        options.clientConfig.baseUrl.should.equal("https://example.org");
        options.clientConfig.allowedHttpMethods.should.deep.equal([
          "GET",
          "POST",
        ]);
        options.persistPrivate.should.equal(false);
        options.defaultAuth.should.equal(false);
        options.storageConfig.instanceKeys.should.deep.equal([
          "DescribedService",
          "https://example.org",
        ]);
      });

      it("optionsFromDescriptor throws a named error when no base URL resolves", () => {
        state.sandbox
          .stub(globalThis, "MetacatUI")
          .value({ appModel: { get: () => null } });

        expect(() => DescribedService.optionsFromDescriptor()).to.throw(
          /DescribedService: baseUrl is required/,
        );
      });
    });

    describe("construction", () => {
      it("uses DataONEHttpClient.get with normalized client config", () => {
        const service = new DataONEService({ baseUrl: "https://example.org/" });
        service.should.be.instanceof(DataONEService);
        DataONEHttpClient.get.called.should.be.true;
        const callArgs = DataONEHttpClient.get.lastCall.args[0];
        callArgs.baseUrl.should.equal("https://example.org");
      });
    });

    describe("user model helpers", () => {
      it("getUserName returns existing usernames without token lookup", async () => {
        const userModel = {
          get: state.sandbox
            .stub()
            .callsFake((key) => (key === "username" ? "alice" : null)),
          getTokenPromise: state.sandbox.stub().resolves("tok"),
        };
        state.sandbox
          .stub(DataONEService, "awaitUserModel")
          .resolves(userModel);

        const userName = await state.service.getUserName();
        userName.should.equal("alice");
        userModel.getTokenPromise.called.should.be.false;
      });

      it("getUserName resolves usernames from token parsing", async () => {
        const getStub = state.sandbox.stub();
        // when get is called with "tokenChecked", return false to trigger token parsing
        getStub.withArgs("tokenChecked").returns(false);
        // If get is called with "token", return null the first time to indicate
        // no token is set, then return a token the second time to trigger
        // username parsing
        getStub.withArgs("token").onFirstCall().returns(null);
        getStub.withArgs("token").onSecondCall().returns("tok");
        // when get is called with "username" the first time, return null to indicate the username is not already set
        getStub.withArgs("username").onFirstCall().returns(null);
        // when get is called with "username" the second time, return the parsed username
        getStub.withArgs("username").onSecondCall().returns("bob");
        const userModel = {
          get: getStub,
          getTokenPromise: state.sandbox.stub().resolves("tok"),
        };
        state.sandbox
          .stub(DataONEService, "awaitUserModel")
          .resolves(userModel);

        const userName = await state.service.getUserName();
        userName.should.equal("bob");
        userModel.getTokenPromise.calledOnce.should.be.true;
      });

      it("getUserName returns null when token parsing fails", async () => {
        const warnStub = state.sandbox.stub(console, "warn");
        const userModel = {
          get: state.sandbox.stub().returns(null),
          getTokenPromise: state.sandbox.stub().rejects(new Error("fail")),
        };
        state.sandbox
          .stub(DataONEService, "awaitUserModel")
          .resolves(userModel);

        const userName = await state.service.getUserName();
        expect(userName).to.equal(null);
        warnStub.calledOnce.should.be.true;
      });

      it("getToken returns existing tokens without token lookup", async () => {
        const userModel = {
          get: state.sandbox
            .stub()
            .callsFake((key) => (key === "token" ? "tok" : null)),
          getTokenPromise: state.sandbox.stub().resolves("other"),
        };
        state.sandbox
          .stub(DataONEService, "awaitUserModel")
          .resolves(userModel);

        const token = await state.service.getToken();
        token.should.equal("tok");
        userModel.getTokenPromise.called.should.be.false;
      });

      it("getToken falls back to token lookup", async () => {
        const userModel = {
          get: state.sandbox.stub().returns(null),
          getTokenPromise: state.sandbox.stub().resolves("tok"),
        };
        state.sandbox
          .stub(DataONEService, "awaitUserModel")
          .resolves(userModel);

        const token = await state.service.getToken();
        token.should.equal("tok");
        userModel.getTokenPromise.calledOnce.should.be.true;
      });

      it("getToken returns null when token lookup fails", async () => {
        const warnStub = state.sandbox.stub(console, "warn");
        const userModel = {
          get: state.sandbox.stub().returns(null),
          getTokenPromise: state.sandbox.stub().rejects(new Error("fail")),
        };
        state.sandbox
          .stub(DataONEService, "awaitUserModel")
          .resolves(userModel);

        const token = await state.service.getToken();
        expect(token).to.equal(null);
        warnStub.calledOnce.should.be.true;
      });
    });

    describe("cache scope and storage", () => {
      it("builds scope keys from usernames", async () => {
        state.sandbox.stub(state.service, "getUserName").resolves("alice");
        const key = await state.service.scopeKey();
        key.should.equal(`auth:${md5("alice")}`);
      });

      it("uses public scope keys for anonymous users", async () => {
        state.sandbox.stub(state.service, "getUserName").resolves(null);
        const key = await state.service.scopeKey();
        key.should.equal(`auth:${md5("public")}`);
      });

      it("adds scope instance keys without mutating config", async () => {
        const storageConfig = { instanceKeys: ["base"], schemaVersion: 2 };
        const service = new DataONEService({
          baseUrl: "https://example.org",
          storageConfig,
        });
        state.sandbox.stub(service, "getUserName").resolves("alice");

        await service.getStore();
        const options = PersistentStorage.get.firstCall.args[0];
        options.instanceKeys.should.deep.equal([
          "base",
          `auth:${md5("alice")}`,
        ]);
        storageConfig.instanceKeys.should.deep.equal(["base"]);
      });

      it("allows cache when persistPrivate is true", async () => {
        const service = new DataONEService({
          baseUrl: "https://example.org",
          persistPrivate: true,
        });
        const getUserNameStub = state.sandbox
          .stub(service, "getUserName")
          .resolves("alice");

        const allowed = await service.shouldUseCache();
        allowed.should.equal(true);
        getUserNameStub.called.should.be.false;
      });

      it("disallows cache for logged-in users when private persistence is off", async () => {
        const service = new DataONEService({ baseUrl: "https://example.org" });
        state.sandbox.stub(service, "getUserName").resolves("alice");

        const allowed = await service.shouldUseCache();
        allowed.should.equal(false);
      });

      it("allows cache for anonymous users when private persistence is off", async () => {
        const service = new DataONEService({ baseUrl: "https://example.org" });
        state.sandbox.stub(service, "getUserName").resolves(null);

        const allowed = await service.shouldUseCache();
        allowed.should.equal(true);
      });
    });

    describe("token resolution", () => {
      it("returns null when auth is false", async () => {
        const token = await state.service.resolveToken(false);
        expect(token).to.equal(null);
      });

      it("returns null when defaultAuth is false", async () => {
        const service = new DataONEService({
          baseUrl: "https://example.org",
          defaultAuth: false,
        });
        const token = await service.resolveToken();
        expect(token).to.equal(null);
      });

      it("delegates to getToken when needed", async () => {
        state.sandbox.stub(state.service, "getToken").resolves("tok");
        const token = await state.service.resolveToken();
        token.should.equal("tok");
      });

      it("uses the instance getToken override when provided", async () => {
        state.sandbox
          .stub(DataONEService.prototype, "getToken")
          .resolves("static");

        const service = new DataONEService({
          baseUrl: "https://example.org",
          getToken: async () => "instance",
          test: true,
        });

        const token = await service.resolveToken();
        token.should.equal("instance");
      });
    });

    describe("request", () => {
      it("requestWithClient passes resolved tokens to the provided client request", async () => {
        const client = makeClient(state.sandbox);
        state.sandbox.stub(state.service, "getToken").resolves("tok");

        await state.service.requestWithClient(client, {
          path: "/x",
          method: "POST",
        });

        client.request.firstCall.args[0].token.should.equal("tok");
        client.request.firstCall.args[0].path.should.equal("/x");
        client.request.firstCall.args[0].method.should.equal("POST");
      });

      it("requestWithClient requires a client instance", async () => {
        let caught = null;

        try {
          await state.service.requestWithClient(null, { path: "/x" });
        } catch (error) {
          caught = error;
        }

        expect(caught).to.be.instanceof(Error);
        expect(caught.message).to.match(/client is required/i);
      });

      it("passes resolved tokens to the client request", async () => {
        state.sandbox.stub(state.service, "getToken").resolves("tok");

        await state.service.request({ path: "/x" });
        state.client.request.firstCall.args[0].token.should.equal("tok");
        state.client.request.firstCall.args[0].path.should.equal("/x");
      });

      it("does not pass auth through to the http client options", async () => {
        state.sandbox.stub(state.service, "getToken").resolves("tok");

        await state.service.request({
          path: "/x",
          auth: false,
          method: "POST",
        });

        const options = state.client.request.firstCall.args[0];
        should.not.exist(options.auth);
        options.method.should.equal("POST");
      });
    });

    describe("download/upload", () => {
      it("returns cached values when available", async () => {
        state.sandbox.stub(state.service, "getCached").resolves("cached");
        const reqStub = state.sandbox.stub(state.service, "request");

        const result = await state.service.download("/cached");
        result.should.equal("cached");
        reqStub.called.should.be.false;
      });

      it("returns cached false values without requesting", async () => {
        state.sandbox.stub(state.service, "getCached").resolves(false);
        const reqStub = state.sandbox.stub(state.service, "request");

        const result = await state.service.download("/cached");
        result.should.equal(false);
        reqStub.called.should.be.false;
      });

      it("skips cache when useCache is false", async () => {
        const getCachedStub = state.sandbox
          .stub(state.service, "getCached")
          .resolves(null);
        const setCachedStub = state.sandbox
          .stub(state.service, "setCached")
          .resolves();
        const reqStub = state.sandbox
          .stub(state.service, "request")
          .resolves({ data: "fresh" });

        const result = await state.service.download("/nocache", {
          useCache: false,
        });
        result.should.equal("fresh");
        getCachedStub.called.should.be.false;
        setCachedStub.called.should.be.false;
        reqStub.calledOnce.should.be.true;
      });

      it("requests and caches downloads", async () => {
        state.sandbox.stub(state.service, "getCached").resolves(null);
        const setCachedStub = state.sandbox
          .stub(state.service, "setCached")
          .resolves();
        const reqStub = state.sandbox
          .stub(state.service, "request")
          .resolves({ data: "fresh" });

        const result = await state.service.download("/fresh", {
          cacheKey: "k",
          cacheTtlMs: 50,
        });

        result.should.equal("fresh");
        reqStub.firstCall.args[0].method.should.equal("GET");
        setCachedStub.calledOnceWith("k", "fresh", { ttlMs: 50 }).should.be
          .true;
      });

      it("preserves explicit download methods", async () => {
        state.sandbox.stub(state.service, "getCached").resolves(null);
        const reqStub = state.sandbox
          .stub(state.service, "request")
          .resolves({ data: "fresh" });

        await state.service.download("/fresh", { method: "POST" });
        reqStub.firstCall.args[0].method.should.equal("POST");
      });

      it("uploads with PUT by default and updates cache", async () => {
        const reqStub = state.sandbox
          .stub(state.service, "request")
          .resolves({ data: "ok" });
        const setCachedStub = state.sandbox
          .stub(state.service, "setCached")
          .resolves();

        await state.service.upload("/upload", { body: "payload" });

        reqStub.firstCall.args[0].method.should.equal("PUT");
        setCachedStub.calledOnceWith("/upload", "payload").should.be.true;
      });

      it("preserves explicit upload methods", async () => {
        const reqStub = state.sandbox
          .stub(state.service, "request")
          .resolves({ data: "ok" });

        await state.service.upload("/upload", {
          body: "payload",
          method: "PATCH",
          useCache: false,
        });
        reqStub.firstCall.args[0].method.should.equal("PATCH");
      });

      it("skips upload cache writes when disabled", async () => {
        state.sandbox.stub(state.service, "request").resolves({ data: "ok" });
        const setCachedStub = state.sandbox
          .stub(state.service, "setCached")
          .resolves();

        await state.service.upload("/upload", {
          body: "payload",
          useCache: false,
        });
        setCachedStub.called.should.be.false;
      });

      it("throws errors that arise during fetch", async () => {
        const fetchStub = state.sandbox
          .stub(window, "fetch")
          .rejects(new Error("fail"));

        try {
          await state.service.download("/fail", {
            auth: false,
            useCache: false,
            retry: { maxAttempts: 0 },
          });
        } catch (err) {
          err.message.should.equal("fail");
        }
      });
    });

    describe("cache helpers", () => {
      it("getCached returns null for falsy keys", async () => {
        const shouldUseCacheStub = state.sandbox
          .stub(state.service, "shouldUseCache")
          .resolves(true);

        const result = await state.service.getCached("");
        expect(result).to.equal(null);
        shouldUseCacheStub.called.should.be.false;
      });

      it("getCached returns null when caching is disallowed", async () => {
        state.sandbox.stub(state.service, "shouldUseCache").resolves(false);
        const getStoreStub = state.sandbox.stub(state.service, "getStore");

        const result = await state.service.getCached("/x");
        expect(result).to.equal(null);
        getStoreStub.called.should.be.false;
      });

      it("getCached reads from the store when allowed", async () => {
        const store = makeStore(state.sandbox, "cached");
        state.sandbox.stub(state.service, "shouldUseCache").resolves(true);
        state.sandbox.stub(state.service, "getStore").returns(store);

        const result = await state.service.getCached("/x");
        result.should.equal("cached");
      });

      it("setCached returns early for falsy keys", async () => {
        const shouldUseCacheStub = state.sandbox
          .stub(state.service, "shouldUseCache")
          .resolves(true);

        const result = await state.service.setCached("", "value");
        result.should.equal("value");
        shouldUseCacheStub.called.should.be.false;
      });

      it("setCached returns early when caching is disallowed", async () => {
        state.sandbox.stub(state.service, "shouldUseCache").resolves(false);
        const getStoreStub = state.sandbox.stub(state.service, "getStore");

        const result = await state.service.setCached("/x", "value");
        result.should.equal("value");
        getStoreStub.called.should.be.false;
      });

      it("setCached writes to the store when allowed", async () => {
        const store = makeStore(state.sandbox, null);
        state.sandbox.stub(state.service, "shouldUseCache").resolves(true);
        state.sandbox.stub(state.service, "getStore").returns(store);

        const result = await state.service.setCached("/x", "value", {
          ttlMs: 10,
        });
        result.should.equal("value");
        store.setItem.calledOnceWith("/x", "value", { ttlMs: 10 }).should.be
          .true;
      });

      it("isCached reflects cached status", async () => {
        state.sandbox.stub(state.service, "getCached").resolves("cached");
        const cached = await state.service.isCached("/x");
        cached.should.equal(true);
      });

      it("isCached returns false for missing values", async () => {
        state.sandbox.stub(state.service, "getCached").resolves(null);
        const cached = await state.service.isCached("/x");
        cached.should.equal(false);
      });

      it("removeCached and clearCache proxy to store", async () => {
        const store = makeStore(state.sandbox, null);
        state.sandbox.stub(state.service, "getStore").returns(store);

        await state.service.removeCached("/x");
        await state.service.clearCache();

        store.removeItem.calledOnceWith("/x").should.be.true;
        store.clear.calledOnce.should.be.true;
      });

      it("removeCached returns early for falsy keys", async () => {
        const getStoreStub = state.sandbox.stub(state.service, "getStore");
        await state.service.removeCached("");
        getStoreStub.called.should.be.false;
      });

      it("resolveCacheKey prefers explicit cache keys", () => {
        DataONEService.resolveCacheKey("/x", "override").should.equal(
          "override",
        );
        DataONEService.resolveCacheKey("/x", null).should.equal("/x");
      });

      it("resolveCacheKey falls back to path when cacheKey is undefined", () => {
        DataONEService.resolveCacheKey("/x").should.equal("/x");
      });
    });
  });
});
