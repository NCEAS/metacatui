/*global define */
define(['jquery', 'underscore', 'backbone', 'models/SolrHeader', 'models/SolrResult', 'models/LogsSearch'], 				
	function($, _, Backbone, SolrHeader, SolrResult, LogsSearch) {
	'use strict';

	// SolrResults Collection
	// ------------------------
	
	// The collection of SolrResult
	var SolrResultList = Backbone.Collection.extend({
		// Reference to this collection's model.
		model: SolrResult,

		initialize: function(models, options) {
			this.docsCache    = options.docsCache || null;
		    this.currentquery = options.query   || '*:*';
		    this.fields 	  = options.fields  || "id,title";
		    this.rows 		  = options.rows    || 25;
		    this.start 		  = options.start   || 0;
		    this.sort 		  = options.sort    || 'dateUploaded+desc';
		    this.facet 		  = options.facet   || [];
		    this.facetCounts  = "nothing";
		    this.stats 		  = options.stats   || false;
		    this.minYear 	  = options.minYear || 1900;
		    this.maxYear 	  = options.maxYear || new Date().getFullYear();
		    
		    //Turn on/off the feature to search the logs when retrieving SolrResults
		    this.searchLogs  = (typeof options.searchLogs == "undefined")? true : options.searchLogs;
		    
		    if(appModel.get("d1LogServiceUrl") && this.searchLogs){
			    this.logsSearch = options.logsSearch || new LogsSearch();
			    this.on("reset", this.getLogs);
		    }
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
			var endpoint = appModel.get('queryServiceUrl') + 
						   "fl=" + this.fields + 
						   "&q=" + this.currentquery + 
						   "&sort=" + this.sort + 
						   "&rows=" + this.rows + 
						   "&start=" + this.start + 
						   "&facet=true&facet.sort=index" + facetFields + 
						   stats +		
						   "&wt=json";
									
			return endpoint;
		},
		  
		parse: function(solr) {
			
			//Is this our latest query? If not, use our last set of docs from the latest query
			if((decodeURIComponent(this.currentquery).replace(/\+/g, " ") != solr.responseHeader.params.q) && this.docsCache)
				return this.docsCache;
			
			//Save some stats
			this.header = new SolrHeader(solr.responseHeader);			
			this.header.set({"numFound" : solr.response.numFound});
			this.header.set({"start" : solr.response.start});
			this.header.set({"rows" : solr.responseHeader.params.rows});
			
			//Get the facet counts and store them in this model
			this.facetCounts = solr.facet_counts.facet_fields;
			
			//Cache this set of results
			this.docsCache = solr.response.docs;
			
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
			
			var fetchOptions = this.createFetchOptions();			
			this.fetch(fetchOptions);
		},
		
		prevpage: function() {
			this.start -= this.rows;
			if (this.start < 0) {
				this.start = 0;
			}
			if (this.header != null) {
				this.header.set({"start" : this.start});
			}

			var fetchOptions = this.createFetchOptions();			
			this.fetch(fetchOptions);
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
							
			var fetchOptions = this.createFetchOptions();			
			this.fetch(fetchOptions);
		},
		
		setrows: function(numrows) {
			this.rows = numrows;
		},
		
		query: function(newquery) {
			if (this.currentquery != newquery) {
				this.currentquery = newquery;
				this.start = 0;
				
			}
			var fetchOptions = this.createFetchOptions();			
			this.fetch(fetchOptions);
			//this.fetch({data: {start: this.start}, reset: true});
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
		},
		
		createFetchOptions: function(){
			var options = {
				start : this.start,
				reset: true
			}
						
			return _.extend(options, appUserModel.createAjaxSettings());
		},
		
		//Get info about each model in this collection from the Logs index
		getLogs: function(){
			if(!appModel.get("d1LogServiceUrl") || (typeof appModel.get("d1LogServiceUrl") == "undefined")) return;

			var collection = this;
			
			//Get the read events
			this.logsSearch.set({
				pid: this.pluck("id"), 
				event: "read",
				facets: "pid"
			});
			
			var url = appModel.get("d1LogServiceUrl") + "q=" + this.logsSearch.getQuery() + this.logsSearch.getFacetQuery();
			var requestSettings = {
				url: url + "&wt=json&rows=0",
				type: "GET",
				success: function(data, textStatus, xhr){
					var pidCounts = data.facet_counts.facet_fields.pid;
					
					if(!pidCounts || !pidCounts.length){
						collection.invoke("set", {reads: 0});
						return;
					}
					
					for(var i=0; i < pidCounts.length; i+=2){
						var doc = collection.findWhere({ id: pidCounts[i] });
						if(!doc) break;
						
						doc.set("reads", pidCounts[i+1]);
					}					
				}
			}
			$.ajax(_.extend(requestSettings, appUserModel.createAjaxSettings()));
		}
	});

	return SolrResultList;		
});
