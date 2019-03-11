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

            /* Reference to this collection's model.
             * This collection can contain any type of Filter model:
             * - Filter
             * - BooleanFilter
             * - ChoiceFilter
             * - DateFilter
             * - NumericFilter
             * - ToggleFilter
             */
            model: Filter,

            initialize: function(options) {
                if (typeof options === "undefined") {
                    var options = {};
                }

                if (options.catalogSearch) {
                    this.createCatalogFilters();
                }
            },

            /*
             * Builds the query string to send to the query engine. Iterates over each filter
             * in the collection and adds to the query string.
             *
             * @return {string} The query string to send to Solr
             */
            getQuery: function() {
                var queryFragments = [];

                //Iterate over each Filter model in this collection
                this.forEach(function(filterModel, i) {

                    //Get the Solr query string from this model
                    var filterQuery = filterModel.getQuery();

                    //Add the filter query string to the overall array
                    if ( filterQuery && filterQuery.length > 0 ) {
                        queryFragments.push(filterQuery);
                    }
                }, this);
                
                return queryFragments.join("%20AND%20");
            },

            /*
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
                    isInvisible: true
                }));

                //Only search for metadata objects
                this.add(new Filter({
                    fields: ["formatType"],
                    values: ["METADATA"],
                    isInvisible: true
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