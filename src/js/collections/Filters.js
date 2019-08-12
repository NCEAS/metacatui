define(["jquery", "underscore", "backbone", "models/filters/Filter", "models/filters/BooleanFilter",
    "models/filters/ChoiceFilter", "models/filters/DateFilter", "models/filters/NumericFilter",
    "models/filters/ToggleFilter"],
    function($, _, Backbone, Filter, BooleanFilter, ChoiceFilter, DateFilter, NumericFilter, ToggleFilter) {
        "use strict";

        /*
         * Filters collection
         * A collection of Filter models that represents a full search
         * @typedef {Backbone.Collection} Filters
         */
        var Filters = Backbone.Collection.extend({

            initialize: function(options) {
                if (typeof options === "undefined") {
                    var options = {};
                }

                if (options.catalogSearch) {
                    this.createCatalogFilters();
                }
            },

            /**
            *  Creates the type of Filter Model based on the given filter type. This
            * function is typically not called directly. It is used by Backbone.js when adding
            * a new model to the collection.
            * @param {object} attrs - A literal object that contains the attributes to pass to the model
            * @property {string} attrs.filterType - The type of Filter to create
            * @param {object} options - A literal object that contains the attributes to pass to the model
            * @returns {Filter|BooleanFilter|ChoiceFilter|DateFilter|NumericFilter|ToggleFilter}
            */
            model: function(attrs, options){

              switch ( attrs.filterType ) {

                case "BooleanFilter":
                    return new BooleanFilter(attrs, options);

                case "ChoiceFilter":
                    return new ChoiceFilter(attrs, options);

                case "DateFilter":
                    return new DateFilter(attrs, options);

                case "NumericFilter":
                    return new NumericFilter(attrs, options);

                case "ToggleFilter":
                    return new ToggleFilter(attrs, options);

                default:
                  return new Filter(attrs, options);
              }

            },

            /**
             * Builds the query string to send to the query engine. Iterates over each filter
             * in the collection and adds to the query string.
             *
             * @return {string} The query string to send to Solr
             */
            getQuery: function() {

              //Create an array to store all the query pieces
              var allGroupsQueryFragments = [],
                  //The complete query string that eventually gets returned
                  completeQuery = "",
                  //Separate the filter models in this collection by their query group.
                  groupedFilters = this.groupBy(function(m){
                    return m.get("queryGroup");
                  });

              //Filters that are used in the data catalog are treated specially
              var catalogFilters = groupedFilters.catalog;
              delete groupedFilters.catalog;

              //Create a query string for each group of filters
              _.mapObject(groupedFilters, function(filterModels, groupName) {

                //Get a query string for this group of Filters
                var groupQuery = this.getGroupQuery(filterModels);

                //If there is a query string, add it to the array
                if( groupQuery ){
                  allGroupsQueryFragments.push(groupQuery);
                }

              }, this);

              //Join the query fragments with an OR. By default, Filter model groups are ORed together
              if( allGroupsQueryFragments.length ){
                completeQuery += "(" + allGroupsQueryFragments.join("%20OR%20") + ")";
              }

              //Add the Data Catalog filters, if there are any
              if( catalogFilters.length ){

                //If there are other filters besides the catalog filters, AND them
                if( completeQuery.trim().length ){
                  completeQuery += "%20AND%20";
                }

                //Get the query string for the catalog filters
                completeQuery += this.getGroupQuery(catalogFilters);
              }

              //Return the completed query
              return completeQuery;

            },

            /**
            * Get a query string for a group of Filters. The Filters will be ANDed together.
            * @param {Filter[]} filterModels - The Filters to turn into a query string
            * @return {string} The query string
            */
            getGroupQuery: function(filterModels){
              //Start an array to contian the query fragments
              var groupQueryFragments = [];

              //For each Filter in this group, get the query string
              _.each(filterModels, function(filterModel){

                //Get the Solr query string from this model
                var filterQuery = filterModel.getQuery();

                //Add the filter query string to the overall array
                if ( filterQuery && filterQuery.length > 0 ) {
                  groupQueryFragments.push(filterQuery);
                }
              }, this);

              //Join this group's query fragments with an OR operator
              if( groupQueryFragments.length ){
                return "(" + groupQueryFragments.join("%20AND%20") + ")"
              }
              //Otherwise, return an empty string
              else{
                return "";
              }

            },

            /**
             * Given a Solr field name, determines if that field is set as a filter option
             */
            filterIsAvailable: function(field) {
                var matchingFilter = this.find(function(filterModel) {
                    return _.contains(filterModel.fields, field);
                });

                if (matchingFilter) {
                    return true;
                } else {
                    return false;
                }
            },

            /*
             * Returns an array of filter models in this collection that have a value set
             *
             * @return {Array} - an array of filter models in this collection that have a value set
             */
            getCurrentFilters: function() {
                var currentFilters = new Array();

                this.each(function(filterModel) {
                    //If the filter model has values set differently than the default AND it is
                    // not an invisible filter, then add it to the current filters array
                    if (!filterModel.get("isInvisible") &&
                        ((Array.isArray(filterModel.get("values")) && filterModel.get("values").length &&
                                _.difference(filterModel.get("values"), filterModel.defaults().values).length) ||
                            (!Array.isArray(filterModel.get("values")) && filterModel.get("values") !== filterModel.defaults().values))
                    ) {
                        currentFilters.push(filterModel);
                    }
                });

                return currentFilters;
            },

            /*
             * Clear the values of all geohash-related models in the collection
             */
            resetGeohash: function() {
                //Find all the filters in this collection that are related to geohashes
                this.each(function(filterModel) {
                    if (!filterModel.get("isInvisible") &&
                        _.intersection(filterModel.fields, ["geohashes", "geohashLevel", "geohashGroups"]).length) {
                        filterModel.resetValue();
                    }
                });
            },

            /*
             * Creates and adds FilterModels to this collection that are standard filters
             * to be sent with every Data Catalog query.
             */
            createCatalogFilters: function() {

                //Exclude obsoleted objects from the search
                this.add(new Filter({
                    fields: ["obsoletedBy"],
                    values: ["*"],
                    exclude: true,
                    isInvisible: true,
                    queryGroup: "catalog"
                }));

                //Only search for metadata objects
                this.add(new Filter({
                    fields: ["formatType"],
                    values: ["METADATA"],
                    matchSubstring: false,
                    isInvisible: true,
                    queryGroup: "catalog"
                }));
            }
            /*
            hasGeohashFilter: function() {

                var currentFilters = this.getCurrentFilters();
                var geohashFilter = _.find(currentFilters, function(filterModel){
                    return (_.intersection(filterModel.get("fields"),
                        ["geohashes", "geohash"]).length > 0);
                });

                if(geohashFilter) {
                    return true;
                } else {
                    return false;
                }
            }
            */
        });
        return Filters;
    });
