define([
  "sortable",
  "models/maps/Map",
  "models/maps/assets/CesiumImagery",
  "models/portals/PortalModel",
  "views/maps/mapEditor/MapAssetsEditorView",
  "/test/js/specs/shared/clean-state.js",
], (
  Sortable,
  Map,
  CesiumImagery,
  PortalModel,
  MapAssetsEditorView,
  cleanState,
) => {
  const expect = chai.expect;
  const { CLASS_NAMES } = MapAssetsEditorView;
  const WMTS = "WebMapTileServiceImageryProvider";
  const OSM = "OpenStreetMapImageryProvider";
  const icon =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>';

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
    const field = (name) => state.view.el.querySelector(`[name="${name}"]`);
    const removeButton = (index) =>
      state.view.el.querySelectorAll("[data-remove-asset]")[index];
    const grip = (index) =>
      state.view.el.querySelectorAll("[data-move-asset]")[index];
    const moveControls = () =>
      state.view.el.querySelector(`.${CLASS_NAMES.MOVE_CONTROLS}`);
    const status = () =>
      state.view.el.querySelector(`.${CLASS_NAMES.MOVE_STATUS}`);
    const layerList = (index = 0) =>
      state.view.el.querySelectorAll(`.${CLASS_NAMES.LAYER_LIST}`)[index];

    const renderMap = (config) => {
      state.view.remove();
      state.model.getAllLayers().forEach((asset) => asset.stopListening());
      state.model.stopListening();
      state.model = new Map(config);
      state.view = new MapAssetsEditorView({ model: state.model }).render();
      document.body.append(state.view.el);
    };

    const changeField = (name, value) => {
      const input = field(name);
      input.value = value;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    };

    afterEach(() => {
      state.view.remove();
      state.model.getAllLayers().forEach((asset) => asset.stopListening());
      state.model.stopListening();
      state.sandbox.restore();
    });

    describe("dragging", () => {
      [
        { from: 0, to: 2, order: [1, 2, 0] },
        { from: 2, to: 0, order: [2, 0, 1] },
      ].forEach(({ from, to, order }) => {
        it(`saves a drag from position ${from + 1} to ${to + 1} and keeps the invalid form`, () => {
          const layers = state.model.get("layers");
          const original = layers.models.slice();
          const dragged = row(from).closest("li");
          state.view.selectAsset(original[0]);
          const editor = state.view.assetEditorView;
          const url = field("url");
          changeField("url", "/incomplete");
          original[0].isValid();
          const list = layerList();
          const otherRows = Array.from(list.children).filter(
            (el) => el !== dragged,
          );
          list.insertBefore(dragged, otherRows[to] || null);
          Sortable.get(list).option("onEnd")({
            item: dragged,
            to: list,
            newDraggableIndex: to,
          });

          expect(layers.models).to.deep.equal(
            order.map((index) => original[index]),
          );
          expect(row(to).closest("li")).to.equal(dragged);
          expect(document.activeElement).to.equal(
            dragged.querySelector("[data-move-asset]"),
          );
          expect(status().textContent).to.include(`position ${to + 1} of 3`);
          expect(state.view.assetEditorView).to.equal(editor);
          expect(field("url")).to.equal(url);
          expect(url.getAttribute("aria-invalid")).to.equal("true");
          expect(url.value).to.equal("/incomplete");
          expect(moveControls().hidden).to.equal(true);
        });
      });

      it("keeps config and feedback unchanged after a drop in the same position", () => {
        const config = state.model.toConfig();
        const layers = state.model.get("layers");
        const resets = state.sandbox.spy();
        layers.on("reset", resets);
        const dragged = row(1).closest("li");
        status().textContent = "Previous movement";
        Sortable.get(layerList()).option("onEnd")({
          item: dragged,
          to: layerList(),
          newDraggableIndex: 1,
        });
        expect(state.model.toConfig()).to.deep.equal(config);
        expect(resets.called).to.equal(false);
        expect(status().textContent).to.equal("Previous movement");
        expect(document.activeElement).to.equal(grip(1));
        expect(moveControls().hidden).to.equal(true);
      });

      it("keeps a drop on the last layer silent when Sortable counts its fallback ghost", () => {
        const layers = state.model.get("layers");
        const dragged = row(2).closest("li");
        const resets = state.sandbox.spy();
        layers.on("reset", resets);
        Sortable.get(layerList()).option("onEnd")({
          item: dragged,
          to: layerList(),
          newDraggableIndex: 3,
        });
        expect(resets.called).to.equal(false);
        expect(status().textContent).to.equal("");
        expect(document.activeElement).to.equal(grip(2));
      });

      it("closes Move controls on drag start and keeps them closed on drop", () => {
        grip(0).click();
        const sortable = Sortable.get(layerList());
        sortable.option("onStart")();
        expect(moveControls().hidden).to.equal(true);
        expect(grip(0).getAttribute("aria-expanded")).to.equal("false");
        sortable.option("onEnd")({
          item: row(0).closest("li"),
          to: layerList(),
          newDraggableIndex: 0,
        });
        expect(moveControls().hidden).to.equal(true);
        expect(document.activeElement).to.equal(grip(0));
      });
    });

    describe("Move controls", () => {
      [0, 1].forEach((detail) => {
        it(`opens named Move controls on a click with detail ${detail} without changing settings`, () => {
          row(0).click();
          const editor = state.view.assetEditorView;
          const button = grip(2);
          button.dispatchEvent(
            new MouseEvent("click", { bubbles: true, detail }),
          );
          const controls = moveControls();
          const up = controls.querySelector('[data-move-direction="-1"]');
          const down = controls.querySelector('[data-move-direction="1"]');
          expect(controls.hidden).to.equal(false);
          expect(controls.parentElement).to.equal(button.parentElement);
          expect(controls.getAttribute("role")).to.equal("group");
          expect(controls.getAttribute("aria-label")).to.include("Other layer");
          expect(button.getAttribute("aria-controls")).to.equal(controls.id);
          expect(button.getAttribute("aria-expanded")).to.equal("true");
          expect(up.disabled).to.equal(false);
          expect(down.disabled).to.equal(true);
          expect(document.activeElement).to.equal(up);
          expect(
            controls.querySelector("[data-move-category-controls]").hidden,
          ).to.equal(true);
          expect(state.view.assetEditorView).to.equal(editor);
          expect(state.view.selectedAsset).to.equal(
            state.model.getAllLayers()[0],
          );
        });
      });

      [
        {
          from: 1,
          direction: -1,
          to: 0,
        },
        {
          from: 0,
          direction: 1,
          to: 1,
        },
      ].forEach(({ from, direction, to }) => {
        it(`moves a layer ${direction === -1 ? "up" : "down"} and returns focus to its grip`, () => {
          const button = grip(from);
          button.click();
          moveControls()
            .querySelector(`[data-move-direction="${direction}"]`)
            .click();
          expect(
            state.model.getAllLayers().map((asset) => asset.get("label")),
          ).to.deep.equal(["Basemap", "Imagery <b>one</b>", "Other layer"]);
          expect(document.activeElement).to.equal(button);
          expect(button.getAttribute("aria-expanded")).to.equal("false");
          expect(moveControls().hidden).to.equal(true);
          expect(status().textContent).to.include(`position ${to + 1} of 3`);
        });
      });

      ["Escape", "Close", "grip"].forEach((action) => {
        it(`closes with ${action} and returns focus to the grip`, () => {
          const button = grip(1);
          button.click();
          if (action === "Escape") {
            const event = new KeyboardEvent("keydown", {
              key: "Escape",
              bubbles: true,
              cancelable: true,
            });
            document.activeElement.dispatchEvent(event);
            expect(event.defaultPrevented).to.equal(true);
          } else if (action === "Close") {
            moveControls().querySelector("[data-close-move]").click();
          } else button.click();
          expect(moveControls().hidden).to.equal(true);
          expect(button.getAttribute("aria-expanded")).to.equal("false");
          expect(document.activeElement).to.equal(button);
        });
      });

      it("closes when focus leaves and keeps the new focus", () => {
        grip(1).click();
        const close = moveControls().querySelector("[data-close-move]");
        close.focus();
        expect(moveControls().hidden).to.equal(false);
        row(2).focus();
        expect(moveControls().hidden).to.equal(true);
        expect(document.activeElement).to.equal(row(2));
      });

      it("reuses the controls when another grip opens them", () => {
        const first = grip(0);
        first.click();
        const controls = moveControls();
        const second = grip(1);
        second.click();
        expect(moveControls()).to.equal(controls);
        expect(first.getAttribute("aria-expanded")).to.equal("false");
        expect(second.getAttribute("aria-expanded")).to.equal("true");
        expect(controls.parentElement).to.equal(second.parentElement);
      });

      it("disables both arrows for one flat layer and focuses Close", () => {
        state.model.get("layers").reset([state.model.getAllLayers()[0]]);
        grip(0).click();
        expect(
          moveControls().querySelector('[data-move-direction="-1"]').disabled,
        ).to.equal(true);
        expect(
          moveControls().querySelector('[data-move-direction="1"]').disabled,
        ).to.equal(true);
        expect(document.activeElement).to.equal(
          moveControls().querySelector("[data-close-move]"),
        );
      });

      it("keeps the controls available after their layer is removed", () => {
        grip(1).click();
        const controls = moveControls();
        state.model.removeAsset(state.model.getAllLayers()[1]);
        expect(controls.isConnected).to.equal(true);
        expect(controls.hidden).to.equal(true);
        grip(1).click();
        expect(moveControls()).to.equal(controls);
        expect(controls.getAttribute("aria-label")).to.include("Other layer");
      });

      it("closes Move controls before rerendering or removing the workspace", () => {
        const first = grip(0);
        first.click();
        const controls = moveControls();
        state.view.render();
        expect(first.getAttribute("aria-expanded")).to.equal("false");
        expect(controls.isConnected).to.equal(false);
        grip(0).click();
        const second = grip(0);
        const secondControls = moveControls();
        state.view.remove();
        expect(second.getAttribute("aria-expanded")).to.equal("false");
        expect(secondControls.isConnected).to.equal(false);
      });
    });

    it("keeps the active form when the layer collection resets around it", () => {
      const selected = state.model.getAllLayers()[0];
      state.view.selectAsset(selected);
      const editor = state.view.assetEditorView;
      const button = row(0);
      state.model.get("layers").reset([selected]);
      expect(state.view.selectedAsset).to.equal(selected);
      expect(state.view.assetEditorView).to.equal(editor);
      expect(editor.el.isConnected).to.equal(true);
      expect(row(0)).to.equal(button);
      expect(row(0).getAttribute("aria-pressed")).to.equal("true");
      selected.set("label", "Updated after reset");
      expect(row(0).textContent).to.equal("Updated after reset");
    });

    it("preserves existing rows and focus across unrelated additions and removals", () => {
      const first = row(0);
      const second = row(1);
      const list = layerList();
      const sortable = Sortable.get(list);
      const add = state.view.el.querySelector("[data-add-layer]");
      second.focus();
      const added = state.model
        .get("layers")
        .addAsset({ label: "Extra", type: OSM }, state.model);
      expect(row(0)).to.equal(first);
      expect(row(1)).to.equal(second);
      expect(second.closest("ul")).to.equal(list);
      expect(state.view.el.querySelector("[data-add-layer]")).to.equal(add);
      expect(list.contains(add)).to.equal(false);
      expect(document.activeElement).to.equal(row(1));
      state.model.removeAsset(added);
      expect(row(1)).to.equal(second);
      expect(document.activeElement).to.equal(row(1));
      expect(Sortable.get(list)).to.equal(sortable);
    });

    it("clears selection when the selected asset leaves the collection", () => {
      const selected = state.model.getAllLayers()[0];
      const panel = document.getElementById(
        row(0).getAttribute("aria-controls"),
      );
      state.view.selectAsset(selected);
      const editor = state.view.assetEditorView;
      state.model.get("layers").reset([]);
      expect(state.view.selectedAsset).to.equal(null);
      expect(state.view.assetEditorView).to.equal(null);
      expect(editor.el.isConnected).to.equal(false);
      expect(panel.textContent.trim()).to.equal(
        "Use Add layer to add your first map layer, then configure its settings here.",
      );
    });

    it("updates row order after a model move without replacing the active form", () => {
      const layers = state.model.get("layers");
      const button = row(0);
      button.click();
      const label = field("label");
      state.model.moveAsset(layers.at(0), layers, layers.length - 1);

      expect(row(layers.length - 1)).to.equal(button);
      expect(
        Array.from(state.view.el.querySelectorAll("[data-asset]"), (el) =>
          el.getAttribute("data-asset"),
        ),
      ).to.deep.equal(layers.map((asset) => asset.cid));
      expect(button.getAttribute("aria-pressed")).to.equal("true");
      expect(field("label")).to.equal(label);
    });

    it("starts a newly selected layer's form at the top", () => {
      const [first, second] = state.model.getAllLayers();
      second.set("type", WMTS);
      const panel = document.getElementById(
        row(0).getAttribute("aria-controls"),
      );
      panel.style.cssText = "height: 100px; overflow: auto";
      state.view.selectAsset(first);
      panel.scrollTop = panel.scrollHeight;
      expect(panel.scrollTop).to.be.greaterThan(0);

      state.view.selectAsset(second);
      expect(panel.scrollTop).to.equal(0);
      expect(field("label").value).to.equal(second.get("label"));
    });

    it("exposes hidden layers with literal labels and no initial editor", () => {
      expect(state.view.el.querySelectorAll("[data-asset]")).to.have.length(3);
      expect(row(0).textContent).to.equal("Imagery <b>one</b>");
      expect(row(0).querySelector("b")).to.equal(null);
      expect(field("label")).to.equal(null);
      expect(state.view.el.textContent).to.include("Select a layer");
      expect(status().getAttribute("role")).to.equal("status");
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
      expect(field("label").selectionEnd).to.equal(field("label").value.length);
    });

    it("retains new layer edits across additions and ordinary selection", () => {
      state.view.el.querySelector("[data-add-layer]").click();
      changeField("label", "First new layer");
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
      renderMap({
        layerCategories: [
          { label: "Base <b>maps</b>", layers: [{ label: "OSM", type: OSM }] },
          { label: "Overlays", layers: [] },
        ],
      });
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

    it("retains field changes when selecting another layer", () => {
      row(0).click();
      const firstEditor = state.view.assetEditorView;
      changeField("label", "Edited label");
      changeField("url", "/incomplete");
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
      changeField("label", "Accepted label");
      changeField("url", "/new/{TileMatrix}/{TileCol}/{TileRow}");
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
      expect(field("label")).to.equal(null);
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
      changeField("label", "Edited imagery");
      removeButton(2).click();

      expect(state.model.getAllLayers()).to.have.length(2);
      expect(state.view.assetEditorView.model).to.equal(asset);
      expect(field("label").value).to.equal("Edited imagery");
      expect(row(0).getAttribute("aria-pressed")).to.equal("true");
      expect(document.activeElement).to.equal(row(1));
    });

    it("retains an empty category after removing its only layer", () => {
      renderMap({
        layerCategories: [
          { label: "Base maps", layers: [{ label: "OSM", type: OSM }] },
          { label: "Overlays", layers: [{ label: "Other", type: "Unknown" }] },
        ],
      });
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
      it(`removes the final ${name} layer and focuses the empty state`, () => {
        renderMap(config);
        removeButton(0).click();

        expect(state.model.getAllLayers()).to.have.length(0);
        expect(document.activeElement.textContent).to.equal(
          "No layers configured.",
        );
        expect(state.view.el.contains(document.activeElement)).to.equal(true);
        const saved = state.model.toConfig();
        if (name === "categorized") {
          expect(saved.layerCategories).to.have.length(1);
          expect(saved.layerCategories[0].layers).to.deep.equal([]);
        } else {
          expect(saved.layers).to.deep.equal([]);
        }
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

    describe("category moves", () => {
      beforeEach(() => {
        renderMap({
          layerCategories: [
            {
              label: "Overlays",
              layers: [
                {
                  label: "Water",
                  type: WMTS,
                  visible: false,
                  cesiumOptions: {
                    url: "/tiles/{TileMatrix}/{TileCol}/{TileRow}",
                    layer: "water",
                    style: "default",
                  },
                },
                { label: "Roads", type: OSM },
              ],
            },
            { label: "Base maps", layers: [] },
          ],
        });
      });

      [false, true].forEach((populated) => {
        it(`drags into ${populated ? "a populated" : "an empty"} category and keeps the selected form`, () => {
          const [source, target] = state.model.getLayerGroups();
          if (populated)
            target.addAsset({ label: "Existing", type: OSM }, state.model);
          const [water, roads] = source.models;
          const dragged = row(1).closest("li");
          state.view.selectAsset(water);
          const editor = state.view.assetEditorView;
          const label = field("label");
          const destination = layerList(1);
          const index = target.length;
          destination.append(dragged);
          Sortable.get(layerList()).option("onEnd")({
            item: dragged,
            to: destination,
            newDraggableIndex: index,
          });
          expect(source.models).to.deep.equal([water]);
          expect(target.map((asset) => asset.get("label"))).to.deep.equal(
            populated ? ["Existing", "Roads"] : ["Roads"],
          );
          expect(target.at(index)).to.equal(roads);
          expect(dragged.parentElement).to.equal(destination);
          expect(state.view.assetEditorView).to.equal(editor);
          expect(field("label")).to.equal(label);
          expect(state.view.selectedAsset).to.equal(water);
          expect(document.activeElement).to.equal(
            dragged.querySelector("[data-move-asset]"),
          );
          expect(status().textContent).to.include(
            populated
              ? "Roads moved to Base maps, position 2 of 2"
              : "Roads moved to Base maps, position 1 of 1",
          );
        });
      });

      it("connects category lists within one workspace and isolates another workspace", () => {
        const second = new MapAssetsEditorView({ model: state.model }).render();
        document.body.append(second.el);
        try {
          const groups = [
            ...state.view.el.querySelectorAll(`.${CLASS_NAMES.LAYER_LIST}`),
            ...second.el.querySelectorAll(`.${CLASS_NAMES.LAYER_LIST}`),
          ].map((list) => Sortable.get(list).option("group").name);
          expect(groups).to.have.length(4);
          expect(groups[0]).to.equal(groups[1]);
          expect(groups[2]).to.equal(groups[3]);
          expect(groups[0]).not.to.equal(groups[2]);
        } finally {
          second.remove();
        }
      });

      ["render", "remove"].forEach((method) => {
        it(`releases every Sortable instance on ${method}`, () => {
          const lists = Array.from(
            state.view.el.querySelectorAll(`.${CLASS_NAMES.LAYER_LIST}`),
          );
          state.view[method]();
          lists.forEach((list) => {
            expect(list.isConnected).to.equal(false);
            expect(Sortable.get(list)).to.equal(null);
          });
        });
      });

      it("moves to an empty closed category only after Move is pressed and keeps the invalid form", () => {
        const [source, target] = state.model.getLayerGroups();
        const [water, roads] = source.models;
        state.view.selectAsset(water);
        const editor = state.view.assetEditorView;
        const url = field("url");
        changeField("url", "/incomplete");
        water.isValid();
        const destination = state.view.el.querySelectorAll(
          "[data-toggle-category]",
        )[1];
        destination.click();
        const button = grip(1);
        button.click();
        const select = moveControls().querySelector("[data-move-destination]");
        expect(select.tagName).to.equal("SELECT");
        expect(
          Array.from(select.options, (option) => option.text),
        ).to.deep.equal(["Base maps"]);
        expect(select.labels[0].textContent).to.equal("Move to category");
        expect(select.value).to.equal(
          destination.getAttribute("data-toggle-category"),
        );
        expect(
          moveControls().querySelector("[data-move-category-controls]").hidden,
        ).to.equal(false);
        select.dispatchEvent(new Event("change", { bubbles: true }));
        expect(source.models).to.deep.equal([water, roads]);
        expect(target.length).to.equal(0);
        moveControls().querySelector("[data-move-to-category]").click();
        expect(source.models).to.deep.equal([water]);
        expect(target.models).to.deep.equal([roads]);
        expect(destination.getAttribute("aria-expanded")).to.equal("true");
        expect(document.activeElement).to.equal(button);
        expect(state.view.selectedAsset).to.equal(water);
        expect(state.view.assetEditorView).to.equal(editor);
        expect(field("url")).to.equal(url);
        expect(url.value).to.equal("/incomplete");
        expect(url.getAttribute("aria-invalid")).to.equal("true");
        expect(status().textContent).to.include(
          "Roads moved to Base maps, position 1 of 1",
        );

        grip(0).click();
        moveControls().querySelector("[data-move-to-category]").click();
        expect(source.length).to.equal(0);
        expect(target.models).to.deep.equal([roads, water]);
        expect(state.view.assetEditorView).to.equal(editor);
        expect(field("url")).to.equal(url);
      });

      it("focuses the destination selector when a category has one layer", () => {
        const source = state.model.getLayerGroups()[0];
        state.model.removeAsset(source.at(1));
        grip(0).click();
        expect(document.activeElement).to.equal(
          moveControls().querySelector("[data-move-destination]"),
        );
      });

      it("hides category movement when the map has only one category", () => {
        renderMap({
          layerCategories: [
            {
              label: "Only category",
              layers: [{ label: "Only layer", type: OSM }],
            },
          ],
        });
        grip(0).click();
        expect(
          moveControls().querySelector("[data-move-category-controls]").hidden,
        ).to.equal(true);
        expect(document.activeElement).to.equal(
          moveControls().querySelector("[data-close-move]"),
        );
      });

      it("keeps the selected layer and its invalid form when moving to an empty category", () => {
        const [source, target] = state.model.getLayerGroups();
        const asset = source.at(0);
        asset.set("selected", true);
        state.view.selectAsset(asset);
        const button = row(0);
        const editor = state.view.assetEditorView;
        const url = field("url");
        changeField("url", "/incomplete");
        asset.isValid();
        expect(state.model.moveAsset(asset, target, 0)).to.equal(true);

        expect(row(1)).to.equal(button);
        expect(button.closest("ul")).to.equal(layerList(1));
        expect(state.view.selectedAsset).to.equal(asset);
        expect(state.view.assetEditorView).to.equal(editor);
        expect(editor.el.isConnected).to.equal(true);
        expect(field("url")).to.equal(url);
        expect(url.value).to.equal("/incomplete");
        expect(url.getAttribute("aria-invalid")).to.equal("true");
        expect(asset.get("visible")).to.equal(false);
        expect(asset.get("selected")).to.equal(true);
      });

      it("keeps the selected row and form when a transfer empties its source", () => {
        const [source, target] = state.model.getLayerGroups();
        const [water, roads] = source.models;
        state.model.moveAsset(water, target, 0);
        state.view.selectAsset(roads);
        const button = row(0);
        const editor = state.view.assetEditorView;
        expect(state.model.moveAsset(roads, target, 1)).to.equal(true);

        expect(row(1)).to.equal(button);
        expect(state.view.assetEditorView).to.equal(editor);
        expect(state.view.selectedAsset).to.equal(roads);
        expect(layerList().children).to.have.length(0);
      });
    });

    describe("category disclosures", () => {
      const toggle = (index) =>
        state.view.el.querySelectorAll("[data-toggle-category]")[index];
      const content = (index) =>
        document.getElementById(toggle(index).getAttribute("aria-controls"));

      beforeEach(() => {
        renderMap({
          layerCategories: [
            {
              label: "Water <b>layers</b>",
              icon,
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
      });

      it("starts all categories expanded with named disclosure buttons", () => {
        expect(
          state.view.el.querySelectorAll("[data-toggle-category]"),
        ).to.have.length(2);
        [0, 1].forEach((index) => {
          expect(toggle(index).tagName).to.equal("BUTTON");
          expect(toggle(index).getAttribute("aria-expanded")).to.equal("true");
          expect(content(index)).not.to.equal(null);
          expect(content(index).hidden).to.equal(false);
        });
        expect(toggle(0).textContent).to.include("Water <b>layers</b>");
        expect(toggle(0).querySelector("b")).to.equal(null);
        expect(
          toggle(0).querySelector("svg").closest('[aria-hidden="true"]'),
        ).not.to.equal(null);
      });

      it("collapses in the editor without replacing settings or changing map config", () => {
        const config = state.model.toConfig();
        row(0).click();
        const editor = state.view.assetEditorView;
        expect(editor.model).to.equal(state.model.getAllLayers()[0]);
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

      it("preserves a category header and focus while another category changes", () => {
        const button = toggle(0);
        const categoryContent = content(0);
        button.focus();
        const layers = state.model
          .get("layerCategories")
          .at(1)
          .get("mapAssets");
        const added = layers.addAsset(
          { label: "Extra", type: OSM },
          state.model,
        );
        expect(toggle(0)).to.equal(button);
        expect(content(0)).to.equal(categoryContent);
        expect(document.activeElement).to.equal(button);
        state.model.removeAsset(added);
        expect(toggle(0)).to.equal(button);
        expect(document.activeElement).to.equal(button);
      });

      it("updates category and Add labels without replacing their controls", () => {
        const button = toggle(0);
        const add = content(0).querySelector("[data-add-layer]");
        add.focus();
        state.model
          .get("layerCategories")
          .at(0)
          .set("label", "New <b>label</b>");
        expect(toggle(0)).to.equal(button);
        expect(button.textContent).to.include("New <b>label</b>");
        expect(button.querySelector("b")).to.equal(null);
        expect(add.getAttribute("aria-label")).to.equal(
          "Add layer to New <b>label</b>",
        );
        expect(document.activeElement).to.equal(add);
      });

      it("opens a collapsed category when validation reveals its layer", () => {
        row(0).click();
        const editor = state.view.assetEditorView;
        changeField("url", "/incomplete");
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
    });

    it("saves provider field changes through portal XML and reloads them", () => {
      const portal = new PortalModel({
        label: "map-portal",
        name: "Map portal",
      });
      portal
        .get("definitionFilters")
        .add({ fields: ["formatType"], values: ["METADATA"] });
      portal.addSection("cesium").set({ label: "Map", mapModel: state.model });
      row(0).click();
      changeField("type", "IonImageryProvider");
      expect(portal.isValid()).to.equal(false);
      changeField("ionAssetId", "2");
      expect(portal.isValid()).to.equal(true);

      const xml = new DOMParser().parseFromString(
        portal.serialize(),
        "application/xml",
      );
      expect(xml.querySelector("parsererror")).to.equal(null);
      const reloaded = new PortalModel({});
      reloaded.set(reloaded.parse(xml));
      // FilterGroup.parse currently leaks its temporary XML clone globally.
      delete window.filterXML;
      const map = reloaded.get("sections")[0].get("mapModel");
      const asset = map.getAllLayers()[0];
      expect(asset.get("type")).to.equal("IonImageryProvider");
      expect(asset.get("cesiumOptions")).to.deep.equal({ ionAssetId: "2" });
      map.getAllLayers().forEach((layer) => layer.stopListening());
      map.stopListening();
      portal.stopListening();
      reloaded.stopListening();
    });
  });
});
