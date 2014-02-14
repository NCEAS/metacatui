/*global define */
define(['jquery', 'underscore', 'backbone'], 				
	function($, _, Backbone) {
	'use strict';

	// Profile Model 
	// ------------------
	var Profile = Backbone.Model.extend({
		// This model contains all of the statistics in a user's or query's profile
		defaults: {
			metadataCount: 0,
			dataCount: 0,
			metadataFormatIDs: [], //Uses same structure as Solr facet counts: ["text/csv", 5]
			dataFormatIDs: [] //Uses same structure as Solr facet counts: ["text/csv", 5]
		}
		
	});
	return Profile;
});
