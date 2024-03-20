"use strict";

define([
  "backbone",
  "text!templates/maps/search-input.html",
], (
  Backbone,
  Template,
) => {
  const BASE_CLASS = "search-input";
  const CLASS_NAMES = {
    searchButton: `${BASE_CLASS}__search-button`,
    cancelButton: `${BASE_CLASS}__cancel-button`,
    input: `${BASE_CLASS}__input`,
    errorInput: `${BASE_CLASS}__error-input`,
    errorText: `${BASE_CLASS}__error-text`,
  };

  /**
   * @class SearchInputView
   * @classdesc SearchInputView is a shared component for searching information in the
   * map toolbar.
   * @classcategory Views/Maps
   * @name SearchInputView
   * @extends Backbone.View
   * @since x.x.x
   * @constructs SearchInputView
   */
  const SearchInputView = Backbone.View.extend({
    /**
     * The type of View this is
     * @type {string}
     */
    type: "SearchInputView",

    /**
    * The HTML classes to use for this view's element
    * @type {string}
    */
    className: BASE_CLASS,

    /** 
     * Values meant to be used by the rendered HTML template.
     */
    templateVars: {
      errorText: "",
      placeholder: "",
      classNames: CLASS_NAMES,
    },

    /**
    * The events this view will listen to and the associated function to call.
    * @type {Object}
    */
    events() {
      return {
        [`keyup .${CLASS_NAMES.input}`]: 'keyup',
        [`click .${CLASS_NAMES.searchButton}`]: "onSearch",
        [`click .${CLASS_NAMES.cancelButton}`]: "onCancel",
      };
    },

    /**
     * @typedef {Object} SearchInputViewOptions
     * @property {Function} search A function that takes in a text input and returns
     * a boolean for whether there is a match.
     * @property {Function} noMatchCallback A callback function to handle a no match
     * situation.
     * @property {String} placeholder The placeholder text for the input box.
     */
    initialize(options) {
      if (typeof(options.search) !== "function") {
        throw new Error("Initializing SearchInputView without a search function.");
      }
      this.search = options.search;
      this.noMatchCallback = options.noMatchCallback;
      this.templateVars.placeholder = options.placeholder;
    },

    /**
     * Render the view by updating the HTML of the element.
     * The new HTML is computed from an HTML template that
     * is passed an object with relevant view state.
     * */
    render() {
      this.el.innerHTML = _.template(Template)(this.templateVars);
    },

    /**
     * Event handler for Backbone.View configuration that is called whenever 
     * the user types a key.
     */
    keyup(event) {
      if (event.key === "Enter") {
        this.onSearch();
      }
    },

    /**
     * Event handler for Backbone.View configuration that is called whenever 
     * the user clicks the search button or hits the Enter key.
     */
    onSearch() {
      this.getError().hide();

      const input = this.getInput();
      const inputValue = input.val().toLowerCase();
      const matched = this.search(inputValue);
      if (matched) {
        input.removeClass(CLASS_NAMES.errorInput);
      } else {
        input.addClass(CLASS_NAMES.errorInput);
        if (typeof(this.noMatchCallback) === "function") {
          this.noMatchCallback();
        }
      }

      const searchButton = this.$(`.${CLASS_NAMES.searchButton}`);
      const cancelButton = this.$(`.${CLASS_NAMES.cancelButton}`);
      if (inputValue !== "") {
        searchButton.hide();
        cancelButton.show();
      } else {
        searchButton.show();
        cancelButton.hide();
      }
    },

    /**
     * API for the view that conducts the search to toggle on the error message.
     * @param {string} errorText
     */
    setError(errorText) {
      const errorTextEl = this.getError();
      if (errorText) {
        errorTextEl.html(errorText);
        errorTextEl.show();
      } else {
        errorTextEl.hide();
      }
    },

    onCancel() {
      this.getInput().val("");
      this.onSearch();
      this.focus();
    },

    focus() {
      this.getInput().trigger("focus");
    },

    getInput() {
      return this.$(`.${CLASS_NAMES.input}`);
    },

    getError() {
      return this.$(`.${CLASS_NAMES.errorText}`);
    },
  });

  return SearchInputView;
});
