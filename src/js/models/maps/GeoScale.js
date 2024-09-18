"use strict";

define(["backbone"], function (Backbone) {
  /**
   * @class GeoScale
   * @classdesc The GeoScale model stores the relative scale of the map in
   * meters vs. pixels. This can be used to convert between the two.
   * @classcategory Models/Maps
   * @name GeoScale
   * @since 2.27.0
   * @extends Backbone.Model
   */
  var GeoScale = Backbone.Model.extend(
    /** @lends GeoScale.prototype */ {
      /**
       * The type of model this is.
       * @type {String}
       */
      type: "GeoScale",

      /**
       * Overrides the default Backbone.Model.defaults() function to specify
       * default attributes for the GeoScale.
       */
      defaults: function () {
        return {
          pixel: 1,
          meters: null,
        };
      },

      // /**
      //  * Run when a new GeoScale is created.
      //  * @param {Object} attrs - An object specifying configuration options
      //  * for the GeoScale. If any config option is not specified, the default will be
      //  * used instead (see {@link GeoScale#defaults}).
      //  */
      // initialize: function (attrs, options) {
      //   try {
      //     // ...
      //   } catch (e) {
      //     console.log("Error initializing a GeoScale model", e);
      //   }
      // },

      /**
       * Validate the model attributes
       * @param {Object} attrs - The model's attributes
       */
      validate: function (attrs, options) {
        if (attrs.pixel < 0) {
          return "Invalid pixel scale. Must be greater than 0.";
        }
        if (attrs.meters < 0) {
          return "Invalid meters scale. Must be greater than 0.";
        }
      },
    },
  );

  return GeoScale;
});
