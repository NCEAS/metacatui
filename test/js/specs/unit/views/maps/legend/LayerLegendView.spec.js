define([
  "views/maps/legend/LayerLegendView",
  "models/maps/AssetColorPalette",
  "/test/js/specs/shared/clean-state.js",
  "/test/js/specs/unit/views/maps/legend/LayerLegendViewHarness.js",
], (
  LayerLegendView,
  AssetColorPalette,
  cleanState,
  LayerLegendViewHarness,
) => {
  const expect = chai.expect;

  describe("LayerLegendView Test Suite", () => {
    const state = cleanState(() => {
      const view = new LayerLegendView({
        el: document.createElement("div"),
        model: new AssetColorPalette({
          label: "layer",
          paletteType: "categorical",
          colors: [
            { color: "#1be3ee", value: 0 },
            { color: "#1b22ee", value: 120025 },
          ],
        }),
      });
      const harness = new LayerLegendViewHarness(view);

      return { view, harness };
    }, beforeEach);

    describe("Initialization", () => {
      it("creates an LayerLegendView instance", () => {
        expect(state.view).to.be.instanceof(LayerLegendView);
      });
    });

    describe("render", () => {
      it("renders if paletteType is categorical", () => {
        state.view.model.set("paletteType", "categorical");
        state.view.render();

        expect(state.view.$el.children()).to.not.have.lengthOf(0);
      });

      it("does not render if paletteType is unrecognized", () => {
        state.view.model = new AssetColorPalette({
          label: "layer",
          paletteType: "invalid type",
        });
        state.view.render();

        expect(state.view.$el.children()).to.have.lengthOf(0);
      });
    });

    describe("renderCategoricalPalette", () => {
      it("creates a swatch for each color in the palette", () => {
        state.view.model.set("paletteType", "categorical");
        state.view.render();

        expect(state.harness.getPalette().children()).to.have.lengthOf(
          state.view.model.get("colors").length,
        );
      });
    });
  });
});
