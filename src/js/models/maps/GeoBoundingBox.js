"use strict";

define(["backbone"], function (Backbone) {
  /**
   * @class GeoBoundingBox
   * @classdesc The GeoBoundingBox model stores the geographical boundaries for
   * an area on the Earth's surface. It includes the northernmost, southernmost,
   * easternmost, and westernmost latitudes and longitudes, as well as an
   * optional height parameter.
   * @classcategory Models/Maps
   * @name GeoBoundingBox
   * @since 2.27.0
   * @extends Backbone.Model
   */
  var GeoBoundingBox = Backbone.Model.extend(
    /** @lends GeoBoundingBox.prototype */ {
      /**
       * The type of model this is.
       * @type {String}
       */
      type: "GeoBoundingBox",

      /**
       * Overrides the default Backbone.Model.defaults() function to specify
       * default attributes for the GeoBoundingBox.
       * @property {number|null} north The northernmost latitude of the bounding
       * box. Should be a number between -90 and 90.
       * @property {number|null} south The southernmost latitude of the bounding
       * box. Should be a number between -90 and 90.
       * @property {number|null} east The easternmost longitude of the bounding
       * box. Should be a number between -180 and 180.
       * @property {number|null} west The westernmost longitude of the bounding
       * box. Should be a number between -180 and 180.
       * @property {number|null} [height] The height of the camera above the
       * bounding box. Represented in meters above sea level. This attribute is
       * optional and can be null.
       */
      defaults: function () {
        return {
          north: null,
          south: null,
          east: null,
          west: null,
          height: null,
        };
      },

      // /**
      //  * Run when a new GeoBoundingBox is created.
      //  * @param {Object} attrs - An object specifying configuration options for
      //  * the GeoBoundingBox. If any config option is not specified, the default
      //  * will be used instead (see {@link GeoBoundingBox#defaults}).
      //  */
      // initialize: function (attrs, options) {
      //   try {
      //     // ...
      //   } catch (e) {
      //     console.log("Error initializing a GeoBoundingBox model", e);
      //   }
      // },

      /**
       * Splits the given bounding box if it crosses the prime meridian.
       * Returns one or two new GeoBoundingBox models.
       * @returns {GeoBoundingBox[]} An array of GeoBoundingBox models. One if
       * the bounding box does not cross the prime meridian, two if it does.
       */
      split: function () {
        const { north, south, east, west } = this.getCoords();
        if (east < west) {
          return [
            new GeoBoundingBox({ north, south, east: 180, west }),
            new GeoBoundingBox({ north, south, east, west: -180 }),
          ];
        } else {
          return [this.clone()];
        }
      },

      /**
       * Get the area of this bounding box in degrees.
       * @returns {Number} The area of the bounding box in degrees. Will return
       * the globe's area if the bounding box is invalid.
       */
      getArea: function () {
        if (!this.isValid()) {
          console.warn("Invalid bounding box, returning globe area");
          return 360 * 180;
        }
        const { north, south, east, west } = this.attributes;
        // Account for cases where east < west, due to the bounds crossing the
        // prime meridian
        const lonDiff = east < west ? 360 - (west - east) : east - west;
        const latDiff = north - south;
        return Math.abs(latDiff * lonDiff);
      },

      /**
       * Return the four sides of the bounding box as an array.
       * @returns {Object} An object with the northernmost, southernmost,
       * easternmost, and westernmost coordinates of the bounding box.
       */
      getCoords: function () {
        return {
          north: this.get("north"),
          south: this.get("south"),
          east: this.get("east"),
          west: this.get("west"),
        };
      },

      /**
       * Check if the bounding box covers the entire Earth.
       * @returns {Boolean} True if the bounding box covers the entire Earth,
       * false otherwise.
       */
      coversEarth: function () {
        const { north, south, east, west } = this.getCoords();
        return north >= 90 && south <= -90 && east >= 180 && west <= -180;
      },

      /**
       * Check if another bounding box is fully contained within this bounding
       * box.
       * @param {Number} n - The northernmost latitude of the bounding box.
       * @param {Number} e - The easternmost longitude of the bounding box.
       * @param {Number} s - The southernmost latitude of the bounding box.
       * @param {Number} w - The westernmost longitude of the bounding box.
       * @returns {Boolean} True if the other bounding box is fully contained
       * within this bounding box, false otherwise.
       */
      boundsAreFullyContained: function (n, e, s, w) {
        const { north, south, east, west } = this.getCoords();
        return s >= south && w >= west && n <= north && e <= east;
      },

      /**
       * Check if another bounding box is fully outside of this bounding box.
       * @param {Number} n - The northernmost latitude of the bounding box.
       * @param {Number} e - The easternmost longitude of the bounding box.
       * @param {Number} s - The southernmost latitude of the bounding box.
       * @param {Number} w - The westernmost longitude of the bounding box.
       * @returns {Boolean} True if the other bounding box is fully outside this
       * bounding box, false otherwise.
       */
      boundsAreFullyOutside: function (n, e, s, w) {
        const { north, south, east, west } = this.getCoords();
        return n < south || s > north || e < west || w > east;
      },

      /**
       * Validate the model attributes
       * @param {Object} attrs - The model's attributes
       */
      validate: function (attrs, options) {
        const bounds = attrs;
        const isValid =
          bounds &&
          typeof bounds.north === "number" &&
          typeof bounds.south === "number" &&
          typeof bounds.east === "number" &&
          typeof bounds.west === "number" &&
          bounds.north <= 90 &&
          bounds.north >= -90 &&
          bounds.south >= -90 &&
          bounds.south <= 90 &&
          bounds.east <= 180 &&
          bounds.east >= -180 &&
          bounds.west >= -180 &&
          bounds.west <= 180;
        if (!isValid) {
          return (
            "Bounds must include a number between -90 and 90 for north " +
            "and south, and between -180 and 180 for east and west."
          );
        }
      },
    },
  );

  return GeoBoundingBox;
});
