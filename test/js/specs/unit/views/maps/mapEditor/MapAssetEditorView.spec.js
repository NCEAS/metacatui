define([
  "models/maps/assets/MapAsset",
  "models/maps/assets/CesiumImagery",
  "views/maps/mapEditor/MapAssetEditorView",
  "/test/js/specs/shared/clean-state.js",
], (MapAsset, CesiumImagery, MapAssetEditorView, cleanState) => {
  const expect = chai.expect;
  const WMTS = "WebMapTileServiceImageryProvider";
  const ION = "IonImageryProvider";
  const OSM = "OpenStreetMapImageryProvider";

  describe("MapAssetEditorView", () => {
    const state = cleanState(() => {
      const sandbox = sinon.createSandbox();
      sandbox.stub(CesiumImagery.prototype, "createCesiumModelWhenVisible");
      sandbox.stub(CesiumImagery.prototype, "getThumbnail");
      const createImagery = sandbox.stub(
        CesiumImagery.prototype,
        "createCesiumModel",
      );
      const model = new CesiumImagery({
        id: "asset-1",
        label: "CO<sub>2</sub>",
        description: "</textarea><b>Literal description</b>",
        type: WMTS,
        opacity: 0.5,
        saturation: 0.8,
        attribution: "Original attribution",
        moreInfoLink: "https://example.org/metadata",
        cesiumOptions: {
          url: "/tiles/{TileMatrix}/{TileCol}/{TileRow}.png",
          tilingScheme: "GeographicTilingScheme",
          rectangle: [-143.9, 69.65, -143.7, 69.75],
          layer: "existing-layer",
          dimensions: { time: "2020" },
        },
      });
      const view = new MapAssetEditorView({ model });
      const container = document.createElement("form");
      container.append(view.el);
      document.body.append(container);
      view.render();
      return { sandbox, createImagery, model, view, container };
    }, beforeEach);

    const field = (name, root = state.view.el) =>
      root.querySelector(`[name="${name}"]`);
    const source = (type) =>
      state.view.el.querySelector(`[data-provider="${type}"]`);
    const error = (name) =>
      state.view.el.querySelector(`[data-error="${name}"]`);
    const change = (name, value, root = state.view.el) => {
      const input = field(name, root);
      if (value !== undefined) input.value = value;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    };

    afterEach(() => {
      state.view.remove();
      state.container.remove();
      state.model.stopListening();
      state.sandbox.restore();
    });

    it("edits a generic asset's Label and Description and keeps its source", () => {
      const asset = new MapAsset({
        type: "UnknownAsset",
        label: "Other <b>layer</b>",
        description: "</textarea><b>Existing description</b>",
        cesiumOptions: { url: "/source", parameters: { version: "1" } },
      });
      const before = asset.toConfig();
      const options = asset.get("cesiumOptions");
      const view = new MapAssetEditorView({ model: asset });
      state.container.append(view.el);
      try {
        view.render();
        expect(
          Array.from(
            view.el.querySelectorAll("input, textarea, select"),
            (control) => control.name,
          ),
        ).to.deep.equal(["label", "description"]);
        expect(field("label", view.el).value).to.equal("Other <b>layer</b>");
        expect(field("description", view.el).value).to.equal(
          "</textarea><b>Existing description</b>",
        );
        expect(view.el.querySelector("b")).to.equal(null);
        change("label", "Edited <b>label</b>", view.el);
        change("description", "Edited description", view.el);
        expect(asset.get("cesiumOptions")).to.equal(options);
        expect(asset.toConfig()).to.deep.equal({
          ...before,
          label: "Edited <b>label</b>",
          description: "Edited description",
        });
        expect(() => view.showValidation()).not.to.throw();
        view.focusLabel();
        expect(document.activeElement).to.equal(field("label", view.el));
        expect(view.el.lastElementChild.textContent).to.equal(
          "Additional layer settings are not supported yet.",
        );
      } finally {
        view.remove();
        asset.stopListening();
      }
    });

    it("keeps the WMS source when Label and Description change", () => {
      state.model.set({
        type: "WebMapServiceImageryProvider",
        cesiumOptions: {
          url: "/wms",
          layers: "canopy",
          parameters: { time: "2020" },
        },
      });
      const before = state.model.toConfig();
      const options = state.model.get("cesiumOptions");
      state.view.render();
      expect(field("type")).to.equal(null);
      change("label", "Canopy");
      change("description", "Canopy observations");
      expect(state.model.get("cesiumOptions")).to.equal(options);
      expect(state.model.toConfig()).to.deep.equal({
        ...before,
        label: "Canopy",
        description: "Canopy observations",
      });
      expect(state.createImagery.called).to.equal(false);
    });

    it("removes the imagery editor and its handlers when rendered again or removed", () => {
      const firstChild = state.view.typeEditorView;
      expect(firstChild.model).to.equal(state.model);
      const previousURL = field("url", firstChild.el);
      state.view.render();
      expect(firstChild.el.isConnected).to.equal(false);
      expect(state.view.typeEditorView).not.to.equal(firstChild);
      const sourceOptions = state.model.get("cesiumOptions");
      previousURL.value = "/detached";
      previousURL.dispatchEvent(new Event("change", { bubbles: true }));
      expect(state.model.get("cesiumOptions")).to.equal(sourceOptions);

      const nextChild = state.view.typeEditorView;
      state.view.remove();
      expect(nextChild.el.isConnected).to.equal(false);
      expect(state.view.typeEditorView).to.equal(null);
    });

    it("focuses and selects the label through the form interface", () => {
      state.view.focusLabel();
      expect(document.activeElement).to.equal(field("label"));
      expect(field("label").selectionStart).to.equal(0);
      expect(field("label").selectionEnd).to.equal(field("label").value.length);
    });

    it("focuses the first invalid field on full validation", () => {
      change("url", "/incomplete", source(WMTS));
      field("label").focus();
      state.view.showValidation();
      expect(document.activeElement).to.equal(field("url", source(WMTS)));
    });

    it("keeps incomplete source edits in the model without an Apply action", () => {
      field("url", source(WMTS)).value = "/incomplete";
      field("url", source(WMTS)).dispatchEvent(
        new Event("change", { bubbles: true }),
      );
      expect(state.model.get("cesiumOptions").url).to.equal("/incomplete");
      expect(error("cesiumOptions.url").textContent).not.to.equal("");
      field("label").value = "Edited label";
      field("label").dispatchEvent(new Event("change", { bubbles: true }));
      expect(state.model.get("label")).to.equal("Edited label");
      expect(state.view.el.querySelector('[data-action="apply"]')).to.equal(
        null,
      );
    });

    it("uses the supplied model and puts labelled metadata controls first", () => {
      expect(state.view.model).to.equal(state.model);
      const controls = [
        ...state.view.el.querySelectorAll("input, textarea, select"),
      ];
      expect(controls.slice(0, 3).map((control) => control.name)).to.deep.equal(
        ["label", "description", "type"],
      );
      expect(state.view.el.querySelector("h1, h2, h3, form")).to.equal(null);
      expect(controls.every((control) => control.closest("label"))).to.equal(
        true,
      );
      expect(
        [...field("type").options].map((option) => option.value),
      ).to.deep.equal([WMTS, ION, OSM]);
    });

    it("keeps metadata HTML literal and a configured extent collapsed", () => {
      expect(field("label").value).to.equal("CO<sub>2</sub>");
      expect(field("description").value).to.equal(
        "</textarea><b>Literal description</b>",
      );
      expect(state.view.el.querySelector("sub, b")).to.equal(null);
      expect(state.view.el.querySelector("summary").textContent).to.equal(
        "Geographic extent (optional)",
      );
      expect(state.view.el.querySelector("details").open).to.equal(false);
      expect(
        ["west", "south", "east", "north"].map((name) =>
          Number(field(name).value),
        ),
      ).to.deep.equal([-143.9, 69.65, -143.7, 69.75]);
      expect(state.model.get("label")).to.equal("CO<sub>2</sub>");
      expect(state.model.get("description")).to.equal(
        "</textarea><b>Literal description</b>",
      );
    });

    it("switches source controls without discarding edited metadata", () => {
      change("label", "Draft label");
      change("description", "Draft description");
      field("type").value = ION;
      field("type").dispatchEvent(new Event("change", { bubbles: true }));
      expect(source(ION).hidden).to.equal(false);
      expect(source(WMTS).hidden).to.equal(true);
      expect(field("ionAssetId").value).to.equal("");
      field("type").value = OSM;
      field("type").dispatchEvent(new Event("change", { bubbles: true }));
      expect(field("url", source(OSM)).value).to.equal(
        CesiumImagery.OSM_DEFAULT_URL,
      );
      field("type").value = WMTS;
      field("type").dispatchEvent(new Event("change", { bubbles: true }));
      expect(field("url", source(WMTS)).value).to.equal("");
      expect(field("tilingScheme").value).to.equal("");
      expect(field("west").value).to.equal("");
      expect(field("label").value).to.equal("Draft label");
      expect(field("description").value).to.equal("Draft description");
      expect(state.model.get("type")).to.equal(WMTS);
      expect(state.model.get("label")).to.equal("Draft label");
      expect(state.model.get("description")).to.equal("Draft description");
    });

    it("keeps invalid source values editable and clears feedback after correction", () => {
      change("label", "Draft label");
      change("url", "/invalid", source(WMTS));
      expect(state.model.get("cesiumOptions").url).to.equal("/invalid");
      expect(field("url", source(WMTS)).value).to.equal("/invalid");
      expect(error("cesiumOptions.url").textContent).not.to.equal("");
      change("url", "/fixed/{TileMatrix}/{TileCol}/{TileRow}", source(WMTS));
      expect(state.model.get("label")).to.equal("Draft label");
      expect(error("cesiumOptions.url").textContent).to.equal("");
    });

    it("preserves unrelated attributes and unedited source options", () => {
      state.model.set("cesiumModel", { alpha: 0.5, show: true });
      const before = { ...state.model.attributes };
      const oldOptions = before.cesiumOptions;
      change("label", "Accepted label");
      change("url", "/new/{TileMatrix}/{TileCol}/{TileRow}", source(WMTS));
      Object.entries(before).forEach(([key, value]) => {
        if (!["label", "description", "type", "cesiumOptions"].includes(key)) {
          expect(state.model.get(key)).to.equal(value);
        }
      });
      expect(state.model.get("cesiumOptions")).not.to.equal(oldOptions);
      expect(state.model.get("cesiumOptions").layer).to.equal("existing-layer");
      expect(state.model.get("cesiumOptions").dimensions).to.equal(
        oldOptions.dimensions,
      );
      expect(oldOptions.url).to.equal(
        "/tiles/{TileMatrix}/{TileCol}/{TileRow}.png",
      );
      expect(state.createImagery.called).to.equal(false);
    });

    it("retains field values across status changes and edits while loading", () => {
      const render = state.sandbox.spy(state.view, "render");
      field("label").value = "Still editing";
      state.model.set({
        status: "loading",
        cesiumModel: { alpha: 0.5, show: true },
      });
      expect(render.called).to.equal(false);
      expect(field("label").value).to.equal("Still editing");
      change("label", "Still editing");
      expect(state.model.get("label")).to.equal("Still editing");
      state.model.set("status", "error");
      expect(render.called).to.equal(false);
      expect(state.createImagery.called).to.equal(false);
    });
  });
});
