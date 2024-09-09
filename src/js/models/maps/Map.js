"use strict";

define([
  "jquery",
  "underscore",
  "backbone",
  "collections/maps/MapAssets",
  "models/maps/MapInteraction",
  "collections/maps/AssetCategories",
  "collections/maps/viewfinder/ZoomPresets",
], ($, _, Backbone, MapAssets, Interactions, AssetCategories, ZoomPresets) => {
  /**
   * Determine if array is empty.
   * @param {Array} a The array in question.
   * @returns {boolean} Whether the array is empty.
   */
  function isNonEmptyArray(a) {
    return a && a.length && Array.isArray(a);
  }

  /**
   * @class MapModel
   * @classdesc The Map Model contains all of the settings and options for a
   * required to render a map view.
   * @classcategory Models/Maps
   * @name MapModel
   * @since 2.18.0
   * @augments Backbone.Model
   */
  const MapModel = Backbone.Model.extend(
    /** @lends MapModel.prototype */ {
      /**
       * Configuration options for a {@link MapModel} that control the
       * appearance of the map, the data/imagery displayed, and which UI
       * components are rendered. A MapConfig object can be used when
       * initializing a Map model, e.g. `new Map(myMapConfig)`
       * @namespace {object} MapConfig
       * @property {MapConfig#CameraPosition} [homePosition] - A set of
       * coordinates that give the (3D) starting point of the Viewer. This
       * position is also where the "home" button in the Cesium widget will
       * navigate to when clicked.
       * @property {MapConfig#MapAssetConfig[]} [layers] - A collection of
       * imagery, tiles, vector data, etc. to display on the map. Layers wil be
       * displayed in the order they appear. The array of the layer
       * MapAssetConfigs are passed to a {@link MapAssets} collection. When layerCategories
       * exist, this property will be ignored.
       * @property {MapConfig#MapAssetConfig[]} [layerCategories] - A collection of
       * layer categories to display in the tool bar. Categories wil be
       * displayed in the order they appear. The array of the AssetCategoryConfig
       * are passed to a {@link AssetCategories} collection. When layerCategories
       * exist, the layers property will be ignored.
       * @property {MapConfig#MapAssetConfig[]} [terrains] - Configuration for
       * one or more digital elevation models (DEM) for the surface of the
       * earth. Note: Though multiple terrains are supported, currently only the
       * first terrain is used in the CesiumWidgetView and there is not yet a UI
       * for switching terrains in the map. The array of the terrain
       * MapAssetConfigs are passed to a {@link MapAssets} collection.
       * @property {boolean} [showToolbar=true] - Whether or not to show the
       * side bar with layer list, etc. If true, the {@link MapView} will render
       * a {@link ToolbarView}.
       * @property {boolean} [showLayerList=true] - Whether or not to show the
       * layer list in the toolbar. If true, the {@link ToolbarView} will render
       * a {@link LayerListView}.
       * @property {boolean} [showHomeButton=true] - Whether or not to show the
       * home button in the toolbar.
       * @property {boolean} [showViewfinder=false] - Whether or not to show the
       * viewfinder UI and viewfinder button in the toolbar. The ViewfinderView
       * requires a Google Maps API key present in the AppModel. In order to
       * work properly the Geocoding API and Places API must be enabled.
       * @property {boolean} [showShareUrl=false] - Whether or not to show the
       * share as URL UI in the toolbar and update the URL as the user interacts
       * with the map. This feature requires a `layerId` field on any layers
       * that are expected to be saved to the URL search parameter, as that is
       * the only unique identifier which can be used to turn the layer
       * visibility on or off.
       * @property {boolean} [toolbarOpen=false] - Whether or not the toolbar is
       * open when the map is initialized. Set to false by default, so that the
       * toolbar is hidden by default.
       * @property {boolean} [showScaleBar=true] - Whether or not to show a
       * scale bar. If true, the {@link MapView} will render a
       * {@link ScaleBarView}.
       * @property {boolean} [showFeatureInfo=true] - Whether or not to allow
       * users to click on map features to show more information about them. If
       * true, the {@link MapView} will render a {@link FeatureInfoView} and
       * will initialize "picking" in the {@link CesiumWidgetView}.
       * @property {string} [clickFeatureAction="showDetails"] - The default
       * action to take when a user clicks on a feature on the map. The
       * available options are "showDetails" (show the feature details in the
       * sidebar) or "zoom" (zoom to the feature's location).
       * @property {boolean} [showNavHelp=true] - Whether or not to show
       * navigation instructions in the toolbar.
       * @property {boolean} [showFeedback=false] - Whether or not to show a
       * feedback section in the toolbar with the text specified in
       * feedbackText.
       * @property {string} [feedbackText=null] - The text to show in the
       * feedback section. showFeedback must be true for this to be shown.
       * @property {String} [globeBaseColor=null] - The base color of the globe when no
       * layer is shown.
       * @property {ZoomPresets} [zoomPresets=null] - A Backbone.Collection of a
       * predefined list of locations with an enabled list of layer IDs to be
       * shown the zoom presets UI. Requires `showViewfinder` to be true as this
       * UI appears within the ViewfinderView.
       * UI appears within the ViewfinderView.
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
       * @typedef {object} MapConfig#CameraPosition
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
       * vector data to render in the map. When layerCategories exist, this
       * property will be ignored.
       * @property {MapAssets} [allLayers = new MapAssets()] - The assets that
       * correspond to the layers field or the layerCategories field depending
       * upon which is used. If layerCategories, this contains a flattened list
       * of the assets.
       * @property {AssetCategories} [layerCategories = new AssetCategories()] -
       * A collection of layer categories to display in the tool bar. Categories
       * wil be displayed in the order they appear. The array of the AssetCategoryConfig
       * are passed to a {@link AssetCategories} collection. When layerCategories
       * exist, the layers property will be ignored.
       * @property {boolean} [showToolbar=true] - Whether or not to show the
       * side bar with layer list and other tools. True by default.
       * @property {boolean} [showLayerList=true] - Whether or not to include
       * the layer list in the toolbar. True by default.
       * @property {boolean} [showHomeButton=true] - Whether or not to show the
       * home button in the toolbar. True by default.
       * @property {boolean} [showViewfinder=false] - Whether or not to show the
       * viewfinder UI and viewfinder button in the toolbar. Defaults to false.
       * @property {boolean} [showShareUrl=false] - Whether or not to show the
       * share as URL UI. Defaults to false.
       * @property {boolean} [toolbarOpen=false] - Whether or not the toolbar is
       * open when the map is initialized. Set to false by default, so that the
       * toolbar is hidden by default.
       * @property {boolean} [showScaleBar=true] - Whether or not to show a
       * scale bar.
       * @property {boolean} [showFeatureInfo=true] - Whether or not to allow
       * users to click on map features to show more information about them.
       * @property {string} [clickFeatureAction="showDetails"] - The default
       * action to take when a user clicks on a feature on the map. The
       * available options are "showDetails" (show the feature details in the
       * sidebar) or "zoom" (zoom to the feature's location).
       * @property {boolean} [showNavHelp=true] - Whether or not to show
       * navigation instructions in the toolbar.
       * @property {boolean} [showFeedback=false] - Whether or not to show a
       * feedback section in the toolbar.
       * @property {String} [feedbackText=null] - The text to show in the
       * feedback section.
       * @property {String} [globeBaseColor=null] - The base color of the globe when no
       * layer is shown.
       * @property {ZoomPresets} [zoomPresets=null] - A Backbone.Collection of a
       * predefined list of locations with an enabled list of layer IDs to be
       * shown the zoom presets UI. Requires `showViewfinder` to be true as this
       * UI appears within the ViewfinderView.
       * UI appears within the ViewfinderView.
       */
      defaults() {
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
          showViewfinder: false,
          showShareUrl: false,
          toolbarOpen: false,
          showScaleBar: true,
          showFeatureInfo: true,
          clickFeatureAction: "showDetails",
          showNavHelp: true,
          showFeedback: false,
          feedbackText: null,
          globeBaseColor: null,
          zoomPresets: null,
        };
      },

      /**
       * Run when a new Map is created.
       * @param {MapConfig} config - An object specifying configuration options
       * for the map. If any config option is not specified, the default will be
       * used instead (see {@link MapModel#defaults}).
       */
      initialize(config) {
        try {
          if (config && config instanceof Object) {
            if (isNonEmptyArray(config.layerCategories)) {
              const assetCategories = new AssetCategories(
                config.layerCategories,
              );
              assetCategories.setMapModel(this);
              this.set("layerCategories", assetCategories);
              this.unset("layers");
              this.set("allLayers", assetCategories.getMapAssetsFlat());
            } else if (isNonEmptyArray(config.layers)) {
              const layers = new MapAssets(config.layers);
              this.set("layers", layers);
              this.get("layers").setMapModel(this);
              this.unset("layerCategories");
              this.set("allLayers", layers);
            }

            if (isNonEmptyArray(config.terrains)) {
              this.set("terrains", new MapAssets(config.terrains));
            }

            this.set(
              "zoomPresetsCollection",
              new ZoomPresets(
                {
                  zoomPresetObjects: config.zoomPresets,
                  allLayers: this.get("allLayers"),
                },
                { parse: true },
              ),
            );
          }
          this.setUpInteractions();
        } catch (error) {
          console.log("Failed to initialize a Map model.", error);
        }
      },

      /**
       * Set or replace the MapInteraction model on the map.
       * @returns {MapInteraction} The new interactions model.
       * @since 2.27.0
       */
      setUpInteractions() {
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
       * since 2.28.0
       */
      selectFeatures(features) {
        this.get("interactions")?.selectFeatures(features);
      },

      /**
       * Get the currently selected features on the map.
       * @returns {Features} The selected Feature collection.
       * @since 2.27.0
       */
      getSelectedFeatures() {
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
      zoomTo(target) {
        this.get("interactions")?.set("zoomTarget", target);
      },

      /**
       * Indicate that the map widget view should navigate to the home position.
       */
      flyHome() {
        this.zoomTo(this.get("homePosition"));
      },

      /**
       * Reset the visibility of all layers to the value that was in the intial
       * configuration.
       */
      resetLayerVisibility() {
        this.get("allLayers").forEach((layer) => {
          layer.set("visible", layer.get("configuredVisibility"));
        });
      },

      /**
       * Reset the layers to the default layers. This will set a new MapAssets
       * collection on the layer attribute.
       * @returns {MapAssets} The new layers collection.
       * @since 2.25.0
       */
      resetLayers() {
        const newLayers = this.defaults()?.layers || new MapAssets();
        this.set("layers", newLayers);
        return newLayers;
      },

      /**
       * @returns {MapAssets[]} When layerCategories are configured, each MapAssets
       * represets layers from one category. When layerCategories doesn't exist, flat
       * layers are used and the array includes exactly one MapAssets with all
       * the layers. Returns an empty array if no layer are found.
       */
      getLayerGroups() {
        if (this.has("layerCategories")) {
          return this.get("layerCategories").getMapAssets();
        }
        if (this.has("layers")) {
          return [this.get("layers")];
        }
        return [];
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
      addAsset(asset) {
        const layers = this.get("layers") || this.resetLayers();
        return layers.addAsset(asset, this);
      },

      /**
       * Remove a layer from the map.
       * @param {MapAsset} asset - The layer model to remove from the map.
       * @since 2.27.0
       */
      removeAsset(asset) {
        if (!asset) return;
        const layers = this.get("layers");
        if (!layers) return;
        // Remove by ID because the model is passed directly. Not sure if this
        // is a bug in the MapAssets collection or Backbone?
        if (layers) layers.remove(asset.cid);
      },
    },
  );

  return MapModel;
});
