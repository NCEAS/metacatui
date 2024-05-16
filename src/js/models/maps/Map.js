"use strict";

define([
  "jquery",
  "underscore",
  "backbone",
  "collections/maps/MapAssets",
  "models/maps/MapInteraction",
  "collections/maps/AssetCategories",
  "models/maps/GeoPoint",
  "collections/maps/viewfinder/ZoomPresets",
], function ($,
  _,
  Backbone,
  MapAssets,
  Interactions,
  AssetCategories,
  GeoPoint,
  ZoomPresets,
) {
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
       * @property {Boolean} [showToolbar=true] - Whether or not to show the
       * side bar with layer list, etc. If true, the {@link MapView} will render
       * a {@link ToolbarView}.
       * @property {Boolean} [showLayerList=true] - Whether or not to show the
       * layer list in the toolbar. If true, the {@link ToolbarView} will render
       * a {@link LayerListView}.
       * @property {Boolean} [showHomeButton=true] - Whether or not to show the
       * home button in the toolbar.
       * @property {Boolean} [showViewfinder=false] - Whether or not to show the
       * viewfinder UI and viewfinder button in the toolbar. The ViewfinderView
       * requires a Google Maps API key present in the AppModel. In order to 
       * work properly the Geocoding API and Places API must be enabled. 
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
       * @property {String} [globeBaseColor=null] - The base color of the globe when no
       * layer is shown.
       * @property {ZoomPresets} [zoomPresets=null] - A Backbone.Collection of a
       * predefined list of locations with an enabled list of layer IDs to be
       * shown the zoom presets UI. Requires `showViewfinder` to be true as this
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
       * vector data to render in the map. When layerCategories exist, this
       * property will be ignored.
       * @property {AssetCategories} [layerCategories = new AssetCategories()] -
       * A collection of layer categories to display in the tool bar. Categories
       * wil be displayed in the order they appear. The array of the AssetCategoryConfig
       * are passed to a {@link AssetCategories} collection. When layerCategories
       * exist, the layers property will be ignored.
       * @property {Boolean} [showToolbar=true] - Whether or not to show the
       * side bar with layer list and other tools. True by default.
       * @property {Boolean} [showLayerList=true] - Whether or not to include
       * the layer list in the toolbar. True by default.
       * @property {Boolean} [showHomeButton=true] - Whether or not to show the
       * home button in the toolbar. True by default.
       * @property {Boolean} [showViewfinder=false] - Whether or not to show the
       * viewfinder UI and viewfinder button in the toolbar. Defaults to false.
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
       * @property {String} [globeBaseColor=null] - The base color of the globe when no
       * layer is shown.
       * @property {ZoomPresets} [zoomPresets=null] - A Backbone.Collection of a
       * predefined list of locations with an enabled list of layer IDs to be
       * shown the zoom presets UI. Requires `showViewfinder` to be true as this
       * UI appears within the ViewfinderView. 
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
          showViewfinder: false,
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
      initialize: function (config) {
        config.layerCategories = [{
          label: "People",
          icon: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 512'><!--!Font Awesome Free 6.5.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.--><path d='M72 88a56 56 0 1 1 112 0A56 56 0 1 1 72 88zM64 245.7C54 256.9 48 271.8 48 288s6 31.1 16 42.3V245.7zm144.4-49.3C178.7 222.7 160 261.2 160 304c0 34.3 12 65.8 32 90.5V416c0 17.7-14.3 32-32 32H96c-17.7 0-32-14.3-32-32V389.2C26.2 371.2 0 332.7 0 288c0-61.9 50.1-112 112-112h32c24 0 46.2 7.5 64.4 20.3zM448 416V394.5c20-24.7 32-56.2 32-90.5c0-42.8-18.7-81.3-48.4-107.7C449.8 183.5 472 176 496 176h32c61.9 0 112 50.1 112 112c0 44.7-26.2 83.2-64 101.2V416c0 17.7-14.3 32-32 32H480c-17.7 0-32-14.3-32-32zm8-328a56 56 0 1 1 112 0A56 56 0 1 1 456 88zM576 245.7v84.7c10-11.3 16-26.1 16-42.3s-6-31.1-16-42.3zM320 32a64 64 0 1 1 0 128 64 64 0 1 1 0-128zM240 304c0 16.2 6 31 16 42.3V261.7c-10 11.3-16 26.1-16 42.3zm144-42.3v84.7c10-11.3 16-26.1 16-42.3s-6-31.1-16-42.3zM448 304c0 44.7-26.2 83.2-64 101.2V448c0 17.7-14.3 32-32 32H288c-17.7 0-32-14.3-32-32V405.2c-37.8-18-64-56.5-64-101.2c0-61.9 50.1-112 112-112h32c61.9 0 112 50.1 112 112z'/></svg>",
          layers: [
            {
              label: "Virtual Ice Tours",
              type: "GeoJsonDataSource",
              visible: false,
              description: "A virtual tour of the Permafrost Tunnel that is located just north of Fairbanks, Alaska, and managed by the Cold Region Research and Engineering Laboratory (CRREL). Access the tour by navigating to the Full Details link below.",
              moreInfoLink: "https://virtualice.byrd.osu.edu/permafrost/",
              attribution: "J. Cervenec and J. Moss (2022): Permafrost Tunnel Tour",
              icon: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 500 280'><path d='M482 1H18A17 17 0 0 0 1 17v246a17 17 0 0 0 17 16h173a17 17 0 0 0 15-8l28-48h32l28 48a17 17 0 0 0 15 8h173a17 17 0 0 0 17-16V17a17 17 0 0 0-17-16ZM132 204a72 72 0 1 1 0-144 72 72 0 0 1 0 144Zm236 0a72 72 0 1 1 0-144 72 72 0 0 1 0 144Z'/></svg>",
              colorPalette: {
                colors: [{ color: "#d1134c" }]
              },
              featureTemplate: {
                template: "story",
                label: "label",
                options: {
                  url: "url",
                  urlText: "urlText",
                  description: "description",
                  thumbnail: "thumbnail"
                }
              },
              cesiumOptions: {
                data: {
                  type: "FeatureCollection",
                  features: [{
                    type: "Feature",
                    geometry: {
                      type: "Point",
                      coordinates: [-147.6209142699301, 64.951365829418]
                    },
                    properties: {
                      label: "Permafrost Research Tunnel",
                      url: "https://virtualice.byrd.osu.edu/permafrost/",
                      urlText: "Tour the Tunnel",
                      description: "Take a virtual tour through the CRREL Permafrost Tunnel Research Facility in Fairbanks, Alaska",
                      thumbnail: "https://media.defense.gov/2012/Dec/27/2000725210/-1/-1/0/120720-A-HB029-008.JPG"
                    }
                  }]
                }
              }
            }, {
              layerId: "ls",
              label: "Local Stories",
              type: "GeoJsonDataSource",
              visible: false,
              description: "<b><a href='https://www.leonetwork.org/en/explore/posts?query=&mode=list&infotype=EVENT&region=&polygon=&bbox=&minlat=&maxlat=&near=&radius=&categories=PERMAFROST%7cPermafrost+Change&categories_anyOrAll=ALL&fromdate=&todate=' target='_blank'>Read the latest stories</a></b><br><br>The Local Environmental Observer (LEO) Network is a group of local observers and topic experts who share knowledge about unusual animal, environment, and weather events. This LEO Map is a collection of posts about time and location specific events related to permafrost. It is a living map, which means it is updated with new content from local observations or newspapers, as they are published into LEO Network.",
              moreInfoLink: "https://www.leonetwork.org/en/explore/posts?query=&mode=list&infotype=EVENT&region=&polygon=&bbox=&minlat=&maxlat=&near=&radius=&categories=PERMAFROST%7cPermafrost+Change&categories_anyOrAll=ALL&fromdate=&todate=",
              downloadLink: "https://www.leonetwork.org/explore/posts?query=&type=TWEET&type=POST&type=ARTICLE&mode=geojson_compact&region=&polygon=&bbox=&minlat=&maxlat=&near=&radius=&categories=PERMAFROST%7cPermafrost+Change&categories_anyOrAll=ANY&fromdate=&todate=",
              attribution: "M. Brubaker; M. Brook; J. Temte. (2021): Permafrost Discovery Gateway (PDG). LEO Network.",
              icon: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='#fff' d='M12 0a12 12 0 1 1 0 24 12 12 0 0 1 0-24Zm6.3 8.3c-.5 0-1 0-1.5.3-.3 0-.6.3-.9.6a2 2 0 0 0-.6 1c-.3.4-.4 1-.4 1.8 0 1 .3 2 1 2.6.6.6 1.4 1 2.5 1 1 0 1.8-.4 2.4-1 .6-.7 1-1.5 1-2.7a4 4 0 0 0-1-2.7c-.6-.6-1.4-1-2.5-1ZM4 8.5H2.5v7h5v-1.3H3.8V8.5Zm9.9-.1H8.5v7H14v-1.2h-4v-1.9h3.6v-1.2H10V9.6h3.8V8.4Zm4.6 1c.5 0 1 .3 1.4.7.3.4.5 1 .5 1.8s-.2 1.4-.6 1.8c-.3.4-.8.6-1.3.6-.6 0-1-.2-1.5-.6-.3-.4-.5-1-.5-1.8s.2-1.4.5-1.8a2 2 0 0 1 1.5-.6Z'/></svg>",
              opacity: .75,
              // Single color
              colorPalette: {
                colors: [{ color: "#0087B5" }]
              },
              /*
              colorPalette: {
                property: "year",
                colors: [
                  {value: "2010",color: "#8e58d8"},
                  {value: "2011",color: "#8e67db"},
                  {value: "2012",color: "#8d75de"},
                  {value: "2013",color: "#8c82e1"},
                  {value: "2014",color: "#8b8fe4"},
                  {value: "2015",color: "#899ce7"},
                  {value: "2016",color: "#88a8e9"},
                  {value: "2017",color: "#87b4eb"},
                  {value: "2018",color: "#87c0ec"},
                  {value: "2019",color: "#89cbed"},
                  {value: "2020",color: "#8dd7ee"},
                  {value: "2021",color: "#96e1ec"},
                  {value: "2022",color: "#c9e4de"}
                ]
              },
              */
              customProperties: {
                formattedDate: {
                  property: "date",
                  type: "date",
                  format: "YYYY MMM DD"
                },
                year: {
                  property: "date",
                  type: "date",
                  format: "YYYY"
                },
                urlText: {
                  type: "string",
                  value: "Read more on LEO Network <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' height='24' style='margin-left:.5rem'><g fill='none' fill-rule='evenodd'><circle cx='12' cy='12' r='11' fill='#004E6E' fill-rule='nonzero'/><path fill='#FFF' fill-rule='nonzero' d='M8 15.4v-1.2H4.9V8.7H3.6v6.7H8Zm5.7 0v-1.2h-3.5v-1.8h3.1v-1.1h-3V9.8h3.3V8.6H9v6.8h4.7Zm3.9.1c1 0 1.6-.3 2.2-1 .5-.5.8-1.4.8-2.5 0-1-.3-2-.8-2.6a3 3 0 0 0-2.2-.9c-.5 0-1 0-1.4.3l-.8.6-.5 1c-.2.4-.3 1-.3 1.6 0 1.1.3 2 .8 2.6.5.6 1.3.9 2.2.9Zm0-1.2c-.5 0-1-.2-1.2-.6-.4-.4-.5-1-.5-1.7 0-.8.1-1.4.4-1.8.4-.3.8-.5 1.3-.5s1 .2 1.2.5c.4.4.5 1 .5 1.8s-.2 1.4-.5 1.7c-.3.4-.7.6-1.2.6Z'/><circle cx='12' cy='12' r='11.5' stroke='#00DAFF'/></g></svg>"
                }
              },
              featureTemplate: {
                template: "story",
                label: "title",
                options: {
                  subtitle: "formattedDate",
                  description: "description",
                  thumbnail: "thumbnail",
                  url: "url",
                  urlText: "urlText"
                }
              },
              cesiumOptions: {
                data: "https://www.leonetwork.org/en/explore/posts?query=&type=TWEET&type=POST&type=ARTICLE&mode=geojson_compact&region=&polygon=&bbox=&minlat=&maxlat=&near=&radius=&categories=PERMAFROST%7cPermafrost+Change&categories_anyOrAll=ANY"
              }
            }, {
              label: "Communities",
              type: "GeoJsonDataSource",
              visible: false,
              description: "Contains a list of Arctic communities suitable for providing context in other geospatial data visualizations. Dataset is limited to communities >= 55 degrees north latitude, with populations >= 10,000 as of 2022, except for Alaska communities which allow populations down to 500. The intent of this dataset is to provide intuitive landmarks that help with interpretation of other geospatial datasets. This dataset contains minimal fields: community name, 2-letter country abbreviation, latitude/longitude, estimated population as of 2022, and Geonames identifier.",
              moreInfoLink: "https://arcticdata.io/catalog/view/urn%3Auuid%3Adbb766ba-cd68-49f6-af86-846646152e2e",
              downloadLink: "https://arcticdata.io/catalog/view/urn%3Auuid%3Adbb766ba-cd68-49f6-af86-846646152e2e#urn%3Auuid%3Aed7718ae-fb0d-43dd-9270-fbfe80bfc7a4",
              attribution: "Local Environmental Observer (LEO) Network",
              icon: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path fill='#fff' d='M12 0a12 12 0 1 1 0 24 12 12 0 0 1 0-24Zm6.3 8.3c-.5 0-1 0-1.5.3-.3 0-.6.3-.9.6a2 2 0 0 0-.6 1c-.3.4-.4 1-.4 1.8 0 1 .3 2 1 2.6.6.6 1.4 1 2.5 1 1 0 1.8-.4 2.4-1 .6-.7 1-1.5 1-2.7a4 4 0 0 0-1-2.7c-.6-.6-1.4-1-2.5-1ZM4 8.5H2.5v7h5v-1.3H3.8V8.5Zm9.9-.1H8.5v7H14v-1.2h-4v-1.9h3.6v-1.2H10V9.6h3.8V8.4Zm4.6 1c.5 0 1 .3 1.4.7.3.4.5 1 .5 1.8s-.2 1.4-.6 1.8c-.3.4-.8.6-1.3.6-.6 0-1-.2-1.5-.6-.3-.4-.5-1-.5-1.8s.2-1.4.5-1.8a2 2 0 0 1 1.5-.6Z'/></svg>",
              notification: { badge: "NEW", style: "blue" },
              opacity: .75,
              colorPalette: {
                paletteType: "continuous",
                property: "population",
                colors: [
                  { color: "#C8C800", value: 501 },
                  { color: "#969600", value: 76000 },
                  { color: "#646400", value: 10381221 }
                ]
              },
              customProperties: {
                populationWord: {
                  property: "date",
                  type: "string",
                  value: "Population"
                }
              },
              featureTemplate: {
                template: "story",
                label: "name",
                options: {
                  subtitle: "populationWord",
                  description: "population"
                }
              },
              cesiumOptions: {
                data: "https://arcticdata.io/metacat/d1/mn/v2/object/urn%3Auuid%3Aed7718ae-fb0d-43dd-9270-fbfe80bfc7a4"
              }
            },
          ]
        }, {
          label: "Infrastructure",
          icon: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 512'><!--!Font Awesome Free 6.5.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.--><path d='M480 48c0-26.5-21.5-48-48-48H336c-26.5 0-48 21.5-48 48V96H224V24c0-13.3-10.7-24-24-24s-24 10.7-24 24V96H112V24c0-13.3-10.7-24-24-24S64 10.7 64 24V96H48C21.5 96 0 117.5 0 144v96V464c0 26.5 21.5 48 48 48H304h32 96H592c26.5 0 48-21.5 48-48V240c0-26.5-21.5-48-48-48H480V48zm96 320v32c0 8.8-7.2 16-16 16H528c-8.8 0-16-7.2-16-16V368c0-8.8 7.2-16 16-16h32c8.8 0 16 7.2 16 16zM240 416H208c-8.8 0-16-7.2-16-16V368c0-8.8 7.2-16 16-16h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16zM128 400c0 8.8-7.2 16-16 16H80c-8.8 0-16-7.2-16-16V368c0-8.8 7.2-16 16-16h32c8.8 0 16 7.2 16 16v32zM560 256c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H528c-8.8 0-16-7.2-16-16V272c0-8.8 7.2-16 16-16h32zM256 176v32c0 8.8-7.2 16-16 16H208c-8.8 0-16-7.2-16-16V176c0-8.8 7.2-16 16-16h32c8.8 0 16 7.2 16 16zM112 160c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H80c-8.8 0-16-7.2-16-16V176c0-8.8 7.2-16 16-16h32zM256 304c0 8.8-7.2 16-16 16H208c-8.8 0-16-7.2-16-16V272c0-8.8 7.2-16 16-16h32c8.8 0 16 7.2 16 16v32zM112 320H80c-8.8 0-16-7.2-16-16V272c0-8.8 7.2-16 16-16h32c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16zm304-48v32c0 8.8-7.2 16-16 16H368c-8.8 0-16-7.2-16-16V272c0-8.8 7.2-16 16-16h32c8.8 0 16 7.2 16 16zM400 64c8.8 0 16 7.2 16 16v32c0 8.8-7.2 16-16 16H368c-8.8 0-16-7.2-16-16V80c0-8.8 7.2-16 16-16h32zm16 112v32c0 8.8-7.2 16-16 16H368c-8.8 0-16-7.2-16-16V176c0-8.8 7.2-16 16-16h32c8.8 0 16 7.2 16 16z'/></svg>",
          layers: [
            {
            layerId:'isv1',
              type: "WebMapTileServiceImageryProvider",
              label: "Infrastructure (SACHI version 1)",
              visible: false,
              cesiumOptions: {
                url: "https://arcticdata.io/data/tiles/10.18739/A21J97929/bartsch_infrastructure/WorldCRS84Quad/{TileMatrix}/{TileCol}/{TileRow}.png",
                tilingScheme: "GeographicTilingScheme",
                rectangle: [-179.82421875, 54.84375000000004, 179.12109374999955, 82.61718750000001]
              },
              colorPalette: {
                paletteType: "continuous",
                property: "coverage",
                colors: [
                  { color: "#ecda9a", value: 0 },
                  { color: "#efc47e", value: 0.2 },
                  { color: "#f3ad6a", value: 0.4 },
                  { color: "#f7945d", value: 0.6 },
                  { color: "#f97b57", value: 0.8 },
                  { color: "#ee4d5a", value: 1 }
                ]
              }
            }, {
              type: "WebMapTileServiceImageryProvider",
              label: "Infrastructure (SACHI version 2)",
              description: "Sentinel-1/2 derived Arctic Coastal Human Impact, version 2. Arctic infrastructure. More information to be added.",
              visible: true,
              cesiumOptions: {
                url: "https://arcticdata.io/data/tiles/10.18739/A21J97929/SACHI_v2/infrastructure_code/WGS1984Quad/{TileMatrix}/{TileCol}/{TileRow}.png",
                tilingScheme: "GeographicTilingScheme",
                rectangle: [-179.82421875, 54.84375000000004, 179.12109374999955, 82.61718750000001]
              },
              colorPalette: {
                paletteType: "categorical",
                property: "DN",
                colors: [
                  { color: "#f48525", label: "Linear transport infrastructure (asphalt)", value: 11 },
                  { color: "#f4e625", label: "Linear transport infrastructure (gravel)", value: 12 },
                  { color: "#47f425", label: "Linear transport infrastructure (undefined)", value: 13 },
                  { color: "#25f4e2", label: "Buildings (and other constructions such as bridges)", value: 20 },
                  { color: "#2525f4", label: "Other impacted area (includes gravel pads, mining sites)", value: 30 },
                  { color: "#f425c3", label: "Airstrip", value: 40 },
                  { color: "#f42525", label: "Reservoir or other water body impacted by human activities", value: 50 }
                ]
              }
            }, {
              label: "Infrastructure 3D Tiles",
              type: "Cesium3DTileset",
              visible: false,
              cesiumOptions: {
                url: "https://demo.arcticdata.io/cesium-layers/3d-tilesets/bartsch_infrastructure/tileset.json"
              },
              colorPalette: {
                paletteType: "categorical",
                colors: [{ color: "#ee4d5a" }]
              }
            },
          ]
        }, {
          label: "Lakes & Surface Water",
          icon: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 576 512'><!--!Font Awesome Free 6.5.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.--><path d='M269.5 69.9c11.1-7.9 25.9-7.9 37 0C329 85.4 356.5 96 384 96c26.9 0 55.4-10.8 77.4-26.1l0 0c11.9-8.5 28.1-7.8 39.2 1.7c14.4 11.9 32.5 21 50.6 25.2c17.2 4 27.9 21.2 23.9 38.4s-21.2 27.9-38.4 23.9c-24.5-5.7-44.9-16.5-58.2-25C449.5 149.7 417 160 384 160c-31.9 0-60.6-9.9-80.4-18.9c-5.8-2.7-11.1-5.3-15.6-7.7c-4.5 2.4-9.7 5.1-15.6 7.7c-19.8 9-48.5 18.9-80.4 18.9c-33 0-65.5-10.3-94.5-25.8c-13.4 8.4-33.7 19.3-58.2 25c-17.2 4-34.4-6.7-38.4-23.9s6.7-34.4 23.9-38.4C42.8 92.6 61 83.5 75.3 71.6c11.1-9.5 27.3-10.1 39.2-1.7l0 0C136.7 85.2 165.1 96 192 96c27.5 0 55-10.6 77.5-26.1zm37 288C329 373.4 356.5 384 384 384c26.9 0 55.4-10.8 77.4-26.1l0 0c11.9-8.5 28.1-7.8 39.2 1.7c14.4 11.9 32.5 21 50.6 25.2c17.2 4 27.9 21.2 23.9 38.4s-21.2 27.9-38.4 23.9c-24.5-5.7-44.9-16.5-58.2-25C449.5 437.7 417 448 384 448c-31.9 0-60.6-9.9-80.4-18.9c-5.8-2.7-11.1-5.3-15.6-7.7c-4.5 2.4-9.7 5.1-15.6 7.7c-19.8 9-48.5 18.9-80.4 18.9c-33 0-65.5-10.3-94.5-25.8c-13.4 8.4-33.7 19.3-58.2 25c-17.2 4-34.4-6.7-38.4-23.9s6.7-34.4 23.9-38.4c18.1-4.2 36.2-13.3 50.6-25.2c11.1-9.4 27.3-10.1 39.2-1.7l0 0C136.7 373.2 165.1 384 192 384c27.5 0 55-10.6 77.5-26.1c11.1-7.9 25.9-7.9 37 0zm0-144C329 229.4 356.5 240 384 240c26.9 0 55.4-10.8 77.4-26.1l0 0c11.9-8.5 28.1-7.8 39.2 1.7c14.4 11.9 32.5 21 50.6 25.2c17.2 4 27.9 21.2 23.9 38.4s-21.2 27.9-38.4 23.9c-24.5-5.7-44.9-16.5-58.2-25C449.5 293.7 417 304 384 304c-31.9 0-60.6-9.9-80.4-18.9c-5.8-2.7-11.1-5.3-15.6-7.7c-4.5 2.4-9.7 5.1-15.6 7.7c-19.8 9-48.5 18.9-80.4 18.9c-33 0-65.5-10.3-94.5-25.8c-13.4 8.4-33.7 19.3-58.2 25c-17.2 4-34.4-6.7-38.4-23.9s6.7-34.4 23.9-38.4c18.1-4.2 36.2-13.3 50.6-25.2c11.1-9.5 27.3-10.1 39.2-1.7l0 0C136.7 229.2 165.1 240 192 240c27.5 0 55-10.6 77.5-26.1c11.1-7.9 25.9-7.9 37 0z'/></svg>",
          layers: [
            {
              label: "Lake Change Rate",
              icon: "urn:uuid:c4b53e6f-814d-4c22-a159-a4164daaf86f",
              type: "WebMapTileServiceImageryProvider",
              visible: false,
              description: "Lake change data draft visualization for UTM zones 32638-32640, deduplicated. In the future, more details will be available, as well as an updated attribution and link to access data.",
              attribution: "Nitze, Ingmar; Grosse, Guido; Jones, Benjamin M; Romanovsky, Vladimir E; Boike, Julia (2018): Remote sensing quantifies widespread abundance of permafrost region disturbances across the Arctic and Subarctic, Datasets. PANGAEA, https://doi.org/10.1594/PANGAEA.894755",
              cesiumOptions: {
                url: "https://arcticdata.io/data/tiles/10.18739/A2KH0F12D/change_rate_dedup_1204/web_tiles/change_rate/WGS1984Quad/{TileMatrix}/{TileCol}/{TileRow}.png",
                tilingScheme: "GeographicTilingScheme",
                rectangle: [-179.91531896747117, 50.16996707215903, 179.91531896747247, 80.0978646943821]
              },
              opacity: 1,
              colorPalette: {
                paletteType: "continuous",
                property: "change_rate",
                colors: [
                  { color: "#ff0000", value: -2 },
                  { color: "#FF8C00", value: -1.32 },
                  { color: "#FFA07A", value: -0.66 },
                  { color: "#FFFF00", value: 0 },
                  { color: "#66CDAA", value: 0.66 },
                  { color: "#AFEEEE", value: 1.32 },
                  { color: "#0000ff", value: 2 }
                ]
              },
              notification: {
                badge: "Preview",
                style: "yellow",
                message: "Pan-arctic coverage will be available for this layer soon! While the data pipeline is under development, a subset of the data is available here."
              }
            }, {
              label: "Lake Size Time Series: 2017 permanent water",
              icon: "urn:uuid:c4b53e6f-814d-4c22-a159-a4164daaf86f",
              type: "WebMapTileServiceImageryProvider",
              visible: false,
              description: "Lake size time series permanent water for 2017, all transects. In the future, more details will be available, as well as an updated attribution and link to access data.",
              attribution: "Nitze, Ingmar & collaborators (to be updated)",
              cesiumOptions: {
                url: "https://arcticdata.io/data/tiles/10.18739/A28G8FK10/yr2017/web_tiles/permanent_water/WGS1984Quad/{TileMatrix}/{TileCol}/{TileRow}.png",
                tilingScheme: "GeographicTilingScheme",
                rectangle: [-179.91531896747117, 50.16996707215903, 179.91531896747247, 80.0978646943821]
              },
              opacity: 1,
              colorPalette: {
                paletteType: "continuous",
                property: "permanent_water",
                colors: [
                  { color: "#1be3ee", value: 0 },
                  { color: "#1b22ee", value: 120025 }
                ]
              },
              notification: {
                badge: "Preview",
                style: "yellow",
                message: "Pan-arctic coverage will be available for this layer soon! While the data pipeline is under development, a subset of the data is available here."
              }
            }, {
              label: "Lake Size Time Series: 2017 seasonal water",
              icon: "urn:uuid:c4b53e6f-814d-4c22-a159-a4164daaf86f",
              type: "WebMapTileServiceImageryProvider",
              visible: false,
              description: "Lake size time series seasonal water for 2017, all transects. In the future, more details will be available, as well as an updated attribution and link to access data.",
              attribution: "Nitze, Ingmar & collaborators (to be updated)",
              cesiumOptions: {
                url: "https://arcticdata.io/data/tiles/10.18739/A28G8FK10/yr2017/web_tiles/seasonal_water/WGS1984Quad/{TileMatrix}/{TileCol}/{TileRow}.png",
                tilingScheme: "GeographicTilingScheme",
                rectangle: [-179.91531896747117, 50.16996707215903, 179.91531896747247, 80.0978646943821]
              },
              opacity: 1,
              colorPalette: {
                paletteType: "continuous",
                property: "seasonal_water",
                colors: [
                  { color: "#f000d8", value: 0 },
                  { color: "#8b00cc", value: 7139 }
                ]
              },
              notification: {
                badge: "Preview",
                style: "yellow",
                message: "Pan-arctic coverage will be available for this layer soon! While the data pipeline is under development, a subset of the data is available here."
              }
            }, {
              label: "Lake Size Time Series: 2018 permanent water",
              icon: "urn:uuid:c4b53e6f-814d-4c22-a159-a4164daaf86f",
              type: "WebMapTileServiceImageryProvider",
              visible: false,
              description: "Lake size time series permanent water for 2018, all transects. In the future, more details will be available, as well as an updated attribution and link to access data.",
              attribution: "Nitze, Ingmar & collaborators (to be updated)",
              cesiumOptions: {
                url: "https://arcticdata.io/data/tiles/10.18739/A28G8FK10/yr2018/web_tiles/permanent_water/WGS1984Quad/{TileMatrix}/{TileCol}/{TileRow}.png",
                tilingScheme: "GeographicTilingScheme",
                rectangle: [-179.91531896747117, 50.16996707215903, 179.91531896747247, 80.0978646943821]
              },
              opacity: 1,
              colorPalette: {
                paletteType: "continuous",
                property: "permanent_water",
                colors: [
                  { color: "#1be3ee", value: 0 },
                  { color: "#1b22ee", value: 120054 }
                ]
              },
              notification: {
                badge: "Preview",
                style: "yellow",
                message: "Pan-arctic coverage will be available for this layer soon! While the data pipeline is under development, a subset of the data is available here."
              }
            }, {
              label: "Lake Size Time Series: 2018 seasonal water",
              icon: "urn:uuid:c4b53e6f-814d-4c22-a159-a4164daaf86f",
              type: "WebMapTileServiceImageryProvider",
              visible: false,
              description: "Lake size time series seasonal water for 2018, all transects. In the future, more details will be available, as well as an updated attribution and link to access data.",
              attribution: "Nitze, Ingmar & collaborators (to be updated)",
              cesiumOptions: {
                url: "https://arcticdata.io/data/tiles/10.18739/A28G8FK10/yr2018/web_tiles/seasonal_water/WGS1984Quad/{TileMatrix}/{TileCol}/{TileRow}.png",
                tilingScheme: "GeographicTilingScheme",
                rectangle: [-179.91531896747117, 50.16996707215903, 179.91531896747247, 80.0978646943821]
              },
              opacity: 1,
              colorPalette: {
                paletteType: "continuous",
                property: "seasonal_water",
                colors: [
                  { color: "#f000d8", value: 0 },
                  { color: "#8b00cc", value: 6255 }
                ]
              },
              notification: {
                badge: "Preview",
                style: "yellow",
                message: "Pan-arctic coverage will be available for this layer soon! While the data pipeline is under development, a subset of the data is available here."
              }
            }, {
              label: "Lake Size Time Series: 2019 permanent water",
              icon: "urn:uuid:c4b53e6f-814d-4c22-a159-a4164daaf86f",
              type: "WebMapTileServiceImageryProvider",
              visible: false,
              description: "Lake size time series permanent water for 2019, all transects. In the future, more details will be available, as well as an updated attribution and link to access data.",
              attribution: "Nitze, Ingmar & collaborators (to be updated)",
              cesiumOptions: {
                url: "https://arcticdata.io/data/tiles/10.18739/A28G8FK10/yr2019/web_tiles/permanent_water/WGS1984Quad/{TileMatrix}/{TileCol}/{TileRow}.png",
                tilingScheme: "GeographicTilingScheme",
                rectangle: [-179.91531896747117, 50.16996707215903, 179.91531896747247, 80.0978646943821]
              },
              opacity: 1,
              colorPalette: {
                paletteType: "continuous",
                property: "permanent_water",
                colors: [
                  { color: "#1be3ee", value: 0 },
                  { color: "#1b22ee", value: 120046 }
                ]
              },
              notification: {
                badge: "Preview",
                style: "yellow",
                message: "Pan-arctic coverage will be available for this layer soon! While the data pipeline is under development, a subset of the data is available here."
              }
            }, {
              label: "Lake Size Time Series: 2019 seasonal water",
              icon: "urn:uuid:c4b53e6f-814d-4c22-a159-a4164daaf86f",
              type: "WebMapTileServiceImageryProvider",
              visible: false,
              description: "Lake size time series seasonal water for 2019, all transects. In the future, more details will be available, as well as an updated attribution and link to access data.",
              attribution: "Nitze, Ingmar & collaborators (to be updated)",
              cesiumOptions: {
                url: "https://arcticdata.io/data/tiles/10.18739/A28G8FK10/yr2019/web_tiles/seasonal_water/WGS1984Quad/{TileMatrix}/{TileCol}/{TileRow}.png",
                tilingScheme: "GeographicTilingScheme",
                rectangle: [-179.91531896747117, 50.16996707215903, 179.91531896747247, 80.0978646943821]
              },
              opacity: 1,
              colorPalette: {
                paletteType: "continuous",
                property: "seasonal_water",
                colors: [
                  { color: "#f000d8", value: 0 },
                  { color: "#8b00cc", value: 5968 }
                ]
              },
              notification: {
                badge: "Preview",
                style: "yellow",
                message: "Pan-arctic coverage will be available for this layer soon! While the data pipeline is under development, a subset of the data is available here."
              }
            }, {
              label: "Lake Size Time Series: 2020 permanent water",
              icon: "urn:uuid:c4b53e6f-814d-4c22-a159-a4164daaf86f",
              type: "WebMapTileServiceImageryProvider",
              visible: false,
              description: "Lake size time series permanent water for 2020, all transects. In the future, more details will be available, as well as an updated attribution and link to access data.",
              attribution: "Nitze, Ingmar & collaborators (to be updated)",
              cesiumOptions: {
                url: "https://arcticdata.io/data/tiles/10.18739/A28G8FK10/yr2020/web_tiles/permanent_water/WGS1984Quad/{TileMatrix}/{TileCol}/{TileRow}.png",
                tilingScheme: "GeographicTilingScheme",
                rectangle: [-179.91531896747117, 50.16996707215903, 179.91531896747247, 80.0978646943821]
              },
              opacity: 1,
              colorPalette: {
                paletteType: "continuous",
                property: "permanent_water",
                colors: [
                  { color: "#1be3ee", value: 0 },
                  { color: "#1b22ee", value: 119980 }
                ]
              },
              notification: {
                badge: "Preview",
                style: "yellow",
                message: "Pan-arctic coverage will be available for this layer soon! While the data pipeline is under development, a subset of the data is available here.",
              }
            }, {
              label: "Lake Size Time Series: 2020 seasonal water",
              icon: "urn:uuid:c4b53e6f-814d-4c22-a159-a4164daaf86f",
              type: "WebMapTileServiceImageryProvider",
              visible: false,
              description: "Lake size time series seasonal water for 2020, all transects. In the future, more details will be available, as well as an updated attribution and link to access data.",
              attribution: "Nitze, Ingmar & collaborators (to be updated)",
              cesiumOptions: {
                url: "https://arcticdata.io/data/tiles/10.18739/A28G8FK10/yr2020/web_tiles/seasonal_water/WGS1984Quad/{TileMatrix}/{TileCol}/{TileRow}.png",
                tilingScheme: "GeographicTilingScheme",
                rectangle: [-179.91531896747117, 50.16996707215903, 179.91531896747247, 80.0978646943821]
              },
              opacity: 1,
              colorPalette: {
                paletteType: "continuous",
                property: "seasonal_water",
                colors: [
                  { color: "#f000d8", value: 0 },
                  { color: "#8b00cc", value: 8766 }
                ]
              },
              notification: {
                badge: "Preview",
                style: "yellow",
                message: "Pan-arctic coverage will be available for this layer soon! While the data pipeline is under development, a subset of the data is available here."
              }
            }, {
              label: "Lake Size Time Series: 2021 permanent water",
              icon: "urn:uuid:c4b53e6f-814d-4c22-a159-a4164daaf86f",
              type: "WebMapTileServiceImageryProvider",
              visible: false,
              description: "Lake size time series permanent water for 2021, all transects. In the future, more details will be available, as well as an updated attribution and link to access data.",
              attribution: "Nitze, Ingmar & collaborators (to be updated)",
              cesiumOptions: {
                url: "https://arcticdata.io/data/tiles/10.18739/A28G8FK10/yr2021/web_tiles/permanent_water/WGS1984Quad/{TileMatrix}/{TileCol}/{TileRow}.png",
                tilingScheme: "GeographicTilingScheme",
                rectangle: [-179.91531896747117, 50.16996707215903, 179.91531896747247, 80.0978646943821]
              },
              opacity: 1,
              colorPalette: {
                paletteType: "continuous",
                property: "permanent_water",
                colors: [
                  { color: "#1be3ee", value: 0 },
                  { color: "#1b22ee", value: 119884 }
                ]
              },
              notification: {
                badge: "Preview",
                style: "yellow",
                message: "Pan-arctic coverage will be available for this layer soon! While the data pipeline is under development, a subset of the data is available here."
              }
            }, {
              label: "Lake Size Time Series: 2021 seasonal water",
              icon: "urn:uuid:c4b53e6f-814d-4c22-a159-a4164daaf86f",
              type: "WebMapTileServiceImageryProvider",
              visible: false,
              description: "Lake size time series seasonal water for 2021, all transects. In the future, more details will be available, as well as an updated attribution and link to access data.",
              attribution: "Nitze, Ingmar & collaborators (to be updated)",
              cesiumOptions: {
                url: "https://arcticdata.io/data/tiles/10.18739/A28G8FK10/yr2021/web_tiles/seasonal_water/WGS1984Quad/{TileMatrix}/{TileCol}/{TileRow}.png",
                tilingScheme: "GeographicTilingScheme",
                rectangle: [-179.91531896747117, 50.16996707215903, 179.91531896747247, 80.0978646943821]
              },
              opacity: 1,
              colorPalette: {
                paletteType: "continuous",
                property: "seasonal_water",
                colors: [
                  { color: "#f000d8", value: 0 },
                  { color: "#8b00cc", value: 3463 }
                ]
              },
              notification: {
                badge: "Preview",
                style: "yellow",
                message: "Pan-arctic coverage will be available for this layer soon! While the data pipeline is under development, a subset of the data is available here."
              }
            }, {
              type: "WebMapTileServiceImageryProvider",
              layerId:"dlbns1419",
              label: "Drained Lake Basins, North Slope, 2014-2019",
              description: "This data set contains a classification of the North Slope, Alaska for drained lake basins (DLBs) based on Landsat-8 imagery of the years 2014-2019, and covers greater than 71,000 km2. Areas classified as ambiguous could not be classified as DLB or noDLB with sufficient certainty. It is based on a novel and scalable remote sensing-based approach to identify DLBs in lowland permafrost regions.",
              attribution: "Helena Bergstedt, Benjamin Jones, Kenneth Hinkel, Louise Farquharson, Benjamin Gaglioti, et al. 2021. Drained Lake Basin classification based on Landsat-8 imagery, North Slope, Alaska 2014 -2019. Arctic Data Center. doi:10.18739/A2K35MF71.",
              moreInfoLink: "https://arcticdata.io/catalog/view/doi%3A10.18739%2FA2K35MF71",
              downloadLink: "https://arcticdata.io/catalog/view/doi%3A10.18739%2FA2K35MF71#urn%3Auuid%3A15830bf6-1d20-405f-90c6-5011058fc8fd",
              id: "doi:10.18739/A2K35MF71",
              visible: false,
              notification: { badge: "NEW", style: "blue" },
              cesiumOptions: {
                url: "https://arcticdata.io/data/tiles/10.18739/A2K35MF71/urn:uuid:15830bf6-1d20-405f-90c6-5011058fc8fd/band_1/WGS1984Quad/{TileMatrix}/{TileCol}/{TileRow}.png",
                tilingScheme: "GeographicTilingScheme",
                rectangle: [-171.329107983504, 66.16074244427435, -136.6488120854937, 72.25092330368847]
              },
              colorPalette: {
                paletteType: "categorical",
                property: "DLB Classification",
                colors: [
                  { color: "#FC8D59", value: "No Drained Lake Basin" },
                  { color: "#FFFFBF", value: "Ambiguous" },
                  { color: "#91BFDB", value: "Drained Lake Basin" }
                ]
              }
            }, {
              type: "WebMapTileServiceImageryProvider",
              label: "Surface Water Index trend 2000-2021",
              visible: false,
              cesiumOptions: {
                url: "https://arcticdata.io/data/tiles/10.18739/A2037V/urn:uuid:ea99e31b-572a-4175-92d2-0a4a9cdd8366/band_1/WGS1984Quad/{TileMatrix}/{TileCol}/{TileRow}.png",
                tilingScheme: "GeographicTilingScheme",
                rectangle: [-179.91531896747117, 50.16996707215903, 179.91531896747247, 80.0978646943821]
              },
              notification: { badge: "NEW", style: "blue" },
              opacity: 0.9,
              colorPalette: {
                paletteType: "continuous",
                property: "Trend in average July SWI",
                colors: [
                  { color: "#872817", value: -0.0023 },
                  { color: "#cd4e03", value: -0.001788888888888889 },
                  { color: "#e98a1f", value: -0.0012777777777777779 },
                  { color: "#f7d054", value: -0.0007666666666666668 },
                  { color: "#fff29a", value: -0.00025555555555555574 },
                  { color: "#c1e8f2", value: 0.00025555555555555574 },
                  { color: "#81c4dc", value: 0.0007666666666666664 },
                  { color: "#4d9ccb", value: 0.0012777777777777779 },
                  { color: "#115ca3", value: 0.0017888888888888885 },
                  { color: "#052350", value: 0.0023 }
                ]
              },
              attribution: "Webb, Elizabeth E., Anna K. Liljedahl, Jada A. Cordeiro, Michael M. Loranty, Chandi Witharana, and Jeremy W. Lichstein (2022), Permafrost thaw drives surface water decline across lake-rich regions of the Arctic, Nature Climate Change, <a href='https://www.nature.com/articles/s41558-022-01455-w'>doi.org/10.1038/s41558-022-01455-w</a><br><br>Webb, Elizabeth E. (2022), Pan-Arctic surface water (yearly and trend over time) 2000-2021, Arctic Data Center, <a href='https://doi.org/doi:10.18739/A2037V'>doi:10.18739/A2037V</a>",
              description: "Surface water change has been documented across the Arctic due to thawing permafrost and changes in the precipitation/evapotranspiration balance. This dataset uses Moderate Resolution Imaging Spectroradiometer (MODIS) data to track changes in surface water across the lake-rich regions of the northern permafrost zone over the past two decades. The superfine water index (SWI) is a unitless global water cover index developed specifically for MODIS data and validated in high northern latitudes. Variation in SWI can also track changes in surface water that occur at the sub-MODIS pixel scale (i.e., changes in water bodies smaller a MODIS pixel, ~500 meters (m)). A change in SWI of -0.002 yr-1 corresponds to ~3% decrease in percent surface water cover over 20 years (e.g., a change from 15% to 12% surface water cover). Here, red represents a negative trend (i.e., drying) and blue represents a positive trend (i.e., wetting).",
              moreInfoLink: "https://arcticdata.io/catalog/view/doi:10.18739/A2037V",
              downloadLink: "https://arcticdata.io/catalog/view/doi%3A10.18739%2FA2037V#urn%3Auuid%3Aea99e31b-572a-4175-92d2-0a4a9cdd8366"
            }, {
              label: "Surface Water",
              icon: "urn:uuid:c4b53e6f-814d-4c22-a159-a4164daaf86f",
              type: "Cesium3DTileset",
              visible: false,
              description: "This sub-meter resolution surface water layer was derived from the high spatial resolution commercial satellite imagery provided by the Polar Geospatial Center. This layer shows a sample of the data in North Slope, Alaska, USA.",
              attribution: "Kaiser S, Grosse G, Boike J, Langer M. Monitoring the Transformation of Arctic Landscapes: Automated Shoreline Change Detection of Lakes Using Very High Resolution Imagery. Remote Sensing. 2021; 13(14):2802. https://doi.org/10.3390/rs13142802",
              moreInfoLink: "https://doi.org/10.3390/rs13142802",
              cesiumOptions: { ionAssetId: "634566" },
              colorPalette: {
                paletteType: "categorical",
                colors: [{ color: "#33b1ff" }]
              },
              filters: [{ filterType: "categorical", property: "DN", values: [0] }],
              notification: {
                badge: "Preview",
                style: "yellow",
                message: "Pan-arctic coverage will be available for this layer soon! While the data pipeline is under development, a subset of the data is available here."
              }
            }, {
              label: "Lakes",
              icon: "urn:uuid:c4b53e6f-814d-4c22-a159-a4164daaf86f",
              type: "Cesium3DTileset",
              visible: false,
              description: "The data quantify the abundance and distribution of the permafrost region disturbance (PRD) of lakes and their dynamics, using trend analyses of 30-m-resolution Landsat imagery from 1999-2014 and auxiliary datasets. The dataset spans a transects in Eastern Canada.",
              moreInfoLink: "https://doi.pangaea.de/10.1594/PANGAEA.922808",
              downloadLink: "https://apgc.awi.de/dataset?tags=Lakes&product=Permafrost+Region+Disturbance&tags=Landsat",
              attribution: "Nitze, Ingmar; Grosse, Guido; Jones, Benjamin M; Romanovsky, Vladimir E; Boike, Julia (2018): Remote sensing quantifies widespread abundance of permafrost region disturbances across the Arctic and Subarctic, Datasets. PANGAEA, https://doi.org/10.1594/PANGAEA.894755",
              id: "https://doi.org/10.1594/PANGAEA.922808",
              cesiumOptions: { ionAssetId: "634564" },
              colorPalette: {
                paletteType: "categorical",
                colors: [{ color: "#33b1ff" }]
              },
              notification: {
                badge: "Preview",
                style: "yellow",
                message: "Pan-arctic coverage will be available for this layer soon! While the data pipeline is under development, a subset of the data is available here."
              }
            },
          ]
        }, {
          label: "Permafrost",
          icon: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'><!--!Font Awesome Free 6.5.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.--><path d='M75.8 304.8L1 35.7c-.7-2.5-1-5-1-7.5C0 12.6 12.6 0 28.2 0H482.4C498.8 0 512 13.2 512 29.6c0 1.6-.1 3.3-.4 4.9L434.6 496.1c-1.5 9.2-9.5 15.9-18.8 15.9c-9.2 0-17.1-6.6-18.7-15.6L336 160 307.2 303.9c-1.9 9.3-10.1 16.1-19.6 16.1c-9.2 0-17.2-6.2-19.4-15.1L240 192 210.6 368.2c-1.5 9.1-9.4 15.8-18.6 15.8s-17.1-6.7-18.6-15.8L144 192 115.9 304.3c-2.3 9.2-10.6 15.7-20.1 15.7c-9.3 0-17.5-6.2-20-15.2z'/></svg>",
          layers: [
            // TODO(ianguerin): make this load a geotiff instead!
            {
              label: "Ice-Wedge Polygons (high ice regions)",
              icon: "urn:uuid:73f234f7-a2ae-46b4-9bc2-8d75f69b25a8",
              type: "GeoTIFFProvider",
              visible: true,
              description: "Ice-wedge polygons are ubiquitous ground features in landscapes underlain by ice-rich permafrost. Ice-wedge polygons are bounded by wedges of ice, which develop from millenia of repeated frost-cracking during cold winters and snowmelt water infiltrating into the cracks in spring. High resolution satellite imagery combined with deep learning tools were used to detect ice-wedge polygons across the Arctic tundra. To learn more about how this data was produced, see this publication: https://arcticdata.io/catalog/view/doi:10.18739/A2KW57K57",
              attribution: "Chandi Witharana, Mahendra R Udawalpola, Amal S Perera, Amit Hasan, Elias Manos, Anna Liljedahl, Mikhail Kanevskiy, M Torre Jorgenson, Ronald Daanen, Benjamin Jones, Howard Epstein, Matthew B Jones, Robyn Thiessen-bock, Juliet Cohen, & Kastan Day. (2023). Ice-wedge polygon detection in satellite imagery from pan-Arctic regions, Permafrost Discovery Gateway, 2001-2021. Arctic Data Center. doi:10.18739/A2KW57K57.",
              cesiumOptions: {
                url: "https://arcticdata.io/data/10.18739/A2KW57K57/iwp_geotiff_high/WGS1984Quad/5/5/3.tif",
                tilingScheme: "GeographicTilingScheme",
                rectangle: [-179.91531896747117, 50.16996707215903, 179.91531896747247, 80.0978646943821]
              },
              colorPalette: {
                paletteType: "continuous",
                property: "Percent area covered by polygons",
                colors: [{ color: "#f8ff1f" }]
              },
              layerId: "iwphir",
            }, {
              layerId: "iwplmir",
              label: "Ice Wedge Polygons (low & medium ice regions)",
              icon: "urn:uuid:73f234f7-a2ae-46b4-9bc2-8d75f69b25a8",
              type: "WebMapTileServiceImageryProvider",
              visible: false,
              description: "Ice wedges form polygonal ice networks that enclose cells of frozen ground 3-30 meters in diameter. This layer shows ice wedge polygons across areas with high ice content. This is a small sample from a larger dataset that used high resolution Maxar satellite imagery across the Arctic region to detect ice wedges using a novel high performance image analysis framework. To learn more about how this data was produced, see this publication: https://doi.org/10.5194/isprs-archives-XLIV-M-3-2021-175-2021",
              attribution: "Udawalpola, M. R., Hasan, A., Liljedahl, A., Soliman, A., Terstriep, J., & Witharana, C. (2022). An optimal GeoAI workflow for pan-Arctic permafrost peature detection from high-resolution satellite imagery. Photogrammetric Engineering & Remote Sensing, 88(3), 181-188.",
              cesiumOptions: {
                url: "https://arcticdata.io/data/tiles/10.18739/A24F1MK7Q/web_tiles/iwp_coverage/WGS1984Quad/{TileMatrix}/{TileCol}/{TileRow}.png",
                tilingScheme: "GeographicTilingScheme",
                rectangle: [-179.91531896747117, 50.16996707215903, 179.91531896747247, 80.0978646943821]
              },
              colorPalette: {
                property: "Percent area covered by polygons",
                paletteType: "continuous",
                colors: [{ color: "#f8ff1f" }]
              },
              notification: { badge: "NEW", style: "green" }
            }, {
              layerId: "pe",
              label: "Permafrost Extent",
              icon: "urn:uuid:73f234f7-a2ae-46b4-9bc2-8d75f69b25a8",
              type: "WebMapTileServiceImageryProvider",
              visible: false,
              description: "The pan-Arctic permafrost extent presented as continuous (90-100 % of the area is underlain by permafrost), discontinuous (50-90 %), sporadic (10-50 %), or isolated (<10%) permafrost. Permafrost is ground (soil, sediment, or rock) that remains at or below 0°C for at least two years. ",
              attribution: "Brown, J., O. Ferrians, J. A. Heginbottom, and E. Melnikov. (2002). Circum-Arctic Map of Permafrost and Ground-Ice Conditions, Version 2 [Data Set]. Boulder, Colorado USA. National Snow and Ice Data Center. https://doi.org/10.7265/skbg-kf16. Date Accessed 08-21-2023.",
              cesiumOptions: {
                url: "https://arcticdata.io/data/tiles/10.18739/A2MG7FX35/new/coverage_category/WGS1984Quad/{TileMatrix}/{TileCol}/{TileRow}.png",
                tilingScheme: "GeographicTilingScheme",
                rectangle: [-179.91531896747117, 50.16996707215903, 179.91531896747247, 80.0978646943821]
              },
              opacity: 0.4,
              colorPalette: {
                property: "Permafrost and ice extent",
                paletteType: "categorical",
                colors: [
                  { color: "#17c0d366", label: "Isolated patches", value: 1 },
                  { color: "#179bd366", label: "Sporadic", value: 2 },
                  { color: "#1775d366", label: "Discontinuous", value: 3 },
                  { color: "#154abc66", label: "Continuous", value: 4 }
                ]
              },
              notification: { badge: "NEW", style: "green" }
            }, {
              label: "Biophysical Permafrost Zones",
              icon: "urn:uuid:25d227f8-bc97-403f-a64d-5b76e741f31a",
              type: "Cesium3DTileset",
              visible: false,
              opacity: 0.4,
              description: "This biophysical permafrost zonation map was produced using a rule-based GIS model that integrated a new permafrost extent, climate conditions, vegetation structure, soil and topographic conditions, as well as a yedoma map. Permafrost in this map is classified into five types: climate-driven, climate-driven/ecosystem-modified, climate-driven/ecosystem protected, ecosystem-driven, and ecosystem-protected. 81% of the permafrost regions in the Northern Hemisphere are modified, driven, or protected by ecosystems, indicating the dominant role of ecosystems in permafrost stability in the Northern Hemisphere. Permafrost driven solely by climate occupies 19% of permafrost regions, mainly in High Arctic and high mountains areas, such as the Qinghai-Tibet Plateau.",
              moreInfoLink: "https://iopscience.iop.org/article/10.1088/1748-9326/ac20f3",
              downloadLink: "https://doi.org/10.11888/Geocry.tpdc.271659",
              attribution: "Y.Ran, Y.; M. Torre Jorgenson.; Li, X.; Jin, H.; Wu, T.; Li, R.; Cheng, G. (2021): A biophysical permafrost zonation map in the Northern Hemisphere (2000-2016). National Tibetan Plateau Data Center, https://doi.org/10.11888/Geocry.tpdc.271659",
              cesiumOptions: { ionAssetId: "634560" },
              colorPalette: {
                paletteType: "categorical",
                property: "Type",
                label: "Zone type",
                colors: [
                  { value: "Climate-driven", color: "#FF3720" },
                  { value: "Climate-driven/ecosystem-modified", color: "#0370FE" },
                  { value: "Climate-driven/ecosystem protected", color: "#BFD1FF" },
                  { value: "Ecosystem-driven", color: "#4DE603" },
                  { value: "Ecosystem-protected", color: "#267301" },
                  { value: null, color: "#ffffff" }
                ]
              }
            },
          ]
        }, {
          label: "Base Layers",
          icon: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 576 512'><!--!Font Awesome Free 6.5.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.--><path d='M160 32c-35.3 0-64 28.7-64 64V320c0 35.3 28.7 64 64 64H512c35.3 0 64-28.7 64-64V96c0-35.3-28.7-64-64-64H160zM396 138.7l96 144c4.9 7.4 5.4 16.8 1.2 24.6S480.9 320 472 320H328 280 200c-9.2 0-17.6-5.3-21.6-13.6s-2.9-18.2 2.9-25.4l64-80c4.6-5.7 11.4-9 18.7-9s14.2 3.3 18.7 9l17.3 21.6 56-84C360.5 132 368 128 376 128s15.5 4 20 10.7zM192 128a32 32 0 1 1 64 0 32 32 0 1 1 -64 0zM48 120c0-13.3-10.7-24-24-24S0 106.7 0 120V344c0 75.1 60.9 136 136 136H456c13.3 0 24-10.7 24-24s-10.7-24-24-24H136c-48.6 0-88-39.4-88-88V120z'/></svg>",
          layers: [
            {
              label: "Bing Satellite imagery",
              layerId: 'bsi',
              icon: "urn:uuid:ff153eab-490b-46a4-b11e-47e0592735f6",
              type: "IonImageryProvider",
              visible: false,
              description: "Global satellite imagery down to 15cm resolution in urban areas. This satellite imagery is not what was used to produce the other data layers. Due to the license restrictions associated with the the satellite imagery used to produce the other data layers, we are not able to display it publicly.",
              attribution: "Data provided by Bing Maps &copy;2021 Microsoft Corporation",
              moreInfoLink: "https://www.microsoft.com/maps",
              cesiumOptions: {
                ionAssetId: "2"
              }
            },
            {
              label: "OpenTopoMap",
              icon: "urn:uuid:ff153eab-490b-46a4-b11e-47e0592735f6",
              type: "OpenStreetMapImageryProvider",
              visible: false,
              description: "OpenTopoMap is a free topographic map generated from OpenStreetMap and SRTM elevation data. The map style is based on the official maps and relies on good readability through high contrast and balanced signatures.",
              attribution: "Stefan Erhardt",
              moreInfoLink: "https://opentopomap.org/credits",
              cesiumOptions: {
                url: "https://a.tile.opentopomap.org/"
              },
              opacity: 0.4,
              // Make the base map grayscale
              saturation: 0.1,
              layerId: "otm",
            },
            {
              layerId: "osm",
              label: "OpenStreetMaps",
              icon: "urn:uuid:ff153eab-490b-46a4-b11e-47e0592735f6",
              type: "OpenStreetMapImageryProvider",
              description: "OpenStreetMap is built by a community of mappers that contribute and maintain data about roads, trails, cafés, railway stations, and much more, all over the world.",
              attribution: "OpenStreetMap's community is diverse, passionate, and growing every day. Our contributors include enthusiast mappers, GIS professionals, engineers running the OSM servers, humanitarians mapping disaster-affected areas, and many more.",
              moreInfoLink: "https://www.openstreetmap.org/about",
              // No need to set cesiumOptions since the OSM URL is the default
              // opacity: 0.6,
              // Make the base map grayscale
              // saturation: 0.1,
              visible: true
            }
          ],
        }];

        try {
          if (config && config instanceof Object) {
            function isNonEmptyArray(a) {
              return a && a.length && Array.isArray(a);
            }

            if (isNonEmptyArray(config.layerCategories)) {
              const assetCategories = new AssetCategories(config.layerCategories);
              assetCategories.setMapModel(this);
              this.set("layerCategories", assetCategories);
              this.unset("layers");
            } else if (isNonEmptyArray(config.layers)) {
              this.set("layers", new MapAssets(config.layers));
              this.get("layers").setMapModel(this);
              this.unset("layerCategories");
            }
            if (isNonEmptyArray(config.terrains)) {
              this.set("terrains", new MapAssets(config.terrains));
            }

            this.set('zoomPresetsCollection', new ZoomPresets({
              zoomPresetObjects: config.zoomPresets,
              allLayers: this.getAllLayers(),
            }, { parse: true }));
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
       * since 2.28.0
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
       * Reset the visibility of all layers to the value that was in the intial
       * configuration.
       */
      resetLayerVisibility: function () {
        for (const layer of this.getAllLayers()) {
          layer.set("visible", layer.get('originalVisibility'));
        }
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
       * @returns {MapAssets[]} When layerCategories are configured, each MapAssets
       * represets layers from one category. When layerCategories doesn't exist, flat
       * layers are used and the array includes exactly one MapAssets with all
       * the layers. Returns an empty array if no layer are found.
       */
      getLayerGroups() {
        if (this.has("layerCategories")) {
          return this.get("layerCategories").getMapAssets();
        } else if (this.has("layers")) {
          return [this.get("layers")];
        }
        return [];
      },

      /**
       * Get all of the layers regardless of presences of layerCategories in a
       * flat list of MapAsset models.
       * @returns {MapAsset[]} All of the layers, or empty array if no layers
       * are configured.
       * @since 2.29.0
       */
      getAllLayers() {
        if (this.has("layerCategories")) {
          return this.get("layerCategories")
            .getMapAssets()
            .map(assets => assets.models)
            .flat();
        } else if (this.has("layers")) {
          return this.get("layers").models;
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
