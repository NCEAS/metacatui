"use strict";

define(["backbone", "collections/searchSelect/SearchSelectOptions"], (
  Backbone,
  SearchSelectOptions,
) => {
  /**
   * @class SearchSelect
   * @classdesc A model for managing dropdown options and state for a search
   * select component.
   * @classcategory Models/SearchSelect
   * @since 2.31.0
   * @augments Backbone.Model
   */
  const SearchSelect = Backbone.Model.extend({
    /** @lends SearchSelect.prototype */

    /**
     * @returns {object} Default attributes for a SearchSelect model.
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
     * @see
     * {@link https://fomantic-ui.com/modules/dropdown.html#remote-settings}
     * @see {@link https://fomantic-ui.com/behaviors/api.html#/settings}
     * @property {string} placeholderText Text to show in the input field before
     * any value has been entered.
     * @property {string} inputLabel Label for the input element.
     * @property {boolean} buttonStyle Set this to true to render the dropdown
     * as more of a button-like interface. This works best for single-select
     * dropdowns.
     * @property {string|boolean} icon Set this to a FontAwesome icon to use
     * instead of the default dropdown (down arrow) icon. Works will with the
     * buttonStyle option.
     * @property {boolean} fluid Set this to true to make the dropdown take up
     * the full width of its container.
     * @property {boolean} compact Set this to true to make the dropdown more
     * compact, e.g. for the filter bar in the catalog search.
     */
    defaults() {
      return {
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
        placeholderText: "Search for or select a value",
        inputLabel: "Select a value",
        buttonStyle: false,
        icon: false,
        fluid: true,
        compact: false,
      };
    },

    /** @inheritdoc */
    initialize(attributes, _options) {
      this.setOptionsForPreselected();
      const optionsData = attributes?.options;
      // Select options must be parsed if they are not already
      // SearchSelectOption collections
      if (optionsData && !(optionsData instanceof SearchSelectOptions)) {
        this.set(
          "options",
          new SearchSelectOptions(optionsData, { parse: true }),
        );
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
      const parse = typeof options === "object" && !Array.isArray(options);
      this.get("options").reset(options, { parse });
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
     * @param {object} options - Additional options to be passed to the set
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
      let selected = [...newValues];
      selected = this.restoreTypes(selected);
      this.set({ selected }, options);
    },

    /**
     * Restore the original types of the selected values based on the options in
     * the collection. This is necessary because the dropdown component converts
     * all values to strings. Types are set when the SearchSelectOption model is
     * initialized.
     * @param {string[]} selected - The selected values to restore types for.
     * @returns {string[]} - The selected values with their original types
     * restored.
     * @since 0.0.0
     */
    restoreTypes(selected) {
      // Restore the original types of the selected values
      return selected.map((value) => {
        const option = this.get("options").find(
          (option) => String(option.get("value")) === String(value),
        );
        if (option) {
          const type = option.get("type");
          if (type === "number") {
            return Number(value);
          } else if (type === "boolean") {
            return value === "true";
          } else if (type === "object") {
            try {
              return JSON.parse(value);
            } catch (e) {
              console.warn("Failed to parse object from value:", value, e);
            }
          }
          return value;
        }
        return value; // If no option found, return as is
      });
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
     * Determines if a separator is needed for the newly created, yet to be attached label.
     * @param {string} value - The value of the label.
     * @returns {boolean} - Returns true if a separator should be created, otherwise false.
     */
    separatorRequired(value) {
      // must have at least a current separator
      if (!this.get("separator")) return false;
      const selected = this.get("selected");
      return (
        this.get("allowMulti") && selected?.length > 1 && selected[0] !== value
      );
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

    /**
     * Get the selected models from the options collection.
     * @returns {SearchSelectOption[]} - The selected models from the options
     * collection.
     */
    getSelectedModels() {
      const selected = this.get("selected");
      return this.get("options").filter((model) =>
        selected.includes(model.get("value")),
      );
    },

    /**
     * This method is set for extended models that fetch options asynchronously
     * on search. This method should be overridden to fetch options from the API
     * for the values that are currently selected in the dropdown. This allows
     * those values to be populated with the correct label and icon.
     */
    setOptionsForPreselected() {
      // This method should be overridden in extended models
    },
  });

  return SearchSelect;
});
