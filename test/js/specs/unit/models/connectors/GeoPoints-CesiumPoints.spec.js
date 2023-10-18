define([
  "../../../../../../../../src/js/models/connectors/GeoPoints-CesiumPoints",
], function (GeoPointsCesiumPoints) {
  // Configure the Chai assertion library
  var should = chai.should();
  var expect = chai.expect;

  describe("GeoPointsCesiumPoints Test Suite", function () {
    /* Set up */
    beforeEach(function () {
      // Create a new GeoPointsCesiumPoints instance
      this.geoPointsCesiumPoints = new GeoPointsCesiumPoints();
    });

    /* Tear down */
    afterEach(function () {
      // Destroy the GeoPointsCesiumPoints instance
      this.geoPointsCesiumPoints.destroy();
    });

    describe("Initialization", function () {
      it("should create a GeoPointsCesiumPoints instance", function () {
        new GeoPointsCesiumPoints().should.be.instanceof(GeoPointsCesiumPoints);
      });
    });

    describe("Defaults", function () {

      it("should have a layerPoints array", function () {
        this.geoPointsCesiumPoints.get("layerPoints").should.be.an("array");
      });
    });

    describe("handleCollectionChange", function () {
      it("should be a function", function () {
        this.geoPointsCesiumPoints
          .handleCollectionChange.should.be.a("function");
      });

    });



  });
});