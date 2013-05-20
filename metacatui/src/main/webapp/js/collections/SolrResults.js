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
		    this.query = options.query || '*:*';
		    this.rows = options.rows || 10;
		    this.start = options.start || 0;
		},
		
		url: function() {
			return this.base + this.query + "&wt=json" + "&rows=" + this.rows + "&start=" + this.start;
		},
		  
		parse: function(solr) {
			this.header = new app.SolrHeader(solr.responseHeader);
			this.header.set({"numFound" : solr.response.numFound});
			this.header.set({"start" : solr.response.start});
			return solr.response.docs;
		},
		
		nextpage: function() {
			this.start += this.rows;
			//this.reset();
			this.header.set({"start" : this.start});
			this.fetch({data: {start: this.start}});
		},
		
		prevpage: function() {
			this.start -= this.rows;
			if (this.start < 0) {
				this.start = 0;
			}
			//this.reset();
			this.header.set({"start" : this.start});
			this.fetch({data: {start: this.start}});
		},
		
		setrows: function(numrows) {
			this.rows = numrows;
			//this.reset();
			this.header.set({"rows" : this.rows});
			this.fetch({data: {start: this.start, rows: this.rows}});
		}
	});

	// Create our global collection of **SolrResults**.
	app.SearchResults = new SolrResultList([], { query: "?fl=id,title,origin,pubDate,abstract&q=formatType:METADATA+-obsoletedBy:*", rows: 10, start: 0 });
	//app.MostAccessed = new SolrResultList();
	//app.MostRecent = new SolrResultList();
	//app.Featured = new SolrResultList();

})();
