define([
  "models/maps/assets/CesiumImagery",
  "views/maps/mapEditor/MapAssetEditorView",
  "/test/js/specs/shared/clean-state.js",
], (CesiumImagery, MapAssetEditorView, cleanState) => {
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

    it("validates the extent after leaving its coordinate group", () => {
      state.view.el.querySelector("details").open = true;
      field("south").focus();
      field("south").value = "";
      field("south").dispatchEvent(new Event("change", { bubbles: true }));
      expect(error("cesiumOptions.rectangle").textContent).to.equal("");
      field("east").focus();
      expect(error("cesiumOptions.rectangle").textContent).to.equal("");
      field("label").focus();
      expect(error("cesiumOptions.rectangle").textContent).not.to.equal("");
      field("south").focus();
      field("south").value = "69.65";
      field("south").dispatchEvent(new Event("change", { bubbles: true }));
      field("label").focus();
      expect(error("cesiumOptions.rectangle").textContent).to.equal("");
    });

    it("uses the supplied model and puts labeled metadata controls first", () => {
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

    it("shows the default or custom OpenStreetMap URL as the actual value", () => {
      state.model.set({ type: OSM });
      state.model.unset("cesiumOptions");
      state.view.render();
      expect(field("url", source(OSM)).value).to.equal(
        CesiumImagery.OSM_DEFAULT_URL,
      );
      change("url", CesiumImagery.OSM_DEFAULT_URL, source(OSM));
      expect(state.model.get("cesiumOptions").url).to.equal(
        CesiumImagery.OSM_DEFAULT_URL,
      );
      state.model.set("cesiumOptions", {
        url: "https://a.tile.opentopomap.org/",
      });
      state.view.render();
      expect(field("url", source(OSM)).value).to.equal(
        "https://a.tile.opentopomap.org/",
      );
      state.model.set("cesiumOptions", { url: "" });
      state.view.render();
      expect(field("url", source(OSM)).value).to.equal(
        CesiumImagery.OSM_DEFAULT_URL,
      );
    });

    it("renders an existing numeric-string Ion ID", () => {
      state.model.set({ type: ION, cesiumOptions: { ionAssetId: "2" } });
      state.view.render();
      expect(field("ionAssetId").value).to.equal("2");
      expect(source(ION).hidden).to.equal(false);
    });

    it("preserves an Ion rectangle that this editor does not expose", () => {
      const rectangle = [-143.9, 69.65, -143.7, 69.75];
      state.model.set({
        type: ION,
        cesiumOptions: { ionAssetId: "2", rectangle },
      });
      state.view.render();
      change("ionAssetId", "3");
      expect(state.model.get("cesiumOptions").rectangle).to.equal(rectangle);
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

    it("stores a partial extent for correction and accepts an antimeridian extent", () => {
      change("south", "");
      expect(state.model.get("cesiumOptions").rectangle).to.deep.equal([
        -143.9,
        null,
        -143.7,
        69.75,
      ]);
      [170, -20, -170, 20].forEach((value, index) => {
        change(["west", "south", "east", "north"][index], value);
      });
      change("tilingScheme", "WebMercatorTilingScheme");
      expect(state.model.get("cesiumOptions").rectangle).to.deep.equal([
        170, -20, -170, 20,
      ]);
      expect(state.model.get("cesiumOptions").tilingScheme).to.equal(
        "WebMercatorTilingScheme",
      );
      expect(error("cesiumOptions.rectangle").textContent).to.equal("");
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

    it("omits cleared optional fields without dropping unedited options", () => {
      ["west", "south", "east", "north", "tilingScheme"].forEach((name) => {
        change(name, "");
      });
      expect(state.model.get("cesiumOptions")).not.to.have.property(
        "rectangle",
      );
      expect(state.model.get("cesiumOptions")).not.to.have.property(
        "tilingScheme",
      );
      expect(state.model.get("cesiumOptions").layer).to.equal("existing-layer");
      state.model.set({
        type: OSM,
        cesiumOptions: {
          url: "https://a.tile.opentopomap.org/",
          maximumLevel: 10,
        },
      });
      state.view.render();
      change("url", "", source(OSM));
      expect(state.model.get("cesiumOptions")).to.deep.equal({
        maximumLevel: 10,
      });
    });

    it("uses model Ion validation and drops old options on provider change", () => {
      field("type").value = ION;
      field("type").dispatchEvent(new Event("change", { bubbles: true }));
      change("ionAssetId", "0");
      expect(state.model.get("type")).to.equal(ION);
      expect(state.model.get("cesiumOptions")).to.deep.equal({
        ionAssetId: "0",
      });
      expect(error("cesiumOptions.ionAssetId").textContent).not.to.equal("");
      change("ionAssetId", "2");
      expect(state.model.get("type")).to.equal(ION);
      expect(state.model.get("cesiumOptions")).to.deep.equal({
        ionAssetId: "2",
      });
      expect(error("cesiumOptions.ionAssetId").textContent).to.equal("");
    });

    it("exports the current source edits for portal validation and saving", () => {
      field("type").value = ION;
      field("type").dispatchEvent(new Event("change", { bubbles: true }));
      change("ionAssetId", "0");
      expect(state.model.toConfig().cesiumOptions).to.deep.equal({
        ionAssetId: "0",
      });

      change("ionAssetId", "2");
      expect(state.model.toConfig().type).to.equal(ION);
      expect(state.model.toConfig().cesiumOptions).to.deep.equal({
        ionAssetId: "2",
      });

      state.model.set("cesiumOptions", { ionAssetId: "3" }, { validate: true });
      expect(state.model.toConfig().cesiumOptions).to.deep.equal({
        ionAssetId: "3",
      });
    });

    it("exports cleared optional settings and detaches saved nested options", () => {
      ["west", "south", "east", "north", "tilingScheme"].forEach((name) => {
        change(name, "");
      });
      const config = state.model.toConfig();
      expect(config.cesiumOptions).not.to.have.property("rectangle");
      expect(config.cesiumOptions).not.to.have.property("tilingScheme");
      config.cesiumOptions.dimensions.time = "2025";
      expect(state.model.get("cesiumOptions").dimensions.time).to.equal("2020");
      expect(state.model.toConfig().cesiumOptions.dimensions).to.deep.equal({
        time: "2020",
      });
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
