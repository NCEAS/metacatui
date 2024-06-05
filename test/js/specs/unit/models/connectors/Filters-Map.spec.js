define([
  "../../../../../../../../src/js/models/connectors/Filters-Map",
], function (FiltersMap) {
  // Configure the Chai assertion library
  var should = chai.should();
  var expect = chai.expect;

  describe("FiltersMap Test Suite", function () {
    /* Set up */
    beforeEach(function () {
      this.filtersMap = new FiltersMap();
    });

    /* Tear down */
    afterEach(function () {
      this.filtersMap = null;
    });

    describe("Initialization", function () {
      it("should create a FiltersMap instance", function () {
        new FiltersMap().should.be.instanceof(FiltersMap);
      });

      it("should add a spatial filter to the Filters collection", function () {
        const filters = this.filtersMap.get("filters");
        filters.length.should.equal(1);
        filters.at(0).get("filterType").should.equal("SpatialFilter");
      });

      it("should set the spatialFilters on the model", function () {
        const spatialFilters = this.filtersMap.get("spatialFilters");
        spatialFilters.length.should.equal(1);
        spatialFilters[0].get("filterType").should.equal("SpatialFilter");
      });
    });

    describe("Spatial Filter", function () {
      it("should remove the spatial filter from the Filters collection", function () {
        this.filtersMap.removeSpatialFilter();
        const filters = this.filtersMap.get("filters");
        filters.length.should.equal(0);
      });

      it("should reset the spatial filter values to their defaults", function () {
        const spatialFilters = this.filtersMap.get("spatialFilters");
        spatialFilters[0].set("values", ["test"]);
        this.filtersMap.resetSpatialFilter();
        spatialFilters[0].get("values").should.deep.equal([]);
      });

      it("should update the spatial filter extent", function () {
        const map = this.filtersMap.get("map");
        const spatialFilters = this.filtersMap.get("spatialFilters");
        const extent = { north: 1, south: 2, east: 3, west: 4 };
        map.get("interactions").setViewExtent(extent);
        this.filtersMap.updateSpatialFilters();
        spatialFilters[0].get("north").should.equal(1);
        spatialFilters[0].get("south").should.equal(2);
        spatialFilters[0].get("east").should.equal(3);
        spatialFilters[0].get("west").should.equal(4);
      });
    });

    describe("Connect/Disconnect", function () {
      it("should connect to the map", function () {
        this.filtersMap.connect();
        this.filtersMap.get("isConnected").should.equal(true);
      });

      it("should disconnect from the map", function () {
        this.filtersMap.connect();
        this.filtersMap.disconnect();
        this.filtersMap.get("isConnected").should.equal(false);
      });

      it("should disconnect from the map and reset the spatial filter", function () {
        this.filtersMap.connect();
        this.filtersMap.disconnect(true);
        this.filtersMap.get("isConnected").should.equal(false);
        const spatialFilters = this.filtersMap.get("spatialFilters");
        spatialFilters[0].get("values").should.deep.equal([]);
      });
    });
  });
});
