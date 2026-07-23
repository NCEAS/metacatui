define([
  "backbone",
  "models/maps/Map",
  "models/maps/AssetCategory",
  "collections/maps/AssetCategories",
  "collections/maps/MapAssets",
  "/test/js/specs/shared/clean-state.js",
  "common/SearchParams",
], (
  Backbone,
  Map,
  AssetCategory,
  AssetCategories,
  MapAssets,
  cleanState,
  SearchParams,
) => {
  const expect = chai.expect;

  describe("Map Test Suite", () => {
    const state = cleanState(() => {
      return { model: new Map() };
    }, beforeEach);

    beforeEach(() => {
      SearchParams.clearStateInUrl();
    });

    afterEach(() => {
      SearchParams.clearStateInUrl();
    });

    describe("Initialization", () => {
      it("creates an Map instance", () => {
        expect(state.model).to.be.instanceof(Map);
      });

      it("defaults debug to false", () => {
        expect(state.model.get("debug")).to.equal(false);
      });

      it("ignores layers if layerCategories exist", () => {
        const map = new Map({
          layerCategories: [{ layers: [{}] }],
          layers: [{}],
        });

        expect(map.has("layerCategories")).to.be.true;
        expect(map.has("layers")).to.be.false;
      });

      it("restores the URL destination when share URL syncing is enabled", () => {
        SearchParams.updateStateInUrl({
          destination: {
            latitude: 45,
            longitude: 135,
            height: 9999,
          },
        });

        const map = new Map({ showShareUrl: false });
        map.set("showShareUrl", true);

        expect(map.get("interactions").get("zoomTarget")).to.deep.equal({
          latitude: 45,
          longitude: 135,
          height: 9999,
        });
      });

      it("changes flat layer visibility based on search params", () => {
        SearchParams.updateStateInUrl({ enabledLayerIds: ["layer-2"] });
        const map = new Map({
          layers: [
            { layerId: "layer-1", visible: true },
            { layerId: "layer-2", visible: false },
          ],
        });

        expect(map.get("layers").at(0).get("visible")).to.be.false;
        expect(map.get("layers").at(1).get("visible")).to.be.true;
      });

      it("restores all layers as hidden when el is explicitly empty", () => {
        SearchParams.updateStateInUrl({ enabledLayerIds: [] });
        const map = new Map({
          layers: [
            { layerId: "layer-1", visible: true },
            { layerId: "layer-2", visible: true },
          ],
        });

        expect(map.get("layers").at(0).get("visible")).to.be.false;
        expect(map.get("layers").at(1).get("visible")).to.be.false;
      });

      it("preserves configured visibility for flat layers", () => {
        SearchParams.updateStateInUrl({ enabledLayerIds: ["layer-2"] });
        const map = new Map({
          layers: [
            { layerId: "layer-1", visible: true },
            { layerId: "layer-2", visible: false },
          ],
        });

        expect(map.get("layers").at(0).get("configuredVisibility")).to.be.true;
        expect(map.get("layers").at(1).get("configuredVisibility")).to.be.false;
      });

      it("changes categorized layer visibility based on search params", () => {
        SearchParams.updateStateInUrl({ enabledLayerIds: ["layer-2"] });
        const map = new Map({
          layerCategories: [
            {
              layers: [
                { layerId: "layer-1", visible: true },
                { layerId: "layer-2", visible: false },
              ],
            },
          ],
        });

        expect(map.getAllLayers()[0].get("visible")).to.be.false;
        expect(map.getAllLayers()[1].get("visible")).to.be.true;
      });

      it("defaults flat layers with undefined visibility to hidden", () => {
        const map = new Map({
          layers: [{ layerId: "layer-1" }, { layerId: "layer-2" }],
        });

        expect(map.get("layers").at(0).get("visible")).to.be.false;
        expect(map.get("layers").at(1).get("visible")).to.be.false;
      });

      it("defaults categorized layers with undefined visibility to hidden", () => {
        const map = new Map({
          layerCategories: [
            {
              layers: [{ layerId: "layer-1" }, { layerId: "layer-2" }],
            },
          ],
        });

        expect(map.getAllLayers()[0].get("visible")).to.be.false;
        expect(map.getAllLayers()[1].get("visible")).to.be.false;
      });

      it("uses configuredVisibility when visible is omitted for flat layers", () => {
        const map = new Map({
          layers: [
            { layerId: "layer-1", configuredVisibility: true },
            { layerId: "layer-2", configuredVisibility: false },
          ],
        });

        expect(map.get("layers").at(0).get("configuredVisibility")).to.be.true;
        expect(map.get("layers").at(0).get("visible")).to.be.true;
        expect(map.get("layers").at(1).get("configuredVisibility")).to.be.false;
        expect(map.get("layers").at(1).get("visible")).to.be.false;
      });

      it("uses configuredVisibility when visible is omitted for categorized layers", () => {
        const map = new Map({
          layerCategories: [
            {
              layers: [
                { layerId: "layer-1", configuredVisibility: true },
                { layerId: "layer-2", configuredVisibility: false },
              ],
            },
          ],
        });

        expect(map.getAllLayers()[0].get("configuredVisibility")).to.be.true;
        expect(map.getAllLayers()[0].get("visible")).to.be.true;
        expect(map.getAllLayers()[1].get("configuredVisibility")).to.be.false;
        expect(map.getAllLayers()[1].get("visible")).to.be.false;
      });

      it("preserves configuredVisibility on model instance layers", () => {
        const layerModel = new Backbone.Model({
          layerId: "layer-1",
          visible: true,
          configuredVisibility: false,
        });
        const map = new Map({ layers: [layerModel] });

        expect(map.get("layers").at(0).get("configuredVisibility")).to.be.false;
        expect(map.get("layers").at(0).get("visible")).to.be.true;
      });

      it("infers configuredVisibility from visible for model instance layers when missing", () => {
        const layerModel = new Backbone.Model({
          layerId: "layer-1",
          visible: true,
        });
        const map = new Map({ layers: [layerModel] });

        expect(map.get("layers").at(0).get("configuredVisibility")).to.be.true;
      });

      it("sets viewfinderCards from config with layers (legacy zoomPresets key)", () => {
        const map = new Map({
          zoomPresets: [
            {
              latitude: 55,
              longitude: 66,
              height: 77,
              description: "Some zoom preset",
              title: "Zoom 1",
              layerIds: ["layer1"],
            },
          ],
          layers: [{}],
        });

        expect(
          map
            .get("viewfinderCardsCollection")
            .at(0)
            .get("viewfinderCards")
            .at(0)
            .get("title"),
        ).to.equal("Zoom 1");
      });

      it("sets viewfinderCards from config with layerCategories (legacy zoomPresets key)", () => {
        const map = new Map({
          zoomPresets: [
            {
              latitude: 55,
              longitude: 66,
              height: 77,
              description: "Some zoom preset",
              title: "Zoom 1",
              layerIds: ["layer1"],
            },
          ],
          layerCategories: [{ layers: [{}] }],
        });

        expect(
          map
            .get("viewfinderCardsCollection")
            .at(0)
            .get("viewfinderCards")
            .at(0)
            .get("title"),
        ).to.equal("Zoom 1");
      });

      it("filters out enabledLayerIds for layerIds that do not exist", () => {
        const map = new Map({
          zoomPresets: [
            {
              latitude: 55,
              longitude: 66,
              height: 77,
              description: "Some zoom preset",
              title: "Zoom 1",
              layerIds: ["layer1", "layer2"],
            },
          ],
          layerCategories: [{ layers: [{ layerId: "layer1" }] }],
        });

        // Deep equality check with .to.eql
        expect(
          map
            .get("viewfinderCardsCollection")
            .at(0)
            .get("viewfinderCards")
            .at(0)
            .get("enabledLayerIds"),
        ).to.eql(["layer1"]);
      });

      it("accepts debug from config", () => {
        const map = new Map({ debug: true });

        expect(map.get("debug")).to.equal(true);
      });

      it("accepts show3DTilesInspector from config", () => {
        const map = new Map({ show3DTilesInspector: true });

        expect(map.get("show3DTilesInspector")).to.equal(true);
      });

      it("writes camera position and enabled layers to the URL", () => {
        const map = new Map({
          showShareUrl: true,
          layers: [
            { layerId: "layer-1", visible: true },
            { layerId: "layer-2", visible: false },
          ],
        });

        map.get("interactions").setCameraPosition({
          latitude: 45,
          longitude: 135,
          height: 9999,
          heading: 1,
          pitch: 2,
          roll: 3,
        });
        map.updateSearchParams();

        expect(SearchParams.parseStateFromUrl().destination).to.deep.equal({
          latitude: 45,
          longitude: 135,
          height: 9999,
          heading: 1,
          pitch: 2,
          roll: 3,
        });
        expect(SearchParams.parseStateFromUrl().enabledLayerIds).to.deep.equal([
          "layer-1",
        ]);
      });
    });

    describe("getLayerGroups", () => {
      it("returns an array of MapAssets", () => {
        const layers = new MapAssets([{}]);
        state.model.set("layers", layers);

        expect(state.model.getLayerGroups()).to.have.lengthOf(1);
        expect(state.model.getLayerGroups()[0]).to.equal(layers);
      });

      it("ignores layers if layerCategories exist", () => {
        state.model.set("layers", new MapAssets([{}]));

        const category1 = new AssetCategory({ layers: [{}] });
        const category2 = new AssetCategory({ layers: [{}] });
        state.model.set(
          "layerCategories",
          new AssetCategories([category1, category2]),
        );

        expect(state.model.getLayerGroups()).to.have.lengthOf(2);
      });
    });
  });
});
