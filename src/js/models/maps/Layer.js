'use strict';

define(
  [
    'jquery',
    'underscore',
    'backbone',
    'models/maps/MapAsset'
  ],
  function (
    $,
    _,
    Backbone,
    MapAsset
  ) {
    /**
     * @classdesc A Layer Model comprises the information required to fetch a layer to
     * display on a map, such as imagery or vector data. This model also contains metadata
     * about the source data for the layer, such as an attribution and a description.
     * @classcategory Models/Maps
     * @class Layer
     * @name Layer @ extends MapAsset
     * @since 2.x.x
     * @constructor
    */
    var Layer = MapAsset.extend(
      /** @lends Layer.prototype */ {

        /**
         * The name of this type of model
         * @type {string}
        */
        type: 'Layer',

        /**
         * Default attributes for Layer models. Also includes all of the properties listed
         * in {MapAsset#defaults}.
         * @name Layer#defaults
         * @property {Boolean} selected Set to true when this Layer has been selected by
         * the user in the layer list.
        */
        defaults: function () {
          return _.extend(
            this.constructor.__super__.defaults.apply(this),
            {
              // TODO: add and document additional properties that are specific to layers
              selected: false
            }
          );
        },

        /**
         * Executed when a new Layer model is created.
         * @param {Object} [attributes] The initial values of the attributes, which will
         * be set on the model.
         * @param {Object} [options] Options for the initialize function.
         */
        initialize: function (attributes, options) {
          try {
            this.constructor.__super__.initialize.apply(this, [attributes, options]);
          }
          catch (error) {
            console.log(
              'There was an error initializing a Layer model' +
              '. Error details: ' + error
            );
          }
        },

        // /**
        //  * Parses the given input into a JSON object to be set on the model.
        //  *
        //  * @param {TODO} input - The raw response object
        //  * @return {TODO} - The JSON object of all the Layer attributes
        //  */
        // parse: function (input) {

        //   try {

        //     var modelJSON = {};

        //     return modelJSON

        //   }
        //   catch (error) {
        //     console.log(
        //       'There was an error parsing a Layer model' +
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
        //     // this.constructor.__super__.validate.apply(this, [attributes, options]);
        //   }
        //   catch (error) {
        //     console.log(
        //       'There was an error validating a Layer model' +
        //       '. Error details: ' + error
        //     );
        //   }
        // },

        // /**
        //  * Creates a string using the values set on this model's attributes.
        //  * @return {string} The Layer string
        //  */
        // serialize: function () {
        //   try {
        //     var serializedLayer = "";

        //     return serializedLayer;
        //   }
        //   catch (error) {
        //     console.log(
        //       'There was an error serializing a Layer model' +
        //       '. Error details: ' + error
        //     );
        //   }
        // },

      });

    return Layer;

  }
);
