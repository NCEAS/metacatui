"use strict";

define([
  "backbone",
  "text!templates/maps/viewfinder.html",
  "views/maps/SearchInputView",
], (
  Backbone,
  Template,
  SearchInputView,
) => {
  /**
   * @class ViewfinderView
   * @classdesc The ViewfinderView allows a user to search for a latitude and longitude in the map view.
   * @classcategory Views/Maps
   * @name ViewfinderView
   * @extends Backbone.View
   * @screenshot views/maps/ViewfinderView.png
   * @since x.x.x
   * @constructs ViewfinderView
   */
  var ViewfinderView = Backbone.View.extend({
    /**
     * The type of View this is
     * @type {string}
     */
    type: "ViewfinderView",

    /**
     * The HTML classes to use for this view's HTML elements.
     * @type {Object<string,string>}
     */
    classNames: {
      baseClass: 'viewfinder',
      search: "viewfinder__form-field",
    },

    /**
     * @typedef {Object} ViewfinderViewOptions
     * @property {Map} The Map model associated with this view allowing control
     * of panning to different locations on the map. 
     */
    initialize(options) {
      this.model = options.model;
    },

    /**
     * Render the view by updating the HTML of the element.
     * The new HTML is computed from an HTML template that
     * is passed an object with relevant view state.
     * */
    render() {
      this.el.innerHTML = _.template(Template)({ classNames: this.classNames });

      this.searchInput = new SearchInputView({
        placeholder: "Search by latitude and longitude",
        search: text => (this.search(text)),
      });
      this.searchInput.render();
      this.$(`.${this.classNames.search}`).append(this.searchInput.el);
    },

    /**
     * Helper function to focus input on the searh query input and ensure
     * that the cursor is at the end of the text (as opposed to the beginning
     * which appears to be the default jQuery behavior).
     */
    focusInput() {
      this.searchInput.focus();
    },

    /**
     * Search function for the SearchInputView.
     * @returns {boolean} True if there is a location match.
     */
    search(text) {
      if (text === "") return { matched: true };

      const coords = this.parseValue(text);
      if (!coords) return false;

      this.model.zoomTo({ ...coords, height: 10000 /* meters */ });
      return true;
    },

    /**
     * Parse the user's input as a pair of floating point numbers. Log errors to the UI
     * @returns {{Number,Number|undefined}} coords Undefined represents an irrecoverable
     * user input, otherwise returns a latitude, longitude pair.
     */
    parseValue(value) {
      const matches = value.match(floatsRegex);
      const hasBannedChars = value.match(bannedCharactersRegex) != null;
      if (matches?.length !== 2 || isNaN(matches[0]) || isNaN(matches[1]) || hasBannedChars) {
        this.searchInput.setError("Try entering a search query with two numerical values representing a latitude and longitude (e.g. 64.84, -147.72).");
        return;
      }

      const latitude = Number(matches[0]);
      const longitude = Number(matches[1]);
      let errorText;
      if (latitude > 90 || latitude < -90) {
        this.searchInput.setError("Latitude values outside of the range of -90 to 90 may behave unexpectedly.");
      } else if (longitude > 180 || longitude < -180) {
        this.searchInput.setError("Longitude values outside of the range of -180 to 180 may behave unexpectedly.");
      }

      return { latitude, longitude };
    },
  });

  return ViewfinderView;
});

// Regular expression matching a string that contains two numbers optionally separated by a comma.
const floatsRegex = /[+-]?[0-9]*[.]?[0-9]+/g;

// Regular expression matching everything except numbers, periods, and commas.
const bannedCharactersRegex = /[^0-9,.+-\s]/g;