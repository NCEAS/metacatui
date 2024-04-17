define([
  "views/maps/MapView",
  'models/maps/Map',
], (MapView, MapAsset) => {
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
        nonPortalMap.render();
        expect(nonPortalMap.$el.hasClass(nonPortalMap.classes.portalIndicator)).to.be.false;
        
        const portalMap = new MapView({ isPortalMap: true });
        portalMap.render();
        expect(portalMap.$el.hasClass(portalMap.classes.portalIndicator)).to.be.true;
      });
    });
  });
});
