'use strict';

define(
  [
    'jquery',
    'underscore',
    'backbone',
    'models/portals/PortalImage',
    'models/maps/AssetColorPalette'
  ],
  function (
    $,
    _,
    Backbone,
    PortalImage,
    AssetColorPalette
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
     * @since 2.x.x
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
         * @property {('Cesium3DTileset'|'BingMapsImageryProvider'|'IonImageryProvider'|'CesiumTerrainProvider')} type
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
            status: null,
            statusDetails: null,
          }
        },

        /**
         * The source of a specific asset (i.e. layer or terrain data) to show on the map,
         * as well as metadata and display properties of the asset. Some properties listed
         * here do not apply to all asset types, but this is specified in the property
         * description.
         * @typedef {Object} MapAssetConfig
         * @name MapConfig#MapAssetConfig
         * @property
         * {('Cesium3DTileset'|'BingMapsImageryProvider'|'IonImageryProvider'|'CesiumTerrainProvider')}
         * type - A string indicating the format of the data. Some of these types
         * correspond directly to Cesium classes.
         * @property {(Cesium3DTileset#cesiumOptions|CesiumImagery#cesiumOptions|CesiumTerrain#cesiumOptions)}
         * [cesiumOptions] For MapAssets that are configured for Cesium, like
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
         * @property {MapConfig#VectorFilterConfig} [filters] - A set of conditions used
         * to show or hide specific features of this tileset.
        */

        /**
         * Executed when a new MapAsset model is created.
         * @param {MapConfig#MapAssetConfig} [assetConfig] The initial values of the
         * attributes, which will be set on the model.
         */
        initialize: function (assetConfig) {
          try {

            const model = this;

            // Set the color palette
            if (assetConfig && assetConfig.colorPalette) {
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
            if (assetConfig && assetConfig.icon) {
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
