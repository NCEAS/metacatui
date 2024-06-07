define(["views/maps/MapView", "models/maps/Map"], (MapView, MapAsset) => {
  const expect = chai.expect;

  describe("MapView Test Suite", () => {
    describe("Initialization", () => {
      it("creates a MapView instance", () => {
        const view = new MapView();
        expect(view).to.be.instanceof(MapView);
      });
    });

    describe("Portal map", () => {
      it("has an additional portal indicator class", () => {
        const nonPortalMap = new MapView();
        // Required for iFrame to not break in FeatureInfoView.
        document.body.appendChild(nonPortalMap.el);
        nonPortalMap.render();
        expect(nonPortalMap.$el.hasClass("map-view__portal")).to.be.false;

        const portalMap = new MapView({ isPortalMap: true });
        // Required for iFrame to not break in FeatureInfoView.
        document.body.appendChild(portalMap.el);
        portalMap.render();
        expect(portalMap.$el.hasClass("map-view__portal")).to.be.true;
      });
    });
  });
});
