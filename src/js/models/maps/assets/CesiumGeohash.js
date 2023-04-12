"use strict";

define([
  "jquery",
  "underscore",
  "backbone",
  "cesium",
  "models/maps/assets/CesiumVectorData",
  "models/maps/AssetColorPalette",
  "models/maps/AssetColor",
  "models/maps/Geohash",
  "collections/maps/Geohashes",
], function (
  $,
  _,
  Backbone,
  Cesium,
  CesiumVectorData,
  AssetColorPalette,
  AssetColor,
  Geohash,
  Geohashes
) {
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
       * @property {'CesiumGeohash'} type The format of the data.
       * @property {string} label The label for the layer.
       * @property {Geohashes} geohashes The collection of geohashes to display
       * on the map.
       * @property {number} opacity The opacity of the layer.
       */
      defaults: function () {
        return Object.assign(CesiumVectorData.prototype.defaults(), {
          type: "GeoJsonDataSource",
          label: "Geohashes",
          geohashes: new Geohashes(),
          opacity: 0.8,
          colorPalette: new AssetColorPalette({
            paletteType: "continuous",
            property: "count",
            colors: [
              {
                value: 0,
                color: "#FFFFFF00"
              },
              {
                value: 1,
                color: "#1BFAC44C"
              },
              {
                value: "max",
                color: "#1BFA8FFF"
              },
            ],
          }),
          outlineColor: new AssetColor({
            color: "#DFFAFAED",
          })
        });
      },

      /**
       * Get the property that we want the geohashes to display, e.g. count.
       * @returns {string} The property of interest.
       */
      getPropertyOfInterest: function () {
        return this.get("colorPalette")?.get("property");
      },

      /**
       * For the property of interest (e.g. count) Get the min and max values
       * from the geohashes collection and update the color palette. These 
       */
      updateColorRangeValues: function () {
        const colorPalette = this.get("colorPalette");
        const geohashes = this.get("geohashes");
        if (!geohashes || !colorPalette) {
          return;
        }
        const vals = geohashes.getAttr(this.getPropertyOfInterest());
        if (!vals || vals.length === 0) {
          return;
        }
        colorPalette.set("minVal", Math.min(...vals));
        colorPalette.set("maxVal", Math.max(...vals));
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
       * Get the associated precision level for the current camera height.
       * Required that a mapModel be set on the model. If one is not set, then
       * the minimum precision from the geohash collection will be returned.
       * @returns {number} The precision level.
       */
      getPrecision: function () {
        try {
          const height = this.get("mapModel").get("currentViewExtent").height;
          return this.get("geohashes").heightToPrecision(height);
        } catch (e) {
          const precisions = this.get("geohashes").getPrecisions();
          return Math.min(...precisions);
        }
      },

      /**
       * Replace the collection of geohashes to display on the map with a new
       * set.
       * @param {Geohash[]|Object[]} geohashes The new set of geohash models to
       * display or attributes for the new geohash models.
       */
      replaceGeohashes: function (geohashes) {
        this.get("geohashes").reset(geohashes);
      },

      /**
       * Stop the model from listening to itself for changes.
       */
      stopListeners: function () {
        this.stopListening(this.get("geohashes"), "add remove update reset");
      },

      /**
       * Update and re-render the geohashes when the collection of geohashes
       * changes.
       */
      startListening: function () {
        try {
          this.stopListeners();
          this.listenTo(
            this.get("geohashes"),
            "add remove update reset",
            function () {
              this.updateColorRangeValues();
              this.createCesiumModel(true);
            }
          );
        } catch (error) {
          console.log("Failed to set listeners in CesiumGeohash", error);
        }
      },

      /**
       * Returns the GeoJSON representation of the geohashes.
       * @param {Boolean} [limitToExtent = true] - Set to false to return the
       * GeoJSON for all geohashes, not just those in the current extent.
       * @returns {Object} The GeoJSON representation of the geohashes.
       */
      getGeoJSON: function (limitToExtent = true) {
        if (!limitToExtent) {
          return this.get("geohashes")?.toGeoJSON();
        }
        const extent = this.get("mapModel").get("currentViewExtent");
        let bounds = Object.assign({}, extent);
        delete bounds.height;
        const subset = this.get("geohashes")?.getSubsetByBounds(bounds);
        return subset?.toGeoJSON();
      },

      /**
       * Creates a Cesium.DataSource model and sets it to this model's
       * 'cesiumModel' attribute. This cesiumModel contains all the information
       * required for Cesium to render the vector data. See
       * {@link https://cesium.com/learn/cesiumjs/ref-doc/DataSource.html?classFilter=DataSource}
       * @param {Boolean} [recreate = false] - Set recreate to true to force the
       * function create the Cesium Model again. Otherwise, if a cesium model
       * already exists, that is returned instead.
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
          cesiumOptions["data"] = this.getGeoJSON();
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

// TODO: consider adding this back in to optionally limit the number of
// geohashes const limit = this.get("maxGeohashes"); if (limit &&
// hashStrings.length > limit && level > 1) { while (hashStrings.length > limit
// && level > 1) { level--; hashStrings = this.getHashStringsByExtent(bounds,
// level);
//   }
// }
