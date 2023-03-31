"use strict";

define(["jquery", "underscore", "backbone", "nGeohash"], function (
  $,
  _,
  Backbone,
  nGeohash
) {
  /**
   * @classdesc A Geohash Model represents a single geohash.
   * @classcategory Models/Geohashes
   * @class Geohash
   * @name Geohash
   * @extends Backbone.Model
   * @since x.x.x
   * @constructor
   */
  var Geohash = Backbone.Model.extend(
    /** @lends Geohash.prototype */ {
      /**
       * The name of this type of model
       * @type {string}
       */
      type: "Geohash",

      /**
       * Default attributes for Geohash models
       * @name Geohash#defaults
       * @type {Object}
       * @property {string} geohash The geohash value/ID.
       * @property {Object} [properties] An object containing arbitrary
       * properties associated with the geohash. (e.g. count values from
       * SolrResults)
       */
      defaults: function () {
        return {
          geohash: "",
          properties: {},
        };
      },

      /**
       * Checks if the geohash is empty. it is empty if it has no ID set.
       * @returns {boolean} True if the geohash is empty, false otherwise.
       */
      isEmpty: function () {
        const geohash = this.get("geohash");
        return !geohash || geohash.length === 0;
      },

      /**
       * Get the bounds of the geohash "tile".
       * @returns {Array} An array containing the bounds of the geohash.
       */
      getBounds: function () {
        if (this.isEmpty()) return null;
        return nGeohash.decode_bbox(this.get("geohash"));
      },

      /**
       * Get the center point of the geohash.
       * @returns {Array} An array containing the center point of the geohash.
       * The first element is the longitude, the second is the latitude.
       */
      getPoint: function () {
        if (this.isEmpty()) return null;
        return nGeohash.decode(this.get("geohash"));
      },

      /**
       * Get the level of the geohash.
       * @returns {number} The level of the geohash.
       */
      getLevel: function () {
        if (this.isEmpty()) return null;
        return this.get("geohash").length;
      },

      /**
       * Get the geohash as a GeoJSON Feature.
       * @returns {Object} A GeoJSON Feature representing the geohash.
       */
      toGeoJSON: function () {
        const bounds = this.getBounds();
        if (!bounds) return null;
        return {
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [bounds[0], bounds[1]],
                [bounds[2], bounds[1]],
                [bounds[2], bounds[3]],
                [bounds[0], bounds[3]],
                [bounds[0], bounds[1]],
              ],
            ],
          },
          properties: this.get("properties"),
        };
      }
    }
  );

  return Geohash;
});
