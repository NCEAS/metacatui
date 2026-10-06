define([
  "models/maps/Map",
  "models/maps/assets/CesiumImagery",
  "models/portals/PortalModel",
  "views/maps/mapEditor/MapEditorView",
  "/test/js/specs/shared/clean-state.js",
], (Map, CesiumImagery, PortalModel, MapEditorView, cleanState) => {
  const expect = chai.expect;
  const WMTS = "WebMapTileServiceImageryProvider";
  const OSM = "OpenStreetMapImageryProvider";

  describe("MapEditorView", () => {
    const state = cleanState(() => {
      const sandbox = sinon.createSandbox();
      sandbox.stub(CesiumImagery.prototype, "createCesiumModelWhenVisible");
      sandbox.stub(CesiumImagery.prototype, "getThumbnail");
      const model = new Map({
        layers: [
          {
            label: "Imagery <b>one</b>",
            type: WMTS,
            hideInLayerList: true,
            cesiumOptions: { url: "/tiles/{TileMatrix}/{TileCol}/{TileRow}" },
          },
          { label: "Basemap", type: OSM },
          { label: "Other layer", type: "UnknownAsset" },
        ],
      });
      const view = new MapEditorView({ model }).render();
      document.body.append(view.el);
      return { sandbox, model, view };
    }, beforeEach);

    const row = (index) =>
      state.view.el.querySelectorAll("[data-asset]")[index];
    const field = (name) =>
      state.view.el.querySelector(`.map-asset-editor [name="${name}"]`);

    afterEach(() => {
      state.view.remove();
      state.model.getAllLayers().forEach((asset) => asset.stopListening());
      state.model.stopListening();
      state.sandbox.restore();
    });

    it("exposes hidden layers with literal labels and no initial editor", () => {
      expect(state.view.el.querySelectorAll("[data-asset]")).to.have.length(3);
      expect(row(0).textContent).to.equal("Imagery <b>one</b>");
      expect(row(0).querySelector("b")).to.equal(null);
      expect(state.view.el.querySelector(".map-asset-editor")).to.equal(null);
      expect(state.view.el.textContent).to.include("Select a layer");
    });

    it("edits the owned asset without changing map visibility or selection", () => {
      const asset = state.model.getAllLayers()[0];
      const visible = asset.get("visible");
      row(0).click();
      expect(state.view.assetEditorView.model).to.equal(asset);
      expect(field("label").value).to.equal("Imagery <b>one</b>");
      expect(row(0).getAttribute("aria-pressed")).to.equal("true");
      expect(asset.get("selected")).to.equal(false);
      expect(asset.get("visible")).to.equal(visible);
    });

    it("retains field changes when selecting another layer", () => {
      row(0).click();
      const firstEditor = state.view.assetEditorView;
      field("label").value = "Edited label";
      field("label").dispatchEvent(new Event("change", { bubbles: true }));
      field("url").value = "/incomplete";
      field("url").dispatchEvent(new Event("change", { bubbles: true }));
      row(0).click();
      expect(field("label").value).to.equal("Edited label");
      row(1).click();
      expect(firstEditor.el.isConnected).to.equal(false);
      expect(state.view.assetEditorView.model).to.equal(
        state.model.getAllLayers()[1],
      );
      row(0).click();
      expect(field("label").value).to.equal("Edited label");
      expect(field("url").value).to.equal("/incomplete");
    });

    it("updates the list after field changes without replacing the form", () => {
      row(0).click();
      const editor = state.view.assetEditorView;
      field("label").value = "Accepted label";
      field("label").dispatchEvent(new Event("change", { bubbles: true }));
      field("url").value = "/new/{TileMatrix}/{TileCol}/{TileRow}";
      field("url").dispatchEvent(new Event("change", { bubbles: true }));
      expect(row(0).textContent).to.equal("Accepted label");
      expect(state.view.assetEditorView).to.equal(editor);
      expect(state.model.toConfig().layers[0].cesiumOptions.url).to.equal(
        "/new/{TileMatrix}/{TileCol}/{TileRow}",
      );
    });

    it("shows unsupported layers without mounting an imagery editor", () => {
      row(0).click();
      const firstEditor = state.view.assetEditorView;
      row(2).click();
      expect(firstEditor.el.isConnected).to.equal(false);
      expect(state.view.el.querySelector(".map-asset-editor")).to.equal(null);
      expect(state.view.el.textContent).to.include("not supported yet");
    });

    it("cleans up the editor on rerender, asset removal, and view removal", () => {
      row(0).click();
      const firstEditor = state.view.assetEditorView;
      state.view.render();
      expect(firstEditor.el.isConnected).to.equal(false);
      row(0).click();
      const removedEditor = state.view.assetEditorView;
      state.model.removeAsset(state.model.getAllLayers()[0]);
      expect(removedEditor.el.isConnected).to.equal(false);
      expect(state.view.el.querySelectorAll("[data-asset]")).to.have.length(2);

      row(0).click();
      const lastEditor = state.view.assetEditorView;
      const lastRow = row(0);
      const asset = state.model.getAllLayers()[0];
      state.view.remove();
      expect(lastEditor.el.isConnected).to.equal(false);
      asset.set("label", "After removal");
      expect(lastRow.textContent).to.equal("Basemap");
    });

    it("retains category labels and edits the same categorized asset", () => {
      state.view.remove();
      state.model = new Map({
        layerCategories: [
          { label: "Base <b>maps</b>", layers: [{ label: "OSM", type: OSM }] },
          { label: "Overlays", layers: [{ label: "Other", type: "Unknown" }] },
        ],
      });
      state.view = new MapEditorView({ model: state.model }).render();
      document.body.append(state.view.el);
      expect(state.view.el.textContent).to.include("Base <b>maps</b>");
      expect(state.view.el.querySelector("b")).to.equal(null);
      row(0).click();
      expect(state.view.assetEditorView.model).to.equal(
        state.model.get("layerCategories").at(0).get("mapAssets").at(0),
      );
    });

    it("saves provider field changes through portal XML and reloads them", () => {
      const portal = new PortalModel({});
      portal.set("label", "Map portal");
      portal.get("definitionFilters").add({
        fields: ["formatType"],
        values: ["METADATA"],
      });
      const section = portal.addSection("cesium");
      section.set({ label: "Map", mapModel: state.model });
      row(0).click();
      field("type").value = "IonImageryProvider";
      field("type").dispatchEvent(new Event("change", { bubbles: true }));
      field("ionAssetId").value = "2";
      field("ionAssetId").dispatchEvent(new Event("change", { bubbles: true }));

      const xml = new DOMParser().parseFromString(
        portal.serialize(),
        "application/xml",
      );
      expect(xml.querySelector("parsererror")).to.equal(null);
      const reloaded = new PortalModel({});
      reloaded.set(reloaded.parse(xml));
      // FilterGroup.parse currently leaks its temporary XML clone globally.
      delete window.filterXML;
      const asset = reloaded
        .get("sections")[0]
        .get("mapModel")
        .getAllLayers()[0];
      expect(asset.get("type")).to.equal("IonImageryProvider");
      expect(asset.get("cesiumOptions")).to.deep.equal({ ionAssetId: "2" });
    });
  });
});
