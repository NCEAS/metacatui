define([
  "../../../../../../../../src/js/models/connectors/Filters-Map",
], function (FiltersMap) {
  // Configure the Chai assertion library
  var should = chai.should();
  var expect = chai.expect;

  describe("FiltersMap Test Suite", function () {
    /* Set up */
    beforeEach(function () {});

    /* Tear down */
    afterEach(function () {});

    describe("Initialization", function () {
      it("should create a FiltersMap instance", function () {
        new FiltersMap().should.be.instanceof(FiltersMap);
      });
    });
  });
});