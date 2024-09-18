define(["common/IconUtilities"], (IconUtilities) => {
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
        const response = new Response(responseBody, {
          status: 200,
          headers: { "Content-type": "application/json" },
        });
        stub(window, "fetch").resolves(response);

        return IconUtilities.fetchIcon("").then((data) =>
          expect(data).to.equal(responseBody),
        );
      });

      it("returns undefined if response is not svg", () => {
        const responseBody = "<error></error>";
        const response = new Response(responseBody, {
          status: 200,
          headers: { "Content-type": "application/json" },
        });
        stub(window, "fetch").resolves(response);

        return IconUtilities.fetchIcon("").then(
          (data) => expect(data).to.be.undefined,
        );
      });
    });

    describe("sanitizeIcon", () => {
      it("removes wrapping p tags", () => {
        expect(IconUtilities.sanitizeIcon("<p>svg</p>")).to.equal("svg");
      });
    });

    describe("formatSvgForCesiumBillboard", () => {
      it("returns null if svgElement is null", () => {
        expect(IconUtilities.formatSvgForCesiumBillboard(null)).to.be.null;
      });

      it("returns svgElement with stroke properties", () => {
        const svgString = "<svg></svg>";
        const svgElement = document.createElement("svg");
        const formattedSvgElement = IconUtilities.formatSvgForCesiumBillboard(
          svgString,
          1,
          "black",
        );
        expect(formattedSvgElement.getAttribute("stroke-width")).to.equal("1");
        expect(formattedSvgElement.getAttribute("stroke")).to.equal("black");
      });

      it("returns svgElement with viewBox adjusted", () => {
        const svgString = "<svg viewBox='0 0 100 100'></svg>";
        const svgElement = document.createElement("svg");
        const formattedSvgElement = IconUtilities.formatSvgForCesiumBillboard(
          svgString,
          1,
          "black",
        );
        expect(formattedSvgElement.getAttribute("viewBox")).to.equal(
          "-1 -1 102 102",
        );
      });
    });

    describe("parseSvg", () => {
      it("returns svg element", () => {
        const svgString = "<svg></svg>";
        const svgElement = IconUtilities.parseSvg(svgString);
        expect(svgElement.tagName).to.equal("svg");
      });
    });

    describe("removeCommentNodes", () => {
      it("removes comment nodes", () => {
        const svgElement = document.createElement("svg");
        svgElement.appendChild(document.createComment("comment"));
        IconUtilities.removeCommentNodes(svgElement);
        expect(svgElement.childNodes.length).to.equal(0);
      });
    });

    describe("setStrokeProperties", () => {
      it("sets stroke properties", () => {
        const svgElement = document.createElement("svg");
        IconUtilities.setStrokeProperties(svgElement, 1, "black");
        expect(svgElement.getAttribute("stroke-width")).to.equal("1");
        expect(svgElement.getAttribute("stroke")).to.equal("black");
      });
    });

    describe("adjustViewBox", () => {
      it("adjusts viewBox", () => {
        const svgElement = document.createElement("svg");
        svgElement.setAttribute("viewBox", "0 0 100 100");
        console.log(svgElement);
        console.log(svgElement.getAttribute("viewBox"));
        console.log(
          svgElement.getAttribute("viewBox").split(" ").map(parseFloat),
        );
        IconUtilities.adjustViewBox(svgElement, 1);
        expect(svgElement.getAttribute("viewBox")).to.equal("-1 -1 102 102");
      });
    });

    describe("svgToBase64", () => {
      it("returns base64 encoded svg string", () => {
        const svgElement = document.createElement("svg");
        const base64 = IconUtilities.svgToBase64(svgElement);
        expect(base64).to.equal("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=");
      });
    });
  });
});
