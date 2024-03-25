define([
  "views/maps/LayersPanelView",
  "models/maps/Map",
  "collections/maps/AssetCategories",
  "views/maps/LayerCategoryListView",
  "views/maps/LayerListView",
  "/test/js/specs/shared/clean-state.js",
], (LayersPanelView, Map, AssetCategories, LayerCategoryListView, LayerListView, cleanState) => {
  const expect = chai.expect;

  describe("LayersPanelView Test Suite", () => {
    const state = cleanState(() => {
      const view = new LayersPanelView({
        model: new Map(),
      });

      return { view };
    }, beforeEach);

    describe("Initialization", () => {
      it("creates an LayersPanelView instance", () => {
        expect(state.view).to.be.instanceof(LayersPanelView);
      });
    });

    describe("render", () => {
      it("uses LayerCategoryListView if layerCategories exists", () => {
        state.view.map.set("layerCategories", new AssetCategories([{ layers: [{}] }]));

        state.view.render();

        expect(state.view.layersView).to.be.instanceof(LayerCategoryListView);
      });

      it("uses LayerListView if layerCategories doesn't exist", () => {
        state.view.render();

        expect(state.view.layersView).to.be.instanceof(LayerListView);
      });
    });

    it("dismisses layer details on search", () => {
      state.view.render();
      const layer = state.view.layersView.collection.at(0);
      layer.set("selected", true);

      state.view.search("");

      expect(layer.get("selected")).to.be.false;
    });
  });
});
