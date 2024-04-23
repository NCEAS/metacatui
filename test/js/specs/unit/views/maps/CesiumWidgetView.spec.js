define([
  "views/maps/CesiumWidgetView",
  "collections/maps/MapAssets",
  "models/maps/assets/MapAsset",
  "collections/maps/AssetCategories",
  "models/maps/assets/CesiumImagery",
  "cesium",
  "/test/js/specs/shared/clean-state.js",
], (CesiumWidgetView, MapAssets, MapAsset, AssetCategories, CesiumImagery, Cesium, cleanState) => {
  const expect = chai.expect;
  const spy = sinon.spy();

  describe("CesiumWidgetView Test Suite", () => {
    const state = cleanState(() => {
      const view = new CesiumWidgetView();

      return { view: new CesiumWidgetView() };
    }, beforeEach);

    afterEach(() => {
      spy.resetHistory();
    });

    describe("Initialization", () => {
      it("creates a CesiumWidgetView instance", () => {
        state.view.should.be.instanceof(CesiumWidgetView);
      });
    });

    describe("render", () => {
      it("adds layers in reverse orders", () => {
        state.view.model.set("layers", new MapAssets([
          { label: "layer 1" },
          { label: "layer 2" },
        ]));
        state.view.addAsset = spy;

        state.view.render();

        expect(spy.callCount).to.equal(2);
        expect(spy.args[0][0].get("label")).to.equal("layer 2");
        expect(spy.args[1][0].get("label")).to.equal("layer 1");
      });

      it("adds layers within each layer category in reverse orders", () => {
        state.view.model.set("layerCategories", new AssetCategories([
          { layers: [{ label: "layer 1" }, { label: "layer 2" }] },
          { layers: [{ label: "layer 3" }] },
        ]));
        state.view.addAsset = spy;

        state.view.render();

        expect(spy.callCount).to.equal(3);
        expect(spy.args[0][0].get("label")).to.equal("layer 2");
        expect(spy.args[1][0].get("label")).to.equal("layer 1");
        expect(spy.args[2][0].get("label")).to.equal("layer 3");
      });
      
      const createImageryLayer = (type) => {
        const layer = new CesiumImagery({ type });
        layer.set("status", "ready");
        layer.set("cesiumModel", new Cesium.ImageryLayer(Cesium[type], {}));
        return layer;
      };

      it("sorts imagery by the order of layers in map", () => {
        const layer1 = createImageryLayer("OpenStreetMapImageryProvider");
        const layer2 = createImageryLayer("WebMapServiceImageryProvider");
        state.view.model.set("layers", new MapAssets([layer1, layer2]));

        state.view.render();

        expect(state.view.scene.imageryLayers.length).to.equal(2);
        expect(state.view.scene.imageryLayers.get(1).imageryProvider).to.equal(Cesium.OpenStreetMapImageryProvider);
        expect(state.view.scene.imageryLayers.get(0).imageryProvider).to.equal(Cesium.WebMapServiceImageryProvider);
      });

      it("sorts imagery by the order of layer categories in map", () => {
        const layer1 = createImageryLayer("OpenStreetMapImageryProvider");
        const layer2 = createImageryLayer("WebMapServiceImageryProvider");
        const layer3 = createImageryLayer("WebMapTileServiceImageryProvider");
        state.view.model.set("layerCategories", new AssetCategories([
          { layers: [layer1, layer2] },
          { layers: [layer3] },
        ]));

        state.view.render();

        expect(state.view.scene.imageryLayers.length).to.equal(3);
        expect(state.view.scene.imageryLayers.get(2).imageryProvider).to.equal(Cesium.OpenStreetMapImageryProvider);
        expect(state.view.scene.imageryLayers.get(1).imageryProvider).to.equal(Cesium.WebMapServiceImageryProvider);
        expect(state.view.scene.imageryLayers.get(0).imageryProvider).to.equal(Cesium.WebMapTileServiceImageryProvider);
      });

      it("uses base color from model if applicable", () => {
        state.view.model.set("globeBaseColor", "red");

        state.view.render();

        expect(state.view.scene.globe.baseColor).to.deep.equal(
            new Cesium.Color(/* red= */ 1, /* green= */ 0, /* blue= */ 0, /* alpha= */ 1));
      });
    });
  });
});
