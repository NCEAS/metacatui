define([
  "models/maps/Map",
  "models/maps/assets/CesiumImagery",
  "models/portals/PortalVizSectionModel",
  "views/portals/editor/PortEditorMapSectionView",
  "/test/js/specs/shared/clean-state.js",
], (
  Map,
  CesiumImagery,
  PortalVizSectionModel,
  PortEditorMapSectionView,
  cleanState,
) => {
  const expect = chai.expect;
  const OSM = "OpenStreetMapImageryProvider";

  describe("PortEditorMapSectionView", () => {
    const state = cleanState(() => {
      const sandbox = sinon.createSandbox();
      sandbox.stub(CesiumImagery.prototype, "createCesiumModelWhenVisible");
      sandbox.stub(CesiumImagery.prototype, "getThumbnail");
      const model = new Map({
        layers: [
          { label: "Water", type: OSM },
          { label: "Roads", type: OSM },
        ],
      });
      const section = new PortalVizSectionModel({
        visualizationType: "cesium",
        mapModel: model,
      });
      const showControls = sandbox.spy();
      const view = new PortEditorMapSectionView({
        model: section,
        editorView: { showControls },
      }).render();
      document.body.append(view.el);
      return { sandbox, model, section, showControls, view };
    }, beforeEach);

    afterEach(() => {
      state.view.remove();
      state.model.getAllLayers().forEach((asset) => asset.stopListening());
      state.model.stopListening();
      state.section.stopListening();
      state.sandbox.restore();
    });

    it("shows Save for assigned layer IDs but not unchanged rerenders", () => {
      expect(state.showControls.called).to.equal(true);
      state.showControls.resetHistory();

      state.view.render();

      expect(state.showControls.called).to.equal(false);
    });

    it("shows Save when a generic layer's Label or Description changes", () => {
      const asset = state.model
        .get("layers")
        .addAsset({ type: "UnknownAsset", label: "Other layer" }, state.model);
      const workspace = state.view.mapEditorView.assetsEditorView;
      workspace.selectAsset(asset);
      ["label", "description"].forEach((name) => {
        state.showControls.resetHistory();
        const input = workspace.assetEditorView.el.querySelector(
          `[name="${name}"]`,
        );
        input.value = `Edited ${name}`;
        input.dispatchEvent(new Event("change", { bubbles: true }));
        expect(asset.get(name)).to.equal(`Edited ${name}`);
        expect(state.showControls.calledOnce).to.equal(true);
      });
    });

    it("reveals Save for a reorder but not an unchanged move", () => {
      const layers = state.model.get("layers");
      const asset = layers.at(0);
      state.showControls.resetHistory();
      state.model.moveAsset(asset, layers, 1);
      expect(state.showControls.calledOnce).to.equal(true);
      state.showControls.resetHistory();
      state.model.moveAsset(asset, layers, 1);
      expect(state.showControls.called).to.equal(false);
    });

    it("stops listening for layer resets when removed", () => {
      const layers = state.model.get("layers");
      state.view.remove();
      state.showControls.resetHistory();
      layers.reset([layers.at(1), layers.at(0)]);
      expect(state.showControls.called).to.equal(false);
    });
  });
});
