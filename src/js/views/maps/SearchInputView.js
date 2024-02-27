"use strict";

define([
  "backbone",
  "text!templates/maps/search-input.html",
], (
  Backbone,
  Template,
) => {
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
    className: "search-input",

    /**
     * The HTML classes to use for this view's HTML elements.
     * @type {Object<string,string>}
     */
    classNames: {
      searchButton: "search-input__search-button",
      cancelButton: "search-input__cancel-button",
      input: "search-input__input",
      errorInput: "search-input__error-input",
      errorText: "search-input__error-text",
    },

    /** 
     * Values meant to be used by the rendered HTML template.
     */
    templateVars: {
      errorText: "",
      placeholder: "",
      classNames: {},
    },

    /**
    * The events this view will listen to and the associated function to call.
    * @type {Object}
    */
    events() {
      return {
        [`keyup .${this.classNames.input}`]: 'keyup',
        [`click .${this.classNames.searchButton}`]: "onSearch",
        [`click .${this.classNames.cancelButton}`]: "onCancel",
      };
    },

    /**
     * @typedef {Object} SearchReturnType
     * @property {boolean} matched True if there is a match.
     * @property {string} errorText Error to display. This can be set even when matched
     * returns true.
     */

    /**
     * @typedef {Object} SearchInputViewOptions
     * @property {Function} search A function that takes in a text input and returns
     * SearchReturnType.
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
      this.templateVars.classNames = this.classNames;
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
      const input = this.getInput();
      const inputValue = input.val().toLowerCase();
      const result = this.search(inputValue);
      if (result?.matched) {
        input.removeClass(this.classNames.errorInput);
      } else {
        input.addClass(this.classNames.errorInput);
        if (typeof(this.noMatchCallback) === "function") {
          this.noMatchCallback();
        }
      }

      const errorTextEl = this.$(`.${this.classNames.errorText}`);
      if (result?.errorText) {
        errorTextEl.html(result.errorText);
        errorTextEl.show();
      } else {
        errorTextEl.hide();
      }

      const searchButton = this.$(`.${this.classNames.searchButton}`);
      const cancelButton = this.$(`.${this.classNames.cancelButton}`);
      if (inputValue !== "") {
        searchButton.hide();
        cancelButton.show();
      } else {
        searchButton.show();
        cancelButton.hide();
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
      return this.$(`.${this.classNames.input}`);
    },
  });

  return SearchInputView;
});
