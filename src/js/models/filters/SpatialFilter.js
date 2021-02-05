define(["underscore", "jquery", "backbone", "models/filters/Filter"],
    function(_, $, Backbone, Filter) {

        /**
        * @classdesc A SpatialFilter represents a spatial constraint on the query to be executed,
        * and stores the geohash strings for all of the geohash tiles that coincide with the
        * search bounding box at the given zoom level.
        * @class SpatialFilter
        * @classcategory Models/Filters
        * @name SpatialFilter
        * @constructs
        * @extends Filter
        */
        var SpatialFilter = Filter.extend(
          /** @lends SpatialFilter.prototype */{

            /**
             @inheritdoc
            */
            type: "SpatialFilter",

            /**
            * Inherits all default properties of {@link Filter}
            * @property {string[]} geohashes - The array of geohashes used to spatially constrain the search
            * @property {object} groupedGeohashes -The same geohash values, grouped by geohash level (e.g. 1,2,3...). Complete geohash groups (of 32) are consolidated to the level above.
            * @property {number} east The easternmost longitude of the represented bounding box
            * @property {number} west The westernmost longitude of the represented bounding box
            * @property {number} north The northernmost latitude of the represented bounding box
            * @property {number} south The southernmost latitude of the represented bounding box
            * @property {number} geohashLvel The default precision level of the geohash-based search
            */
            defaults: function() {
                return _.extend(Filter.prototype.defaults(), {
                    geohashes: [],
                    east: null,
                    west: null,
                    north: null,
                    south: null,
                    geohashLevel: null,
                    groupedGeohashes: {},
                    label: "Limit search to the map area",
                    icon: "globe",
                    operator: "OR",
                    fieldsOperator: "OR",
                    matchSubstring: false
                });
            },

            /**
             * Initialize the model, calling super
             */
            initialize: function(attributes, options) {
                this.on("change:geohashes", this.groupGeohashes);
            },

            /**
             * Builds a query string that represents this spatial filter
             * @return queryFragment - the query string representing the geohash constraints
             */
            getQuery: function() {
                var queryFragment = "";
                var geohashes = this.get("geohashes");
                var groups = this.get("geohashGroups");
                var geohashList;

                // Only return geohash query fragments when they are enabled in the filter
                if ( (typeof geohashes !== "undefined") && geohashes.length > 0 ) {
                    if ( (typeof groups !== "undefined") &&
                        Object.keys(groups).length > 0
                    ) {
                        // Group the Solr query fragment
                        queryFragment += "+(";

                        // Append geohashes at each level up to a fixed query string length
                        _.each(Object.keys(groups), function(level) {
                            geohashList = groups[level];
                            queryFragment += "geohash_" + level + ":(";
                            _.each(geohashList, function(geohash) {
                                if ( queryFragment.length < 7900 ) {
                                    queryFragment += geohash + "%20OR%20";
                                }
                            });
                            // Remove the last OR
                            queryFragment =
                                queryFragment.substring(0, (queryFragment.length - 8));
                            queryFragment += ")%20OR%20";
                        });
                        // Remove the last OR
                        queryFragment = queryFragment.substring(0, (queryFragment.length - 8));
                        // Ungroup the Solr query fragment
                        queryFragment += ")";

                    }
                }
                return queryFragment;
            },

            /**
            * @inheritdoc
            */
            updateDOM: function(options){

              try{
                var updatedDOM = Filter.prototype.updateDOM.call(this, options),
                    $updatedDOM = $(updatedDOM);

                //Force the serialization of the "operator" node for SpatialFilters,
                // since the Filter model will skip default values
                var operatorNode = updatedDOM.ownerDocument.createElement("operator");
                operatorNode.textContent = this.get("operator");

                var matchSubstringNode = updatedDOM.ownerDocument.createElement("matchSubstring");
                matchSubstringNode.textContent = this.get("matchSubstring");

                //Insert the operator node
                $updatedDOM.children("field").last().after(operatorNode);

                //Insert the matchSubstring node
                $(matchSubstringNode).insertBefore($updatedDOM.children("value").first());

                //Return the updated DOM
                return updatedDOM;
              }
              catch(e){
                console.error("Unable to serialize a SpatialFilter.", e);
                return this.get("objectDOM") || "";
              }
            },

            /**
             *  Consolidates geohashes into groups based on their geohash level
             *  and updates the model with those groups. The fields and values attributes
             *  on this model are also updated with the geohashes.
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
                        incompleteGroups.push(groupedGeohashes[incomplete]);
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

                //Determine the field and value attributes
                var fields = [],
                    values = [];
                _.each( Object.keys(geohashGroups), function(geohashLevel){
                  fields.push( "geohash_" + geohashLevel );
                  values = values.concat( geohashGroups[geohashLevel].slice() );
                }, this);

                this.set("fields", fields);
                this.set("values", values);
            },

            /**
            * @inheritdoc
            */
            resetValue: function(){
              this.set("fields", this.defaults().fields);
              this.set("values", this.defaults().values);
            }
        });
        return SpatialFilter;
});
