"use strict";

define([
  "backbone",
  "text!templates/maps/viewfinder.html",
], (
  Backbone,
  Template,
) => {
  /**
   * @class ViewfinderView
   * @classdesc The ViewfinderView allows a user to search for a latitude and longitude in the map view.
   * @classcategory Views/Maps
   * @name ViewfinderView
   * @extends Backbone.View
   * @screenshot views/maps/ViewfinderView.png
   * @since 2.27.1
   * @constructs ViewfinderView
   */
  var ViewfinderView = Backbone.View.extend({
    /**
     * The type of View this is
     * @type {string}
     */
    type: "ViewfinderView",

    /**
     * The HTML classes to use for this view's element
     * @type {string}
     */
    className: classNames.baseClass,

    /**
    * The events this view will listen to and the associated function to call.
    * @type {Object}
    */
    events: {
      [`change .${classNames.input}`]: 'valueChange',
      [`click .${classNames.button}`]: 'search',
      [`keyup .${classNames.input}`]: 'keyup',
    },

    /** 
     * Values meant to be used by the rendered HTML template.
     */
    templateVars: {
      errorMessage: "",
      // Track the input value across re-renders.
      inputValue: "",
      placeholder: "Search by latitude and longitude",
      classNames,
    },

    /**
     * @typedef {Object} ViewfinderViewOptions
     * @property {Map} The Map model associated with this view allowing control
     * of panning to different locations on the map. 
     */
    initialize(options) {
      this.mapModel = options.model;
    },

    render() {
      this.el.innerHTML = _.template(Template)(this.templateVars);

      this.focusInput();
    },

    focusInput() {
      const input = this.getInput();
      input.focus();
      // Move cursor to end of input.
      input.val("");
      input.val(this.templateVars.inputValue);
    },

    getInput() {
      return this.$el.find(`.${classNames.input}`);
    },

    getButton() {
      return this.$el.find(`.${classNames.button}`);
    },

    /** Event handler for Backbone.View configuration. */
    keyup(event) {
      if (event.key === "Enter") {
        this.search();
      }
    },

    valueChange() {
      this.templateVars.inputValue = this.getInput().val();
    },

    /** Event handler for Backbone.View configuration. */
    search() {
      this.clearError();

      const coords = this.parseValue(this.templateVars.inputValue)
      if (!coords) return;

      this.model.zoomTo({ ...coords, height: 10000 /* meters */ });
    },

    /**
     * Parse the user's input as a pair of floating point numbers. Log errors to the UI
     * @return {{Number,Number}|undefined} Undefined represents an irrecoverable user input,
     *   otherwise returns a latitude, longitude pair.
     */
    parseValue(value) {
      const matches = value.match(floatsRegex);
      const hasBannedChars = value.match(bannedCharactersRegex) != null;
      if (matches?.length !== 2 || isNaN(matches[0]) || isNaN(matches[1]) || hasBannedChars) {
        this.setError("Try entering a search query with two numerical values representing a latitude and longitude (e.g. 64.84, -147.72).");
        return;
      }

      const latitude = Number(matches[0]);
      const longitude = Number(matches[1]);
      if (latitude > 90 || latitude < -90) {
        this.setError("Latitude values outside of the range of -90 to 90 may behave unexpectedly.");
      } else if (longitude > 180 || longitude < -180) {
        this.setError("Longitude values outside of the range of -180 to 180 may behave unexpectedly.");
      }

      return { latitude, longitude };
    },

    clearError() {
      this.setError("");
    },

    setError(errorMessage) {
      this.templateVars.errorMessage = errorMessage;
      this.render();
    },
  });

  return ViewfinderView;
});

// Regular expression matching a string that contains two numbers optionally separated by a comma.
const floatsRegex = /[+-]?[0-9]*[.]?[0-9]+/g;

// Regular expression matching everything except numbers, periods, and commas.
const bannedCharactersRegex = /[^0-9,.+-\s]/g;

// Class names that correspond to elements in the template.
const classNames = {
  baseClass: 'viewfinder',
  button: "viewfinder__button",
  input: "viewfinder__input",
};