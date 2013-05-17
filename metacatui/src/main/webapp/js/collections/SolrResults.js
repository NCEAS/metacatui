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
			this.base = options.base || '/metacatui/d1proxy/';
		    this.query = options.query;
		    this.rows = options.rows || 20;
		    this.start = options.start || 0;
		},
		
		url: function() {
			return this.base + this.query + "&rows=" + this.rows + "&start=" + this.start;
		},
		  
		parse: function(solr) {
			this.header = new app.SolrHeader(solr.responseHeader);
			this.header.set({"numFound" : solr.response.numFound});
			this.header.set({"start" : solr.response.start});
			return solr.response.docs;
		},
		
		nextpage: function() {
			this.start += this.rows;
			this.header.set({"start" : this.start});
			this.fetch({data: {start: this.start}});
		},
		
		prevpage: function() {
			this.start -= this.rows;
			if (this.start < 0) {
				this.start = 0;
			}
			this.header.set({"start" : this.start});
			this.fetch({data: {start: this.start}});
		}
	});

	// Create our global collection of **SolrResults**.
	app.SearchResults = new SolrResultList([], { query: "fl=id,title,origin,pubDate,abstract&q=formatType:METADATA+-obsoletedBy:*&wt=json", rows: 5, start: 0 });
	//app.MostAccessed = new SolrResultList();
	//app.MostRecent = new SolrResultList();
	//app.Featured = new SolrResultList();

})();
