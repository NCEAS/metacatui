/*global define */
define([
  "backbone",
  "collections/Filters",
  "collections/SolrResults",
], function (Backbone, Filters, SearchResults) {
  "use strict";

  /**
   * @class FiltersSearchConnector
   * @name FiltersSearchConnector
   * @classdesc A model that creates listeners between a Filters collection and
   * a SearchResults. It does not assume anything about how the search results
   * or filters will be displayed in the UI or why those components need to be
   * connected. It simply sends a new search when the filters have been changed.
   * @name FiltersSearchConnector
   * @extends Backbone.Model
   * @constructor
   * @classcategory Models/Connectors
   */
  return Backbone.Model.extend(
    /** @lends FiltersSearchConnector.prototype */ {
      /**
       * The type of Backbone.Model this is.
       * @type {string}
       * @since 2.25.0
       * @default "FiltersSearchConnector
       */
      type: "FiltersSearchConnector",

      /**
       * @type {object}
       * @property {Filters} filters A Filters collection to use for this search
       * @property {SolrResults} searchResults The SolrResults collection that
       * the search results will be stored in
       * @property {boolean} isConnected Whether or not the model has listeners
       * set between the Filters and SearchResults. Set this with the
       * connect and disconnect methods.
       */
      defaults: function () {
        return {
          filters: new Filters([], { catalogSearch: true }),
          searchResults: new SearchResults(),
          isConnected: false,
        };
      },

      /**
       * Sets listeners on the Filters and SearchResults to trigger a search
       * when the search changes
       * @since 2.22.0
       */
      connect: function () {
        this.disconnect();
        const filters = this.get("filters");
        const search = this.get("searchResults");

        // Start results at first page and recreate query when the filters change
        this.listenTo(filters, "update change", this.triggerSearch, true);

        // "changing" event triggers when the query is about to change, but
        // before it has been sent. Useful for showing a loading indicator.
        this.listenTo(filters, "changing", function () {
          search.trigger("changing");
        });

        this.listenTo(search, "change:sort change:facet", this.triggerSearch);

        // If the logged-in status changes, send a new search
        this.listenTo(
          MetacatUI.appUserModel,
          "change:loggedIn",
          this.triggerSearch
        );

        this.set("isConnected", true);
      },

      /**
       * Stops listening to changes in the Filters and SearchResults
       * @since 2.25.0
       */
      disconnect: function () {
        const filters = this.get("filters");
        const searchResults = this.get("searchResults");
        this.stopListening(MetacatUI.appUserModel, "change:loggedIn");
        this.stopListening(filters, "update changing");
        this.stopListening(searchResults, "change:sort change:facet");
        this.set("isConnected", false);
      },

      /**
       * Get Results from the Solr index by combining the Filter query string
       * fragments in each Filter instance in the Search collection and querying
       * Solr.
       * @param {boolean} resetPage - Whether or not to reset the page number
       * to 0. Defaults to false.
       * @fires SolrResults#toPage
       * @since 2.22.0
       */
      triggerSearch: function (resetPage = false) {
        if (resetPage) MetacatUI.appModel.set("page", 0);

        const filters = this.get("filters");
        const searchResults = this.get("searchResults");

        // Get the Solr query string from the Search filter collection
        let query = filters.getQuery();

        // Set the query on the SolrResults collection
        searchResults.setQuery(query);

        // If the query hasn't changed since the last query that was sent, don't
        // do anything. This function may have been triggered by a change event
        // on a filter that doesn't affect the query at all
        if (!searchResults.hasChanged()) {
          // Trigger a reset event to indicate the search is complete (e.g. for
          // the UI)
          searchResults.trigger("reset");
          return;
        }

        // Get the page number
        let page = MetacatUI.appModel.get("page") || 0;
        searchResults.start = page * searchResults.rows;

        // Send the query to the server via the SolrResults collection
        searchResults.toPage(page);
      },
    }
  );
});
