define([
  "../../../../../../../../src/js/models/connectors/GeoPoints-Cesium",
], function (GeoPointsCesium) {
  // Configure the Chai assertion library
  var should = chai.should();
  var expect = chai.expect;

  describe("GeoPointsCesium Test Suite", function () {
    /* Set up */
    beforeEach(function () {
      this.geoPointsCesium = new GeoPointsCesium();
    });

    /* Tear down */
    afterEach(function () {
      this.geoPointsCesium = null;
    });

    describe("Initialization", function () {
      it("should create a GeoPointsCesium instance", function () {
        new GeoPointsCesium().should.be.instanceof(GeoPointsCesium);
      });

      it("should set the GeoPoints collection", function () {
        this.geoPointsCesium.get("geoPoints").models.should.be.empty;
      });

      it("should set the CesiumVectorData model", function () {
        this.geoPointsCesium.get("layer").should.be.instanceof(Object)
      });
    });

    describe("Connect", function () {
      it("should connect to the GeoPoints collection", function () {
        this.geoPointsCesium.connect();
        this.geoPointsCesium.get("isConnected").should.equal(true);
      });

      it("should disconnect from the GeoPoints collection", function () {
        this.geoPointsCesium.connect();
        this.geoPointsCesium.disconnect();
        this.geoPointsCesium.get("isConnected").should.equal(false);
      });
    });
  });
});