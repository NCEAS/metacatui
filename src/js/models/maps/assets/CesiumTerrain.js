'use strict';

define(
  [
    'jquery',
    'underscore',
    'backbone',
    'cesium',
    'models/maps/assets/MapAsset'
  ],
  function (
    $,
    _,
    Backbone,
    Cesium,
    MapAsset
  ) {
    /**
     * @classdesc A CesiumTerrain Model comprises the information required to fetch 3D
     * terrain, such as mountain peaks and valleys, to display in Cesium. A terrain model
     * also contains metadata about the terrain source data, such as an attribution and a
     * description.
     * @classcategory Models/Maps/Assets
     * @class CesiumTerrain
     * @name CesiumTerrain
     * @extends MapAsset
     * @since 2.18.0
     * @constructor
    */
    var CesiumTerrain = MapAsset.extend(
      /** @lends CesiumTerrain.prototype */ {

        /**
         * The name of this type of model
         * @type {string}
        */
        type: 'CesiumTerrain',

        /**
         * Options that are supported for creating terrain in Cesium. Any properties
         * provided here are passed to the Cesium constructor function for the Terrain
         * Provider, so other properties that are documented in Cesium are also supported.
         * See `options` here:
         * {@link https://cesium.com/learn/cesiumjs/ref-doc/CesiumTerrainProvider.html?classFilter=TerrainProvider}
         * @typedef {Object} CesiumTerrain#cesiumOptions
         * @property {string|number} ionAssetId - If this terrain is hosted by Cesium Ion,
         * then Ion asset ID. 
         */

        /**
         * Default attributes for CesiumTerrain models
         * @name CesiumTerrain#defaults
         * @extends MapAsset#defaults
         * @type {Object}
         * @property {'CesiumTerrainProvider'} type A string indicating a Cesium Terrain
         * Provider, see
         * {@link https://cesium.com/learn/cesiumjs/ref-doc/?classFilter=TerrainProvider}
         * @property {Cesium.TerrainProvider} cesiumModel A model created and used by
         * Cesium that organizes the data to display in the Cesium Widget. See
         * {@link https://cesium.com/learn/cesiumjs/ref-doc/TerrainProvider.html}
         * @property {CesiumTerrain#cesiumOptions} cesiumOptions options are passed to the
         * function that creates the Cesium model. The properties of options are specific
         * to each type of asset
        */
        defaults: function () {
          return _.extend(
            this.constructor.__super__.defaults(),
            {
              type: 'CesiumTerrainProvider',
              cesiumModel: null,
              cesiumOptions: {},
            }
          );
        },

        /**
         * Executed when a new CesiumTerrain model is created.
         * @param {Object} [attributes] The initial values of the attributes, which will
         * be set on the model.
         * @param {Object} [options] Options for the initialize function.
         */
        initialize: function (attributes, options) {
          try {
            MapAsset.prototype.initialize.call(this, attributes, options);

            this.createCesiumModel();
          }
          catch (error) {
            console.log(
              'There was an error initializing a CesiumTerrain model' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Creates a Cesium TerrainProvider that contains information about where the
         * terrain data should be requested from and how to render it in Cesium. See
         * {@link https://cesium.com/learn/cesiumjs/ref-doc/TerrainProvider.html?classFilter=terrain}
         * @param {Boolean} recreate - Set recreate to true to force the function create
         * the Cesium Model again. Otherwise, if a cesium model already exists, that is
         * returned instead.
         */
        createCesiumModel: function (recreate = false) {

          var model = this;
          var cesiumOptions = this.get('cesiumOptions');
          var type = this.get('type')
          var terrainFunction = Cesium[type]

          // If the cesium model already exists, don't create it again unless specified
          if (!recreate && this.get('cesiumModel')) {
            return this.get('cesiumModel')
          }

          model.resetStatus();

          // Check if this tileset is a Cesium Ion resource, and if it is, set the url
          // from the asset Id
          this.setCesiumURL()

          if (terrainFunction && typeof terrainFunction === 'function') {
            let terrain = new terrainFunction(cesiumOptions)
            terrain.readyPromise
              .then(function () {
                model.set('cesiumModel', terrain)
                model.set('status', 'ready')
              })
              .otherwise(function (error) {
                model.set('status', 'error');
                model.set('statusDetails', error)
              })
          } else {
            model.set('status', 'error')
            model.set('statusDetails', type + ' is not a supported imagery type.')
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
              'There was an error settings a Cesium URL in a 3DTileset' +
              '. Error details: ' + error
            );
          }
        },

        // /**
        //  * Parses the given input into a JSON object to be set on the model.
        //  *
        //  * @param {TODO} input - The raw response object
        //  * @return {TODO} - The JSON object of all the CesiumTerrain attributes
        //  */
        // parse: function (input) {

        //   try {

        //     var modelJSON = {};

        //     return modelJSON

        //   }
        //   catch (error) {
        //     console.log(
        //       'There was an error parsing a CesiumTerrain model' +
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
        //       'There was an error validating a CesiumTerrain model' +
        //       '. Error details: ' + error
        //     );
        //   }
        // },

        // /**
        //  * Creates a string using the values set on this model's attributes.
        //  * @return {string} The CesiumTerrain string
        //  */
        // serialize: function () {
        //   try {
        //     var serializedTerrain = '';

        //     return serializedTerrain;
        //   }
        //   catch (error) {
        //     console.log(
        //       'There was an error serializing a CesiumTerrain model' +
        //       '. Error details: ' + error
        //     );
        //   }
        // },

      });

    return CesiumTerrain;

  }
);
