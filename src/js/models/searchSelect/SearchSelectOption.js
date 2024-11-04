"use strict";

define(["backbone"], (Backbone) => {
  /**
   * @class SelectOptionModel
   * @classdesc A model for representing an option in a search select dropdown.
   * @classcategory Models/SearchSelect
   * @since 2.31.0
   * @augments Backbone.Model
   */
  const SearchSelectOption = Backbone.Model.extend({
    /** @lends SearchSelectOption.prototype */

    /**
     * @returns {object} The default properties for a SearchSelectOption
     * @property {string} icon - The name of a Font Awesome 3.2.1 icon to display to
     * the left of the label (e.g. "lemon", "heart")
     * @property {string} image - The complete path to an image to use instead of an
     * icon. If both icon and image are provided, the icon will be used.
     * @property {string} label - The label to show for the option
     * @property {string} description - A description of the option, displayed as a
     * tooltip when the user hovers over the label
     * @property {string} value - If the value differs from the label, the value to
     * return when this option is selected (otherwise label is returned)
     * @property {string} category - If the option is part of a category, the name of
     * the category to display in the dropdown
     */
    defaults() {
      return {
        icon: "",
        image: "",
        label: "",
        description: "",
        value: "",
        category: "",
      };
    },
  });

  return SearchSelectOption;
});
