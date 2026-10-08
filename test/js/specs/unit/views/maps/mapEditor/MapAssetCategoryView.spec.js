define([
  "models/maps/AssetCategory",
  "views/maps/mapEditor/MapAssetCategoryView",
  "/test/js/specs/shared/clean-state.js",
], (AssetCategory, MapAssetCategoryView, cleanState) => {
  const expect = chai.expect;
  const iconPath = "M0 0h24v24H0z";
  const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="${iconPath}"/></svg>`;

  describe("MapAssetCategoryView", () => {
    const state = cleanState(() => {
      const model = new AssetCategory({
        label: "Water <b>layers</b>",
        layers: [],
      });
      const view = new MapAssetCategoryView({ model }).render();
      document.body.append(view.el);
      return { model, view };
    }, beforeEach);

    afterEach(() => {
      state.view.remove();
      state.model.stopListening();
    });

    it("updates its header in place without changing saved category expansion", () => {
      const button = state.view.el.querySelector("[data-toggle-category]");
      const config = state.model.toConfig();
      expect(button.textContent).to.include("Water <b>layers</b>");
      expect(button.querySelector("b")).to.equal(null);
      expect(button.getAttribute("aria-expanded")).to.equal("true");
      expect(button.getAttribute("aria-controls")).to.equal(
        state.view.contentEl.id,
      );
      button.focus();
      button.click();
      expect(state.view.contentEl.hidden).to.equal(true);
      expect(state.model.toConfig()).to.deep.equal(config);
      state.model.set("label", "Water <i>observations</i>");
      expect(state.view.el.querySelector("[data-toggle-category]")).to.equal(
        button,
      );
      expect(button.textContent).to.include("Water <i>observations</i>");
      expect(button.querySelector("i:not(.icon)")).to.equal(null);
      expect(document.activeElement).to.equal(button);
    });

    it("updates its icon without replacing the focused header", () => {
      const button = state.view.el.querySelector("[data-toggle-category]");
      button.focus();
      state.model.updateIcon(icon);
      expect(state.view.el.querySelector("[data-toggle-category]")).to.equal(
        button,
      );
      expect(button.querySelector("svg path").getAttribute("d")).to.equal(
        iconPath,
      );
      expect(document.activeElement).to.equal(button);
    });

    it("stops updating its header after removal", () => {
      const button = state.view.el.querySelector("[data-toggle-category]");
      const markup = button.innerHTML;
      state.view.remove();
      state.model.set("label", "After removal");
      state.model.updateIcon(icon);
      expect(button.innerHTML).to.equal(markup);
    });
  });
});
