define([
  "../../../../../../../../src/js/models/connectors/GeoPoints-Cesium",
], function (GeoPointsCesium) {
  // Configure the Chai assertion library
  var should = chai.should();
  var expect = chai.expect;

  describe("GeoPointsCesium Test Suite", function () {
    /* Set up */
    beforeEach(function () {});

    /* Tear down */
    afterEach(function () {});

    describe("Initialization", function () {
      it("should create a GeoPointsCesium instance", function () {
        new GeoPointsCesium().should.be.instanceof(GeoPointsCesium);
      });
    });
  });
});