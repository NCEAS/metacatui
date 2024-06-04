"use strict";

define([
  "underscore",
  "backbone",
  "text!templates/maps/viewfinder/viewfinder-search.html",
  "views/maps/viewfinder/PredictionsListView",
  "models/maps/viewfinder/ViewfinderModel",
  "views/maps/SearchInputView",
], (
  _,
  Backbone,
  Template,
  PredictionsListView,
  ViewfinderModel,
  SearchInputView,
) => {
  // The base classname to use for this View's template elements.
  const BASE_CLASS = "viewfinder-search";
  // The HTML classes to use for this view's HTML elements.
  const CLASS_NAMES = {
    predictions: `${BASE_CLASS}__predictions`,
    searchInput: `${BASE_CLASS}__search-input`,
  };

  /**
   * @class SearchView
   * @classdesc SearchView allows a user to search for
   * a latitude and longitude in the map view, and find suggestions
   * for places related to their search terms.
   * This view requires a Google Maps API key in order to function properly,
   * and must have the Geocoding API and Places API enabled.
   * @classcategory Views/Maps
   * @name SearchView
   * @extends Backbone.View
   * @screenshot views/maps/viewfinder/SearchView.png
   * @since 2.29.0
   * @constructs SearchView
   */
  var SearchView = Backbone.View.extend(
    /** @lends SearchView.prototype */ {
      /**
       * The type of View this is
       * @type {string}
       */
      type: "SearchView",

      /** @inheritdoc */
      className: BASE_CLASS,

      /**
       * Values meant to be used by the rendered HTML template.
       */
      templateVars: {
        classNames: CLASS_NAMES,
      },

      /**
       * @typedef {Object} SearchViewOptions
       * @property {ViewfinderModel} viewfinderModel The model associated
       * with this view allowing control of panning to different locations on
       * the map, and displaying location related search features.
       */
      initialize({ viewfinderModel }) {
        this.childPredictionViews = [];
        this.viewfinderModel = viewfinderModel;

        this.setupListeners();

        this.autocompleteSearch = _.debounce(() => {
          this.viewfinderModel.autocompleteSearch(
            this.searchInput.getInputValue(),
          );
        }, 250 /* milliseconds */);
      },

      /** Setup all event listeners on ViewfinderModel. */
      setupListeners() {
        this.listenTo(this.viewfinderModel, "selection-made", (newQuery) => {
          this.setQuery(newQuery);
          this.searchInput.blur();
        });

        this.listenTo(this.viewfinderModel, "change:error", () => {
          this.searchInput.setError(this.viewfinderModel.get("error"));
        });
      },

      /**
       * Helper function to focus input on the search query input and ensure
       * that the cursor is at the end of the text (as opposed to the beginning
       * which appears to be the default jQuery behavior).
       */
      focusInput() {
        this.searchInput.focus();
      },

      /**
       * Getter function for the list of predictions.
       * @return {HTMLUListElement} Returns the predictions unordered list
       * HTML element.
       */
      getList() {
        return this.$el.find(`.${CLASS_NAMES.predictions}`);
      },

      /**
       * Getter function for the search query input.
       * @return {HTMLInputElement} Returns the search input HTML element.
       */
      getSearchInput() {
        return this.$el.find(`.${CLASS_NAMES.searchInput}`);
      },

      /**
       * Event handler to prevent cursor from jumping to beginning
       * of an input field (default behavior).
       */
      keydown(event) {
        if (event.key === "ArrowUp") {
          event.preventDefault();
        }

        // Unset query value since error is cleared and it should show up again
        // if the user re-enters the same value.
        if (this.searchInput.getInputValue() === "") {
          this.viewfinderModel.unset("query", { silent: true });
        }
      },

      /** Trigger the search on the ViewfinderModel. */
      search() {
        this.viewfinderModel.search(this.searchInput.getInputValue());
      },

      /**
       * Event handler for Backbone.View configuration that is called whenever
       * the user types a key.
       */
      async keyup(event) {
        if (event.key === "Enter") {
          this.search();
        } else if (event.key === "ArrowUp") {
          this.viewfinderModel.decrementFocusIndex();
        } else if (event.key === "ArrowDown") {
          this.viewfinderModel.incrementFocusIndex();
        } else {
          this.autocompleteSearch(this.searchInput.getInputValue());
        }
      },

      /** Helper function to set the input field. */
      setQuery(query) {
        this.searchInput.setInputValue(query);
      },

      /**
       * Show the predictions list and potentially submit a search for new
       * Predictions to display when there is a search query.
       */
      showPredictionsList() {
        this.getList().show();
        this.viewfinderModel.autocompleteSearch(
          this.searchInput.getInputValue(),
        );
      },

      /**
       * Hide the predictions list unless user is selecting a list item.
       * @param {FocusEvent} event Mouse event corresponding to a change in
       * focus.
       */
      hidePredictionsList(event) {
        const clickedInList = this.getList()[0]?.contains(event.relatedTarget);
        if (clickedInList) return;

        this.getList().hide();
      },

      /**
       * Render the SearchInputView.
       */
      renderSearchInput() {
        this.searchInput = new SearchInputView({
          placeholder: "Enter coordinates or areas of interest",
          search: (text) => {
            this.viewfinderModel.search(text);
            return false;
          },
          keyupCallback: (event) => {
            this.keyup(event);
          },
          focusCallback: (event) => {
            this.showPredictionsList(event);
          },
          blurCallback: (event) => {
            this.hidePredictionsList(event);
          },
          keydownCallback: (event) => {
            this.keydown(event);
          },
        });
        this.getSearchInput().append(this.searchInput.el);
        this.searchInput.render();
      },

      /**
       * Render the Prediction sub-views.
       */
      renderPredictionsList() {
        this.predictionsView = new PredictionsListView({
          viewfinderModel: this.viewfinderModel,
        });
        this.getList().html(this.predictionsView.el);
        this.predictionsView.render();
      },

      /**
       * Render the view by updating the HTML of the element.
       * The new HTML is computed from an HTML template that
       * is passed an object with relevant view state.
       * */
      render() {
        this.el.innerHTML = _.template(Template)(this.templateVars);

        this.renderSearchInput();
        this.renderPredictionsList();

        this.focusInput();
      },
    },
  );

  return SearchView;
});
