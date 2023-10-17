define([
  "../../../../../../../../src/js/collections/maps/GeoPoints",
], function (GeoPoints) {
  // Configure the Chai assertion library
  var should = chai.should();
  var expect = chai.expect;

  describe("GeoPoints Test Suite", function () {
    /* Set up */
    beforeEach(function () {});

    /* Tear down */
    afterEach(function () {});

    describe("Initialization", function () {
      it("should create a GeoPoints instance", function () {
        new GeoPoints().should.be.instanceof(GeoPoints);
      });
    });
  });
});