/*global define */
define(['jquery', 'underscore', 'backbone', 'models/SolrHeader', 'models/SolrResult'], 				
	function($, _, Backbone, SolrHeader, SolrResult) {
	'use strict';

	// SolrResults Collection
	// ------------------------
	
	// The collection of SolrResult
	var SolrResultList = Backbone.Collection.extend({
		// Reference to this collection's model.
		model: SolrResult,

		initialize: function(models, options) {
			this.$baseurl = window.location.origin;
			//this.query_service = options.query_service || '/metacatui/d1proxy/?';
			this.query_service = options.query_service || '/knb/d1/mn/v1/query/solr/';
		    this.currentquery = options.query || '*:*';
		    this.fields = options.fields || "id,title";
		    this.rows = options.rows || 10;
		    this.start = options.start || 0;
		    this.sort = options.sort || 'id';
		},
		
		url: function() {
			//return this.query_service + "fl=" + this.fields + "&q=" + this.currentquery + "&sort=" + this.sort + "&wt=json" + "&rows=" + this.rows + "&start=" + this.start;
			var endpoint = this.$baseurl + this.query_service + "fl=" + this.fields + "&q=" + this.currentquery + "&sort=" + this.sort + "&wt=json" + "&rows=" + this.rows + "&start=" + this.start;
			return endpoint;
		},
		  
		parse: function(solr) {
			this.header = new SolrHeader(solr.responseHeader);
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
				
			}
			this.fetch({data: {start: this.start}, reset: true});
		},
		
		setfields: function(newfields) {
				this.fields = newfields;
		},
		
		setSort: function(newsort) {
			this.sort = newsort;
		},
		
		setQueryService: function(service_path) {
			this.query_service = service_path;
		}
		
	});

	return SolrResultList;		
});
