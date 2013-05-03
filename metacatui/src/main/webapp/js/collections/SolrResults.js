/*global Backbone */
var app = app || {};

(function () {
	'use strict';

	// SolrResults Collection
	// ------------------------
	
	// See http://stackoverflow.com/questions/14851557/custom-rest-api-response-in-backbone-js

	// The collection of SolrResult
	var SolrResultList = Backbone.Collection.extend({
		// Reference to this collection's model.
		model: app.SolrResult,

		url: "/metacatui/d1proxy",

		parse: function(solr) {
			// TODO: process response.SolrHeader here
			return solr.response.docs;
		}
	});

	// Create our global collection of **SolrResults**.
	app.SolrResults = new SolrResultList();
})();
