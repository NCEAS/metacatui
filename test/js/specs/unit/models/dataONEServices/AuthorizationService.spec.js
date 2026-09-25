define(["models/dataONEServices/AuthorizationService"], (
  AuthorizationService,
) => {
  const expect = chai.expect;

  describe("AuthorizationService", () => {
    describe("normalizeAction()", () => {
      it("defaults omitted actions to write", () => {
        expect(AuthorizationService.normalizeAction()).to.equal("write");
      });

      it("throws for unsupported permission actions", () => {
        expect(() =>
          AuthorizationService.normalizeAction("changePermissions"),
        ).to.throw(/not a valid authorization action/i);
      });
    });

    describe("parseAuthorizationResponse()", () => {
      it("parses plain text authorization responses", () => {
        expect(
          AuthorizationService.parseAuthorizationResponse("true"),
        ).to.equal(true);
        expect(
          AuthorizationService.parseAuthorizationResponse("false"),
        ).to.equal(false);
      });

      it("parses XML authorization responses", () => {
        expect(
          AuthorizationService.parseAuthorizationResponse(
            "<authorized>true</authorized>",
          ),
        ).to.equal(true);
        expect(
          AuthorizationService.parseAuthorizationResponse(
            "<authorized>false</authorized>",
          ),
        ).to.equal(false);
      });

      it("treats an empty successful response as authorized", () => {
        expect(AuthorizationService.parseAuthorizationResponse("")).to.equal(
          true,
        );
      });

      it("fails closed for unrecognized non-empty responses", () => {
        expect(
          AuthorizationService.parseAuthorizationResponse(
            "<error>nope</error>",
          ),
        ).to.equal(false);
        expect(
          AuthorizationService.parseAuthorizationResponse("authorized-ish"),
        ).to.equal(false);
      });
    });

    describe("checkAll()", () => {
      it("limits concurrent authorization checks", async () => {
        const service = new AuthorizationService({
          baseUrl: "https://example.test/cn/v2/isAuthorized",
        });
        let inFlight = 0;
        let maxConcurrent = 0;
        service.check = (pid) =>
          new Promise((resolve) => {
            inFlight += 1;
            maxConcurrent = Math.max(maxConcurrent, inFlight);
            setTimeout(() => {
              inFlight -= 1;
              resolve(pid !== "denied");
            }, 0);
          });

        const results = await service.checkAll(
          ["allowed.1", "allowed.2", "denied", "allowed.3"],
          "write",
          { maxConcurrent: 2 },
        );

        expect(maxConcurrent).to.equal(2);
        expect(results).to.deep.equal({
          "allowed.1": true,
          "allowed.2": true,
          denied: false,
          "allowed.3": true,
        });
      });

      it("reports progress as authorization checks complete", async () => {
        const service = new AuthorizationService({
          baseUrl: "https://example.test/cn/v2/isAuthorized",
        });
        service.check = async () => true;
        const progress = [];

        await service.checkAll(["allowed.1", "allowed.2"], "write", {
          maxConcurrent: 1,
          onProgress: (event) => progress.push(event),
        });

        expect(progress[0]).to.deep.equal({ completed: 0, total: 2 });
        expect(progress.slice(1)).to.deep.equal([
          {
            action: "write",
            completed: 1,
            pid: "allowed.1",
            total: 2,
          },
          {
            action: "write",
            completed: 2,
            pid: "allowed.2",
            total: 2,
          },
        ]);
      });
    });
  });
});
