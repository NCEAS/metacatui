define([
  "models/maps/Map",
  "models/maps/assets/CesiumImagery",
  "models/portals/PortalModel",
  "views/maps/mapEditor/MapAssetsEditorView",
  "/test/js/specs/shared/clean-state.js",
], (Map, CesiumImagery, PortalModel, MapAssetsEditorView, cleanState) => {
  const expect = chai.expect;
  const WMTS = "WebMapTileServiceImageryProvider";
  const OSM = "OpenStreetMapImageryProvider";

  describe("MapAssetsEditorView", () => {
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
      const view = new MapAssetsEditorView({ model }).render();
      document.body.append(view.el);
      return { sandbox, model, view };
    }, beforeEach);

    const row = (index) =>
      state.view.el.querySelectorAll("[data-asset]")[index];
    const field = (name) =>
      state.view.el.querySelector(`.map-asset-editor [name="${name}"]`);
    const removeButton = (index) =>
      state.view.el.querySelectorAll("[data-remove-asset]")[index];

    afterEach(() => {
      state.view.remove();
      state.model.getAllLayers().forEach((asset) => asset.stopListening());
      state.model.stopListening();
      state.sandbox.restore();
    });

    it("keeps the active form when another layer is removed", () => {
      const [selected, other] = state.model.getAllLayers();
      row(0).click();
      const editor = state.view.assetEditorView;
      state.model.removeAsset(other);
      expect(state.view.selectedAsset).to.equal(selected);
      expect(state.view.assetEditorView).to.equal(editor);
      expect(editor.el.isConnected).to.equal(true);
    });

    it("keeps the active form when the layer collection resets around it", () => {
      const selected = state.model.getAllLayers()[0];
      state.view.selectAsset(selected);
      const editor = state.view.assetEditorView;
      const oldItem = state.view.assetItemViews[0];
      state.model.get("layers").reset([selected]);
      expect(state.view.selectedAsset).to.equal(selected);
      expect(state.view.assetEditorView).to.equal(editor);
      expect(editor.el.isConnected).to.equal(true);
      expect(oldItem.el.isConnected).to.equal(false);
      expect(row(0).getAttribute("aria-pressed")).to.equal("true");
      selected.set("label", "Updated after reset");
      expect(row(0).textContent).to.equal("Updated after reset");
      expect(oldItem.el.textContent).to.include("Imagery <b>one</b>");
    });

    it("clears selection when the selected asset leaves the collection", () => {
      const selected = state.model.getAllLayers()[0];
      state.view.selectAsset(selected);
      const editor = state.view.assetEditorView;
      state.model.get("layers").reset([]);
      expect(state.view.selectedAsset).to.equal(null);
      expect(state.view.assetEditorView).to.equal(null);
      expect(editor.el.isConnected).to.equal(false);
      expect(state.view.el.textContent).to.include("Select a layer");
    });

    it("uses the selected model even when presentation is changed externally", () => {
      const selected = state.model.getAllLayers()[0];
      state.view.selectAsset(selected);
      const editor = state.view.assetEditorView;
      row(0).setAttribute("aria-pressed", "false");
      state.view.selectAsset(selected);
      expect(state.view.assetEditorView).to.equal(editor);
      expect(row(0).getAttribute("aria-pressed")).to.equal("true");
    });

    it("starts a newly selected layer's form at the top", () => {
      const [first, second] = state.model.getAllLayers();
      second.set("type", WMTS);
      const panel = state.view.el.querySelector(".map-editor__panel");
      panel.style.cssText = "height: 100px; overflow: auto";
      state.view.selectAsset(first);
      panel.scrollTop = 150;
      expect(panel.scrollTop).to.be.greaterThan(0);

      state.view.selectAsset(second);
      expect(panel.scrollTop).to.equal(0);
      expect(field("label").value).to.equal(second.get("label"));
    });

    it("accepts row selection requests containing only the asset model", () => {
      const asset = state.model.getAllLayers()[0];
      state.view.assetItemViews[0].trigger("select:asset", asset);
      expect(state.view.selectedAsset).to.equal(asset);
      expect(state.view.assetEditorView.model).to.equal(asset);
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

    it("focuses the title on keyboard activation, including the selected layer", () => {
      const button = row(0);
      button.focus();
      expect(state.view.assetEditorView).to.equal(null);
      button.dispatchEvent(
        new MouseEvent("click", { bubbles: true, detail: 0 }),
      );
      expect(document.activeElement).to.equal(field("label"));
      const editor = state.view.assetEditorView;

      button.focus();
      button.dispatchEvent(
        new MouseEvent("click", { bubbles: true, detail: 0 }),
      );
      expect(state.view.assetEditorView).to.equal(editor);
      expect(document.activeElement).to.equal(field("label"));
    });

    it("keeps focus on the layer button after pointer activation", () => {
      const button = row(0);
      button.focus();
      button.dispatchEvent(
        new MouseEvent("click", { bubbles: true, detail: 1 }),
      );
      expect(state.view.assetEditorView.model).to.equal(
        state.model.getAllLayers()[0],
      );
      expect(document.activeElement).to.equal(button);
    });

    it("adds a WMTS layer and opens its settings with the label selected", () => {
      const originalLayers = state.model.toConfig().layers;
      row(0).click();
      const previousEditor = state.view.assetEditorView;
      const buttons = state.view.el.querySelectorAll("[data-add-layer]");
      expect(buttons).to.have.length(1);
      buttons[0].click();

      const asset = state.model.getAllLayers()[3];
      expect(asset.get("mapModel")).to.equal(state.model);
      expect(state.model.get("allLayers").models).to.include(asset);
      expect(asset.get("type")).to.equal(WMTS);
      expect(asset.get("cesiumOptions")).to.deep.equal({ url: "" });
      expect(state.model.toConfig().layers.slice(0, 3)).to.deep.equal(
        originalLayers,
      );
      expect(previousEditor.el.isConnected).to.equal(false);
      expect(state.view.assetEditorView.model).to.equal(asset);
      expect(row(3).getAttribute("aria-pressed")).to.equal("true");
      expect(row(0).getAttribute("aria-pressed")).to.equal("false");
      expect(field("url").value).to.equal("");
      expect(field("url").hasAttribute("aria-invalid")).to.equal(false);
      expect(document.activeElement).to.equal(field("label"));
      expect(field("label").value).to.equal("New layer");
      expect(field("label").selectionStart).to.equal(0);
      expect(field("label").selectionEnd).to.equal(9);
    });

    it("retains new layer edits across additions and ordinary selection", () => {
      state.view.el.querySelector("[data-add-layer]").click();
      field("label").value = "First new layer";
      field("label").dispatchEvent(new Event("change", { bubbles: true }));
      state.view.el.querySelector("[data-add-layer]").click();

      expect(state.model.getAllLayers()).to.have.length(5);
      expect(row(3).textContent).to.equal("First new layer");
      expect(row(4).getAttribute("aria-pressed")).to.equal("true");
      row(3).focus();
      row(3).dispatchEvent(
        new MouseEvent("click", { bubbles: true, detail: 1 }),
      );
      expect(document.activeElement).to.equal(row(3));
      expect(field("label").value).to.equal("First new layer");
    });

    it("adds to the chosen empty category and retains the other categories", () => {
      state.view.remove();
      state.model = new Map({
        layerCategories: [
          { label: "Base <b>maps</b>", layers: [{ label: "OSM", type: OSM }] },
          { label: "Overlays", layers: [] },
        ],
      });
      state.view = new MapAssetsEditorView({ model: state.model }).render();
      document.body.append(state.view.el);
      const buttons = state.view.el.querySelectorAll("[data-add-layer]");
      expect(buttons).to.have.length(2);
      expect(buttons[0].getAttribute("aria-label")).to.equal(
        "Add layer to Base <b>maps</b>",
      );
      expect(buttons[1].getAttribute("aria-label")).to.equal(
        "Add layer to Overlays",
      );
      buttons[1].click();

      const categories = state.model.toConfig().layerCategories;
      expect(categories[0].layers.map((layer) => layer.label)).to.deep.equal([
        "OSM",
      ]);
      expect(categories[1].layers.map((layer) => layer.label)).to.deep.equal([
        "New layer",
      ]);
      expect(state.view.assetEditorView.model).to.equal(
        state.model.get("layerCategories").at(1).get("mapAssets").at(0),
      );
      expect(document.activeElement).to.equal(field("label"));
    });

    [
      {
        name: "WMTS",
        type: WMTS,
        fieldName: "url",
        value: "/tiles/{TileMatrix}/{TileCol}/{TileRow}",
        options: { url: "/tiles/{TileMatrix}/{TileCol}/{TileRow}" },
      },
      {
        name: "Cesium Ion",
        type: "IonImageryProvider",
        fieldName: "ionAssetId",
        value: "2",
        options: { ionAssetId: "2" },
      },
      {
        name: "OpenStreetMap",
        type: OSM,
        options: { url: "https://tile.openstreetmap.org/" },
      },
    ].forEach(({ name, type, fieldName, value, options }) => {
      it(`saves a new ${name} layer through portal XML and reloads it`, () => {
        state.view.remove();
        state.model = new Map({ layers: [] });
        state.view = new MapAssetsEditorView({ model: state.model }).render();
        document.body.append(state.view.el);
        const portal = new PortalModel({
          label: "map-portal",
          name: "Map portal",
        });
        portal
          .get("definitionFilters")
          .add({ fields: ["formatType"], values: ["METADATA"] });
        portal
          .addSection("cesium")
          .set({ label: "Map", mapModel: state.model });
        state.view.el.querySelector("[data-add-layer]").click();
        expect(state.view.el.querySelector(".map-editor__empty")).to.equal(
          null,
        );
        expect(portal.isValid()).to.equal(false);
        field("type").value = type;
        field("type").dispatchEvent(new Event("change", { bubbles: true }));
        if (fieldName) {
          field(fieldName).value = value;
          field(fieldName).dispatchEvent(
            new Event("change", { bubbles: true }),
          );
        }
        expect(portal.isValid()).to.equal(true);

        const xml = new DOMParser().parseFromString(
          portal.serialize(),
          "application/xml",
        );
        expect(xml.querySelector("parsererror")).to.equal(null);
        const reloaded = new PortalModel({});
        reloaded.set(reloaded.parse(xml));
        delete window.filterXML;
        const map = reloaded.get("sections")[0].get("mapModel");
        const asset = map.getAllLayers()[0];
        expect(map.getAllLayers()).to.have.length(1);
        expect(asset.get("label")).to.equal("New layer");
        expect(asset.get("type")).to.equal(type);
        expect(asset.get("cesiumOptions")).to.deep.equal(options);
        map.getAllLayers().forEach((layer) => layer.stopListening());
        map.stopListening();
        portal.stopListening();
        reloaded.stopListening();
      });
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

    it("immediately removes the selected hidden layer and clears its settings", () => {
      const asset = state.model.getAllLayers()[0];
      row(0).click();
      const editor = state.view.assetEditorView;
      removeButton(0).click();

      expect(state.model.getAllLayers()).not.to.include(asset);
      expect(
        state.model.toConfig().layers.map((layer) => layer.label),
      ).to.deep.equal(["Basemap", "Other layer"]);
      expect(editor.el.isConnected).to.equal(false);
      expect(state.view.assetEditorView).to.equal(null);
      expect(state.view.el.textContent).to.include("Select a layer");
      expect(document.activeElement).to.equal(row(0));
    });

    it("removes an unsupported layer while retaining the current selection", () => {
      const asset = state.model.getAllLayers()[0];
      row(0).click();
      field("label").value = "Edited imagery";
      field("label").dispatchEvent(new Event("change", { bubbles: true }));
      removeButton(2).click();

      expect(state.model.getAllLayers()).to.have.length(2);
      expect(state.view.assetEditorView.model).to.equal(asset);
      expect(field("label").value).to.equal("Edited imagery");
      expect(row(0).getAttribute("aria-pressed")).to.equal("true");
      expect(document.activeElement).to.equal(row(1));
    });

    it("updates the remove button's accessible name when the layer label changes", () => {
      const asset = state.model.getAllLayers()[0];
      const button = removeButton(0);
      expect(button.getAttribute("aria-label")).to.equal(
        "Remove Imagery <b>one</b>",
      );

      asset.set("label", "Renamed layer");
      expect(button.getAttribute("aria-label")).to.equal(
        "Remove Renamed layer",
      );
    });

    it("retains an empty category after removing its only layer", () => {
      state.view.remove();
      state.model = new Map({
        layerCategories: [
          { label: "Base maps", layers: [{ label: "OSM", type: OSM }] },
          { label: "Overlays", layers: [{ label: "Other", type: "Unknown" }] },
        ],
      });
      state.view = new MapAssetsEditorView({ model: state.model }).render();
      document.body.append(state.view.el);
      removeButton(1).click();

      const categories = state.model.toConfig().layerCategories;
      expect(categories).to.have.length(2);
      expect(categories[0].layers.map((layer) => layer.label)).to.deep.equal([
        "OSM",
      ]);
      expect(categories[1].layers).to.deep.equal([]);
      expect(state.view.el.textContent).to.include("Overlays");
      expect(document.activeElement).to.equal(row(0));
    });

    [
      {
        name: "flat",
        config: { layers: [{ label: "Only layer", type: OSM }] },
      },
      {
        name: "categorized",
        config: {
          layerCategories: [
            {
              label: "Base maps",
              layers: [{ label: "Only layer", type: OSM }],
            },
          ],
        },
      },
    ].forEach(({ name, config }) => {
      it(`saves removal of the final ${name} layer through portal XML`, () => {
        state.view.remove();
        state.model = new Map(config);
        state.view = new MapAssetsEditorView({ model: state.model }).render();
        document.body.append(state.view.el);
        const portal = new PortalModel({ label: "Map portal" });
        portal
          .get("definitionFilters")
          .add({ fields: ["formatType"], values: ["METADATA"] });
        portal
          .addSection("cesium")
          .set({ label: "Map", mapModel: state.model });
        removeButton(0).click();

        expect(state.model.getAllLayers()).to.have.length(0);
        expect(document.activeElement.textContent).to.equal(
          "No layers configured.",
        );
        expect(state.view.el.contains(document.activeElement)).to.equal(true);
        const xml = new DOMParser().parseFromString(
          portal.serialize(),
          "application/xml",
        );
        expect(xml.querySelector("parsererror")).to.equal(null);
        const reloaded = new PortalModel({});
        reloaded.set(reloaded.parse(xml));
        delete window.filterXML;
        const map = reloaded.get("sections")[0].get("mapModel");
        expect(map.getAllLayers()).to.have.length(0);
        if (name === "categorized") {
          expect(map.toConfig().layerCategories).to.have.length(1);
          expect(map.toConfig().layerCategories[0].layers).to.deep.equal([]);
        } else {
          expect(map.toConfig().layers).to.deep.equal([]);
        }
        map.stopListening();
      });
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
      state.view = new MapAssetsEditorView({ model: state.model }).render();
      document.body.append(state.view.el);
      expect(state.view.el.textContent).to.include("Base <b>maps</b>");
      expect(state.view.el.querySelector("b")).to.equal(null);
      row(0).click();
      expect(state.view.assetEditorView.model).to.equal(
        state.model.get("layerCategories").at(0).get("mapAssets").at(0),
      );
    });

    describe("category disclosures", () => {
      const toggle = (index) =>
        state.view.el.querySelectorAll("[data-toggle-category]")[index];
      const content = (index) =>
        state.view.el.querySelectorAll(".expansion-panel__content")[index];

      beforeEach(() => {
        state.view.remove();
        state.model = new Map({
          layerCategories: [
            {
              label: "Water <b>layers</b>",
              expanded: false,
              layers: [
                {
                  label: "Surface water",
                  type: WMTS,
                  cesiumOptions: {
                    url: "/tiles/{TileMatrix}/{TileCol}/{TileRow}",
                  },
                },
              ],
            },
            {
              label: "Base maps",
              expanded: true,
              layers: [{ label: "OSM", type: OSM }],
            },
          ],
        });
        state.view = new MapAssetsEditorView({ model: state.model }).render();
        document.body.append(state.view.el);
      });

      it("starts all categories expanded with named disclosure buttons", () => {
        expect(
          state.view.el.querySelectorAll("[data-toggle-category]"),
        ).to.have.length(2);
        [0, 1].forEach((index) => {
          expect(toggle(index).tagName).to.equal("BUTTON");
          expect(toggle(index).getAttribute("aria-expanded")).to.equal("true");
          expect(toggle(index).getAttribute("aria-controls")).to.equal(
            content(index).id,
          );
          expect(content(index).hidden).to.equal(false);
        });
        expect(toggle(0).textContent).to.include("Water <b>layers</b>");
        expect(toggle(0).querySelector("b")).to.equal(null);
      });

      it("collapses independently without replacing settings or saving state", () => {
        const config = state.model.toConfig();
        row(0).click();
        const editor = state.view.assetEditorView;
        toggle(0).focus();
        toggle(0).click();
        expect(toggle(0).getAttribute("aria-expanded")).to.equal("false");
        expect(content(0).hidden).to.equal(true);
        expect(content(0).querySelector("[data-add-layer]")).not.to.equal(null);
        expect(toggle(1).getAttribute("aria-expanded")).to.equal("true");
        expect(document.activeElement).to.equal(toggle(0));
        expect(state.view.assetEditorView).to.equal(editor);
        expect(editor.el.isConnected).to.equal(true);
        expect(state.model.toConfig()).to.deep.equal(config);
        toggle(0).click();
        expect(content(0).hidden).to.equal(false);
      });

      it("retains collapsed categories across additions and removals", () => {
        toggle(0).click();
        state.view.el.querySelectorAll("[data-add-layer]")[1].click();
        expect(toggle(0).getAttribute("aria-expanded")).to.equal("false");
        expect(content(0).hidden).to.equal(true);
        removeButton(2).click();
        expect(content(0).hidden).to.equal(true);
        expect(toggle(1).getAttribute("aria-expanded")).to.equal("true");
      });

      it("opens a collapsed category when validation reveals its layer", () => {
        row(0).click();
        const editor = state.view.assetEditorView;
        field("url").value = "/incomplete";
        field("url").dispatchEvent(new Event("change", { bubbles: true }));
        toggle(0).click();
        expect(state.model.getAllLayers()[0].isValid()).to.equal(false);
        state.view.showValidation();
        expect(content(0).hidden).to.equal(false);
        expect(toggle(0).getAttribute("aria-expanded")).to.equal("true");
        expect(state.view.assetEditorView).to.equal(editor);
        expect(document.activeElement).to.equal(field("url"));
        expect(field("url").getAttribute("aria-invalid")).to.equal("true");
      });

      it("opens a collapsed category before focusing the next row after removal", () => {
        toggle(1).click();
        removeButton(0).click();
        expect(content(1).hidden).to.equal(false);
        expect(toggle(1).getAttribute("aria-expanded")).to.equal("true");
        expect(document.activeElement).to.equal(row(0));
      });

      it("updates a loaded category icon without replacing focused controls", () => {
        expect(toggle(0)).not.to.equal(undefined);
        const category = state.model.get("layerCategories").at(0);
        const button = toggle(0);
        button.focus();
        category.updateIcon(
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>',
        );
        expect(button.querySelector("svg path").getAttribute("d")).to.equal(
          "M0 0h24v24H0z",
        );
        expect(
          button
            .querySelector(".expansion-panel__icon")
            .getAttribute("aria-hidden"),
        ).to.equal("true");
        expect(document.activeElement).to.equal(button);
      });
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
