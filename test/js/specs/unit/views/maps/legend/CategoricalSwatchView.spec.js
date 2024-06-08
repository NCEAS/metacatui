define([
  "views/maps/legend/CategoricalSwatchView",
  "models/maps/AssetColor",
  "/test/js/specs/shared/clean-state.js",
  "/test/js/specs/unit/views/maps/legend/CategoricalSwatchViewHarness.js",
], (
  CategoricalSwatchView,
  AssetColor,
  cleanState,
  CategoricalSwatchViewHarness,
) => {
  const expect = chai.expect;

  describe("CategoricalSwatchView Test Suite", () => {
    const state = cleanState(() => {
      const view = new CategoricalSwatchView({ model: new AssetColor() });
      const harness = new CategoricalSwatchViewHarness(view);

      return { view, harness };
    }, beforeEach);

    describe("Initialization", () => {
      it("creates an CategoricalSwatchView instance", () => {
        expect(state.view).to.be.instanceof(CategoricalSwatchView);
      });
    });

    describe("render", () => {
      it("sets the background of the swatch", () => {
        state.view.render();

        expect(state.harness.getSwatch().css("background-color")).to.not.be
          .empty;
      });
    });
  });
});
