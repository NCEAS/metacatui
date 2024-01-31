define([
  "../../../../../../../../src/js/models/maps/GeoScale",
], function (GeoScale) {
  // Configure the Chai assertion library
  var should = chai.should();
  var expect = chai.expect;

  describe("GeoScale Test Suite", function () {
    /* Set up */
    beforeEach(function () {});

    /* Tear down */
    afterEach(function () {});

    describe("Initialization", function () {
      it("should create a GeoScale instance", function () {
        new GeoScale().should.be.instanceof(GeoScale);
      });
    });

    describe("Validation", function () {
      it("should validate a valid GeoScale", function () {
        var scale = new GeoScale({
          pixel: 1,
          meters: 1
        });
        scale.isValid().should.be.true;
      });

      it("should invalidate a GeoScale with an invalid pixel scale", function () {
        var scale = new GeoScale({
          pixel: -1,
          meters: 1
        });
        scale.isValid().should.be.false;
      });

      it("should invalidate a GeoScale with an invalid meters scale", function () {
        var scale = new GeoScale({
          pixel: 1,
          meters: -1
        });
        scale.isValid().should.be.false;
      });
    });
  });
});