/*global define */
define(['jquery', 'underscore', 'backbone', 'models/SolrHeader', 'models/SolrResult', 'models/LogsSearch'],
	function($, _, Backbone, SolrHeader, SolrResult, LogsSearch) {
	'use strict';

  /**
   @class SolrResults
   @classdesc A collection of SolrResult models that represent a list of search results from the DataONE query service.
   @extends Backbone.Collection
   @classcategory Collections
   @constructor
  */
	var SolrResults = Backbone.Collection.extend(
    /** @lends SolrResults.prototype */{
		// Reference to this collection's model.
		model: SolrResult,

		initialize: function(models, options) {

			if( typeof options === "undefined" || !options ){
				var options = {};
			}

			this.docsCache    = options.docsCache || null;
		    this.currentquery = options.query   || '*:*';
		    this.fields 	  = options.fields  || "id,title";
		    this.rows 		  = options.rows    || 25;
		    this.start 		  = options.start   || 0;
		    this.sort 		  = options.sort    || 'dateUploaded desc';
		    this.facet 		  = options.facet   || [];
		    this.facetCounts  = "nothing";
		    this.stats 		  = options.stats   || false;
		    this.minYear 	  = options.minYear || 1900;
		    this.maxYear 	  = options.maxYear || new Date().getFullYear();

        //If POST queries are disabled in the whole app, don't use POSTs here
        if( MetacatUI.appModel.get("disableQueryPOSTs") ){
          this.usePOST = false;
        }
        //If this collection was initialized with the usePOST option, use POSTs here
        else if( options.usePOST ){
          this.usePOST = true;
        }
        //Otherwise default to using GET
        else{
          this.usePOST = false;
        }
		},

		url: function() {
			//Convert facet keywords to a string
			var facetFields = "";

      this.facet = _.uniq(this.facet);

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
			var endpoint = MetacatUI.appModel.get('queryServiceUrl') + "q=" + this.currentquery;

      if(this.fields)
        endpoint += "&fl=" + this.fields;
      if(this.sort)
        endpoint += "&sort=" + this.sort;
      if( typeof this.rows == "number" || (typeof this.rows == "string" && this.rows.length))
        endpoint += "&rows=" + this.rows;
      if( typeof this.start == "number" || (typeof this.start == "string" && this.start.length))
        endpoint += "&start=" + this.start;
      if( this.facet.length > 0 )
        endpoint += "&facet=true&facet.sort=index" + facetFields;

      endpoint += stats + "&wt=json";

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
      if( solr.facet_counts ){
        this.facetCounts = solr.facet_counts.facet_fields;
      }

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

      if(typeof newquery != "undefined" && this.currentquery != newquery){
				this.currentquery = newquery;
				this.start = 0;
			}

			var fetchOptions = this.createFetchOptions();
			this.fetch(fetchOptions);
		},

		setQuery: function(newquery) {
			if (this.currentquery != newquery) {
				this.currentquery = newquery;
				this.start = 0;
        this.lastQuery = newquery;
			}
		},

    getLastQuery: function(){
      return this.lastQuery;
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

      if( this.usePOST ){
        options.type = "POST";

        var queryData = new FormData();
        queryData.append("q", decodeURIComponent(this.currentquery));
        queryData.append("rows", this.rows);
        queryData.append("sort", this.sort);
        queryData.append("fl", this.fields);
        queryData.append("start", this.start);
        queryData.append("wt", "json");

        //Add the facet fields to the FormData
        if( this.facet.length ){

          queryData.append("facet", "true");

    			for (var i=0; i<this.facet.length; i++){
    				queryData.append("facet.field", this.facet[i]);
    			}

          queryData.append("facet.mincount", "1");
          queryData.append("facet.limit", "-1");
          queryData.append("facet.sort", "index");

        }

        //Add stats to the FormData
        if( this.stats.length ){

          queryData.append("stats", "true");

          for(var i=0; i<this.stats.length; i++){
  					queryData.append("stats.field", this.stats[i]);
  				}

        }

        options.data = queryData;
        options.contentType = false;
        options.processData = false;
        options.dataType = "json";
        options.url = MetacatUI.appModel.get("queryServiceUrl");

      }

			return _.extend(options, MetacatUI.appUserModel.createAjaxSettings());
		}
	});

	return SolrResults;
});
