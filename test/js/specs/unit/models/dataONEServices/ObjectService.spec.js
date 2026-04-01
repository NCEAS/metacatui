define([
  "/test/js/specs/shared/clean-state.js",
  "models/dataONEServices/ObjectService",
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
      it("uses explicit read and write base URLs", () => {
        const service = new ObjectService({
          readBaseUrl: "https://example.org/object/read/",
          writeBaseUrl: "https://example.org/object/write/",
        });

        service.client.baseUrl.should.equal("https://example.org/object/read");
        service.readBaseUrl.should.equal("https://example.org/object/read");
        service.explicitWriteBaseUrl.should.equal(
          "https://example.org/object/write",
        );
        service.writeBaseUrl.should.equal("https://example.org/object/write");
      });

      it("falls back to the app model objectServiceUrl on an MN", () => {
        globalThis.MetacatUI = {
          appModel: {
            get(key) {
              if (key === "objectServiceUrl") {
                return "https://mn.example.org/object/";
              }
              if (key === "resolveServiceUrl") {
                return "https://cn.example.org/resolve/";
              }
              return null;
            },
          },
        };

        const service = new ObjectService();
        service.client.baseUrl.should.equal("https://mn.example.org/object");
        service.resolveWriteBaseUrl().should.equal("https://mn.example.org/object");
      });

      it("falls back to resolveServiceUrl for reads on a CN", () => {
        globalThis.MetacatUI = {
          appModel: {
            get(key) {
              if (key === "resolveServiceUrl") {
                return "https://cn.example.org/resolve/";
              }
              return null;
            },
          },
        };

        const service = new ObjectService();
        service.client.baseUrl.should.equal("https://cn.example.org/resolve");
        service.resolveWriteBaseUrl().should.equal("");
      });

      it("uses the active alt repo for writes on a CN", () => {
        globalThis.MetacatUI = {
          appModel: {
            get(key) {
              if (key === "resolveServiceUrl") {
                return "https://cn.example.org/resolve/";
              }
              return null;
            },
            getActiveAltRepo() {
              return {
                objectServiceUrl: "https://mn.example.org/object/",
              };
            },
          },
        };

        const service = new ObjectService();
        service.resolveWriteBaseUrl().should.equal("https://mn.example.org/object");
      });

      it("calls setActiveAltRepo once when no active alt repo is selected", () => {
        const appModel = {
          get(key) {
            if (key === "resolveServiceUrl") {
              return "https://cn.example.org/resolve/";
            }
            if (key === "alternateRepositories") {
              return [{ id: "urn:node:MN1" }];
            }
            return null;
          },
          getActiveAltRepo: state.sandbox
            .stub()
            .onFirstCall()
            .returns(null)
            .onSecondCall()
            .returns({
              objectServiceUrl: "https://mn.example.org/object/",
            }),
          setActiveAltRepo: state.sandbox.stub(),
        };
        globalThis.MetacatUI = { appModel };

        const service = new ObjectService();
        service
          .resolveWriteBaseUrl("create")
          .should.equal("https://mn.example.org/object");
        appModel.setActiveAltRepo.calledOnce.should.be.true;
      });

      it("throws when no read base URL can be resolved", () => {
        globalThis.MetacatUI = {
          appModel: {
            get() {
              return null;
            },
          },
        };

        expect(() => new ObjectService()).to.throw(/readBaseUrl is required/i);
      });
    });

    describe("fetch/download", () => {
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
          "https://example.org/object/read/doi%3A10.5063%2Fabc",
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

      it("does not use persistent cache for object payloads", async () => {
        const service = new ObjectService({
          readBaseUrl: "https://example.org/object/read",
        });
        const getCachedStub = state.sandbox.stub(service, "getCached");
        const setCachedStub = state.sandbox.stub(service, "setCached");
        state.sandbox.stub(service, "request").resolves({ data: "fresh" });

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

      it("create throws when no write base URL can be resolved", async () => {
        globalThis.MetacatUI = {
          appModel: {
            get(key) {
              if (key === "resolveServiceUrl") {
                return "https://cn.example.org/resolve/";
              }
              return null;
            },
          },
        };
        const service = new ObjectService();

        let caught = null;
        try {
          await service.create({
            pid: "pid.1",
            object: new Blob(["abc"], { type: "text/plain" }),
            sysMetaXml: "<systemMetadata></systemMetadata>",
          });
        } catch (error) {
          caught = error;
        }

        expect(caught).to.be.instanceof(Error);
        expect(caught.message).to.match(/writeBaseUrl is required for create/i);
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
        opts.path.should.equal("doi%3A10.5063%2Fold");
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
          "https://example.org/object/write/doi%3A10.5063%2Fold",
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
