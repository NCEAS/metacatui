/*global define */
define(["backbone",
        "collections/SolrResults",
        "views/search/SearchResultView"
    ],
function(Backbone, SearchResults, SearchResultView){

    "use strict";

    /**
    * @class SearchResultsView
    * @name SearchResultsView
    * @classcategory Views/Search
    * @extends Backbone.View
    * @since 2.22.0
    * @constructor
    */
    return Backbone.View.extend(
      /** @lends SearchResultsView.prototype */ {

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

    /**
     * The SolrResults collection that fetches and parses the searches.
     * @type {SolrResults}
     */
    searchResults: null,

    /**
     * The HTML to display when no search results are found.
     * @since 2.22.0
     * @type {string}
     */
    noResultsTemplate: `<div class="no-search-results">No results found.</div>`,

    render: function(){

      if( !this.searchResults ){
        this.setSearchResults();
      }

      this.loading();
    
      this.addResultCollection();

      this.startListening();

    },

    /**
     * Sets listeners on the {@link SearchResultsView#searchResults} to change what is displayed in this view.
     */
    startListening: function(){
      this.listenTo(this.searchResults, "add", this.addResultModel);
      this.listenTo(this.searchResults, "reset", this.addResultCollection);
      this.listenTo(this.searchResults, "request", this.loading);
    },

    /**
     * Creates and sets the {@link SearchResultsView#searchResults} property.
     * @returns {SolrResults}
     */
    setSearchResults: function(){
      this.searchResults = new SearchResults();
      return this.searchResults;
    },

    /**
     * Renders the given {@link SolrResult} model inside this view.
     * @param {SolrResult} searchResult 
     */
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

    /**
     * Renders all {@link SolrResult}s from the {@link SearchResultsView#searchResults} collection.
     */
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
      this.el.append(view.el);
      view.render();
    },

    /** 
     * Creates a Search Result View
    */
    createSearchResultView: function(){
      return new SearchResultView();
    },

    /**
     * Shows a message when no search results have been found.
     */
    showNoResults: function(){

      this.empty();

      this.el.replaceChildren(this.noResultsTemplate);

    },

    empty: function(){
      this.el.innerHTML = "";
    },

    /**
     * Renders a skeleton of this view that communicates to the user that it is loading.
     */
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