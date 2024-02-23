define([
  "views/maps/LayerCategoryItemView",
  "models/maps/AssetCategory",
  "/test/js/specs/unit/views/maps/LayerCategoryItemViewHarness.js",
  "/test/js/specs/shared/clean-state.js",
], (LayerCategoryItemView, AssetCategory, LayerCategoryItemViewHarness, cleanState) => {
  const expect = chai.expect;

  describe("LayerCategoryItemView Test Suite", () => {
    const state = cleanState(() => {
      const view = new LayerCategoryItemView({
        model: new AssetCategory({ layers: [{}] }),
      });
      view.render();
      const harness = new LayerCategoryItemViewHarness(view);

      return { view, harness };
    }, beforeEach);

    describe("Initialization", () => {
      it("creates an LayerCategoryItemView instance", () => {
        expect(state.view).to.be.instanceof(LayerCategoryItemView);
      });
    });

    it("toggles between expanded and collapsed", () => {
      expect(state.view.model.get("expanded")).to.be.false;
      expect(state.harness.getLayers().css("display")).to.equal("none");

      state.harness.toggleExpand();

      expect(state.view.model.get("expanded")).to.be.true;
      expect(state.harness.getLayers().css("display")).to.equal("block");

      state.harness.toggleExpand();

      expect(state.view.model.get("expanded")).to.be.false;
      expect(state.harness.getLayers().css("display")).to.equal("none");
    });
  });
});
