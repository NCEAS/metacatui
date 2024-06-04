"use strict";

define(["backbone", "models/maps/GeoUtilities"], function (
  Backbone,
  GeoUtilities,
) {
  // Regular expression matching a string that contains two numbers optionally separated by a comma.
  const FLOATS_REGEX = /[+-]?[0-9]*[.]?[0-9]+/g;

  // Regular expression matching everything except numbers, periods, and commas.
  const NON_LAT_LONG_CHARS_REGEX = /[^0-9,.+-\s]/g;

  /**
   * @class GeoPoint
   * @classdesc The GeoPoint model stores geographical coordinates including
   * latitude, longitude, and height in meters above sea level.
   * @classcategory Models/Maps
   * @name GeoPoint
   * @since 2.27.0
   * @extends Backbone.Model
   */
  var GeoPoint = Backbone.Model.extend(
    /** @lends GeoPoint.prototype */ {
      /**
       * The type of model this is.
       * @type {String}
       */
      type: "GeoPoint",

      /**
       * Overrides the default Backbone.Model.defaults() function to specify
       * default attributes for the GeoPoint.
       * @returns {Object} The default attributes
       * @property {number} latitude - The latitude of the point in degrees
       * @property {number} longitude - The longitude of the point in degrees
       * @property {number} height - The height of the point in meters above sea
       * level
       * @property {*} mapWidgetCoords - Optionally, Coordinates in the format
       * provided by the map widget. For example, for Cesium, this is the Cesium
       * Cartesian3 ECEF coordinates.
       */
      defaults: function () {
        return {
          latitude: null,
          longitude: null,
          height: null,
          mapWidgetCoords: null,
        };
      },

      /**
       * Parse a string according to a regular expression.
       * @param {string} value A user-entered value for parsing into a latiude
       * and longitude pair.
       * @throws An error indicating that more than two numbers have been
       * entered.
       * @returns {Object} Latitude and longitude information for creating a
       * GeoPoint.
       */
      parse(value) {
        if (typeof value !== "string") {
          return {};
        }

        const matches = value?.match(FLOATS_REGEX);
        if (
          matches?.length !== 2 ||
          isNaN(matches[0]) ||
          isNaN(matches[1]) ||
          !GeoPoint.couldBeLatLong(value)
        ) {
          throw new Error(
            "Try entering a search query with two numerical values representing a latitude and longitude (e.g. 64.84, -147.72).",
          );
        }

        return { latitude: Number(matches[0]), longitude: Number(matches[1]) };
      },

      /**
       * Get the long and lat of the point as an array
       * @returns {Array} An array in the form [longitude, latitude]
       */
      to2DArray: function () {
        return [this.get("longitude"), this.get("latitude")];
      },

      /**
       * Convert the point to a GeoJSON geometry object
       * @returns {Object} A GeoJSON geometry object with the type (Point) and
       * coordinates of the point
       */
      toGeoJsonGeometry: function () {
        return {
          type: "Point",
          coordinates: this.to2DArray(),
        };
      },

      /**
       * Convert the point to a GeoJSON feature object
       * @returns {Object} A GeoJSON feature object with the type (Feature) and
       * geometry of the point
       */
      toGeoJsonFeature: function () {
        return {
          type: "Feature",
          geometry: this.toGeoJsonGeometry(),
          properties: {},
        };
      },

      /**
       * Convert the point to a feature in a CZML document
       * @returns {Object} A CZML feature object with the type (Feature) and
       * geometry of the point.
       */
      toCZML: function () {
        const ecefCoord = this.toECEFArray();
        return {
          id: this.cid,
          point: {
            pixelSize: 10,
            show: true,
            heightReference: "CLAMP_TO_GROUND",
          },
          position: {
            cartesian: ecefCoord,
          },
        };
      },

      /**
       * Convert the point to an array of ECEF coordinates
       * @returns {Array} An array in the form [x, y, z]
       */
      toECEFArray: function () {
        return this.geodeticToECEF(this.to2DArray());
      },

      /**
       * Convert a given point to an array of ECEF coordinates
       * @param {Array} coord - An array in the form [longitude, latitude]
       * @returns {Array} An array in the form [x, y, z]
       */
      geodeticToECEF: function (coord) {
        return GeoUtilities.prototype.geodeticToECEF(coord);
      },

      /**
       * Validate the model attributes
       * @param {Object} attrs - The model's attributes
       */
      validate: function (attrs) {
        if (attrs.latitude < -90 || attrs.latitude > 90) {
          return { latitude: "Invalid latitude. Must be between -90 and 90." };
        }

        if (attrs.longitude < -180 || attrs.longitude > 180) {
          return {
            longitude: "Invalid longitude. Must be between -180 and 180.",
          };
        }

        // Assuming height is in meters and can theoretically be below sea
        // level. Adjust the height constraints as needed for your specific
        // application.
        if (typeof attrs.height !== "number") {
          return { height: "Invalid height. Must be a number." };
        }
      },
    },
    {
      /**
       * Determine whether the user could be typing a lat, long pair.
       * @param {string} value is the currently entered query string.
       * @return {boolean} Whether the current value could be a lat,long pair
       * due to the string NOT containing characters (e.g. a-z) that could not
       * be in a lat,long pair.
       */
      couldBeLatLong(value) {
        if (typeof value !== "string") {
          return false;
        }

        return value?.match(NON_LAT_LONG_CHARS_REGEX) == null;
      },
    },
  );

  return GeoPoint;
});
