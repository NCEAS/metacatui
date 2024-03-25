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
        [`click .${CLASS_NAMES.cancelButton}`]: "onCancel",
        [`blur  .${CLASS_NAMES.input}`]: 'onBlur',
        [`change  .${CLASS_NAMES.input}`]: 'onKeyup',
        [`focus  .${CLASS_NAMES.input}`]: 'onFocus',
        [`keydown  .${CLASS_NAMES.input}`]: 'onKeydown',
        [`keyup .${CLASS_NAMES.input}`]: 'onKeyup',
        [`click .${CLASS_NAMES.searchButton}`]: "onSearch",
      };
    },

    /**
     * @typedef {Object} SearchInputViewOptions
     * @property {Function} search A function that takes in a text input and returns
     * a boolean for whether there is a match.
     * @property {Function} keydownCallback A function that receives a key event
     * on keydown.
     * @property {Function} keyupCallback A function that receives a key event
     * on keyup stroke.
     * @property {Function} blurCallback A function that receives an event on
     * blur of the input.
     * @property {Function} focusCallback A function that receives an event on
     * focus of the input.
     * @property {Function} noMatchCallback A callback function to handle a no match
     * situation.
     * @property {String} placeholder The placeholder text for the input box.
     */
    initialize(options) {
      if (typeof (options.search) !== "function") {
        throw new Error("Initializing SearchInputView without a search function.");
      }
      this.search = options.search;
      this.keyupCallback = options.keyupCallback || noop;
      this.keydownCallback = options.keydownCallback || noop;
      this.blurCallback = options.blurCallback || noop;
      this.focusCallback = options.focusCallback || noop;
      this.noMatchCallback = options.noMatchCallback || noop;
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
    onKeyup(event) {
      if (event.key === "Enter") {
        this.onSearch();
        return;
      }

      this.keyupCallback(event);
    },

    /**
     * Event handler for Backbone.View configuration that is called whenever 
     * the user types a key.
     */
    onKeydown(event) {
      this.keydownCallback(event);
    },

    /**
     * Event handler for Backbone.View configuration that is called whenever 
     * the user focuses the input.
     */
    onFocus(event) {
      this.focusCallback(event);
    },

    /**
     * Event handler for Backbone.View configuration that is called whenever 
     * the user blurs the input.
     */
    onBlur(event) {
      this.blurCallback(event);
    },

    /**
     * Event handler for Backbone.View configuration that is called whenever 
     * the user clicks the search button or hits the Enter key.
     */
    onSearch() {
      this.getError().hide();

      const input = this.getInput();
      const inputValue = this.getInputValue().toLowerCase();
      const matched = this.search(inputValue);
      if (matched) {
        input.removeClass(CLASS_NAMES.errorInput);
      } else {
        input.addClass(CLASS_NAMES.errorInput);
        if (typeof(this.noMatchCallback) === "function") {
          this.noMatchCallback();
        }
      }

      if (inputValue !== "") {
        this.getSearchButton().hide();
        this.getCancelButton().show();
      } else {
        this.getSearchButton().show();
        this.getCancelButton().hide();
      }
    },

    /**
     * API for the view that conducts the search to toggle on the error message.
     * @param {string} errorText
     */
    setError(errorText) {
      this.getInput().addClass(CLASS_NAMES.errorInput);
      const errorTextEl = this.getError();
      if (errorText) {
        errorTextEl.html(errorText);
        errorTextEl.show();
      } else {
        errorTextEl.html('');
        errorTextEl.hide();
      }
    },

    /**
     * Handler function for the cancel icon button action.
     */
    onCancel() {
      this.getInput().val("");
      this.onSearch();
      this.focus();
    },

    /**
     * Focus the input field in this View. 
     */
    focus() {
      this.getInput().trigger("focus");
    },

    /**
     * Blur the input field in this View.
     */
    blur() {
      this.getInput().trigger("blur");
    },

    /**
     * Get the search icon button.
     * @return jQuery element representing the search icon button. Or an empty
     * jQuery selector if the button is not found.
     */
    getSearchButton() {
      return this.$(`.${CLASS_NAMES.searchButton}`);
    },

    /**
     * Get the cancel icon button.
     * @return jQuery element representing the cancel icon button. Or an empty
     * jQuery selector if the button is not found.
     */
    getCancelButton() {
      return this.$(`.${CLASS_NAMES.cancelButton}`);
    },

    /**
     * Get the input.
     * @return jQuery element representing the input. Or an empty
     * jQuery selector if the button is not found.
     */
    getInput() {
      return this.$(`.${CLASS_NAMES.input}`);
    },

    /**
     * Get the error text element.
     * @return jQuery element representing the error text. Or an empty
     * jQuery selector if the button is not found.
     */
    getError() {
      return this.$(`.${CLASS_NAMES.errorText}`);
    },

    /**
     * Get the current value of the input field.
     * @return The current value of the input field or empty string if the
     * input field is not found.
     */
    getInputValue() {
      return this.getInput().val() || '';
    },

    /**
     * Set the current value of the input field.
     */
    setInputValue(value) {
      this.getInput().val(value);
    },
  });

  // A function that does nothing. Can be safely called as a default callback.
  const noop = () => { };

  return SearchInputView;
});
