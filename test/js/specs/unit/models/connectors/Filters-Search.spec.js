define([
  "../../../../../../../../src/js/models/connectors/Filters-Search",
], function (FiltersSearch) {
  // Configure the Chai assertion library
  var should = chai.should();
  var expect = chai.expect;

  describe("FiltersSearch Test Suite", function () {
    /* Set up */
    beforeEach(function () {});

    /* Tear down */
    afterEach(function () {});

    describe("Initialization", function () {
      it("should create a FiltersSearch instance", function () {
        new FiltersSearch().should.be.instanceof(FiltersSearch);
      });
    });
  });
});