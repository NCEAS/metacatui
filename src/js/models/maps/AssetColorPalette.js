'use strict';

define(
  [
    'jquery',
    'underscore',
    'backbone',
    'collections/maps/AssetColors'
  ],
  function (
    $,
    _,
    Backbone,
    AssetColors
  ) {
    /**
     * @classdesc An AssetColorPalette Model represents a color scale that is mapped to
     * some attribute of a Map Asset. For vector assets, like 3D tilesets, this palette is
     * used to conditionally color features on a map. For any type of asset, it can be
     * used to generate a legend.
     * @classcategory Models/Maps
     * @class AssetColorPalette
     * @name AssetColorPalette
     * @extends Backbone.Model
     * @since 2.x.x
     * @constructor
    */
    var AssetColorPalette = Backbone.Model.extend(
      /** @lends AssetColorPalette.prototype */ {

        /**
         * The name of this type of model
         * @type {string}
        */
        type: 'AssetColorPalette',

        /**
         * Default attributes for AssetColorPalette models
         * @name AssetColorPalette#defaults
         * @type {Object}
         * @property {('categorical'|'continuous'|'classified')}
         * [paletteType='categorical'] Set to 'categorical', 'continuous', or
         * 'classified'. NOTE: Currently only categorical palettes are supported.
         * - Categorical: the color conditions will be interpreted such that one color
         *   represents a single value (e.g. a discrete palette).
         * - Continuous: each color in the colors attribute will represent a point in a
         *   gradient. The point in the gradient will be associated with the number set
         *   with the color, and numbers in between points will be set to an interpolated
         *   color.
         * - Classified: the numbers set in the colors attribute will be interpreted as
         *   maximums. Continuous properties will be forced into discrete bins. 
         * @property {string} property The name (ID) of the property in the asset layer's
         * attribute table to color the vector data by (or for imagery data that does not
         * have an attribute table, just the name of the attribute that these colors map
         * to).
         * @property {string} [label = null] A user-friendly name to display instead of
         * the actual property name.
         * @property {AssetColors} [colors = new AssetColors()] The colors to use in the
         * color palette, along with the conditions associated with each color (i.e. the
         * properties of the feature that must be true to use the given color.) . The last
         * color in the collection will always be treated as the default color - any
         * feature that doesn't match the other colors will be colored with this color.
        */
        defaults: function () {
          return {
            paletteType: 'categorical',
            property: null,
            label: null,
            colors: new AssetColors()
          }
        },

        /**
         * The ColorPaletteConfig specifies a color scale that is mapped to some attribute
         * of a {@link MapAsset}. For vector assets, like 3D tilesets, this palette is
         * used to conditionally color features on a map. For any type of asset, including
         * imagery, it can be used to generate a legend. The ColorPaletteConfig is passed
         * to a {@link AssetColorPalette} model.
         * @typedef {Object} ColorPaletteConfig
         * @name MapConfig#ColorPaletteConfig
         * @property {('categorical'|'continuous'|'classified')}
         * [paletteType='categorical'] NOTE: Currently only categorical palettes are
         * supported.
         * - Categorical: the color conditions will be interpreted such that one color
         *   represents a single value (e.g. a discrete palette).
         * - Continuous: each color in the colors attribute will represent a point in a
         *   gradient. The point in the gradient will be associated with the number set
         *   with the color, and numbers in between points will be set to an interpolated
         *   color.
         * - Classified: the numbers set in the colors attribute will be interpreted as
         *   maximums. Continuous properties will be forced into discrete bins. 
         * @property {string} property The name (ID) of the property in the asset layer's
         * attribute table to color the vector data by (or for imagery data that does not
         * have an attribute table, just the name of the attribute that these colors
         * represent).
         * @property {string} [label] A user-friendly name to display instead of the
         * actual property name.
         * @property {MapConfig#ColorConfig[]} colors The colors to use in the color
         * palette, along with the conditions associated with each color (i.e. the
         * properties of the feature that must be true to use the given color). The array
         * of ColorConfig objects are passed to a {@link AssetColors} collection, which in
         * turn passes each ColorConfig to a {@link AssetColor} model.
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
         * @param {MapConfig#ColorPaletteConfig} [paletteConfig] The initial values of the
         * attributes, which will be set on the model.
         */
        initialize: function (paletteConfig) {
          try {
            if (paletteConfig && paletteConfig.colors) {
              this.set('colors', new AssetColors(paletteConfig.colors))
            }
          }
          catch (error) {
            console.log(
              'There was an error initializing a AssetColorPalette model' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Given properties of a feature, returns the color associated with that feature.
         * @param {Object} properties The properties of the feature to get the color for.
         * (See the 'properties' attribute of {@link Feature#defaults}.)
         * @returns {AssetColor#Color} The color associated with the given set of
         * properties.
         */
        getColor: function (properties) {

          const colorPalette = this;

          // As a backup, use the default color
          const defaultColor = this.getDefaultColor();
          let color = defaultColor

          // The name of the property to conditionally color the features by
          const prop = colorPalette.get('property');
          // The value for the this property in the given properties
          const propValue = properties[prop];
          // Each palette type has different ways of getting the color
          const type = colorPalette.get('paletteType');
          // The collection of colors + conditions 
          const colors = colorPalette.get('colors');

          if (!colors || colors.length === 0) {
            // Skip the other if statements, use default color.
          } else if (colors.length === 1) {
            // If there's just 1 color, then return that color.
            color = colors.at(0).get('color');
          } else if (type === 'categorical') {
            // For a categorical color palette, the value of the feature property just
            // needs to match one of the values in the list of color conditions.
            // If it matches, then return the color associated with that value.
            const colorMatch = colors.findWhere({ value: propValue });
            if (colorMatch) {
              color = colorMatch.get('color');
            }
          } else if (type === 'classified') {
            // TODO: test
            
            // For a classified color palette, the value of the feature property needs to
            // be greater than or equal to the value of the color condition. Use a
            // sorted array.
            
            // const sortedColors = colors.toArray().sort(function (a, b) {
            //   return a.get('value') - b.get('value')
            // })
            // let i = 0;
            // while (i < sortedColors.length && propValue >= sortedColors[i].get('value')) {
            //   i++;
            // }
            // color = sortedColors[i].get('color');
          } else if (type === 'continuous') {
            // TODO: test

            // For a continuous color palette, the value of the feature property must
            // either match one of the values in the color palette, or be interpolated
            // between the values in the palette. 
            
            // const sortedColors = colors.toArray().sort(function (a, b) {
            //   return a.get('value') - b.get('value')
            // })
            // let i = 0;
            // while (i < sortedColors.length && propValue >= sortedColors[i].get('value')) {
            //   i++;
            // }
            // if (i === 0) {
            //   color = sortedColors[0].get('color');
            // }
            // else if (i === sortedColors.length) {
            //   color = sortedColors[i - 1].get('color');
            // }
            // else {
            //   const percent = (propValue - sortedColors[i - 1].get('value')) /
            //     (sortedColors[i].get('value') - sortedColors[i - 1].get('value'));
            //   color = sortedColors[i - 1].get('color').interpolate(sortedColors[i].get('color'), percent);
            // }
          }
          return color
        },

        /**
         * Gets the default color for the color palette, returns it as an object of RGB
         * intestines between 0 and 1.
         * @returns {AssetColor#Color} The default color for the palette.
         */
        getDefaultColor: function () {
          return this.get('colors').getDefaultColor().get('color');
        },

        // /**
        //  * Parses the given input into a JSON object to be set on the model.
        //  *
        //  * @param {TODO} input - The raw response object
        //  * @return {TODO} - The JSON object of all the AssetColorPalette attributes
        //  */
        // parse: function (input) {

        //   try {

        //     var modelJSON = {};

        //     return modelJSON

        //   }
        //   catch (error) {
        //     console.log(
        //       'There was an error parsing a AssetColorPalette model' +
        //       '. Error details: ' + error
        //     );
        //   }

        // },

        // /**
        //  * Overrides the default Backbone.Model.validate.function() to check if this if
        //  * the values set on this model are valid.
        //  * 
        //  * @param {Object} [attrs] - A literal object of model attributes to validate.
        //  * @param {Object} [options] - A literal object of options for this validation
        //  * process
        //  * 
        //  * @return {Object} - Returns a literal object with the invalid attributes and
        //  * their corresponding error message, if there are any. If there are no errors,
        //  * returns nothing.
        //  */
        // validate: function (attrs, options) {
        //   try {

        //   }
        //   catch (error) {
        //     console.log(
        //       'There was an error validating a AssetColorPalette model' +
        //       '. Error details: ' + error
        //     );
        //   }
        // },

        // /**
        //  * Creates a string using the values set on this model's attributes.
        //  * @return {string} The AssetColorPalette string
        //  */
        // serialize: function () {
        //   try {
        //     var serializedAssetColorPalette = '';

        //     return serializedAssetColorPalette;
        //   }
        //   catch (error) {
        //     console.log(
        //       'There was an error serializing a AssetColorPalette model' +
        //       '. Error details: ' + error
        //     );
        //   }
        // },

      });

    return AssetColorPalette;

  }
);
