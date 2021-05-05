/* global define */
define(
  ['jquery', 'underscore', 'backbone', 'nGeohash'],
  function ($, _, Backbone, nGeohash) {
    "use strict";

    /**
     * @class CesiumModel
     * @classdesc  The Map Model represents all of the settings and options for a Cesium
     * Map.
     * @classcategory Models/Maps
     * @name CesiumModel
     * @since 2.x.x
     * @extends Backbone.Model
     */
    var CesiumModel = Backbone.Model.extend(
      /** @lends CesiumModel.prototype */ {


        /**
         * Coordinates that describe a camera position for Cesium
         * @typedef {Object} CameraPosition
         * @property {number} longitude - Longitude of the central home point
         * @property {number} latitude - Latitude of the central home point
         * @property {number} height - Height above sea level (meters)
         * @property {number} heading -  The rotation about the negative z axis (degrees)
         * @property {number} pitch - The rotation about the negative y axis (degrees)
         * @property {number} roll - The rotation about the positive x axis (degrees)
         */

        /**
         * Overrides the default Backbone.Model.defaults() function to
         * specify default attributes for the CesiumModel
         * @name CesiumModel#defaults
         * @type {Object}
         * @property {CameraPosition} homePosition - The position to display when the map
         * initially renders. The home button will also navigate back to this position.
        */
        defaults: function () {
          return {
            homePosition: {
              longitude: -75,
              latitude: 56,
              height: 15000000,
              heading: 5,
              pitch: -90,
              roll: 0,
            },
          };
        },

        /**
         * initialize - Run when a new CesiumModel is created
         */
        initialize: function (attrs, options) {
          
        },

        /**
         * This function will return the appropriate geohash level to use for mapping
         * geohash tiles on the map at the specified altitude (zoom level).
         * @param {Number} altitude The distance from the surface of the earth in meters
         * @returns The geohash level, an integer between 0 and 9.
         */
        determineGeohashLevel: function (altitude) {
          try {
            // map of precision integer to minimum altitude
            const precisionAltMap = {
              "1": 6000000,
              "2": 4000000,
              "3": 1000000,
              "4": 100000,
              "5": 0
            }
            const precision = _.findKey(precisionAltMap, function (minAltitude) {
              return altitude >= minAltitude
            })
            return Number(precision)
          }
          catch (error) {
            console.log(
              'There was an error getting the geohash level from altitude in a CesiumModel' +
              'Returning level 1 by default. ' +
              '. Error details: ' + error
            );
            return 1
          }
        },

        /**
         *
         * @param {Number} south The south-most coordinate of the area to get geohashes for
         * @param {Number} west The west-most coordinate of the area to get geohashes for
         * @param {Number} north The north-most coordinate of the area to get geohashes for
         * @param {Number} east The east-most coordinate of the area to get geohashes for
         * @param {Number} precision An integer between 1 and 9 representing the geohash
         * @param {Boolean} boundingBoxes Set to true to return the bounding box for each geohash
         * level to show
         */
        getGeohashes: function (south, west, north, east, precision, boundingBoxes = false) {
          try {
            // Get all the geohash tiles contained in the map bounds
            var geohashes = nGeohash.bboxes(
              south, west, north, east, precision
            )
            // If the boundingBoxes option is set to false, then just return the list of
            // geohashes
            if (!boundingBoxes) {
              return geohashes
            }
            // Otherwise, return the bounding box for each geohash as well
            var boundingBoxes = []
            geohashes.forEach(function (geohash) {
              boundingBoxes[geohash] = nGeohash.decode_bbox(geohash)
            })
            return boundingBoxes
          }
          catch (error) {
            console.log(
              'There was an error getting geohashes in a CesiumModel' +
              '. Error details: ' + error
            );
          }
        },


      });

    return CesiumModel;
  });
