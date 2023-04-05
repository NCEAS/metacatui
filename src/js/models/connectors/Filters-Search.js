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
       * Swap out the Filters and SearchResults models with new ones. Do not
       * set the models directly, as this will not remove the listeners from
       * the old models.
       * (TODO: Create custom set methods for the Filters and SearchResults)
       * @param {SolrResults|Filters[]} models - A model or array of models to
       * update in this connector.
       */
      updateModels(models) {
        if (!models) return;
        models = Array.isArray(models) ? models : [models];

        const wasConnected = this.get("isConnected");
        this.disconnect();

        const attrClassMap = {
          filters: Filters,
          searchResults: SearchResults,
        };

        models.forEach((model) => {
          try {
            for (const [attr, ModelClass] of Object.entries(attrClassMap)) {
              if (model instanceof ModelClass) {
                this.set(attr, model);
                break; // If a match is found, no need to check other entries in attrClassMap
              }
            }
          } catch (e) {
            console.log("Error updating model", model, e);
          }
        });

        if (wasConnected) {
          this.connect();
        }
      },

      /**
       * Sets listeners on the Filters and SearchResults to trigger a search
       * when the search changes
       * @since 2.22.0
       */
      connect: function () {
        this.disconnect();
        // const filters = this.get("filters");
        const searchResults = this.get("searchResults");
        // Listen to changes in the Filters to trigger a search

        this.listenTo(this.get("filters"), "add remove reset", function () {
          // Reset listeners so that we are not listening to the old filters
          this.connect();
          MetacatUI.appModel.set("page", 0);
          this.triggerSearch();
        });

        this.listenTo(this.get("filters"), "change update", function () {
          // Start at the first page when the filters change
          MetacatUI.appModel.set("page", 0);
          this.triggerSearch();
        });

        this.listenTo(
          searchResults,
          "change:sort change:facet",
          this.triggerSearch
        );

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
       * @since x.x.x
       */
      disconnect: function () {
        const model = this;
        this.stopListening(MetacatUI.appUserModel, "change:loggedIn");
        this.stopListening(
          this.get("filters"),
          "add remove update reset change"
        );
        // Listen to the sort order changing
        this.stopListening(
          this.get("searchResults"),
          "change:sort change:facet"
        );
        this.set("isConnected", false);
      },

      /**
       * Get Results from the Solr index by combining the Filter query string
       * fragments in each Filter instance in the Search collection and querying
       * Solr.
       * @fires SolrResults#toPage
       * @since 2.22.0
       */
      triggerSearch: function () {
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
