'use strict';

define(
  [
    'jquery',
    'underscore',
    'backbone'
  ],
  function (
    $,
    _,
    Backbone
  ) {
    /**
     * @classdesc A MapAsset Model comprises the information required to fetch source data
     * for some asset or resource that is displayed in a map, such as an imagery layer,
     * vector data, or a terrain model. This model also contains metadata about the source
     * data, like an attribution and a description.
     * @classcategory Models/Maps
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
         * @property {string} type The format of the data. Must be one of the types set in
         * MapAsset#supportedTypes.
         * @property {string} label A user friendly name for this asset, to be displayed
         * in a map.
         * @property {string} description A brief description about the asset, e.g. which
         * area it covers, the resolution, etc.
         * @property {string} [attribution] A credit or attribution to display along with
         * this map resource.
         * @property {string} [moreInfoLink] A link to show in a map where a user can find
         * more information about this resource.
         * @property {string} [downloadLink] A link to show in a map where a user can go
         * to download the source data.
         * @property {string} [id] If this asset's data is archived in a DataONE
         * repository, the ID of the data package.
         * @property {Object} options options are passed to the function that is used to
         * create and render the asset in the map. The properties of options are specific
         * to each type of asset, but most contain a URL to the server where the data is
         * hosted. TODO: Document options along with each associated type.
         * @property {string} typeCategory The more general type that this asset is. One
         * of imagery, data, (3D) tileset, or terrain. Set automatically during
         * initialize.
         * @property {*} cesiumModel A model created by Cesium that organizes the data to
         * display in the Cesium Widget.
        */
        defaults: function () {
          return {
            type: '',
            label: '',
            description: '',
            attribution: '',
            moreInfoLink: '',
            downloadLink: '',
            id: '',
            options: {},
            typeCategory: 'unsupported',
            cesiumModel: null
          }
        },

        /**
         * Executed when a new MapAsset model is created.
         * @param {Object} [attributes] The initial values of the attributes, which will
         * be set on the model.
         * @param {Object} [options] Options for the initialize function.
         */
        initialize: function (attributes, options) {
          try {
            // Check if this is a type currently supported by MetacatUI. If it is, add the
            // general type category (imagery, data, or 3DTiles) to the model attributes.
            var type = attributes.type
            var typeCategory = 'unsupported'
            for (const [category, typesArray] of Object.entries(this.supportedTypes)) {
              if (typesArray.includes(type)) {
                typeCategory = category
              }
            }
            this.set('typeCategory', typeCategory)

          }
          catch (error) {
            console.log(
              'There was an error initializing a MapAsset model' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * @type {Object} The type of map assets that MetacatUI supports, categorized by
         * more general types - imagery, data, (3D) tilesets, and terrain.
         * @property {string[]} imagery - The list of supported imagery layer types
         * @property {string[]} data - The list of supported vector data types that will
         * be used to create geometries, excluding any 3D tilesets.
         * @property {string[]} tileset - The list of supported 3D tile types.
         * @property {string[]} terrain - The list of supoorted terrain asset types that
         * will be used to render peaks and valleys in 3D maps.
         */
        supportedTypes: {
          imagery: ['BingMapsImageryProvider'],
          data: ['GeoJsonDataSource'],
          tileset: ['Cesium3DTileset'],
          terrain: ['CesiumTerrainProvider']
        },

        /**
         * Creates a Cesium model that contains information about the map asset for Cesium
         * to render.
         * @param {Boolean} recreate - Set recreate to true to force the function create
         * the Cesium Model again. Otherwise, if a cesium model already exists, that is
         * returned instead.
         * @returns 
         */
        createCesiumModel: function (recreate = false) {
          try {
            var model = this;
            var type = model.get('type')
            var typeCategory = model.get('typeCategory')
            var assetOptions = model.get('options')
            var cesiumModel = null

            if (type === 'unsupported') {
              return
            }

            if (!recreate && this.get('cesiumModel')) {
              return this.get('cesiumModel')
            }

            // Cesium is required for the create functions
            require(['cesium'], function (Cesium) {

              // Set the asset URL if this is a Cesium Ion resource
              if (assetOptions && assetOptions.ionAssetId) {
                // The Cesium Ion ID of the resource to access
                var assetId = Number(assetOptions.ionAssetId)
                var ionResourceOptions = {}
                // Access token needs to be set before requesting cesium ion resources
                ionResourceOptions.accessToken =
                  assetOptions.cesiumToken || MetacatUI.appModel.get("cesiumToken");

                assetOptions.url = Cesium.IonResource.fromAssetId(assetId, ionResourceOptions)
              }

              // Set the Bing Maps key
              if (type === 'BingMapsImageryProvider') {
                assetOptions.key = assetOptions.bingKey || MetacatUI.AppConfig.bingMapsKey
              }

              
              if (type === 'GeoJsonDataSource') {
                var url = assetOptions.url
                // TODO
                // assetOptions.markerColor = Cesium.Color.fromCssColorString('#dbba3d')
                cesiumModel = Cesium.GeoJsonDataSource.load(url, assetOptions)
              } else if (type && Cesium[type] && typeof Cesium[type] === 'function') {
                cesiumModel = new Cesium[type](assetOptions)
              }
              
              // Imagery must be converted from a Cesium Imagery Provider to a Cesium
                // Imagery Layer. See
                // https://cesium.com/learn/cesiumjs-learn/cesiumjs-imagery/#imagery-providers-vs-layers
              if (typeCategory === 'imagery') {
                cesiumModel = new Cesium.ImageryLayer(cesiumModel);
              }

              model.set('cesiumModel', cesiumModel)

            })

            return cesiumModel
          }
          catch (error) {
            console.log(
              'Failed to create a Cesium Model in a MapAsset model' +
              '. Error details: ' + error
            );
          }
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
