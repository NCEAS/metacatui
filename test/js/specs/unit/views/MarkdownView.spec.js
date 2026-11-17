// Load xss now so Mocha sees its filterXSS global before the tests run.
define(["views/MarkdownView", "xss"], (MarkdownView) => {
  const expect = chai.expect;

  describe("MarkdownView", () => {
    it("prevents creating an iframe and instead links to an untrusted URL when src is single-quoted", async () => {
      const url = "https://unrelated.example/";
      const view = new MarkdownView({
        markdown: `<iframe src='${url}'></iframe>`,
      });

      try {
        await new Promise((resolve) => {
          view.once("mdRendered", resolve);
          view.render();
        });

        expect(view.el.querySelector("iframe")).to.equal(null);
        expect(view.el.querySelector("a")?.getAttribute("href")).to.equal(url);
      } finally {
        view.remove();
      }
    });
  });
});
