define([
  "/test/js/specs/shared/clean-state.js",
  "models/dataONEServices/PublishService",
  "models/dataONEServices/DataONEHttpError",
], (cleanState, PublishService, DataONEHttpError) => {
  const should = chai.should();
  const expect = chai.expect;

  const IDENTIFIER_XML = "<identifier>urn:uuid:published.1</identifier>";
  const ERROR_XML = `
    <error detailCode="1040" errorCode="401" name="NotAuthorized">
      <description> WRITE not allowed </description>
    </error>
  `;

  describe("PublishService", () => {
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
      it("uses an explicit publish base URL", () => {
        const service = new PublishService({
          baseUrl: "https://example.org/publish/",
        });

        service.client.baseUrl.should.equal("https://example.org/publish");
        service.client.timeoutMs.should.equal(210000);
        service.defaultAuth.should.equal(true);
        service.persistPrivate.should.equal(false);
      });

      it("falls back to the app model publishServiceUrl", () => {
        globalThis.MetacatUI = {
          appModel: {
            get(key) {
              return key === "publishServiceUrl"
                ? "https://example.org/app-publish/"
                : null;
            },
          },
        };

        const service = new PublishService();
        service.client.baseUrl.should.equal("https://example.org/app-publish");
      });
    });

    describe("publish", () => {
      it("puts to the encoded PID path and parses the published identifier", async () => {
        const service = new PublishService({
          baseUrl: "https://example.org/publish",
        });
        const controller = new AbortController();
        const reqStub = state.sandbox.stub(service, "request").resolves({
          data: IDENTIFIER_XML,
          status: 200,
        });

        const identifier = await service.publish(" doi:10.5063/abc ", {
          auth: false,
          signal: controller.signal,
        });

        const opts = reqStub.firstCall.args[0];
        identifier.should.equal("urn:uuid:published.1");
        opts.path.should.equal("doi:10.5063%2Fabc");
        opts.method.should.equal("PUT");
        opts.responseType.should.equal("text");
        opts.encodePath.should.equal(false);
        opts.dedupe.should.equal(false);
        opts.auth.should.equal(false);
        opts.signal.should.equal(controller.signal);
        opts.headers.Accept.should.equal(
          "text/xml, application/xml, text/plain, */*",
        );
      });

      it("preserves caller-provided Accept headers", async () => {
        const service = new PublishService({
          baseUrl: "https://example.org/publish",
        });
        const reqStub = state.sandbox.stub(service, "request").resolves({
          data: IDENTIFIER_XML,
        });

        await service.publish("pid.1", {
          headers: {
            accept: "application/xml",
          },
        });

        const opts = reqStub.firstCall.args[0];
        opts.headers.accept.should.equal("application/xml");
        should.not.exist(opts.headers.Accept);
      });

      it("throws when the PID is missing", async () => {
        const service = new PublishService({
          baseUrl: "https://example.org/publish",
        });

        let caught;
        try {
          await service.publish("");
        } catch (error) {
          caught = error;
        }

        expect(caught).to.be.instanceof(Error);
        expect(caught.message).to.match(/publish requires a pid/i);
      });

      it("throws parsed DataONE service errors from HTTP error XML", async () => {
        const service = new PublishService({
          baseUrl: "https://example.org/publish",
        });
        state.sandbox.stub(service, "request").rejects(
          new DataONEHttpError({
            status: 401,
            bodyText: ERROR_XML,
          }),
        );

        let caught;
        try {
          await service.publish("pid.1");
        } catch (error) {
          caught = error;
        }

        expect(caught).to.be.instanceof(Error);
        expect(caught.name).to.equal("NotAuthorized");
        expect(caught.message).to.equal("WRITE not allowed");
        expect(caught.status).to.equal("401");
      });

      it("preserves HTTP errors with non-XML response bodies", async () => {
        const service = new PublishService({
          baseUrl: "https://example.org/publish",
        });
        const httpError = new DataONEHttpError({
          status: 502,
          bodyText: "Bad Gateway",
        });
        state.sandbox.stub(service, "request").rejects(httpError);

        let caught;
        try {
          await service.publish("pid.1");
        } catch (error) {
          caught = error;
        }

        expect(caught).to.equal(httpError);
        expect(caught.status).to.equal(502);
      });
    });
  });
});
