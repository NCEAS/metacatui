/*global define */
define(['backbone', "collections/Filters", "collections/SolrResults"],
  function(Backbone, Filters, SearchResults) {
  'use strict';

  /**
  * @class FiltersSearchConnector
  * @name FiltersSearchConnector
  * @classdesc A model that creates listeners between a Filters collection and a SearchResults. It does not assume anything
  * about how the search results or filters will be displayed in the UI or why those components need to be connected. It simply
  * sends a new search when the filters have been changed.
  * @name FiltersSearchConnector
  * @extends Backbone.Model
  * @constructor
  * @classcategory Models/Connectors
  */
  return Backbone.Model.extend(
    /** @lends FiltersSearchConnector.prototype */ {

        /**
         * @type {object}
         * @property {Filter[]} filtersList An array of Filter models to optionally add to the Filters collection
         * @property {Filters} filters A Filters collection to use for this search
         * @property {SolrResults} searchResults The SolrResults collection that the search results will be stored in
         */
        defaults: function(){
            return{
                filtersList: [],
                filters: new Filters([], { catalogSearch: true }), 
                searchResults: new SearchResults()
            }
        },

        initialize: function(){
            if( this.get("filtersList")?.length ){
                this.get("filters").add(this.get("filtersList"))
            }
        },

        /**
         * Sets listeners on the Filters and SearchResults to trigger a search when the search changes
         * @since 2.22.0
         */
        startListening: function(){

            // Listen to changes in the Filters to trigger a search
            this.stopListening(this.get("filters"), "add remove update reset change");
            this.listenTo(this.get("filters"), "add remove update reset change", this.triggerSearch);

            //Listen to the sort order changing
            this.stopListening(this.get("searchResults"), "change:sort change:facet");
            this.listenTo(this.get("searchResults"), "change:sort change:facet", this.triggerSearch);

            //If the logged-in status changes, send a new search
            this.listenTo(MetacatUI.appUserModel, "change:loggedIn", this.triggerSearch);

        },


        /**
        * Get Results from the Solr index by combining the Filter query string fragments
        * in each Filter instance in the Search collection and querying Solr.
        * @fires SolrResults#toPage
        * @since 2.22.0
        */
        triggerSearch: function() {
            let filters = this.get("filters"),
                searchResults = this.get("searchResults");

            // Get the Solr query string from the Search filter collection
            let query = filters.getQuery();

            // Set the query on the SolrResults collection
            searchResults.setQuery(query);

            //If the query hasn't changed since the last query that was sent, don't do anything.
            //This function may have been triggered by a change event on a filter that doesn't
            //affect the query at all
            if( !searchResults.hasChanged() ){
                return;
            }

            // Get the page number
            let page = MetacatUI.appModel.get("page") || 0;
            searchResults.start = page * searchResults.rows;

            //Send the query to the server via the SolrResults collection
            searchResults.toPage(page);
        },
    });
})