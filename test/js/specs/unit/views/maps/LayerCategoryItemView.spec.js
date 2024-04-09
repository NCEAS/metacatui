define([
  "views/maps/LayerCategoryItemView",
  "models/maps/AssetCategory",
  "/test/js/specs/unit/views/maps/LayerCategoryItemViewHarness.js",
  "/test/js/specs/shared/clean-state.js",
], (LayerCategoryItemView, AssetCategory, LayerCategoryItemViewHarness, cleanState) => {
  const expect = chai.expect;
  const sandbox = sinon.createSandbox();
  const stub = sandbox.stub;

  describe("LayerCategoryItemView Test Suite", () => {
    const state = cleanState(() => {
      const view = new LayerCategoryItemView({
        model: new AssetCategory({ layers: [{}] }),
      });
      view.render();
      const harness = new LayerCategoryItemViewHarness(view);

      return { view, harness };
    }, beforeEach);

    afterEach(() => {
      sandbox.restore();
    });

    describe("Initialization", () => {
      it("creates an LayerCategoryItemView instance", () => {
        expect(state.view).to.be.instanceof(LayerCategoryItemView);
      });

      it("creates layer items with isCategorized set to true", () => {
        expect(state.view.layerListView.layerItemViews[0].isCategorized).to.be.true;
      });
    });

    it("toggles between expanded and collapsed", () => {
      expect(state.view.model.get("expanded")).to.be.false;
      expect(state.harness.getLayers().hasClass("open")).to.be.false;

      state.harness.toggleExpand();

      expect(state.view.model.get("expanded")).to.be.true;
      expect(state.harness.getLayers().hasClass("open")).to.be.true;

      state.harness.toggleExpand();

      expect(state.view.model.get("expanded")).to.be.false;
      expect(state.harness.getLayers().hasClass("open")).to.be.false;
    });

    describe("search", () => {
      it("returns the result from LayerListView search", () => {
        stub(state.view.layerListView, "search").returns(true);
        expect(state.view.search("")).to.be.true;

        sandbox.restore();
        stub(state.view.layerListView, "search").returns(false);
        expect(state.view.search("")).to.be.false;
      });

      it("shows the view when there is a match, hides otherwise", () => {
        stub(state.view.layerListView, "search").returns(true);
        state.view.search("");
        expect(state.view.$el.css("display")).to.equal("block");

        sandbox.restore();
        stub(state.view.layerListView, "search").returns(false);
        state.view.search("");
        expect(state.view.$el.css("display")).to.equal("none");
      });

      it("expands the category if there is a match and search text is not empty", () => {
        state.view.model.set("expanded", false);
        stub(state.view.layerListView, "search").returns(true);

        state.view.search("text");

        expect(state.view.model.get("expanded")).to.be.true;
      });

      it("collapses the category if search text is empty", () => {
        state.view.model.set("expanded", true);
        stub(state.view.layerListView, "search").returns(true);

        state.view.search("");

        expect(state.view.model.get("expanded")).to.be.false;
      });

      it("collapses the category if there is no match", () => {
        state.view.model.set("expanded", true);
        stub(state.view.layerListView, "search").returns(false);

        state.view.search("text");

        expect(state.view.model.get("expanded")).to.be.false;
      });
    });
  });
});
