define([
  "/test/js/specs/shared/clean-state.js",
  "models/dataONEServices/UrlBuilder",
  "models/dataONEServices/DataONEHttpClient",
  "models/dataONEServices/DataONEHttpError",
], (cleanState, UrlBuilder, DataONEHttpClient, DataONEHttpError) => {
  const should = chai.should();
  const expect = chai.expect;

  // Helper to build a Response object
  const buildResponse = (
    body,
    { status = 200, headers, url = "https://example.org/object/1" } = {},
  ) => {
    const response = new Response(body, { status, headers });
    Object.defineProperty(response, "url", { value: url });
    return response;
  };

  // Creates a deferred promise with exposed resolve and reject functions
  const createDeferred = () => {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };

  const expectNoDedupe = async (client, fetchStub, first, second) => {
    const d1 = createDeferred();
    const d2 = createDeferred();
    fetchStub.onCall(0).returns(d1.promise);
    fetchStub.onCall(1).returns(d2.promise);

    const p1 = client.request(first);
    const p2 = client.request(second);

    expect(p1).to.not.equal(p2);
    expect(fetchStub.callCount).to.equal(2);

    d1.resolve(buildResponse("one"));
    d2.resolve(buildResponse("two"));

    const [r1, r2] = await Promise.all([p1, p2]);
    return { r1, r2 };
  };

  const createFakeXhrClass = (behaviors = []) => {
    const queue = [...behaviors];

    class FakeXMLHttpRequest {
      constructor() {
        this.method = null;
        this.url = null;
        this.headers = {};
        this.responseType = "";
        this.response = null;
        this._responseText = "";
        this.status = 0;
        this.timeout = 0;
        this.responseURL = "";
        this.responseHeadersRaw = "";
        this.uploadProgressListener = null;
        Object.defineProperty(this, "responseText", {
          configurable: true,
          enumerable: true,
          get: () => {
            if (this.responseType && this.responseType !== "text") {
              throw new Error("InvalidStateError");
            }
            return this._responseText;
          },
          set: (value) => {
            this._responseText = value;
          },
        });
        this.upload = {
          addEventListener: (type, handler) => {
            if (type === "progress") {
              this.uploadProgressListener = handler;
            }
          },
          removeEventListener: (type, handler) => {
            if (
              type === "progress" &&
              this.uploadProgressListener === handler
            ) {
              this.uploadProgressListener = null;
            }
          },
        };
        FakeXMLHttpRequest.instances.push(this);
      }

      open(method, url) {
        this.method = method;
        this.url = url;
      }

      setRequestHeader(key, value) {
        this.headers[key] = value;
      }

      getAllResponseHeaders() {
        return this.responseHeadersRaw;
      }

      abort() {
        if (typeof this.onabort === "function") {
          this.onabort();
        }
      }

      send(body) {
        this.body = body;
        const behavior = queue.length
          ? queue.shift()
          : { type: "load", status: 200, body: "ok" };

        if (this.uploadProgressListener && behavior.progressEvent) {
          this.uploadProgressListener(behavior.progressEvent);
        }

        this.responseHeadersRaw = behavior.headersRaw || "";
        this.responseURL = behavior.url || this.url;

        if (behavior.type === "error") {
          if (typeof this.onerror === "function") this.onerror();
          return;
        }
        if (behavior.type === "timeout") {
          if (typeof this.ontimeout === "function") this.ontimeout();
          return;
        }
        if (behavior.type === "abort") {
          if (typeof this.onabort === "function") this.onabort();
          return;
        }
        if (behavior.type === "hold") {
          return;
        }

        this.status = behavior.status === undefined ? 200 : behavior.status;
        if (this.responseType && this.responseType !== "text") {
          this.response = behavior.body;
        } else {
          this.responseText =
            typeof behavior.body === "string"
              ? behavior.body
              : behavior.body === undefined || behavior.body === null
                ? ""
                : String(behavior.body);
        }

        if (typeof this.onload === "function") this.onload();
      }
    }

    FakeXMLHttpRequest.instances = [];
    return FakeXMLHttpRequest;
  };

  describe("DataONEHttpClient", () => {
    const state = cleanState(() => {
      const sandbox = sinon.createSandbox();
      const client = new DataONEHttpClient({
        baseUrl: "https://example.org",
      });
      return { sandbox, client };
    }, beforeEach);

    afterEach(() => {
      state.sandbox.restore();
      DataONEHttpClient.instances = new Map();
    });

    describe("singleton helpers", () => {
      it("normalizes baseUrl when building instance keys", () => {
        const a = DataONEHttpClient.buildInstanceKey({
          baseUrl: "https://example.org/",
        });
        const b = DataONEHttpClient.buildInstanceKey({
          baseUrl: "https://example.org",
        });
        a.should.equal(b);
      });

      it("throws when dedupe is not a boolean", () => {
        expect(() =>
          DataONEHttpClient.buildInstanceKey({
            baseUrl: "https://example.org",
            dedupe: "yes",
          }),
        ).to.throw(/dedupe must be a boolean/i);
      });

      it("throws when timeoutMs is invalid in client options", () => {
        expect(() =>
          DataONEHttpClient.buildInstanceKey({
            baseUrl: "https://example.org",
            timeoutMs: -1,
          }),
        ).to.throw(/non-negative number or null/i);
      });

      it("includes retry randomFn in instance keys", () => {
        const a = DataONEHttpClient.buildInstanceKey({
          baseUrl: "https://example.org",
          retry: { randomFn: () => 0.1 },
        });
        const b = DataONEHttpClient.buildInstanceKey({
          baseUrl: "https://example.org",
          retry: { randomFn: () => 0.9 },
        });
        a.should.not.equal(b);
      });

      it("preserves retry randomFn in normalized request retry policy", () => {
        const randomFn = () => 1;
        const client = new DataONEHttpClient({
          baseUrl: "https://example.org",
          retry: {
            baseDelayMs: 100,
            maxDelayMs: 1000,
            randomFn,
          },
        });
        const { retryPolicy } = client.normalizeRequestOptions({
          path: "/object/1",
        });

        retryPolicy.randomFn.should.equal(randomFn);
        retryPolicy.computeDelay({ attempt: 1 }).should.equal(120);
      });

      it("returns singletons per instance key", () => {
        DataONEHttpClient.instances = new Map();
        const a = DataONEHttpClient.get({ baseUrl: "https://example.org" });
        const b = DataONEHttpClient.get({ baseUrl: "https://example.org/" });
        const c = DataONEHttpClient.get({
          baseUrl: "https://example.org",
          dedupe: false,
        });

        a.should.equal(b);
        a.should.not.equal(c);
        DataONEHttpClient.instances.size.should.equal(2);
      });
    });

    describe("request options", () => {
      it("builds request URLs from baseUrl and path", async () => {
        const fetchStub = state.sandbox
          .stub(window, "fetch")
          .resolves(buildResponse("ok"));

        const path = "/object/pid:abc%2F123";
        const expected = UrlBuilder.buildUrl("https://example.org", path, true);

        await state.client.request({ path });

        fetchStub.calledOnce.should.be.true;
        fetchStub.firstCall.args[0].should.equal(expected);
      });

      it("merges headers and injects bearer tokens when missing", async () => {
        const client = new DataONEHttpClient({
          baseUrl: "https://example.org",
          defaultHeaders: {
            "X-Default": "1",
            "X-Override": "default",
          },
        });

        const fetchStub = state.sandbox
          .stub(window, "fetch")
          .resolves(buildResponse("ok"));

        await client.request({
          path: "/object/4",
          method: "post",
          headers: { "X-Override": "request" },
          token: "abc123",
        });

        fetchStub.calledOnce.should.be.true;
        const [, opts] = fetchStub.firstCall.args;
        opts.method.should.equal("POST");
        opts.headers.should.include({ "X-Default": "1" });
        opts.headers.should.include({ "X-Override": "request" });
        opts.headers.Authorization.should.equal("Bearer abc123");
      });

      it("overrides default headers case-insensitively", async () => {
        const client = new DataONEHttpClient({
          baseUrl: "https://example.org",
          defaultHeaders: {
            authorization: "Bearer default",
            Accept: "application/json",
          },
        });
        const fetchStub = state.sandbox
          .stub(window, "fetch")
          .resolves(buildResponse("ok"));

        await client.request({
          path: "/object/4",
          headers: { Authorization: "Bearer request" },
        });

        fetchStub.calledOnce.should.be.true;
        const [, opts] = fetchStub.firstCall.args;
        opts.headers.Authorization.should.equal("Bearer request");
        should.not.exist(opts.headers.authorization);
        opts.headers.Accept.should.equal("application/json");
      });

      it("does not inject tokens when Authorization is already set", async () => {
        const fetchStub = state.sandbox
          .stub(window, "fetch")
          .resolves(buildResponse("ok"));

        await state.client.request({
          path: "/object/1",
          headers: { authorization: "Bearer existing" },
          token: "abc123",
        });

        fetchStub.calledOnce.should.be.true;
        const [, opts] = fetchStub.firstCall.args;
        opts.headers.authorization.should.equal("Bearer existing");
        should.not.exist(opts.headers.Authorization);
      });

      it("normalizes method and responseType values", async () => {
        const fetchStub = state.sandbox
          .stub(window, "fetch")
          .resolves(buildResponse(JSON.stringify({ ok: true })));

        const res = await state.client.request({
          path: "/object/1",
          method: "post",
          responseType: "JSON",
        });

        const [, opts] = fetchStub.firstCall.args;
        opts.method.should.equal("POST");
        expect(res.data).to.deep.equal({ ok: true });
      });

      it("uses client timeout unless a request timeout override is set", () => {
        const client = new DataONEHttpClient({
          baseUrl: "https://example.org",
          timeoutMs: 25,
        });

        client.normalizeRequestOptions({ path: "/object/1" }).timeoutMs.should
          .equal(25);
        client.normalizeRequestOptions({ path: "/object/1", timeoutMs: null })
          .timeoutMs.should.equal(25);
        client.normalizeRequestOptions({ path: "/object/1", timeoutMs: 0 })
          .timeoutMs.should.equal(0);
      });

      it("normalizes transport and dedupe request options", () => {
        const normalized = state.client.normalizeRequestOptions({
          path: "/object/1",
          transport: "XHR",
          dedupe: false,
        });

        normalized.transport.should.equal("xhr");
        normalized.dedupe.should.equal(false);
      });

      it("treats non-object retry overrides as empty", () => {
        const client = new DataONEHttpClient({
          baseUrl: "https://example.org",
          retry: { maxRetries: 3 },
        });
        const normalized = client.normalizeRequestOptions({
          path: "/object/1",
          retry: "bad",
        });

        expect(normalized.retry).to.deep.equal({});
        normalized.retryPolicy.maxRetries.should.equal(3);
      });

      it("throws when path is missing", async () => {
        let caught;
        try {
          await state.client.request({ path: null });
        } catch (err) {
          caught = err;
        }

        expect(caught).to.be.instanceof(Error);
        expect(caught.message).to.match(/path/i);
      });

      it("throws when method is not allowed", async () => {
        let caught;
        try {
          await state.client.request({ path: "/object/1", method: "TRACE" });
        } catch (err) {
          caught = err;
        }

        expect(caught).to.be.instanceof(Error);
        expect(caught.message).to.match(/Invalid HTTP method/i);
      });

      it("throws when method is not a string", async () => {
        let caught;
        try {
          await state.client.request({ path: "/object/1", method: 42 });
        } catch (err) {
          caught = err;
        }

        expect(caught).to.be.instanceof(Error);
        expect(caught.message).to.match(/method must be provided/i);
      });

      it("throws when responseType is not allowed", async () => {
        let caught;
        try {
          await state.client.request({
            path: "/object/1",
            responseType: "document",
          });
        } catch (err) {
          caught = err;
        }

        expect(caught).to.be.instanceof(Error);
        expect(caught.message).to.match(/Invalid responseType/i);
      });

      it("throws when responseType is not a string", async () => {
        let caught;
        try {
          await state.client.request({
            path: "/object/1",
            responseType: 42,
          });
        } catch (err) {
          caught = err;
        }

        expect(caught).to.be.instanceof(Error);
        expect(caught.message).to.match(/responseType must be a string/i);
      });

      it("throws when request timeoutMs is invalid", async () => {
        let caught;
        try {
          await state.client.request({
            path: "/object/1",
            timeoutMs: -1,
          });
        } catch (err) {
          caught = err;
        }

        expect(caught).to.be.instanceof(Error);
        expect(caught.message).to.match(/non-negative number or null/i);
      });

      it("throws when request dedupe is not a boolean", async () => {
        let caught;
        try {
          await state.client.request({
            path: "/object/1",
            dedupe: "yes",
          });
        } catch (err) {
          caught = err;
        }

        expect(caught).to.be.instanceof(Error);
        expect(caught.message).to.match(/dedupe must be a boolean/i);
      });

      it("throws when transport is not supported", async () => {
        let caught;
        try {
          await state.client.request({
            path: "/object/1",
            transport: "iframe",
          });
        } catch (err) {
          caught = err;
        }

        expect(caught).to.be.instanceof(Error);
        expect(caught.message).to.match(/Invalid transport/i);
      });

      it("throws when onUploadProgress is not a function", async () => {
        let caught;
        try {
          await state.client.request({
            path: "/object/1",
            transport: "xhr",
            onUploadProgress: true,
          });
        } catch (err) {
          caught = err;
        }

        expect(caught).to.be.instanceof(Error);
        expect(caught.message).to.match(/onUploadProgress must be a function/i);
      });

      it("throws when onUploadProgress is used with non-xhr transport", async () => {
        let caught;
        try {
          await state.client.request({
            path: "/object/1",
            transport: "fetch",
            onUploadProgress: () => {},
          });
        } catch (err) {
          caught = err;
        }

        expect(caught).to.be.instanceof(Error);
        expect(caught.message).to.match(/onUploadProgress.*xhr/i);
      });

      it("throws when encodePath is true and path contains a query string", async () => {
        let caught;
        try {
          await state.client.request({
            path: "/object/1?format=json",
            encodePath: true,
          });
        } catch (err) {
          caught = err;
        }

        expect(caught).to.be.instanceof(Error);
        expect(caught.message).to.match(/query strings/i);
      });

      it("allows query strings when encodePath is false", async () => {
        const fetchStub = state.sandbox
          .stub(window, "fetch")
          .resolves(buildResponse("ok"));
        const path = "/object/1?format=json";
        const expected = UrlBuilder.buildUrl(
          "https://example.org",
          path,
          false,
        );

        await state.client.request({ path, encodePath: false });

        fetchStub.calledOnce.should.be.true;
        fetchStub.firstCall.args[0].should.equal(expected);
      });
    });

    describe("deduplication", () => {
      it("dedupes in-flight requests with identical keys", async () => {
        const deferred = createDeferred();
        const fetchStub = state.sandbox
          .stub(window, "fetch")
          .returns(deferred.promise);

        const p1 = state.client.request({
          path: "/object/5",
          headers: { Accept: "application/json" },
        });
        const p2 = state.client.request({
          path: "/object/5",
          headers: { accept: "application/json" },
        });

        // request() is async, so each call returns a new wrapper promise
        // even when it reuses the same in-flight job.
        expect(p1).to.not.equal(p2);
        fetchStub.callCount.should.equal(1);

        deferred.resolve(buildResponse("deduped"));
        const [r1, r2] = await Promise.all([p1, p2]);

        r1.data.should.equal("deduped");
        r2.data.should.equal("deduped");
      });

      it("does not dedupe when disabled", async () => {
        const client = new DataONEHttpClient({
          baseUrl: "https://example.org",
          dedupe: false,
        });
        const fetchStub = state.sandbox.stub(window, "fetch");

        await expectNoDedupe(
          client,
          fetchStub,
          { path: "/object/5" },
          { path: "/object/5" },
        );
      });

      it("does not dedupe when request-level dedupe is false", async () => {
        const fetchStub = state.sandbox.stub(window, "fetch");

        await expectNoDedupe(
          state.client,
          fetchStub,
          { path: "/object/5", dedupe: false },
          { path: "/object/5", dedupe: false },
        );
      });

      it("does not dedupe across different transports", async () => {
        const fetchStub = state.sandbox
          .stub(window, "fetch")
          .resolves(buildResponse("fetch"));
        const FakeXMLHttpRequest = createFakeXhrClass([
          { type: "load", status: 200, body: "xhr" },
        ]);
        state.sandbox
          .stub(globalThis, "XMLHttpRequest")
          .callsFake(() => new FakeXMLHttpRequest());

        const p1 = state.client.request({
          path: "/object/5",
          transport: "fetch",
        });
        const p2 = state.client.request({
          path: "/object/5",
          transport: "xhr",
        });

        const [r1, r2] = await Promise.all([p1, p2]);
        r1.data.should.equal("fetch");
        r2.data.should.equal("xhr");
        fetchStub.calledOnce.should.be.true;
        FakeXMLHttpRequest.instances.length.should.equal(1);
      });

      it("does not dedupe when headers differ", async () => {
        const fetchStub = state.sandbox.stub(window, "fetch");

        await expectNoDedupe(
          state.client,
          fetchStub,
          { path: "/object/6", headers: { Accept: "application/json" } },
          { path: "/object/6", headers: { Accept: "text/plain" } },
        );
      });

      it("does not dedupe when timeoutMs differs", async () => {
        const fetchStub = state.sandbox.stub(window, "fetch");

        await expectNoDedupe(
          state.client,
          fetchStub,
          { path: "/object/7", timeoutMs: 10 },
          { path: "/object/7", timeoutMs: 20 },
        );
      });

      it("does not dedupe when retry configs differ", async () => {
        const fetchStub = state.sandbox.stub(window, "fetch");

        await expectNoDedupe(
          state.client,
          fetchStub,
          { path: "/object/8", retry: { maxRetries: 1 } },
          { path: "/object/8", retry: { maxRetries: 2 } },
        );
      });

      it("does not dedupe when signals differ", async () => {
        const fetchStub = state.sandbox.stub(window, "fetch");
        const controllerA = new AbortController();
        const controllerB = new AbortController();

        await expectNoDedupe(
          state.client,
          fetchStub,
          { path: "/object/9", signal: controllerA.signal },
          { path: "/object/9", signal: controllerB.signal },
        );
      });

      it("does not dedupe between token and Authorization header", async () => {
        const fetchStub = state.sandbox.stub(window, "fetch");

        await expectNoDedupe(
          state.client,
          fetchStub,
          { path: "/object/10", token: "abc123" },
          {
            path: "/object/10",
            headers: { Authorization: "Bearer abc123" },
          },
        );
      });

      it("dedupes when non-key headers differ", async () => {
        const deferred = createDeferred();
        const fetchStub = state.sandbox
          .stub(window, "fetch")
          .returns(deferred.promise);

        const p1 = state.client.request({
          path: "/object/12",
          headers: { "X-Trace": "one" },
        });
        const p2 = state.client.request({
          path: "/object/12",
          headers: { "X-Trace": "two" },
        });

        fetchStub.callCount.should.equal(1);

        deferred.resolve(buildResponse("deduped"));
        const [r1, r2] = await Promise.all([p1, p2]);
        r1.data.should.equal("deduped");
        r2.data.should.equal("deduped");
      });

      it("dedupes when URLSearchParams bodies match", async () => {
        const deferred = createDeferred();
        const fetchStub = state.sandbox
          .stub(window, "fetch")
          .returns(deferred.promise);
        const bodyA = new URLSearchParams("a=1&b=2");
        const bodyB = new URLSearchParams("a=1&b=2");

        const p1 = state.client.request({
          path: "/object/13",
          method: "POST",
          body: bodyA,
        });
        const p2 = state.client.request({
          path: "/object/13",
          method: "POST",
          body: bodyB,
        });

        fetchStub.callCount.should.equal(1);

        deferred.resolve(buildResponse("ok"));
        const [r1, r2] = await Promise.all([p1, p2]);
        r1.data.should.equal("ok");
        r2.data.should.equal("ok");
      });

      it("dedupes when JSON bodies have different key order", async () => {
        const deferred = createDeferred();
        const fetchStub = state.sandbox
          .stub(window, "fetch")
          .returns(deferred.promise);
        const bodyA = { b: 2, a: 1 };
        const bodyB = { a: 1, b: 2 };

        const p1 = state.client.request({
          path: "/object/13",
          method: "POST",
          body: bodyA,
        });
        const p2 = state.client.request({
          path: "/object/13",
          method: "POST",
          body: bodyB,
        });

        fetchStub.callCount.should.equal(1);

        deferred.resolve(buildResponse("ok"));
        const [r1, r2] = await Promise.all([p1, p2]);
        r1.data.should.equal("ok");
        r2.data.should.equal("ok");
      });

      it("does not dedupe when body differs", async () => {
        const fetchStub = state.sandbox.stub(window, "fetch");

        await expectNoDedupe(
          state.client,
          fetchStub,
          { path: "/object/14", method: "POST", body: "one" },
          { path: "/object/14", method: "POST", body: "two" },
        );
      });

      it("does not dedupe when method differs", async () => {
        const fetchStub = state.sandbox.stub(window, "fetch");

        await expectNoDedupe(
          state.client,
          fetchStub,
          { path: "/object/15", method: "GET" },
          { path: "/object/15", method: "POST", body: "payload" },
        );
      });

      it("handles non-serializable header values in dedupe keys", async () => {
        const fetchStub = state.sandbox
          .stub(window, "fetch")
          .resolves(buildResponse("ok"));

        const circular = {};
        circular.self = circular;

        await state.client.request({
          path: "/object/11",
          headers: { Accept: circular },
        });

        fetchStub.calledOnce.should.be.true;
      });

      it("dedupes when non-serializable bodies share identity", async () => {
        const deferred = createDeferred();
        const fetchStub = state.sandbox
          .stub(window, "fetch")
          .returns(deferred.promise);

        const circular = {};
        circular.self = circular;

        const p1 = state.client.request({
          path: "/object/16",
          method: "POST",
          body: circular,
        });
        const p2 = state.client.request({
          path: "/object/16",
          method: "POST",
          body: circular,
        });

        fetchStub.callCount.should.equal(1);

        deferred.resolve(buildResponse("deduped"));
        const [r1, r2] = await Promise.all([p1, p2]);
        r1.data.should.equal("deduped");
        r2.data.should.equal("deduped");
      });
    });

    describe("retries and errors", () => {
      it("retries on retryable status codes and succeeds", async () => {
        const fetchStub = state.sandbox.stub(window, "fetch");
        fetchStub.onCall(0).resolves(
          buildResponse("fail", {
            status: 503,
            headers: { "Retry-After": "0" },
          }),
        );
        fetchStub.onCall(1).resolves(buildResponse("ok", { status: 200 }));

        const client = new DataONEHttpClient({
          baseUrl: "https://example.org",
          retry: { maxRetries: 1, baseDelayMs: 0, maxDelayMs: 0 },
        });

        const res = await client.request({ path: "/object/6" });
        res.ok.should.be.true;
        res.data.should.equal("ok");
        fetchStub.callCount.should.equal(2);
      });

      it("does not retry non-retryable status codes", async () => {
        const fetchStub = state.sandbox
          .stub(window, "fetch")
          .resolves(buildResponse("bad", { status: 400 }));

        const client = new DataONEHttpClient({
          baseUrl: "https://example.org",
          retry: { maxRetries: 2, baseDelayMs: 0, maxDelayMs: 0 },
        });

        let caught;
        try {
          await client.request({ path: "/object/7" });
        } catch (err) {
          caught = err;
        }

        expect(caught).to.be.instanceof(DataONEHttpError);
        expect(caught.status).to.equal(400);
        expect(caught.attempt).to.equal(1);
        expect(caught.bodyText).to.equal("bad");
        fetchStub.calledOnce.should.be.true;
      });

      it("retries on network errors when enabled", async () => {
        const fetchStub = state.sandbox.stub(window, "fetch");
        fetchStub.onCall(0).rejects(new TypeError("Network down"));
        fetchStub.onCall(1).resolves(buildResponse("ok", { status: 200 }));

        const client = new DataONEHttpClient({
          baseUrl: "https://example.org",
          retry: {
            maxRetries: 1,
            baseDelayMs: 0,
            maxDelayMs: 0,
            retryNetworkErrors: true,
          },
        });

        const res = await client.request({ path: "/object/8" });
        res.data.should.equal("ok");
        fetchStub.callCount.should.equal(2);
      });

      it("does not retry network errors when disabled", async () => {
        const fetchStub = state.sandbox
          .stub(window, "fetch")
          .rejects(new TypeError("Network down"));

        const client = new DataONEHttpClient({
          baseUrl: "https://example.org",
          retry: {
            maxRetries: 2,
            baseDelayMs: 0,
            maxDelayMs: 0,
            retryNetworkErrors: false,
          },
        });

        let caught;
        try {
          await client.request({ path: "/object/9" });
        } catch (err) {
          caught = err;
        }

        expect(caught).to.be.instanceof(DataONEHttpError);
        expect(caught.networkError).to.equal(true);
        fetchStub.calledOnce.should.be.true;
      });

      it("tracks attempt count across retries", async () => {
        const fetchStub = state.sandbox.stub(window, "fetch");
        fetchStub.onCall(0).resolves(buildResponse("fail", { status: 503 }));
        fetchStub.onCall(1).resolves(buildResponse("fail", { status: 503 }));

        const client = new DataONEHttpClient({
          baseUrl: "https://example.org",
          retry: { maxRetries: 1, baseDelayMs: 0, maxDelayMs: 0 },
        });

        let caught;
        try {
          await client.request({ path: "/object/10" });
        } catch (err) {
          caught = err;
        }

        expect(caught).to.be.instanceof(DataONEHttpError);
        expect(caught.status).to.equal(503);
        expect(caught.attempt).to.equal(2);
        fetchStub.callCount.should.equal(2);
      });
    });

    describe("timeouts and aborts", () => {
      it("retries on timeouts when network retries are enabled", async () => {
        const clock = state.sandbox.useFakeTimers();
        const fetchStub = state.sandbox.stub(window, "fetch");

        fetchStub.onCall(0).callsFake(
          (_url, opts) =>
            new Promise((resolve, reject) => {
              opts.signal.addEventListener(
                "abort",
                () => {
                  const err = new Error("Aborted");
                  err.name = "AbortError";
                  reject(err);
                },
                { once: true },
              );
            }),
        );
        fetchStub.onCall(1).resolves(buildResponse("ok", { status: 200 }));

        const client = new DataONEHttpClient({
          baseUrl: "https://example.org",
          retry: {
            maxRetries: 1,
            baseDelayMs: 0,
            maxDelayMs: 0,
            retryNetworkErrors: true,
          },
        });

        const promise = client.request({
          path: "/object/timeout",
          timeoutMs: 5,
        });

        await clock.tickAsync(5);
        const res = await promise;
        res.data.should.equal("ok");
        fetchStub.callCount.should.equal(2);
        clock.restore();
      });

      it("aborts during backoff delays", async () => {
        const clock = state.sandbox.useFakeTimers();
        const fetchStub = state.sandbox
          .stub(window, "fetch")
          .resolves(buildResponse("fail", { status: 503 }));
        const controller = new AbortController();

        const client = new DataONEHttpClient({
          baseUrl: "https://example.org",
          retry: {
            maxRetries: 2,
            baseDelayMs: 50,
            maxDelayMs: 50,
            randomFn: () => 0.5,
          },
        });

        const promise = client.request({
          path: "/object/abort",
          signal: controller.signal,
        });

        await clock.tickAsync(0);
        controller.abort("stop");

        let caught;
        try {
          await promise;
        } catch (err) {
          caught = err;
        }

        expect(caught).to.be.instanceof(Error);
        expect(caught.name).to.equal("AbortError");
        fetchStub.calledOnce.should.be.true;
        clock.restore();
      });

      it("propagates AbortError when caller aborts an in-flight request", async () => {
        const fetchStub = state.sandbox.stub(window, "fetch");
        fetchStub.callsFake(
          (_url, opts = {}) =>
            new Promise((resolve, reject) => {
              const { signal } = opts;
              const onAbort = () =>
                reject(
                  Object.assign(new Error("Aborted"), { name: "AbortError" }),
                );
              if (signal?.aborted) return onAbort();
              signal?.addEventListener("abort", onAbort, { once: true });
            }),
        );
        const controller = new AbortController();
        const requestPromise = state.client.request({
          path: "/object/abort",
          signal: controller.signal,
        });

        controller.abort("stop");

        let caught;
        try {
          await requestPromise;
        } catch (err) {
          caught = err;
        }

        expect(caught).to.be.instanceof(Error);
        expect(caught.name).to.equal("AbortError");
        expect(caught).to.not.be.instanceof(DataONEHttpError);
        fetchStub.calledOnce.should.be.true;
      });

      it("times out requests that exceed the timeoutMs", async () => {
        const clock = state.sandbox.useFakeTimers();
        const fetchStub = state.sandbox.stub(window, "fetch");

        // The fake fetch must be aware of the abort signal to reject when
        // aborted by the timeout
        fetchStub.callsFake(
          (_url, opts = {}) =>
            new Promise((resolve, reject) => {
              const { signal } = opts;
              const onAbort = () =>
                reject(
                  Object.assign(new Error("Aborted"), { name: "AbortError" }),
                );
              if (signal?.aborted) return onAbort();
              signal?.addEventListener("abort", onAbort, { once: true });

              setTimeout(() => {
                signal?.removeEventListener("abort", onAbort);
                resolve(buildResponse("late"));
              }, 100);
            }),
        );
        const noRetryClient = new DataONEHttpClient({
          baseUrl: "https://example.org",
          retry: { maxRetries: 0 },
        });

        const requestPromise = noRetryClient.request({
          path: "/object/timeout",
          timeoutMs: 10,
        });

        await clock.tickAsync(11); // triggers the abort timeout
        let caught;
        try {
          await requestPromise;
        } catch (err) {
          caught = err;
        }

        expect(caught).to.be.instanceof(DataONEHttpError);
        fetchStub.calledOnce.should.be.true;
        clock.restore();
      });
    });

    describe("xhr transport", () => {
      it("parses xhr text responses", async () => {
        const FakeXMLHttpRequest = createFakeXhrClass([
          { type: "load", status: 200, body: "hello from xhr" },
        ]);
        state.sandbox
          .stub(globalThis, "XMLHttpRequest")
          .callsFake(() => new FakeXMLHttpRequest());

        const response = await state.client.request({
          path: "/object/xhr-text",
          transport: "xhr",
          responseType: "text",
        });

        response.data.should.equal("hello from xhr");
      });

      it("parses xhr JSON and falls back to text on parse failure", async () => {
        const FakeXMLHttpRequest = createFakeXhrClass([
          {
            type: "load",
            status: 200,
            body: JSON.stringify({ hello: "world" }),
          },
          {
            type: "load",
            status: 200,
            body: "not-json",
          },
        ]);
        state.sandbox
          .stub(globalThis, "XMLHttpRequest")
          .callsFake(() => new FakeXMLHttpRequest());

        const parsed = await state.client.request({
          path: "/object/xhr-json",
          transport: "xhr",
          responseType: "json",
        });
        const fallback = await state.client.request({
          path: "/object/xhr-json-invalid",
          transport: "xhr",
          responseType: "json",
        });

        expect(parsed.data).to.deep.equal({ hello: "world" });
        fallback.data.should.equal("not-json");
      });

      it("parses xhr arrayBuffer and blob responses", async () => {
        const buffer = new Uint8Array([1, 2, 3]).buffer;
        const blob = new Blob(["hello"], { type: "text/plain" });
        const FakeXMLHttpRequest = createFakeXhrClass([
          { type: "load", status: 200, body: buffer },
          { type: "load", status: 200, body: blob },
        ]);
        state.sandbox
          .stub(globalThis, "XMLHttpRequest")
          .callsFake(() => new FakeXMLHttpRequest());

        const arrayBufferResponse = await state.client.request({
          path: "/object/xhr-array",
          transport: "xhr",
          responseType: "arrayBuffer",
        });
        const blobResponse = await state.client.request({
          path: "/object/xhr-blob",
          transport: "xhr",
          responseType: "blob",
        });

        arrayBufferResponse.data.should.be.instanceof(ArrayBuffer);
        arrayBufferResponse.data.byteLength.should.equal(3);
        blobResponse.data.should.be.instanceof(Blob);
        blobResponse.data.size.should.equal(5);
      });

      it("parses xhr document responses", async () => {
        const documentResponse = { nodeType: 9, title: "fake-doc" };
        const FakeXMLHttpRequest = createFakeXhrClass([
          { type: "load", status: 200, body: documentResponse },
        ]);
        state.sandbox
          .stub(globalThis, "XMLHttpRequest")
          .callsFake(() => new FakeXMLHttpRequest());

        const response = await state.client.request({
          path: "/object/xhr-document",
          transport: "xhr",
          responseType: "document",
        });

        response.data.should.equal(documentResponse);
      });

      it("emits xhr upload progress callbacks", async () => {
        const progressSpy = state.sandbox.spy();
        const FakeXMLHttpRequest = createFakeXhrClass([
          {
            type: "load",
            status: 200,
            body: "ok",
            progressEvent: {
              lengthComputable: true,
              loaded: 3,
              total: 10,
            },
          },
        ]);
        state.sandbox
          .stub(globalThis, "XMLHttpRequest")
          .callsFake(() => new FakeXMLHttpRequest());

        await state.client.request({
          path: "/object/xhr-progress",
          method: "POST",
          transport: "xhr",
          body: new FormData(),
          onUploadProgress: progressSpy,
        });

        progressSpy.calledOnce.should.be.true;
      });

      it("propagates AbortError when caller aborts an xhr request", async () => {
        const controller = new AbortController();
        const FakeXMLHttpRequest = createFakeXhrClass([
          { type: "hold" },
        ]);
        state.sandbox
          .stub(globalThis, "XMLHttpRequest")
          .callsFake(() => new FakeXMLHttpRequest());

        const requestPromise = state.client.request({
          path: "/object/xhr-abort",
          transport: "xhr",
          signal: controller.signal,
        });
        controller.abort("stop");

        let caught;
        try {
          await requestPromise;
        } catch (err) {
          caught = err;
        }

        expect(caught).to.be.instanceof(Error);
        expect(caught.name).to.equal("AbortError");
      });

      it("retries xhr timeouts when retry policy allows", async () => {
        const FakeXMLHttpRequest = createFakeXhrClass([
          { type: "timeout" },
          { type: "load", status: 200, body: "ok" },
        ]);
        state.sandbox
          .stub(globalThis, "XMLHttpRequest")
          .callsFake(() => new FakeXMLHttpRequest());

        const client = new DataONEHttpClient({
          baseUrl: "https://example.org",
          retry: {
            maxRetries: 1,
            baseDelayMs: 0,
            maxDelayMs: 0,
            randomFn: () => 0.5,
          },
        });

        const result = await client.request({
          path: "/object/xhr-timeout",
          transport: "xhr",
          timeoutMs: 1,
        });

        result.data.should.equal("ok");
        FakeXMLHttpRequest.instances.length.should.equal(2);
      });
    });

    describe("body parsing", () => {
      it("parses arrayBuffer responses", async () => {
        const buffer = new Uint8Array([1, 2, 3]).buffer;
        const fetchStub = state.sandbox
          .stub(window, "fetch")
          .resolves(buildResponse(buffer));

        const res = await state.client.request({
          path: "/object/arraybuffer",
          responseType: "arrayBuffer",
        });

        fetchStub.calledOnce.should.be.true;
        res.data.should.be.instanceof(ArrayBuffer);
        res.data.byteLength.should.equal(3);
      });

      it("parses blob responses", async () => {
        const blob = new Blob(["hello"], { type: "text/plain" });
        const fetchStub = state.sandbox
          .stub(window, "fetch")
          .resolves(buildResponse(blob));

        const res = await state.client.request({
          path: "/object/blob",
          responseType: "blob",
        });

        fetchStub.calledOnce.should.be.true;
        res.data.should.be.instanceof(Blob);
        res.data.size.should.equal(5);
        res.data.type.should.equal("text/plain");
      });

      it("parses text responses", async () => {
        const fetchStub = state.sandbox
          .stub(window, "fetch")
          .resolves(buildResponse("just some text"));
        const res = await state.client.request({
          path: "/object/text",
          responseType: "text",
        });

        fetchStub.calledOnce.should.be.true;
        res.data.should.equal("just some text");
      });

      it("parses JSON responses", async () => {
        const fetchStub = state.sandbox
          .stub(window, "fetch")
          .resolves(buildResponse(JSON.stringify({ hello: "world" })));

        const res = await state.client.request({
          path: "/object/json",
          responseType: "json",
        });

        fetchStub.calledOnce.should.be.true;
        expect(res.data).to.deep.equal({ hello: "world" });
      });

      it("falls back to text when JSON parsing fails", async () => {
        const fetchStub = state.sandbox
          .stub(window, "fetch")
          .resolves(buildResponse("not-json"));

        const res = await state.client.request({
          path: "/object/invalid-json",
          responseType: "json",
        });

        fetchStub.calledOnce.should.be.true;
        res.data.should.equal("not-json");
      });
    });
  });
});
