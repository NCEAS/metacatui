define([
  "/test/js/specs/shared/clean-state.js",
  "models/dataONEServices/ViewService",
  "models/viewService/ViewServiceDoc",
], (cleanState, ViewService, ViewServiceDoc) => {
  const should = chai.should();
  const expect = chai.expect;

  const RENDERED_HTML = `
    <div id="Metadata">
      <div class="entitydetails" data-id="data.1"></div>
    </div>
  `;

  describe("ViewService", () => {
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
      it("uses an explicit view service base URL and default theme", () => {
        const service = new ViewService({
          baseUrl: "https://example.org/views/metacatui/",
        });

        service.client.baseUrl.should.equal(
          "https://example.org/views/metacatui",
        );
        service.baseUrl.should.equal("https://example.org/views/metacatui");
        service.theme.should.equal("metacatui");
      });

      it("falls back to the app model viewServiceUrl", () => {
        globalThis.MetacatUI = {
          appModel: {
            get(key) {
              return key === "viewServiceUrl"
                ? "https://example.org/app-views/metacatui/"
                : null;
            },
          },
        };

        const service = new ViewService();
        service.client.baseUrl.should.equal(
          "https://example.org/app-views/metacatui",
        );
      });
    });

    describe("fetch", () => {
      it("gets the encoded PID path with the rendered HTML Accept header", async () => {
        const service = new ViewService({
          baseUrl: "https://example.org/views/metacatui",
        });
        const controller = new AbortController();
        const reqStub = state.sandbox.stub(service, "request").resolves({
          data: RENDERED_HTML,
          status: 200,
        });

        await service.fetch(" doi:10.5063/abc ", {
          auth: false,
          signal: controller.signal,
        });

        const opts = reqStub.firstCall.args[0];
        opts.path.should.equal("doi:10.5063%2Fabc");
        opts.method.should.equal("GET");
        opts.responseType.should.equal("text");
        opts.encodePath.should.equal(false);
        opts.auth.should.equal(false);
        opts.signal.should.equal(controller.signal);
        opts.headers.Accept.should.equal(
          "text/html, application/xhtml+xml, */*;q=0.8",
        );
      });

      it("throws when the PID is missing", async () => {
        const service = new ViewService({
          baseUrl: "https://example.org/views/metacatui",
        });

        let caught;
        try {
          await service.fetch("");
        } catch (error) {
          caught = error;
        }

        expect(caught).to.be.instanceof(Error);
        expect(caught.message).to.match(/fetch requires a pid/i);
      });
    });

    describe("download", () => {
      it("returns a parsed ViewServiceDoc without passing document options to fetch", async () => {
        const service = new ViewService({
          baseUrl: "https://example.org/views/metacatui",
        });
        const fetchStub = state.sandbox.stub(service, "fetch").resolves({
          data: RENDERED_HTML,
          url: "https://example.org/views/metacatui/meta.1",
          headers: new Headers({
            "Content-Type": "text/html",
          }),
        });

        const doc = await service.download(" meta.1 ", {
          auth: false,
          resolveBaseUrl: "https://example.org/resolve/",
        });

        fetchStub.calledOnce.should.be.true;
        fetchStub.firstCall.args[0].should.equal("meta.1");
        fetchStub.firstCall.args[1].should.deep.equal({ auth: false });
        doc.should.be.instanceof(ViewServiceDoc);
        doc.pid.should.equal("meta.1");
        doc.url.should.equal("https://example.org/views/metacatui/meta.1");
        doc.contentType.should.equal("text/html");
        doc.status.should.equal(ViewServiceDoc.STATUS.OK);
      });
    });

    describe("invalidate", () => {
      it("removes cached entries for a normalized PID", async () => {
        const service = new ViewService({
          baseUrl: "https://example.org/views/metacatui",
        });
        const removeStub = state.sandbox
          .stub(service, "removeCached")
          .resolves();

        await service.invalidate(" meta.1 ");

        removeStub.calledOnceWith("meta.1").should.be.true;
      });

      it("no-ops without a PID", async () => {
        const service = new ViewService({
          baseUrl: "https://example.org/views/metacatui",
        });
        const removeStub = state.sandbox
          .stub(service, "removeCached")
          .resolves();

        await service.invalidate(" ");

        removeStub.called.should.be.false;
      });
    });
  });
});
