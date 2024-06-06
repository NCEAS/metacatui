define([
  "models/maps/AssetCategory",
  "collections/maps/MapAssets",
  "models/maps/Map",
  "/test/js/specs/shared/clean-state.js",
], (AssetCategory, MapAssets, Map, cleanState) => {
  const expect = chai.expect;

  describe("AssetCategory Test Suite", () => {
    const label = "label";
    const icon = "<svg></svg>";

    const state = cleanState(() => {
      const model = new AssetCategory({
        layers: [{}],
        label,
        icon,
      });

      return { model };
    }, beforeEach);

    describe("Initialization", () => {
      it("creates an AssetCategory instance", () => {
        expect(state.model).to.be.instanceof(AssetCategory);
      });

      it("sets icon, label, and mapAssets", () => {
        expect(state.model.get("icon")).to.equal(icon);
        expect(state.model.get("label")).to.equal(label);
        expect(state.model.get("mapAssets")).to.be.instanceof(MapAssets);
      });

      it("throws if layers are missing from attrs", () => {
        expect(() => new AssetCategory({ label, icon })).to.throw();
      });
    });

    describe("setMapModel", () => {
      it("sets mapModel attribute to mapAssets models", () => {
        expect(state.model.get("mapAssets")).to.have.lengthOf(1);
        expect(state.model.get("mapAssets").at(0).get("mapModel")).to.be
          .undefined;

        const map = new Map();
        state.model.setMapModel(map);

        expect(state.model.get("mapAssets").at(0).get("mapModel")).to.equal(
          map,
        );
      });
    });
  });
});
