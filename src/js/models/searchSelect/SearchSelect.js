"use strict";

define(["backbone", "collections/searchSelect/SearchSelectOptions"], (
  Backbone,
  SearchSelectOptions,
) => {
  /**
   * @class SearchSelect
   * @classdesc A model for managing dropdown options and state for a searchable
   * select component.
   * @classcategory Models/SearchSelect
   * @since 0.0.0
   * @augments Backbone.Model
   */
  const SearchSelect = Backbone.Model.extend({
    /** @lends SearchSelect.prototype */

    /**
     * Default properties for the SearchableSelectModel.
     * @property {boolean} allowMulti - Whether to allow users to select more than one value.
     * @property {boolean} allowAdditions - Allows users to add their own options not listed in options.
     * @property {boolean} clearable - Whether the dropdown can be cleared by the user after selection.
     * @property {string} submenuStyle - Determines the display style of items in categories ("list", "popout", "accordion").
     * @property {boolean} hideEmptyCategoriesOnSearch - Displays category headers in the dropdown even with no results.
     * @property {SearchSelectOptions} options - Collection of SearchSelectOption models that represent choices a user can select from.
     * @property {string[]} selected - Currently selected values in the dropdown.
     * @property {object|boolean} apiSettings - Settings for retrieving data via API, false if not using remote content.
     */
    defaults: {
      allowMulti: true,
      allowAdditions: false,
      clearable: true,
      submenuStyle: "list",
      hideEmptyCategoriesOnSearch: true,
      options: new SearchSelectOptions(),
      selected: [],
      apiSettings: false,
    },

    initialize(attributes, _options) {
      const optionsData = attributes?.options;
      // Select options must be parsed if they are not already SearchSelectOption collections
      if (optionsData && !(optionsData instanceof SearchSelectOptions)) {
        this.updateOptions(optionsData);
      };
    },

    updateOptions(options) {
      this.stopListening(this.get("options"));
      const parse = (typeof options === "object" && !Array.isArray(options))
      this.set("options", new SearchSelectOptions(options, { parse }));
      this.listenTo(this.get("options"), "all", this.trigger.bind(this, "change:options"));
    },

    /**
     * Returns the options as a JSON object.
     * @param {boolean} categorized - Whether to return the options as categorized.
     * See @link{SearchSelectOptions#toJSON} for more information.
     * @returns {object|object[]} - The options as a JSON object.
     */
    optionsAsJSON(categorized = false) {
      return this.get("options").toJSON(categorized);
    },

    /**
     * Checks if a value is one of the values in the options.
     * @param {string} value - The value to check for.
     * @returns {boolean} - Returns true if the value is found in the collection, false otherwise.
     */
    isValidValue(value) {
      return this.get("options").isValidValue(value);
    },

    /**
     * Add a selected value and ensures it's not already in the list.
     * If this is not a multi-select dropdown, the selected value will replace
     * any existing value.
     * @param {string} value - The value to add to the selected list.
     * @param {object} options - Additional options to be passed to the 's set method.
     */
    addSelected(value, options = {}) {
      const selected = this.get("selected");
      if (selected.includes(value)) return;
      const newSelected = this.get("allowMulti") ? [...selected, value] : [value];
      this.setSelected(newSelected, options);
    },

    /**
     * Change the values that are selected in the dropdown.
     * @param {string|string[]} values - The value(s) to select.
     * @param {object} options - Additional options to be passed to the set method.
     */
    setSelected(values, options = {}) {
      const newValues = !Array.isArray(values) ? [values] : values;
      this.set({ selected: newValues }, options);
    },

    /**
     * Remove a value from the selected list.
     * @param {string} value - The value to remove from the selected list.
     * @param {object} options - Additional options to be passed to the set method.
     */
    removeSelected(value, options = {}) {
      const selected = this.get("selected");
      const newSelected = selected.filter((val) => val !== value);
      this.set({ selected: newSelected }, options);
    },

    /**
     * Checks whether a separator should be created for the label that was just
     * created, but not yet attached to the DOM
     * @returns {boolean} - Returns true if a separator should be created, false
     * otherwise.
     */
    separatorRequired() {
      const selected = this.get("selected");
      if (
        // Separators not required if only one selection is allowed
        !this.get("allowMulti") ||
        // Need the list of selected values to determine the value's position
        !selected ||
        // Separator is only required between two or more values
        selected.length < 2
      ) {
        return false;
      }
      return true;
    },
  });

  return SearchSelect;
});
