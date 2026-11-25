"use strict";

define(["common/TrustedContentUtilities"], (trustedContent) => {
  const expect = chai.expect;

  /**
   * Build a MetacatUI stub with trusted sources and optional sandbox defaults.
   * @param {Array<string|object>} sources Trusted source rules
   * @param {string[]|null} [defaultIframePermissions=null] Default sandbox permissions
   * @returns {object} MetacatUI stub
   */
  function makeMetacatUI(sources, defaultIframePermissions = null) {
    return {
      appModel: {
        get(key) {
          if (key === "defaultIframePermissions") {
            return defaultIframePermissions;
          }

          return key === "trustedContentSources" ? sources : null;
        },
      },
    };
  }

  describe("TrustedContentUtilities", () => {
    let originalMetacatUI;

    beforeEach(() => {
      originalMetacatUI = globalThis.MetacatUI;
    });

    afterEach(() => {
      globalThis.MetacatUI = originalMetacatUI;
    });

    // ------------------------------------------------------------------ //
    // URL protocol helper
    // ------------------------------------------------------------------ //
    describe("isHttpUrl", () => {
      it("returns true for https URLs", () => {
        expect(trustedContent.isHttpUrl("https://example.com/path")).to.be.true;
      });

      it("returns true for http URLs", () => {
        expect(trustedContent.isHttpUrl("http://example.com/path")).to.be.true;
      });

      it("returns false for non-http protocols", () => {
        expect(trustedContent.isHttpUrl("javascript:alert(1)")).to.be.false;
        expect(trustedContent.isHttpUrl("data:text/html,<h1>hi</h1>")).to.be
          .false;
      });

      it("returns false for invalid URLs", () => {
        expect(trustedContent.isHttpUrl("not a url")).to.be.false;
      });
    });

    // ------------------------------------------------------------------ //
    // Empty or missing config
    // ------------------------------------------------------------------ //
    describe("when trustedContentSources is empty", () => {
      beforeEach(() => {
        globalThis.MetacatUI = makeMetacatUI([]);
      });

      it("returns null for any URL", () => {
        expect(
          trustedContent.getTrustedContentSource("https://example.com"),
        ).to.equal(null);
      });
    });

    describe("when MetacatUI is undefined", () => {
      beforeEach(() => {
        globalThis.MetacatUI = undefined;
      });

      it("returns null without throwing", () => {
        expect(() =>
          trustedContent.getTrustedContentSource("https://example.com"),
        ).not.to.throw();
        expect(
          trustedContent.getTrustedContentSource("https://example.com"),
        ).to.equal(null);
      });
    });

    // ------------------------------------------------------------------ //
    // URL validity
    // ------------------------------------------------------------------ //
    describe("URL validity", () => {
      beforeEach(() => {
        globalThis.MetacatUI = makeMetacatUI([
          { url: "https://example.com/*" },
        ]);
      });

      it("returns null for a non-URL string", () => {
        expect(trustedContent.getTrustedContentSource("not a url")).to.equal(
          null,
        );
      });

      it("returns null for an empty string", () => {
        expect(trustedContent.getTrustedContentSource("")).to.equal(null);
      });

      it("returns null for a relative path", () => {
        expect(trustedContent.getTrustedContentSource("/path/only")).to.equal(
          null,
        );
      });
    });

    // ------------------------------------------------------------------ //
    // Protocol enforcement
    // ------------------------------------------------------------------ //
    describe("protocol enforcement", () => {
      beforeEach(() => {
        globalThis.MetacatUI = makeMetacatUI([
          { url: "https://example.com/*" },
          { url: "http://example.com/*" },
        ]);
      });

      it("returns null for javascript: protocol", () => {
        expect(
          trustedContent.getTrustedContentSource("javascript:alert(1)"),
        ).to.equal(null);
      });

      it("returns null for data: protocol", () => {
        expect(
          trustedContent.getTrustedContentSource("data:text/html,<h1>hi</h1>"),
        ).to.equal(null);
      });

      it("returns null for file: protocol", () => {
        expect(
          trustedContent.getTrustedContentSource("file:///etc/passwd"),
        ).to.equal(null);
      });

      it("rejects the httpx scheme", () => {
        expect(
          trustedContent.getTrustedContentSource("httpx://example.com/path"),
        ).to.equal(null);
      });

      it("rejects the https-evil scheme", () => {
        expect(
          trustedContent.getTrustedContentSource("https-evil://example.com/"),
        ).to.equal(null);
      });

      it("accepts http: URLs that match a pattern", () => {
        expect(
          trustedContent.getTrustedContentSource("http://example.com/page"),
        ).to.have.property("url", "http://example.com/*");
      });

      it("accepts https: URLs that match a pattern", () => {
        expect(
          trustedContent.getTrustedContentSource("https://example.com/page"),
        ).to.have.property("url", "https://example.com/*");
      });
    });

    // ------------------------------------------------------------------ //
    // Pattern matching with an explicit protocol
    // ------------------------------------------------------------------ //
    describe("protocol-qualified patterns", () => {
      it("does not match https: URL against an http: pattern", () => {
        globalThis.MetacatUI = makeMetacatUI([{ url: "http://example.com/*" }]);
        expect(
          trustedContent.getTrustedContentSource("https://example.com/page"),
        ).to.equal(null);
      });

      it("does not match http: URL against an https: pattern", () => {
        globalThis.MetacatUI = makeMetacatUI([
          { url: "https://example.com/*" },
        ]);
        expect(
          trustedContent.getTrustedContentSource("http://example.com/page"),
        ).to.equal(null);
      });

      it("matches https: URL against an https: pattern", () => {
        globalThis.MetacatUI = makeMetacatUI([
          { url: "https://example.com/*" },
        ]);
        expect(
          trustedContent.getTrustedContentSource("https://example.com/page"),
        ).to.have.property("url", "https://example.com/*");
      });
    });

    // ------------------------------------------------------------------ //
    // Wildcard pattern matching
    // ------------------------------------------------------------------ //
    describe("wildcard pattern matching", () => {
      beforeEach(() => {
        globalThis.MetacatUI = makeMetacatUI([
          { url: "https://trusted.example.com/*" },
        ]);
      });

      it("matches a URL on the exact host with a path", () => {
        expect(
          trustedContent.getTrustedContentSource(
            "https://trusted.example.com/app",
          ),
        ).to.have.property("url", "https://trusted.example.com/*");
      });

      it("does not match a different subdomain", () => {
        expect(
          trustedContent.getTrustedContentSource(
            "https://evil.example.com/app",
          ),
        ).to.equal(null);
      });

      it("does not match a URL that merely contains the hostname", () => {
        expect(
          trustedContent.getTrustedContentSource(
            "https://evil.com/trusted.example.com/app",
          ),
        ).to.equal(null);
      });

      it("matches when the pattern has no trailing wildcard but URL matches exactly", () => {
        globalThis.MetacatUI = makeMetacatUI([
          { url: "https://exact.example.com/" },
        ]);
        expect(
          trustedContent.getTrustedContentSource("https://exact.example.com/"),
        ).to.have.property("url", "https://exact.example.com/");
      });

      it("does not match when the URL has extra path and pattern has no wildcard", () => {
        globalThis.MetacatUI = makeMetacatUI([
          { url: "https://exact.example.com/" },
        ]);
        expect(
          trustedContent.getTrustedContentSource(
            "https://exact.example.com/extra",
          ),
        ).to.equal(null);
      });

      it("matches a subdomain wildcard pattern", () => {
        globalThis.MetacatUI = makeMetacatUI([
          { url: "https://*.streamlit.app/*" },
        ]);
        expect(
          trustedContent.getTrustedContentSource(
            "https://myapp.streamlit.app/",
          ),
        ).to.have.property("url", "https://*.streamlit.app/*");
      });

      it("rejects URLs with a trusted subdomain only in the path, query, or fragment", () => {
        globalThis.MetacatUI = makeMetacatUI(["https://*.dataone.org/*"]);

        const urls = [
          "https://unrelated.example/reports/search.dataone.org/page",
          "https://unrelated.example/?next=https://search.dataone.org/page",
          "https://unrelated.example/#https://search.dataone.org/page",
        ];
        urls.forEach((url) => {
          expect(trustedContent.getTrustedContentSource(url), url).to.equal(
            null,
          );
        });
      });

      it("returns the source that matches the URL", () => {
        globalThis.MetacatUI = makeMetacatUI([
          { url: "https://a.example.com/*" },
          { url: "https://b.example.com/*" },
        ]);
        expect(
          trustedContent.getTrustedContentSource("https://b.example.com/page"),
        ).to.have.property("url", "https://b.example.com/*");
      });

      it("returns null when no pattern matches", () => {
        globalThis.MetacatUI = makeMetacatUI([
          { url: "https://a.example.com/*" },
          { url: "https://b.example.com/*" },
        ]);
        expect(
          trustedContent.getTrustedContentSource("https://c.example.com/page"),
        ).to.equal(null);
      });

      it("rejects rules without an origin or with misplaced host wildcards", () => {
        for (const pattern of [
          "*",
          "https://*example.com",
          "https://example.com*",
        ]) {
          globalThis.MetacatUI = makeMetacatUI([pattern]);
          expect(
            trustedContent.getTrustedContentSource("https://example.com/"),
            pattern,
          ).to.equal(null);
        }
      });
    });

    describe("configureTrustedIframe", () => {
      it("applies the default sandbox permissions to a trusted iframe", () => {
        globalThis.MetacatUI = makeMetacatUI([
          { url: "https://trusted.example.com/*" },
        ]);
        const iframe = document.createElement("iframe");

        expect(
          trustedContent.configureTrustedIframe(
            iframe,
            "https://trusted.example.com/app",
          ),
        ).to.be.true;
        expect(iframe.getAttribute("sandbox")).to.equal(
          "allow-scripts allow-same-origin",
        );
      });

      it("applies the matching source's sandbox permissions to the iframe", () => {
        globalThis.MetacatUI = makeMetacatUI([
          {
            url: "https://trusted.example.com/*",
            permissions: ["allow-scripts", "allow-forms"],
          },
        ]);
        const iframe = document.createElement("iframe");

        expect(
          trustedContent.configureTrustedIframe(
            iframe,
            "https://trusted.example.com/app",
          ),
        ).to.be.true;
        expect(iframe.getAttribute("sandbox")).to.equal(
          "allow-scripts allow-forms",
        );
      });

      it("applies the app's default sandbox permissions to the iframe", () => {
        globalThis.MetacatUI = makeMetacatUI(
          [{ url: "https://trusted.example.com/*" }],
          ["allow-scripts"],
        );
        const iframe = document.createElement("iframe");

        expect(
          trustedContent.configureTrustedIframe(
            iframe,
            "https://trusted.example.com/app",
          ),
        ).to.be.true;
        expect(iframe.getAttribute("sandbox")).to.equal("allow-scripts");
      });
    });
  });
});
