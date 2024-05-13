define([
  "../../../../../../../../src/js/models/filters/SpatialFilter",
], function (Spatialfilter) {
  // Configure the Chai assertion library
  var should = chai.should();
  var expect = chai.expect;

  describe("Spatialfilter Test Suite", function () {
    /* Set up */
    beforeEach(function () {});

    /* Tear down */
    afterEach(function () {});

    describe("Initialization", function () {
      it("should create a Spatialfilter instance", function () {
        new Spatialfilter().should.be.instanceof(Spatialfilter);
      });
    });
  });
});
