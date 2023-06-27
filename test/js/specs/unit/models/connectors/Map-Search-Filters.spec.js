define([
  "../../../../../../../../src/js/models/connectors/Map-Search-Filters",
  "../../../../../../../../src/js/models/maps/Map",
  "../../../../../../../../src/js/collections/SolrResults",
  "../../../../../../../../src/js/collections/Filters",
], function (MapSearchFilters, Map, SolrResults, Filters) {
  // Configure the Chai assertion library
  var should = chai.should();
  var expect = chai.expect;

  describe("MapSearchFilters Test Suite", function () {
    /* Set up */
    beforeEach(function () {
      this.mapSearchFilters = new MapSearchFilters();
    });

    /* Tear down */
    afterEach(function () {
      this.mapSearchFilters = null;
    });

    describe("Initialization", function () {
      it("should create a MapSearchFilters instance", function () {
        new MapSearchFilters().should.be.instanceof(MapSearchFilters);
      });

      it("should set a map, search results, and filters", function () {
        this.mapSearchFilters.get("map").type.should.equal("MapModel");
        this.mapSearchFilters
          .get("searchResults")
          .type.should.equal("SolrResults");
        this.mapSearchFilters.get("filters").type.should.equal("Filters");
      });

      it("should set up connectors", function () {
        const connectors = this.mapSearchFilters.getConnectors();
        connectors.length.should.equal(3);
        connectors[0].type.should.equal("MapSearchConnector");
        connectors[1].type.should.equal("FiltersSearchConnector");
        connectors[2].type.should.equal("FiltersMapConnector");
      });
    });

    describe("Connect/Disconnect", function () {
      it("should connect to the search results", function () {
        this.mapSearchFilters.connect();
        const connectors = this.mapSearchFilters.getConnectors();
        connectors.forEach((connector) => {
          connector.get("isConnected").should.equal(true);
        });
      });

      it("should disconnect from the search results", function () {
        this.mapSearchFilters.connect();
        this.mapSearchFilters.disconnect();
        const connectors = this.mapSearchFilters.getConnectors();
        connectors.forEach((connector) => {
          connector.get("isConnected").should.equal(false);
        });
      });
    });

    describe("Coordinate MoveEnd Search", function () {
      it("should coordinate the moveEnd search", function () {
        this.mapSearchFilters.coordinateMoveEndSearch();
        const connectors = this.mapSearchFilters.getMapConnectors();
        connectors.forEach((connector) => {
          expect(connector.get("onMoveEnd") === null).to.equal(true);
        });
      });

      it("should reset the moveEnd search behaviour", function () {
        this.mapSearchFilters.coordinateMoveEndSearch();
        this.mapSearchFilters.resetMoveEndSearch();
        const connectors = this.mapSearchFilters.getMapConnectors();
        connectors.forEach((connector) => {
          expect(typeof connector.get("onMoveEnd")).to.equal("function");
        });
      });
    });
  });
});
