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
     * @classdesc A Feature Model represents a .... TODO
     * @classcategory Models/Maps // TODO
     * @class Feature
     * @name Feature
     * @extends Backbone.Model
     * @since 2.x.x
     * @constructor
    */
    var Feature = Backbone.Model.extend(
      /** @lends Feature.prototype */ {

        /**
         * The name of this type of model
         * @type {string}
        */
        type: 'Feature',

        /**
         * Default attributes for Feature models
         * @name Feature#defaults
         * @type {Object}
         * @property {TODO} propertyName property description TODO
        */
        defaults: function () {
          return {

          }
        },

        /**
         * Executed when a new Feature model is created.
         * @param {Object} [attributes] The initial values of the attributes, which will
         * be set on the model.
         * @param {Object} [options] Options for the initialize function.
         */
        initialize: function (attributes, options) {
          try {

          }
          catch (error) {
            console.log(
              'There was an error initializing a Feature model' +
              '. Error details: ' + error
            );
          }
        },

        // /**
        //  * Parses the given input into a JSON object to be set on the model.
        //  *
        //  * @param {TODO} input - The raw response object
        //  * @return {TODO} - The JSON object of all the Feature attributes
        //  */
        // parse: function (input) {

        //   try {

        //     var modelJSON = {};

        //     return modelJSON

        //   }
        //   catch (error) {
        //     console.log(
        //       'There was an error parsing a Feature model' +
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
        //       'There was an error validating a Feature model' +
        //       '. Error details: ' + error
        //     );
        //   }
        // },

        // /**
        //  * Creates a string using the values set on this model's attributes.
        //  * @return {string} The Feature string
        //  */
        // serialize: function () {
        //   try {
        //     var serializedFeature = "";

        //     return serializedFeature;
        //   }
        //   catch (error) {
        //     console.log(
        //       'There was an error serializing a Feature model' +
        //       '. Error details: ' + error
        //     );
        //   }
        // },

      });

    return Feature;

  }
);
