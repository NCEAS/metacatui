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
     * @since 2.18.0
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
         * A color to use in a map color palette, along with the value that the color
         * represents.
         * @typedef {Object} ColorConfig
         * @name MapConfig#ColorConfig
         * @property {string|number} value The value of the attribute in a MapAsset that
         * corresponds to this color. If set to null, then this color will be the default
         * color.
         * @property {string} [label] A user-facing name for this attribute value,
         * to show in map legends, etc. If not set, then the value will be displayed
         * instead.
         * @property {(string|AssetColor#Color)} color Either an object with 'red',
         * 'green', 'blue' properties defining the intensity of each of the three colours
         * with a value between 0 and 1, OR a string with a hex color code beginning with
         * #, e.g. '#44A96A'. The {@link AssetColor} model will convert the string to an
         * {@link AssetColor#Color} object.
         * 
         * @example
         * {
         *   value: 0,
         *   label: 'water',
         *   color: {
         *     red: 0,
         *     green: 0.1,
         *     blue: 1 
         *   }
         * }
         * 
         * @example
         * {
         *   value: 'landmark',
         *   color: '#7B44A9'
         * }
         */

        /**
         * An object that defines the properties of a color
         * @typedef {Object} Color
         * @name AssetColor#Color
         * @property {number} [red=1] A number between 0 and 1 indicating the intensity of red
         * in this color.
         * @property {number} [blue=1] A number between 0 and 1 indicating the intensity of
         * red in this color.
         * @property {number} [green=1] A number between 0 and 1 indicating the intensity of
         * red in this color.
         * @property {number} [alpha=1] A number between 0 and 1 indicating the opacity of
         * this color.
         */

        /**
         * Default attributes for AssetColor models
         * @name AssetColor#defaults
         * @type {Object}
         * @property {string|number} value The value of the attribute that corresponds to
         * this color. If set to null, then this color will be the default color.
         * @property {string} [label] A user-facing name for this attribute value,
         * to show in map legends, etc. If not set, then the value will be displayed
         * instead.
         * @property {AssetColor#Color} color The red, green, and blue intensities that define the
         * color
        */
        defaults: function () {
          return {
            value: null,
            label: null,
            color: {
              red: 1,
              blue: 1,
              green: 1,
              alpha: 1
            }
          }
        },

        /**
         * Executed when a new AssetColor model is created.
         * @param {MapConfig#ColorConfig} [colorConfig] The initial values of the
         * attributes, which will be set on the model.
         */
        initialize: function (colorConfig) {
          try {
            // If the color is a hex code instead of an object with RGB values, then
            // convert it.
            if (colorConfig && colorConfig.color && typeof colorConfig.color === 'string') {
              // Assume the string is an hex color code and convert it to RGBA,
              // otherwise use the default color
              this.set('color',
                this.hexToRGBA(colorConfig.color) ||
                this.defaults().color
              )
            }
            // Set missing RGB values to 0, and alpha to 1
            let color = this.get('color');
            color.red = color.red || 0;
            color.green = color.green || 0;
            color.blue = color.blue || 0;
            if (!color.alpha && color.alpha !== 0) {
              color.alpha = 1;
            }
            this.set('color', color)

          }
          catch (error) {
            console.log(
              'There was an error initializing a AssetColor model' +
              '. Error details: ' + error
            );
          }
        },


        /**
         * Converts an 6 to 8 digit hex color value to RGBA values between 0 and 1
         * @param {string} hex - A hex color code, e.g. '#44A96A' or '#44A96A88'
         * @return {Color} - The RGBA values of the color
         * @since 2.25.0
         */
        hexToRGBA: function (hex) {
          var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})?$/i.exec(hex);
          return result ? {
            red: parseInt(result[1], 16) / 255,
            green: parseInt(result[2], 16) / 255,
            blue: parseInt(result[3], 16) / 255,
            alpha: parseInt(result[4], 16) / 255
          } : null;
        },

      });

    return AssetColor;

  }
);
