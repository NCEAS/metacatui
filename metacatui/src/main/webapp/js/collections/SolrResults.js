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

		initialize: function(models, options) {
		    this.query = options.query;
		    this.rows = options.rows || 20;
		    this.start = options.start || 0;
		},
		
		url: function() {
			return '/metacatui/d1proxy/' + this.query + "&rows=" + this.rows + "&start=" + this.start;
		},
		  
		parse: function(solr) {
			this.header = new app.SolrHeader(solr.responseHeader);
			this.header.set({"numFound" : solr.response.numFound});
			this.header.set({"start" : solr.response.start});
			return solr.response.docs;
		}
	});

	// Create our global collection of **SolrResults**.
	//app.SearchResults = new SolrResultList();
	app.SearchResults = new SolrResultList([], { query: "fl=id,title,origin,pubDate,abstract&q=formatType:METADATA+-obsoletedBy:*&wt=json", rows: 5, start: 25 });
	//app.MostAccessed = new SolrResultList();
	//app.MostRecent = new SolrResultList();
	//app.Featured = new SolrResultList();

})();
