define([
  "models/connectors/Map-Search",
  "models/maps/assets/CesiumGeohash",
  "models/maps/Map",
  "collections/maps/MapAssets",
  "/test/js/specs/shared/clean-state.js",
], function (MapSearch, CesiumGeohash, Map, MapAssets, cleanState) {
  // Configure the Chai assertion library
  const should = chai.should();
  const expect = chai.expect;
  const sandbox = sinon.createSandbox();
  const stub = sandbox.stub;

  describe("MapSearch Test Suite", function () {
    /* Set up */
    const state = cleanState(() => {
      return { mapSearch: new MapSearch() };
    }, beforeEach);

    describe("Initialization", function () {
      it("should create a MapSearch instance", function () {
        new MapSearch().should.be.instanceof(MapSearch);
      });
    });

    describe("Connect/Disconnect", function () {
      it("should connect", function () {
        state.mapSearch.connect();
        state.mapSearch.get("isConnected").should.be.true;
      });

      it("should disconnect", function () {
        state.mapSearch.connect();
        state.mapSearch.disconnect();
        state.mapSearch.get("isConnected").should.be.false;
      });
    });

    describe("Geohash Layer", function () {
      it("should get the geohash layer", function () {
        state.mapSearch.get("geohashLayer").type.should.equal("CesiumGeohash");
      });

      it("should set the geohash layer", function () {
        var geohashLayer = new CesiumGeohash();
        state.mapSearch.set("geohashLayer", geohashLayer);
        state.mapSearch.get("geohashLayer").should.equal(geohashLayer);
      });
    });

    describe("Geohash Counts", function () {
      it("should get the geohash counts", function () {
        state.mapSearch.getGeohashCounts().should.deep.equal([]);
      });

      it("should get the geohash counts", function () {
        var searchResults = {
          facetCounts: {
            geohash_9: ["hash1", 1, "hash2", 2],
            geohash_8: ["hash3", 3, "hash4", 4],
          },
        };
        state.mapSearch.set("searchResults", searchResults);
        state.mapSearch
          .getGeohashCounts()
          .should.deep.equal(["hash1", 1, "hash2", 2, "hash3", 3, "hash4", 4]);
      });
    });

    describe("findAndSetGeohashLayer", () => {
      it("finds and sets layer groups from map", () => {
        const map = new Map({ layers: [{}] });
        const layers = map.get("layers");
        state.mapSearch.set("map", map);

        state.mapSearch.findAndSetGeohashLayer();

        expect(state.mapSearch.get("layerGroups")).to.have.lengthOf(1);
        expect(state.mapSearch.get("layerGroups")[0]).to.equal(layers);
      });

      it("creates and sets layer groups if one doesn't exist", () => {
        const map = new Map();
        map.unset("layers");
        state.mapSearch.set("map", map);
        state.mapSearch.unset("layerGroups");

        state.mapSearch.findAndSetGeohashLayer();

        expect(state.mapSearch.get("layerGroups")).to.have.lengthOf(1);
      });

      it("finds and sets the first geohash layer from map", () => {
        const geohash1 = new CesiumGeohash();
        const geohash2 = new CesiumGeohash();
        const map = new Map({ layers: [geohash1, geohash2] });
        state.mapSearch.set("map", map);

        state.mapSearch.findAndSetGeohashLayer();

        expect(state.mapSearch.get("geohashLayer")).to.equal(geohash1);
      });

      it("creates and sets a geohash if one doesn't exist", () => {
        const map = new Map({ layers: [{}] });
        state.mapSearch.set("map", map);
        state.mapSearch.unset("geohashLayer");


        state.mapSearch.findAndSetGeohashLayer();

        expect(state.mapSearch.get("geohashLayer")).to.be.instanceof(CesiumGeohash);
      });

      it("doesn't create a geohash if add is false", () => {
        const map = new Map({ layers: [{}] });
        state.mapSearch.set("map", map);
        state.mapSearch.unset("geohashLayer");


        state.mapSearch.findAndSetGeohashLayer(/* add= */ false);

        expect(state.mapSearch.get("geohashLayer")).to.be.null;
      });
    });
  });
});
