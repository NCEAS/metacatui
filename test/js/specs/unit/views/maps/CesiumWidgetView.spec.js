define([
  "views/maps/CesiumWidgetView",
  "collections/maps/MapAssets",
  "collections/maps/AssetCategories",
  "cesium",
  "/test/js/specs/shared/clean-state.js",
  "common/SearchParams",
], (
  CesiumWidgetView,
  MapAssets,
  AssetCategories,
  Cesium,
  cleanState,
  SearchParams,
) => {
  const expect = chai.expect;
  const spy = sinon.spy();

  describe("CesiumWidgetView Test Suite", () => {
    const state = cleanState(() => {
      SearchParams.clearSavedView();

      const view = new CesiumWidgetView();

      return { view: new CesiumWidgetView() };
    }, beforeEach);

    afterEach(() => {
      SearchParams.clearSavedView();
      spy.resetHistory();
    });

    describe("Initialization", () => {
      it("creates a CesiumWidgetView instance", () => {
        state.view.should.be.instanceof(CesiumWidgetView);
      });
    });

    describe("render", () => {
      it("adds layers in reverse orders", () => {
        state.view.model.set(
          "layers",
          new MapAssets([{ label: "layer 1" }, { label: "layer 2" }]),
        );
        state.view.addAsset = spy;

        state.view.render();

        expect(spy.callCount).to.equal(2);
        expect(spy.args[0][0].get("label")).to.equal("layer 2");
        expect(spy.args[1][0].get("label")).to.equal("layer 1");
      });

      it("adds layers within each layer category in reverse orders", () => {
        state.view.model.set(
          "layerCategories",
          new AssetCategories([
            { layers: [{ label: "layer 1" }, { label: "layer 2" }] },
            { layers: [{ label: "layer 3" }] },
          ]),
        );
        state.view.addAsset = spy;

        state.view.render();

        expect(spy.callCount).to.equal(3);
        expect(spy.args[0][0].get("label")).to.equal("layer 2");
        expect(spy.args[1][0].get("label")).to.equal("layer 1");
        expect(spy.args[2][0].get("label")).to.equal("layer 3");
      });

      const createImageryLayer = (type) => {
        return {
          label: `layer ${type}`,
          type,
          cesiumOptions: {
            url: "https://example.com",
          },
        };
      };

      it("sorts imagery by the order of layers in map", () => {
        const layer1 = createImageryLayer("OpenStreetMapImageryProvider");
        const layer2 = createImageryLayer("WebMapServiceImageryProvider");
        state.view.model.set("layers", new MapAssets([layer1, layer2]));

        state.view.render();

        expect(state.view.scene.imageryLayers.length).to.equal(2);
        state.view.scene.imageryLayers
          .get(1)
          .imageryProvider.should.be.instanceof(
            Cesium.OpenStreetMapImageryProvider,
          );
        state.view.scene.imageryLayers
          .get(0)
          .imageryProvider.should.be.instanceof(
            Cesium.WebMapServiceImageryProvider,
          );
      });

      it("sorts imagery by the order of layer categories in map", () => {
        const layer1 = createImageryLayer("OpenStreetMapImageryProvider");
        const layer2 = createImageryLayer("WebMapServiceImageryProvider");
        const layer3 = createImageryLayer("WebMapTileServiceImageryProvider");
        state.view.model.set(
          "layerCategories",
          new AssetCategories([
            { layers: [layer1, layer2] },
            { layers: [layer3] },
          ]),
        );

        state.view.render();

        expect(state.view.scene.imageryLayers.length).to.equal(3);
        state.view.scene.imageryLayers
          .get(2)
          .imageryProvider.should.be.instanceof(
            Cesium.OpenStreetMapImageryProvider,
          );
        state.view.scene.imageryLayers
          .get(1)
          .imageryProvider.should.be.instanceof(
            Cesium.WebMapServiceImageryProvider,
          );
        state.view.scene.imageryLayers
          .get(0)
          .imageryProvider.should.be.instanceof(
            Cesium.WebMapTileServiceImageryProvider,
          );
      });

      it("uses base color from model if applicable", () => {
        state.view.model.set("globeBaseColor", "red");

        state.view.render();

        expect(state.view.scene.globe.baseColor).to.deep.equal(
          new Cesium.Color(
            /* red= */ 1,
            /* green= */ 0,
            /* blue= */ 0,
            /* alpha= */ 1,
          ),
        );
      });

      it("flies to the destination in the URL if present", () => {
        SearchParams.updateDestination({
          latitude: 45,
          longitude: 135,
          height: 9999,
        });
        state.view.model.set("showShareUrl", true);

        state.view.render();

        expect(state.view.zoomTarget).to.deep.equal({
          latitude: 45,
          longitude: 135,
          height: 9999,
        });
      });

      it("flies to the home destination if showShareUrl feature is off", () => {
        SearchParams.updateDestination({
          latitude: 45,
          longitude: 135,
          height: 9999,
        });
        state.view.model.set("showShareUrl", false);

        state.view.render();

        expect(state.view.zoomTarget).to.deep.equal({
          latitude: 56,
          longitude: -65,
          height: 10000000,
          heading: 1,
          roll: 0,
          pitch: -90,
        });
      });

      it("flies to the home destination", () => {
        state.view.model.set("showShareUrl", true);

        state.view.render();

        expect(state.view.zoomTarget).to.deep.equal({
          latitude: 56,
          longitude: -65,
          height: 10000000,
          heading: 1,
          roll: 0,
          pitch: -90,
        });
      });

      it("updates the search parameters", async () => {
        state.view.model.set("showShareUrl", true);
        const assetCategories = new AssetCategories([
          { layers: [{ label: "layer 1" }, { label: "layer 2" }] },
          { layers: [{ label: "layer 3" }] },
        ]);
        state.view.model.set("allLayers", assetCategories.getMapAssetsFlat());

        state.view.render();
        state.view.scene.camera.position = new Cesium.Cartesian3(1, 2, 3);
        state.view.updateSearchParams();

        expect(SearchParams.getDestination()).to.deep.equal({
          heading: 152.70043883509962,
          height: -6364361.246505877,
          latitude: 53.48500010847735,
          longitude: 63.43494882292201,
          pitch: -3.4509114285277382,
          roll: 340.4941155938977,
        });
      });
    });
  });
});
