/*global define */
define([
  "backbone",
  "models/maps/Map",
  "collections/SolrResults",
], function (Backbone, Map, SearchResults) {
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
       * The type of Backbone.Model this is.
       * @type {string}
       * @since x.x.x
       * @default "MapSearchConnector"
      */
      type: "MapSearchConnector",

      /**
       * @type {object}
       * @property {SolrResults} searchResults
       * @property {Map} map
       * @property {function} onMoveEnd A function to call when the map is
       * finished moving. This function will be called with the connector as
       * 'this'.
       */
      defaults: function () {
        return {
          searchResults: null,
          map: null,
          onMoveEnd: this.onMoveEnd
        };
      },

      /**
       * Initialize the model.
       * @param {Object} attrs - The attributes for this model.
       * @param {SolrResults | Object} [attributes.searchResults] - The
       * SolrResults model to use for this connector or a JSON object with
       * options to create a new SolrResults model. If not provided, a new
       * SolrResults model will be created.
       * @param {Map | Object} [attributes.map] - The Map model to use for this
       * connector or a JSON object with options to create a new Map model. If
       * not provided, a new Map model will be created.
       * @param {Object} [options] - The options for this model.
       * @param {boolean} [addGeohashLayer=true] - If true, a Geohash layer will
       * be added to the Map model if there is not already a Geohash layer in
       * the Map model's Layers collection. If false, no Geohash layer will be
       * added. A geohash layer is required for this connector to work.
       */
      initialize: function (attrs, options) {
        if (!this.get("map")) {
          this.set("map", new Map());
        }
        if (!this.get("searchResults")) {
          this.set("searchResults", new SearchResults());
        }
        const add = options?.addGeohashLayer ?? true;
        this.findAndSetGeohashLayer(add);
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
      createGeohash: function () {
        const map = this.get("map");
        return map.addAsset({ type: "CesiumGeohash" });
      },

      /**
       * Find the Geohash layer in the Map model's layers collection and
       * optionally create one if it doesn't exist. This will also create and
       * set a map and a layers collection from that map if they don't exist.
       * @param {boolean} [add=true] - If true, create a new Geohash layer if
       * one doesn't exist.
       * @returns {CesiumGeohash} The Geohash layer in the Map model's layers
       * collection or null if there is no Layers collection set on this model
       * and `add` is false.
       * @fires Layers#add
       */
      findAndSetGeohashLayer: function (add = true) {
        const wasConnected = this.get("isConnected");
        this.disconnect();
        const layers = this.findLayers() || this.createLayers();
        this.set("layers", layers);
        let geohash = this.findGeohash() || (add ? this.createGeohash() : null);
        this.set("geohashLayer", geohash);
        if (wasConnected) {
          this.connect();
        }
        // If there is still no Geohash layer, then we should wait for one to
        // be added to the Layers collection, then try to find it again.
        if (!geohash) {
          this.listenToOnce(layers, "add", this.findAndSetGeohashLayer);
          return;
        }
        return geohash;
      },

      /**
       * Connect the Map to the Search. When a new search is performed, the
       * Search will set the new facet counts on the GeoHash layer in the Map.
       * When the view extent on the map has changed, the geohash facet on the
       * search will be updated to reflect the new height/altitude of the view.
       * This will trigger a new search, which will update the counts on the
       * GeoHash layer in the Map. When connected, the Geohash layer will also
       * be hidden during search requests, and while the user is panning/zooming
       * the map.
       */
      connect: function () {
        this.disconnect();

        const searchResults = this.get("searchResults");
        const map = this.get("map");

        // Pass the facet counts to the GeoHash layer when the search results
        // are returned.
        this.listenTo(searchResults, "update reset", function () {
          this.updateGeohashCounts();
          this.showGeoHashLayer();
        });

        // When the search result should be shown on the map (e.g. a user hovers
        // over the map icon), highlight the GeoHash on the map.
        this.listenTo(searchResults, "change:showOnMap", this.selectGeohash);

        // When the user is panning/zooming in the map, hide the GeoHash layer
        // to indicate that the map is not up to date with the search results,
        // which are about to be updated.
        this.listenTo(map, "moveStart", this.hideGeoHashLayer);

        // When the user is done panning/zooming in the map, show the GeoHash
        // layer again and update the search results (thereby updating the
        // facet counts on the GeoHash layer)
        this.listenTo(map, "moveEnd", function () {
          const moveEndFunc = this.get("onMoveEnd");
          if (typeof moveEndFunc === "function") {
            moveEndFunc.call(this);
          }
        });

        // When a new search is being performed, hide the GeoHash layer to
        // indicate that the map is not up to date with the search results,
        // which are about to be updated.
        this.listenTo(searchResults, "request", function () {
          this.hideGeoHashLayer();
        });

        this.set("isConnected", true);
      },

      /**
       * Functions to perform when the map has finished moving. This is separated into its own method
       * so that external models can manipulate the behavior of this function.
       * See {@link MapSearchFiltersConnector#onMoveEnd}
       */
      onMoveEnd: function () {
        const searchResults = this.get("searchResults");
        const map = this.get("map");
        this.showGeoHashLayer();
        this.updateFacet();
      },

      /**
       * Make the geoHashLayer invisible temporarily. This will override the
       * visible property on the layer until the showGeoHashLayer method is
       * called.
       * @fires CesiumGeohash#change:visible
       */
      hideGeoHashLayer: function () {
        this.get("geohashLayer")?.set("temporarilyHidden", true);
      },

      /**
       * Make the geoHashLayer visible again after hiding it with the
       * hideGeoHashLayer method.
       * @fires CesiumGeohash#change:visible
       */
      showGeoHashLayer: function () {
        this.get("geohashLayer")?.set("temporarilyHidden", false);
      },

      /**
       * Disconnect the Map from the Search. Stops listening to the Search
       * results collection.
       */
      disconnect: function () {
        const map = this.get("map");
        const searchResults = this.get("searchResults");
        this.stopListening(searchResults, "update reset");
        this.stopListening(searchResults, "change:showOnMap");
        this.stopListening(map, "moveStart moveEnd");
        this.stopListening(searchResults, "request");
        this.set("isConnected", false);
      },

      /**
       * Given the counts results in the format returned by the SolrResults
       * model, return an array of objects with a geohash and a count property,
       * formatted for the CesiumGeohash layer.
       * @param {Array} counts - The facet counts from the SolrResults model.
       * Given as an array of alternating keys and values.
       * @returns {Array} An array of objects with a geohash and a count
       * property.
       */
      facetCountsToGeohashAttrs: function (counts) {
        if (!counts) return [];
        const props = [];
        for (let i = 0; i < counts.length; i += 2) {
          props.push({
            hashString: counts[i],
            properties: {
              count: counts[i + 1],
            },
          });
        }
        return props;
      },

      /**
       * Look in the Search results for the facet counts for the Geohash layer.
       * @returns {Array} An array of objects with a geohash and a count
       * property or null if there are no Search results or no facet counts.
       */
      getGeohashCounts: function () {
        const searchResults = this.get("searchResults");
        const facetCounts = searchResults?.facetCounts;
        if (!facetCounts) return null;
        const geohashFacets = Object.keys(facetCounts).filter((key) =>
          key.startsWith("geohash_")
        );
        return geohashFacets.flatMap((key) => facetCounts[key]);
      },

      /**
       * Update the Geohash layer in the Map model with the new facet counts
       * from the Search results.
       * @fires CesiumGeohash#change:counts
       * @fires CesiumGeohash#change:totalCount
       */
      updateGeohashCounts: function () {
        const geohashLayer = this.get("geohashLayer");
        const counts = this.getGeohashCounts();
        const modelAttrs = this.facetCountsToGeohashAttrs(counts);
        geohashLayer.replaceGeohashes(modelAttrs);
      },

      /**
       * Update the facet on the Search results to match the current Geohash
       * level.
       * @fires SolrResults#change:facet
       */
      updateFacet: function () {
        const searchResults = this.get("searchResults");
        const geohashLayer = this.get("geohashLayer");
        const precision = geohashLayer.getPrecision();
        if (precision && typeof Number(precision) === "number") {
          searchResults.setFacet([`geohash_${precision}`]);
        } else {
          searchResults.setFacet(null);
        }
      },

      /**
       * Highlight the geohashes for the given search result on the map, or
       * remove highlighting if the search result is not selected.
       * @param {SolrResult} searchResult - The search result to highlight.
       */
      selectGeohash: function (searchResult) {
        // remove highlighting on geohashes by clearing all selected features
        if (!searchResult.get("showOnMap")) {
          this.get("map").selectFeatures(null);
          return;
        }
        // Get the highest precision geohashes for the given search result
        // and pass them to the geohash layer to highlight them.
        const geohashes9 = searchResult.get("geohash_9");
        this.get("geohashLayer").selectGeohashes(geohashes9);
      },
    }
  );
});
