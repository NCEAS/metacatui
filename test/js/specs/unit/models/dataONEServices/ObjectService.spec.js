define([
  "/test/js/specs/shared/clean-state.js",
  "models/dataONEServices/ObjectService",
  "models/dataONEServices/ObjectLocationResolver",
], (cleanState, ObjectService) => {
  const should = chai.should();
  const expect = chai.expect;
  const IDENTIFIER_XML = "<identifier>urn:uuid:generated.1</identifier>";
  const ERROR_XML = `
    <error detailCode="1040" errorCode="401" name="NotAuthorized">
      <description> READ not allowed </description>
    </error>
  `;

  const makeResponse = (
    body,
    { status = 200, url = "https://example.org/object/pid.1" } = {},
  ) => {
    const response = new Response(body, { status });
    Object.defineProperty(response, "url", { value: url });
    return response;
  };

  describe("ObjectService", () => {
    const state = cleanState(() => {
      const sandbox = sinon.createSandbox();
      const originalMetacatUI = globalThis.MetacatUI;
      return { sandbox, originalMetacatUI };
    }, beforeEach);

    afterEach(() => {
      state.sandbox.restore();
      if (globalThis.fetch && globalThis.fetch.restore) {
        globalThis.fetch.restore();
      }
      if (globalThis.XMLHttpRequest && globalThis.XMLHttpRequest.restore) {
        globalThis.XMLHttpRequest.restore();
      }
      globalThis.MetacatUI = state.originalMetacatUI;
    });

    describe("construction", () => {
      it("requires an explicit read URL even when app endpoints exist", () => {
        globalThis.MetacatUI = {
          appModel: {
            get() {
              return "https://app.example.org/object";
            },
          },
        };

        expect(() => new ObjectService()).to.throw(
          "ObjectService: readBaseUrl is required",
        );
      });

      it("uses explicit read and write base URLs", () => {
        const service = new ObjectService({
          readBaseUrl: "https://example.org/object/read/",
          writeBaseUrl: "https://example.org/object/write/",
        });

        service.client.baseUrl.should.equal("https://example.org/object/read");
        service.readBaseUrl.should.equal("https://example.org/object/read");
        service.writeBaseUrl.should.equal("https://example.org/object/write");
      });

      it("disables retries on the write client because create/update are non-idempotent", () => {
        const service = new ObjectService({
          readBaseUrl: "https://example.org/object/read/",
          writeBaseUrl: "https://example.org/object/write/",
        });

        service.writeClientConfig.retry.should.deep.equal({
          maxRetries: 0,
          retryOn: [],
          retryNetworkErrors: false,
        });

        const writeClient = service.getWriteClient("create");
        writeClient.retryPolicy.maxRetries.should.equal(0);
        writeClient.retryPolicy.maxAttempts.should.equal(1);
        writeClient.retryPolicy.retryOn.should.deep.equal([]);
        writeClient.retryPolicy.retryNetworkErrors.should.equal(false);

        // Reads stay retryable: GET is idempotent.
        service.client.retryPolicy.maxRetries.should.be.above(0);
      });

      it("builds the full request URL from the selected read service", () => {
        const service = new ObjectService({
          readBaseUrl: "https://mn.example.org/object",
        });

        service
          .getReadUrl("doi:10.5063/example+data")
          .should.equal(
            "https://mn.example.org/object/doi:10.5063%2Fexample%2Bdata",
          );
      });
    });

    describe("fetch/download", () => {
      it("uses a new MN request for an authenticated resolve read", async () => {
        const locationResolver = {
          locate: state.sandbox.stub().resolves({
            objectServiceUrls: ["https://mn.example.org/object"],
            isPublic: false,
          }),
        };
        const service = new ObjectService({
          readBaseUrl: "https://cn.example.org/resolve",
          resolveServiceUrl: "https://cn.example.org/resolve",
          locationResolver,
          getToken: async () => "token-1",
        });
        const fetchStub = state.sandbox
          .stub(globalThis, "fetch")
          .resolves(makeResponse(new Blob(["private"])));

        await service.fetch("private.1");

        sinon.assert.calledOnceWithExactly(
          locationResolver.locate,
          "private.1",
          {
            signal: undefined,
          },
        );
        fetchStub.firstCall.args[0].should.equal(
          "https://mn.example.org/object/private.1",
        );
        fetchStub.firstCall.args[1].headers.Authorization.should.equal(
          "Bearer token-1",
        );
      });

      it("rejects redirects for auth'ed resolver reads", async () => {
        const service = new ObjectService({
          readBaseUrl: "https://cn.example.org/resolve",
          resolveServiceUrl: "https://cn.example.org/resolve",
          locationResolver: {
            locate: state.sandbox.stub().resolves({
              objectServiceUrls: ["https://mn.example.org/object"],
              isPublic: false,
            }),
          },
          getToken: async () => "token-1",
        });
        const fetchStub = state.sandbox
          .stub(globalThis, "fetch")
          .resolves(makeResponse(new Blob(["private"])));

        await service.fetch("private.1");

        fetchStub.firstCall.args[1].redirect.should.equal("error");
      });

      it("tries a completed replica after an auth'ed 503", async () => {
        const service = new ObjectService({
          readBaseUrl: "https://cn.example.org/resolve",
          resolveServiceUrl: "https://cn.example.org/resolve",
          locationResolver: {
            locate: state.sandbox.stub().resolves({
              objectServiceUrls: [
                "https://auth.example.org/object",
                "https://replica.example.org/object",
              ],
              isPublic: false,
            }),
          },
          getToken: async () => "token-1",
        });
        const unavailable = Object.assign(new Error("unavailable"), {
          status: 503,
        });
        const authClient = {
          request: state.sandbox.stub().rejects(unavailable),
        };
        const replicaResponse = { status: 200, data: new Blob(["object"]) };
        const replicaClient = {
          request: state.sandbox.stub().resolves(replicaResponse),
        };
        state.sandbox
          .stub(service, "getReadClient")
          .callsFake((baseUrl) =>
            baseUrl.includes("auth.example.org") ? authClient : replicaClient,
          );

        const response = await service.fetch("private.1");

        response.should.equal(replicaResponse);
        sinon.assert.calledOnce(authClient.request);
        sinon.assert.calledOnce(replicaClient.request);
        authClient.request.firstCall.args[0].redirect.should.equal("error");
        replicaClient.request.firstCall.args[0].redirect.should.equal("error");
      });

      it("keeps auth false reads on the resolve service", async () => {
        const locationResolver = { locate: state.sandbox.stub() };
        const service = new ObjectService({
          readBaseUrl: "https://cn.example.org/resolve",
          resolveServiceUrl: "https://cn.example.org/resolve",
          locationResolver,
          getToken: async () => "token-1",
        });
        const fetchStub = state.sandbox
          .stub(globalThis, "fetch")
          .resolves(makeResponse(new Blob(["public"])));

        await service.fetch("public.1", { auth: false });

        sinon.assert.notCalled(locationResolver.locate);
        fetchStub.firstCall.args[0].should.equal(
          "https://cn.example.org/resolve/public.1",
        );
        expect(fetchStub.firstCall.args[1].headers.Authorization).to.equal(
          undefined,
        );
      });

      it("keeps missing token reads on the resolve service", async () => {
        const locationResolver = { locate: state.sandbox.stub() };
        const getToken = state.sandbox.stub().resolves(null);
        const service = new ObjectService({
          readBaseUrl: "https://cn.example.org/resolve",
          resolveServiceUrl: "https://cn.example.org/resolve",
          locationResolver,
          getToken,
        });
        const fetchStub = state.sandbox
          .stub(globalThis, "fetch")
          .resolves(makeResponse(new Blob(["public"])));

        await service.fetch("public.1");

        sinon.assert.calledOnce(getToken);
        sinon.assert.notCalled(locationResolver.locate);
        fetchStub.firstCall.args[0].should.equal(
          "https://cn.example.org/resolve/public.1",
        );
        expect(fetchStub.firstCall.args[1].headers.Authorization).to.equal(
          undefined,
        );
      });

      it("does not locate reads whose base is already an MN object service", async () => {
        const locationResolver = { locate: state.sandbox.stub() };
        const service = new ObjectService({
          readBaseUrl: "https://mn.example.org/object",
          resolveServiceUrl: "https://cn.example.org/resolve",
          locationResolver,
          getToken: async () => "token-1",
        });
        const fetchStub = state.sandbox
          .stub(globalThis, "fetch")
          .resolves(makeResponse(new Blob(["private"])));

        await service.fetch("private.1");

        sinon.assert.notCalled(locationResolver.locate);
        fetchStub.firstCall.args[0].should.equal(
          "https://mn.example.org/object/private.1",
        );
      });

      it("uses anonymous resolve when a located object is explicitly public", async () => {
        const locationResolver = {
          locate: state.sandbox.stub().resolves({
            objectServiceUrls: [],
            isPublic: true,
          }),
        };
        const service = new ObjectService({
          readBaseUrl: "https://cn.example.org/resolve",
          resolveServiceUrl: "https://cn.example.org/resolve",
          locationResolver,
          getToken: async () => "token-1",
        });
        const fetchStub = state.sandbox
          .stub(globalThis, "fetch")
          .resolves(makeResponse(new Blob(["public"])));

        await service.fetch("public.1");

        fetchStub.firstCall.args[0].should.equal(
          "https://cn.example.org/resolve/public.1",
        );
        expect(fetchStub.firstCall.args[1].headers.Authorization).to.equal(
          undefined,
        );
      });

      [401, 403].forEach((status) => {
        it(`does not treat public fallback ${status} as authorization evidence`, async () => {
          const service = new ObjectService({
            readBaseUrl: "https://cn.example.org/resolve",
            resolveServiceUrl: "https://cn.example.org/resolve",
            locationResolver: {
              locate: state.sandbox.stub().resolves({
                objectServiceUrls: [],
                isPublic: true,
              }),
            },
            getToken: async () => "token-1",
          });
          state.sandbox.stub(globalThis, "fetch").resolves(
            makeResponse(new Blob(["denied"]), {
              status,
              url: "https://cn.example.org/resolve/public.1",
            }),
          );

          const error = await service.fetch("public.1").then(
            () => new Error("expected rejection"),
            (reason) => reason,
          );

          error.name.should.equal("ObjectTransportError");
          error.code.should.equal("OBJECT_TRANSPORT_UNAVAILABLE");
          expect(error.status).to.equal(null);
        });
      });

      it("reports unavailable location instead of retrying private resolve", async () => {
        const service = new ObjectService({
          readBaseUrl: "https://cn.example.org/resolve",
          resolveServiceUrl: "https://cn.example.org/resolve",
          locationResolver: {
            locate: state.sandbox.stub().resolves({
              objectServiceUrls: [],
              isPublic: false,
            }),
          },
          getToken: async () => "token-1",
        });
        const fetchStub = state.sandbox.stub(globalThis, "fetch");

        const error = await service.fetch("private.1").then(
          () => new Error("expected rejection"),
          (reason) => reason,
        );

        error.code.should.equal("OBJECT_LOCATION_UNAVAILABLE");
        sinon.assert.notCalled(fetchStub);
      });

      it("fetches object data using the PID as a single encoded path segment", async () => {
        const dataBlob = new Blob(["hello"], { type: "text/plain" });
        const fetchStub = state.sandbox
          .stub(globalThis, "fetch")
          .resolves(makeResponse(dataBlob));
        const service = new ObjectService({
          readBaseUrl: "https://example.org/object/read",
        });

        const response = await service.fetch(" doi:10.5063/abc ", {
          auth: false,
        });

        fetchStub.calledOnce.should.be.true;
        fetchStub.firstCall.args[0].should.equal(
          "https://example.org/object/read/doi:10.5063%2Fabc",
        );
        response.status.should.equal(200);
        response.data.should.be.instanceof(Blob);
      });

      it("download returns only payload data", async () => {
        const service = new ObjectService({
          readBaseUrl: "https://example.org/object/read",
        });
        state.sandbox.stub(service, "fetch").resolves({ data: "payload" });

        const payload = await service.download("pid.1");
        payload.should.equal("payload");
      });

      it("separates normal reads from write-target reads", async () => {
        const fetchStub = state.sandbox
          .stub(globalThis, "fetch")
          .callsFake(async () => makeResponse(new Blob(["object"])));
        const service = new ObjectService({
          readBaseUrl: "https://cn.example.org/resolve",
          writeBaseUrl: "https://mn.example.org/object",
        });

        await service.download("doi:10.5063/example", { auth: false });
        await service.downloadFromWriteTarget("doi:10.5063/example", {
          auth: false,
        });

        fetchStub.firstCall.args[0].should.equal(
          "https://cn.example.org/resolve/doi:10.5063%2Fexample",
        );
        fetchStub.secondCall.args[0].should.equal(
          "https://mn.example.org/object/doi:10.5063%2Fexample",
        );
      });

      it("rejects write-target reads when writeBaseUrl is absent", async () => {
        globalThis.MetacatUI = {
          appModel: {
            get() {
              return "https://app.example.org/object";
            },
          },
        };
        const service = new ObjectService({
          readBaseUrl: "https://cn.example.org/resolve",
        });
        const requestStub = state.sandbox.spy(service, "requestWithClient");

        let caught = null;
        try {
          await service.downloadFromWriteTarget("pid.1");
        } catch (error) {
          caught = error;
        }

        expect(caught).to.be.instanceof(Error);
        expect(caught.message).to.match(
          /writeBaseUrl is required for downloadFromWriteTarget/i,
        );
        sinon.assert.notCalled(requestStub);
      });

      it("does not use persistent cache for object payloads", async () => {
        const service = new ObjectService({
          readBaseUrl: "https://example.org/object/read",
        });
        const getCachedStub = state.sandbox.stub(service, "getCached");
        const setCachedStub = state.sandbox.stub(service, "setCached");
        state.sandbox.stub(globalThis, "fetch").resolves(makeResponse("fresh"));

        const payload = await service.download("pid.1", {
          auth: false,
          responseType: "text",
        });
        payload.should.equal("fresh");
        getCachedStub.called.should.be.false;
        setCachedStub.called.should.be.false;
      });

      it("validates required fetch parameters", async () => {
        const service = new ObjectService({
          readBaseUrl: "https://example.org/object/read",
        });

        let caught = null;
        try {
          await service.fetch("");
        } catch (error) {
          caught = error;
        }

        expect(caught).to.be.instanceof(Error);
        expect(caught.message).to.match(/pid is required/i);
      });
    });

    describe("create/update", () => {
      it("create sends multipart POST through the write client and parses XML identifier responses", async () => {
        const service = new ObjectService({
          readBaseUrl: "https://example.org/object/read",
          writeBaseUrl: "https://example.org/object/write",
        });
        globalThis.MetacatUI = {
          appModel: {
            get: () => "https://other.example.org/object",
            getActiveAltRepo: () => ({
              objectServiceUrl: "https://other.example.org/object",
            }),
          },
        };
        const reqStub = state.sandbox
          .stub(service, "requestWithClient")
          .resolves({ data: IDENTIFIER_XML, status: 200 });
        const controller = new AbortController();
        const objectBlob = new Blob(["abc"], { type: "text/plain" });
        const sysMetaXml = " <systemMetadata></systemMetadata> ";

        const response = await service.create(
          {
            pid: " pid.1 ",
            object: objectBlob,
            sysMetaXml,
            fileName: "data.txt",
          },
          {
            auth: false,
            signal: controller.signal,
            retry: { maxRetries: 1 },
            timeoutMs: 1234,
          },
        );

        const client = reqStub.firstCall.args[0];
        const opts = reqStub.firstCall.args[1];
        client.baseUrl.should.equal("https://example.org/object/write");
        opts.path.should.equal("");
        opts.encodePath.should.equal(false);
        opts.method.should.equal("POST");
        opts.transport.should.equal("fetch");
        opts.dedupe.should.equal(false);
        opts.responseType.should.equal("text");
        opts.headers.Accept.should.equal("text/xml");
        opts.auth.should.equal(false);
        opts.signal.should.equal(controller.signal);
        opts.timeoutMs.should.equal(1234);
        opts.retry.should.deep.equal({ maxRetries: 1 });
        should.not.exist(opts.onUploadProgress);
        opts.body.should.be.instanceof(FormData);
        opts.body.get("pid").should.equal("pid.1");
        opts.body.get("sysmeta").should.be.instanceof(Blob);
        opts.body.get("sysmeta").name.should.equal("sysmeta");
        opts.body.get("object").name.should.equal("data.txt");
        (await opts.body.get("sysmeta").text()).should.equal(
          "<systemMetadata></systemMetadata>",
        );
        response.data.identifier.should.equal("urn:uuid:generated.1");
        response.data.xml.should.be.instanceof(Document);
      });

      it("create supports xhr transport and forwards upload progress callbacks", async () => {
        const service = new ObjectService({
          readBaseUrl: "https://example.org/object/read",
          writeBaseUrl: "https://example.org/object/write",
        });
        const reqStub = state.sandbox
          .stub(service, "requestWithClient")
          .resolves({ data: IDENTIFIER_XML });
        const onUploadProgress = state.sandbox.spy();

        await service.create(
          {
            pid: "pid.1",
            object: new Blob(["abc"], { type: "text/plain" }),
            sysMetaXml: "<systemMetadata></systemMetadata>",
          },
          {
            transport: "xhr",
            onUploadProgress,
          },
        );

        const opts = reqStub.firstCall.args[1];
        opts.transport.should.equal("xhr");
        opts.onUploadProgress.should.equal(onUploadProgress);
      });

      it("create preserves explicit Accept headers", async () => {
        const service = new ObjectService({
          readBaseUrl: "https://example.org/object/read",
          writeBaseUrl: "https://example.org/object/write",
        });
        const reqStub = state.sandbox
          .stub(service, "requestWithClient")
          .resolves({ data: IDENTIFIER_XML });

        await service.create(
          {
            pid: "pid.1",
            object: new Blob(["abc"], { type: "text/plain" }),
            sysMetaXml: "<systemMetadata></systemMetadata>",
          },
          {
            headers: {
              accept: "application/xml",
            },
          },
        );

        const opts = reqStub.firstCall.args[1];
        opts.headers.accept.should.equal("application/xml");
        should.not.exist(opts.headers.Accept);
      });

      it("create validates required params", async () => {
        const service = new ObjectService({
          readBaseUrl: "https://example.org/object/read",
          writeBaseUrl: "https://example.org/object/write",
        });

        let missingPidError = null;
        try {
          await service.create({
            object: new Blob(["abc"], { type: "text/plain" }),
            sysMetaXml: "<systemMetadata></systemMetadata>",
          });
        } catch (error) {
          missingPidError = error;
        }
        expect(missingPidError).to.be.instanceof(Error);
        expect(missingPidError.message).to.match(/pid is required/i);

        let missingXmlError = null;
        try {
          await service.create({
            pid: "pid.1",
            object: new Blob(["abc"], { type: "text/plain" }),
          });
        } catch (error) {
          missingXmlError = error;
        }
        expect(missingXmlError).to.be.instanceof(Error);
        expect(missingXmlError.message).to.match(/sysMetaXml is required/i);
      });

      it("create and update require an object payload", async () => {
        const service = new ObjectService({
          readBaseUrl: "https://example.org/object/read",
          writeBaseUrl: "https://example.org/object/write",
        });

        let createError = null;
        try {
          await service.create({
            pid: "pid.1",
            sysMetaXml: "<systemMetadata></systemMetadata>",
          });
        } catch (error) {
          createError = error;
        }
        expect(createError).to.be.instanceof(Error);
        expect(createError.message).to.match(/object is required/i);

        let updateError = null;
        try {
          await service.update({
            pid: "pid.old",
            newPid: "pid.new",
            sysMetaXml: "<systemMetadata></systemMetadata>",
          });
        } catch (error) {
          updateError = error;
        }
        expect(updateError).to.be.instanceof(Error);
        expect(updateError.message).to.match(/object is required/i);
      });

      it("update sends multipart PUT through the write client", async () => {
        const service = new ObjectService({
          readBaseUrl: "https://example.org/object/read",
          writeBaseUrl: "https://example.org/object/write",
        });
        const reqStub = state.sandbox
          .stub(service, "requestWithClient")
          .resolves({ data: IDENTIFIER_XML });
        const objectBlob = new Blob(["xyz"], { type: "text/plain" });
        const sysMetaXml = "<systemMetadata></systemMetadata>";

        const response = await service.update(
          {
            pid: " doi:10.5063/old ",
            newPid: " doi:10.5063/new ",
            object: objectBlob,
            sysMetaXml: ` ${sysMetaXml} `,
            fileName: "data.txt",
          },
          {
            auth: false,
          },
        );

        const client = reqStub.firstCall.args[0];
        const opts = reqStub.firstCall.args[1];
        client.baseUrl.should.equal("https://example.org/object/write");
        opts.path.should.equal("doi:10.5063%2Fold");
        opts.encodePath.should.equal(false);
        opts.method.should.equal("PUT");
        opts.transport.should.equal("fetch");
        opts.dedupe.should.equal(false);
        opts.responseType.should.equal("text");
        opts.headers.Accept.should.equal("text/xml");
        opts.body.should.be.instanceof(FormData);
        opts.body.get("pid").should.equal("doi:10.5063/old");
        opts.body.get("newPid").should.equal("doi:10.5063/new");
        opts.body.get("object").name.should.equal("data.txt");
        (await opts.body.get("sysmeta").text()).should.equal(sysMetaXml);
        response.data.identifier.should.equal("urn:uuid:generated.1");
      });

      it("update uses the encoded PID URL when sending fetch requests", async () => {
        const fetchStub = state.sandbox
          .stub(globalThis, "fetch")
          .resolves(makeResponse(IDENTIFIER_XML));
        const service = new ObjectService({
          readBaseUrl: "https://example.org/object/read",
          writeBaseUrl: "https://example.org/object/write",
        });

        const response = await service.update(
          {
            pid: "doi:10.5063/old",
            newPid: "doi:10.5063/new",
            object: new Blob(["xyz"], { type: "text/plain" }),
            sysMetaXml: "<systemMetadata></systemMetadata>",
          },
          {
            auth: false,
          },
        );

        fetchStub.calledOnce.should.be.true;
        fetchStub.firstCall.args[0].should.equal(
          "https://example.org/object/write/doi:10.5063%2Fold",
        );
        response.data.identifier.should.equal("urn:uuid:generated.1");
      });

      it("update supports explicit xhr transport", async () => {
        const service = new ObjectService({
          readBaseUrl: "https://example.org/object/read",
          writeBaseUrl: "https://example.org/object/write",
        });
        const reqStub = state.sandbox
          .stub(service, "requestWithClient")
          .resolves({ data: IDENTIFIER_XML });

        await service.update(
          {
            pid: "pid.old",
            newPid: "pid.new",
            object: new Blob(["xyz"], { type: "text/plain" }),
            sysMetaXml: "<systemMetadata></systemMetadata>",
          },
          {
            transport: "xhr",
          },
        );

        const opts = reqStub.firstCall.args[1];
        opts.transport.should.equal("xhr");
      });

      it("update surfaces parsed DataONE service errors from XML responses", async () => {
        const service = new ObjectService({
          readBaseUrl: "https://example.org/object/read",
          writeBaseUrl: "https://example.org/object/write",
        });
        state.sandbox.stub(service, "requestWithClient").resolves({
          data: ERROR_XML,
        });

        let caught = null;
        try {
          await service.update({
            pid: "pid.old",
            newPid: "pid.new",
            object: new Blob(["xyz"], { type: "text/plain" }),
            sysMetaXml: "<systemMetadata></systemMetadata>",
          });
        } catch (error) {
          caught = error;
        }

        expect(caught).to.be.instanceof(Error);
        expect(caught.name).to.equal("NotAuthorized");
        expect(caught.message).to.equal("READ not allowed");
        expect(caught.status).to.equal("401");
      });

      it("update validates required params", async () => {
        const service = new ObjectService({
          readBaseUrl: "https://example.org/object/read",
          writeBaseUrl: "https://example.org/object/write",
        });

        let caught = null;
        try {
          await service.update({
            pid: "pid.old",
            object: new Blob(["xyz"], { type: "text/plain" }),
            sysMetaXml: "<systemMetadata></systemMetadata>",
          });
        } catch (error) {
          caught = error;
        }

        expect(caught).to.be.instanceof(Error);
        expect(caught.message).to.match(/newPid is required/i);
      });
    });
  });
});
