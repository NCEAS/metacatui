define([
  "../../../../../../../../src/js/collections/maps/Geohashes",
], function (Geohashes) {
  // Configure the Chai assertion library
  var should = chai.should();
  var expect = chai.expect;

  describe("Geohashes Test Suite", function () {
    /* Set up */
    beforeEach(function () {});

    /* Tear down */
    afterEach(function () {});

    describe("Initialization", function () {
      it("should create a Geohashes instance", function () {
        new Geohashes().should.be.instanceof(Geohashes);
      });
    });
  });
});