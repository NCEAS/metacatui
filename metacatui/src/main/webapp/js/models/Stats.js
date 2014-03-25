/*global define */
define(['jquery', 'underscore', 'backbone'], 				
	function($, _, Backbone) {
	'use strict';

	// Profile Model 
	// ------------------
	var Profile = Backbone.Model.extend({
		// This model contains all of the statistics in a user's or query's profile
		defaults: {
			query: "*:*", //Show everything
			metadataCount: 0,
			dataCount: 0,
			metadataFormatIDs: [], //Uses same structure as Solr facet counts: ["text/csv", 5]
			dataFormatIDs: [], //Uses same structure as Solr facet counts: ["text/csv", 5]
			firstUpload: 0,
			totalUploaded: 0, //total data and metadata objects uploaded, including now obsoleted objects
			metadataUploaded: 0,
			dataUploaded: 0,
			firstBeginDate: 0,
			temporalCoverage: 0,
			coverageYears: 0
		}
		
	});
	return Profile;
});
