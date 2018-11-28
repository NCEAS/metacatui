/*global define */
define(['jquery', 'underscore', 'backbone', 'models/filters/Filter', 'models/filters/BooleanFilter',
    'models/filters/ChoiceFilter', 'models/filters/DateFilter', 'models/filters/NumericFilter', 'models/filters/ToggleFilter'],
	function($, _, Backbone, Filter, BooleanFilter, ChoiceFilter, DateFilter, NumericFilter, ToggleFilter) {
	'use strict';

	/*
  * Search collection
  * A collection of Filter models that represents a full search
  * @typedef {Backbone.Collection} Search
  */

	var Search = Backbone.Collection.extend({

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

    initialize: function(){

    },

    /*
     * Builds the query string to send to the query engine. Iterates over each filter
     * in the collection and adds to the query string.
     *
     * @return {string} The query string to send to Solr
     */
    getQuery: function(){

      var queryString = "";

      //Iterate over each Filter model in this collection
      this.forEach(function(filterModel, i){

        //Get the Solr query string from this model
        queryString += filterModel.getQuery();

        if( this.length > i+1 && queryString.length ){
          queryString += "%20AND%20";
        }

      }, this);

      return queryString;

    },

    /*
    * Given a Solr field name, determines if that field is set as a filter option
    */
    filterIsAvailable: function(field){
      var matchingFilter = this.find( function(filterModel){

        return _.contains(filterModel.fields, field);

      });

      if(matchingFilter){
        return true;
      }
      else {
        return false
      }
    },

    /*
    * Returns an array of filter models in this collection that have a value set
    *
    * @return {Array} - an array of filter models in this collection that have a value set
    */
    getCurrentFilters: function(){

      var currentFilters = new Array();

      this.each( function(filterModel){

        //If the filter model has values set differently than the default AND it is
        // not an invisible filter, then add it to the current filters array
        if( !filterModel.get("isInvisible") &&
            (( Array.isArray(filterModel.get("values")) && filterModel.get("values").length &&
              _.difference(filterModel.get("values"), filterModel.defaults().values).length ) ||
            ( !Array.isArray(filterModel.get("values")) && filterModel.get("values") !== filterModel.defaults().values ))
          ){
          currentFilters.push(filterModel);
        }

      });

      return currentFilters;
    },

    resetGeohash: function(){

      //Find all the filters in this collection that are related to geohashes
      this.each(function(filterModel){
        if( !filterModel.get("isInvisible") &&
            _.intersection(filterModel.fields, ["geohashes", "geohashLevel", "geohashGroups"]).length){
            filterModel.resetValue();
        }
      });
    }
/*
    hasGeohashFilter: function(){

      var currentFilters = this.getCurrentFilters();
      var geohashFilter = _.find(currentFilters, function(filterModel){
        return (_.intersection(filterModel.get("fields"), ["geohashes", "geohash"]).length > 0)
      });

      if(geohashFilter){
        return true;
      }
      else{
        return false;
      }

    }
    */

  });

  return Search;
});
