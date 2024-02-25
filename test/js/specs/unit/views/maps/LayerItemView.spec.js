define([
  "views/maps/LayerItemView",
  "models/maps/assets/MapAsset",
  "/test/js/specs/unit/views/maps/LayerItemViewHarness.js",
  "/test/js/specs/shared/clean-state.js",
], (LayerItemView, MapAsset, LayerItemViewHarness, cleanState) => {
  const expect = chai.expect;

  describe("LayerItemView Test Suite", () => {
    const state = cleanState(() => {
      const view = new LayerItemView({
        model: new MapAsset({ label: "Layer label" }),
      });
      view.render();
      const harness = new LayerItemViewHarness(view);

      return { view, harness };
    }, beforeEach);

    describe("Initialization", () => {
      it("creates an LayerItemView instance", () => {
        expect(state.view).to.be.instanceof(LayerItemView);
      });
    });

    describe("search", () => {
      it("returns true when the label contains the text (case insensitive)", () => {
        expect(state.view.search("layer")).to.be.true;
      });

      it("shows the view when there is a match, hides otherwise", () => {
        state.view.search("layer");
        expect(state.view.$el.css("display")).to.equal("block");

        state.view.search("asdlkfjsa");
        expect(state.view.$el.css("display")).to.equal("none");
      });

      it("wraps matched text with span tags, case preserved", () => {
        expect(state.harness.getLabelText().find("span")).to.have.lengthOf(0);

        state.view.search("layer");

        const matchedSpan = state.harness.getLabelText().find("span");
        expect(matchedSpan).to.have.lengthOf(1);
        expect(matchedSpan.text()).to.equal("Layer");
      });
    });
  });
});
