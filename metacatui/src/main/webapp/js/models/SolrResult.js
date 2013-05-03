/*global Backbone */
var app = app || {};

(function () {
	'use strict';

	// SolrResult Model
	// ------------------
	app.SolrResult = Backbone.Model.extend({
		// This model contains all of the attributes found in the SOLR 'docs' field inside of the SOLR response element
		defaults: {
			authors: '',
			title: '',
			pubdate: '',
			identifier: '',
			downloads: 0,
			citations: 0,
			selected: false
		},
	});
})();
