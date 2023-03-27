/*global define */
define([
  "backbone",
  "models/maps/assets/CesiumGeohash",
  "collections/SolrResults",
  "models/Search",
], function (Backbone, CesiumGeohash, SearchResults, Search) {
  "use strict";

  /**
   * @class GeohashSearchConnector
   * @classdesc A model that creates listeners between the CesiumGeohash MapAsset model and the Search model.
   * @name GeohashSearchConnector
   * @extends Backbone.Model
   * @constructor
   * @classcategory Models/Connectors
   */
  return Backbone.Model.extend(
    /** @lends GeohashSearchConnector.prototype */ {
      /**
       * @type {object}
       * @property {SolrResults} searchResults
       * @property {CesiumGeohash} cesiumGeohash
       */
      defaults: function () {
        return {
          searchResults: null,
          cesiumGeohash: null,
        };
      },

      /**
       * Sets listeners on the CesiumGeohash map asset and the SearchResults. It will get the geohash facet data
       * from the SolrResults and set it on the CesiumGeohash so it can be used by a map view. It also updates the
       * geohash level in the SolrResults so that it can be used by the next query.
       * @since 2.22.0
       */
      startListening: function () {
        const geohashLayer = this.get("cesiumGeohash");
        const searchResults = this.get("searchResults");

        this.listenTo(searchResults, "reset", function () {
          const level = geohashLayer.get("level") || 1;
          const facetCounts = searchResults.facetCounts["geohash_" + level];
          const totalFound = searchResults.getNumFound();

          // Set the new geohash facet counts on the CesiumGeohash MapAsset
          geohashLayer.set("counts", facetCounts);
          geohashLayer.set("totalCount", totalFound);
        });

        this.listenTo(geohashLayer, "change:geohashLevel", function () {
          const level = geohashLayer.get("level") || 1;
          searchResults.setFacet(["geohash_" + level]);
        });
      },
    }
  );
});
