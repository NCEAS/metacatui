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
     * @classdesc A MapAsset Model comprises information required to fetch source data for
     * some asset or resource that is displayed in a map, such as imagery (raster) tiles,
     * vector data, a 3D tileset, or a terrain model. This model also contains metadata
     * about the source data, like an attribution and a description. It represents the
     * most generic type of asset, and can be extended to support specific assets that are
     * compatible with a given map widget.
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
         * MapAsset#supportedTypes. // <-- TODO
         * @property {string} label A user friendly name for this asset, to be displayed
         * in a map.
         * @property {string} description A brief description about the asset, e.g. which
         * area it covers, the resolution, etc.
         * @property {string} attribution A credit or attribution to display along with
         * this map resource.
         * @property {string} moreInfoLink A link to show in a map where a user can find
         * more information about this resource.
         * @property {string} downloadLink A link to show in a map where a user can go to
         * download the source data.
         * @property {string} id If this asset's data is archived in a DataONE repository,
         * the ID of the data package.
         * @property {Boolean} selected Set to true when this asset has been selected by
         * the user in the layer list.
         * @property {Number} opacity A number between 0 and 1 indicating the opacity of
         * the layer on the map, with 0 representing fully transparent and 1 representing
         * fully opaque. This applies to raster (imagery) and vector assets, not to
         * terrain assets.
         * @property {Boolean} visible Set to true if the layer is visible on the map,
         * false if it is hidden. This applies to raster (imagery) and vector assets, not
         * to terrain assets.
         * @property {string} status Set to 'ready' when the resource is ready to be
         * rendered in a map view. Set to 'error' when the asset is not supported, or
         * there was a problem requesting the resource.
         * @property {string} statusDetails Any further details about the status,
         * especially when there was an error.
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
            selected: false,
            opacity: 1,
            visible: true,
            status: null,
            statusDetails: null
          }
        },

        // /**
        //  * Executed when a new MapAsset model is created.
        //  * @param {Object} [attributes] The initial values of the attributes, which will
        //  * be set on the model.
        //  * @param {Object} [options] Options for the initialize function.
        //  */
        // initialize: function (attributes, options) {
        //   try {

        //   }
        //   catch (error) {
        //     console.log(
        //       'There was an error initializing a MapAsset model' +
        //       '. Error details: ' + error
        //     );
        //   }
        // },

        // TODO: ?
        // /**
        //  * @type {Object} The type of map assets that MetacatUI supports, categorized by
        //  * more general types - imagery, data, (3D) tilesets, and terrain.
        //  * @property {string[]} imagery - The list of supported imagery layer types
        //  * @property {string[]} data - The list of supported vector data types that will
        //  * be used to create geometries, excluding any 3D tilesets.
        //  * @property {string[]} tileset - The list of supported 3D tile types.
        //  * @property {string[]} terrain - The list of supoorted terrain asset types that
        //  * will be used to render peaks and valleys in 3D maps.
        //  */
        // supportedTypes: {
        //   imagery: ['BingMapsImageryProvider', 'IonImageryProvider'],
        //   data: ['GeoJsonDataSource'],
        //   tileset: ['Cesium3DTileset'],
        //   terrain: ['CesiumTerrainProvider']
        // },

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
