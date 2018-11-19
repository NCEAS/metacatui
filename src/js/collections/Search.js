/*global define */
define(['jquery', 'underscore', 'backbone', 'models/filters/Filter', 'models/filters/BooleanFilter',
    'models/filters/ChoiceFilter', 'models/filters/DateFilter', 'models/filters/NumericFilter'],
	function($, _, Backbone, Filter, BooleanFilter, ChoiceFilter, DateFilter, NumericFilter) {
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
    getSolrQuery: function(){

    }

  });

  return Search;
});
