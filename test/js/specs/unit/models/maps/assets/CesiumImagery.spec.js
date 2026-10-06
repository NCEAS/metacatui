define([
  "models/maps/assets/CesiumImagery",
  "cesium",
  "/test/js/specs/shared/clean-state.js",
], function (CesiumImagery, Cesium, cleanState) {
  // Configure the Chai assertion library
  var should = chai.should();
  var expect = chai.expect;
  let imagery;
  let boundingBox;

  describe("CesiumImagery Test Suite", function () {
    /* Set up */
    beforeEach(function () {
      boundingBox = [-143.9, 69.65, -143.7, 69.75];
      imagery = new CesiumImagery({
        type: "WebMapTileServiceImageryProvider",
        cesiumOptions: {
          url: "/test/data/models/maps/assets/CesiumImagery/WorldCRS84Quad/{TileMatrix}/{TileCol}/{TileRow}.png",
          tilingScheme: "GeographicTilingScheme",
          rectangle: boundingBox,
        },
        saturation: 0.5,
      });
    });

    /* Tear down */
    afterEach(function () {
      imagery = undefined;
      boundingBox = undefined;
    });

    describe("The CesiumImagery model", function () {
      it("should create a CesiumImagery model", function () {
        imagery.should.be.instanceof(CesiumImagery);
      });
    });

    describe("Creating the Cesium Model", function () {
      it("should convert list of degrees to a Cesium rectangle", function (done) {
        imagery.whenReady().then(
          function (model) {
            const rect = model.get("cesiumModel").rectangle;
            expect(rect.constructor.name).to.equal("Rectangle");
            expect(model.get("cesiumOptions").rectangle).to.deep.equal(
              boundingBox,
            );
            expect(model.toConfig().cesiumOptions.tilingScheme).to.equal(
              "GeographicTilingScheme",
            );
            done();
          },
          function (error) {
            done(error);
          },
        );
      });

      it("should use saturation from the imagery model", function (done) {
        imagery.whenReady().then(
          function (model) {
            expect(model.get("cesiumModel").saturation).to.equal(0.5);
            done();
          },
          function (error) {
            done(error);
          },
        );
      });
    });
  });

  describe("CesiumImagery source shortcuts", () => {
    const state = cleanState(() => {
      const sandbox = sinon.createSandbox();
      sandbox.stub(CesiumImagery.prototype, "getThumbnail");
      return { sandbox };
    }, beforeEach);

    afterEach(() => {
      state.model?.stopListening();
      state.sandbox.restore();
    });

    it("expands Natural Earth only for the provider constructor", async () => {
      state.sandbox
        .stub(Cesium, "buildModuleUrl")
        .returns("/src/components/cesium/Assets/Textures/NaturalEarthII");
      const cesiumOptions = { minimumLevel: 1 };
      state.model = new CesiumImagery({
        type: "NaturalEarthII",
        visible: false,
        cesiumOptions,
      });
      const ready = new Promise((resolve) => {
        state.model.once("change:cesiumModel", resolve);
      });
      state.model.createCesiumModel();
      await ready;

      const provider = state.model.get("cesiumModel").imageryProvider;
      expect(provider).to.be.instanceof(Cesium.TileMapServiceImageryProvider);
      expect(provider.url).to.contain(
        "/src/components/cesium/Assets/Textures/NaturalEarthII",
      );
      expect(state.model.get("type")).to.equal("NaturalEarthII");
      expect(cesiumOptions).to.deep.equal({ minimumLevel: 1 });
      expect(state.model.toConfig().cesiumOptions).to.deep.equal(cesiumOptions);
    });

    it("expands USGS only for the provider and retains its metadata defaults", async () => {
      const createProvider = state.sandbox.spy(
        Cesium,
        "WebMapServiceImageryProvider",
      );
      const cesiumOptions = { parameters: { custom: "configured" } };
      state.model = new CesiumImagery({
        type: "USGSImageryTopo",
        visible: false,
        cesiumOptions,
      });
      state.model.createCesiumModel();
      await state.model.whenReady();

      expect(createProvider.calledOnce).to.equal(true);
      expect(createProvider.firstCall.args[0]).to.deep.equal({
        url: "https://basemap.nationalmap.gov:443/arcgis/services/USGSImageryTopo/MapServer/WmsServer",
        layers: "0",
        parameters: { transparent: true, format: "image/png" },
      });
      expect(state.model.get("type")).to.equal("USGSImageryTopo");
      expect(cesiumOptions).to.deep.equal({
        parameters: { custom: "configured" },
      });
      const config = state.model.toConfig();
      expect(config.cesiumOptions).to.deep.equal(cesiumOptions);
      expect(config.label).to.equal("USGS Imagery Topo");
      expect(config.attribution).to.contain("USGS The National Map");
      expect(config.description).to.contain("USGS Imagery Topo");
      expect(config.moreInfoLink).to.equal(
        "https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryTopo/MapServer",
      );
    });
  });

  describe("CesiumImagery source validation", () => {
    const state = cleanState(() => {
      const sandbox = sinon.createSandbox();
      sandbox.stub(CesiumImagery.prototype, "createCesiumModelWhenVisible");
      sandbox.stub(CesiumImagery.prototype, "getThumbnail");
      const createImagery = sandbox.stub(
        CesiumImagery.prototype,
        "createCesiumModel",
      );
      const url = "/tiles/{TileMatrix}/{TileCol}/{TileRow}.png";
      const model = new CesiumImagery({
        type: "WebMapTileServiceImageryProvider",
        label: "Original",
        cesiumOptions: { url },
      });
      return { sandbox, createImagery, model, url };
    }, beforeEach);

    afterEach(() => {
      state.model.stopListening();
      state.sandbox.restore();
    });

    it("accepts tile templates with either row/column order", () => {
      [state.url, "/tiles/{TileMatrix}/{TileRow}/{TileCol}"].forEach((url) => {
        expect(
          state.model.validate({
            type: "WebMapTileServiceImageryProvider",
            cesiumOptions: { url },
          }),
        ).to.equal(undefined);
      });
    });

    it("requires every WMTS tile placeholder", () => {
      [
        undefined,
        "",
        "/tiles",
        ...["{TileMatrix}", "{TileCol}", "{TileRow}"].map((placeholder) =>
          state.url.replace(placeholder, ""),
        ),
      ].forEach((url) => {
        expect(
          state.model.validate({
            type: "WebMapTileServiceImageryProvider",
            cesiumOptions: { url },
          }),
        ).to.have.property("cesiumOptions.url");
      });
    });

    it("accepts numeric and numeric-string Ion IDs without rewriting them", () => {
      [2, "2"].forEach((ionAssetId) => {
        const attrs = {
          type: "IonImageryProvider",
          cesiumOptions: { ionAssetId },
        };
        expect(state.model.validate(attrs)).to.equal(undefined);
        expect(attrs.cesiumOptions.ionAssetId).to.equal(ionAssetId);
      });
    });

    it("rejects missing, non-integer, and non-positive Ion IDs", () => {
      [undefined, "", 0, -1, 1.5, "invalid", Infinity, true].forEach(
        (ionAssetId) => {
          expect(
            state.model.validate({
              type: "IonImageryProvider",
              cesiumOptions: { ionAssetId },
            }),
          ).to.have.property("cesiumOptions.ionAssetId");
        },
      );
    });

    it("accepts omitted or complete extents, including the antimeridian", () => {
      [undefined, [-143.9, 69.65, -143.7, 69.75], [170, -20, -170, 20]].forEach(
        (rectangle) => {
          const cesiumOptions = { url: state.url };
          if (rectangle !== undefined) cesiumOptions.rectangle = rectangle;
          expect(
            state.model.validate({
              type: "WebMapTileServiceImageryProvider",
              cesiumOptions,
            }),
          ).to.equal(undefined);
        },
      );
    });

    it("rejects partial, non-finite, and out-of-range extents", () => {
      [
        [-140, 60],
        [-140, NaN, -130, 70],
        [-140, 60, Infinity, 70],
        [-181, 60, -130, 70],
        [-140, -91, -130, 70],
        [-140, 60, 181, 70],
        [-140, 60, -130, 91],
      ].forEach((rectangle) => {
        expect(
          state.model.validate({
            type: "WebMapTileServiceImageryProvider",
            cesiumOptions: { url: state.url, rectangle },
          }),
        ).to.have.property("cesiumOptions.rectangle");
      });
    });

    it("permits omitted OSM options and does not restrict other providers", () => {
      expect(
        state.model.validate({ type: "OpenStreetMapImageryProvider" }),
      ).to.equal(undefined);
      [
        "BingMapsImageryProvider",
        "TileMapServiceImageryProvider",
        "WebMapServiceImageryProvider",
      ].forEach((type) => {
        expect(state.model.validate({ type, cesiumOptions: {} })).to.equal(
          undefined,
        );
      });
    });

    it("rejects an invalid candidate atomically using candidate provider values", () => {
      const before = { ...state.model.attributes };
      const result = state.model.set(
        {
          label: "Draft",
          type: "IonImageryProvider",
          cesiumOptions: { ionAssetId: 0 },
        },
        { validate: true },
      );
      expect(result).to.equal(false);
      expect(state.model.attributes).to.deep.equal(before);
      expect(state.model.get("cesiumOptions")).to.equal(before.cesiumOptions);
      expect(state.model.validationError).to.have.property(
        "cesiumOptions.ionAssetId",
      );
      expect(state.createImagery.called).to.equal(false);
    });
  });
});
