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
			yearMax: new Date().getUTCFullYear(), //The user-selected maximum year
			pubYear: false,
			dataYear: false,
			sortOrder: 'dateUploaded+desc',
			east: null,
			west: null,
			north: null,
			south: null,
			map: {
				zoom: null,
				center: null
			},
			spatial: [],
			attribute: [],
			characteristic: [],
			standard: [],
			additionalCriteria: [],
			customQuery: null
		},
		
		filterCount: function() {
			var changedAttr = this.changedAttributes(_.clone(this.defaults));
			if (changedAttr) {
				var changedKeys = _.keys(changedAttr);
				console.log(changedKeys);
				return changedKeys.length;
			}
			return 0;
		},
		
		clear: function() {
			console.log('Clear the filters');
		    return this.set(_.clone(this.defaults));
		  }
		
	});
	return Search;
});
