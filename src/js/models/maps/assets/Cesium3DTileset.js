'use strict';

define(
  [
    'jquery',
    'underscore',
    'backbone',
    'cesium',
    'models/maps/assets/MapAsset',
    'models/maps/VectorColor',
    'models/maps/VectorColorPalette',
    'collections/maps/VectorFilters'
  ],
  function (
    $,
    _,
    Backbone,
    Cesium,
    MapAsset,
    VectorColor,
    VectorColorPalette,
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
         * Options that are supported for creating 3D tilesets
         * @typedef {Object} 3DTilesetOptions
         * @property {string|number} ionAssetId - If this tileset is hosted by Cesium Ion,
         * then Ion asset ID. 
         * @property {string} cesiumToken - If this tileset is hosted by Cesium Ion, then
         * the token needed to access this resource. If one is not set, then the default
         * set in the repository's AppModel will be used.
         */

        /**
         * Default attributes for Cesium3DTileset models
         * @name 3DTileset#defaults
         * @type {Object}
         * @property {VectorFilters} filters A set of conditions used to show or hide
         * specific features of this tileset.
         * @property {VectorColorPalette} colorPalette The color or colors to use to style
         * this tileset.
         * @property {Cesium.Cesium3DTileset} cesiumModel A model created and used by
         * Cesium that organizes the data to display in the Cesium Widget. See
         * {@link https://cesium.com/learn/cesiumjs/ref-doc/Cesium3DTileset.html}
         * @property {3DTilesetOptions} cesiumOptions options are passed to the function
         * that creates the Cesium model. The properties of options are specific to each
         * type of asset, but most contain a URL to the server where the data is hosted.
        */
        defaults: function () {
          return _.extend(
            this.constructor.__super__.defaults(),
            {
              filters: new VectorFilters(),
              colorPalette: new VectorColorPalette(),
              cesiumModel: null,
              cesiumOptions: {}
            }
          );
        },

        /**
         * Executed when a new Cesium3DTileset model is created.
         * @param {Object} [attributes] The initial values of the attributes, which will
         * be set on the model.
         * @param {Object} [options] Options for the initialize function.
         */
        initialize: function (attributes, options) {
          try {
            this.constructor.__super__.initialize(attributes, options);

            if (attributes.filters) {
              this.set('filters', new VectorFilters(attributes.filters))
            }

            if (attributes && attributes.colorPalette) {
              this.set('colorPalette', new VectorColorPalette(attributes.colorPalette))
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
                model.update3DTileStyle();
              })
              .otherwise(function (error) {
                model.set('status', 'error');
                model.set('statusDetails', error)
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
              this.update3DTileStyle
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
        update3DTileStyle: function () {
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
            // Opacity of the entire layer is set by using it as the alpha for each color
            const opacity = this.get('opacity')
            // Colors configured to color features conditionally by a given property
            const colorPalette = this.get('colorPalette')

            // As a backup, use the default vector color
            const defaultRgb = new VectorColor().defaults().color;
            let defaultCol = new Cesium.Color(
              defaultRgb.red, defaultRgb.green, defaultRgb.blue, opacity
            );

            // By default, just return the default color.
            let evaluateColor = function () {
              return defaultCol
            };

            // Write a function gives the correct color given a Cesium feature.
            if (colorPalette) {

              // The property to conditionally color the features by
              const prop = colorPalette.get('property');
              // Each palette type needs a different type of function
              const type = colorPalette.get('paletteType');
              // The collection of colors + conditions 
              const colors = colorPalette.get('colors');

              // If there are no colors, then use the default function which returns the
              // default color.
              if (!colors || colors.length === 0) {
                // Skip the other if statements.

                // If there's just 1 color, then the function only needs to return that color.
              } else if (colors.length === 1) {
                const rgb = colors.at(0).get('color');
                evaluateColor = function () {
                  return new Cesium.Color(rgb.red, rgb.green, rgb.blue, opacity);
                }

                // For a categorical color palette, the value of the feature property just
                // needs to match one of the values in the list of color conditions. Use a
                // map.
              } else if (type === 'categorical') {
                const colorMap = {}
                colors.each(function (color) {
                  const key = color.get('value')
                  const rgb = color.get('color')
                  const col = new Cesium.Color(rgb.red, rgb.green, rgb.blue, opacity);
                  if (key || key === 0 || key === false) {
                    colorMap[key] = col
                  } else {
                    defaultCol = col
                  }
                })
                evaluateColor = function (feature) {
                  const colMatch = colorMap[feature.getProperty(prop)];
                  if (colMatch) {
                    return colMatch
                  } else {
                    return defaultCol
                  }
                }

                // For a classified color palette, the function should look for the first color condition where the feature's value is less...
              } else if (type === 'classified') {
                // evaluateColor = function (feature) {
                //   // TODO
                // }

                // Use a gradient function 
              } else if (type === 'continuous') {
                // evaluateColor = function (feature) {
                //   // TODO
                // }
              }
            }

            return evaluateColor

          } catch (error) {
            console.log(
              'There was an error creating a color function in a Cesium3DTileset' +
              '. Error details: ' + error
            );
          }

          return evaluateColor
        },

        // /**
        //  * Parses the given input into a JSON object to be set on the model.
        //  *
        //  * @param {TODO} input - The raw response object
        //  * @return {TODO} - The JSON object of all the Cesium3DTileset attributes
        //  */
        // parse: function (input) {

        //   try {

        //     var modelJSON = {};

        //     return modelJSON

        //   }
        //   catch (error) {
        //     console.log(
        //       'There was an error parsing a Cesium3DTileset model' +
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

        //   }
        //   catch (error) {
        //     console.log(
        //       'There was an error validating a Cesium3DTileset model' +
        //       '. Error details: ' + error
        //     );
        //   }
        // },

        // /**
        //  * Creates a string using the values set on this model's attributes.
        //  * @return {string} The Cesium3DTileset string
        //  */
        // serialize: function () {
        //   try {
        //     var serialized3DTileset = '';

        //     return serialized3DTileset;
        //   }
        //   catch (error) {
        //     console.log(
        //       'There was an error serializing a Cesium3DTileset model' +
        //       '. Error details: ' + error
        //     );
        //   }
        // },

      });

    return Cesium3DTileset;

  }
);
