define([
  "backbone",
  "models/portals/PortalVizSectionModel",
  "views/portals/PortalView",
  "views/portals/PortalVisualizationsView",
  "/test/js/specs/shared/clean-state.js",
], (
  Backbone,
  PortalVizSectionModel,
  PortalView,
  PortalVisualizationsView,
  cleanState,
) => {
  const expect = chai.expect;

  describe("PortalView Test Suite", () => {
    const state = cleanState(() => {
      const sandbox = sinon.createSandbox();
      const el = document.createElement("div");
      el.innerHTML = `
        <ul id="portal-section-tabs"></ul>
        <div id="portal-sections"></div>
      `;
      const view = new PortalView({
        el,
        model: new Backbone.Model({ layout: null }),
      });
      view.subviews = [];

      sandbox.stub(view, "updatePath");
      const renderMap = sandbox.stub(
        PortalVisualizationsView.prototype,
        "renderMap",
      );

      const footerView = MetacatUI.footerView;
      if (footerView) {
        sandbox.stub(footerView, "show");
        sandbox.stub(footerView, "hide");
      }

      return {
        bodyHeight: document.body.style.height,
        renderMap,
        sandbox,
        view,
      };
    }, beforeEach);

    afterEach(() => {
      state.view.subviews.forEach((subview) => subview.remove());
      state.view.remove();
      document.body.style.height = state.bodyHeight;
      state.sandbox.restore();
    });

    it("routes a Cesium section and renders its map only on first activation", () => {
      const section = new PortalVizSectionModel({
        label: "Map",
        visualizationType: "cesium",
      });

      state.view.addSection(section);

      const sectionView = state.view.subviews[0];
      expect(sectionView).to.be.instanceof(PortalVisualizationsView);
      expect(sectionView.model).to.equal(section);
      expect(state.renderMap.called).to.equal(false);

      state.view.switchSection(sectionView);
      state.view.switchSection(sectionView);

      expect(state.renderMap.calledOnce).to.equal(true);
    });
  });
});
