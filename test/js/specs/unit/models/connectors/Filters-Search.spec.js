define([
  "../../../../../../../../src/js/models/connectors/Filters-Search",
], function (FiltersSearch) {
  // Configure the Chai assertion library
  var should = chai.should();
  var expect = chai.expect;

  describe("FiltersSearch Test Suite", function () {
    /* Set up */
    beforeEach(function () {
      this.filtersSearch = new FiltersSearch();
    });

    /* Tear down */
    afterEach(function () {
      this.filtersSearch = null;
    });

    describe("Initialization", function () {
      it("should create a FiltersSearch instance", function () {
        new FiltersSearch().should.be.instanceof(FiltersSearch);
      });
    });

    describe("Connect/Disconnect", function () {
      it("should connect to the search results", function () {
        this.filtersSearch.connect();
        this.filtersSearch.get("isConnected").should.equal(true);
      });

      it("should disconnect from the search results", function () {
        this.filtersSearch.connect();
        this.filtersSearch.disconnect();
        this.filtersSearch.get("isConnected").should.equal(false);
      });
    });
    describe("Trigger Search", function () {
      it("should trigger a search", function () {
        // TODO: Figure out how to test this
        this.filtersSearch.triggerSearch();
      });
    });
  });
});
