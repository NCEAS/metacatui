"use strict";

define([
  "jquery",
  "underscore",
  "backbone",
  "collections/maps/Features",
  "models/maps/Feature",
  "collections/maps/MapAssets",
], function ($, _, Backbone, Features, Feature, MapAssets) {
  /**
   * @class MapModel
   * @classdesc The Map Model contains all of the settings and options for a
   * required to render a map view.
   * @classcategory Models/Maps
   * @name MapModel
   * @since 2.18.0
   * @extends Backbone.Model
   */
  var MapModel = Backbone.Model.extend(
    /** @lends MapModel.prototype */ {
      /**
       * Configuration options for a {@link MapModel} that control the
       * appearance of the map, the data/imagery displayed, and which UI
       * components are rendered. A MapConfig object can be used when
       * initializing a Map model, e.g. `new Map(myMapConfig)`
       * @namespace {Object} MapConfig
       * @property {MapConfig#CameraPosition} [homePosition] - A set of
       * coordinates that give the (3D) starting point of the Viewer. This
       * position is also where the "home" button in the Cesium widget will
       * navigate to when clicked.
       * @property {MapConfig#MapAssetConfig[]} [layers] - A collection of
       * imagery, tiles, vector data, etc. to display on the map. Layers wil be
       * displayed in the order they appear. The array of the layer
       * MapAssetConfigs are passed to a {@link MapAssets} collection.
       * @property {MapConfig#MapAssetConfig[]} [terrains] - Configuration for
       * one or more digital elevation models (DEM) for the surface of the
       * earth. Note: Though multiple terrains are supported, currently only the
       * first terrain is used in the CesiumWidgetView and there is not yet a UI
       * for switching terrains in the map. The array of the terrain
       * MapAssetConfigs are passed to a {@link MapAssets} collection.
       * @property {Boolean} [showToolbar=true] - Whether or not to show the
       * side bar with layer list, etc. If true, the {@link MapView} will render
       * a {@link ToolbarView}.
       * @property {Boolean} [toolbarOpen=false] - Whether or not the toolbar is
       * open when the map is initialized. Set to false by default, so that the
       * toolbar is hidden by default.
       * @property {Boolean} [showScaleBar=true] - Whether or not to show a
       * scale bar. If true, the {@link MapView} will render a
       * {@link ScaleBarView}.
       * @property {Boolean} [showFeatureInfo=true] - Whether or not to allow
       * users to click on map features to show more information about them. If
       * true, the {@link MapView} will render a {@link FeatureInfoView} and
       * will initialize "picking" in the {@link CesiumWidgetView}.
       *
       * @example
       * {
       *   "homePosition": {
       *     "latitude": 74.23,
       *     "longitude": -105.7
       *   },
       *   "layers": [
       *     {
       *       "label": "My 3D Tile layer",
       *       "type": "Cesium3DTileset",
       *       "description": "This is an example 3D tileset. This description will be visible in the LayerDetailsView. It will be the default color, since to colorPalette is specified.",
       *       "cesiumOptions": {
       *         "ionAssetId": "555"
       *       },
       *     }
       *   ],
       *   "terrains": [
       *     {
       *       "label": "Arctic DEM",
       *       "type": "CesiumTerrainProvider",
       *       "cesiumOptions": {
       *         "ionAssetId": "3956",
       *         "requestVertexNormals": true
       *       }
       *     }
       *   ],
       *   "showToolbar": true,
       *   "showScaleBar": false,
       *   "showFeatureInfo": false
       * }
       */

      /**
       * Coordinates that describe a camera position for Cesium. Requires at
       * least a longitude and latitude.
       * @typedef {Object} MapConfig#CameraPosition
       * @property {number} longitude - Longitude of the central home point
       * @property {number} latitude - Latitude of the central home point
       * @property {number} [height] - Height above sea level (meters)
       * @property {number} [heading] -  The rotation about the negative z axis
       * (degrees)
       * @property {number} [pitch] - The rotation about the negative y axis
       * (degrees)
       * @property {number} [roll] - The rotation about the positive x axis
       * (degrees)
       *
       * @example
       * {
       *  longitude: -119.8489,
       *  latitude: 34.4140
       * }
       *
       * @example
       * {
       *  longitude: -65,
       *  latitude: 56,
       *  height: 10000000,
       *  heading: 1,
       *  pitch: -90,
       *  roll: 0
       * }
       */

      /**
       * Overrides the default Backbone.Model.defaults() function to specify
       * default attributes for the Map
       * @name MapModel#defaults
       * @type {Object}
       * @property {MapConfig#CameraPosition} [homePosition={longitude: -65,
       * latitude: 56, height: 10000000, heading: 1, pitch: -90, roll: 0}] A set
       * of coordinates that give the (3D) starting point of the Viewer. This
       * position is also where the "home" button in the Cesium viewer will
       * navigate to when clicked.
       * @property {MapAssets} [terrains = new MapAssets()] - The terrain
       * options to show in the map.
       * @property {MapAssets} [layers = new MapAssets()] - The imagery and
       * vector data to render in the map.
       * @property {Features} [selectedFeatures = new Features()] - Particular
       * features from one or more layers that are highlighted/selected on the
       * map. The 'selectedFeatures' attribute is updated by the map widget
       * (cesium) with a Feature model when a user selects a geographical
       * feature on the map (e.g. by clicking)
       * @property {Boolean} [showToolbar=true] - Whether or not to show the
       * side bar with layer list, etc. True by default.
       * @property {Boolean} [toolbarOpen=false] - Whether or not the toolbar is
       * open when the map is initialized. Set to false by default, so that the
       * toolbar is hidden by default.
       * @property {Boolean} [showScaleBar=true] - Whether or not to show a
       * scale bar.
       * @property {Boolean} [showFeatureInfo=true] - Whether or not to allow
       * users to click on map features to show more information about them.
       * @property {Object} [currentPosition={ longitude: null, latitude: null,
       * height: null}] An object updated by the map widget to show the
       * longitude, latitude, and height (elevation) at the position of the
       * mouse on the map. Note: The CesiumWidgetView does not yet update the
       * height property.
       * @property {Object} [currentScale={ meters: null, pixels: null }] An
       * object updated by the map widget that gives two equivalent measurements
       * based on the map's current position and zoom level: The number of
       * pixels on the screen that equal the number of meters on the map/globe.
       * @property {Object} [currentViewExtent={ north: null, east: null, south:
       * null, west: null }] An object updated by the map widget that gives the
       * extent of the current visible area as a bounding box in
       * longitude/latitude coordinates, as well as the height/altitude in
       * meters.
       * @property {String} [clickFeatureAction="showDetails"] - The default
       * action to take when a user clicks on a feature on the map. The
       * available options are "showDetails" (show the feature details in the
       * sidebar) or "zoom" (zoom to the feature's location).
       */
      defaults: function () {
        return {
          homePosition: {
            longitude: -65,
            latitude: 56,
            height: 10000000,
            heading: 1,
            pitch: -90,
            roll: 0,
          },
          layers: new MapAssets([
            {
              type: "NaturalEarthII",
              label: "Base layer",
            },
          ]),
          terrains: new MapAssets(),
          selectedFeatures: new Features(),
          showToolbar: true,
          toolbarOpen: false,
          showScaleBar: true,
          showFeatureInfo: true,
          currentPosition: {
            longitude: null,
            latitude: null,
            height: null,
          },
          currentScale: {
            meters: null,
            pixels: null,
          },
          currentViewExtent: {
            north: null,
            east: null,
            south: null,
            west: null,
            height: null,
          },
          clickFeatureAction: "showDetails",
        };
      },

      /**
       * Run when a new Map is created.
       * @param {MapConfig} config - An object specifying configuration options
       * for the map. If any config option is not specified, the default will be
       * used instead (see {@link MapModel#defaults}).
       */
      initialize: function (config) {
        try {
          if (config && config instanceof Object) {
            function isNonEmptyArray(a) {
              return a && a.length && Array.isArray(a);
            }

            if (isNonEmptyArray(config.layers)) {
              this.set("layers", new MapAssets(config.layers));
              this.get("layers").setMapModel(this);
            }
            if (isNonEmptyArray(config.terrains)) {
              this.set("terrains", new MapAssets(config.terrains));
            }
          }
        } catch (error) {
          console.log(
            "There was an error initializing a Map model" +
              ". Error details: " +
              error
          );
        }
      },

      /**
       * Set or unset the selected Features. A selected feature is a polygon,
       * line, point, or other element of vector data that is in focus on the
       * map (e.g. because a user clicked it to show more details.)
       * @param {(Feature|Object[])} features - An array of Feature models or
       * objects with attributes to set on new Feature models. If no features
       * argument is passed to this function, then any currently selected
       * feature will be removed (as long as replace is set to true)
       * @param {Boolean} [replace=true] - If true, any currently selected
       * features will be replaced with the newly selected features. If false,
       * then the newly selected features will be added to any that are
       * currently selected.
       */
      selectFeatures: function (features, replace = true) {
        try {
          const model = this;

          // Create a features collection if one doesn't already exist
          if (!model.get("selectedFeatures")) {
            model.set("selectedFeatures", new Features());
          }

          // Don't update the selected features collection if the newly selected
          // features are identical.
          const currentFeatures = model.get("selectedFeatures");
          if (
            currentFeatures.length === features.length &&
            currentFeatures.containsFeatures(features)
          ) {
            return;
          }

          // If no feature is passed to this function (and replace is true),
          // then empty the Features collection
          features = !features || !Array.isArray(features) ? [] : features;

          // Convert the feature objects that are types specific to the map view
          // (Cesium) to a generic Feature model
          features = model.convertFeatures(features);

          // Update the Feature model with the new selected feature information.
          const newAttrs = features.map(function (feature) {
            return Object.assign(
              {},
              new Feature().defaults(),
              feature.attributes
            );
          });
          model.get("selectedFeatures").set(newAttrs, { remove: replace });
        } catch (e) {
          console.log("Failed to select a Feature in a Map model.", e);
        }
      },

      /**
       * Convert an array of feature objects to an array of Feature models.
       * @param {Cesium.Entity|Cesium.Cesium3DTileFeature|[]} features - An
       * array of feature objects selected directly from the map view.
       * @returns {Feature[]} An array of Feature models.
       * @since x.x.x
       */
      convertFeatures: function (features) {
        const attrs = features.map(function (feature) {
          if (!feature) return null;
          if (feature instanceof Feature) return feature.attributes;
          return this.get("layers").getFeatureAttributes(features)?.[0];
        });
        return attrs.map((attr) => new Feature(attr));
      },

      /**
       * Reset the layers to the default layers. This will set a new MapAssets
       * collection on the layer attribute.
       * @returns {MapAssets} The new layers collection.
       */
      resetLayers: function () {
        const newLayers = this.defaults()?.layers || new MapAssets();
        this.set("layers", newLayers);
        return newLayers;
      },

      /**
       * Add a layer or other asset to the map. This is the best way to add a
       * layer to the map because it will ensure that this map model is set on
       * the layer model.
       * @param {Object | MapAsset} layer - A map asset model or object with
       * attributes to set on a new map asset model.
       * @returns {MapAsset} The new layer model.
       * @since x.x.x
       */
      addAsset: function (layer) {
        const layers = this.get("layers") || this.resetLayers();
        return layers.addAsset(layer, this);
      },
    }
  );

  return MapModel;
});
