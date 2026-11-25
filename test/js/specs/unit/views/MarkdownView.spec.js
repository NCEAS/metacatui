// Load xss now so Mocha sees its filterXSS global before the tests run.
define(["views/MarkdownView", "xss"], (MarkdownView) => {
  const expect = chai.expect;

  describe("MarkdownView", () => {
    let view;
    let getConfig;

    beforeEach(() => {
      getConfig = sinon.stub(MetacatUI.appModel, "get").callThrough();
    });

    afterEach(() => {
      getConfig.restore();
      view?.remove();
    });

    it("embeds a trusted iframe with the configured permissions", async () => {
      const url = "https://trusted.example.org/report";
      view = new MarkdownView({
        markdown: `<iframe src="${url}" title="Report" width="640" height="480" allow="camera"></iframe>`,
      });

      getConfig
        .withArgs("trustedContentSources")
        .returns([
          { url, permissions: ["allow-scripts"], allow: ["fullscreen"] },
        ]);

      await new Promise((resolve) => {
        view.once("mdRendered", resolve);
        view.render();
      });

      const iframe = view.el.querySelector("iframe");
      expect(iframe).to.not.equal(null);
      expect(iframe.getAttribute("src")).to.equal(url);
      expect(iframe.getAttribute("title")).to.equal("Report");
      expect(iframe.getAttribute("width")).to.equal("640");
      expect(iframe.getAttribute("height")).to.equal("480");
      expect(iframe.getAttribute("sandbox")).to.equal("allow-scripts");
      expect(iframe.getAttribute("allow")).to.equal("fullscreen");
    });

    for (const [quoting, quote] of [
      ["single-quoted", "'"],
      ["double-quoted", '"'],
      ["unquoted", ""],
    ]) {
      it(`replaces an untrusted iframe with a link when src is ${quoting}`, async () => {
        const url = "https://unrelated.example/";
        view = new MarkdownView({
          markdown: `<iframe src=${quote}${url}${quote}></iframe>`,
        });

        await new Promise((resolve) => {
          view.once("mdRendered", resolve);
          view.render();
        });

        expect(view.el.querySelector("iframe")).to.equal(null);
        expect(view.el.querySelector("a")?.href).to.equal(url);
      });
    }
  });
});
