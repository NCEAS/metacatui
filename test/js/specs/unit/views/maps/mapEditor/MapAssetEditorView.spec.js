define([
  "models/maps/assets/MapAsset",
  "models/maps/assets/CesiumImagery",
  "views/maps/mapEditor/MapAssetEditorView",
  "/test/js/specs/shared/clean-state.js",
], (MapAsset, CesiumImagery, MapAssetEditorView, cleanState) => {
  const expect = chai.expect;
  const { PROVIDER_TYPES } = CesiumImagery;

  describe("MapAssetEditorView", () => {
    const state = cleanState(() => {
      const sandbox = sinon.createSandbox();
      sandbox.stub(CesiumImagery.prototype, "createCesiumModelWhenVisible");
      const model = new CesiumImagery({
        label: "Original",
        description: "Existing description",
        type: PROVIDER_TYPES.WMTS,
        cesiumOptions: { url: "/tiles/{TileMatrix}/{TileCol}/{TileRow}.png" },
      });
      const view = new MapAssetEditorView({ model });
      const container = document.createElement("form");
      container.append(view.el);
      document.body.append(container);
      view.render();
      return { sandbox, model, view, container };
    }, beforeEach);

    const field = (name, root = state.view.el) =>
      root.querySelector(`[name="${name}"]`);
    const change = (name, value, root = state.view.el) => {
      const input = field(name, root);
      input.value = value;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    };

    afterEach(() => {
      state.view.remove();
      state.container.remove();
      state.model.stopListening();
      state.sandbox.restore();
    });

    it("edits a generic asset's metadata as text and keeps its source", () => {
      const asset = new MapAsset({
        type: "UnknownAsset",
        label: "Other <b>layer</b>",
        description: "</textarea><b>Existing description</b>",
        cesiumOptions: { url: "/source", parameters: { version: "1" } },
      });
      const before = asset.toConfig();
      const view = new MapAssetEditorView({ model: asset });
      state.container.append(view.el);
      try {
        view.render();
        expect(field("type", view.el)).to.equal(null);
        expect(field("label", view.el).value).to.equal("Other <b>layer</b>");
        expect(field("description", view.el).value).to.equal(
          "</textarea><b>Existing description</b>",
        );
        expect(view.el.querySelector("b")).to.equal(null);
        change("label", "Edited <b>label</b>", view.el);
        change("description", "Edited description", view.el);
        expect(asset.toConfig()).to.deep.equal({
          ...before,
          label: "Edited <b>label</b>",
          description: "Edited description",
        });
        view.showValidation();
      } finally {
        view.remove();
        asset.stopListening();
      }
    });

    it("keeps the WMS source when Label and Description change", () => {
      state.model.set({
        type: PROVIDER_TYPES.WMS,
        cesiumOptions: {
          url: "/wms",
          layers: "canopy",
          parameters: { time: "2020" },
        },
      });
      const before = state.model.toConfig();
      state.view.render();
      expect(field("type").value).to.equal("WebMapServiceImageryProvider");
      change("label", "Canopy");
      change("description", "Canopy observations");
      expect(state.model.toConfig()).to.deep.equal({
        ...before,
        label: "Canopy",
        description: "Canopy observations",
      });
    });

    it("removes the old imagery form and its handlers", () => {
      const previousURL = field("url");
      state.view.render();
      expect(previousURL.isConnected).to.equal(false);
      const before = state.model.toConfig();
      previousURL.value = "/detached";
      previousURL.dispatchEvent(new Event("change", { bubbles: true }));
      expect(state.model.toConfig()).to.deep.equal(before);
      const currentURL = field("url");
      state.view.remove();
      expect(currentURL.isConnected).to.equal(false);
    });

    it("focuses and selects the label through the form interface", () => {
      state.view.focusLabel();
      expect(document.activeElement).to.equal(field("label"));
      expect(field("label").selectionStart).to.equal(0);
      expect(field("label").selectionEnd).to.equal(field("label").value.length);
    });

    it("focuses the invalid imagery URL when validating the asset", () => {
      change("url", "/incomplete");
      field("label").focus();
      state.view.showValidation();
      expect(document.activeElement).to.equal(field("url"));
    });

    it("keeps edited metadata when switching imagery providers", () => {
      change("label", "Draft label");
      change("description", "Draft description");
      change("type", PROVIDER_TYPES.ION);
      expect(field("label").value).to.equal("Draft label");
      expect(field("description").value).to.equal("Draft description");
      const config = state.model.toConfig();
      expect(config.label).to.equal("Draft label");
      expect(config.description).to.equal("Draft description");
      expect(config.type).to.equal("IonImageryProvider");
    });

    it("keeps unfinished label edits during loading and error states", () => {
      field("label").value = "Still editing";
      state.model.set("status", "loading");
      expect(field("label").value).to.equal("Still editing");
      state.model.set("status", "error");
      expect(field("label").value).to.equal("Still editing");
      change("label", "Still editing");
      expect(state.model.get("label")).to.equal("Still editing");
    });
  });
});
