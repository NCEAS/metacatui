define([
  "/test/js/specs/shared/clean-state.js",
  "models/dataONEServices/IdentifierService",
], (cleanState, IdentifierService) => {
  const should = chai.should();
  const expect = chai.expect;

  const IDENTIFIER_XML = "<identifier>urn:uuid:generated.1</identifier>";
  const ERROR_XML = `
    <error detailCode="1040" errorCode="401" name="NotAuthorized">
      <description> READ not allowed </description>
    </error>
  `;

  describe("IdentifierService", () => {
    const state = cleanState(() => {
      const sandbox = sinon.createSandbox();
      const originalMetacatUI = globalThis.MetacatUI;
      return { sandbox, originalMetacatUI };
    }, beforeEach);

    afterEach(() => {
      state.sandbox.restore();
      globalThis.MetacatUI = state.originalMetacatUI;
    });

    describe("construction", () => {
      it("uses the provided CN base URL", () => {
        const service = new IdentifierService({
          baseUrl: "https://example.org/cn/v2/",
        });

        service.client.baseUrl.should.equal("https://example.org/cn/v2");
      });

      it("prefers explicit baseUrl over app-level CN settings", () => {
        const service = new IdentifierService({
          baseUrl: "https://preferred.example.org/cn/v2/",
        });

        service.client.baseUrl.should.equal(
          "https://preferred.example.org/cn/v2",
        );
      });

      it("falls back to MetacatUI CN settings", () => {
        globalThis.MetacatUI = {
          appModel: {
            get(key) {
              if (key === "d1CNBaseUrl") {
                return "https://fallback.example.org/";
              }
              if (key === "d1CNService") {
                return "/cn/v2";
              }
              return null;
            },
          },
        };

        const service = new IdentifierService();
        service.client.baseUrl.should.equal("https://fallback.example.org/cn/v2");
        service.defaultAuth.should.equal(true);
        service.persistPrivate.should.equal(false);
      });

      it("throws when a CN base URL cannot be resolved", () => {
        globalThis.MetacatUI = {
          appModel: {
            get() {
              return null;
            },
          },
        };

        expect(() => new IdentifierService()).to.throw(/baseUrl is required/);
      });
    });

    describe("static helpers", () => {
      it("resolves the base URL from app settings even when the service path lacks a leading slash", () => {
        globalThis.MetacatUI = {
          appModel: {
            get(key) {
              if (key === "d1CNBaseUrl") {
                return "https://fallback.example.org/";
              }
              if (key === "d1CNService") {
                return "cn/v2";
              }
              return null;
            },
          },
        };

        IdentifierService.resolveBaseUrl().should.equal(
          "https://fallback.example.org/cn/v2",
        );
      });

      it("builds generate form data with defaults and rejects unsupported params", () => {
        const formData = IdentifierService.buildGenerateFormData({
          fragment: "abc",
        });

        formData.get("scheme").should.equal("UUID");
        formData.get("fragment").should.equal("abc");

        expect(() =>
          IdentifierService.buildGenerateFormData({
            scheme: "UUID",
            extra: "bad",
          }),
        ).to.throw(/unsupported generateIdentifier params/i);
      });

      it("requires a non-empty pid when building reserve form data", () => {
        IdentifierService.buildReserveFormData("urn:uuid:test.1")
          .get("pid")
          .should.equal("urn:uuid:test.1");

        expect(() => IdentifierService.buildReserveFormData("   ")).to.throw(
          /pid is required/i,
        );
      });
    });

    describe("generateIdentifier", () => {
      it("posts to /generate with default scheme, optional fragment, forwards request options, and parses identifier XML", async () => {
        const service = new IdentifierService({
          baseUrl: "https://example.org/cn/v2",
        });
        const reqStub = state.sandbox
          .stub(service, "request")
          .resolves({ data: IDENTIFIER_XML, status: 200 });
        const controller = new AbortController();

        const response = await service.generateIdentifier(
          {
            fragment: "test-fragment",
          },
          {
            auth: false,
            signal: controller.signal,
            timeoutMs: 1234,
            retry: { maxRetries: 2 },
            transport: "xhr",
          },
        );

        const opts = reqStub.firstCall.args[0];
        opts.path.should.equal("generate");
        opts.method.should.equal("POST");
        opts.responseType.should.equal("text");
        opts.dedupe.should.equal(false);
        opts.auth.should.equal(true);
        opts.signal.should.equal(controller.signal);
        opts.timeoutMs.should.equal(1234);
        opts.retry.should.deep.equal({ maxRetries: 2 });
        opts.transport.should.equal("xhr");
        opts.headers.Accept.should.equal("text/xml");
        opts.body.should.be.instanceof(FormData);
        opts.body.get("scheme").should.equal("UUID");
        opts.body.get("fragment").should.equal("test-fragment");

        response.data.identifier.should.equal("urn:uuid:generated.1");
        response.data.xml.should.be.instanceof(Document);
      });

      it("preserves explicit Accept headers", async () => {
        const service = new IdentifierService({
          baseUrl: "https://example.org/cn/v2",
        });
        const reqStub = state.sandbox
          .stub(service, "request")
          .resolves({ data: IDENTIFIER_XML, status: 200 });

        await service.generateIdentifier(
          { scheme: "DOI" },
          {
            headers: {
              accept: "application/xml",
            },
          },
        );

        const opts = reqStub.firstCall.args[0];
        opts.headers.accept.should.equal("application/xml");
        should.not.exist(opts.headers.Accept);
      });

      it("throws when XML parsing fails or identifier is missing", async () => {
        const service = new IdentifierService({
          baseUrl: "https://example.org/cn/v2",
        });
        state.sandbox.stub(service, "request").resolves({
          data: "<not-xml>",
        });

        let caught;
        try {
          await service.generateIdentifier();
        } catch (error) {
          caught = error;
        }

        expect(caught).to.be.instanceof(Error);
        expect(caught.message).to.match(/generateIdentifier/i);
      });

      it("throws when the response XML is malformed", async () => {
        const service = new IdentifierService({
          baseUrl: "https://example.org/cn/v2",
        });
        state.sandbox.stub(service, "request").resolves({
          data: "<identifier>",
        });

        let caught;
        try {
          await service.generateIdentifier();
        } catch (error) {
          caught = error;
        }

        expect(caught).to.be.instanceof(Error);
        expect(caught.message).to.match(/invalid xml|failed to parse/i);
      });

      it("throws parsed DataONE service errors from XML responses", async () => {
        const service = new IdentifierService({
          baseUrl: "https://example.org/cn/v2",
        });
        state.sandbox.stub(service, "request").resolves({
          data: ERROR_XML,
        });

        let caught;
        try {
          await service.generateIdentifier();
        } catch (error) {
          caught = error;
        }

        expect(caught).to.be.instanceof(Error);
        expect(caught.name).to.equal("NotAuthorized");
        expect(caught.message).to.equal("READ not allowed");
        expect(caught.status).to.equal("401");
      });

      it("throws when generateIdentifier receives unsupported params", async () => {
        const service = new IdentifierService({
          baseUrl: "https://example.org/cn/v2",
        });

        let caught;
        try {
          await service.generateIdentifier({
            scheme: "UUID",
            extra: "nope",
          });
        } catch (error) {
          caught = error;
        }

        expect(caught).to.be.instanceof(Error);
        expect(caught.message).to.match(/unsupported generateIdentifier params/i);
      });
    });

    describe("reserveIdentifier", () => {
      it("posts to /reserve with pid, default Accept, and parses identifier XML", async () => {
        const service = new IdentifierService({
          baseUrl: "https://example.org/cn/v2",
        });
        const reqStub = state.sandbox
          .stub(service, "request")
          .resolves({ data: IDENTIFIER_XML, status: 200 });

        const response = await service.reserveIdentifier("urn:uuid:pid.1", {
          auth: false,
        });

        const opts = reqStub.firstCall.args[0];
        opts.path.should.equal("reserve");
        opts.method.should.equal("POST");
        opts.responseType.should.equal("text");
        opts.dedupe.should.equal(false);
        opts.auth.should.equal(true);
        opts.headers.Accept.should.equal("text/xml");
        opts.body.should.be.instanceof(FormData);
        opts.body.get("pid").should.equal("urn:uuid:pid.1");

        response.data.identifier.should.equal("urn:uuid:generated.1");
      });

      it("preserves explicit Accept headers", async () => {
        const service = new IdentifierService({
          baseUrl: "https://example.org/cn/v2",
        });
        const reqStub = state.sandbox
          .stub(service, "request")
          .resolves({ data: IDENTIFIER_XML, status: 200 });

        await service.reserveIdentifier("urn:uuid:pid.1", {
          headers: {
            accept: "application/xml",
          },
        });

        const opts = reqStub.firstCall.args[0];
        opts.headers.accept.should.equal("application/xml");
        should.not.exist(opts.headers.Accept);
      });

      it("throws parsed DataONE service errors from XML responses", async () => {
        const service = new IdentifierService({
          baseUrl: "https://example.org/cn/v2",
        });
        state.sandbox.stub(service, "request").resolves({
          data: ERROR_XML,
        });

        let caught;
        try {
          await service.reserveIdentifier("urn:uuid:pid.1");
        } catch (error) {
          caught = error;
        }

        expect(caught).to.be.instanceof(Error);
        expect(caught.name).to.equal("NotAuthorized");
        expect(caught.message).to.equal("READ not allowed");
        expect(caught.status).to.equal("401");
      });

      it("throws when pid is missing", async () => {
        const service = new IdentifierService({
          baseUrl: "https://example.org/cn/v2",
        });
        let caught;
        try {
          await service.reserveIdentifier("");
        } catch (error) {
          caught = error;
        }
        expect(caught).to.be.instanceof(Error);
        expect(caught.message).to.match(/pid is required/i);
      });
    });
  });
});
