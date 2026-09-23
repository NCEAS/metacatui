define([
  "models/maps/assets/MapAsset",
  "models/maps/assets/CesiumImagery",
  "models/maps/assets/CesiumVectorData",
  "models/maps/assets/Cesium3DTileset",
  "common/IconUtilities",
  "cesium",
], (
  MapAsset,
  CesiumImagery,
  CesiumVectorData,
  Cesium3DTileset,
  IconUtilities,
  Cesium,
) => {
  const expect = chai.expect;

  describe("MapAsset toConfig", () => {
    it("uses edited config fields and excludes live objects", () => {
      const asset = new MapAsset({ type: "UnknownAsset", label: "Before" });
      const cesiumModel = new Cesium.Entity();
      cesiumModel.cycle = cesiumModel;
      asset.set({
        label: "After",
        mapModel: { asset },
        cesiumModel,
        selected: true,
        status: "ready",
        iconStatus: "success",
        thumbnail: "blob:thumbnail",
      });

      const config = asset.toConfig();
      expect(config).to.be.an("object");
      expect(config.label).to.equal("After");
      expect(config.type).to.equal("UnknownAsset");
      expect(config).not.to.have.any.keys(
        "mapModel",
        "cesiumModel",
        "selected",
        "status",
        "iconStatus",
        "thumbnail",
      );
      expect(JSON.parse(JSON.stringify(config)).label).to.equal("After");
    });

    it("preserves imagery aliases and their configured options", () => {
      // These map config names are shortcuts. CesiumImagery replaces them with
      // provider types and adds options for the live map. Saving should keep
      // the shortcut and the options from the config.
      ["NaturalEarthII", "USGSImageryTopo"].forEach((type) => {
        const options = { parameters: { custom: "configured" } };
        const asset = new CesiumImagery({
          type,
          label: "Imagery",
          visible: false,
          cesiumOptions: options,
        });

        expect(asset.toConfig().type).to.equal(type);
        expect(asset.toConfig().cesiumOptions).to.deep.equal({
          parameters: { custom: "configured" },
        });
        expect(asset.toConfig().cesiumOptions).not.to.equal(options);
      });
    });

    it("keeps an icon PID after the SVG is fetched", () => {
      const svg = '<svg viewBox="0 0 1 1"></svg>';
      const fetchIcon = sinon.stub(IconUtilities, "fetchIcon").resolves(svg);
      const asset = new MapAsset({
        type: "UnknownAsset",
        icon: "urn:uuid:icon",
      });

      return Promise.resolve()
        .then(() => {
          expect(asset.get("icon")).to.contain("<svg");
          expect(asset.toConfig().icon).to.equal("urn:uuid:icon");
        })
        .finally(() => fetchIcon.restore());
    });

    it("keeps configured filters and palette before model normalization", () => {
      const filters = [
        { filterType: "categorical", property: "kind", values: ["forest"] },
      ];
      const colorPalette = {
        paletteType: "continuous",
        property: "kind",
        colors: [{ value: "forest", color: "#008800" }],
      };
      const asset = new CesiumVectorData({
        type: "GeoJsonDataSource",
        visible: false,
        filters,
        colorPalette,
      });

      expect(asset.toConfig().filters).to.deep.equal(filters);
      expect(asset.toConfig().colorPalette).to.deep.equal(colorPalette);
      expect(asset.toConfig().colorPalette.paletteType).to.equal("continuous");
      expect(asset.toConfig().filters[0]).not.to.have.property("defaultValues");
      expect(asset.toConfig().filters[0]).not.to.have.property("active");

      const projected = asset.toConfig();
      projected.filters[0].values.push("water");
      projected.colorPalette.colors[0].color = "#ffffff";
      expect(asset.toConfig().filters[0].values).to.deep.equal(["forest"]);
      expect(asset.toConfig().colorPalette.colors[0].color).to.equal("#008800");
    });

    it("keeps tileset filters as configured input", () => {
      const filters = [{ filterType: "numeric", property: "height", max: 10 }];
      const asset = new Cesium3DTileset({
        type: "Cesium3DTileset",
        visible: false,
        filters,
      });

      expect(asset.toConfig().filters).to.deep.equal(filters);
    });

    it("saves configured visibility instead of live visibility", () => {
      const asset = new MapAsset({
        type: "UnknownAsset",
        visible: true,
        configuredVisibility: false,
      });
      asset.set("visible", true);

      expect(asset.toConfig().visible).to.equal(false);
      expect(asset.toConfig()).not.to.have.property("configuredVisibility");
    });

    it("keeps viewer opacity and saturation changes out of config", () => {
      const asset = new MapAsset({
        type: "UnknownAsset",
        opacity: 0.4,
        saturation: 0.7,
      });
      asset.set({ opacity: 0.9, saturation: 0.2 });

      expect(asset.toConfig().opacity).to.equal(0.4);
      expect(asset.toConfig().saturation).to.equal(0.7);
    });

    it("keeps a complex config the same after saving and reloading", () => {
      const config = {
        type: "GeoJsonDataSource",
        label: "Forest cover",
        layerId: "forest-cover",
        icon: '<svg viewBox="0 0 1 1"></svg>',
        visible: false,
        opacity: 0.6,
        cesiumOptions: { data: { type: "FeatureCollection", features: [] } },
        filters: [
          {
            filterType: "categorical",
            property: "kind",
            allValues: ["forest", "grass"],
            values: ["forest"],
          },
        ],
        colorPalette: {
          paletteType: "continuous",
          property: "area",
          colors: [{ value: 1, color: "#123456" }],
        },
        outlineColor: "#123456",
        highlightColor: "#abcdef",
        featureTemplate: { label: "name" },
        customProperties: { region: { type: "string", value: "North" } },
        notification: { badge: "New", message: "Recently added" },
        clickFeatureAction: "showDetails",
      };
      const originalConfig = JSON.parse(JSON.stringify(config));
      const asset = new CesiumVectorData(config);
      const savedConfig = JSON.parse(JSON.stringify(asset.toConfig()));

      Object.keys(originalConfig).forEach((field) => {
        expect(savedConfig[field], field).to.deep.equal(originalConfig[field]);
      });
      expect(config).to.deep.equal(originalConfig);

      const reloaded = new CesiumVectorData(
        JSON.parse(JSON.stringify(savedConfig)),
      );
      expect(reloaded.toConfig()).to.deep.equal(savedConfig);
    });
  });
});
