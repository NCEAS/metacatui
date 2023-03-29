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
       * The name of this type of model. This will be updated to
       * 'CesiumVectorData' upon initialization.
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
       * @property {string[]} counts An array of geohash strings followed by
       * their associated count. e.g. ["a", 123, "f", 8]
       * @property {Number} totalCount The total number of results that were
       * just fetched
       * @property {string[]} geohashIDs An array of geohash strings
       * @property {} geohashes
       */

      defaults: function () {
        return Object.assign(CesiumVectorData.prototype.defaults(), {
          type: "GeoJsonDataSource",
          label: "Geohashes",
          isGeohashLayer: true,
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
          this.set("type", "GeoJsonDataSource");
          this.startListening();
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
       * Stop the model from listening to itself for changes in the counts or
       * geohashes.
       */
      stopListeners: function () {
        this.stopListening(this, "change:counts");
        this.stopListening(this, "change:geohashes");
      },

      /**
       * Update and re-render the geohashes when the counts change.
       */
      startListening: function () {
        try {
          this.stopListeners();
          this.listenTo(this, "change:counts", this.updateGeohashes);
          this.listenTo(this, "change:geohashes", function () {
            this.createCesiumModel(true);
          });
        } catch (error) {
          console.log("Failed to set listeners in CesiumGeohash", error);
        }
      },

      /**
       * Get the counts currently set on this model and create the geohash array
       * [{ counts, id, bounds}]. Set this array on the model, which will
       * trigger the cesiumModel to re-render.
       */
      updateGeohashes: function () {
        try {
          // Counts are formatted as [geohash, count, geohash, count, ...]
          const counts = this.get("counts");
          const geohashes = [];
          for (let i = 0; i < counts.length; i += 2) {
            const id = counts[i];
            geohashes.append({
              id: id,
              count: counts[i + 1],
              bounds: nGeohash.decode_bbox(id),
            });
          }
          this.set("geohashes", geohashes);
        } catch (error) {
          console.log("Failed to update geohashes in CesiumGeohash", error);
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
    }
  );
});
