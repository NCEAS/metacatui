'use strict';

define(
  [
    'jquery',
    'underscore',
    'backbone',
    'nGeohash',
    'models/maps/assets/MapAsset',
  ],
  function (
    $,
    _,
    Backbone,
    nGeohash,
    MapAsset
  ) {
    /**
     * @classdesc A Geohash Model represents a geohash layer in a map. NOTE: This is a WIP
     * and not yet supported.
     * @classcategory Models/Maps/Assets
     * @class Geohash
     * @name Geohash
     * @extends MapAsset
     * @since 2.x.x
     * @constructor
    */
    var Geohash = MapAsset.extend(
      /** @lends Geohash.prototype */ {

        /**
         * The name of this type of model
         * @type {string}
        */
        type: 'Geohash',

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
              '1': 6000000,
              '2': 4000000,
              '3': 1000000,
              '4': 100000,
              '5': 0
            }
            const precision = _.findKey(precisionAltMap, function (minAltitude) {
              return altitude >= minAltitude
            })
            return Number(precision)
          }
          catch (error) {
            console.log(
              'There was an error getting the geohash level from altitude in a Geohash ' +
              'Returning level 1 by default. ' +
              'model. Error details: ' + error
            );
            return 1
          }
        },

        /**
         *
         * @param {Number} south The south-most coordinate of the area to get geohashes
         * for
         * @param {Number} west The west-most coordinate of the area to get geohashes for
         * @param {Number} north The north-most coordinate of the area to get geohashes
         * for
         * @param {Number} east The east-most coordinate of the area to get geohashes for
         * @param {Number} precision An integer between 1 and 9 representing the geohash
         * @param {Boolean} boundingBoxes Set to true to return the bounding box for each
         * geohash level to show
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
              'There was an error getting geohashes in a Geohash model' +
              '. Error details: ' + error
            );
          }
        },

        // /**
        //  * Default attributes for Geohash models
        //  * @name Geohash#defaults
        //  * @type {Object}
        //  * @property {TODO} propertyName property description TODO
        //    */
        // defaults: function () {return {

        //   }
        // },

        // /**
        //  * Executed when a new Geohash model is created.
        //  * @param {Object} [attributes] The initial values of the attributes, which
        //    will
        //  * be set on the model.
        //  * @param {Object} [options] Options for the initialize function.
        //    */
        // initialize: function (attributes, options) {try {

        //   }
        //   catch (error) {console.log('There was an error initializing a Geohash model'
        //     + '. Error details: ' + error
        //     );
        //   }
        // },

        // /**
        //  * Parses the given input into a JSON object to be set on the model.
        //  *
        //  * @param {TODO} input - The raw response object
        //  * @return {TODO} - The JSON object of all the Geohash attributes
        //    */
        // parse: function (input) {

        //   try {

        //     var modelJSON = {};

        //     return modelJSON

        //   }
        //   catch (error) {console.log('There was an error parsing a Geohash model' + '.
        //     Error details: ' + error
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
        //    */
        // validate: function (attrs, options) {try {

        //   }
        //   catch (error) {console.log('There was an error validating a Geohash model' +
        //     '. Error details: ' + error
        //     );
        //   }
        // },

        // /**
        //  * Creates a string using the values set on this model's attributes.
        //  * @return {string} The Geohash string
        //    */
        // serialize: function () {try {var serializedGeohash = '';

        //     return serializedGeohash;
        //   }
        //   catch (error) {console.log('There was an error serializing a Geohash model' +
        //     '. Error details: ' + error
        //     );
        //   }
        // },

      });

    return Geohash;

  }
);
