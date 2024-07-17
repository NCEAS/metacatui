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
     * @property {boolean} allowMulti - Whether to allow users to select more
     * than one value.
     * @property {boolean} allowAdditions - Allows users to add their own
     * options not listed in options.
     * @property {boolean} clearable - Whether the dropdown can be cleared by
     * the user after selection.
     * @property {string} submenuStyle - Determines the display style of items
     * in categories ("list", "popout", "accordion").
     * @property {boolean} hideEmptyCategoriesOnSearch - Displays category
     * headers in the dropdown even with no results.
     * @property {SearchSelectOptions} options - Collection of
     * SearchSelectOption models that represent choices a user can select from.
     * @property {string[]} selected - Currently selected values in the
     * dropdown.
     * @property {string[]|boolean} separatorOptions - For select inputs where
     * multiple values are allowed (allowMulti is true), a list of options that
     * can be used as separators between values. To turn off this feature, set
     * to false or an empty array.
     * @property {string} separator - The current separator to use between
     * selected values, must be one of the separatorOptions.
     * @property {string} searchTerm - The current search term being used to
     * filter options, if any. This will be updated by the view.
     * @property {string} originalSubmenuStyle - A reference to the original
     * submenu style since the submenu style can change during search. This will
     * be set automatically by the model during initialization.
     * @property {object|boolean} apiSettings - Settings for retrieving data via
     * API, false if not using remote content.
     */
    defaults: {
      allowMulti: true,
      allowAdditions: false,
      clearable: true,
      submenuStyle: "list",
      hideEmptyCategoriesOnSearch: true,
      options: new SearchSelectOptions(),
      selected: [],
      separatorOptions: ["AND", "OR"],
      separator: "",
      searchTerm: "",
      originalSubmenuStyle: "",
      apiSettings: false,
    },

    /** @inheritdoc */
    initialize(attributes, _options) {
      const optionsData = attributes?.options;
      // Select options must be parsed if they are not already
      // SearchSelectOption collections
      if (optionsData && !(optionsData instanceof SearchSelectOptions)) {
        this.updateOptions(optionsData);
      }
      // Save a reference to the original submenu style to revert to when search
      // term is removed
      const originalSubmenuStyle = this.get("submenuStyle");
      this.set("originalSubmenuStyle", originalSubmenuStyle);
      // Set a listener to change the submenu style when a user is searching
      if (originalSubmenuStyle !== "list") {
        this.changeSubmenuOnSearch();
      }
    },

    /**
     * Set a listener to change the current submenu style to "list" when a
     * search term is present, and revert to the original style when the search
     * term is removed. This is to ensure that the dropdown displays the list
     * style with only the search results when a user is searching. This is only
     * necessary if the submenu style is not already set to "list".
     */
    changeSubmenuOnSearch() {
      this.listenTo(this, "change:searchTerm", (model, searchTerm) => {
        const originalSubmenuStyle = this.get("originalSubmenuStyle");
        const submenuStyle = searchTerm ? "list" : originalSubmenuStyle;
        model.set("submenuStyle", submenuStyle);
      });
    },

    /**
     * Update the options for the dropdown.
     * @param {object|object[]} options The new options to set for the dropdown
     */
    updateOptions(options) {
      this.stopListening(this.get("options"));
      const parse = typeof options === "object" && !Array.isArray(options);
      this.set("options", new SearchSelectOptions(options, { parse }));
      this.listenTo(
        this.get("options"),
        "all",
        this.trigger.bind(this, "change:options"),
      );
    },

    /**
     * Returns the options as a JSON object.
     * @param {boolean} categorized - Whether to return the options as
     * categorized. See @link{SearchSelectOptions#toJSON} for more information.
     * @returns {object|object[]} - The options as a JSON object.
     */
    optionsAsJSON(categorized = false) {
      return this.get("options").toJSON(categorized);
    },

    /**
     * Checks if a value is one of the values in the options.
     * @param {string} value - The value to check for.
     * @returns {boolean} - Returns true if the value is found in the
     * collection, false otherwise.
     */
    isValidValue(value) {
      if (this.get("allowAdditions")) return true;
      return this.get("options").isValidValue(value);
    },

    /**
     * Check if there are any invalid selections in the selected values.
     * @returns {boolean | string[]} - Returns false if there are no invalid
     * selections, or an array of invalid selection strings if there are any.
     */
    hasInvalidSelections() {
      if (this.get("allowAdditions")) return false;
      const selected = this.get("selected");
      if (!selected || !selected.length) return false;
      const invalidSelections = selected.filter(
        (value) => !this.isValidValue(value),
      );
      return invalidSelections.length ? invalidSelections : false;
    },

    /**
     * Add a selected value and ensures it's not already in the list. If this is
     * not a multi-select dropdown, the selected value will replace any existing
     * value.
     * @param {string} value - The value to add to the selected list.
     * @param {object} options - Additional options to be passed to the 's set
     * method.
     */
    addSelected(value, options = {}) {
      const selected = this.get("selected");
      if (selected.includes(value)) return;
      const newSelected = this.get("allowMulti")
        ? [...selected, value]
        : [value];
      this.setSelected(newSelected, options);
    },

    /**
     * Change the values that are selected in the dropdown.
     * @param {string|string[]} values - The value(s) to select.
     * @param {object} options - Additional options to be passed to the set
     * method.
     */
    setSelected(values, options = {}) {
      const newValues = !Array.isArray(values) ? [values] : values;
      this.set({ selected: newValues }, options);
    },

    /**
     * Remove a value from the selected list.
     * @param {string} value - The value to remove from the selected list.
     * @param {object} options - Additional options to be passed to the set
     * method.
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

    /**
     * Checks if it's possible to update the separator that is used between
     * selected values. For this to be possible, there must be more than one
     * separator option available.
     * @returns {boolean} - Returns true if the separator can be changed, false
     * otherwise.
     */
    canChangeSeparator() {
      return (
        this.get("separatorOptions") && this.get("separatorOptions").length > 1
      );
    },

    /**
     * Get the next separator in the list of separator options.
     * @returns {string|null} - The next separator in the list of separator
     * options, or null if none.
     */
    getNextSeparator() {
      const separators = this.get("separatorOptions");
      const currentSeparator = this.get("separator");
      if (!currentSeparator || !separators || !separators.length) return null;
      const currentIndex = separators.indexOf(currentSeparator);
      let nextIndex = currentIndex + 1;
      if (nextIndex >= separators.length) {
        nextIndex = 0;
      }
      return separators[nextIndex];
    },

    /**
     * Set the next separator in the list of separator options.
     */
    setNextSeparator() {
      const nextSeparator = this.getNextSeparator();
      if (!nextSeparator) return;
      this.set("separator", nextSeparator);
    },
  });

  return SearchSelect;
});
