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
			this.service = options.service || '/metacatui/d1proxy/?';
		    this.currentquery = options.query || '*:*';
		    this.fields = options.fields || "id,title";
		    this.rows = options.rows || 10;
		    this.start = options.start || 0;
		},
		
		url: function() {
			return this.service + "fl=" + this.fields + "&q=" + this.currentquery + "&wt=json" + "&rows=" + this.rows + "&start=" + this.start;
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
		},
		
		query: function(newquery) {
			if (this.currentquery != newquery) {
				this.currentquery = newquery;
				this.start = 0;
				this.fetch({data: {start: this.start}, reset: true});
			}
		},
		
		setfields: function(newfields) {
				this.fields = newfields;
		}
		
	});

	// Create our global collection of **SolrResults** with a default set of fields
	app.SearchResults = new SolrResultList([], {});
	//app.SearchResults = new SolrResultList([], { query: "formatType:METADATA+-obsoletedBy:*", fields: "id,title,origin,pubDate,abstract", rows: 10, start: 0 });
})();
