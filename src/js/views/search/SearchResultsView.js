/*global define */
define([
  "backbone",
  "collections/SolrResults",
  "views/search/SearchResultView",
], function (Backbone, SearchResults, SearchResultView) {
  "use strict";

  /**
   * @class SearchResultsView
   * @classdesc A view of search results.
   * @name SearchResultsView
   * @classcategory Views/Search
   * @extends Backbone.View
   * @since 2.22.0
   * @constructor
   * @screenshots views/search/SearchResultsView.png
   */
  return Backbone.View.extend(
    /**
     * @lends SearchResultsView.prototype
     */ {
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
       * The events this view will listen to and the associated function to
       * call.
       * @type {Object}
       */
      events: {},

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

      /**
       * Render the view.
       */
      render: function () {
        try {
          if (!this.searchResults) this.setSearchResults();

          this.loading();

          if (typeof this.searchResults.getNumFound() == "number") {
            this.addResultCollection();
          }

          this.startListening();
        } catch (e) {
          console.log("Failed to render search results view.", e);
          const emailMsg =
            "There was an error rendering the search results view. " + e;
          this.showError(null, { responseText: emailMsg });
        }
      },

      /**
       * Removes listeners set by the {@link SearchResultsView#startListening}
       * method. This is important to prevent zombie listeners from being
       * created.
       */
      removeListeners: function () {
        this.stopListening(this.searchResults, "add");
        this.stopListening(this.searchResults, "reset");
        this.stopListening(this.searchResults, "request");
        this.listenTo(this.searchResults, "error");
      },

      /**
       * Sets listeners on the {@link SearchResultsView#searchResults} to change
       * what is displayed in this view.
       */
      startListening: function () {
        this.removeListeners();
        this.listenTo(this.searchResults, "add", this.addResultModel);
        this.listenTo(this.searchResults, "reset", this.addResultCollection);
        this.listenTo(this.searchResults, "changing request", this.loading);
        this.listenTo(this.searchResults, "error", this.showError);
      },

      /**
       * When there is an error fetching the search results, show an alert
       * message to the user.
       * @param {SolrResults} searchResults - The collection of search results
       * @param {Object} response - The response from the server
       */
      showError: function (searchResults, response) {
        console.log("Failed to fetch search results.");
        if (response) console.log(response);

        const thisRepo = MetacatUI.appModel.get("repositoryName") || "DataONE";
        const responseText = encodeURIComponent(response.responseText);

        const alert = MetacatUI.appView.showAlert({
          message: `Oops! It looks like there was a problem retrieving your
            search results. Please try your search again and contact support
            if the issue persists.<br><br>`,
          classes: `alert-warning`,
          container: this.el,
          replaceContents: true,
          delay: false,
          remove: false,
          includeEmail: true,
          emailBody: `I'm having trouble searching ${thisRepo}.
            Here is the error message I received: ${responseText}`,
        });
        // alert is an HTMLDivElement, add a margin to the left and right:
        alert[0].style.margin = "0 1rem";
      },

      /**
       * Creates and sets the {@link SearchResultsView#searchResults} property.
       * @returns {SolrResults}
       */
      setSearchResults: function () {
        this.searchResults = new SearchResults();
        return this.searchResults;
      },

      /**
       * Renders the given {@link SolrResult} model inside this view.
       * @param {SolrResult} searchResult
       */
      addResultModel: function (searchResult) {
        try {
          let view = this.createSearchResultView();
          view.model = searchResult;
          this.addResultView(view);
        } catch (e) {
          console.error("Failed to add a search result to the page: ", e);
        }
      },

      /**
       * Renders all {@link SolrResult}s from the
       * {@link SearchResultsView#searchResults} collection.
       */
      addResultCollection: function () {
        if (!this.searchResults) return;
        if (this.searchResults.getNumFound() == 0) {
          this.showNoResults();
          return;
        }

        this.empty();

        this.searchResults.models.forEach((result) => {
          this.addResultModel(result);
        });
      },

      /**
       * Adds a Search Result View to the page
       * @param {SearchResultView} view
       */
      addResultView: function (view) {
        this.el.append(view.el);
        view.render();
      },

      /**
       * Creates a Search Result View
       */
      createSearchResultView: function () {
        return new SearchResultView();
      },

      /**
       * Shows a message when no search results have been found.
       */
      showNoResults: function () {
        this.empty();
        this.el.innerHTML = this.noResultsTemplate;
      },

      /**
       * Removes all child elements from this view.
       */
      empty: function () {
        this.el.innerHTML = "";
      },

      /**
       * Renders a skeleton of this view that communicates to the user that it
       * is loading.
       */
      loading: function () {
        this.empty();

        let rows = this.searchResults.rows,
          i = 0;

        while (i < rows) {
          let view = this.createSearchResultView();
          this.addResultView(view);
          view.loading();
          i++;
        }
      },
    }
  );
});
