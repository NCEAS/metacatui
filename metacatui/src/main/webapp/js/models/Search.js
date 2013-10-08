/*global define */
define(['jquery', 'underscore', 'backbone'], 				
	function($, _, Backbone) {
	'use strict';

	// Search Model 
	// ------------------
	var Search = Backbone.Model.extend({
		// This model contains all of the search/filter terms
		defaults: {
			all: [],
			creator: [],
			taxon: [],
			location: [],
			resourceMap: false,
			yearMin: 1900, //The minimum year in the search range
			yearMax: 2013, //The maximum year in the search range
			resultsYearMin: 1900, //The minimum year of all search results
			resultsYearMax: 2013, //The maximum year of all search results
			pubYear: false,
			dataYear: false,
			sortOrder: 'dateUploaded+desc'
		},
		
		clear: function() {
			console.log('Clear the filters');
			console.log(_.clone(this.defaults));
		    return this.set(_.clone(this.defaults));
		  }
		
	});
	return Search;
});
