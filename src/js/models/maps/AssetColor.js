'use strict';

define(
  [
    'jquery',
    'underscore',
    'backbone'
  ],
  function (
    $,
    _,
    Backbone
  ) {
    /**
     * @classdesc An AssetColor Model represents one color in a color scale that maps to
     * attributes of a Map Asset. For vector assets (e.g. Cesium3DTileset models), the
     * color is used to conditionally color vector data in a map (or plot).
     * @classcategory Models/Maps
     * @class AssetColor
     * @name AssetColor
     * @extends Backbone.Model
     * @since 2.x.x
     * @constructor
    */
    var AssetColor = Backbone.Model.extend(
      /** @lends AssetColor.prototype */ {

        /**
         * The name of this type of model
         * @type {string}
        */
        type: 'AssetColor',

        /**
         * An object that defines the properties of a color
         * 
         * @typedef {Object} Color
         * @property {number} red A number between 0 and 1 indicating the intensity of red
         * in this color.
         * @property {number} blue A number between 0 and 1 indicating the intensity of
         * red in this color.
         * @property {number} green A number between 0 and 1 indicating the intensity of
         * red in this color.
         */

        /**
         * Default attributes for AssetColor models
         * @name AssetColor#defaults
         * @type {Object}
         * @property {string} value The value of the attribute that corresponds to
         * this color. If set to null, then this color will be the default color.
         * @property {string|number} [label] A user-facing name for this attribute value,
         * to show in map legends, etc. If not set, then the value will be displayed
         * instead.
         * @property {Color} color The red, green, and blue intensities that define the
         * color
        */
        defaults: function () {
          return {
            value: null,
            label: null,
            color: {
              red: 1,
              blue: 1,
              green: 1
            }
          }
        },

        /**
         * Executed when a new AssetColor model is created.
         * @param {Object} [attributes] The initial values of the attributes, which will
         * be set on the model.
         * @param {Object} [options] Options for the initialize function.
         */
        initialize: function (attributes, options) {
          try {
            // If the color is a hex code instead of an object with RGB values, then
            // convert it.
            if (attributes && attributes.color && typeof attributes.color === 'string') {
              // Assume the string is an hex color code and convert it to RGB
              var rgb = this.hexToRGB(attributes.color)
              if (rgb) {
                this.set('color', rgb)
              } else {
                // Otherwise, the color is invalid, set it to the default
                this.set('color', this.defaults().color)
              }
            }
          }
          catch (error) {
            console.log(
              'There was an error initializing a AssetColor model' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Converts hex color values to RGB values between 0 and 1
         *
         * @param {string} hex a color in hexadecimal format
         * @return {Color} a color in RGB format
        */
        hexToRGB: function (hex) {
          var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
          return result ? {
            red: parseInt(result[1], 16) / 255,
            green: parseInt(result[2], 16) / 255,
            blue: parseInt(result[3], 16) / 255
          } : null;
        },

        // /** 
        //  * Parses the given input into a JSON object to be set on the model.
        //  *
        //  * @param {TODO} input - The raw response object
        //  * @return {TODO} - The JSON object of all the AssetColor attributes
        //  */
        // parse: function (input) {

        //   try {
        //     // var modelJSON = {};

        //     // return modelJSON

        //   }
        //   catch (error) {
        //     console.log(
        //       'There was an error parsing a AssetColor model' +
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
        //       'There was an error validating a AssetColor model' +
        //       '. Error details: ' + error
        //     );
        //   }
        // },

        // /**
        //  * Creates a string using the values set on this model's attributes.
        //  * @return {string} The AssetColor string
        //  */
        // serialize: function () {
        //   try {
        //     var serializedAssetColor = "";

        //     return serializedAssetColor;
        //   }
        //   catch (error) {
        //     console.log(
        //       'There was an error serializing a AssetColor model' +
        //       '. Error details: ' + error
        //     );
        //   }
        // },

      });

    return AssetColor;

  }
);
