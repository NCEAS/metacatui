"use strict";

define([
  "underscore",
  "backbone",
  "models/portals/PortalImage",
  "models/maps/AssetColorPalette",
  "common/IconUtilities",
  "common/SearchParams",
  `${MetacatUI.root}/components/dayjs.min.js`,
], (
  _,
  Backbone,
  PortalImage,
  AssetColorPalette,
  IconUtilities,
  SearchParams,
  dayjs,
) => {
  /**
   * @classdesc A MapAsset Model comprises information required to fetch source data for
   * some asset or resource that is displayed in a map, such as imagery (raster) tiles,
   * vector data, a 3D tileset, or a terrain model. This model also contains metadata
   * about the source data, like an attribution and a description. It represents the
   * most generic type of asset, and can be extended to support specific assets that are
   * compatible with a given map widget.
   * @classcategory Models/Maps/Assets
   * @class MapAsset
   * @name MapAsset
   * @augments Backbone.Model
   * @since 2.18.0
   * @class
   */
  const MapAsset = Backbone.Model.extend(
    /** @lends MapAsset.prototype */ {
      /**
       * The name of this type of model
       * @type {string}
       */
      type: "MapAsset",

      /**
       * Default attributes for MapAsset models
       * @name MapAsset#defaults
       * @type {object}
       * @property {('Cesium3DTileset'|'BingMapsImageryProvider'|'IonImageryProvider'|'WebMapTileServiceImageryProvider'|'TileMapServiceImageryProvider'|'CesiumTerrainProvider')} type
       * The format of the data. Must be one of the supported types.
       * @property {string} label A user friendly name for this asset, to be displayed
       * in a map.
       * @property {string} [icon] A PID for an SVG saved as a dataObject, or an SVG
       * string. The SVG will be used as an icon that will be displayed next to the label
       * in the layers list. It should be an SVG file that has no fills, borders, or styles
       * set on it (since the icon will be shaded dynamically by the maps CSS using a fill
       * attribute). It must use a viewbox property rather than a height and width. When
       * not specified, a layer icon is used as default.
       * @property {string} [description = ''] A brief description about the asset, e.g.
       * which area it covers, the resolution, etc.
       * @property {string} [attribution = ''] A credit or attribution to display along
       * with this map resource.
       * @property {string} [moreInfoLink = ''] A link to show in a map where a user can
       * find more information about this resource.
       * @property {string} [downloadLink = ''] A link to show in a map where a user can
       * go to download the source data.
       * @property {string} [id = ''] If this asset's data is archived in a DataONE
       * repository, the ID of the data package.
       * @property {boolean} [selected = false] Set to true when this asset has been
       * selected by the user in the layer list.
       * @property {number} [opacity = 1] A number between 0 and 1 indicating the
       * opacity of the layer on the map, with 0 representing fully transparent and 1
       * representing fully opaque. This applies to raster (imagery) and vector assets,
       * not to terrain assets.
       * @property {number} [saturation = 1] A number that indicates the saturation of
       * the layer on the map. Less than 1.0 reduces the saturation while greater than
       * 1.0 increases it. This applies to raster (imagery) only.
       * @property {boolean} [visible = true] Set to true if the layer is visible on the
       * map, false if it is hidden. This applies to raster (imagery) and vector assets,
       * not to terrain assets.
       * @property {boolean} [configuredVisibility = true] Tracks the original
       * visibility value according to the portal configuration and ignoring any
       * search query parameters in the URL which can affect the layer's initial
       * visibility.
       * @property {AssetColorPalette} [colorPalette] The color or colors mapped to
       * attributes of this asset. This applies to raster/imagery and vector assets. For
       * imagery, the colorPalette will be used to create a legend. For vector assets
       * (e.g. 3Dtilesets), it will also be used to style the features.
       * @property {MapConfig#FeatureTemplate} [featureTemplate] Configuration for
       * content and layout of the Feature Info panel - the panel that shows information
       * about a selected feature from a vector asset ({@link FeatureInfoView}).
       * @property {Cesium.Entity|Cesium.Cesium3DTilesetFeature} [featureType] For vector
       * and 3d tileset assets, the object type that cesium uses to represent features
       * from the asset. Null for imagery and terrain assets.
       * @property {MapConfig#CustomProperties} [customProperties] Configuration that
       * allows for the definition of custom feature properties, potentially based on
       * other properties. For example, a custom property could be a formatted version
       * of an existing date property.
       * @property {MapConfig#Notification} [notification] A custom badge and message to
       * display about the layer in the Layer list. For example, this could highlight
       * the layer if it is new, give a warning if they layer is under development, etc.
       * @property {'ready'|'error'|null} [status = null] Set to 'ready' when the
       * resource is loaded and ready to be rendered in a map view. Set to 'error' when
       * the asset is not supported, or there was a problem requesting the resource.
       * @property {string} [statusDetails = null] Any further details about the status,
       * especially when there was an error.
       * @property {boolean} [hideInLayerList = false] Set to true to hide this asset
       * from the layer list.
       */
      defaults() {
        return {
          type: "",
          label: "",
          icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24"><path d="m3.2 7.3 8.6 4.6a.5.5 0 0 0 .4 0l8.6-4.6a.4.4 0 0 0 0-.8L12.1 3a.5.5 0 0 0-.4 0L3.3 6.5a.4.4 0 0 0 0 .8Z"></path><path d="M20.7 10.7 19 9.9l-6.7 3.6a.5.5 0 0 1-.4 0L5 9.9l-1.8.8a.5.5 0 0 0 0 .8l8.5 5a.5.5 0 0 0 .5 0l8.5-5a.5.5 0 0 0 0-.8Z"></path><path d="m20.7 15.1-1.5-.7-7 3.8a.5.5 0 0 1-.4 0l-7-3.8-1.5.7a.5.5 0 0 0 0 .9l8.5 5a.5.5 0 0 0 .5 0l8.5-5a.5.5 0 0 0 0-.9Z"></path></svg>',
          description: "",
          attribution: "",
          moreInfoLink: "",
          downloadLink: "",
          selected: false,
          opacity: 1,
          saturation: 1,
          visible: true,
          configuredVisibility: true,
          colorPalette: null,
          customProperties: {},
          featureTemplate: {},
          featureType: null,
          notification: {},
          status: null,
          statusDetails: null,
          hideInLayerList: false,
        };
      },

      /**
       * The source of a specific asset (i.e. layer or terrain data) to show on the map,
       * as well as metadata and display properties of the asset. Some properties listed
       * here do not apply to all asset types, but this is specified in the property
       * description.
       * @typedef {object} MapAssetConfig
       * @name MapConfig#MapAssetConfig
       * @property {('Cesium3DTileset'|'BingMapsImageryProvider'|'IonImageryProvider'|'WebMapTileServiceImageryProvider'|'WebMapServiceImageryProvider'|'TileMapServiceImageryProvider'|'NaturalEarthII'|'CesiumTerrainProvider'|'GeoJsonDataSource'|'USGSImageryTopo'|'OpenStreetMapImageryProvider')} type -
       * A string indicating the format of the data. Some of these types correspond
       * directly to Cesium classes. The NaturalEarthII type is a special imagery layer
       * that automatically sets the cesiumOptions to load the Natural Earth II imagery
       * that is shipped with Cesium/MetacatUI. If this type is set, then no other
       * cesiumOptions are required. The same is true for USGSImageryTopo, which pulls
       * imagery directly from USGS.
       * @property {(Cesium3DTileset#cesiumOptions|CesiumImagery#cesiumOptions|CesiumTerrain#cesiumOptions|CesiumVectorData#cesiumOptions)} [cesiumOptions] -
       * For MapAssets that are configured for Cesium, like
       * Cesium3DTilesets, an object with options to pass to the Cesium constructor
       * function that creates the Cesium model. Options are specific to each type of
       * asset. For details, see documentation for each of the types.
       * @property {string} label - A user friendly name for this asset, to be displayed
       * in a map.
       * @property {string} [icon] - A PID for an SVG saved as a dataObject, or an SVG
       * string. The SVG will be used as an icon that will be displayed next to the
       * label in the layers list. It should be an SVG file that has no fills, borders,
       * or styles set on it (since the icon will be shaded dynamically by the maps CSS
       * using a fill attribute). It must use a viewbox property rather than a height
       * and width.
       * @property {number} [opacity=1] - A number between 0 and 1 indicating the
       * opacity of the layer on the map, with 0 representing fully transparent and 1
       * representing fully opaque. This applies to raster (imagery) and vector assets,
       * not to terrain assets.
       * @property {number} [saturation=1] - A number that indicates the saturation of
       * the layer on the map. Less than 1.0 reduces the saturation while greater than
       * 1.0 increases it. This applies to raster (imagery) only.
       * @property {boolean} [visible=true] - Set to true if the layer is visible on the
       * map, false if it is hidden. This applies to raster (imagery) and vector assets,
       * not to terrain assets.
       * @property {string} [description] - A brief description about the asset, e.g.
       * which area it covers, the resolution, etc.
       * @property {string} [attribution] A credit or attribution to display along with
       * this asset.
       * @property {string} [moreInfoLink] A complete URL used to create a link to show
       * in a map where a user can find more information about this resource.
       * @property {string} [downloadLink]  A complete URL used to show a link in a map
       * where a user can go to download the source data.
       * @property {string} [id] If this asset's data is archived in a DataONE
       * repository, the ID of the data package.
       * @property {MapConfig#ColorPaletteConfig} [colorPalette] The color or colors
       * mapped to attributes of this asset. This applies to raster/imagery and vector
       * assets. For imagery, the colorPalette will be used to create a legend. For
       * vector assets (e.g. 3Dtilesets), it will also be used to style the features.
       * @property {MapConfig#FeatureTemplate} [featureTemplate] Configuration for the
       * content and layout of the Feature Info panel ({@link FeatureInfoView}) - the
       * panel that shows information about a selected feature from a vector asset. If
       * no feature template is set, then the default table layout is used.
       * @property {MapConfig#CustomProperties} [customProperties] Definitions of custom
       * properties of features, potentially based on existing properties. For example,
       * a custom property could be a formatted version of another date property. These
       * custom properties can be used in the filters, colorPalette, or featureTemplate.
       * So far, custom strings and formatted dates are supported. Eventually, the
       * custom properties may be expanded to support formatted numbers and booleans.
       * @property {MapConfig#VectorFilterConfig} [filters] - A set of conditions used
       * to show or hide specific features of this tileset.
       * @property {MapConfig#Notification} [notification] A custom badge and message to
       * display about the layer in the Layer list. For example, this could highlight
       * the layer if it is new, give a warning if they layer is under development, etc.
       * @property {boolean} [hideInLayerList] - Set to true to hide this asset from the
       * layer list.
       */

      /**
       * A feature template configures the format and content of information displayed
       * in the Feature Info panel ({@link FeatureInfoView}). The Feature Info panel is
       * displayed in a map when a user clicks on a vector feature in a map.
       * @typedef {object} FeatureTemplate
       * @name MapConfig#FeatureTemplate
       * @since 2.19.0
       * @property {'story'|'table'} [template='table'] The name/ID of the template to
       * use. This must match the name of one of the templates available in
       * {@link FeatureInfoView#contentTemplates}.
       * @property {string} [label] Sets which of the feature properties to use as the
       * title for the FeatureInfoView. The string must exactly match the key for a
       * property that exists in the feature.
       * @property {MapConfig#StoryTemplateOptions} [options] A list of key-value pairs
       * that map the template variable to a property/attribute of the the feature. Keys
       * are the template variable names and values are the names of properties in the
       * feature. Template variable names are specific to each template. Currently only
       * the 'story' template allows variables. These are specified in the
       * {@link FeatureInfoView#contentTemplates}.
       * @example
       * // Use the "story" template, which shows a secondary title, image, description,
       * // and link.
       * {
       *   "template": "story",
       *   "label": "title",
       *   "options": {
       *     "subtitle": "formattedDate",
       *     "description": "summary",
       *     "thumbnail": "imageSrc",
       *     "url": "newsLink",
       *     "urlText": "newsTitle",
       *   }
       * }
       * @example
       * // Use the default template (a table), but use the "forestName" attribute for
       * // the FeatureInfo panel label
       * {
       *   "label": "forestName"
       * }
       */

      /**
       * An object that maps template variable to feature properties for the "story"
       * template.
       * @typedef {object} StoryTemplateOptions
       * @name MapConfig#StoryTemplateOptions
       * @since 2.19.0
       * @property {string} subtitle The name of a feature property to use for a
       * secondary title in the template
       * @property {string} description The name of a feature property that contains a
       * brief summary or description of the feature; displayed as a paragraph.
       * @property {string} thumbnail The name of a feature property that contains a URL
       * for an image. Displayed as a thumbnail next to the description.
       * @property {string} url The name of a feature property with a URL to use to
       * create a link (e.g. to learn more information about the given feature)
       * @property {string} urlText The name of a feature property that has text to
       * display for the url. Defaults to 'Read More' if none is set.
       */

      /**
       * An object where the keys indicate the name/ID of the new custom property to
       * create, and the values are an object that defines the new property.
       * @typedef {{string: (MapConfig#CustomDateProperty|MapConfig#CustomStringProperty)}} CustomProperties
       * @name MapConfig#CustomProperties
       * @since 2.19.0
       * @example
       * {
       *   "year": {
       *     "type": "date",
       *     "property": "dateTime",
       *     "format": "YYYY",
       *   },
       *   "urlText": {
       *     "type": "string",
       *     "value": "Click here to learn more about this feature"
       *   }
       * }
       */

      /**
       * An object that defines a formatted date to use as a property in a feature. Used
       * in the {@link MapConfig#CustomProperties} object.
       * @typedef {object} CustomDateProperty
       * @name MapConfig#CustomDateProperty
       * @since 2.19.0
       * @property {'date'} type Must be set to 'date' to indicate that this is a custom
       * date property
       * @property {string} property The name/ID of the existing date property to format
       * @property {string} format A string that indicates the new format to use.
       * Follows the syntax used by Day.JS, see
       * {@link https://day.js.org/docs/en/display/format}
       */

      /**
       * An object that defines a custom string to use as a property in a feature. Used
       * in the {@link MapConfig#CustomProperties} object.
       * @typedef {object} CustomStringProperty
       * @name MapConfig#CustomStringProperty
       * @since 2.19.0
       * @property {'string'} type Must be set to 'string' to indicate that this is a
       * custom string property
       * @property {string} value The new string to use. So far only static strings are
       * available. In the future, templates that include other properties may be
       * supported.
       */

      /**
       * A notification displays a badge in the {@link LayerListView} and a message in
       * the {@link LayerDetailsView}. This is useful for indicating some special status
       * of the layer: "new", "under development", etc.
       * @typedef {object} Notification
       * @name MapConfig#Notification
       * @since 2.22.0
       * @property {'yellow'|'green'|'blue'|'contrast'} [style] - The badge and message
       * color. If none is set, then notification elements will be similar to the
       * background colour (subtle).
       * @property {string} badge - The text to display in the badge element next to the
       * layer label in the list. This badge should be as few characters as possible.
       * @property {string} message - A longer message to display explaining the status.
       */

      /**
       * Executed when a new MapAsset model is created.
       * @param {MapConfig#MapAssetConfig} [assetConfig] The initial values of the
       * attributes, which will be set on the model.
       */
      initialize(assetConfig) {
        const model = this;

        const assetConfigCopy =
          !assetConfig || typeof assetConfig !== "object" ? {} : assetConfig;

        // Set the color palette
        if (assetConfigCopy.colorPalette) {
          const label = assetConfigCopy.colorPalette.label
            ? assetConfigCopy.colorPalette.label
            : assetConfigCopy.label;
          this.set(
            "colorPalette",
            new AssetColorPalette(
              _.extend(assetConfigCopy.colorPalette, { label }),
            ),
          );
        }

        // Fetch the icon, if there is one
        if (assetConfigCopy.icon) {
          try {
            if (IconUtilities.isSVG(assetConfigCopy.icon)) {
              model.updateIcon(assetConfigCopy.icon);
            } else {
              model.set("iconStatus", "fetching");
              // If the string is not an SVG then assume it is a PID and try to fetch
              // the SVG file.
              IconUtilities.fetchIcon(assetConfigCopy.icon).then((icon) =>
                model.updateIcon(icon),
              );
            }
          } catch (error) {
            model.set("iconStatus", "error");
          }
        }

          this.on("change:visible", ({ changed: { visible } }) => {
            const layerId = this.get("layerId");
            if (!(this.get("mapModel")?.get("showShareUrl") && layerId)) return;

            if (visible) {
              SearchParams.addEnabledLayer(layerId);
            } else {
              SearchParams.removeEnabledLayer(layerId);
            }
          });

          this.setListeners();
      },

      /**
       * Set an error status and message for this asset.
       * @param {object | string} error - An error object with a status code
       * attribute or or string with details about the error.
       * @since 2.27.0
       */
      setError(error) {
        // See https://cesium.com/learn/cesiumjs/ref-doc/RequestErrorEvent.html
        let details = error;
        // Write a helpful error message
        switch (error.statusCode) {
          case 404:
            details = "The resource was not found (error code 404).";
            break;
          case 500:
            details = "There was a server error (error code 500).";
            break;
          default:
        }
        this.set("status", "error");
        this.set("statusDetails", details);
      },

      /**
       * Set a ready status for this asset.
       * @since 2.27.0
       */
      setReady() {
        this.set("status", "ready");
        this.set("statusDetails", null);
      },

      /**
       * When the asset can't be loaded, hide it from the map and show an error.
       * @since 2.27.0
       */
      handleError() {
        this.set("visible", false);
        this.stopListening(this, "change:visible");
      },

      /**
       * Set all of the listeners for this model
       * @since 2.27.0
       */
      setListeners() {
        const status = this.get("status");
        if (status === "error") {
          this.handleError();
          return;
        }
        const vis = this.get("originalVisibility");
        if (typeof vis === "boolean") {
          this.set("visible", vis);
        }

        // The map asset cannot be visible on the map if there was an error
        // loading the asset
        this.stopListening(this, "change:status");
        this.listenTo(this, "change:status", this.setListeners);

        // Listen for changes to the cesiumOptions object
        this.stopListening(this, "change:cesiumOptions");
        this.listenTo(this, "change:cesiumOptions", () => {
          this.createCesiumModel(true);
        });

        this.listenToSelectedFeatures();
      },

      /**
       * Update the appearance of features from this asset when they are
       * selected or deselected in the map widget.
       * @since 2.27.0
       */
      listenToSelectedFeatures() {
        if (typeof this.updateAppearance !== "function") {
          return;
        }

        const mapModel = this.get("mapModel");
        if (!mapModel) {
          this.listenToOnce(
            this,
            "change:mapModel",
            this.listenToSelectedFeatures,
          );
          return;
        }

        const interactions = mapModel.get("interactions");

        if (!interactions) {
          this.listenToOnce(
            mapModel,
            "change:interactions",
            this.listenToSelectedFeatures,
          );
          return;
        }

        const selectedFeatures = mapModel.getSelectedFeatures();

        if (selectedFeatures) {
          this.stopListening(selectedFeatures, "update");
          this.listenTo(selectedFeatures, "update", this.updateAppearance);
        }

        // Reset the listeners if the selectedFeatures collection or the
        // interactions model is replaced
        this.listenToOnce(interactions, "change:selectedFeatures", () => {
          this.updateAppearance();
          this.listenToSelectedFeatures();
        });

        this.listenToOnce(mapModel, "change:interactions", () => {
          this.updateAppearance();
          this.listenToSelectedFeatures();
        });
      },

      /**
       * Get the asset config's cesiumOptions, if it has any. This will return
       * a copy of the cesiumOptions object, so that changes made to the
       * returned object will not affect the original cesiumOptions object.
       * @returns {object} A copy of the cesiumOptions object, or null if there
       * are no cesiumOptions.
       * @since 2.26.0
       */
      getCesiumOptions() {
        const cesiumOptions = this.get("cesiumOptions");
        if (!cesiumOptions) {
          return null;
        }
        return JSON.parse(JSON.stringify(cesiumOptions));
      },

      /**
       * Given a feature object from a Feature model, checks if it is part of the
       * selectedFeatures collection. See featureObject property from
       * {@link Feature#defaults}. For vector and 3d tile models only.
       * @param {*} feature - An object that a Map widget uses to represent this feature
       * in the map, e.g. a Cesium.Entity or a Cesium.Cesium3DTileFeature
       * @returns {boolean} Returns true if the given feature is part of the
       * selectedFeatures collection in this asset
       */
      featureIsSelected(feature) {
        const map = this.get("mapModel");
        if (!map) {
          return false;
        }
        const selectedFeatures = map.getSelectedFeatures();
        if (!selectedFeatures) {
          return false;
        }
        const isSelected = selectedFeatures.containsFeature(feature);
        return isSelected;
      },

      /**
       * Checks if a feature from the map (a Cesium object) is the type of
       * feature that this map asset model contains. For example, if a
       * Cesium3DTilesetFeature is passed to this function, this function
       * will return true if it is a Cesium3DTileset model, and false if it
       * is a CesiumVectorData model.
       * @param {Cesium.Cesium3DTilesetFeature|Cesium.Entity} feature feature to be checked.
       * @returns {boolean} true if the feature is an instance of the feature
       * type set on the asset model, false otherwise.
       * @since 2.25.0
       */
      usesFeatureType(feature) {
        const ft = this.get("featureType");
        if (!feature || !ft) return false;
        if ((!feature) instanceof ft) return false;
        return true;
      },

      /**
       * Given a feature object from a Feature model, checks if it is part of the
       * selectedFeatures collection. See featureObject property from
       * {@link Feature#defaults}. For vector and 3d tile models only.
       * @param {*} feature - An object that a Map widget uses to represent this feature
       * in the map, e.g. a Cesium.Entity or a Cesium.Cesium3DTileFeature
       * @returns {boolean} Returns true if the given feature is part of the
       * selectedFeatures collection in this asset
       * @since 2.25.0
       */
      containsFeature(feature) {
        if (!this.usesFeatureType(feature)) return false;
        if (!this.getCesiumModelFromFeature) return false;
        const cesiumModel = this.getCesiumModelFromFeature(feature);
        if (!cesiumModel) return false;
        if (this.get("cesiumModel") === cesiumModel) return true;
        return false;
      },

      /**
       * Given a feature object from a Feature model, returns the attributes
       * needed to create a Feature model. For vector and 3d tile models only.
       * @param {*} feature - An object that a Map widget uses to represent this feature
       * in the map, e.g. a Cesium.Entity or a Cesium.Cesium3DTileFeature
       * @returns {object} An object with properties, mapAsset, featureID, featureObject,
       * and label properties. Returns null if the feature is not the correct type
       * for this asset model.
       */
      getFeatureAttributes(feature) {
        if (!this.usesFeatureType(feature)) return null;
        if (!this.getCesiumModelFromFeature) return null;
        return {
          properties: this.getPropertiesFromFeature(feature),
          mapAsset: this,
          featureID: this.getIDFromFeature(feature),
          featureObject: feature,
          label: this.getLabelFromFeature(feature),
        };
      },

      /**
       * Given a set of properties from a Feature from this Map Asset model, add any
       * custom properties to the properties object and return it.
       * @since 2.19.0
       * @param {object} properties A set of key-value pairs representing the existing
       * properties of a feature from this asset.
       * @returns {object} The properties object with any custom properties added.
       */
      addCustomProperties(properties) {
        const model = this;
        const customProperties = model.get("customProperties");
        const formattedProperties = {};

        if (!customProperties || !Object.keys(customProperties).length) {
          return properties;
        }

        const propertiesCopy =
          properties && typeof properties === "object" ? properties : {};

        if (customProperties) {
          _.each(customProperties, (config, key) => {
            let formattedValue = "";
            if (config.type === "date") {
              formattedValue = model.formatDateProperty(config, propertiesCopy);
              // TODO: support formatted numbers and booleans...
              // } else if (config.type === 'number') {
              //   formattedValue = model.formatNumberProperty(config, properties)
              // } else if (config.type === 'boolean') {
              //   formattedValue = model.formatBooleanProperty(config, properties)
            } else {
              formattedValue = model.formatStringProperty(config);
            }
            formattedProperties[key] = formattedValue;
          });
        }
        // merge the properties with the formatted properties
        return Object.assign(propertiesCopy, formattedProperties);
      },

      /**
       * Given a definition for a new date property, and the properties that already
       * exist on a specific feature, returns a new string with the formatted date.
       * @since 2.19.0
       * @param {MapConfig#CustomDateProperty} config - An object that defines the new
       * date property to create
       * @param {object} properties key-value pairs representing existing properties in
       * a Feature
       * @returns {string} The value for the new date property, formatted as defined by
       * config, for the given feature
       */
      formatDateProperty(config, properties) {
        const propertiesCopy = properties || {};
        let formattedDate = "";
        if (!config || !config.format) {
          return formattedDate;
        }
        const value = propertiesCopy[config.property];
        if (value) {
          formattedDate = dayjs(value).format(config.format);
        }
        return formattedDate;
      },

      /**
       * For a given set of Feature properties and a definition for a new sting
       * property, returns the value of the custom property. Note that since only static
       * strings are supported so far, this function essentially just returns the value
       * of config.value. This function exists to allow support of dynamic strings in
       * the future (e.g. combining strings from existing properties)
       * @since 2.19.0
       * @param {MapConfig#CustomStringProperty} config The object the defines the new
       * custom property
       * @returns {string} The new string for the given Feature property
       */
      formatStringProperty(config) {
        let formattedString = "";
        if (!config || !config.value) {
          return formattedString;
        }
        formattedString = config.value;
        return formattedString;
      },

      // formatNumberProperty: function (config, properties) {
      //   try {
      //     if (!properties) {
      //       properties = {}
      //     }
      //     let formattedNumber = ''
      //     // TODO...
      //   }
      //   catch (error) {
      //     console.log(
      //       'There was an error formatting a number for a Feature model' +
      //       '. Error details: ' + error
      //     );
      //     return '';
      //   }
      // },

      // formatBooleanProperty: function (config, properties) {
      //   try {
      //     if (!properties) {
      //       properties = {}
      //     }
      //     let formattedBoolean = ''
      //     // TODO...
      //   }
      //   catch (error) {
      //     console.log(
      //       'There was an error formatting a boolean for a Feature model' +
      //       '. Error details: ' + error
      //     );
      //     return '';
      //   }
      // },

      /**
       * Sanitizes an SVG string and updates the model's 'icon' attribute the sanitized
       * string. Also sets the 'iconStatus' attribute to 'success'.
       * @param {string} icon An SVG string to use for the MapAsset icon
       */
      updateIcon(icon) {
        if (!icon) return;

        this.set("icon", IconUtilities.sanitizeIcon(icon));
        this.set("iconStatus", "success");
      },

      /**
       * Resets the Map Asset's status and statusDetails attributes to their default
       * values.
       * @since 2.21.0
       */
      resetStatus() {
        const defaults = this.defaults();
        this.set("status", defaults.status);
        this.set("statusDetails", defaults.statusDetails);
      },

      /**
       * Checks if the asset information has been fetched and is ready to use.
       * @returns {Promise} Returns a promise that resolves to this model when ready.
       */
      whenReady() {
        const model = this;
        return new Promise((resolve) => {
          if (model.get("status") === "ready") {
            resolve(model);
            return;
          }
          model.stopListening(model, "change:status");
          model.listenTo(model, "change:status", () => {
            if (model.get("status") === "ready") {
              model.stopListening(model, "change:status");
              resolve(model);
            }
          });
        });
      },

      /**
       * Given properties of a Feature model from this MapAsset, returns the color
       * associated with that feature.
       * @param {object} properties The properties of the feature to get the color for;
       * An object containing key-value mapping of property names to properties. (See
       * the 'properties' attribute of {@link Feature#defaults}.)
       * @returns {AssetColor#Color} The color associated with the given set of
       * properties.
       */
      getColor(properties) {
        const model = this;
        const colorPalette = model.get("colorPalette");
        return (
          colorPalette?.getColor(properties) ||
          new AssetColorPalette().getDefaultColor()
        );
      },

      /**
       * This function checks whether a feature from the MapAsset is visible on the map
       * based on the properties of the feature and the MapAsset's filter settings.
       * @param {object} properties The properties of the feature to be filtered. (See
       * the 'properties' attribute of {@link Feature#defaults}.)
       * @returns {boolean} Returns true if the feature passes all the filters, or if
       * there are no filters set for this MapAsset. Returns false if the feature fails
       * any of the filters.
       */
      featureIsVisible(properties) {
        const model = this;
        const filters = model.get("filters");
        if (filters && filters.length) {
          return filters.featureIsVisible(properties);
        }
        return true;
      },

      /**
       * Indicate that the map widget should navigate to a given target from
       * this MapAsset.
       * @param {MapConfig#CameraPosition} target The target to navigate to.
       * @since 2.27.0
       */
      zoomTo(target) {
        this.get("mapModel")?.zoomTo(target);
      },

      /**
       * Checks that the visible attribute is set to true and that the opacity attribute
       * is greater than zero. If both conditions are met, returns true.
       * @returns {boolean} Returns true if the MapAsset has opacity > 0 and is visible.
       */
      isVisible() {
        if (this.get("temporarilyHidden") === true) return false;
        return this.get("visible") && this.get("opacity") > 0;
      },

      /**
       * Make sure the layer is visible. Sets visibility to true if false, and sets
       * opacity to 0.5 if it's less than 0.05.
       */
      show() {
        // If the opacity is very low, set it to 50%
        if (this.get("opacity") < 0.05) {
          this.set("opacity", 0.5);
        }
        // Make sure the layer is visible
        if (this.get("visible") === false) {
          this.set("visible", true);
        }
      },
    },
  );

  return MapAsset;
});
