define([
  "views/maps/CesiumWidgetContainerView",
  "models/maps/Map",
  "collections/maps/AssetCategories",
  "views/maps/LayerCategoryListView",
  "views/maps/LayerListView",
  "/test/js/specs/shared/clean-state.js",
], (
  CesiumWidgetContainerView,
  Map,
  AssetCategories,
  LayerCategoryListView,
  LayerListView,
  cleanState,
) => {
  const expect = chai.expect;

  describe("CesiumWidgetContainerView Test Suite", () => {
    const state = cleanState(() => {
      const view = new CesiumWidgetContainerView({
        el: document.createElement("div"),
        model: new Map(),
      });

      return { view };
    }, beforeEach);

    describe("Initialization", () => {
      it("creates an CesiumWidgetContainerView instance", () => {
        expect(state.view).to.be.instanceof(CesiumWidgetContainerView);
      });
    });

    describe("render", () => {
      it("adds a Cesium widget to the DOM tree", () => {
        state.view.render();

        expect(
          state.view.el.getElementsByClassName("cesium-widget"),
        ).to.have.lengthOf(1);
      });
    });
  });
});
