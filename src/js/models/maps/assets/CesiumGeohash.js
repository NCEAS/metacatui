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
       * @property {AssetColorPalette} colorPalette The color palette for the
       * layer.
       * @property {AssetColor} outlineColor The outline color for the layer.
       * @property {AssetColor} highlightColor The color to use for features
       * that are selected/highlighted.
       * @property {boolean} showLabels Whether to show labels for the layer.
       * @property {number} maxGeoHashes The maximum number of geohashes to
       * render at a time for performance reasons. If the number of geohashes
       * exceeds this number, then the precision will be decreased until the
       * number of geohashes is less than or equal to this number.
       */
      defaults: function () {
        return Object.assign(CesiumVectorData.prototype.defaults(), {
          type: "CZMLDataSource",
          label: "Geohashes",
          geohashes: new Geohashes(),
          opacity: 0.8,
          colorPalette: new AssetColorPalette({
            paletteType: "continuous",
            property: "count",
            colors: [
              {
                value: 0,
                color: "#FFFFFF00",
              },
              {
                value: 1,
                color: "#1BFAC44C",
              },
              {
                value: "max",
                color: "#1BFA8FFF",
              },
            ],
          }),
          outlineColor: new AssetColor({
            color: "#DFFAFAED",
          }),
          highlightColor: new AssetColor({
            color: "#f3e227",
          }),
          showLabels: true,
          maxGeoHashes: 900,
        });
      },

      /**
       * Executed when a new CesiumGeohash model is created.
       * @param {MapConfig#MapAssetConfig} [assetConfig] The initial values of
       * the attributes, which will be set on the model.
       */
      initialize: function (assetConfig) {
        try {
          if (this.get("showLabels")) {
            this.set("type", "CzmlDataSource");
          } else {
            this.set("type", "GeoJsonDataSource");
          }
          this.startListening();
          CesiumVectorData.prototype.initialize.call(this, assetConfig);
        } catch (error) {
          console.log("Error initializing a CesiumVectorData model", error);
        }
      },

      /**
       * Get the property that we want the geohashes to display, e.g. count.
       * @returns {string} The property of interest.
       * @since 2.25.0
       */
      getPropertyOfInterest: function () {
        return this.get("colorPalette")?.get("property");
      },

      /**
       * For the property of interest (e.g. count) Get the min and max values
       * from the geohashes collection and update the color palette.
       * @since 2.25.0
       * 
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
       * Get the associated precision level for the current camera height.
       * Required that a mapModel be set on the model. If one is not set, then
       * the minimum precision from the geohash collection will be returned.
       * @returns {number} The precision level.
       * @since 2.25.0
       */
      getPrecision: function () {
        const limit = this.get("maxGeoHashes");
        const geohashes = this.get("geohashes")
        const bounds = this.get("mapModel").get("currentViewExtent");
        const area = geohashes.getBoundingBoxArea(bounds);
        return this.get("geohashes").getMaxPrecision(area, limit);
      },

      /**
       * Replace the collection of geohashes to display on the map with a new
       * set.
       * @param {Geohash[]|Object[]} geohashes The new set of geohash models to
       * display or attributes for the new geohash models.
       * @since 2.25.0
       */
      replaceGeohashes: function (geohashes) {
        this.get("geohashes").reset(geohashes);
      },

      /**
       * Stop the model from listening to itself for changes.
       * @since 2.25.0
       */
      stopListeners: function () {
        this.stopListening(this.get("geohashes"), "add remove update reset");
      },

      /**
       * Update and re-render the geohashes when the collection of geohashes
       * changes.
       * @since 2.25.0
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
       * Get the geohash collection and optionally reduce it to only those
       * geohashes that are within the current map extent, and to no more than
       * the specified amount.
       * @param {boolean} [limitToExtent=true] Whether to limit the geohashes
       * to those that are within the current map extent.
       * @returns {Geohashes} The geohashes to display.
       */
      getGeohashes: function(limitToExtent = true) {
        let geohashes = this.get("geohashes");
        if (limitToExtent) {
          geohashes = this.getGeohashesForExtent();
        }
        return geohashes;
      },

      /**
       * Get the geohashes that are currently in the map's extent.
       * @returns {Geohashes} The geohashes in the current extent.
       * @since 2.25.0
       */
      getGeohashesForExtent: function () {
        const extent = this.get("mapModel")?.get("currentViewExtent");
        const bounds = Object.assign({}, extent);
        delete bounds.height;
        return this.get("geohashes")?.getSubsetByBounds(bounds);
      },

      /**
       * Returns the GeoJSON representation of the geohashes.
       * @param {Boolean} [limitToExtent = true] - Set to false to return the
       * GeoJSON for all geohashes, not just those in the current extent.
       * @returns {Object} The GeoJSON representation of the geohashes.
       * @since 2.25.0
       */
      getGeoJSON: function (limitToExtent = true) {
        const geohashes = this.getGeohashes(limitToExtent);
        return geohashes.toGeoJSON();
      },

      /**
       * Returns the CZML representation of the geohashes.
       * @param {Boolean} [limitToExtent = true] - Set to false to return the
       * CZML for all geohashes, not just those in the current extent.
       * @returns {Object} The CZML representation of the geohashes.
       * @since 2.25.0
       */
      getCZML: function (limitToExtent = true) {
        const geohashes = this.getGeohashes(limitToExtent);
        const label = this.getPropertyOfInterest();
        return geohashes.toCZML(label);
      },

      /**
       * Create the Cesium model for the geohashes.
       * @param {Boolean} [recreate = false] - Set to true to recreate the
       * Cesium model.
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
          const type = model.get("type");
          const data = type === "geojson" ? this.getGeoJSON() : this.getCZML();
          cesiumOptions["data"] = data;
          cesiumOptions["height"] = 0;
          model.set("cesiumOptions", cesiumOptions);
          // Create the model like a regular GeoJSON data source
          CesiumVectorData.prototype.createCesiumModel.call(this, recreate);
        } catch (e) {
          console.log("Error creating a CesiumGeohash model. ", e);
        }
      },

      /**
       * Find the geohash Entity on the map and add it to the selected
       * features.
       * @param {string} geohash The geohash to select.
       * @since 2.25.0
       */
      selectGeohashes: function (geohashes) {
        const toSelect = [...new Set(geohashes.map((geohash) => {
          const parent = this.get("geohashes").getContainingGeohash(geohash);
          return parent?.get("hashString");
        }, this))];
        const entities = this.get("cesiumModel").entities.values;
        const selected = entities.filter((entity) => {
          const hashString = this.getPropertiesFromFeature(entity).hashString;
          return toSelect.includes(hashString);
        });
        const featureAttrs = selected.map((feature) => {
          return this.getFeatureAttributes(feature);
        });
        this.get("mapModel").selectFeatures(featureAttrs);
      },
    }
  );
});
