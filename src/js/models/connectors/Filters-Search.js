/*global define */
define(['backbone', "collections/Filters", "collections/SolrResults", "models/Search"],
  function(Backbone, Filters, SearchResults, Search) {
  'use strict';

  /**
  * @class FiltersSearchConnector
  * @classdesc A model that creates listeners between the Filters collection and the Search model. It does not assume anything
  * about how the search results or filters will be displayed in the UI or why those components need to be connected. It simply
  * sends a new search when the filters have been changed.
  * @name FiltersSearchConnector
  * @extends Backbone.Model
  * @constructor
  * @classcategory Models/Connectors
  */
  return Backbone.Model.extend(
    /** @lends FiltersSearchConnector.prototype */ {

        defaults: function(){
            return{
                filtersList: [],
                filters: new Filters([], { catalogSearch: true }), 
                /** @TODO Remove Search Model as a dependency for this model. It may not be necessary anymore since Filters create queries themselves */
                search: new Search(),
                searchResults: new SearchResults()
            }
        },

        initialize: function(){
            if( this.get("filtersList")?.length ){
                this.get("filters").add(this.get("filtersList"))
            }
        },

        startListening: function(){

            // Listen to changes in the Filters to trigger a search
            this.stopListening(this.get("filters"), "add remove update reset change");
            this.listenTo(this.get("filters"), "add remove update reset change", this.triggerSearch);

            //If the logged-in status changes, send a new search
            this.listenTo(MetacatUI.appUserModel, "change:loggedIn", this.triggerSearch);

        },


        /*
        * Get Results from the Solr index by combining the Filter query string fragments
        * in each Filter instance in the Search collection and querying Solr.
        *
        */
        triggerSearch: function() {
            let searchModel = this.get("search"),
                filters = this.get("filters"),
                searchResults = this.get("searchResults");

            // Get the Solr query string from the Search filter collection
            let query = filters.getQuery();

            //If the query hasn't changed since the last query that was sent, don't do anything.
            //This function may have been triggered by a change event on a filter that doesn't
            //affect the query at all
            if( query == searchResults.getLastQuery()){
              return;
            }

            /**
             * @TODO sortOrder should just be set on the SolrResults collec itself?
             */
            let sortOrder = searchModel.get("sortOrder");
            if ( sortOrder ) {
                searchResults.setSort(sortOrder);
            }

            // Set the query on the SolrResults collection
            searchResults.setQuery(query);

            // Get the page number
            let page = MetacatUI.appModel.get("page") || 0;
            searchResults.start = page * searchResults.rows;

            //Send the query to the server via the SolrResults collection
            searchResults.toPage(page);
        },
    });
})