"use strict";

define([
  "jquery",
  "underscore",
  "backbone",
  "collections/maps/MapAssets",
  "models/maps/MapInteraction",
], function ($, _, Backbone, MapAssets, Interactions) {
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
       * @property {Boolean} [showLayerList=true] - Whether or not to show the
       * layer list in the toolbar. If true, the {@link ToolbarView} will render
       * a {@link LayerListView}.
       * @property {Boolean} [showHomeButton=true] - Whether or not to show the
       * home button in the toolbar.
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
       * @property {String} [clickFeatureAction="showDetails"] - The default
       * action to take when a user clicks on a feature on the map. The
       * available options are "showDetails" (show the feature details in the
       * sidebar) or "zoom" (zoom to the feature's location).
       * @property {Boolean} [showNavHelp=true] - Whether or not to show
       * navigation instructions in the toolbar.
       * @property {Boolean} [showFeedback=false] - Whether or not to show a
       * feedback section in the toolbar with the text specified in
       * feedbackText.
       * @property {String} [feedbackText=null] - The text to show in the
       * feedback section. showFeedback must be true for this to be shown.
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
       * The type of model this is.
       * @type {String}
       * @default "MapModel"
       * @since 2.25.0
       */
      type: "MapModel",

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
       * @property {Boolean} [showToolbar=true] - Whether or not to show the
       * side bar with layer list and other tools. True by default.
       * @property {Boolean} [showLayerList=true] - Whether or not to include
       * the layer list in the toolbar. True by default.
       * @property {Boolean} [showHomeButton=true] - Whether or not to show the
       * home button in the toolbar. True by default.
       * @property {Boolean} [toolbarOpen=false] - Whether or not the toolbar is
       * open when the map is initialized. Set to false by default, so that the
       * toolbar is hidden by default.
       * @property {Boolean} [showScaleBar=true] - Whether or not to show a
       * scale bar.
       * @property {Boolean} [showFeatureInfo=true] - Whether or not to allow
       * users to click on map features to show more information about them.
       * @property {String} [clickFeatureAction="showDetails"] - The default
       * action to take when a user clicks on a feature on the map. The
       * available options are "showDetails" (show the feature details in the
       * sidebar) or "zoom" (zoom to the feature's location).
       * @property {Boolean} [showNavHelp=true] - Whether or not to show
       * navigation instructions in the toolbar.
       * @property {Boolean} [showFeedback=false] - Whether or not to show a
       * feedback section in the toolbar.
       * @property {String} [feedbackText=null] - The text to show in the
       * feedback section.
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
              type: "OpenStreetMapImageryProvider",
              label: "Base layer",
            },
          ]),
          terrains: new MapAssets(),
          showToolbar: true,
          showLayerList: true,
          showHomeButton: true,
          toolbarOpen: false,
          showScaleBar: true,
          showFeatureInfo: true,
          clickFeatureAction: "showDetails",
          showNavHelp: true,
          showFeedback: false,
          feedbackText: null
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
          this.setUpInteractions();
        } catch (error) {
          console.log('Failed to initialize a Map model.', error);
        }
      },

      /**
       * Set or replace the MapInteraction model on the map.
       * @returns {MapInteraction} The new interactions model.
       * @since 2.27.0
       */
      setUpInteractions: function () {
        const interactions = new Interactions({
          mapModel: this,
        });
        this.set("interactions", interactions);
        return interactions;
      },

      /**
       * Select features on the map. Updates the selectedFeatures attribute on
       * the MapInteraction model.
       * @param {Feature[]} features - An array of Feature models to select.
       * since x.x.x
       */
      selectFeatures: function (features) {
        this.get("interactions")?.selectFeatures(features);
      },

      /**
       * Get the currently selected features on the map.
       * @returns {Features} The selected Feature collection.
       * @since 2.27.0
       */
      getSelectedFeatures: function () {
        return this.get("interactions")?.get("selectedFeatures");
      },

      /**
       * Indicate that the map widget view should navigate to a given target.
       * This is accomplished by setting the zoom target on the MapInteraction
       * model. The map widget listens to this change and updates the camera
       * position accordingly.
       * @param {Feature|MapAsset|GeoBoundingBox|Object} target The target to
       * zoom to. See {@link CesiumWidgetView#flyTo} for more details on types
       * of targets.
       */
      zoomTo: function (target) {
        this.get("interactions")?.set("zoomTarget", target);
      },

      /**
       * Indicate that the map widget view should navigate to the home position.
       */
      flyHome: function () {
        this.zoomTo(this.get("homePosition"));
      },

      /**
       * Reset the layers to the default layers. This will set a new MapAssets
       * collection on the layer attribute.
       * @returns {MapAssets} The new layers collection.
       * @since 2.25.0
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
       * @todo Enable adding a terrain asset.
       * @param {Object | MapAsset} asset - A map asset model or object with
       * attributes to set on a new map asset model.
       * @returns {MapAsset} The new layer model.
       * @since 2.25.0
       */
      addAsset: function (asset) {
        const layers = this.get("layers") || this.resetLayers();
        return layers.addAsset(asset, this);
      },

      /**
       * Remove a layer from the map.
       * @param {MapAsset} asset - The layer model to remove from the map.
       * @since 2.27.0
       */
      removeAsset: function (asset) {
        if (!asset) return;
        const layers = this.get("layers");
        if (!layers) return;
        // Remove by ID because the model is passed directly. Not sure if this
        // is a bug in the MapAssets collection or Backbone?
        if (layers) layers.remove(asset.cid);
      },
    }
  );

  return MapModel;
});
