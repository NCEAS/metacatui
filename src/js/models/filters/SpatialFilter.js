define(["underscore", "jquery", "backbone", "models/filters/Filter"], 
    function(_, $, Backbone, Filter) {
        
        /**
            A SpatialFilter represents a spatial constraint on the query to be executed,
            and stores the geohash strings for all of the geohash tiles that coincide with the
            search bounding box at the given zoom level.
         */
        var SpatialFilter = Filter.extend({
            
            type: "SpatialFilter",
            
            /* Default attributes of this model */
            defaults: function() {
                return _.extend(Filter.defaults(), {
                    /* The array of geohashes used to spatially constrain the search*/
                    geohashes: [],
                    
                    /* The easternmost longitude of the represented bounding box */
                    east: null,
                    
                    /* The westernmost longitude of the represented bounding box */
                    west: null,
                    
                    /* The northernmost latitude of the represented bounding box */
                    north: null,
                    
                    /* The southernmost latitude of the represented bounding box */
                    south: null,
                    
                    /* The default precision level of the geohash-based search */
                    geohashLevel: null
                });
            },
            
            /* Standard events and callbacks for this model */
            events: {
                "change geohashes": groupGeohashes
            },
            
            /**
             * Initialize the model, calling super
             */
            initialize: function(attributes, options) {
            },
            
            /**
             * Builds a query string that represents this spatial filter
             */
            getQuery: function() {
                
            },
            
            /**
             *  Consolidate 
             */
            groupGeohashes: function() {
                
            }
        });
        return SpatialFilter;
});