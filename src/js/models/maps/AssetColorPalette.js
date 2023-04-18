"use strict";

define([
  "jquery",
  "underscore",
  "backbone",
  "collections/maps/AssetColors",
], function ($, _, Backbone, AssetColors) {
  /**
   * @classdesc An AssetColorPalette Model represents a color scale that is
   * mapped to some attribute of a Map Asset. For vector assets, like 3D
   * tilesets, this palette is used to conditionally color features on a map.
   * For any type of asset, it can be used to generate a legend.
   * @classcategory Models/Maps
   * @class AssetColorPalette
   * @name AssetColorPalette
   * @extends Backbone.Model
   * @since 2.18.0
   * @constructor
   */
  var AssetColorPalette = Backbone.Model.extend(
    /** @lends AssetColorPalette.prototype */ {
      /**
       * The name of this type of model
       * @type {string}
       */
      type: "AssetColorPalette",

      /**
       * Default attributes for AssetColorPalette models
       * @name AssetColorPalette#defaults
       * @type {Object}
       * @property {('categorical'|'continuous'|'classified')}
       * [paletteType='categorical'] Set to 'categorical', 'continuous', or
       * 'classified'. NOTE: Currently only categorical and continuous palettes
       * are supported.
       * - Categorical: the color conditions will be interpreted such that one
       *   color represents a single value (e.g. a discrete palette).
       * - Continuous: each color in the colors attribute will represent a point
       *   in a gradient. The point in the gradient will be associated with the
       *   number set with the color, and numbers in between points will be set
       *   to an interpolated color.
       * - Classified: the numbers set in the colors attribute will be
       *   interpreted as maximums. Continuous properties will be forced into
       *   discrete bins.
       * @property {string} property The name (ID) of the property in the asset
       * layer's attribute table to color the vector data by (or for imagery
       * data that does not have an attribute table, just the name of the
       * attribute that these colors map to).
       * @property {string} [label = null] A user-friendly name to display
       * instead of the actual property name.
       * @property {AssetColors} [colors = new AssetColors()] The colors to use
       * in the color palette, along with the conditions associated with each
       * color (i.e. the properties of the feature that must be true to use the
       * given color.) . The last color in the collection will always be treated
       * as the default color - any feature that doesn't match the other colors
       * will be colored with this color.
       * @property {number} [minVal = null] The minimum value of the property to
       * use in the color palette when the special value 'min' is used for the
       * value of a color.
       * @property {number} [maxVal = null] The maximum value of the property to
       * use in the color palette when the special value 'max' is used for the
       * value of a color.
       */
      defaults: function () {
        return {
          paletteType: "categorical",
          property: null,
          label: null,
          colors: new AssetColors(),
          minVal: null,
          maxVal: null,
        };
      },

      /**
       * The ColorPaletteConfig specifies a color scale that is mapped to some
       * attribute of a {@link MapAsset}. For vector assets, like 3D tilesets,
       * this palette is used to conditionally color features on a map. For any
       * type of asset, including imagery, it can be used to generate a legend.
       * The ColorPaletteConfig is passed to a {@link AssetColorPalette} model.
       * @typedef {Object} ColorPaletteConfig
       * @name MapConfig#ColorPaletteConfig
       * @property {('categorical'|'continuous'|'classified')}
       * [paletteType='categorical'] NOTE: Currently only categorical and
       * continuous palettes are supported.
       * - Categorical: the color conditions will be interpreted such that one
       *   color represents a single value (e.g. a discrete palette).
       * - Continuous: each color in the colors attribute will represent a point
       *   in a gradient. The point in the gradient will be associated with the
       *   number set with the color, and numbers in between points will be set
       *   to an interpolated color.
       * - Classified: the numbers set in the colors attribute will be
       *   interpreted as maximums. Continuous properties will be forced into
       *   discrete bins.
       * @property {string} property The name (ID) of the property in the asset
       * layer's attribute table to color the vector data by (or for imagery
       * data that does not have an attribute table, just the name of the
       * attribute that these colors represent).
       * @property {string} [label] A user-friendly name to display instead of
       * the actual property name.
       * @property {MapConfig#ColorConfig[]} colors The colors to use in the
       * color palette, along with the conditions associated with each color
       * (i.e. the properties of the feature that must be true to use the given
       * color). The array of ColorConfig objects are passed to a
       * {@link AssetColors} collection, which in turn passes each ColorConfig
       * to a {@link AssetColor} model.
       *
       * @example
       * {
       *    paletteType: 'categorical',
       *    property: 'landUse',
       *    label: 'Land Use in 2016',
       *    colors: [
       *      { value: "agriculture", color: "#FF5733" },
       *      { value: "park", color: "#33FF80" }
       *    ]
       * }
       */

      /**
       * Executed when a new AssetColorPalette model is created.
       * @param {MapConfig#ColorPaletteConfig} [paletteConfig] The initial
       * values of the attributes, which will be set on the model.
       */
      initialize: function (paletteConfig) {
        try {
          if (paletteConfig && paletteConfig.colors) {
            this.set("colors", new AssetColors(paletteConfig.colors));
          }
          // If a continuous palette has only 1 colour, then treat it as
          // categorical
          if (
            this.get("paletteType") === "continuous" &&
            this.get("colors").length === 1
          ) {
            this.set("paletteType", "categorical");
          }
        } catch (error) {
          console.log(
            "There was an error initializing a AssetColorPalette model" +
              ". Error details: " +
              error
          );
        }
      },

      /**
       * Given properties of a feature, returns the color associated with that
       * feature.
       * @param {Object} properties The properties of the feature to get the
       * color for. (See the 'properties' attribute of
       * {@link Feature#defaults}.)
       * @returns {AssetColor#Color} The color associated with the given set of
       * properties.
       */
      getColor: function (properties) {
        const colorPalette = this;

        // As a backup, use the default color
        const defaultColor = colorPalette.getDefaultColor();
        let color = defaultColor;

        // The name of the property to conditionally color the features by
        const prop = colorPalette.get("property");
        // The value for the this property in the given properties
        const propValue = properties[prop];
        // Each palette type has different ways of getting the color
        const type = colorPalette.get("paletteType");
        // The collection of colors + conditions
        let colors = colorPalette.get("colors");

        if (!colors || colors.length === 0) {
          // Do nothing
        } else if (colors.length === 1) {
          color = colors.at(0).get("color");
        } else if (type === "categorical") {
          color = this.getCategoricalColor(propValue);
        } else if (type === "classified") {
          color = this.getClassifiedColor(propValue);
        } else if (type === "continuous") {
          color = this.getContinuousColor(propValue);
        }
        color = color || defaultColor;
        return color;
      },

      /**
       * Get the color for a categorical color palette for a given value.
       * @param {Number|string} value The value to get the color for.
       * @returns {AssetColor#Color} The color associated with the given value.
       */
      getCategoricalColor: function (value) {
        // For a categorical color palette, the value of the feature property
        // just needs to match one of the values in the list of color
        // conditions. If it matches, then return the color associated with that
        // value.
        const colors = this.get("colors");
        const colorMatch = colors.findWhere({ value: value });
        if (colorMatch) {
          return colorMatch.get("color");
        }
      },

      /**
       * Get the color for a continuous color palette for a given value.
       * @param {Number|string} value The value to get the color for.
       */
      getContinuousColor: function (value) {
        const collection = this.get("colors");
        collection.sort();
        const values = collection.getAttr("value");
        const colors = collection.getAttr("color");
        if (values.indexOf("min") > -1) {
          values[values.indexOf("min")] = this.get("minVal");
        }
        if (values.indexOf("max") > -1) {
          values[values.indexOf("max")] = this.get("maxVal");
        }
        const numColors = colors.length;
        let i = 0;
        while (i < numColors && value >= values[i]) {
          i++;
        }
        if (i === 0) {
          return colors[i];
        } else if (i === numColors) {
          return colors[i - 1];
        } else {
          const col1 = colors[i - 1];
          const val1 = values[i - 1];
          const col2 = colors[i];
          const val2 = values[i];
          const percent = (value - val1) / (val2 - val1);
          return this.interpolate(col1, col2, percent);
        }
      },

      /**
       * Get the color for a classified color palette for a given value.
       * @param {Number|string} value The value to get the color for.
       * @returns {AssetColor#Color} The color for the given value.
       */
      getClassifiedColor: function (value) {
        // TODO: test TODO: allow "min" and "max" keywords For a classified
        // color palette, the value of the feature property needs to be greater
        // than or equal to the value of the color condition. Use a sorted
        // array. const sortedColors = colors.toArray().sort(function (a, b) {
        // return a.get('value') - b.get('value')
        // })
        // let i = 0; while (i < sortedColors.length && propValue >=
        // sortedColors[i].get('value')) { i++;
        // }
        // color = sortedColors[i].get('color');
      },

      /**
       * Given two colors, returns a color that is a linear interpolation
       * between the two colors.
       * @param {AssetColor#Color} color1 The first color.
       * @param {AssetColor#Color} color2 The second color.
       * @param {number} fraction The percentage of the way between the two
       * colors, 0-1.
       * @returns {AssetColor#Color} The interpolated color.
       */
      interpolate: function (color1, color2, fraction) {
        const red = color1.red + fraction * (color2.red - color1.red);
        const green = color1.green + fraction * (color2.green - color1.green);
        const blue = color1.blue + fraction * (color2.blue - color1.blue);
        const alpha = color1.alpha + fraction * (color2.alpha - color1.alpha);
        return {
          red: red,
          green: green,
          blue: blue,
          alpha: alpha,
        };
      },

      /**
       * Gets the default color for the color palette, returns it as an object
       * of RGB intestines between 0 and 1.
       * @returns {AssetColor#Color} The default color for the palette.
       */
      getDefaultColor: function () {
        return this.get("colors").getDefaultColor().get("color");
      },

    }
  );

  return AssetColorPalette;
});
