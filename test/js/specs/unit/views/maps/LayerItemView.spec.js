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

      it("returns true when search text is empty", () => {
        expect(state.view.search("")).to.be.true;
      });

      it("returns false when the label does not contain the text", () => {
        expect(state.view.search("asdlkfjsa")).to.be.false;
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

      it("clears span wrappers if search text is empty", () => {
        state.view.search("layer");

        state.view.search("");

        const matchedSpan = state.harness.getLabelText().find("span");
        expect(matchedSpan).to.have.lengthOf(0);
      });
    });

    describe("visibility toggle", () => {
      it("uses eye icon if layer is categorized", () => {
        state.view.isCategorized = true;
        state.view.render();

        expect(state.harness.getVisibilityToggle().children(".icon-eye-open")).to.have.lengthOf(1);
      });

      describe("when layer is not categorized", () => {
        it("uses layer's icon", () => {
          const icon = "<svg></svg>";
          state.view.model.set("icon", icon);
          state.view.render();
  
          expect(state.harness.getLayerIconVisibilityToggle().innerHTML).to.equal(icon);
        });

        it("uses the default icon if layer icon does not exist", () => {
          expect(state.harness.getLayerIconVisibilityToggle().innerHTML).to.equal(state.view.model.defaults().icon);
        });

        it("updates the icon when it's fetched", () => {
          state.view.model.set("iconStatus", "fetching");
          state.view.render();

          expect(state.harness.getLayerIconVisibilityToggle().innerHTML).to.equal(state.view.model.defaults().icon);

          const icon = "<svg></svg>";
          state.view.model.set("icon", icon);
          state.view.model.set("iconStatus", "success");

          expect(state.harness.getLayerIconVisibilityToggle().innerHTML).to.equal(icon);
        });
      });
    });
  });
});
