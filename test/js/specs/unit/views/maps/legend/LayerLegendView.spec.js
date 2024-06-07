define([
  "views/maps/legend/LayerLegendView",
  "models/maps/Map",
  "/test/js/specs/shared/clean-state.js",
], (LayerLegendView, Map, cleanState) => {
  const expect = chai.expect;

  describe("LayerLegendView Test Suite", () => {
    const state = cleanState(() => {
      const view = new LayerLegendView({
        el: document.createElement("div"),
        model: new Map(),
      });

      return { view };
    }, beforeEach);

    describe("Initialization", () => {
      it("creates an LayerLegendView instance", () => {
        expect(state.view).to.be.instanceof(LayerLegendView);
      });
    });

    describe("render", () => {
      // TODO
    });
  });
});
