"use strict";

define(["backbone"], function (Backbone) {
  /**
   * @class GeoUtilities
   * @classdesc The GeoUtilities model has methods foe handling spatial data
   * that are used across multiple models/collections/views, and that don't
   * belong in any one of them.
   * @classcategory Models/Maps
   * @name GeoUtilities
   * @since 2.27.0
   * @extends Backbone.Model
   */
  var GeoUtilities = Backbone.Model.extend(
    /** @lends GeoUtilities.prototype */ {
      /**
       * The type of model this is.
       * @type {String}
       */
      type: "GeoUtilities",

      /**
       * Convert geodetic coordinates to Earth-Centered, Earth-Fixed (ECEF)
       * coordinates. Currently this function assumes the WGS-84 ellipsoid,
       * and does not account for altitude/height (it's assumed the coordinate
       * is at sea level)
       * @param {Array} coord The geodetic coordinates in the form [longitude,
       * latitude].
       * @returns {Array} The ECEF coordinates.
       */
      geodeticToECEF: function (coord) {
        const a = 6378137; // WGS-84 semi-major axis (meters)
        const f = 1 / 298.257223563; // WGS-84 flattening
        const e2 = 2 * f - f * f; // Square of eccentricity

        const lon = coord[0] * (Math.PI / 180); // Convert longitude to radians
        const lat = coord[1] * (Math.PI / 180); // Convert latitude to radians
        const alt = 10000;
        const sinLon = Math.sin(lon);
        const cosLon = Math.cos(lon);
        const sinLat = Math.sin(lat);
        const cosLat = Math.cos(lat);

        const N = a / Math.sqrt(1 - e2 * sinLat * sinLat); // Prime vertical radius of curvature
        const x = (N + alt) * cosLat * cosLon;
        const y = (N + alt) * cosLat * sinLon;
        const z = (N * (1 - e2) + alt) * sinLat;

        return [x, y, z];
      },
    }
  );

  return GeoUtilities;
});
