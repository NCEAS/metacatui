/*global define */
define(["jquery",
        "jqueryui",
        "underscore",
        "backbone",
        "collections/SolrResults",
        "views/search/SearchResultView"
    ],
function($, $ui, _, Backbone, SearchResults, SearchResultView){

    "use strict";

    /**
    * @class SearchResultsView
    * @classcategory Views
    * @extends Backbone.View
    * @constructor
    */
    return Backbone.View.extend(
      /** @lends Backbone.View.prototype */ {

    /**
    * The type of View this is
    * @type {string}
    */
    type: "SearchResults",

    /**
    * The HTML tag to use for this view's element
    * @type {string}
    */
    tagName: "div",

    /**
    * The HTML classes to use for this view's element
    * @type {string}
    */
    className: "search-results-view",

     /**
    * The events this view will listen to and the associated function to call.
    * @type {Object}
    */
    events: {
    },

    searchResults: null,

    noResultsTemplate: `<div class="no-search-results">No results found.</div>`,

    render: function(){

      if( !this.searchResults ){
        this.createSearchResults();
      }

      this.loading();
    
      this.addResultCollection();

      this.startListening();

    },

    startListening: function(){
      this.listenTo(this.searchResults, "add", this.addResultModel);
      this.listenTo(this.searchResults, "reset", this.addResultCollection);
      this.listenTo(this.searchResults, "request", this.loading);
    },

    createSearchResults: function(){
      this.searchResults = new SearchResults();
      return this.searchResults;
    },

    addResultModel: function(searchResult){
      try{
        let view = this.createSearchResultView();
        view.model = searchResult;
        this.addResultView(view);
      }
      catch(e){
        console.error("Failed to add a search result to the page: ", e);
      }
    },

    addResultCollection: function(){
      if( !this.searchResults )
        return;
      else if( this.searchResults?.header?.get("numFound") == 0){
        this.showNoResults();
        return;
      }

      this.empty();

      this.searchResults.models.forEach( result => {
        this.addResultModel(result);
      });
    },

    /**
     * Adds a Search Result View to the page
     * @param {SearchResultView} view
     */
    addResultView: function(view) {
      this.$el.append(view.el);
      view.render();
    },

    /** 
     * Creates a Search Result View
    */
    createSearchResultView: function(){
      return new SearchResultView();
    },

    showNoResults: function(){

      this.empty();

      this.$el.html(this.noResultsTemplate);

    },

    empty: function(){
      this.$el.empty();
    },

    loading: function(){

      this.empty();
      
      let rows = this.searchResults.rows,
          i=0;

      while(i < rows){
        let view = this.createSearchResultView();
        this.addResultView(view);
        view.loading();
        i++;
      }

    }

    

    });

});