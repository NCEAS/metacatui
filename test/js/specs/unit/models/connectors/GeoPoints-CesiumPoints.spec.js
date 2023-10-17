define([
  "../../../../../../../../src/js/models/connectors/GeoPoints-CesiumPoints",
], function (GeoPointsCesiumPoints) {
  // Configure the Chai assertion library
  var should = chai.should();
  var expect = chai.expect;

  describe("GeoPointsCesiumPoints Test Suite", function () {
    /* Set up */
    beforeEach(function () {});

    /* Tear down */
    afterEach(function () {});

    describe("Initialization", function () {
      it("should create a GeoPointsCesiumPoints instance", function () {
        new GeoPointsCesiumPoints().should.be.instanceof(GeoPointsCesiumPoints);
      });
    });
  });
});