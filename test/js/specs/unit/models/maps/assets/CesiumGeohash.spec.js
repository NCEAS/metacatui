define([
  "../../../../../../../../src/js/models/maps/assets/CesiumGeohash",
], function (Cesiumgeohash) {
  // Configure the Chai assertion library
  var should = chai.should();
  var expect = chai.expect;

  describe("Cesiumgeohash Test Suite", function () {
    /* Set up */
    beforeEach(function () {});

    /* Tear down */
    afterEach(function () {});

    describe("Initialization", function () {
      it("should create a Cesiumgeohash instance", function () {
        new Cesiumgeohash().should.be.instanceof(Cesiumgeohash);
      });
    });
  });
});