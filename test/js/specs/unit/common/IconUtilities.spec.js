define([
  "common/IconUtilities",
], (IconUtilities) => {
  const expect = chai.expect;
  const sandbox = sinon.createSandbox();
  const stub = sandbox.stub;

  describe("IconUtilities Test Suite", () => {
    afterEach(() => {
      sandbox.restore();
    });

    describe("isSVG", () => {
      it("is case insensitive", () => {
        expect(IconUtilities.isSVG("<svg></SVG>")).to.be.true;
        expect(IconUtilities.isSVG("<a></a>")).to.be.false;
      });
    });

    describe("fetchIcon", () => {
      it("returns svg string", () => {
        const responseBody = "<svg></svg>";
        const response = new Response(responseBody,
          {
            status: 200,
            headers: { 'Content-type': 'application/json' }
          });
        stub(window, "fetch").resolves(response);

        return IconUtilities.fetchIcon("").then(data => expect(data).to.equal(responseBody));
      });

      it("returns undefined if response is not svg", () => {
        const responseBody = "<error></error>";
        const response = new Response(responseBody,
          {
            status: 200,
            headers: { 'Content-type': 'application/json' }
          });
        stub(window, "fetch").resolves(response);

        return IconUtilities.fetchIcon("").then(data => expect(data).to.be.undefined);
      });
    });

    describe("sanitizeIcon", () => {
      it("removes wrapping p tags", () => {
        expect(IconUtilities.sanitizeIcon("<p>svg</p>")).to.equal("svg");
      });
    });
  });
});
