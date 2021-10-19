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
     * @classdesc A AssetColorPalette Model represents a color scale that is mapped to
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
         * @property {string} paletteType Set to 'categorical', 'continuous', or
         * 'classified'. If categorical, then the color conditions will be interpreted
         * such that one color represents a single value (e.g. a discrete palette). If
         * continuous, then each color in the colors attribute will represent a point in a
         * gradient. The point in the gradient will be associated with the number set with
         * the color, and numbers in between points will be set to an interpolated color.
         * If 'classified', then the numbers set in the colors attribute will be
         * interpreted as maximums. Continuous properties will be forced into discrete
         * bins. NOTE: Currently only categorical palettes are supported.
         * @property {string} property The name (ID) of the property in the asset layer's
         * attribute table to color the vector data by (or for imagery data that does not
         * have an attribute table, just the name of the attribute that these colors map
         * to).
         * @property {string} [label] A user-friendly name to display instead of the
         * actual property name.
         * @property {AssetColors} colors The colors to use in the color palette, along
         * with the conditions associated with each color (i.e. the properties of the
         * feature that must be true to use the given color.)
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
         * Executed when a new AssetColorPalette model is created.
         * @param {Object} [attributes] The initial values of the attributes, which will
         * be set on the model.
         * @param {Object} [options] Options for the initialize function.
         */
        initialize: function (attributes, options) {
          try {
            if (attributes && attributes.colors) {
              this.set('colors', new AssetColors(attributes.colors))
            }
          }
          catch (error) {
            console.log(
              'There was an error initializing a AssetColorPalette model' +
              '. Error details: ' + error
            );
          }
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
