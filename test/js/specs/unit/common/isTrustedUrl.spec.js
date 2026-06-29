"use strict";

define([
  "common/TrustedContentUtilities",
  // The file extension is required for files loaded from the /test directory.
  "/test/js/specs/shared/clean-state.js",
], (trustedContent, cleanState) => {
  const expect = chai.expect;

  /**
   * Build a minimal MetacatUI stub whose appModel returns the given
   * trustedContentSources array.
   * @param {Array.<string|{url: string, permissions?: string[]}>} sources
   * @returns {object}
   */
  function makeMetacatUI(sources) {
    return {
      appModel: {
        get(key) {
          return key === "trustedContentSources" ? sources : null;
        },
      },
    };
  }

  describe("isTrustedUrl", () => {
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
    // Empty / missing configuration
    // ------------------------------------------------------------------ //
    describe("when trustedContentSources is empty", () => {
      beforeEach(() => {
        globalThis.MetacatUI = makeMetacatUI([]);
      });

      it("returns false for any URL", () => {
        expect(trustedContent.isTrustedUrl("https://example.com")).to.be.false;
      });
    });

    describe("when MetacatUI is undefined", () => {
      beforeEach(() => {
        globalThis.MetacatUI = undefined;
      });

      it("returns false without throwing", () => {
        expect(() =>
          trustedContent.isTrustedUrl("https://example.com"),
        ).not.to.throw();
        expect(trustedContent.isTrustedUrl("https://example.com")).to.be.false;
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

      it("returns false for a non-URL string", () => {
        expect(trustedContent.isTrustedUrl("not a url")).to.be.false;
      });

      it("returns false for an empty string", () => {
        expect(trustedContent.isTrustedUrl("")).to.be.false;
      });

      it("returns false for a relative path", () => {
        expect(trustedContent.isTrustedUrl("/path/only")).to.be.false;
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
          { url: "*" },
        ]);
      });

      it("returns false for javascript: protocol", () => {
        expect(trustedContent.isTrustedUrl("javascript:alert(1)")).to.be.false;
      });

      it("returns false for data: protocol", () => {
        expect(trustedContent.isTrustedUrl("data:text/html,<h1>hi</h1>")).to.be
          .false;
      });

      it("returns false for file: protocol", () => {
        expect(trustedContent.isTrustedUrl("file:///etc/passwd")).to.be.false;
      });

      it("returns false for httpx: (startsWith bypass attempt)", () => {
        expect(trustedContent.isTrustedUrl("httpx://example.com/path")).to.be
          .false;
      });

      it("returns false for https-evil: scheme", () => {
        expect(trustedContent.isTrustedUrl("https-evil://example.com/")).to.be
          .false;
      });

      it("accepts http: URLs that match a pattern", () => {
        expect(trustedContent.isTrustedUrl("http://example.com/page")).to.be
          .true;
      });

      it("accepts https: URLs that match a pattern", () => {
        expect(trustedContent.isTrustedUrl("https://example.com/page")).to.be
          .true;
      });
    });

    // ------------------------------------------------------------------ //
    // Pattern matching — protocol-qualified patterns
    // ------------------------------------------------------------------ //
    describe("protocol-qualified patterns", () => {
      it("does not match https: URL against an http: pattern", () => {
        globalThis.MetacatUI = makeMetacatUI([{ url: "http://example.com/*" }]);
        expect(trustedContent.isTrustedUrl("https://example.com/page")).to.be
          .false;
      });

      it("does not match http: URL against an https: pattern", () => {
        globalThis.MetacatUI = makeMetacatUI([
          { url: "https://example.com/*" },
        ]);
        expect(trustedContent.isTrustedUrl("http://example.com/page")).to.be
          .false;
      });

      it("matches https: URL against an https: pattern", () => {
        globalThis.MetacatUI = makeMetacatUI([
          { url: "https://example.com/*" },
        ]);
        expect(trustedContent.isTrustedUrl("https://example.com/page")).to.be
          .true;
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
        expect(trustedContent.isTrustedUrl("https://trusted.example.com/app"))
          .to.be.true;
      });

      it("does not match a different subdomain", () => {
        expect(trustedContent.isTrustedUrl("https://evil.example.com/app")).to
          .be.false;
      });

      it("does not match a URL that merely contains the hostname", () => {
        expect(
          trustedContent.isTrustedUrl(
            "https://evil.com/trusted.example.com/app",
          ),
        ).to.be.false;
      });

      it("matches when the pattern has no trailing wildcard but URL matches exactly", () => {
        globalThis.MetacatUI = makeMetacatUI([
          { url: "https://exact.example.com/" },
        ]);
        expect(trustedContent.isTrustedUrl("https://exact.example.com/")).to.be
          .true;
      });

      it("does not match when the URL has extra path and pattern has no wildcard", () => {
        globalThis.MetacatUI = makeMetacatUI([
          { url: "https://exact.example.com/" },
        ]);
        expect(trustedContent.isTrustedUrl("https://exact.example.com/extra"))
          .to.be.false;
      });

      it("matches a subdomain wildcard pattern", () => {
        globalThis.MetacatUI = makeMetacatUI([
          { url: "https://*.streamlit.app/*" },
        ]);
        expect(trustedContent.isTrustedUrl("https://myapp.streamlit.app/")).to
          .be.true;
      });

      it("returns true when any one of multiple patterns matches", () => {
        globalThis.MetacatUI = makeMetacatUI([
          { url: "https://a.example.com/*" },
          { url: "https://b.example.com/*" },
        ]);
        expect(trustedContent.isTrustedUrl("https://b.example.com/page")).to.be
          .true;
      });

      it("returns false when no pattern matches", () => {
        globalThis.MetacatUI = makeMetacatUI([
          { url: "https://a.example.com/*" },
          { url: "https://b.example.com/*" },
        ]);
        expect(trustedContent.isTrustedUrl("https://c.example.com/page")).to.be
          .false;
      });
    });

    // ------------------------------------------------------------------ //
    // sandbox permissions resolution
    // ------------------------------------------------------------------ //
    describe("sandbox permissions resolution", () => {
      it("defaults to allow-scripts for trusted sources without permissions", () => {
        globalThis.MetacatUI = makeMetacatUI([
          { url: "https://trusted.example.com/*" },
        ]);

        expect(
          trustedContent.getTrustedIframeSandbox(
            "https://trusted.example.com/app",
          ),
        ).to.equal("allow-scripts");
      });

      it("joins explicit permissions for trusted sources", () => {
        globalThis.MetacatUI = makeMetacatUI([
          {
            url: "https://trusted.example.com/*",
            permissions: ["allow-scripts", "allow-same-origin"],
          },
        ]);

        expect(
          trustedContent.getTrustedIframeSandbox(
            "https://trusted.example.com/app",
          ),
        ).to.equal("allow-scripts allow-same-origin");
      });
    });
  });
});
