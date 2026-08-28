"use strict";

define([
  "jquery",
  "underscore",
  "backbone",
  "collections/maps/MapAssets",
  "models/maps/ActiveFeatureRestoreController",
  "models/maps/MapInteraction",
  "collections/maps/AssetCategories",
  "collections/maps/viewfinder/ViewfinderCardCategories",
  "common/SearchParams",
], (
  $,
  _,
  Backbone,
  MapAssets,
  ActiveFeatureRestoreController,
  Interactions,
  AssetCategories,
  ViewfinderCardCategories,
  SearchParams,
) => {
  /**
   * Determine if array is empty.
   * @param {Array} a The array in question.
   * @returns {boolean} Whether the array is empty.
   */
  function isNonEmptyArray(a) {
    return a && a.length && Array.isArray(a);
  }

  /**
   * Parse layer visibility state from URL once for initialization.
   * @returns {{enabledLayerIds: string[], enabledLayerStateProvided: boolean}}
   * URL-derived layer visibility state.
   * @since 0.0.0
   */
  function parseLayerVisibilityStateFromUrl() {
    const { enabledLayerIds, enabledLayerStateProvided } =
      SearchParams.parseStateFromUrl();
    return { enabledLayerIds, enabledLayerStateProvided };
  }

  /**
   * Ensure layer config entries are plain objects, not preconstructed models.
   * @param {Array<object>} layers Candidate layer config entries.
   * @param {string} configKey Name of the config property being validated.
   * @throws {Error} When a Backbone model instance is provided.
   * @since 0.0.0
   */
  function assertPlainLayerConfigs(layers, configKey) {
    if (layers.some((layer) => layer instanceof Backbone.Model)) {
      throw new Error(
        `Map configuration ${configKey} must contain plain MapAssetConfig objects, not Backbone model instances.`,
      );
    }
  }

  /**
   * Apply URL visibility override for a layer when the `el` state is present.
   * @param {Backbone.Model|object} layer A layer model/object.
   * @param {{enabledLayerIds: string[], enabledLayerStateProvided: boolean}} visibilityState
   * Parsed URL visibility state.
   * @returns {boolean|undefined} The overridden visible value, if applicable.
   * @since 0.0.0
   */
  function getUrlVisibilityOverride(layer, visibilityState) {
    if (!visibilityState?.enabledLayerStateProvided) return undefined;
    const layerId =
      layer instanceof Backbone.Model ? layer.get("layerId") : layer.layerId;
    if (!layerId) return undefined;
    return visibilityState.enabledLayerIds.includes(layerId);
  }

  /**
   * Normalize configured and runtime visibility for a layer model/object.
   * configuredVisibility tracks the portal-configured value, while visible
   * tracks the current runtime value (which may be overridden from URL state).
   *
   * If both values are missing in config, default to hidden.
   * @param {object} layer A layer config object.
   * @param {{enabledLayerIds: string[], enabledLayerStateProvided: boolean}} [visibilityState]
   * Parsed URL visibility state used to override runtime visible state.
   * @returns {object} The normalized layer config.
   * @since 0.0.0
   */
  function normalizeLayerVisibility(layer, visibilityState) {
    const { visible } = layer;
    const configuredVisibility =
      layer.configuredVisibility == null
        ? visible === true
        : layer.configuredVisibility === true;
    const urlVisible = getUrlVisibilityOverride(layer, visibilityState);
    let runtimeVisibility;
    if (urlVisible != null) {
      runtimeVisibility = urlVisible;
    } else if (visible == null) {
      runtimeVisibility = configuredVisibility;
    } else {
      runtimeVisibility = visible === true;
    }

    return {
      ...layer,
      configuredVisibility,
      visible: runtimeVisibility,
    };
  }

  /**
   * Normalize layer visibility for a list of layer configs/models.
   * @param {Array<object>} layers Layer config objects.
   * @param {{enabledLayerIds: string[], enabledLayerStateProvided: boolean}} visibilityState
   * Parsed URL visibility state.
   * @returns {Array<object>} Normalized layer configs.
   * @since 0.0.0
   */
  function normalizeLayerListVisibility(layers, visibilityState) {
    return layers.map((layer) =>
      normalizeLayerVisibility(layer, visibilityState),
    );
  }

  /**
   * Normalize visibility for each layer in each configured category.
   * @param {Array<Backbone.Model|object>} layerCategories Category configs/models.
   * @param {{enabledLayerIds: string[], enabledLayerStateProvided: boolean}} visibilityState
   * Parsed URL visibility state.
   * @returns {Array<Backbone.Model|object>} Category configs with normalized layers.
   * @since 0.0.0
   */
  function normalizeLayerCategoryVisibility(layerCategories, visibilityState) {
    return layerCategories.map((category) => {
      const categoryLayers =
        category instanceof Backbone.Model
          ? category.get("layers")
          : category?.layers;
      if (!isNonEmptyArray(categoryLayers)) return category;

      const normalizedLayers = normalizeLayerListVisibility(
        categoryLayers,
        visibilityState,
      );

      if (category instanceof Backbone.Model) {
        category.set("layers", normalizedLayers);
        return category;
      }

      return {
        ...category,
        layers: normalizedLayers,
      };
    });
  }

  /**
   * Check whether a camera/destination object has complete coordinates.
   * @param {object} position The position to validate.
   * @returns {boolean} Whether longitude, latitude, and height are present.
   * @since 0.0.0
   */
  function isCompletePosition(position) {
    return (
      position &&
      typeof position.longitude === "number" &&
      typeof position.latitude === "number" &&
      typeof position.height === "number"
    );
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
       * @property {CameraPosition} [homePosition] - A set of coordinates that
       * give the (3D) starting point of the Viewer. This position is also where
       * the "home" button in the Cesium widget will navigate to when clicked.
       * @property {MapAssetConfig[]} [layers] - A collection of imagery, tiles,
       * vector data, etc. to display on the map. Layers wil be displayed in the
       * order they appear. The array of the layer MapAssetConfigs are passed to
       * a {@link MapAssets} collection. When layerCategories exist, this
       * property will be ignored.
       * @property {MapAssetConfig[]} [layerCategories] - A collection of layer
       * categories to display in the tool bar. Categories wil be displayed in
       * the order they appear. The array of the AssetCategoryConfig are passed
       * to a {@link AssetCategories} collection. When layerCategories exist,
       * the layers property will be ignored.
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
       * @property {boolean} [showDownloadPanel=false] - Set to true to enable
       * the partial download panel, see {@link DownloadPanelView}.
       * `showLayerList` must also be set to true.
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
       * @property {string} [globeBaseColor=null] - The base color of the globe
       * when no layer is shown.
       * @property {boolean} [debug=false] - Enables Cesium's built-in map
       * debugging aids, such as tile coordinate and grid imagery overlays, an
       * FPS counter, and a camera position overlay. This does not automatically
       * enable layer-specific debug flags like 3D Tiles
       * `debugShowGeometricError`; those can still be passed directly through a
       * layer's `cesiumOptions`. `cesiumOptions`.
       * @property {boolean} [show3DTilesInspector=false] - Whether or not to
       * show Cesium's built-in 3D Tiles inspector widget for tileset debugging.
       * @property {MapConfig#ZoomPresets} [zoomPresets] @deprecated use
       * ViewfinderCards instead.
       * @property {MapConfig#ZoomPresetCategory[]} [zoomPresetCategories] @deprecated
       * use ViewfinderCardCategories instead.
       * @property {MapConfig#ViewfinderCards} [viewfinderCards=null] - A
       * predefined list of ViewfinderCards to be shown in the viewfinder UI, or
       * an object with a URL to fetch the cards from. Requires `showViewfinder`
       * to be true as this UI appears within the ViewfinderView. Viewfinder
       * Cards were generalized from zoom presets so this also accepts the
       * legacy key `zoomPresets` for backward compatibility.
       * @property {MapConfig#ViewfinderCardCategory[]} [viewfinderCardCategories=null]
       * Instead of a simple list of viewfinder cards, an array that groups
       * cards into categories with a label and optional icon. Also accepts the
       * legacy key `zoomPresetCategories` for backward compatibility.
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
       * @example
       * {
       *  longitude: -119.8489,
       *  latitude: 34.4140
       * }
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
       * @type {string}
       * @default "MapModel"
       * @since 2.25.0
       */
      type: "MapModel",

      /**
       * Overrides the default Backbone.Model.defaults() function to specify
       * default attributes for the Map
       * @name MapModel#defaults
       * @type {object}
       * @property {MapConfig#CameraPosition} [homePosition={longitude: -65, latitude: 56, height: 10000000, heading: 1, pitch: -90, roll: 0}]
       * A set of coordinates that give the (3D) starting point of the Viewer.
       * This position is also where the "home" button in the Cesium viewer will
       * navigate to when clicked.
       * @property {MapAssets} [terrains = new MapAssets()] - The terrain
       * options to show in the map.
       * @property {MapAssets} [layers = new MapAssets()] - The imagery and
       * vector data to render in the map. When layerCategories exist, this
       * property will be ignored.
       * @property {AssetCategories} [layerCategories = new AssetCategories()] -
       * A collection of layer categories to display in the tool bar. Categories
       * will be displayed in the order they appear. The array of the
       * AssetCategoryConfig are passed to a {@link AssetCategories} collection.
       * When layerCategories exist, the layers property will be ignored.
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
       * @property {boolean} [showDownloadPanel=false] Whether or not to show
       * users the panel that allows partial download of data. `showLayerList`
       * must also be set to true.
       * @property {string} [clickFeatureAction="showDetails"] - The default
       * action to take when a user clicks on a feature on the map. The
       * available options are "showDetails" (show the feature details in the
       * sidebar) or "zoom" (zoom to the feature's location).
       * @property {boolean} [showNavHelp=true] - Whether or not to show
       * navigation instructions in the toolbar.
       * @property {boolean} [showFeedback=false] - Whether or not to show a
       * feedback section in the toolbar.
       * @property {string} [feedbackText=null] - The text to show in the
       * feedback section.
       * @property {string} [globeBaseColor=null] - The base color of the globe
       * when no layer is shown.
       * @property {boolean} [debug=false] - Enables Cesium's built-in map
       * debugging aids and overlays for development.
       * @property {boolean} [show3DTilesInspector=false] - Whether or not to
       * show Cesium's built-in 3D Tiles inspector widget.
       * @property {number} [featureRestoreTimeoutMs=15000] - Maximum time to
       * keep asynchronous feature-restore waiters active before canceling.
       * @property {ZoomPresets} [zoomPresets] - @deprecated use ViewfinderCards instead.
       * @property {ViewfinderCards} [viewfinderCards=null] - A
       * Backbone.Collection of a predefined list of locations with an enabled
       * list of layer IDs, content to open in an embedded iframe, or links to
       * external content to be shown in a new tab. Requires
       * `showViewfinder` to be true as this UI appears within the
       * ViewfinderView. Viewfinder Cards were generalized from zoom presets
       * so this also accepts the legacy key `zoomPresets` for backward compatibility.
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
              excludeFromLoadingState: true,
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
          showDownloadPanel: false,
          clickFeatureAction: "showDetails",
          showNavHelp: true,
          showFeedback: false,
          feedbackText: null,
          globeBaseColor: null,
          debug: false,
          show3DTilesInspector: false,
          featureRestoreTimeoutMs: 15000,
          viewfinderCards: null,
          activeVisualizationAction: null,
          activeVisualizationActionId: null,
          activeVisualizationUrl: null,
          isLoadingLayers: false,
          loadingLayersMessage: null,
        };
      },

      /**
       * Run when a new Map is created.
       * @param {MapConfig} options - An object specifying configuration options
       * for the map. If any config option is not specified, the default will be
       * used instead (see {@link MapModel#defaults}).
       */
      initialize(options = {}) {
        const config = options;
        if (config && config instanceof Object) {
          const visibilityState = parseLayerVisibilityStateFromUrl();
          if (isNonEmptyArray(config.layerCategories)) {
            config.layerCategories.forEach((category) => {
              if (isNonEmptyArray(category?.layers)) {
                assertPlainLayerConfigs(
                  category.layers,
                  "layerCategories[].layers",
                );
              }
            });
            const normalizedCategories = normalizeLayerCategoryVisibility(
              config.layerCategories,
              visibilityState,
            );
            const assetCategories = new AssetCategories(normalizedCategories);
            assetCategories.setMapModel(this);
            this.set("layerCategories", assetCategories);
            this.unset("layers");
          } else if (isNonEmptyArray(config.layers)) {
            assertPlainLayerConfigs(config.layers, "layers");
            const normalizedLayers = normalizeLayerListVisibility(
              config.layers,
              visibilityState,
            );
            const layers = new MapAssets(normalizedLayers);
            this.set("layers", layers);
            this.get("layers").setMapModel(this);
            this.unset("layerCategories");
          }

          // Backward compatibility: keep legacy allLayers attribute populated.
          this.refreshAllLayers();

          if (isNonEmptyArray(config.terrains)) {
            this.set("terrains", new MapAssets(config.terrains));
          }

          // Viewfinder cards can be config'd as a simple array of cards (or a
          // URL to fetch), or as an array of grouped cards with label, icon,
          // etc. Convert simple cards to a category, if present. Then handle
          // everything consistently as categories.
          // Support both new keys (viewfinderCards / viewfinderCardCategories)
          // and legacy keys (zoomPresets / zoomPresetCategories) for backward
          // compatibility with existing portal configurations.
          const simpleCards = config.viewfinderCards ?? config.zoomPresets;
          let categoryCards =
            config.viewfinderCardCategories ?? config.zoomPresetCategories;

          if (!isNonEmptyArray(categoryCards) && simpleCards) {
            const category = {
              // Use default label & icon from original implementation.
              label: "Zoom to...",
              icon: "plane",
              expanded: true,
              // Use the legacy key so ViewfinderCardCategory can resolve it.
              zoomPresets: simpleCards,
            };
            categoryCards = [category];
          }
          if (categoryCards?.length) {
            const opts = { mapModel: this, parse: true };
            this.set(
              "viewfinderCardsCollection",
              new ViewfinderCardCategories(categoryCards, opts),
            );
          }
          // Remove attrs automatically set by Backbone from the config
          this.unset("viewfinderCards");
          this.unset("viewfinderCardCategories");
          this.unset("zoomPresets");
          this.unset("zoomPresetCategories");
        }
        this.setUpInteractions();
        this.listenTo(
          this,
          "change:showShareUrl",
          this.handleShowShareUrlChange,
        );
        this.set("restoreState", SearchParams.parseStateFromUrl(), {
          silent: true,
        });
        this.debouncedUpdateSearchParams = _.debounce(() => {
          this.updateSearchParams();
        }, 150 /* milliseconds */);
        this.featureRestoreController = new ActiveFeatureRestoreController({
          mapModel: this,
        });
        this.featureRestoreSession = null;
        this.loadingStateLayerGroups = [];
        this.setUpLayerLoadingStateListeners();
        this.setUpUrlStateListeners();
        this.applyRestoreState();
      },

      /**
       * Keep legacy allLayers attribute in sync for backward compatibility.
       * @returns {MapAssets} Flattened layer collection.
       * @since 0.0.0
       */
      refreshAllLayers() {
        const allLayers = new MapAssets(this.getAllLayers());
        this.set("allLayers", allLayers);
        return allLayers;
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
       * Returns true when the map should sync URL state.
       * @returns {boolean} Whether URL sync is enabled.
       * @since 0.0.0
       */
      shouldSyncUrlState() {
        return this.get("showShareUrl") === true;
      },

      /**
       * Re-apply restore state when share URL syncing is toggled on.
       * @param {MapModel} _model The model that changed.
       * @param {boolean} showShareUrl Whether URL syncing is enabled.
       * @since 0.0.0
       */
      handleShowShareUrlChange(_model, showShareUrl) {
        if (showShareUrl) {
          this.applyRestoreState();
        } else {
          this.clearFeatureRestoreSession();
        }
        this.setUpUrlStateListeners();
      },

      /**
       * Set up listeners that aggregate visible-layer and restore-session loading state.
       * @since 0.0.0
       */
      setUpLayerLoadingStateListeners() {
        this.stopListening(
          this,
          "change:layers change:layerCategories",
          this.setUpLayerLoadingStateListeners,
        );

        if (this.loadingStateLayers?.length) {
          this.loadingStateLayers.forEach((layer) => {
            this.stopListening(
              layer,
              "change:status change:displayReady change:label",
              this.updateLayerLoadingState,
            );
            this.stopListening(
              layer,
              "change:visible",
              this.handleLayerVisibilityChange,
            );
          });
        }

        this.loadingStateLayers = this.getAllLayers();
        this.listenTo(
          this,
          "change:layers change:layerCategories",
          this.setUpLayerLoadingStateListeners,
        );

        this.loadingStateLayers.forEach((layer) => {
          if (!layer) return;
          this.listenTo(
            layer,
            "change:status change:displayReady change:label",
            this.updateLayerLoadingState,
          );
          this.listenTo(
            layer,
            "change:visible",
            this.handleLayerVisibilityChange,
          );
        });

        this.updateLayerLoadingState();
      },

      /**
       * Reconcile restore-session waiters when a layer is toggled.
       * Hidden layers should not keep map loading state active.
       * @since 0.0.0
       */
      handleLayerVisibilityChange() {
        const activeFeatureIds = this.get("restoreState")?.activeFeatureIds;
        if (this.shouldSyncUrlState() && isNonEmptyArray(activeFeatureIds)) {
          this.applyFeatureRestoreState();
        }

        this.updateLayerLoadingState();
      },

      /**
       * Return true when a layer should participate in map loading state.
       * Internal helper overlays can opt out explicitly.
       * @param {Backbone.Model|object} layer The layer model to check.
       * @returns {boolean} Whether the layer should be tracked.
       * @since 0.0.0
       */
      shouldTrackLayerLoading(layer) {
        return layer?.get("excludeFromLoadingState") !== true;
      },

      /**
       * Return true when a tracked layer is enabled but not yet displayed.
       * @param {Backbone.Model|object} layer The layer model to check.
       * @returns {boolean} Whether the layer is still loading.
       * @since 0.0.0
       */
      isTrackedLayerLoading(layer) {
        if (!this.shouldTrackLayerLoading(layer)) return false;
        if (layer?.get("visible") !== true) return false;
        if (layer.get("status") === "error") return false;

        return (
          layer.get("status") === "loading" ||
          layer.get("displayReady") === false
        );
      },

      /**
       * Get visible tracked layers that are actively loading.
       * @returns {Array} The layers still loading into the map.
       * @since 0.0.0
       */
      getTrackedLoadingLayers() {
        return this.getAllLayers().filter((layer) =>
          this.isTrackedLayerLoading(layer),
        );
      },

      /**
       * Sync each layer's canonical loading flag to match current tracked loading state.
       * @param {Backbone.Model[]} [loadingLayers] Optional precomputed loading layers.
       * @since 0.0.0
       */
      syncTrackedLayerLoadingFlags(loadingLayers = this.getTrackedLoadingLayers()) {
        const loadingLayerSet = new Set(loadingLayers);

        this.getAllLayers().forEach((layer) => {
          if (!layer) return;
          const isLoadingLayer = loadingLayerSet.has(layer);
          if (layer.get("isLoadingLayer") === isLoadingLayer) return;
          layer.set("isLoadingLayer", isLoadingLayer);
        });
      },

      /**
       * Return true when any visible layer is actively loading.
       * @returns {boolean} Whether a visible layer is still loading.
       * @since 0.0.0
       */
      hasVisibleLoadingLayers() {
        return this.getTrackedLoadingLayers().length > 0;
      },

      /**
       * Get a user-facing label for a loading layer.
       * @param {Backbone.Model|object} layer The layer model.
       * @returns {string|null} The label to surface in the loading message.
       * @since 0.0.0
       */
      getLoadingLayerLabel(layer) {
        const label = layer?.get("label");
        return typeof label === "string" && label.trim().length ? label.trim() : null;
      },

      /**
       * Get the distinct labels for layers contributing to the current loading state.
       * @param {Backbone.Model[]} [loadingLayers] Optional precomputed loading layers.
       * @returns {string[]} A deduplicated list of loading layer labels.
       * @since 0.0.0
       */
      getLoadingLayerLabels(loadingLayers = this.getTrackedLoadingLayers()) {
        return loadingLayers
          .map((layer) => this.getLoadingLayerLabel(layer))
          .filter(Boolean);
      },

      /**
       * Format the map-level loading message from the loading layer labels.
       * @param {Backbone.Model[]} [loadingLayers] Optional precomputed loading layers.
       * @returns {string|null} The user-facing loading message.
       * @since 0.0.0
       */
      getLoadingLayersMessage(loadingLayers = this.getTrackedLoadingLayers()) {
        const labels = this.getLoadingLayerLabels(loadingLayers);
        if (!labels.length) {
          return this.get("isLoadingLayers") ? "Loading layers" : null;
        }

        if (labels.length === 1) {
          return `Loading ${labels[0]}`;
        }

        if (labels.length === 2) {
          return `Loading ${labels[0]} and ${labels[1]}`;
        }

        return `Loading ${labels[0]} and ${labels.length - 1} more layers`;
      },

      /**
       * Sync the aggregate map loading indicator state.
       * @since 0.0.0
       */
      updateLayerLoadingState() {
        const loadingLayers = this.getTrackedLoadingLayers();
        this.syncTrackedLayerLoadingFlags(loadingLayers);

        const hadLoadingState = this.get("isLoadingLayers") === true;
        const isLoadingLayers = loadingLayers.length > 0;
        const loadingLayersMessage = isLoadingLayers
          ? this.getLoadingLayersMessage(loadingLayers) || "Loading layers"
          : null;

        if (
          this.get("isLoadingLayers") === isLoadingLayers &&
          this.get("loadingLayersMessage") === loadingLayersMessage
        ) {
          return;
        }

        this.set({
          isLoadingLayers,
          loadingLayersMessage,
        });

        if (!hadLoadingState && isLoadingLayers && !loadingLayersMessage) {
          this.trigger("loading:started");
        }
      },

      /**
       * Apply the restored URL destination as a navigation target.
       * @since 0.0.0
       */
      applyRestoreState() {
        const restoreState = this.get("restoreState") || {};
        if (
          !this.shouldSyncUrlState() ||
          !isCompletePosition(restoreState.destination)
        ) {
          this.applyFeatureRestoreState();
          return;
        }

        this.zoomTo(restoreState.destination);
        this.applyFeatureRestoreState();
      },

      /**
       * Set up listeners that keep URL state in sync with the map model.
       * @since 0.0.0
       */
      setUpUrlStateListeners() {
        const interactions = this.get("interactions");
        const selectedFeatures = interactions?.get("selectedFeatures");

        this.stopListening(
          this,
          "change:layers change:layerCategories",
          this.setUpUrlStateListeners,
        );

        if (this.urlStateLayerGroups?.length) {
          this.urlStateLayerGroups.forEach((layers) => {
            this.stopListening(
              layers,
              "change:visible",
              this.debouncedUpdateSearchParams,
            );
          });
        }
        this.urlStateLayerGroups = [];

        if (interactions) {
          this.stopListening(
            interactions,
            "change:cameraPosition",
            this.debouncedUpdateSearchParams,
          );
        }

        if (selectedFeatures) {
          this.stopListening(
            selectedFeatures,
            "update",
            this.syncSelectedFeaturesToUrl,
          );
        }

        if (!this.shouldSyncUrlState() || !interactions) {
          return;
        }

        this.listenTo(
          this,
          "change:layers change:layerCategories",
          this.setUpUrlStateListeners,
        );
        this.listenTo(
          interactions,
          "change:cameraPosition",
          this.debouncedUpdateSearchParams,
        );

        const layerGroups = this.getLayerGroups();
        this.urlStateLayerGroups = layerGroups;
        layerGroups.forEach((layers) => {
          if (layers) {
            this.listenTo(
              layers,
              "change:visible",
              this.debouncedUpdateSearchParams,
            );
          }
        });

        if (selectedFeatures) {
          this.listenTo(
            selectedFeatures,
            "update",
            this.syncSelectedFeaturesToUrl,
          );
        }
      },

      /**
       * Get selected feature ids from the current map interaction state for URL
       * state sync.
       * @returns {string[]} Feature ids of all currently selected features.
       * @since 0.0.0
       */
      getSelectedFeatureIdsForUrlState() {
        const selectedFeatures = this.getSelectedFeatures();
        return (selectedFeatures?.models || [])
          .map((f) => f.get("featureID"))
          .filter((id) => typeof id === "string" && id.length > 0);
      },

      /**
       * Write the currently selected feature ids to the URL. Called when
       * selectedFeatures changes. Managed independently from updateSearchParams
       * so that camera/layer syncs cannot inadvertently clear the f param.
       * @since 0.0.0
       */
      syncSelectedFeaturesToUrl() {
        if (!this.shouldSyncUrlState()) return;
        const selectedIds = this.getSelectedFeatureIdsForUrlState();
        SearchParams.updateActiveFeatureIds(
          this.featureRestoreController.getRequestedIdsForUrlSync(selectedIds),
        );
      },

      /**
       * Cancel and clear any in-flight asynchronous feature restore waiters.
       * @since 0.0.0
       */
      clearFeatureRestoreSession() {
        this.featureRestoreController.clearSession();
      },

      /**
       * Get enabled layer ids from live layer groups for URL state sync.
       * @returns {string[]} A normalized list of visible layer ids.
       * @since 0.0.0
       */
      getEnabledLayerIdsForUrlState() {
        const layers = this.getAllLayers();

        return layers
          .map((layer) => (layer.get("visible") ? layer.get("layerId") : null))
          .filter((layerId) => typeof layerId === "string" && layerId.length);
      },

      /**
       * Update the search parameters related to the current map position and
       * visible layers.
       * @since 0.0.0
       */
      updateSearchParams() {
        if (!this.shouldSyncUrlState()) return;

        const interactions = this.get("interactions");
        const cameraPosition = interactions?.get("cameraPosition");
        const restoreState = this.get("restoreState") || {};
        const partialState = {
          enabledLayerIds: this.getEnabledLayerIdsForUrlState(),
          openPanel: restoreState.openPanel ?? null,
        };

        if (isCompletePosition(cameraPosition)) {
          partialState.destination = cameraPosition;
        }

        SearchParams.updateStateInUrl(partialState);
      },

      /**
       * Open the feature info panel for any feature ids stored in restoreState.
       * Called after other state is restored so the feature panel appears last.
       * Searches all map layers for a matching feature and selects it directly
       * without simulating a user click. If entities are not yet loaded,
       * waits for each layer's status to become 'ready' before retrying.
       * @since 0.0.0
       */
      applyFeatureRestoreState() {
        this.featureRestoreController.applyRestoreState();
      },

      /**
       * Indicate that the map widget view should navigate to a given target.
       * This is accomplished by setting the zoom target on the MapInteraction
       * model. The map widget listens to this change and updates the camera
       * position accordingly.
       * @param {Feature|MapAsset|GeoBoundingBox|object} target The target to
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
        this.getAllLayers().forEach((layer) => {
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
        this.refreshAllLayers();
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
       * @returns {MapAsset[]} A flat list of all layer models across all layer
       * groups.
       */
      getAllLayers() {
        return this.getLayerGroups().flatMap((group) => group?.models || []);
      },

      /**
       * Add a layer or other asset to the map. This is the best way to add a
       * layer to the map because it will ensure that this map model is set on
       * the layer model. If the map is using layer categories, the layer
       * will be added to the first category.
       * @todo Enable adding a terrain asset.
       * @param {object | MapAsset} asset - A map asset model or object with
       * attributes to set on a new map asset model.
       * @returns {MapAsset} The new layer model.
       * @since 2.25.0
       */
      addAsset(asset) {
        const categories = this.get("layerCategories");
        let layers = categories?.at(0)?.get("mapAssets");
        if (!layers) {
          layers = this.get("layers") || this.resetLayers();
        }
        const added = layers.addAsset(asset, this);
        this.refreshAllLayers();
        return added;
      },

      /**
       * Remove a layer from the map.
       * @param {MapAsset} asset - The layer model to remove from the map.
       * @since 2.27.0
       */
      removeAsset(asset) {
        if (!asset) return;
        const layerGroups = this.getLayerGroups();
        // Remove by ID because the model is passed directly. Not sure if this
        // is a bug in the MapAssets collection or Backbone?
        layerGroups.forEach((layers) => {
          if (layers) layers.remove(asset.cid);
        });
        this.refreshAllLayers();
      },
    },
  );

  return MapModel;
});
