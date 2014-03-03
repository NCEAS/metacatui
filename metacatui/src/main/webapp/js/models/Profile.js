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
			dataFormatIDs: [], //Uses same structure as Solr facet counts: ["text/csv", 5]
			firstUpload: 0,
			totalUploaded: 0, //total data and metadata objects uploaded, including now obsoleted objects
			metadataUplodaded: 0,
			dataUploaded: 0,
		},
		
		style: {
			dataChartColors: ['#006a66', '#98cbcb', '#329898', '#005149', '#00e0cf', '#416865', '#002825'],
			metadataChartColors: ['#992222', '#551515', '#c13a3a', '#994242', '#371312', '#c12d2c', '#622222'],
		}
		
	});
	return Profile;
});
