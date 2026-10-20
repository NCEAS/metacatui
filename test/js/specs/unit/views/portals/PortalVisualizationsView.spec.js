define([
  "jquery",
  "backbone",
  "models/portals/PortalVizSectionModel",
  "views/portals/PortalVisualizationsView",
  "/test/js/specs/shared/clean-state.js",
], (
  $,
  Backbone,
  PortalVizSectionModel,
  PortalVisualizationsView,
  cleanState,
) => {
  const expect = chai.expect;

  describe("PortalVisualizationsView Test Suite", () => {
    const state = cleanState(() => {
      const sandbox = sinon.createSandbox();
      const container = document.createElement("div");
      container.innerHTML = `
        <div class="section-links-container" style="height: 40px"></div>
        <div class="portal-sections"></div>
      `;
      document.body.append(container);
      const portalModel = new Backbone.Model({ layout: null });
      const view = new PortalVisualizationsView({
        model: new PortalVizSectionModel({ visualizationType: "cesium" }),
        portalModel,
      });
      container.querySelector(".portal-sections").append(view.el);
      view.$el.addClass("active");

      return { sandbox, container, portalModel, view };
    }, beforeEach);

    afterEach(() => {
      state.view.onClose();
      state.view.remove();
      state.container.remove();
      state.sandbox.restore();
    });

    it("does not set an inline height for a cesium map (sizing is CSS-only)", () => {
      state.view.adjustVizHeight();

      expect(state.view.el.style.height).to.equal("");
      expect(state.view.el.style.minHeight).to.equal("");
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
  });
});

