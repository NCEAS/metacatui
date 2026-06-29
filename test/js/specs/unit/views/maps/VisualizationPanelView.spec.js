"use strict";

define([
  "views/maps/VisualizationPanelView",
  "common/TrustedContentUtilities",
  // The file extension is required for files loaded from the /test directory.
  "/test/js/specs/shared/clean-state.js",
], (VisualizationPanelView, trustedContent, cleanState) => {
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

  describe("VisualizationPanelView Test Suite", () => {
    // ------------------------------------------------------------------ //
    // Helpers shared across describe blocks
    // ------------------------------------------------------------------ //
    let originalMetacatUI;

    beforeEach(() => {
      originalMetacatUI = globalThis.MetacatUI;
    });

    afterEach(() => {
      globalThis.MetacatUI = originalMetacatUI;
    });

    // ------------------------------------------------------------------ //
    // Basic open / close
    // ------------------------------------------------------------------ //
    describe("open and close", () => {
      const TRUSTED_URL = "https://trusted.example.com/app";

      const state = cleanState(() => {
        globalThis.MetacatUI = makeMetacatUI([
          { url: "https://trusted.example.com/*" },
        ]);

        const view = new VisualizationPanelView();
        view.render();
        document.body.appendChild(view.el);

        return { view };
      }, beforeEach);

      afterEach(() => {
        state.view.remove();
      });

      it("creates a VisualizationPanelView instance", () => {
        expect(state.view).to.be.instanceof(VisualizationPanelView);
      });

      it("is closed by default after render", () => {
        expect(state.view.el.classList.contains("visualization-panel--open")).to
          .be.false;
      });

      it("adds the --open class when opened", () => {
        state.view.open(TRUSTED_URL);

        expect(state.view.el.classList.contains("visualization-panel--open")).to
          .be.true;
      });

      it("removes the --open class when closed", () => {
        state.view.open(TRUSTED_URL);
        state.view.close();

        expect(state.view.el.classList.contains("visualization-panel--open")).to
          .be.false;
      });

      it("clears the iframe src on close", () => {
        state.view.open(TRUSTED_URL);
        state.view.close();

        const iframe = state.view.el.querySelector(
          ".visualization-panel__iframe",
        );
        expect(iframe.getAttribute("src")).to.be.null;
      });

      it("fires a 'close' event when closed", () => {
        const closeSpy = sinon.spy();
        state.view.on("close", closeSpy);

        state.view.open(TRUSTED_URL);
        state.view.close();

        expect(closeSpy.callCount).to.equal(1);
      });
    });

    // ------------------------------------------------------------------ //
    // trustedContentSources gating
    // ------------------------------------------------------------------ //
    describe("trustedContentSources gating", () => {
      const TRUSTED_URL = "https://trusted.example.com/app";
      const UNTRUSTED_URL = "https://untrusted.example.com/app";

      const state = cleanState(() => {
        globalThis.MetacatUI = makeMetacatUI(["https://trusted.example.com/*"]);

        const view = new VisualizationPanelView();
        view.render();
        document.body.appendChild(view.el);

        return { view };
      }, beforeEach);

      afterEach(() => {
        state.view.remove();
      });

      it("shows the iframe and hides the fallback for a trusted URL", () => {
        state.view.open(TRUSTED_URL);

        const iframe = state.view.el.querySelector(
          ".visualization-panel__iframe",
        );
        const untrusted = state.view.el.querySelector(
          ".visualization-panel__untrusted",
        );
        expect(iframe.style.display).to.not.equal("none");
        expect(untrusted.style.display).to.equal("none");
      });

      it("sets the iframe src to the trusted URL", () => {
        state.view.open(TRUSTED_URL);

        const iframe = state.view.el.querySelector(
          ".visualization-panel__iframe",
        );
        expect(iframe.getAttribute("src")).to.include("trusted.example.com");
      });

      it("defaults the sandbox attribute to allow-scripts for a trusted URL", () => {
        state.view.open(TRUSTED_URL);

        const iframe = state.view.el.querySelector(
          ".visualization-panel__iframe",
        );
        expect(iframe.getAttribute("sandbox")).to.equal("allow-scripts");
      });

      it("applies explicit sandbox permissions from trustedContentSources", () => {
        globalThis.MetacatUI = makeMetacatUI([
          {
            url: "https://trusted.example.com/*",
            permissions: ["allow-scripts", "allow-same-origin"],
          },
        ]);

        state.view.open(TRUSTED_URL);

        const iframe = state.view.el.querySelector(
          ".visualization-panel__iframe",
        );
        expect(iframe.getAttribute("sandbox")).to.equal(
          "allow-scripts allow-same-origin",
        );
      });

      it("hides the iframe and shows the fallback for an untrusted URL", () => {
        globalThis.MetacatUI = makeMetacatUI([]);
        state.view.open(UNTRUSTED_URL);

        const iframe = state.view.el.querySelector(
          ".visualization-panel__iframe",
        );
        const untrusted = state.view.el.querySelector(
          ".visualization-panel__untrusted",
        );
        expect(iframe.style.display).to.equal("none");
        expect(untrusted.style.display).to.not.equal("none");
      });

      it("does not set an iframe src for an untrusted URL", () => {
        globalThis.MetacatUI = makeMetacatUI([]);
        state.view.open(UNTRUSTED_URL);

        const iframe = state.view.el.querySelector(
          ".visualization-panel__iframe",
        );
        expect(iframe.getAttribute("src")).to.be.null;
      });

      it("sets the fallback link href to the untrusted URL", () => {
        globalThis.MetacatUI = makeMetacatUI([]);
        state.view.open(UNTRUSTED_URL);

        const link = state.view.el.querySelector(
          ".visualization-panel__untrusted-link",
        );
        expect(link.getAttribute("href")).to.include("untrusted.example.com");
      });

      it("keeps a clickable fallback link for untrusted http(s) URLs", () => {
        globalThis.MetacatUI = makeMetacatUI([]);
        state.view.open("http://untrusted.example.com/app");

        const link = state.view.el.querySelector(
          ".visualization-panel__untrusted-link",
        );
        const message = state.view.el.querySelector(
          ".visualization-panel__untrusted-message",
        );

        expect(link.getAttribute("href")).to.equal(
          "http://untrusted.example.com/app",
        );
        expect(link.style.display).to.not.equal("none");
        expect(message.textContent).to.include("not in the list of trusted");
      });

      it("does not render a clickable fallback for unsafe protocols", () => {
        globalThis.MetacatUI = makeMetacatUI([]);
        state.view.open("javascript:alert(1)");

        const link = state.view.el.querySelector(
          ".visualization-panel__untrusted-link",
        );
        const message = state.view.el.querySelector(
          ".visualization-panel__untrusted-message",
        );

        expect(link.getAttribute("href")).to.be.null;
        expect(link.style.display).to.equal("none");
        expect(message.textContent).to.include("protocol is unsafe");
      });

      it("still opens the panel for an untrusted URL", () => {
        globalThis.MetacatUI = makeMetacatUI([]);
        state.view.open(UNTRUSTED_URL);

        expect(state.view.el.classList.contains("visualization-panel--open")).to
          .be.true;
      });
    });

    // ------------------------------------------------------------------ //
    // Escape-key close
    // ------------------------------------------------------------------ //
    describe("Escape key handling", () => {
      const TRUSTED_URL = "https://trusted.example.com/app";

      const state = cleanState(() => {
        globalThis.MetacatUI = makeMetacatUI(["https://trusted.example.com/*"]);

        const view = new VisualizationPanelView();
        view.render();
        document.body.appendChild(view.el);

        return { view };
      }, beforeEach);

      afterEach(() => {
        // Ensure the listener is always cleaned up even if a test fails.
        state.view.close();
        state.view.remove();
      });

      it("closes the panel when Escape is pressed while open", () => {
        state.view.open(TRUSTED_URL);

        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

        expect(state.view.el.classList.contains("visualization-panel--open")).to
          .be.false;
      });

      it("fires a close event when closed via Escape", () => {
        const closeSpy = sinon.spy();
        state.view.on("close", closeSpy);

        state.view.open(TRUSTED_URL);
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

        expect(closeSpy.callCount).to.equal(1);
      });

      it("does not fire a second close event when Escape is pressed after close", () => {
        const closeSpy = sinon.spy();
        state.view.on("close", closeSpy);

        state.view.open(TRUSTED_URL);
        state.view.close(); // removes the listener
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

        expect(closeSpy.callCount).to.equal(1);
      });
    });
  });
});
