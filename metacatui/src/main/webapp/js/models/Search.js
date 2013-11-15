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
			yearMin: 1900, //The user-selected minimum year
			yearMax: new Date().getFullYear(), //The user-selected maximum year
			pubYear: false,
			dataYear: false,
			sortOrder: 'dateUploaded+desc',
			east: null,
			west: null,
			north: null,
			south: null,
			attribute: [],
			additionalCriteria: [],
			filterCount: 0
		},
		
		clear: function() {
			console.log('Clear the filters');
			console.log(_.clone(this.defaults));
		    return this.set(_.clone(this.defaults));
		  }
		
	});
	return Search;
});
