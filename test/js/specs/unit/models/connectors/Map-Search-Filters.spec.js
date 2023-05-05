define([
  "../../../../../../../../src/js/models/connectors/Map-Search-Filters",
], function (MapSearchFilters) {
  // Configure the Chai assertion library
  var should = chai.should();
  var expect = chai.expect;

  describe("MapSearchFilters Test Suite", function () {
    /* Set up */
    beforeEach(function () {});

    /* Tear down */
    afterEach(function () {});

    describe("Initialization", function () {
      it("should create a MapSearchFilters instance", function () {
        new MapSearchFilters().should.be.instanceof(MapSearchFilters);
      });
    });
  });
});