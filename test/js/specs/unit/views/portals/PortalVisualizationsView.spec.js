define([
  "jquery",
  "backbone",
  "views/portals/PortalVisualizationsView",
  "/test/js/specs/shared/clean-state.js",
], ($, Backbone, PortalVisualizationsView, cleanState) => {
  const expect = chai.expect;

  describe("PortalVisualizationsView Test Suite", () => {
    const state = cleanState(() => {
      const sandbox = sinon.createSandbox();
      const container = document.createElement("div");
      container.style.setProperty("--max-map-toolbar-link-height", "240px");
      container.innerHTML = `
        <div class="section-links-container" style="height: 40px"></div>
        <div class="portal-sections"></div>
      `;
      document.body.append(container);
      const portalModel = new Backbone.Model({ layout: null });
      const view = new PortalVisualizationsView({
        model: new Backbone.Model({ visualizationType: "cesium" }),
        portalModel,
      });
      container.querySelector(".portal-sections").append(view.el);
      view.$el.addClass("active");
      sandbox.stub(view.$el, "offset").returns({ top: 200, left: 0 });
      const outerHeight = $.fn.outerHeight;
      sandbox.stub($.fn, "outerHeight").callsFake(function (...args) {
        return this[0] === window
          ? state.viewportHeight
          : outerHeight.apply(this, args);
      });

      return { sandbox, container, portalModel, view, viewportHeight: 800 };
    }, beforeEach);

    afterEach(() => {
      state.view.onClose();
      state.view.remove();
      state.container.remove();
      state.sandbox.restore();
    });

    it("sizes a default map below the header and updates after a resize", () => {
      state.view.adjustVizHeight();
      expect(state.view.$el.height()).to.equal(600);

      state.viewportHeight = 600;
      state.view.adjustVizHeight();
      expect(state.view.$el.height()).to.equal(400);
    });

    it("reserves space for fixed mobile tabs", () => {
      state.container.querySelector(".section-links-container").style.position =
        "fixed";

      state.view.adjustVizHeight();

      expect(state.view.$el.height()).to.equal(560);
    });

    it("leaves a panels map's height unchanged", () => {
      state.portalModel.set("layout", "panels");
      state.view.$el.css("min-height", "300px");

      state.view.adjustVizHeight();

      expect(state.view.el.style.minHeight).to.equal("300px");
    });

    it("uses the default layout when no portal model is provided", () => {
      state.view.portalModel = null;

      state.view.adjustVizHeight();

      expect(state.view.$el.height()).to.equal(600);
    });

    it("keeps room for map controls when the header fills the viewport", () => {
      state.viewportHeight = 200;
      state.view.$el.offset.returns({ top: 300, left: 0 });

      state.view.adjustVizHeight();

      expect(state.view.$el.height()).to.equal(240);
    });

    it("shows an invalid map error without constructing a replacement map", () => {
      state.view.model.set({
        mapModel: null,
        mapConfigError: "The map configuration contains invalid JSON.",
      });

      state.view.renderMap();

      expect(state.view.$el.text()).to.contain("invalid JSON");
      expect(state.view.model.get("mapModel")).to.equal(null);
    });

    describe("iframe visualizations", () => {
      beforeEach(() => {
        state.view.model.set({
          label: "Permafrost Tour",
          visualizationType: "iframe",
          iframeUrl: "https:visualization.example/tour",
        });
        state.sandbox
          .stub(MetacatUI.appModel, "get")
          .callThrough()
          .withArgs("trustedContentSources")
          .returns([
            {
              url: "https://visualization.example",
              permissions: ["allow-scripts"],
            },
          ]);
        state.view.render();
      });

      it("opens a titled, sandboxed iframe on first activation", () => {
        expect(state.view.el.querySelector("iframe")).to.equal(null);

        state.view.postRender();
        const iframe = state.view.el.querySelector("iframe");
        expect(iframe.getAttribute("src")).to.equal(
          "https://visualization.example/tour",
        );
        expect(iframe.getAttribute("title")).to.equal("Permafrost Tour");
        expect(iframe.getAttribute("sandbox")).to.equal("allow-scripts");

        state.view.postRender();
        expect(state.view.el.querySelector("iframe")).to.equal(iframe);
      });

      it("accounts for fixed mobile tabs when resizing the iframe", () => {
        state.portalModel.set("layout", "panels");
        state.container.querySelector(
          ".section-links-container",
        ).style.position = "fixed";
        state.view.postRender();

        const iframe = state.view.el.querySelector("iframe");
        expect(iframe.style.height).to.equal("560px");

        state.viewportHeight = 600;
        $(window).trigger("resize");
        expect(iframe.style.height).to.equal("360px");

        state.viewportHeight = 200;
        $(window).trigger("resize");
        expect(iframe.style.height).to.equal("300px");
        expect(iframe.style.marginBottom).to.equal("40px");
      });

      it("shows a message without loading a URL outside the trusted sources", () => {
        state.view.model.set(
          "iframeUrl",
          "https://visualization.example.unapproved.test",
        );

        state.view.postRender();

        expect(state.view.el.querySelector("iframe")).to.equal(null);
        expect(state.view.el.querySelector(".alert")).to.exist;
      });
    });
  });
});
