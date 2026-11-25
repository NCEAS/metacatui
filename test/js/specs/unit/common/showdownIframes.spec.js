define(["showdown", "showdownXssFilter", "showdownIframes"], (
  showdown,
  sanitizeHTML,
) => {
  const expect = chai.expect;

  describe("showdown-iframes", () => {
    let originalMetacatUI;
    let getConfig;

    beforeEach(() => {
      originalMetacatUI = globalThis.MetacatUI;
      getConfig = sinon.stub();
      globalThis.MetacatUI = { appModel: { get: getConfig } };
    });

    afterEach(() => {
      globalThis.MetacatUI = originalMetacatUI;
    });

    it("escapes trusted and untrusted iframes in general HTML and the default XSS extension", () => {
      const url = "https://trusted.example.org/report";
      getConfig.withArgs("trustedContentSources").returns([url]);
      const html = `<strong>Layer description</strong><iframe src="${url}"></iframe><iframe src="https://unrelated.example/"></iframe>`;
      const converter = new showdown.Converter({ extensions: ["xssfilter"] });

      for (const sanitized of [sanitizeHTML(html), converter.makeHtml(html)]) {
        const output = document.createElement("template");
        output.innerHTML = sanitized;

        expect(output.content.querySelector("iframe")).to.equal(null);
        expect(output.content.querySelector("strong")?.textContent).to.equal(
          "Layer description",
        );
      }
    });

    it("links to an untrusted URL instead of creating an iframe when an HTML entity changes its host", () => {
      getConfig
        .withArgs("trustedContentSources")
        .returns(["https://trusted.example.org/reports/*"]);
      const converter = new showdown.Converter({
        extensions: ["xssfilter-with-iframes", "showdown-iframes"],
      });
      const output = document.createElement("template");
      output.innerHTML = converter.makeHtml(
        '<iframe src="https://unrelated.example&sol;@trusted.example.org/reports/report"></iframe>',
      );

      expect(output.content.querySelector("iframe")).to.equal(null);
      expect(output.content.querySelector("a")?.getAttribute("href")).to.equal(
        "https://unrelated.example/@trusted.example.org/reports/report",
      );
    });

    it("keeps the iframe title and applies the matching source's permissions", () => {
      const storyUrl = "https://storymaps.example.org/stories/approved";
      const otherUrl = "https://storymaps.example.org/stories/other";
      getConfig.withArgs("trustedContentSources").returns([
        {
          url: storyUrl,
          permissions: ["allow-scripts", "allow-same-origin", "allow-forms"],
          allow: ["fullscreen", "geolocation"],
        },
        otherUrl,
      ]);

      const converter = new showdown.Converter({
        extensions: ["xssfilter-with-iframes", "showdown-iframes"],
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
    });
  });
});
