define(["showdown", "showdownXssFilter", "showdownIframes"], (showdown) => {
  const expect = chai.expect;

  describe("showdown-iframes", () => {
    it("links to an untrusted URL instead of creating an iframe when an HTML entity changes its host", () => {
      const originalMetacatUI = globalThis.MetacatUI;
      globalThis.MetacatUI = {
        appModel: {
          get: (key) =>
            key === "trustedContentSources"
              ? ["https://trusted.example.org/reports/*"]
              : undefined,
        },
      };

      try {
        const converter = new showdown.Converter({
          extensions: ["xssfilter", "showdown-iframes"],
        });
        const output = document.createElement("template");
        output.innerHTML = converter.makeHtml(
          '<iframe src="https://unrelated.example&sol;@trusted.example.org/reports/report"></iframe>',
        );

        expect(output.content.querySelector("iframe")).to.equal(null);
        expect(
          output.content.querySelector("a")?.getAttribute("href"),
        ).to.equal(
          "https://unrelated.example/@trusted.example.org/reports/report",
        );
      } finally {
        MetacatUI.appModel = originalAppModel;
      }
    });
  });
});
