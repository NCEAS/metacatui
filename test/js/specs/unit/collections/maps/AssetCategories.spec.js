define([
  "collections/maps/AssetCategories",
  "models/maps/AssetCategory",
  "models/maps/Map",
  "collections/maps/MapAssets",
  "/test/js/specs/shared/clean-state.js",
], (AssetCategories, AssetCategory, Map, MapAssets, cleanState) => {
  const expect = chai.expect;

  describe("AssetCategories Test Suite", () => {
    const state = cleanState(() => {
      const collection = new AssetCategories([
        { layers: [{}] },
        { layers: [{}, {}] },
      ]);

      return { collection };
    }, beforeEach);

    describe("Initialization", () => {
      it("creates an AssetCategories instance", () => {
        expect(state.collection).to.be.instanceof(AssetCategories);
      });

      it("creates a collection of AssetCategory models", () => {
        expect(state.collection.models).to.have.lengthOf(2);
        expect(state.collection.models.at(0)).to.be.instanceof(AssetCategory);
      });
    });

    describe("setMapModel", () => {
      it("evokes AssetCategory models' setMapModel method", () => {
        const spy = sinon.spy();
        state.collection.models.at(0).setMapModel = spy;

        state.collection.setMapModel(new Map());

        expect(spy.callCount).to.equal(1);
      });
    });

    describe("getMapAssets", () => {
      it("returns an array of MapAssets", () => {
        expect(state.collection.getMapAssets()).to.have.lengthOf(2);
        expect(state.collection.getMapAssets().at(0)).to.be.instanceof(
          MapAssets,
        );
      });
    });

    describe("getMapAssetsFlat", () => {
      it("reuses existing MapAsset model instances", () => {
        const firstCategoryAssets = state.collection.at(0).get("mapAssets");
        const sourceModel = firstCategoryAssets.at(0);

        const flatAssets = state.collection.getMapAssetsFlat();
        const flatModel = flatAssets.at(0);

        expect(flatModel).to.equal(sourceModel);

        sourceModel.set("visible", false);
        expect(flatModel.get("visible")).to.equal(false);
      });
    });
  });
});
