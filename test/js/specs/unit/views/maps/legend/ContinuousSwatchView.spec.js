define([
  "views/maps/legend/ContinuousSwatchView",
  "models/maps/AssetColor",
  "collections/maps/AssetColors",
  "/test/js/specs/shared/clean-state.js",
  "/test/js/specs/unit/views/maps/legend/ContinuousSwatchViewHarness.js",
], (
  ContinuousSwatchView,
  AssetColor,
  AssetColors,
  cleanState,
  ContinuousSwatchViewHarness,
) => {
  const expect = chai.expect;

  describe("ContinuousSwatchView Test Suite", () => {
    const state = cleanState(() => {
      const view = new ContinuousSwatchView({
        collection: new AssetColors([new AssetColor(), new AssetColor()]),
      });
      const harness = new ContinuousSwatchViewHarness(view);

      return { view, harness };
    }, beforeEach);

    describe("Initialization", () => {
      it("creates an ContinuousSwatchView instance", () => {
        expect(state.view).to.be.instanceof(ContinuousSwatchView);
      });
    });

    describe("render", () => {
      it("sets the background of the swatch", () => {
        state.view.render();

        expect(state.harness.getSwatch().css("background-image")).to.not.be
          .empty;
      });
    });
  });
});
