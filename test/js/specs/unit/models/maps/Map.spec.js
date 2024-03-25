define([
  "models/maps/Map",
  "models/maps/AssetCategory",
  "collections/maps/AssetCategories",
  "collections/maps/MapAssets",
  "/test/js/specs/shared/clean-state.js",
], (Map, AssetCategory, AssetCategories, MapAssets, cleanState) => {
  const expect = chai.expect;

  describe("Map Test Suite", () => {
    const state = cleanState(() => {
      return { model: new Map() };
    }, beforeEach);

    describe("Initialization", () => {
      it("creates an Map instance", () => {
        expect(state.model).to.be.instanceof(Map);
      });

      it("ignores layers if layerCategories exist", () => {
        const map = new Map({ layerCategories: [{ layers: [{}] }], layers: [{}] });

        expect(map.has("layerCategories")).to.be.true;
        expect(map.has("layers")).to.be.false;
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
        state.model.set("layerCategories", new AssetCategories([category1, category2]));

        expect(state.model.getLayerGroups()).to.have.lengthOf(2);
      });
    });
  });
});
