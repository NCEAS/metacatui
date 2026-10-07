define([
  "backbone",
  "views/maps/mapEditor/MapAssetItemView",
  "/test/js/specs/shared/clean-state.js",
], (Backbone, MapAssetItemView, cleanState) => {
  const expect = chai.expect;

  describe("MapAssetItemView", () => {
    const state = cleanState(() => {
      const model = new Backbone.Model({ label: "Layer <b>one</b>" });
      const view = new MapAssetItemView({
        model,
        panelId: "settings-panel",
      }).render();
      document.body.append(view.el);
      return { model, view };
    }, beforeEach);
    const select = () => state.view.el.querySelector("[data-asset]");
    const remove = () => state.view.el.querySelector("[data-remove-asset]");

    afterEach(() => state.view.remove());

    it("renders literal labels and updates the removal accessible name", () => {
      expect(state.view.el.tagName).to.equal("LI");
      expect(select().textContent).to.equal("Layer <b>one</b>");
      expect(select().querySelector("b")).to.equal(null);
      expect(select().getAttribute("aria-controls")).to.equal("settings-panel");
      expect(remove().getAttribute("aria-label")).to.equal(
        "Remove Layer <b>one</b>",
      );
      state.model.set("label", "Renamed <i>layer</i>");
      expect(select().textContent).to.equal("Renamed <i>layer</i>");
      expect(remove().getAttribute("aria-label")).to.equal(
        "Remove Renamed <i>layer</i>",
      );
      expect(state.view.el.querySelector("i:not(.icon)")).to.equal(null);
    });

    it("presents editor selection without changing the asset model", () => {
      expect(select().getAttribute("aria-pressed")).to.equal("false");
      state.view.setSelected(true);
      expect(select().getAttribute("aria-pressed")).to.equal("true");
      state.view.setSelected(false);
      expect(select().getAttribute("aria-pressed")).to.equal("false");
      expect(state.model.has("selected")).to.equal(false);
      expect(state.model.has("visible")).to.equal(false);
    });

    it("requests selection and removal of the exact asset model", () => {
      let selected;
      let removed;
      state.view.on("select:asset", (asset) => {
        selected = asset;
      });
      state.view.on("remove:asset", (asset) => {
        removed = asset;
      });
      select().click();
      remove().click();
      expect(selected).to.equal(state.model);
      expect(removed).to.equal(state.model);
      expect(state.model.has("selected")).to.equal(false);
      expect(state.model.has("visible")).to.equal(false);
    });

    it("focuses its layer selection control", () => {
      state.view.focus();
      expect(document.activeElement).to.equal(select());
    });

    it("previews removal while hovering or focusing the remove control", () => {
      remove().dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
      expect(
        state.view.el.classList.contains("map-editor__item--removing"),
      ).to.equal(true);
      remove().dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
      expect(
        state.view.el.classList.contains("map-editor__item--removing"),
      ).to.equal(false);
      remove().focus();
      expect(
        state.view.el.classList.contains("map-editor__item--removing"),
      ).to.equal(true);
      remove().dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
      expect(
        state.view.el.classList.contains("map-editor__item--removing"),
      ).to.equal(true);
      state.view.focus();
      expect(
        state.view.el.classList.contains("map-editor__item--removing"),
      ).to.equal(false);
    });

    it("releases model listeners when removed", () => {
      const button = select();
      state.view.remove();
      state.model.set("label", "After removal");
      expect(button.textContent).to.equal("Layer <b>one</b>");
    });
  });
});
