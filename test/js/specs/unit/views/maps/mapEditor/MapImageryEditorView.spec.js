define([
  "models/maps/assets/CesiumImagery",
  "views/maps/mapEditor/MapImageryEditorView",
  "/test/js/specs/shared/clean-state.js",
], (CesiumImagery, MapImageryEditorView, cleanState) => {
  const expect = chai.expect;
  const WMTS = "WebMapTileServiceImageryProvider";
  const ION = "IonImageryProvider";
  const OSM = "OpenStreetMapImageryProvider";

  describe("MapImageryEditorView", () => {
    const state = cleanState(() => {
      const sandbox = sinon.createSandbox();
      sandbox.stub(CesiumImagery.prototype, "createCesiumModelWhenVisible");
      sandbox.stub(CesiumImagery.prototype, "getThumbnail");
      sandbox.stub(CesiumImagery.prototype, "createCesiumModel");
      const model = new CesiumImagery({
        type: WMTS,
        cesiumOptions: {
          url: "/tiles/{TileMatrix}/{TileCol}/{TileRow}.png",
          tilingScheme: "GeographicTilingScheme",
          rectangle: [-143.9, 69.65, -143.7, 69.75],
          layer: "existing-layer",
          dimensions: { time: "2020" },
        },
      });
      const view = new MapImageryEditorView({ model });
      const container = document.createElement("form");
      const outsideInput = document.createElement("input");
      outsideInput.type = "text";
      outsideInput.setAttribute("aria-label", "Outside the imagery editor");
      container.append(view.el, outsideInput);
      document.body.append(container);
      view.render();
      return { sandbox, model, view, container, outsideInput };
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

    it("opens a collapsed invalid extent before focusing its first field", () => {
      change("south", "");
      state.outsideInput.focus();
      state.view.showValidation();
      expect(state.view.el.querySelector("details").open).to.equal(true);
      expect(document.activeElement).to.equal(field("west"));
    });

    it("keeps focus when checking one source field", () => {
      change("url", "/incomplete", source(WMTS));
      state.outsideInput.focus();
      state.view.showValidation("cesiumOptions.url");
      expect(document.activeElement).to.equal(state.outsideInput);
      expect(field("url", source(WMTS)).getAttribute("aria-invalid")).to.equal(
        "true",
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
      state.outsideInput.focus();
      expect(error("cesiumOptions.rectangle").textContent).not.to.equal("");
      field("south").focus();
      field("south").value = "69.65";
      field("south").dispatchEvent(new Event("change", { bubbles: true }));
      state.outsideInput.focus();
      expect(error("cesiumOptions.rectangle").textContent).to.equal("");
    });

    it("fills in the default or custom OpenStreetMap URL", () => {
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

    it("renders an existing Ion ID stored as text", () => {
      state.model.set({ type: ION, cesiumOptions: { ionAssetId: "2" } });
      state.view.render();
      expect(field("ionAssetId").value).to.equal("2");
      expect(source(ION).hidden).to.equal(false);
    });

    it("keeps the Ion extent when its asset ID changes", () => {
      const rectangle = [-143.9, 69.65, -143.7, 69.75];
      state.model.set({
        type: ION,
        cesiumOptions: { ionAssetId: "2", rectangle },
      });
      state.view.render();
      change("ionAssetId", "3");
      expect(state.model.get("cesiumOptions").rectangle).to.equal(rectangle);
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

    it("removes cleared optional fields and keeps other source options", () => {
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

    it("exports source edits, including an invalid Ion ID", () => {
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

    it("exports cleared optional fields and copies nested source options", () => {
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
  });
});
