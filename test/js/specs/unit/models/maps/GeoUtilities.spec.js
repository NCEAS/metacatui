
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

    describe("geodeticToECEF", function () {
      it("should convert geodetic coordinates to ECEF coordinates", function () {
        const coord = [30, 40];
        const ecef = new GeoUtilities().geodeticToECEF(coord);
        console.log(ecef);
        ecef[0].should.be.closeTo(4243843, 1.0);
        ecef[1].should.be.closeTo(2450184, 1.0);
        ecef[2].should.be.closeTo(4084413, 1.0);
      });
    });
  });
});