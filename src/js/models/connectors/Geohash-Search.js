/*global define */
define(['backbone', "models/maps/assets/CesiumGeohash", "collections/SolrResults", "models/Search"],
  function(Backbone, CesiumGeohash, SearchResults, Search) {
  'use strict';

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

        defaults: function(){
            return{
                searchResults: null,
                cesiumGeohash: null
            }
        },

        startListening: function(){
            this.listenTo(this.get("searchResults"), "reset", function(){
                //Set the new geohash facet counts on the CesiumGeohash MapAsset
                let level = this.get("cesiumGeohash").get("geohashLevel");
                this.get("cesiumGeohash").set("geohashCounts", this.get("searchResults").facetCounts["geohash_"+level] );
                this.get("cesiumGeohash").set("totalCount", this.get("searchResults").getNumFound() );

                //Set the status of the CesiumGeohash MapAsset to 'ready' so that it is re-rendered
                if(this.get("cesiumGeohash").get("status") == "ready"){
                    this.get("cesiumGeohash").trigger("change:status");
                }
                else{
                    this.get("cesiumGeohash").set("status", "ready");
                }
            });
            
            this.listenTo(this.get("cesiumGeohash"), "change:geohashLevel", function(){
                this.get("searchResults").setFacet(["geohash_"+this.get("cesiumGeohash").get("geohashLevel")]);
            });
        }

  });

});
