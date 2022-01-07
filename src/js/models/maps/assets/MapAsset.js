'use strict';

define(
  [
    'jquery',
    'underscore',
    'backbone',
    'models/portals/PortalImage',
    'models/maps/AssetColorPalette',
    MetacatUI.root + '/components/dayjs.min.js'
  ],
  function (
    $,
    _,
    Backbone,
    PortalImage,
    AssetColorPalette,
    dayjs
  ) {
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
     * @extends Backbone.Model
     * @since 2.18.0
     * @constructor
    */
    var MapAsset = Backbone.Model.extend(
      /** @lends MapAsset.prototype */ {

        /**
         * The name of this type of model
         * @type {string}
        */
        type: 'MapAsset',

        /**
         * Default attributes for MapAsset models
         * @name MapAsset#defaults
         * @type {Object}
         * @property {('Cesium3DTileset'|'BingMapsImageryProvider'|'IonImageryProvider'|'TileMapServiceImageryProvider'|'CesiumTerrainProvider')} type
         * The format of the data. Must be one of the supported types.
         * @property {string} label A user friendly name for this asset, to be displayed
         * in a map.
         * @property {string} [icon = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M1.2 13.7 3.6 3.5l7.2 8.7zM5 3.3c2 .3 3.5.4 4.4.4H13l3 6.3-4 1.8-7-8.5Zm9.1.6 2.8 6 4.5-2.2a23 23 0 0 1-.7-4c0-.8-1.2-.7-2-.7l-4.6.9ZM1 15l11-1.9c1.2-.3 2.7-1 4.2-2l2.5 5.2c-1.2.3-3.6.4-7.3.4-2.8 0-7.3 0-9.4-.8a2 2 0 0 1-1-.9Zm16.4-4.2 4-1.8 1.3 5.5c0 .4.1 1-.4 1.2l-2.5.5-2.4-5.4ZM1.7 17l-.5 2.6c0 .7.2 1 1 1.3a64.1 64.1 0 0 0 19.8 0c.4-.3 1-.5.7-1.6l-.5-2.3a52.6 52.6 0 0 1-20.6 0Z"/></svg>']
         * A PID for an SVG saved as a dataObject, or an SVG string. The SVG will be used
         * as an icon that will be displayed next to the label in the layers list. It
         * should be an SVG file that has no fills, borders, or styles set on it (since
         * the icon will be shaded dynamically by the maps CSS using a fill attribute). It
         * must use a viewbox property rather than a height and width.
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
         * @property {Boolean} [selected = false] Set to true when this asset has been
         * selected by the user in the layer list.
         * @property {Number} [opacity = 1] A number between 0 and 1 indicating the
         * opacity of the layer on the map, with 0 representing fully transparent and 1
         * representing fully opaque. This applies to raster (imagery) and vector assets,
         * not to terrain assets.
         * @property {Boolean} [visible = true] Set to true if the layer is visible on the
         * map, false if it is hidden. This applies to raster (imagery) and vector assets,
         * not to terrain assets.
         * @property {AssetColorPalette} [colorPalette] The color or colors mapped to
         * attributes of this asset. This applies to raster/imagery and vector assets. For
         * imagery, the colorPalette will be used to create a legend. For vector assets
         * (e.g. 3Dtilesets), it will also be used to style the features.
         * @property {MapConfig#FeatureTemplate} [featureTemplate] Configuration for
         * content and layout of the Feature Info panel - the panel that shows information
         * about a selected feature from a vector asset ({@link FeatureInfoView}).
         * @property {MapConfig#CustomProperties} [customProperties] Configuration that
         * allows for the definition of custom feature properties, potentially based on
         * other properties. For example, a custom property could be a formatted version
         * of an existing date property.
         * @property {'ready'|'error'|null} [status = null] Set to 'ready' when the
         * resource is loaded and ready to be rendered in a map view. Set to 'error' when
         * the asset is not supported, or there was a problem requesting the resource.
         * @property {string} [statusDetails = null] Any further details about the status,
         * especially when there was an error.
        */
        defaults: function () {
          return {
            type: '',
            label: '',
            icon: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M1.2 13.7 3.6 3.5l7.2 8.7zM5 3.3c2 .3 3.5.4 4.4.4H13l3 6.3-4 1.8-7-8.5Zm9.1.6 2.8 6 4.5-2.2a23 23 0 0 1-.7-4c0-.8-1.2-.7-2-.7l-4.6.9ZM1 15l11-1.9c1.2-.3 2.7-1 4.2-2l2.5 5.2c-1.2.3-3.6.4-7.3.4-2.8 0-7.3 0-9.4-.8a2 2 0 0 1-1-.9Zm16.4-4.2 4-1.8 1.3 5.5c0 .4.1 1-.4 1.2l-2.5.5-2.4-5.4ZM1.7 17l-.5 2.6c0 .7.2 1 1 1.3a64.1 64.1 0 0 0 19.8 0c.4-.3 1-.5.7-1.6l-.5-2.3a52.6 52.6 0 0 1-20.6 0Z"/></svg>',
            description: '',
            attribution: '',
            moreInfoLink: '',
            downloadLink: '',
            id: '',
            selected: false,
            opacity: 1,
            visible: true,
            colorPalette: null,
            customProperties: {},
            featureTemplate: {},
            status: null,
            statusDetails: null
          }
        },

        /**
         * The source of a specific asset (i.e. layer or terrain data) to show on the map,
         * as well as metadata and display properties of the asset. Some properties listed
         * here do not apply to all asset types, but this is specified in the property
         * description.
         * @typedef {Object} MapAssetConfig
         * @name MapConfig#MapAssetConfig
         * @property {('Cesium3DTileset'|'BingMapsImageryProvider'|'IonImageryProvider'|'TileMapServiceImageryProvider'|'NaturalEarthII'|'CesiumTerrainProvider'|'GeoJsonDataSource')} type - 
         * A string indicating the format of the data. Some of these types correspond
         * directly to Cesium classes. The NaturalEarthII type is a special imagery layer
         * that automatically sets the cesiumOptions to load the Natural Earth II imagery
         * that is shipped with Cesium/MetacatUI. If this type is set, then no other
         * cesiumOptions are required.
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
         * @property {Number} [opacity=1] - A number between 0 and 1 indicating the
         * opacity of the layer on the map, with 0 representing fully transparent and 1
         * representing fully opaque. This applies to raster (imagery) and vector assets,
         * not to terrain assets.
         * @property {Boolean} [visible=true] - Set to true if the layer is visible on the
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
        */

        /**
         * A feature template configures the format and content of information displayed
         * in the Feature Info panel ({@link FeatureInfoView}). The Feature Info panel is
         * displayed in a map when a user clicks on a vector feature in a map.
         * @typedef {Object} FeatureTemplate
         * @name MapConfig#FeatureTemplate
         * @since 2.x.x
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
         * @typedef {Object}
         * @name MapConfig#StoryTemplateOptions
         * @since 2.x.x
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
         * @typedef {Object.<string, (MapConfig#CustomDateProperty|MapConfig#CustomStringProperty)>} CustomProperties
         * @name MapConfig#CustomProperties
         * @since 2.x.x
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
         * @typedef {Object} CustomDateProperty
         * @name MapConfig#CustomDateProperty
         * @since 2.x.x
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
         * @typedef {Object} CustomStringProperty
         * @name MapConfig#CustomStringProperty
         * @since 2.x.x
         * @property {'string'} type Must be set to 'string' to indicate that this is a
         * custom string property
         * @property {string} value The new string to use. So far only static strings are
         * available. In the future, templates that include other properties may be
         * supported.
         */

        /**
         * Executed when a new MapAsset model is created.
         * @param {MapConfig#MapAssetConfig} [assetConfig] The initial values of the
         * attributes, which will be set on the model.
         */
        initialize: function (assetConfig) {
          try {

            const model = this;

            if (!assetConfig || typeof assetConfig !== 'object') {
              assetConfig = {}
            }

            // Set the color palette
            if (assetConfig.colorPalette) {
              this.set('colorPalette', new AssetColorPalette(assetConfig.colorPalette))
            }

            // The map asset cannot be visible on the map if there was an error loading
            // the asset
            this.listenTo(this, 'change:status', function (model, status) {
              if (status === 'error') {
                this.set('visible', false)
              }
            })
            this.listenTo(this, 'change:visible', function (model, visible) {
              if (this.get('status') === 'error') {
                this.set('visible', false)
              }
            })

            // Fetch the icon, if there is one
            if (assetConfig.icon) {
              if (model.isSVG(assetConfig.icon)) {
                model.updateIcon(assetConfig.icon)
              } else {
                // If the string is not an SVG then assume it is a PID and try to fetch
                // the SVG file. fetchIcon will update the icon when complete.
                model.fetchIcon(assetConfig.icon)
              }
            }

            // Update the style of the asset to highlight the selected features when 
            // features from this asset are selected in the map.
            if (typeof this.updateAppearance === 'function') {

              const setSelectFeaturesListeners = function () {

                const mapModel = this.get('mapModel')
                if (!mapModel) { return }
                const selectedFeatures = mapModel.get('selectedFeatures')

                this.stopListening(selectedFeatures, 'update');
                this.listenTo(selectedFeatures, 'update', this.updateAppearance)

                this.stopListening(mapModel, 'change:selectedFeatures')
                this.listenTo(mapModel, 'change:selectedFeatures', function () {
                  this.updateAppearance()
                  setSelectFeaturesListeners()
                })

              }
              setSelectFeaturesListeners.call(this)
              this.listenTo(this, 'change:mapModel', setSelectFeaturesListeners)
              this.listenTo(this, 'change:mapModel', setSelectFeaturesListeners)
            }
          }
          catch (error) {
            console.log(
              'There was an error initializing a MapAsset model' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Given a feature object from a Feature model, checks if it is part of the
         * selectedFeatures collection. See featureObject property from
         * {@link Feature#defaults}.
         * @param {*} feature - An object that a Map widget uses to represent this feature
         * in the map, e.g. a Cesium.Entity or a Cesium.Cesium3DTileFeature
         * @returns {boolean} Returns true if the given feature is part of the
         * selectedFeatures collection in this asset
         */
        featureIsSelected: function (feature) {
          const map = this.get('mapModel')
          if (!map) { return false }
          return map.get('selectedFeatures').containsFeature(feature)
        },

        /**
         * Given a set of properties from a Feature from this Map Asset model, add any
         * custom properties to the properties object and return it.
         * @since 2.x.x
         * @param {Object} properties A set of key-value pairs representing the existing
         * properties of a feature from this asset.
         * @returns {Object} The properties object with any custom properties added.
         */
        addCustomProperties: function (properties) {
          try {

            const model = this;
            const customProperties = model.get('customProperties');
            const formattedProperties = {};

            if (!customProperties || !Object.keys(customProperties).length) {
              return properties
            }

            if (!properties || typeof properties !== 'object') {
              properties = {}
            }

            if (customProperties) {
              _.each(customProperties, function (config, key) {
                let formattedValue = '';
                if (config.type === 'date') {
                  formattedValue = model.formatDateProperty(config, properties)
                  // TODO: support formatted numbers and booleans...
                  // } else if (config.type === 'number') {
                  //   formattedValue = model.formatNumberProperty(config, properties)
                  // } else if (config.type === 'boolean') {
                  //   formattedValue = model.formatBooleanProperty(config, properties)
                } else {
                  formattedValue = model.formatStringProperty(config, properties)
                }
                formattedProperties[key] = formattedValue;
              });
            }
            // merge the properties with the formatted properties
            return Object.assign(properties, formattedProperties);
          } catch (error) {
            console.log(
              'There was an error adding custom properties. Returning properties ' +
              'unchanged. Error details: ' +
              error
            );
            return properties
          }
        },

        /**
         * Given a definition for a new date property, and the properties that already
         * exist on a specific feature, returns a new string with the formatted date.
         * @since 2.x.x
         * @param {MapConfig#CustomDateProperty} config - An object that defines the new
         * date property to create
         * @param {Object} properties key-value pairs representing existing properties in
         * a Feature
         * @returns {string} The value for the new date property, formatted as defined by
         * config, for the given feature
         */
        formatDateProperty: function (config, properties) {
          try {
            if (!properties) {
              properties = {}
            }
            let formattedDate = ''
            if (!config || !config.format) {
              return formattedDate;
            }
            const value = properties[config.property];
            if (value) {
              formattedDate = dayjs(value).format(config.format);
            }
            return formattedDate;
          }
          catch (error) {
            console.log(
              'There was an error formatting a date for a Feature model' +
              '. Error details: ' + error
            );
            return '';
          }
        },

        /**
         * For a given set of Feature properties and a definition for a new sting
         * property, returns the value of the custom property. Note that since only static
         * strings are supported so far, this function essentially just returns the value
         * of config.value. This function exists to allow support of dynamic strings in
         * the future (e.g. combining strings from existing properties)
         * @since 2.x.x
         * @param {MapConfig#CustomStringProperty} config The object the defines the new
         * custom property
         * @param {Object} properties key-value pairs representing existing properties in
         * a Feature
         * @returns {string} The new string for the given Feature property
         */
        formatStringProperty: function (config, properties) {
          try {
            if (!properties) {
              properties = {}
            }
            let formattedString = ''
            if (!config || !config.value) {
              return formattedString;
            }
            formattedString = config.value;
            return formattedString;
          }
          catch (error) {
            console.log(
              'There was an error formatting a string for a Feature model' +
              '. Error details: ' + error
            );
            return '';
          }
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
        updateIcon: function (icon) {
          const model = this
          try {
            model.sanitizeIcon(icon, function (sanitizedIcon) {
              model.set('icon', sanitizedIcon)
              model.set('iconStatus', 'success')
            })
          }
          catch (error) {
            console.log(
              'There was an error updating an icon in a MapAsset model' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Simple test to see if a string is an SVG
         * @param {string} str The string to check
         * @returns {Boolean} Returns true if the string starts with `<svg` and ends with
         * `</svg>`, regardless of case
         */
        isSVG: function (str) {
          const strLower = str.toLowerCase()
          return strLower.startsWith('<svg') && strLower.endsWith('</svg>')
        },

        /**
         * Fetches an SVG given a pid, sanitizes it, then updates the model's icon
         * attribute with the new and SVG string (after sanitizing it)
         * @param {string} pid 
         */
        fetchIcon: function (pid) {
          const model = this
          try {
            model.set('iconStatus', 'fetching')

            // Use the portal image model to get the correct baseURL for an image
            const imageURL = new PortalImage({
              identifier: pid
            }).get('imageURL')

            fetch(imageURL)
              .then(function (response) {
                return response.text();
              })
              .then(function (data) {
                if (model.isSVG(data)) {
                  model.updateIcon(data)
                }
              })
              .catch(function (response) {
                model.set('iconStatus', 'error')
              });
          }
          catch (error) {
            console.log(
              'Failed to fetch an icon for a MapAsset' +
              '. Error details: ' + error
            );
            model.set('iconStatus', 'error')
          }
        },

        /**
         * Takes an SVG string and returns it with only the allowed tags and attributes
         * @param {string} icon The SVG icon string to sanitize
         * @param {function} callback Function to call once the icon has been sanitized.
         * Will pass the sanitized icon string.
         */
        sanitizeIcon: function (icon, callback) {
          try {
            // Use the showdown xss filter to sanitize the SVG string
            require(['showdown', 'showdownXssFilter'], function (showdown, showdownXss) {
              var converter = new showdown.Converter({
                extensions: ['xssfilter']
              });
              let sanitizedIcon = converter.makeHtml(icon);
              // Remove the <p></p> tags that showdown wraps the string in
              sanitizedIcon = sanitizedIcon.replace(/^(<p>)/, '')
              sanitizedIcon = sanitizedIcon.replace(/(<\/p>)$/, '')
              // Call the callback
              if (callback && typeof callback === 'function') {
                callback(sanitizedIcon)
              }
            })
          }
          catch (error) {
            console.log(
              'There was an error sanitizing an SVG icon in a MapAsset model' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Checks if the asset information has been fetched and is ready to use.
         * @returns {Promise} Returns a promise that resolves to this model when ready.
        */
        whenReady: function () {
          const model = this;
          return new Promise(function (resolve, reject) {
            if (model.get('status') === 'ready') {
              resolve(model)
              return
            }
            model.stopListening(model, 'change:status')
            model.listenTo(model, 'change:status', function () {
              if (model.get('status') === 'ready') {
                model.stopListening(model, 'change:status')
                resolve(model)
              }
            })
          });
        },

        /**
         * Given properties of a Feature model from this MapAsset, returns the color
         * associated with that feature.
         * @param {Object} properties The properties of the feature to get the color for;
         * An object containing key-value mapping of property names to properties. (See
         * the 'properties' attribute of {@link Feature#defaults}.)
         * @returns {AssetColor#Color} The color associated with the given set of
         * properties.
        */
        getColor: function (properties) {
          try {
            const model = this
            const colorPalette = model.get('colorPalette')
            if (colorPalette) {
              return colorPalette.getColor(properties)
            } else {
              return new AssetColorPalette().getDefaultColor()
            }
          }
          catch (error) {
            console.log(
              'There was an error getting a color for a MapAsset model' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * This function checks whether a feature from the MapAsset is visible on the map
         * based on the properties of the feature and the MapAsset's filter settings.
         * @param {Object} properties The properties of the feature to be filtered. (See
         * the 'properties' attribute of {@link Feature#defaults}.)
         * @returns {boolean} Returns true if the feature passes all the filters, or if
         * there are no filters set for this MapAsset. Returns false if the feature fails
         * any of the filters.
         */
        featureIsVisible: function (properties) {
          const model = this
          const filters = model.get('filters')
          if (filters && filters.length) {
            return filters.featureIsVisible(properties)
          } else {
            return true
          }
        },

        /**
         * Checks that the visible attribute is set to true and that the opacity attribute
         * is greater than zero. If both conditions are met, returns true.
         * @returns {boolean} Returns true if the MapAsset has opacity > 0 and is visible.
         */
        isVisible: function () {
          return this.get('visible') && this.get('opacity') > 0
        },

        // /**
        //  * Parses the given input into a JSON object to be set on the model.
        //  *
        //  * @param {TODO} input - The raw response object
        //  * @return {TODO} - The JSON object of all the MapAsset attributes
        //  */
        // parse: function (input) {

        //   try {

        //     var modelJSON = {};

        //     return modelJSON

        //   }
        //   catch (error) {
        //     console.log(
        //       'There was an error parsing a MapAsset model' +
        //       '. Error details: ' + error
        //     );
        //   }

        // },

        // /**
        //  * Overrides the default Backbone.Model.validate.function() to check if this if
        //  * the values set on this model are valid.
        //  * 
        //  * @param {Object} [attrs] - A literal object of model attributes to validate.
        //  * @param {Object} [options] - A literal object of options for this validation
        //  * process
        //  * 
        //  * @return {Object} - Returns a literal object with the invalid attributes and
        //  * their corresponding error message, if there are any. If there are no errors,
        //  * returns nothing.
        //  */
        // validate: function (attrs, options) {
        //   try {
        //     // Required attributes: type, url, label, description (all strings)
        //   }
        //   catch (error) {
        //     console.log(
        //       'There was an error validating a MapAsset model' +
        //       '. Error details: ' + error
        //     );
        //   }
        // },

        // /**
        //  * Creates a string using the values set on this model's attributes.
        //  * @return {string} The MapAsset string
        //  */
        // serialize: function () {
        //   try {
        //     var serializedMapAsset = '';

        //     return serializedMapAsset;
        //   }
        //   catch (error) {
        //     console.log(
        //       'There was an error serializing a MapAsset model' +
        //       '. Error details: ' + error
        //     );
        //   }
        // },

      });

    return MapAsset;

  }
);
