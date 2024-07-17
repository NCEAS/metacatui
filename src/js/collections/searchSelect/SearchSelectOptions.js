"use strict";

define(["backbone", "models/searchSelect/SearchSelectOption"], (
  Backbone,
  SearchSelectOption,
) => {
  /**
   * @class SearchSelectOptions
   * @classdesc A collection for managing dropdown options in a searchable select
   * view.
   * @classcategory Collections/SearchSelect
   * @since 0.0.0
   */
  const SearchSelectOptions = Backbone.Collection.extend({
    /** @lends SearchSelectOptions.prototype */

    /** @inheritdoc */
    model: SearchSelectOption,

    /**
     * Initializes with option models, objects, or categorized options.
     * @param {SearchSelectOption[]|object[]|object} _models - The options to add to the collection.
     * This can be an array of SearchSelectOption models, an array of attributes for options models,
     * or an object where each key is a category and each value is an array of options. All will be
     * automatically converted to SearchSelectOption models for the collection.
     * @param {object} _options - The options for the collection.
     * @param {boolean} _options.parse - Whether to parse the incoming data into the expected format.
     * @example
     * // Initialize with an array of attributes
     * const options = new SearchSelectOptions([
     *  { label: "Option 1" },
     *  { label: "Option 2" }
     * ]);
     * @example
     * // Initialize with an object of categorized options
     * const options = new SearchSelectOptions({
     *   "Category A": [
     *     { label: "Option 1" },
     *     { label: "Option 2" }
     *   "Category B": [
     *     { label: "Option 3" },
     *     { label: "Option 4" }
     * });
     */
    initialize(_models, _options) {},

    /**
     * Parses the incoming options data. This can handle both an array of options
     * (uncategorized) or an object with categories (categorized).
     * @param {object[] | object} data - Either an array of option objects or an object with categories.
     * @returns {Array} An array of option objects suitable for the collection.
     */
    parse(data) {
      let parsedData = [];

      if (Array.isArray(data)) {
        parsedData = data;
      } else if (typeof data === "object") {
        Object.keys(data).forEach((category) => {
          data[category].forEach((opt) => {
            // Add the category to the option object
            parsedData.push({ ...opt, category });
          });
        });
      }
      return parsedData;
    },

    /**
     * @returns {string[]} An array of unique category names.
     */
    getCategoryNames() {
      const categories = this.pluck("category");
      return [...new Set(categories)];
    },

    /**
     * Get the select options that belong to a given category.
     * @param {string} category - The category to get options for.
     * @returns {SearchSelectOption[]} An array of options in the specified category.
     */
    getOptionsByCategory(category) {
      return this.filter((option) => option.get("category") === category);
    },

    /**
     * Checks if a given matches either a label or value in the collection of options.
     * @param {string} value - The value or label to check for.
     * @returns {boolean} - Returns true if the value is found in the collection, false otherwise.
     */
    isValidValue(value) {
      return this.some(
        (option) =>
          option.get("value") === value || option.get("label") === value,
      );
    },

    /**
     * Return JSON representation of the collection.
     * @param {boolean} [categorized] Whether to return the options as an object with categories as keys (true)
     * or as an array with categories as a property on each option (false). If set to categorized, and the
     * options have no category, they will be placed in a default category with an empty string key.
     * @returns {object|object[]} JSON representation of the collection.
     */
    toJSON(categorized = false) {
      if (!categorized) {
        return this.map((option) => option.toJSON());
      }

      let categories = this.getCategoryNames();
      if (categories.length === 0) categories = [""];
      const categorizedOptions = {};

      categories.forEach((category) => {
        const options = this.getOptionsByCategory(category);
        categorizedOptions[category] = options.map((option) => option.toJSON());
      });

      return categorizedOptions;
    },
  });

  return SearchSelectOptions;
});
