/*global define */
define([
  "backbone",
  "models/maps/Map",
  "collections/SolrResults",
  "models/maps/assets/CesiumGeohash",
], function (Backbone, Map, SearchResults, Geohash) {
  "use strict";

  /**
   * @class MapSearchConnector
   * @classdesc A model that updates the counts on a Geohash layer in a Map
   * model when the search results from a search model are reset.
   * @name MapSearchConnector
   * @extends Backbone.Model
   * @constructor
   * @classcategory Models/Connectors
   */
  return Backbone.Model.extend(
    /** @lends MapSearchConnector.prototype */ {
      /**
       * @type {object}
       * @property {SolrResults} searchResults
       * @property {Map} map
       */
      defaults: function () {
        return {
          searchResults: null,
          map: null,
        };
      },

      /**
       * @inheritdoc
       */
      initialize: function () {
        this.findAndSetGeohashLayer();
      },

      /**
       * Find the first Geohash layer in the Map model's layers collection.
       * @returns {CesiumGeohash} The first Geohash layer in the Map model's
       * layers collection or null if there is no Layers collection set on this
       * model or no Geohash layer in the collection.
       */
      findGeohash: function () {
        const layers = this.get("layers");
        if (!layers) return null;
        let geohashes = layers.getAll("CesiumGeohash");
        if (!geohashes || !geohashes.length) {
          return null;
        } else {
          return geohashes[0] || null;
        }
      },

      /**
       * Find the Layers collection from the Map model.
       * @returns {Layers} The Layers collection from the Map model or null if
       * there is no Map model set on this model.
       */
      findLayers: function () {
        const model = this;
        const map = this.get("map");
        if (!map) return null;
        return map.get("layers");
      },

      /**
       * Create a new Layers collection and set it on the Map model.
       * @returns {Layers} The new Layers collection.
       */
      createLayers: function () {
        const map = this.get("map");
        if (!map) return null;
        return map.resetLayers();
      },

      /**
       * Create a new Geohash layer and add it to the Layers collection.
       * @returns {CesiumGeohash} The new Geohash layer or null if there is no
       * Layers collection set on this model.
       * @fires Layers#add
       */
      createGeohash() {
        const layers = this.get("layers");
        if (!layers) return null;
        return layers.addGeohashLayer();
      },

      /**
       * Find the Geohash layer in the Map model's layers collection and
       * optionally create one if it doesn't exist. This will also create and
       * set a map and a layers collection from that map if they don't exist.
       * @param {boolean} [add=false] - If true, create a new Geohash layer if
       * one doesn't exist.
       * @returns {CesiumGeohash} The Geohash layer in the Map model's layers
       * collection or null if there is no Layers collection set on this model
       * and `add` is false.
       * @fires Layers#add
       */
      findAndSetGeohashLayer: function (add = false) {
        const wasConnected = this.get("isConnected");
        this.disconnect();
        let map = this.get("map") || this.set("map", new Map()).get("map");
        const layers = this.findLayers() || this.createLayers();
        this.set("layers", layers);
        let geohash = this.findGeohash() || (add ? this.createGeohash() : null);
        this.set("geohashLayer", geohash);
        if (wasConnected) {
          this.connect();
        }
        return geohash;
      },

      /**
       * Connect the Map to the Search. When a new search is performed, the
       * Search will set the new facet counts on the GeoHash layer in the Map.
       */
      connect: function () {
        this.disconnect();
        const searchResults = this.get("searchResults");
        this.listenTo(searchResults, "reset", this.updateGeohashCounts);
        this.set("isConnected", true);
      },

      /**
       * Disconnect the Map from the Search. Stops listening to the Search
       * results collection.
       */
      disconnect: function () {
        const searchResults = this.get("searchResults");
        this.stopListening(searchResults, "reset");
        this.set("isConnected", false);
      },

      /**
       * Update the Geohash layer in the Map model with the new facet counts
       * from the Search results.
       * @fires CesiumGeohash#change:counts
       * @fires CesiumGeohash#change:totalCount
       */
      updateGeohashCounts: function () {
        const geohashLayer = this.get("geohashLayer");
        const searchResults = this.get("searchResults");
        const facetCounts = searchResults.facetCounts;

        // Get every facet that begins with "geohash_"
        const geohashFacets = Object.keys(facetCounts).filter((key) =>
          key.startsWith("geohash_")
        );

        // Flatten counts from geohashFacets
        const allCounts = geohashFacets.flatMap((key) => facetCounts[key]);

        const totalFound = searchResults.getNumFound();

        // Set the new geohash facet counts on the Map MapAsset
        geohashLayer.set("counts", allCounts);
        geohashLayer.set("totalCount", totalFound);
      },
    }
  );
});
