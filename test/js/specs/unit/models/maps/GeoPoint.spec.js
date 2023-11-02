define([
  "../../../../../../../../src/js/models/maps/GeoPoint",
], function (GeoPoint) {
  // Configure the Chai assertion library
  var should = chai.should();
  var expect = chai.expect;

  describe("GeoPoint Test Suite", function () {
    /* Set up */
    beforeEach(function () {});

    /* Tear down */
    afterEach(function () {});

    describe("Initialization", function () {
      it("should create a GeoPoint instance", function () {
        new GeoPoint().should.be.instanceof(GeoPoint);
      });
    });

    describe("Validation", function () {
      it("should validate a valid GeoPoint", function () {
        var point = new GeoPoint({
          latitude: 0,
          longitude: 0,
          height: 0
        });
        point.isValid().should.be.true;
      });

      it("should invalidate a GeoPoint with an invalid latitude", function () {
        var point = new GeoPoint({
          latitude: 100,
          longitude: 0,
          height: 0
        });
        point.isValid().should.be.false;
      });

      it("should invalidate a GeoPoint with an invalid longitude", function () {
        var point = new GeoPoint({
          latitude: 0,
          longitude: 200,
          height: 0
        });
        point.isValid().should.be.false;
      });

      it("should invalidate a GeoPoint with an invalid height", function () {
        var point = new GeoPoint({
          latitude: 0,
          longitude: 0,
          height: "foo"
        });
        point.isValid().should.be.false;
      });
    });


  });
});