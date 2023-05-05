define([
  "../../../../../../../../src/js/models/maps/Geohash",
], function (Geohash) {
  // Configure the Chai assertion library
  var should = chai.should();
  var expect = chai.expect;

  describe("Geohash Test Suite", function () {
    /* Set up */
    beforeEach(function () {});

    /* Tear down */
    afterEach(function () {});

    describe("Initialization", function () {
      it("should create a Geohash instance", function () {
        new Geohash().should.be.instanceof(Geohash);
      });
    });
  });
});