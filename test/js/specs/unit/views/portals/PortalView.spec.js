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
        renderMap,
        sandbox,
        view,
      };
    }, beforeEach);

    afterEach(() => {
      state.view.subviews.forEach((subview) => {
        subview.onClose();
        subview.remove();
      });
      state.view.remove();
      document.body.classList.remove(
        "portal-panels-map-active",
        "portal-map-active",
      );
      state.sandbox.restore();
    });

    it("routes a Cesium section and renders its map only on first activation", () => {
      const section = new PortalVizSectionModel({
        label: "Map",
        visualizationType: "cesium",
      });

      state.view.addSection(section);

      const sectionView = state.view.subviews[0];
      expect(state.renderMap.called).to.equal(false);

      state.view.switchSection(sectionView);
      state.view.switchSection(sectionView);

      expect(state.renderMap.calledOnce).to.equal(true);
    });

    [null, undefined].forEach((layout) => {
      it(`sets the default-layout map class (not the panels one) when layout is ${layout}`, () => {
        state.view.model.set("layout", layout);
        state.view.addSection(
          new PortalVizSectionModel({
            label: "Map",
            visualizationType: "cesium",
          }),
        );

        state.view.switchSection(state.view.subviews[0]);

        expect(
          document.body.classList.contains("portal-map-active"),
        ).to.equal(true);
        expect(
          document.body.classList.contains("portal-panels-map-active"),
        ).to.equal(false);
      });
    });

    it("swaps the panels map class for the default-layout one when switching layouts", () => {
      state.view.model.set("layout", "panels");
      state.view.addSection(
        new PortalVizSectionModel({
          label: "Map",
          visualizationType: "cesium",
        }),
      );
      const sectionView = state.view.subviews[0];

      state.view.switchSection(sectionView);
      expect(
        document.body.classList.contains("portal-panels-map-active"),
      ).to.equal(true);

      state.view.model.set("layout", null);
      state.view.switchSection(sectionView);
      expect(
        document.body.classList.contains("portal-panels-map-active"),
      ).to.equal(false);
      expect(
        document.body.classList.contains("portal-map-active"),
      ).to.equal(true);
    });
  });
});
