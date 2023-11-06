define([
  "../../../../../../../../src/js/models/connectors/GeoPoints-CesiumPolygon",
], function (GeoPointsCesiumPolygon) {
  // Configure the Chai assertion library
  var should = chai.should();
  var expect = chai.expect;

  describe("GeoPointsCesiumPolygon Test Suite", function () {
    /* Set up */
    beforeEach(function () {
      this.geoPointsCesiumPolygon = new GeoPointsCesiumPolygon();
    });

    /* Tear down */
    afterEach(function () {
      this.geoPointsCesiumPolygon.destroy();
    });

    describe("Initialization", function () {
      it("should create a GeoPointsCesiumPolygon instance", function () {
        new GeoPointsCesiumPolygon().should.be.instanceof(GeoPointsCesiumPolygon);
      });
    });

  });
});