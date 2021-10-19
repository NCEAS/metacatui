'use strict';

define(
  [
    'jquery',
    'underscore',
    'backbone',
    'models/portals/PortalImage',
    'models/maps/AssetColorPalette',
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
         * @property {string} icon A PID for an SVG saved as a dataObject, or an SVG
         * string. The SVG will be used as an icon that will be displayed next to the
         * label in the layers list. It should be an SVG file that has no fills, borders,
         * or styles set on it (since the icon will be shaded dynamically by the maps CSS
         * using a fill attribute). It must use a viewbox property rather than a height
         * and width.
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
         * @property {AssetColorPalette} colorPalette The color or colors mapped to
         * attributes of this asset. This applies to raster/imagery and vector assets. For
         * imagery, the colorPalette will be used to create a legend. For vector assets
         * (e.g. 3Dtilesets), it will also be used to style the features.
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
         * Executed when a new MapAsset model is created.
         * @param {Object} [attributes] The initial values of the attributes, which will
         * be set on the model.
         * @param {Object} [options] Options for the initialize function.
         */
        initialize: function (attributes, options) {
          try {
            const model = this;

            if (attributes && attributes.colorPalette) {
              this.set('colorPalette', new AssetColorPalette(attributes.colorPalette))
            }

            // Simple test to see if string is an SVG
            const isSVG = function (str) {
              return str.startsWith('<svg')
            }
            // Fetch the icon, if there is one
            if (attributes && attributes.icon && !isSVG(attributes.icon)) {
              // Use the portal image model to get the correct baseURL for an image
              const iconModel = new PortalImage({
                identifier: attributes.icon
              })
              fetch(iconModel.get('imageURL'))
                .then(function (response) {
                  return response.text();
                })
                .then(function (data) {
                  if (isSVG(data)) {
                    model.set('icon', data)
                  }
                });
            }
          }
          catch (error) {
            console.log(
              'There was an error initializing a MapAsset model' +
              '. Error details: ' + error
            );
          }
        },

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
