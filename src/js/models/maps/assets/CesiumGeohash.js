"use strict";

define([
  "jquery",
  "underscore",
  "backbone",
  "cesium",
  "nGeohash",
  "models/maps/assets/CesiumVectorData",
], function ($, _, Backbone, Cesium, nGeohash, CesiumVectorData) {
  /**
   * @classdesc A Geohash Model represents a geohash layer in a map.
   * @classcategory Models/Maps/Assets
   * @class CesiumGeohash
   * @name CesiumGeohash
   * @extends CesiumVectorData
   * @since 2.18.0
   * @constructor
   */
  return CesiumVectorData.extend(
    /** @lends Geohash.prototype */ {
      /**
       * The name of this type of model
       * @type {string}
       */
      type: "CesiumGeohash",

      /**
       * Default attributes for Geohash models
       * @name CesiumGeohash#defaults
       * @type {Object}
       * @extends CesiumVectorData#defaults
       * @property {'CesiumGeohash'} type The format of the data. Must be
       * 'CesiumGeohash'.
       * @property {boolean} isGeohashLayer A flag to indicate that this is a
       * Geohash layer, since we change the type to CesiumVectorData. Used by
       * the Catalog Search View to find this layer so it can be connected to
       * search results.
       * @property {object} precisionAltMap Map of precision integer to
       * minimum altitude (m)
       * @property {Number} maxNumGeohashes The maximum number of geohashes
       * allowed. Set to null to remove the limit. If the given bounds +
       * altitude/level result in more geohashes than the max limit, then the
       * level will be reduced by one until the number of geohashes is under
       * the limit. This improves rendering performance, especially when the
       * map is focused on either pole, or is tilted in a "street view" like
       * perspective.
       * @property {Number} altitude The current distance from the surface of
       * the earth in meters
       * @property {Number} level The geohash level, an integer between 0 and
       * 9.
       * @property {object} bounds The current bounding box (south, west,
       * north, east) within which to render geohashes (in longitude/latitude
       * coordinates).
       * @property {string[]} counts An array of geohash strings followed by
       * their associated count. e.g. ["a", 123, "f", 8]
       * @property {Number} totalCount The total number of results that were
       * just fetched
       * @property {Number} geohashes
       */

      defaults: function () {
        return Object.assign(CesiumVectorData.prototype.defaults(), {
          type: "GeoJsonDataSource",
          label: "Geohashes",
          isGeohashLayer: true,
          precisionAltMap: {
            1: 6800000,
            2: 2400000,
            3: 550000,
            4: 120000,
            5: 7000,
            6: 0,
          },
          maxNumGeohashes: 1000,
          altitude: null,
          level: 1,
          bounds: {
            north: null,
            east: null,
            south: null,
            west: null,
          },
          counts: [],
          totalCount: 0,
          geohashes: [],
        });
      },

      /**
       * Executed when a new CesiumGeohash model is created.
       * @param {MapConfig#MapAssetConfig} [assetConfig] The initial values of
       * the attributes, which will be set on the model.
       */
      initialize: function (assetConfig) {
        try {
          this.setGeohashListeners();
          this.set("type", "GeoJsonDataSource");
          CesiumVectorData.prototype.initialize.call(this, assetConfig);
        } catch (error) {
          console.log(
            "There was an error initializing a CesiumVectorData model" +
              ". Error details: " +
              error
          );
        }
      },

      /**
       * Connect this layer to the map to get updates on the current view
       * extent (bounds) and altitude. Update the Geohashes when the altitude
       * or bounds in the model change.
       */
      setGeohashListeners: function () {
        try {
          const model = this;

          // Update the geohashes when the bounds or altitude change

          // TODO: Determine best way to set listeners, without re-creating
          // the cesium model twice when both bounds and altitude change
          // simultaneously

          // model.stopListening(model,
          //   'change:level change:bounds change:altitude change:geohashes')
          // model.listenTo(model, 'change:altitude', model.setGeohashLevel)
          // model.listenTo(model, 'change:bounds change:level', model.setGeohashes)
          // model.listenTo(model, 'change:geohashes', function () {
          //   model.createCesiumModel(true)
          // })

          // Connect this layer to the map to get current bounds and altitude
          function setMapListeners() {
            const mapModel = model.get("mapModel");
            if (!mapModel) {
              return;
            }
            // model.listenTo(
            //   mapModel,
            //   "change:currentViewExtent",
            //   function (map, newExtent) {
            //     const newAltitude = newExtent.height;
            //     delete newExtent.height;
            //     model.updateData(newAltitude, newExtent);
            //   }
            // );
          }
          setMapListeners.call(model);
          model.stopListening(model, "change:mapModel", setMapListeners);
          model.listenTo(model, "change:mapModel", setMapListeners);
        } catch (error) {
          console.log(
            "There was an error setting listeners in a CesiumGeohash" +
              ". Error details: ",
            error
          );
        }
      },

      /**
       * Given the geohashes set on the model, return as geoJSON
       * @returns {object} GeoJSON representing the geohashes with counts
       */
      toGeoJSON: function () {
        try {
          // The base GeoJSON format
          const geojson = {
            type: "FeatureCollection",
            features: [],
          };
          const geohashes = this.get("geohashes");
          if (!geohashes) {
            return geojson;
          }
          const features = [];
          // Format for geohashes:
          // { geohashID: [minlat, minlon, maxlat, maxlon] }.
          for (const [id, bb] of Object.entries(geohashes)) {
            const minlat = bb[0] <= -90 ? -89.99999 : bb[0];
            const minlon = bb[1];
            const maxlat = bb[2];
            const maxlon = bb[3];
            const feature = {
              type: "Feature",
              geometry: {
                type: "Polygon",
                coordinates: [
                  [
                    [minlon, minlat],
                    [minlon, maxlat],
                    [maxlon, maxlat],
                    [maxlon, minlat],
                    [minlon, minlat],
                  ],
                ],
              },
              properties: {
                // "count": 0, // TODO - add counts
                geohash: id,
              },
            };
            features.push(feature);
          }
          geojson["features"] = features;
          return geojson;
        } catch (error) {
          console.log(
            "There was an error converting geohashes to GeoJSON " +
              "in a CesiumGeohash model. Error details: ",
            error
          );
        }
      },

      /**
       * Creates a Cesium.DataSource model and sets it to this model's
       * 'cesiumModel' attribute. This cesiumModel contains all the
       * information required for Cesium to render the vector data. See
       * {@link https://cesium.com/learn/cesiumjs/ref-doc/DataSource.html?classFilter=DataSource}
       * @param {Boolean} [recreate = false] - Set recreate to true to force
       * the function create the Cesium Model again. Otherwise, if a cesium
       * model already exists, that is returned instead.
       */
      createCesiumModel: function (recreate = false) {
        try {
          const model = this;
          // Set the GeoJSON representing geohashes on the model
          const cesiumOptions = model.get("cesiumOptions");
          cesiumOptions["data"] = model.toGeoJSON();
          // TODO: outlines don't work when features are clamped to ground
          // cesiumOptions['clampToGround'] = true
          cesiumOptions["height"] = 0;
          model.set("cesiumOptions", cesiumOptions);
          // Create the model like a regular GeoJSON data source
          CesiumVectorData.prototype.createCesiumModel.call(this, recreate);
        } catch (error) {
          console.log(
            "There was an error creating a CesiumGeohash model" +
              ". Error details: ",
            error
          );
        }
      },

      /**
       * Reset the geohash level set on the model, given the altitude that is
       * currently set on the model.
       */
      setGeohashLevel: function () {
        try {
          const precisionAltMap = this.get("precisionAltMap");
          const altitude = this.get("altitude");
          const precision = Object.keys(precisionAltMap).find(
            (key) => altitude >= precisionAltMap[key]
          );
          this.set("level", precision);
        } catch (error) {
          console.log(
            "There was an error getting the geohash level from altitude in " +
              "a Geohash mode. Setting to level 1 by default. " +
              "Error details: " +
              error
          );
          this.set("level", 1);
        }
      },

      /**
       * Update the geohash property with geohashes for the current
       * altitude/precision and bounding box.
       */
      setGeohashes: function () {
        try {
          const bounds = this.get("bounds");
          const precision = this.get("level");
          const limit = this.get("maxNumGeohashes");

          const all_bounds = [];
          let geohashIDs = [];
          const geohashes = [];

          // Get all the geohash tiles contained in the current bounds.
          if (bounds.east < bounds.west) {
            // If the bounding box crosses the prime meridian, then we need to
            // search for geohashes on both sides. Otherwise nGeohash returns
            // 0 geohashes.
            all_bounds.push({
              north: bounds.north,
              south: bounds.south,
              east: 180,
              west: bounds.west,
            });
            all_bounds.push({
              north: bounds.north,
              south: bounds.south,
              east: bounds.east,
              west: -180,
            });
          } else {
            all_bounds.push(bounds);
          }
          all_bounds.forEach(function (bb) {
            geohashIDs = geohashIDs.concat(
              nGeohash.bboxes(bb.south, bb.west, bb.north, bb.east, precision)
            );
          });

          // When the map is centered on the poles or is zoomed in and tilted,
          // the bounds + level result in too many geohashes. Reduce the
          // number of geohashes to the model's limit by reducing the
          // precision.
          if (limit && geohashIDs.length > limit && precision > 1) {
            this.set("level", precision - 1);
            this.setGeohashes((limit = limit));
            return;
          }

          // Get the bounds for each of the geohashes
          geohashIDs.forEach(function (id) {
            geohashes[id] = nGeohash.decode_bbox(id);
          });
          this.set("geohashes", geohashes);
        } catch (error) {
          console.log(
            "There was an error getting geohashes in a Geohash model" +
              ". Error details: " +
              error
          );
        }
      },

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
    }
  );
});
