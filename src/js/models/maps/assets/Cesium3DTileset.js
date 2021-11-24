'use strict';

define(
  [
    'jquery',
    'underscore',
    'backbone',
    'cesium',
    'models/maps/assets/MapAsset',
    'models/maps/AssetColor',
    'models/maps/AssetColorPalette',
    'collections/maps/VectorFilters'
  ],
  function (
    $,
    _,
    Backbone,
    Cesium,
    MapAsset,
    AssetColor,
    AssetColorPalette,
    VectorFilters
  ) {
    /**
     * @classdesc A Cesium3DTileset Model is a special type of vector layer that can be used in
     * Cesium maps, and that follows the 3d-tiles specification. See
     * {@link https://github.com/CesiumGS/3d-tiles}
     * @classcategory Models/Maps/Assets
     * @class Cesium3DTileset
     * @name Cesium3DTileset
     * @extends MapAsset
     * @since 2.x.x
     * @constructor
    */
    var Cesium3DTileset = MapAsset.extend(
      /** @lends Cesium3DTileset.prototype */ {

        /**
         * The name of this type of model
         * @type {string}
        */
        type: 'Cesium3DTileset',

        /**
         * Options that are supported for creating 3D tilesets. The object will be passed
         * to `Cesium.Cesium3DTileset(options)` as options, so the properties listed in
         * the Cesium3DTileset documentation are also supported, see
         * {@link https://cesium.com/learn/cesiumjs/ref-doc/Cesium3DTileset.html}
         * @typedef {Object} Cesium3DTileset#cesiumOptions
         * @property {string|number} ionAssetId - If this tileset is hosted by Cesium Ion,
         * then Ion asset ID. 
         * @property {string} cesiumToken - If this tileset is hosted by Cesium Ion, then
         * the token needed to access this resource. If one is not set, then the default
         * set in the repository's {@link AppConfig#cesiumToken} will be used.
         */

        /**
         * Default attributes for Cesium3DTileset models
         * @name Cesium3DTileset#defaults
         * @type {Object}
         * @property {'Cesium3DTileset'} type The format of the data. Must be
         * 'Cesium3DTileset'.
         * @property {VectorFilters} [filters=new VectorFilters()] A set of conditions
         * used to show or hide specific features of this tileset.
         * @property {AssetColorPalette} [colorPalette=new AssetColorPalette()] The color
         * or colors mapped to attributes of this asset. Used to style the features and to
         * make a legend.
         * @property {Cesium.Cesium3DTileset} cesiumModel A model created and used by
         * Cesium that organizes the data to display in the Cesium Widget. See
         * {@link https://cesium.com/learn/cesiumjs/ref-doc/Cesium3DTileset.html}
         * @property {Cesium3DTileset#cesiumOptions} cesiumOptions options are passed
         * to the function that creates the Cesium model. The properties of options are
         * specific to each type of asset.
        */
        defaults: function () {
          return _.extend(
            this.constructor.__super__.defaults(),
            {
              type: 'Cesium3DTileset',
              filters: new VectorFilters(),
              cesiumModel: null,
              cesiumOptions: {},
              colorPalette: new AssetColorPalette(),
              icon: '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="m12.6 12.8 4.9 5c.2.2.2.6 0 .8l-5 5c-.2.1-.5.1-.8 0l-4.9-5a.6.6 0 0 1 0-.8l5-5c.2-.2.5-.2.8 0ZM6.3 6.6l5 5v.7l-5 5c-.2.2-.6.2-.8 0l-5-5a.6.6 0 0 1 0-.8l5-5c.2-.1.6-.1.8 0Zm11 7.8 1.7 1.8c.3.2.3.6 0 .8l-.2.3c-.2.2-.6.2-.8 0l-1.8-1.8c-.2-.3-.2-.6 0-.9l.2-.2c.3-.2.6-.2.9 0ZM22 9.7l1.7 1.8c.3.2.3.6 0 .8l-3.3 3.4c-.2.2-.6.2-.9 0l-1.7-1.8a.6.6 0 0 1 0-.8L21 9.7c.3-.2.6-.2.9 0Zm-6-.2 1.7 1.7c.3.3.3.6 0 .9l-2 2c-.2.2-.6.2-.9 0l-1.7-1.8c-.2-.2-.3-.6 0-.8l2-2c.3-.3.6-.3.9 0ZM12.6.3l4.9 5c.2.2.2.5 0 .8l-5 4.9c-.2.2-.5.2-.8 0L6.8 6a.6.6 0 0 1 0-.8l5-4.9c.2-.2.5-.2.8 0Zm6.2 6.3 1.8 1.7c.2.3.2.7 0 1L19 10.7c-.3.3-.7.3-1 0L16.6 9c-.3-.2-.3-.6 0-1l1.4-1.3c.3-.3.7-.3 1 0Z"/></svg>'
            }
          );
        },

        /**
         * Executed when a new Cesium3DTileset model is created.
         * @param {MapConfig#MapAssetConfig} [assetConfig] The initial values of the
         * attributes, which will be set on the model.
         */
        initialize: function (assetConfig) {
          try {

            MapAsset.prototype.initialize.call(this, assetConfig);

            if (assetConfig.filters) {
              this.set('filters', new VectorFilters(assetConfig.filters))
            }

            this.createCesiumModel();
          }
          catch (error) {
            console.log(
              'There was an error initializing a 3DTileset model' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Creates a Cesium.Cesium3DTileset model and sets it to this model's
         * 'cesiumModel' attribute. This cesiumModel contains all the information required
         * for Cesium to render tiles. See
         * {@link https://cesium.com/learn/cesiumjs/ref-doc/Cesium3DTileset.html?classFilter=3Dtiles}
         * @param {Boolean} recreate - Set recreate to true to force the function create
         * the Cesium Model again. Otherwise, if a cesium model already exists, that is
         * returned instead.
         */
        createCesiumModel: function (recreate = false) {

          try {

            var model = this;
            var cesiumOptions = model.get('cesiumOptions')
            var cesiumModel = null

            // If the cesium model already exists, don't create it again unless specified
            if (!recreate && this.get('cesiumModel')) {
              return this.get('cesiumModel')
            }

            // Check if this tileset is a Cesium Ion resource, and if it is, set the url
            // from the asset Id
            this.setCesiumURL()

            cesiumModel = new Cesium.Cesium3DTileset(cesiumOptions)
            model.set('cesiumModel', cesiumModel)
            cesiumModel.readyPromise
              .then(function () {
                // Let the map views know that the tileset is ready to render
                model.set('status', 'ready');
                // Listen to changes in the opacity, color, etc
                model.setListeners();
                // Set the initial visibility, opacity, filters, and colors
                model.updateAppearance();
              })
              .otherwise(function (error) {
                // See https://cesium.com/learn/cesiumjs/ref-doc/RequestErrorEvent.html
                let details = error;
                // Write a helpful error message
                switch (error.statusCode) {
                  case 404:
                    details = 'The resource was not found (error code 404).'
                    break;
                  case 500:
                    details = 'There was a server error (error code 500).'
                    break;
                }
                model.set('status', 'error');
                model.set('statusDetails', details)
              })
          }
          catch (error) {
            console.log(
              'Failed to create a Cesium Model within a 3D Tileset model' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Checks whether there is an asset ID for a Cesium Ion resource set in the cesium
         * asset options. If there is, then adds or replaces the URL property the cesium
         * asset options with a URL created by Cesium.
         */
        setCesiumURL: function () {
          try {

            var cesiumOptions = this.get('cesiumOptions')

            // Set the asset URL if this is a Cesium Ion 3D tileset or terrain
            if (cesiumOptions && cesiumOptions.ionAssetId) {
              // The Cesium Ion ID of the resource to access
              var assetId = Number(cesiumOptions.ionAssetId)
              // Options to pass to Cesium's fromAssetId function
              var ionResourceOptions = {}
              // Access token needs to be set before requesting cesium ion resources
              ionResourceOptions.accessToken =
                cesiumOptions.cesiumToken || MetacatUI.appModel.get('cesiumToken');
              // Create the new URL and set it on the model options
              cesiumOptions.url = Cesium.IonResource.fromAssetId(assetId, ionResourceOptions)

            }
          }
          catch (error) {
            console.log(
              'There was an error settings a Cesium URL in a Cesium3DTileset' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Set listeners that update the cesium model when the backbone model is updated.
         */
        setListeners: function () {
          try {

            // Make sure the listeners are only set once!
            this.stopListening(this);

            // When opacity, color, or filter changes
            this.listenTo(
              this,
              'change:opacity change:color change:filters change:visible',
              this.updateAppearance
            )

          }
          catch (error) {
            console.log(
              'There was an error setting listeners in a Cesium3DTileset' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Sets a new Cesium3DTileStyle on the Cesium 3D tileset model's style property,
         * based on the attributes set on this model. 
         */
        updateAppearance: function () {
          try {

            const model = this;

            // The style set on the Cesium 3D tileset needs to be updated to show the
            // changes on a Cesium map.
            const cesiumModel = this.get('cesiumModel')

            // If the layer isn't visible at all, don't bother setting up colors or
            // filters. Just set every feature to hidden.
            if (this.get('visible') === false || this.get('opacity') === 0) {
              cesiumModel.style = new Cesium.Cesium3DTileStyle({
                show: false
              });
            } else {
              // evaluateColor is the function that Cesium will use to decide which color to
              // shade each feature.
              const evaluateColor = this.getColorFunction()

              // Filters configured to conditionally show/hide features based on one or more
              // properties
              let filterExpression = this.getFilterExpression();

              // Set a new 3D style
              cesiumModel.style = new Cesium.Cesium3DTileStyle({
                color: {
                  evaluateColor: evaluateColor,
                },
                show: filterExpression
              });
            }

            // Let the map and/or other parent views know that a change has been made that
            // requires the map to be re-rendered
            model.trigger('appearanceChanged')

          }
          catch (error) {
            console.log(
              'There was an error updating a 3D Tile style property in a Cesium3DTileset' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Using the Vector Filter Collections set on this tileset model, creates a string
         * to use for the 'show' property in a Cesium3DTileStyle. This string is an
         * expression defined using the 3D Tiles Styling language, see
         * {@link https://github.com/CesiumGS/3d-tiles/tree/main/specification/Styling#styling-features}
         * and
         * {@link https://cesium.com/learn/cesiumjs/ref-doc/Cesium3DTileStyle.html#show}.
         * @returns {string|boolean} Returns a string of one or more expressions used to
         * conditionally show features, or true if there are no valid filters set on this
         * model
         */
        getFilterExpression: function () {
          try {

            // Each Filter model in the Filters collection creates one part of the filter
            // expression.
            const filters = this.get('filters')

            // The final filter expression string
            let filtersExpression = ''

            if (filters && filters.length) {

              // Create a filter expression statement for each filter in the model. AND
              // all expressions together into one string.
              filters.each(function (filter) {

                // type can be 'categorical' or 'numeric'
                const type = filter.get('filterType')

                // The feature property to filter on
                const prop = filter.get('property')

                // For numeric filters, create an expression in the format:
                // (${myProperty} >= min && ${myProperty} <= max)
                if (type === 'numeric') {

                  const min = filter.get('min')
                  const max = filter.get('max')

                  if ((min || min === 0) && typeof min === 'number') {
                    if (filtersExpression.length) {
                      filtersExpression += ' && '
                    }
                    filtersExpression += `(\$\{${prop}\} >= ${min})`
                  }

                  if ((max || max === 0) && typeof max === 'number') {
                    if (filtersExpression.length) {
                      filtersExpression += ' && '
                    }
                    filtersExpression += `(\$\{${prop}\} <= ${max})`
                  }

                  // For categorical filters, create an expression in the format:
                  // (${myProperty} === val1 || ${myProperty} === val2 || ${myProperty} === val3)
                } else if (type === 'categorical') {

                  const vals = filter.get('values')
                  let catExpression = ''

                  vals.forEach(function (val) {
                    if (catExpression.length) {
                      catExpression += ' || '
                    }
                    catExpression += `\$\{${prop}\} === ${val}`
                  })

                  if (catExpression.length) {
                    catExpression = '(' + catExpression + ')'
                    if (filtersExpression.length) {
                      filtersExpression += ' && '
                    }
                    filtersExpression += catExpression
                  }

                }
              })
            }

            if (filtersExpression.length) {
              return filtersExpression
            } else {
              // If there are no filters, then use the default function which shows all
              // features.
              return true
            }

          }
          catch (error) {
            console.log(
              'There was an error creating a filter expression in a Cesium3DTileset' +
              '. Error details: ' + error +
              '. Returning "true", which will show all features in the tileset.'
            );
            return true
          }
        },

        /**
         * Given a feature from a Cesium 3D tileset, returns any properties that are set
         * on the feature, similar to an attributes table.
         * @param {Cesium.Cesium3DTileFeature} feature A Cesium 3D Tile feature
         * @returns {Object} An object containing key-value mapping of property names to
         * properties.
         */
        getPropertiesFromFeature(feature) {
          try {
            const properties = {};
            feature.getPropertyNames().forEach(function (propertyName) {
              properties[propertyName] = feature.getProperty(propertyName)
            })
            return properties
          }
          catch (error) {
            console.log(
              'There was an error getting properties from a A Cesium 3D Tile feature' +
              '. Error details: ' + error +
              '. Returning an empty object.'
            );
            return {}
          }
        },

        /**
         * Creates a function that takes a Cesium3DTileFeature (see
         * {@link https://cesium.com/learn/cesiumjs/ref-doc/Cesium3DTileFeature.html}) and
         * returns a Cesium color based on the colorPalette property set on this model.
         * The returned function is designed to be used as the evaluateColor function that
         * is set in the color property of a Cesium3DTileStyle StyleExpression. See
         * {@link https://cesium.com/learn/cesiumjs/ref-doc/Cesium3DTileStyle.html#color}
         * @returns {function} A Cesium 3dTile evaluate color function
         */
        getColorFunction: function () {
          try {
            const model = this;
            // Opacity of the entire layer is set by using it as the alpha for each color
            const opacity = model.get('opacity')

            const evaluateColor = function (feature) {
              const properties = model.getPropertiesFromFeature(feature);
              let featureOpacity = opacity;
              // If the feature is currently selected, set the opacity to max (otherwise the
              // 'silhouette' borders in the map do not show in the Cesium widget)
              if (model.featureIsSelected(feature)) {
                featureOpacity = 1
              }
              const rgb = model.getColor(properties)
              if (rgb) {
                return new Cesium.Color(rgb.red, rgb.green, rgb.blue, featureOpacity);
              } else {
                return new Cesium.Color();
              }
            }
            return evaluateColor
          }
          catch (error) {
            console.log(
              'There was an error creating a color function in a Cesium3DTileset model' +
              '. Error details: ' + error
            );
          }
        },

        /**
        * Gets a Cesium Bounding Sphere that can be used to navigate to view the full
        * extent of the tileset. See
        * {@link https://cesium.com/learn/cesiumjs/ref-doc/BoundingSphere.html}.
        * @returns {Promise} Returns a promise that resolves to a Cesium Bounding Sphere
        * when ready
        */
        getBoundingSphere: function () {
          const model = this;
          return this.whenReady()
            .then(function (model) {
              const tileset = model.get('cesiumModel')
              const bSphere = Cesium.BoundingSphere.clone(tileset.boundingSphere);
              return bSphere
            })
        }

      });

    return Cesium3DTileset;

  }
);
