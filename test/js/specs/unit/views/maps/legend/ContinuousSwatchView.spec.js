define([
  "views/maps/legend/ContinuousSwatchView",
  "models/maps/AssetColorPalette",
  "/test/js/specs/shared/clean-state.js",
  "/test/js/specs/unit/views/maps/legend/ContinuousSwatchViewHarness.js",
], (
  ContinuousSwatchView,
  AssetColorPalette,
  cleanState,
  ContinuousSwatchViewHarness,
) => {
  const expect = chai.expect;

  describe("ContinuousSwatchView Test Suite", () => {
    const state = cleanState(() => {
      const view = new ContinuousSwatchView({
        model: new AssetColorPalette({
          colors: [{}, {}],
        }),
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

      it("rerenders when minVal/maxVal of the palette changes", () => {
        // Because of how backbone event handlers are triggered, we have to bind spy before the object creation.
        // https://stackoverflow.com/questions/8441612/why-is-this-sinon-spy-not-being-called-when-i-run-this-test
        const spy = sinon.spy(ContinuousSwatchView.prototype, "render");
        const view = new ContinuousSwatchView({
          model: new AssetColorPalette({
            colors: [{}, {}],
          }),
        });

        view.model.set("minVal", -10);
        view.model.set("maxVal", 10);

        expect(spy.callCount).to.equal(2);
      });
    });
  });
});
