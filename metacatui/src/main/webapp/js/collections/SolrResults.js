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
			this.base = options.base || '/metacatui/d1proxy/?';
		    this.query = options.query || '*:*';
		    this.fields = options.fields || "id,title";
		    this.rows = options.rows || 10;
		    this.start = options.start || 0;
		},
		
		url: function() {
			return this.base + "fl=" + this.fields + "&q=" + this.query + "&wt=json" + "&rows=" + this.rows + "&start=" + this.start;
		},
		  
		parse: function(solr) {
			this.header = new app.SolrHeader(solr.responseHeader);
			this.header.set({"numFound" : solr.response.numFound});
			this.header.set({"start" : solr.response.start});
			return solr.response.docs;
		},
		
		nextpage: function() {
			// Only increment the page if the current page is not the last page
			if (this.start + this.rows < this.header.get("numFound")) {
				this.start += this.rows;
			}
			if (this.header != null) {
				this.header.set({"start" : this.start});
			}
			this.fetch({data: {start: this.start}, reset: true});
		},
		
		prevpage: function() {
			this.start -= this.rows;
			if (this.start < 0) {
				this.start = 0;
			}
			if (this.header != null) {
				this.header.set({"start" : this.start});
			}
			this.fetch({data: {start: this.start}, reset: true});
		},
		
		setrows: function(numrows) {
			this.rows = numrows;
			//this.reset();
			this.header.set({"rows" : this.rows});
			this.fetch({data: {start: this.start, rows: this.rows}});
		},
		
		setquery: function(newquery) {
			if (this.query != newquery) {
				this.query = newquery;
				this.start = 0;
				this.fetch({data: {start: this.start}, reset: true});
			}
		},
		
		setfields: function(newfields) {
			if (this.fields != newfields) {
				this.fields = newfields;
				this.start = 0;
				this.fetch({data: {start: this.start}, reset: true});
			}
		}
		
	});

	// Create our global collection of **SolrResults**.
	app.SearchResults = new SolrResultList([], { query: "formatType:METADATA+-obsoletedBy:*", fields: "id,title,origin,pubDate,abstract", rows: 10, start: 0 });
	//app.MostAccessed = new SolrResultList();
	//app.MostRecent = new SolrResultList();
	//app.Featured = new SolrResultList();

})();
