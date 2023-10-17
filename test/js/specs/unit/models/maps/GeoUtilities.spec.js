define([
  "../../../../../../../../src/js/models/maps/GeoUtilities",
], function (GeoUtilities) {
  // Configure the Chai assertion library
  var should = chai.should();
  var expect = chai.expect;

  describe("GeoUtilities Test Suite", function () {
    /* Set up */
    beforeEach(function () {});

    /* Tear down */
    afterEach(function () {});

    describe("Initialization", function () {
      it("should create a GeoUtilities instance", function () {
        new GeoUtilities().should.be.instanceof(GeoUtilities);
      });
    });
  });
});