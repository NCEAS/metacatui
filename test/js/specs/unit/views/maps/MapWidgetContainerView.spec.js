define([
  "views/maps/MapWidgetContainerView",
  "models/maps/Map",
  "/test/js/specs/shared/clean-state.js",
], (MapWidgetContainerView, Map, cleanState) => {
  const expect = chai.expect;

  describe("MapWidgetContainerView Test Suite", () => {
    const state = cleanState(() => {
      const view = new MapWidgetContainerView({
        el: document.createElement("div"),
        model: new Map(),
      });

      return { view };
    }, beforeEach);

    describe("Initialization", () => {
      it("creates an MapWidgetContainerView instance", () => {
        expect(state.view).to.be.instanceof(MapWidgetContainerView);
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
