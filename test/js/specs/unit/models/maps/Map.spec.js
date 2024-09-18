define([
  "models/maps/Map",
  "models/maps/AssetCategory",
  "collections/maps/AssetCategories",
  "collections/maps/MapAssets",
  "/test/js/specs/shared/clean-state.js",
  "common/SearchParams",
], (
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
      SearchParams.clearSavedView();
    });

    afterEach(() => {
      SearchParams.clearSavedView();
    });

    describe("Initialization", () => {
      it("creates an Map instance", () => {
        expect(state.model).to.be.instanceof(Map);
      });

      it("ignores layers if layerCategories exist", () => {
        const map = new Map({
          layerCategories: [{ layers: [{}] }],
          layers: [{}],
        });

        expect(map.has("layerCategories")).to.be.true;
        expect(map.has("layers")).to.be.false;
      });

      it("sets zoomPresets from config with layers", () => {
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

        expect(map.get("zoomPresetsCollection").at(0).get("title")).to.equal(
          "Zoom 1",
        );
      });

      it("sets zoomPresets from config with layerCategories", () => {
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

        expect(map.get("zoomPresetsCollection").at(0).get("title")).to.equal(
          "Zoom 1",
        );
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
          map.get("zoomPresetsCollection").at(0).get("enabledLayerIds"),
        ).to.eql(["layer1"]);
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
