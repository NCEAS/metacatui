"use strict";

define([
  "jquery",
  "underscore",
  "backbone",
  "cesium",
  "models/maps/assets/CesiumVectorData",
  "models/maps/Geohash",
  "collections/maps/Geohashes"

], function ($, _, Backbone, Cesium, CesiumVectorData, Geohash, Geohashes) {
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
       * // TODO
       */

      defaults: function () {
        return Object.assign(CesiumVectorData.prototype.defaults(), {
          type: "GeoJsonDataSource",
          label: "Geohashes",
          geohashes: new Geohashes(),
          opacity: 0.5,
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

      getLevels: function () {
        return this.get("geohashes").getLevels();
      },

      resetGeohashes: function (geohashes) {
        this.get("geohashes").reset(geohashes);
      },

      /**
       * Stop the model from listening to itself for changes in the counts or
       * geohashes.
       */
      stopListeners: function () {
        this.stopListening(this, "change:geohashes");
        this.stopListening(this.get("geohashes"), "change");
      },

      /**
       * Update and re-render the geohashes when the counts change.
       */
      startListening: function () {
        try {
          this.stopListeners();
          this.listenTo(this, "change:geohashes", function () {
            this.stopListeners();
            this.startListening();
            this.createCesiumModel(true);
          });
          this.listenTo(this.get("geohashes"), "change", function () {
            this.createCesiumModel(true);
          });
          this.listenTo(this.get("mapModel"), "change:currentExtent", function () {
            this.createCesiumModel(true);
          });
        } catch (error) {
          console.log("Failed to set listeners in CesiumGeohash", error);
        }
      },

      /**
       * Returns the GeoJSON representation of the geohashes.
       * @param {Boolean} [limitToExtent = true] - Set to false to return
       * the GeoJSON for all geohashes, not just those in the current extent.
       * @returns {Object} The GeoJSON representation of the geohashes.
       */
      getGeoJson: function (limitToExtent = true) {
        if (!limitToExtent) {
          return this.get("geohashes")?.toGeoJSON();
        }
        const extent = this.get("mapModel").get("currentExtent");
        // copy it and delete the height attr
        const bounds = Object.assign({}, extent);
        delete bounds.height;
        return this.get("geohashes")?.getSubsetByBounds(bounds)?.toGeoJSON()
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
          // If there is no map model, wait for it to be set so that we can
          // limit the geohashes to the current extent. Otherwise, too many
          // geohashes will be rendered.
          if (!model.get("mapModel")) {
            model.listenToOnce(model, "change:mapModel", function () {
              model.createCesiumModel(recreate);
            });
            return;
          }
          // Set the GeoJSON representing geohashes on the model
          const cesiumOptions = model.get("cesiumOptions");
          cesiumOptions["data"] = this.getGeoJson();
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
