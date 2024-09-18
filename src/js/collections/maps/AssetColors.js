"use strict";

define([
  "jquery",
  "underscore",
  "backbone",
  "models/maps/AssetColor",
], function ($, _, Backbone, AssetColor) {
  /**
   * @class AssetColors
   * @classdesc An AssetColors collection represents the colors used to create a color
   * scale for an asset in a map. The last color in the collection is treated as a
   * default.
   * @class AssetColors
   * @classcategory Collections/Maps
   * @extends Backbone.Collection
   * @since 2.18.0
   * @constructor
   */
  var AssetColors = Backbone.Collection.extend(
    /** @lends AssetColors.prototype */ {
      /**
       * The class/model that this collection contains.
       * @type {Backbone.Model}
       */
      model: AssetColor,

      /**
       * Add custom sort functionality such that values are sorted
       * numerically, but keep the special value key words "min" and "max" at
       * the beginning or end of the collection, respectively.
       * @since 2.25.0
       */
      comparator: function (color) {
        let value = color.get("value");
        if (value === "min") {
          return -Infinity;
        } else if (value === "max") {
          return Infinity;
        } else {
          return value;
        }
      },

      /**
       * Finds the last color model in the collection. If there are no colors in the
       * collection, returns the default color set in a new Asset Color model.
       * @return {AssetColor}
       */
      getDefaultColor: function () {
        let defaultColor = this.at(-1);
        if (!defaultColor) {
          defaultColor = new AssetColor();
        }
        return defaultColor;
      },

      /**
       * For any attribute that exists in the models in this collection, return an
       * array of the values for that attribute.
       * @param {string} attr - The attribute to get the values for.
       * @return {Array}
       * @since 2.25.0
       */
      getAttr: function (attr) {
        return this.map(function (model) {
          return model.get(attr);
        });
      },
    },
  );

  return AssetColors;
});
