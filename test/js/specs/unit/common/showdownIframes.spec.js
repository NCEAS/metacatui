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
        globalThis.MetacatUI = originalMetacatUI;
      }
    });

    it("keeps the iframe title and applies the matching source's permissions", () => {
      const storyUrl = "https://storymaps.example.org/stories/approved";
      const otherUrl = "https://storymaps.example.org/stories/other";
      const getConfig = sinon.stub(MetacatUI.appModel, "get").callThrough();

      try {
        getConfig.withArgs("trustedContentSources").returns([
          {
            url: storyUrl,
            permissions: ["allow-scripts", "allow-same-origin", "allow-forms"],
            allow: ["fullscreen", "geolocation"],
          },
          otherUrl,
        ]);

        const converter = new showdown.Converter({
          extensions: ["xssfilter", "showdown-iframes"],
        });
        const output = document.createElement("template");
        output.innerHTML = converter.makeHtml(
          `<iframe src="${storyUrl}" title="Maps &amp; charts" allow="camera"></iframe>
<iframe src="${otherUrl}" allow="geolocation" allowfullscreen="allowfullscreen"></iframe>`,
        );

        const [story, other] = output.content.querySelectorAll("iframe");
        expect(story.getAttribute("title")).to.equal("Maps & charts");
        expect(story.getAttribute("allow")).to.equal("fullscreen; geolocation");
        expect(story.getAttribute("sandbox")).to.equal(
          "allow-scripts allow-same-origin allow-forms",
        );
        expect(other.hasAttribute("allow")).to.be.false;
        expect(other.hasAttribute("allowfullscreen")).to.be.false;
      } finally {
        getConfig.restore();
      }
    });
  });
});
