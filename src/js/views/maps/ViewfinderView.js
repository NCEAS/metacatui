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
      button: "viewfinder__button",
      input: "viewfinder__input",
    },

    /**
    * The events this view will listen to and the associated function to call.
    * @type {Object}
    */
    events() {
      return {
        [`change .${this.classNames.input}`]: 'valueChange',
        [`click .${this.classNames.button}`]: 'search',
        [`keyup .${this.classNames.input}`]: 'keyup',
      };
    },

    /** 
     * Values meant to be used by the rendered HTML template.
     */
    templateVars: {
      errorMessage: "",
      // Track the input value across re-renders.
      inputValue: "",
      placeholder: "Search by latitude and longitude",
      classNames: {},
    },

    /**
     * @typedef {Object} ViewfinderViewOptions
     * @property {Map} The Map model associated with this view allowing control
     * of panning to different locations on the map. 
     */
    initialize(options) {
      this.mapModel = options.model;
      this.templateVars.classNames = this.classNames;
    },

    /**
     * Render the view by updating the HTML of the element.
     * The new HTML is computed from an HTML template that
     * is passed an object with relevant view state.
     * */
    render() {
      this.el.innerHTML = _.template(Template)(this.templateVars);

      this.focusInput();
    },

    /**
     * Helper function to focus input on the searh query input and ensure
     * that the cursor is at the end of the text (as opposed to the beginning
     * which appears to be the default jQuery behavior).
     */
    focusInput() {
      const input = this.getInput();
      input.focus();
      // Move cursor to end of input.
      input.val("");
      input.val(this.templateVars.inputValue);
    },

    /**
     * Getter function for the search query input. 
     * @return {HTMLInputElement} Returns the search input HTML element.
     */
    getInput() {
      return this.$el.find(`.${this.classNames.input}`);
    },

    /**
     * Getter function for the search button. 
     * @return {HTMLButtonElement} Returns the search button HTML element.
     */
    getButton() {
      return this.$el.find(`.${this.classNames.button}`);
    },

    /**
     * Event handler for Backbone.View configuration that is called whenever 
     * the user types a key.
     */
    keyup(event) {
      if (event.key === "Enter") {
        this.search();
      }
    },

    /**
     * Event handler for Backbone.View configuration that is called whenever
     * the user changes the value in the input field.
     */
    valueChange() {
      this.templateVars.inputValue = this.getInput().val();
    },

    /**
     * Event handler for Backbone.View configuration that is called whenever 
     * the user clicks the search button or hits the Enter key.
     */
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

    /** Helper function to clear the error field.  */
    clearError() {
      this.setError("");
    },

    /** Helper function to set the error field and re-render the view.  */
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