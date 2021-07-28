'use strict';

define(
  [
    'jquery',
    'underscore',
    'backbone',
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
         * @property {string} type The format of the data. // TODO: List the supported
         * type values.
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
            options: {}
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
            // TODO
          }
          catch (error) {
            console.log(
              'There was an error initializing a MapAsset model' +
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
