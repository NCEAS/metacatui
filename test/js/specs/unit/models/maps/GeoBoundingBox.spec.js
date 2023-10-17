define([
  "../../../../../../../../src/js/models/maps/GeoBoundingBox",
], function (GeoBoundingBox) {
  // Configure the Chai assertion library
  var should = chai.should();
  var expect = chai.expect;

  describe("GeoBoundingBox Test Suite", function () {
    /* Set up */
    beforeEach(function () {});

    /* Tear down */
    afterEach(function () {});

    describe("Initialization", function () {
      it("should create a GeoBoundingBox instance", function () {
        new GeoBoundingBox().should.be.instanceof(GeoBoundingBox);
      });
    });
  });
});