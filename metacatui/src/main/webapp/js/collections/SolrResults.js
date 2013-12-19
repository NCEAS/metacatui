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
		    this.currentquery = options.query || '*:*';
		    this.fields = options.fields || "id,title";
		    this.rows = options.rows || 10;
		    this.start = options.start || 0;
		    this.sort = options.sort || 'dateUploaded+desc';
		    this.facet = options.facet || ['keywords'];
		    this.facetCounts = "nothing";
		    this.stats = options.stats || false;
		    this.minYear = options.minYear || 1900;
		    this.maxYear = options.maxYear || new Date().getFullYear();
		},
		
		url: function() {
			//Convert facet keywords to a string
			var facetFields = "";
			for (var i=0; i<this.facet.length; i++){
				facetFields += "&facet.field=" + this.facet[i];
			}
			// limit to matches
			if (this.facet.length > 0) {
				facetFields += "&facet.mincount=1"; // only facets meeting the current search
				facetFields += "&facet.limit=-1"; // CAREFUL: -1 means no limit on the number of facets
			}
			
			//Do we need stats?
			if (!this.stats){
				var stats = "";
			}
			else{
				var stats = "&stats=true";
				for(var i=0; i<this.stats.length; i++){
					stats += "&stats.field=" + this.stats[i];
				}
			}
			//create the query url
			var endpoint = appModel.get('queryServiceUrl') + "fl=" + this.fields + "&q=" + this.currentquery + "&sort=" + this.sort + "&wt=json" + "&rows=" + this.rows + "&start=" + this.start + "&facet=true&facet.sort=count" + facetFields + stats;		
			
			console.log(endpoint);
			
			return endpoint;
		},
		  
		parse: function(solr) {
			this.header = new SolrHeader(solr.responseHeader);			
			this.header.set({"numFound" : solr.response.numFound});
			this.header.set({"start" : solr.response.start});
			this.header.set({"rows" : solr.responseHeader.params.rows});
			
			//Get the facet counts and store them in this model
			this.facetCounts = solr.facet_counts.facet_fields;
			
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
		
		toPage: function(page) {
			// go to the requested page
			var requestedStart = this.rows * page;
			if (this.header != null) {
				if (requestedStart < this.header.get("numFound")) {
					this.start = requestedStart;
				}
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
		
		setQuery: function(newquery) {
			if (this.currentquery != newquery) {
				this.currentquery = newquery;
				this.start = 0;
				
			}
		},
		
		setfields: function(newfields) {
				this.fields = newfields;
		},
		
		setSort: function(newsort) {
			this.sort = newsort;
		},
		
		setFacet: function(fields) {
			this.facet = fields;
		},
		
		setStats: function(fields){
			this.stats = fields;
		}
		
	});

	return SolrResultList;		
});
