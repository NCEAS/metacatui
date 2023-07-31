define([
  "../../../../../../../../src/js/models/connectors/Map-Search",
  "../../../../../../../../src/js/models/maps/assets/CesiumGeohash",
], function (MapSearch, CesiumGeohash) {
  // Configure the Chai assertion library
  var should = chai.should();
  var expect = chai.expect;

  describe("MapSearch Test Suite", function () {
    /* Set up */
    beforeEach(function () {
      this.mapSearch = new MapSearch();
    });

    /* Tear down */
    afterEach(function () {
      this.mapSearch = null;
    });

    describe("Initialization", function () {
      it("should create a MapSearch instance", function () {
        new MapSearch().should.be.instanceof(MapSearch);
      });
    });

    describe("Connect/Disconnect", function () {
      it("should connect", function () {
        this.mapSearch.connect();
        this.mapSearch.get("isConnected").should.be.true;
      });

      it("should disconnect", function () {
        this.mapSearch.connect();
        this.mapSearch.disconnect();
        this.mapSearch.get("isConnected").should.be.false;
      });
    });

    describe("Geohash Layer", function () {
      it("should get the geohash layer", function () {
        console.log(this.mapSearch.get("geohashLayer"));
        this.mapSearch.get("geohashLayer").type.should.equal("CesiumGeohash");
      });

      it("should set the geohash layer", function () {
        var geohashLayer = new CesiumGeohash();
        this.mapSearch.set("geohashLayer", geohashLayer);
        this.mapSearch.get("geohashLayer").should.equal(geohashLayer);
      });
    });

    describe("Geohash Counts", function () {
      it("should get the geohash counts", function () {
        this.mapSearch.getGeohashCounts().should.deep.equal([]);
      });

      it("should get the geohash counts", function () {
        var searchResults = {
          facetCounts: {
            geohash_9: ["hash1", 1, "hash2", 2],
            geohash_8: ["hash3", 3, "hash4", 4],
          },
        };
        this.mapSearch.set("searchResults", searchResults);
        this.mapSearch
          .getGeohashCounts()
          .should.deep.equal(["hash1", 1, "hash2", 2, "hash3", 3, "hash4", 4]);
      });
    });

  });
});
