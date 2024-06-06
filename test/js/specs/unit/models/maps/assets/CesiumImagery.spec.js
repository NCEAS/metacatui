define([
  "../../../../../../../../../src/js/models/maps/assets/CesiumImagery",
  "../../../../../../../../../src/components/cesium/Cesium",
], function (CesiumImagery, Cesium) {
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
});
