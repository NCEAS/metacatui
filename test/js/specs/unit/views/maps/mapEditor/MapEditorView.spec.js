define([
  "models/maps/Map",
  "models/maps/assets/CesiumImagery",
  "views/maps/mapEditor/MapEditorView",
  "/test/js/specs/shared/clean-state.js",
], (Map, CesiumImagery, MapEditorView, cleanState) => {
  const expect = chai.expect;
  describe("MapEditorView", () => {
    const state = cleanState(() => {
      const sandbox = sinon.createSandbox();
      sandbox.stub(CesiumImagery.prototype, "createCesiumModelWhenVisible");
      sandbox.stub(CesiumImagery.prototype, "getThumbnail");
      const model = new Map({
        layers: [
          {
            label: "Incomplete",
            type: "IonImageryProvider",
            cesiumOptions: { ionAssetId: "0" },
          },
        ],
      });
      const view = new MapEditorView({
        model,
        el: document.createElement("div"),
      }).render();
      document.body.append(view.el);
      return { sandbox, model, view };
    }, beforeEach);

    afterEach(() => {
      state.view.remove();
      state.model.getAllLayers().forEach((asset) => asset.stopListening());
      state.model.stopListening();
      state.sandbox.restore();
    });

    it("composes the assets workspace with the shared map and save guidance", () => {
      expect(state.view.el.classList.contains("map-editor")).to.equal(true);
      expect(state.view.assetsEditorView.model).to.equal(state.model);
      expect(state.view.el.querySelector("h3").textContent).to.equal(
        "Map configuration",
      );
      expect(
        state.view.el.querySelector(".map-editor__help").textContent,
      ).to.include("Save the portal");
      expect(state.view.el.contains(state.view.assetsEditorView.el)).to.equal(
        true,
      );
    });

    it("initializes a map when none is supplied", () => {
      const view = new MapEditorView();
      expect(view.model).to.be.instanceOf(Map);
      expect(view.el.dataset.category).to.equal("map");
      view.remove();
      view.model.stopListening();
    });

    it("delegates validation to the workspace and its imagery form", () => {
      state.model.getAllLayers()[0].isValid();
      state.view.showValidation();
      const workspace = state.view.assetsEditorView;
      expect(workspace.selectedAsset).to.equal(state.model.getAllLayers()[0]);
      const input = workspace.assetEditorView.el.querySelector(
        '[name="ionAssetId"]',
      );
      expect(document.activeElement).to.equal(input);
      expect(input.getAttribute("aria-invalid")).to.equal("true");
    });

    it("removes the previous workspace and its children when rerendered", () => {
      const previous = state.view.assetsEditorView;
      previous.selectAsset(state.model.getAllLayers()[0]);
      const form = previous.assetEditorView;
      const row = previous.assetItemViews[0];
      state.view.render();
      expect(previous.el.isConnected).to.equal(false);
      expect(form.el.isConnected).to.equal(false);
      expect(row.el.isConnected).to.equal(false);
      expect(state.view.assetsEditorView).not.to.equal(previous);
      state.model.getAllLayers()[0].set("label", "Renamed");
      expect(row.el.textContent).to.include("Incomplete");
      expect(state.view.assetsEditorView.el.textContent).to.include("Renamed");
    });

    it("removes its workspace, form, rows, and subscriptions on removal", () => {
      const workspace = state.view.assetsEditorView;
      workspace.selectAsset(state.model.getAllLayers()[0]);
      const form = workspace.assetEditorView;
      const row = workspace.assetItemViews[0];
      state.view.remove();
      expect(workspace.el.isConnected).to.equal(false);
      expect(form.el.isConnected).to.equal(false);
      expect(row.el.isConnected).to.equal(false);
      const markup = workspace.el.innerHTML;
      state.model.get("layers").reset([]);
      expect(workspace.el.innerHTML).to.equal(markup);
    });
  });
});
