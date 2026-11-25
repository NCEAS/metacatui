define([
  "views/maps/LayerItemView",
  "models/maps/assets/MapAsset",
  "/test/js/specs/unit/views/maps/LayerItemViewHarness.js",
  "/test/js/specs/shared/clean-state.js",
], (LayerItemView, MapAsset, LayerItemViewHarness, cleanState) => {
  const expect = chai.expect;
  const { CLASS_NAMES } = LayerItemView;

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

      it("highlights repeated label text and skips HTML attributes", () => {
        state.view.model.set(
          "label",
          'CO<sub>2</sub> and CO<sub>2</sub><img alt="attribute-only">',
        );
        state.view.render();

        expect(state.view.search("CO")).to.equal(true);
        expect(
          state.view.el.querySelectorAll(`.${CLASS_NAMES.HIGHLIGHTED_TEXT}`),
        ).to.have.lengthOf(2);
        expect(state.view.el.querySelectorAll("sub")).to.have.lengthOf(2);
        expect(state.view.search("2")).to.equal(true);
        expect(
          state.view.el.querySelectorAll(
            `sub .${CLASS_NAMES.HIGHLIGHTED_TEXT}`,
          ),
        ).to.have.lengthOf(2);
        expect(state.view.search("attribute-only")).to.equal(false);
        expect(state.view.el.querySelector("img").alt).to.equal(
          "attribute-only",
        );
      });
    });

    describe("visibility toggle", () => {
      it("keeps a failed layer hidden when its row or eye is clicked and allows opening Settings", () => {
        const { view } = state;
        const asset = view.model;
        const toggle = view.el.querySelector(
          `.${CLASS_NAMES.VISIBILITY_TOGGLE}`,
        );
        asset.setError("Layer failed to load");

        for (const target of [
          view.el,
          state.harness.getLabelText()[0],
          toggle,
        ]) {
          target.click();

          expect(asset.get("visible")).to.be.false;
          expect(view.el.classList.contains(CLASS_NAMES.SHOWN)).to.be.false;
          expect(asset.get("status")).to.equal("error");
          expect(
            view.el.querySelector(`.${CLASS_NAMES.WARNING_ICON}`),
          ).to.not.equal(null);
        }
        expect(toggle.disabled).to.be.true;

        view.el.querySelector(`.${CLASS_NAMES.SETTINGS_TOGGLE}`).click();

        expect(asset.get("selected")).to.be.true;
        expect(asset.get("visible")).to.be.false;
      });

      it("disables the eye when rendering a failed layer and enables toggling after recovery", () => {
        const { view } = state;
        const asset = view.model;
        asset.set("visible", false);
        asset.setError("Layer failed to load");
        view.render();
        const toggle = view.el.querySelector(
          `.${CLASS_NAMES.VISIBILITY_TOGGLE}`,
        );
        expect(toggle.disabled).to.be.true;

        asset.setReady();

        expect(toggle.disabled).to.be.false;
        toggle.click();
        expect(asset.get("visible")).to.be.true;
        expect(view.el.classList.contains(CLASS_NAMES.SHOWN)).to.be.true;
      });

      it("starts a zero-opacity layer disabled and makes it visible when toggled on", () => {
        const asset = new MapAsset({ opacity: 0 });
        const view = new LayerItemView({ model: asset });
        try {
          view.render();
          expect(asset.get("opacity")).to.equal(0);
          expect(asset.get("visible")).to.be.false;
          expect(view.el.classList.contains(CLASS_NAMES.SHOWN)).to.be.false;

          view.el.querySelector(`.${CLASS_NAMES.VISIBILITY_TOGGLE}`).click();

          expect(asset.get("opacity")).to.equal(0.5);
          expect(asset.get("visible")).to.be.true;
          expect(view.el.classList.contains(CLASS_NAMES.SHOWN)).to.be.true;
        } finally {
          view.remove();
          asset.stopListening();
        }
      });

      it("uses eye icon if layer is categorized", () => {
        state.view.isCategorized = true;
        state.view.render();

        expect(
          state.harness.getVisibilityToggle().children(".icon-eye-open"),
        ).to.have.lengthOf(1);
      });

      describe("when layer is not categorized", () => {
        it("uses layer's icon", () => {
          const icon = "<svg></svg>";
          state.view.model.set("icon", icon);
          state.view.render();

          expect(
            state.harness.getLayerIconVisibilityToggle().innerHTML,
          ).to.equal(icon);
        });

        it("uses the default icon if layer icon does not exist", () => {
          expect(
            state.harness.getLayerIconVisibilityToggle().innerHTML,
          ).to.equal(state.view.model.defaults().icon);
        });

        it("updates the icon when it's fetched", () => {
          state.view.model.set("iconStatus", "fetching");
          state.view.render();

          expect(
            state.harness.getLayerIconVisibilityToggle().innerHTML,
          ).to.equal(state.view.model.defaults().icon);

          const icon = "<svg></svg>";
          state.view.model.set("icon", icon);
          state.view.model.set("iconStatus", "success");

          expect(
            state.harness.getLayerIconVisibilityToggle().innerHTML,
          ).to.equal(icon);
        });
      });
    });

    describe("status rendering", () => {
      it("shows loading icon only when layer is visible", () => {
        state.view.model.set({
          status: "ready",
          visible: true,
          isLoadingLayer: true,
        });
        const iconVisible = state.view.el.querySelector(
          ".icon-spinner.loading",
        );
        expect(iconVisible).to.not.equal(null);

        state.view.model.set("visible", false);
        state.view.model.set("isLoadingLayer", false);
        const iconHidden = state.view.el.querySelector(".icon-spinner.loading");
        expect(iconHidden).to.equal(null);
      });

      it("shows loading icon when map model marks layer as loading", () => {
        state.view.model.set({
          status: "ready",
          visible: true,
          isLoadingLayer: true,
        });

        const iconVisible = state.view.el.querySelector(
          ".icon-spinner.loading",
        );
        expect(iconVisible).to.not.equal(null);

        state.view.model.set("isLoadingLayer", false);
        const iconHidden = state.view.el.querySelector(".icon-spinner.loading");
        expect(iconHidden).to.equal(null);
      });
    });
  });
});
