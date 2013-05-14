/*global Backbone */
var app = app || {};

(function () {
	'use strict';

	// SolrResults Collection
	// ------------------------
	
	// The collection of SolrResult
	var SolrResultList = Backbone.Collection.extend({
		// Reference to this collection's model.
		model: app.SolrResult,

		// TODO: this needs to be overridden to send params to the actual search endpoints
		url: "/metacatui/d1proxy",

		parse: function(solr) {
			this.header = new app.SolrHeader(solr.responseHeader);
			this.header.set({"numFound" : solr.response.numFound});
			this.header.set({"start" : solr.response.start});
			return solr.response.docs;
		}
	});

	// Create our global collection of **SolrResults**.
	app.SearchResults = new SolrResultList();
	app.MostAccessed = new SolrResultList();
	app.MostRecent = new SolrResultList();
	app.Featured = new SolrResultList();

})();
