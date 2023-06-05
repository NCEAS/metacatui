/*global define */
define(['jquery', 'underscore', 'backbone', 'models/SolrHeader', 'models/SolrResult'],
  function($, _, Backbone, SolrHeader, SolrResult) {
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
      
    /**
     * The name of this type of collection.
     * @type {string}
     * @default "SolrResults"
     * @since x.x.x
     */
    type: "SolrResults",

    initialize: function(models, options) {

      if( typeof options === "undefined" || !options ){
        var options = {};
      }

      this.docsCache    = options.docsCache || null;
      this.currentquery = options.query   || '*:*';
      this.rows       = options.rows    || 25;
      this.start       = options.start   || 0;
      this.sort       = options.sort    || 'dateUploaded desc';
      this.facet       = options.facet   || [];
      this.facetCounts  = "nothing";
      this.stats       = options.stats   || false;
      this.minYear     = options.minYear || 1900;
      this.maxYear     = options.maxYear || new Date().getFullYear();
      this.queryServiceUrl = options.queryServiceUrl || MetacatUI.appModel.get('queryServiceUrl');

      if( MetacatUI.appModel.get("defaultSearchFields")?.length )
        this.fields = MetacatUI.appModel.get("defaultSearchFields").join(",");
      else 
        this.fields = options.fields || "id,title";


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
      var endpoint = (this.queryServiceUrl || MetatcatUI.appModel.get("queryServiceUrl")) + "q=" + this.currentquery;

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

      if(!solr.response){
        if(solr.error && solr.error.msg){
          console.log("Solr error: " + solr.error.msg);
        }
        return
      }

      //Save some stats
      this.header = new SolrHeader(solr.responseHeader);
      this.header.set({"numFound" : solr.response.numFound});
      this.header.set({"start" : solr.response.start});
      this.header.set({"rows" : solr.responseHeader.params.rows});

      //Get the facet counts and store them in this model
      if (solr.facet_counts) {
        this.facetCounts = solr.facet_counts.facet_fields;
      } else {
        this.facetCounts = "nothing";
      }

      //Cache this set of results
      this.docsCache = solr.response.docs;

      return solr.response.docs;
    },

    /** 
    *   Fetches the next page of results
    */
    nextpage: function() {
      // Only increment the page if the current page is not the last page
      if (this.start + this.rows < this.header.get("numFound")) {
        this.start += this.rows;
      }
      if (this.header != null) {
        this.header.set({"start" : this.start});
      }

      this.lastUrl = this.url();

      var fetchOptions = this.createFetchOptions();
      this.fetch(fetchOptions);
    },

    /** 
    *   Fetches the previous page of results
    */
    prevpage: function() {
      this.start -= this.rows;
      if (this.start < 0) {
        this.start = 0;
      }
      if (this.header != null) {
        this.header.set({"start" : this.start});
      }

      this.lastUrl = this.url();

      var fetchOptions = this.createFetchOptions();
      this.fetch(fetchOptions);
    },

    /** 
    *   Fetches the given page of results
    * @param {number} page
    */
    toPage: function(page) {
      // go to the requested page
      var requestedStart = this.rows * page;

      /*
      if (this.header != null) {
        if (requestedStart < this.header.get("numFound")) {
          this.start = requestedStart;
        }
        this.header.set({"start" : this.start});
      }*/

      this.start = requestedStart;

      this.lastUrl = this.url();

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

      this.lastUrl = this.url();

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

    /** 
    *   Returns the last query that was fetched.
    * @returns {string}
    */
    getLastQuery: function(){
      return this.lastQuery;
    },

    setfields: function(newfields) {
      this.fields = newfields;
    },

    setSort: function(newsort) {
      this.sort = newsort;
      this.trigger("change:sort");
    },

    setFacet: function (fields) {
      if (!Array.isArray(fields)) {
        fields = [fields];
      }
      this.facet = fields;
      this.trigger("change:facet");
    },

    setStats: function(fields){
      this.stats = fields;
    },

    createFetchOptions: function(){
      var options = {
        start : this.start,
        reset: true
      }

      let usePOST = this.usePOST || (this.currentquery.length > 1500 && !MetacatUI.appModel.get("disableQueryPOSTs"));

      if( usePOST ){
        options.type = "POST";

        var queryData = new FormData();
        queryData.append("q", decodeURIComponent(this.currentquery));
        queryData.append("rows", this.rows);
        queryData.append("sort", this.sort.replace("+", " "));
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
    },

    /**
    * Returns the total number of results that were just fetched, or undefined if nothing has been fetched yet
    * @since 2.22.0
    * @returns {number|undefined}
    */
    getNumFound: function(){
      return this.header?.get("numFound");
    },

    /**
    * Calculates and returns the total pages of results that was just fetched
    * @since 2.22.0
    * @returns {number}
    */
    getNumPages: function(){
      let total = this.getNumFound();
    
      if(total){
        return Math.ceil(total/this.header.get("rows"))-1; //-1 because our pages are zero-based numbered (where page 0 gets the first n results)
      }
      else{
        return 0;
      }
    },

    /**
     * Calculates and returns the current page of results that was just fetched
     * @since 2.22.0
     * @returns {number}
     */
    getCurrentPage: function(){
        
        if(this.header?.get("start") && this.header?.get("rows")){
            return Math.ceil(this.header.get("start")/this.header.get("rows"));
        }
        else{
            return 0;
        }
    },

    /**
     * Returns the index number of the first search result E.g. the first page of results may be 0-24, where 0 is the start.
     * @since 2.22.0
     * @returns {number}
     */
    getStart: function(){
        if(this.header){
            return this.header.get("start");
        }
        else{
            return this.start;
        }
    },

    /**
     * Calculates the index number of the last search result. E.g. the first page of results may be 0-24, where 24 is the end.
     * @since 2.22.0
     * @returns {number}
     */
    getEnd: function(){
        return parseInt(this.getStart()) + parseInt(this.getRows()) - 1; // -1 since it is zero-based numbering
    },

    /**
     * Returns the number of search result rows 
     * @since 2.22.0
     * @returns {number}
     */
    getRows: function(){
        if(this.header){
            return this.header.get("rows");
        }
        else{
            return this.rows;
        }
    },

    /**
     * Gets and returns the URL string that was sent during the last fetch. 
     * @since 2.22.0
     * @returns {string}
     */
    getLastUrl: function(){
        return this.lastUrl || "";
    },
    
    /**
     * Get the list of PIDs for the search results
     * @returns {string[]} - The list of PID strings for the search results
     * @since x.x.x
     */
    getPIDs: function () {
      return this.pluck("id");
    },

    /**
     * Determines whether the search parameters have changed since the last fetch. Returns true the next URL
     * to be sent in a fetch() is different at all from the last url that was fetched.
     * @since 2.22.0
     * @returns {boolean}
     */
    hasChanged: function(){
        return this.url() != this.getLastUrl();
    }
  });

  return SolrResults;
});
