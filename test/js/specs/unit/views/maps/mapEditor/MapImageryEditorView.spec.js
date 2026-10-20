define([
  "models/maps/assets/CesiumImagery",
  "views/maps/mapEditor/MapImageryEditorView",
  "/test/js/specs/shared/clean-state.js",
], (CesiumImagery, MapImageryEditorView, cleanState) => {
  const expect = chai.expect;
  const { PROVIDER_TYPES } = CesiumImagery;

  describe("MapImageryEditorView", () => {
    const state = cleanState(() => {
      const sandbox = sinon.createSandbox();
      sandbox.stub(CesiumImagery.prototype, "createCesiumModelWhenVisible");
      const model = new CesiumImagery({
        type: PROVIDER_TYPES.WMTS,
        cesiumOptions: {
          url: "/tiles/{TileMatrix}/{TileCol}/{TileRow}.png",
          tilingScheme: "GeographicTilingScheme",
          rectangle: [-143.9, 69.65, -143.7, 69.75],
          layer: "existing-layer",
        },
      });
      const view = new MapImageryEditorView({ model });
      const container = document.createElement("form");
      const outsideInput = document.createElement("input");
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
    const error = (name, root = state.view.el) =>
      root.querySelector(`[data-error="${name}"]`);
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

    it("opens a collapsed invalid extent before focusing its first field", () => {
      change("south", "");
      state.outsideInput.focus();
      state.view.showValidation();
      expect(state.view.el.querySelector("details").open).to.equal(true);
      expect(document.activeElement).to.equal(field("west"));
    });

    it("keeps focus when checking one source field", () => {
      const controls = source(PROVIDER_TYPES.WMTS);
      change("url", "/incomplete", controls);
      state.outsideInput.focus();
      state.view.showValidation("cesiumOptions.url");
      expect(document.activeElement).to.equal(state.outsideInput);
      expect(field("url", controls).getAttribute("aria-invalid")).to.equal(
        "true",
      );
    });

    it("validates the extent after leaving its coordinate group", () => {
      state.view.el.querySelector("details").open = true;
      field("south").focus();
      change("south", "");
      expect(error("cesiumOptions.rectangle").textContent).to.equal("");
      field("east").focus();
      expect(error("cesiumOptions.rectangle").textContent).to.equal("");
      state.outsideInput.focus();
      expect(error("cesiumOptions.rectangle").textContent).not.to.equal("");
      field("south").focus();
      change("south", "69.65");
      state.outsideInput.focus();
      expect(error("cesiumOptions.rectangle").textContent).to.equal("");
    });

    [
      {
        type: PROVIDER_TYPES.OSM,
        defaultURL: "https://tile.openstreetmap.org/",
        customURL: "https://a.tile.opentopomap.org/",
      },
      {
        type: PROVIDER_TYPES.BING,
        defaultURL: "https://dev.virtualearth.net",
        customURL: "/custom-bing-service",
      },
    ].forEach(({ type, defaultURL, customURL }) => {
      it(`fills default or custom URLs for ${type}`, () => {
        [
          [{}, defaultURL],
          [{ url: "" }, defaultURL],
          [{ url: customURL }, customURL],
        ].forEach(([cesiumOptions, expected]) => {
          state.model.set({ type, cesiumOptions });
          state.view.render();
          expect(field("url", source(type)).value).to.equal(expected);
        });
      });
    });

    it("uses the default URL when switching to Bing", () => {
      change("type", PROVIDER_TYPES.BING);
      expect(field("url", source(PROVIDER_TYPES.BING)).value).to.equal(
        "https://dev.virtualearth.net",
      );
      const config = state.model.toConfig();
      expect(config.type).to.equal("BingMapsImageryProvider");
      expect(config.cesiumOptions).to.deep.equal({
        url: "https://dev.virtualearth.net",
      });
    });

    [
      {
        type: PROVIDER_TYPES.WMTS,
        options: {
          layer: "canopy",
          style: "default",
          tileMatrixSetID: "EPSG:3857",
        },
      },
      {
        type: PROVIDER_TYPES.WMS,
        options: { layers: "canopy,water" },
      },
      {
        type: PROVIDER_TYPES.TMS,
        options: { fileExtension: "jpg", maximumLevel: 10 },
      },
      {
        type: PROVIDER_TYPES.BING,
        options: { key: "existing-key", mapStyle: "Aerial" },
      },
    ].forEach(({ type, options }) => {
      it(`edits an existing ${type} URL without losing other options`, () => {
        const cesiumOptions = {
          url: "/original-service",
          rectangle: [-140, 60, -130, 70],
          ...options,
        };
        state.model.set({ type, cesiumOptions });
        state.view.render();
        expect(source(type).hidden).to.equal(false);
        expect(field("url", source(type)).value).to.equal("/original-service");
        change("url", "/edited-service", source(type));
        expect(state.model.toConfig().cesiumOptions).to.deep.equal({
          ...cesiumOptions,
          url: "/edited-service",
        });
        expect(cesiumOptions.url).to.equal("/original-service");
        expect(state.model.isValid()).to.equal(true);
      });
    });

    it("edits WMS layer names and associates errors with the visible fields", () => {
      change("type", PROVIDER_TYPES.WMS);
      const controls = source(PROVIDER_TYPES.WMS);
      change("url", "/wms", controls);
      change("layers", "", controls);
      const layers = field("layers", controls);
      const layersError = error("cesiumOptions.layers", controls);
      expect(layersError.textContent).not.to.equal("");
      expect(layers.getAttribute("aria-describedby").split(" ")).to.include(
        layersError.id,
      );
      expect(layers.getAttribute("aria-invalid")).to.equal("true");
      state.outsideInput.focus();
      state.view.showValidation();
      expect(document.activeElement).to.equal(layers);
      change("layers", "canopy,water", controls);
      expect(state.model.toConfig().cesiumOptions).to.deep.equal({
        url: "/wms",
        layers: "canopy,water",
      });
      expect(layersError.textContent).to.equal("");
      expect(layers.hasAttribute("aria-invalid")).to.equal(false);
      change("url", "", controls);
      state.view.showValidation();
      expect(document.activeElement).to.equal(field("url", controls));
      expect(error("cesiumOptions.url", controls).textContent).not.to.equal("");
    });

    it("requires a TMS URL and focuses its field before saving", () => {
      change("type", PROVIDER_TYPES.TMS);
      state.view.showValidation();
      const controls = source(PROVIDER_TYPES.TMS);
      const url = field("url", controls);
      const urlError = error("cesiumOptions.url", controls);
      expect(url.getAttribute("aria-invalid")).to.equal("true");
      expect(document.activeElement).to.equal(url);
      expect(urlError.textContent).not.to.equal("");
      expect(url.getAttribute("aria-describedby")).to.equal(urlError.id);
      change("url", "/tile-service", controls);
      expect(state.model.toConfig().cesiumOptions).to.deep.equal({
        url: "/tile-service",
      });
      expect(urlError.textContent).to.equal("");
      expect(url.hasAttribute("aria-invalid")).to.equal(false);
    });

    it("removes a cleared Bing key and URL to use the configured defaults", () => {
      state.model.set({
        type: PROVIDER_TYPES.BING,
        cesiumOptions: {
          url: "https://dev.virtualearth.net",
          key: "existing-key",
          mapStyle: "Aerial",
        },
      });
      state.view.render();
      const controls = source(PROVIDER_TYPES.BING);
      change("key", "replacement-key", controls);
      expect(state.model.toConfig().cesiumOptions.key).to.equal(
        "replacement-key",
      );
      change("key", "", controls);
      expect(state.model.toConfig().cesiumOptions).to.deep.equal({
        url: "https://dev.virtualearth.net",
        mapStyle: "Aerial",
      });
      change("url", "", controls);
      expect(state.model.toConfig().cesiumOptions).to.deep.equal({
        mapStyle: "Aerial",
      });
      expect(error("cesiumOptions.url", controls).textContent).to.equal("");
      expect(field("url", controls).hasAttribute("aria-invalid")).to.equal(
        false,
      );
    });

    [
      [PROVIDER_TYPES.NATURAL_EARTH, "NaturalEarthII"],
      [PROVIDER_TYPES.USGS, "USGSImageryTopo"],
    ].forEach(([type, expectedType]) => {
      it(`switches to ${type} without retaining the previous provider settings`, () => {
        change("type", type);
        expect(source(type).hidden).to.equal(false);
        expect(source(PROVIDER_TYPES.WMTS).hidden).to.equal(true);
        const config = state.model.toConfig();
        expect(config.type).to.equal(expectedType);
        expect(config.cesiumOptions).to.deep.equal({});
      });
    });

    it("shows an Ion ID stored as text and keeps its extent during edits", () => {
      const rectangle = [-143.9, 69.65, -143.7, 69.75];
      state.model.set({
        type: PROVIDER_TYPES.ION,
        cesiumOptions: { ionAssetId: "2", rectangle },
      });
      state.view.render();
      expect(field("ionAssetId").value).to.equal("2");
      change("ionAssetId", "3");
      expect(state.model.toConfig().cesiumOptions).to.deep.equal({
        ionAssetId: "3",
        rectangle,
      });
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
      expect(state.model.toConfig().cesiumOptions.rectangle).to.deep.equal([
        170, -20, -170, 20,
      ]);
      expect(state.model.toConfig().cesiumOptions.tilingScheme).to.equal(
        "WebMercatorTilingScheme",
      );
      expect(error("cesiumOptions.rectangle").textContent).to.equal("");
    });

    it("omits cleared optional fields and keeps other source options", () => {
      ["west", "south", "east", "north", "tilingScheme"].forEach((name) =>
        change(name, ""),
      );
      expect(state.model.toConfig().cesiumOptions).to.deep.equal({
        url: "/tiles/{TileMatrix}/{TileCol}/{TileRow}.png",
        layer: "existing-layer",
      });
      state.model.set({
        type: PROVIDER_TYPES.OSM,
        cesiumOptions: {
          url: "https://a.tile.opentopomap.org/",
          maximumLevel: 10,
        },
      });
      state.view.render();
      change("url", "", source(PROVIDER_TYPES.OSM));
      expect(state.model.toConfig().cesiumOptions).to.deep.equal({
        maximumLevel: 10,
      });
    });

    it("keeps invalid Ion edits for correction and drops the previous source options", () => {
      change("type", PROVIDER_TYPES.ION);
      change("ionAssetId", "0");
      expect(state.model.toConfig().type).to.equal("IonImageryProvider");
      expect(state.model.toConfig().cesiumOptions).to.deep.equal({
        ionAssetId: "0",
      });
      expect(error("cesiumOptions.ionAssetId").textContent).not.to.equal("");
      change("ionAssetId", "2");
      expect(state.model.toConfig().cesiumOptions).to.deep.equal({
        ionAssetId: "2",
      });
      expect(error("cesiumOptions.ionAssetId").textContent).to.equal("");
    });
  });
});
