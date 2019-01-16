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
             *  Consolidate geohashes into a parent tile if all are present
             */
            groupGeohashes: function() {
                var geohashGroups = {};
                var sortedGeohashes = this.get("geohashes").sort();
                var groupedGeohashes = _.groupBy(sortedGeohashes, function(geohash) {
                    return geohash.substring(0, geohash.length - 1);
                });
                //Find groups of geohashes that makeup a complete geohash tile (32) 
                // so we can shorten the query
                var completeGroups = _.filter(Object.keys(groupedGeohashes), function(group) {
                    return groupedGeohashes[group].length == 32;
                });
                
                // Find groups that fall short of 32 tiles
                var incompleteGroups = [];
                _.each(
                    _.filter(Object.keys(groupedGeohashes), function(group) { 
                        return (groupedGeohashes[group].length < 32) 
                    }), function(incomplete) { 
                        incompleteGroups.push(groupedGeohashes[n]); 
                    }
                );
                incompleteGroups = _.flatten(incompleteGroups);
                
                // Add both complete and incomplete groups to the instance property
                if((typeof incompleteGroups !== "undefined") && (incompleteGroups.length > 0)) {
                    geohashGroups[incompleteGroups[0].length.toString()] = incompleteGroups;
                }
                if((typeof completeGroups !== "undefined") && (completeGroups.length > 0)) {
                    geohashGroups[completeGroups[0].length.toString()] = completeGroups;
                }
                this.set("geohashGroups", geohashGroups); // Triggers a change event
            }
        });
        return SpatialFilter;
});