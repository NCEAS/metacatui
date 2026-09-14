define([
  "/test/js/specs/shared/clean-state.js",
  "models/dataONEServices/PackageService",
], (cleanState, PackageService) => {
  chai.should();
  const expect = chai.expect;

  describe("PackageService", () => {
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
      it("falls back to the app model packageServiceUrl", () => {
        globalThis.MetacatUI = {
          appModel: {
            get(key) {
              return key === "packageServiceUrl"
                ? "https://example.org/packages/application%2Fbagit-1.0/"
                : null;
            },
          },
        };

        const service = new PackageService();

        service.client.baseUrl.should.equal(
          "https://example.org/packages/application%2Fbagit-1.0",
        );
      });
    });

    describe("download", () => {
      it("downloads a Blob with bearer authentication", async () => {
        const fetchStub = state.sandbox
          .stub(globalThis, "fetch")
          .resolves(new Response("package data"));
        const service = new PackageService({
          baseUrl: "https://example.org/packages/application%2Fbagit-1.0",
          getToken: async () => "secret-token",
        });

        const blob = await service.download("doi:10.5063/example+data");

        fetchStub.calledOnce.should.be.true;
        fetchStub.firstCall.args[0].should.equal(
          "https://example.org/packages/application%2Fbagit-1.0/doi:10.5063%2Fexample%2Bdata",
        );
        fetchStub.firstCall.args[1].headers.Authorization.should.equal(
          "Bearer secret-token",
        );
        blob.should.be.instanceof(Blob);
        (await blob.text()).should.equal("package data");
      });

      it("honors an already-aborted signal", async () => {
        state.sandbox.stub(globalThis, "fetch").callsFake((_url, options) => {
          options.signal.aborted.should.be.true;
          return Promise.reject(new DOMException("Aborted", "AbortError"));
        });
        const service = new PackageService({
          baseUrl: "https://example.org/packages/application%2Fbagit-1.0",
          getToken: async () => null,
        });
        const controller = new AbortController();
        controller.abort();

        let caught = null;
        try {
          await service.download("pid.1", { signal: controller.signal });
        } catch (error) {
          caught = error;
        }

        expect(caught).to.be.instanceof(Error);
        expect(caught.name).to.equal("AbortError");
      });

      it("fetches the package again on later downloads", async () => {
        let requestNumber = 0;
        const fetchStub = state.sandbox
          .stub(globalThis, "fetch")
          .callsFake(async () => {
            requestNumber += 1;
            return new Response(`package ${requestNumber}`);
          });
        const service = new PackageService({
          baseUrl: "https://example.org/packages/application%2Fbagit-1.0",
          getToken: async () => null,
        });

        const first = await service.download("pid.1");
        const second = await service.download("pid.1");

        fetchStub.callCount.should.equal(2);
        (await first.text()).should.equal("package 1");
        (await second.text()).should.equal("package 2");
      });

      it("does not retry a failed package generation request", async () => {
        const fetchStub = state.sandbox
          .stub(globalThis, "fetch")
          .resolves(new Response("unavailable", { status: 503 }));
        const service = new PackageService({
          baseUrl: "https://example.org/packages/application%2Fbagit-1.0",
          getToken: async () => null,
        });

        let caught = null;
        try {
          await service.download("pid.1");
        } catch (error) {
          caught = error;
        }

        expect(caught).to.be.instanceof(Error);
        expect(caught.status).to.equal(503);
        fetchStub.calledOnce.should.be.true;
      });
    });
  });
});
