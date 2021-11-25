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
     * @classdesc A Feature Model organizes information about a single feature of a vector
     * layer in a map.
     * @classcategory Models/Maps
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
         * @property {Object} properties Property names (keys) and property values
         * (values) for properties set on this feature. For example, the properties that
         * would be in an attributes table for a shapefile.
         * @property {MapAsset} mapAsset If the feature is part of a Map Asset, then the
         * model for that asset. For example, if this is a feature if a 3D tileset, then
         * the Cesium3DTileset map asset model.
         * @property {string|number} featureID An ID that's used to identify this feature
         * in the map. It should be unique among all map features. (In Cesium, this is the
         * Pick ID key.)
         * @property {*} featureObject The object that a Map widget uses to represent this
         * feature in the map. For example, in Cesium this could be a
         * Cesium.Cesium3DTileFeature or a Cesium.Entity.
         * @property {string} label An optional friendly label for this feature.
        */
        defaults: function () {
          return {
            properties: {},
            mapAsset: null,
            featureID: null,
            featureObject: null,
            label: null
          }
        },

        // /**
        //  * Executed when a new Feature model is created.
        //  * @param {Object} [attributes] The initial values of the attributes, which will
        //  * be set on the model.
        //  * @param {Object} [options] Options for the initialize function.
        //  */
        // initialize: function (attributes, options) {
        //   try {

        //   }
        //   catch (error) {
        //     console.log(
        //       'There was an error initializing a Feature model' +
        //       '. Error details: ' + error
        //     );
        //   }
        // },

        /**
         * Checks if the attributes for this model are only the default attributes.
         * @returns {boolean} Returns true if all of the attributes are equal to the
         * default attributes, false otherwise.
         */
        isDefault: function () {
          try {
            var defaults = this.defaults()
            var current = this.attributes
            return _.isEqual(defaults, current)
          }
          catch (error) {
            console.log(
              'There was an error checking if a Feature model has only default attributes in a Feature' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Clears all the model attributes and sets them to the default values. This will
         * trigger a change event. No event is triggered if all of the value are already
         * set to default.
         */
        setToDefault: function () {
          try {
            // Don't make changes if model is already the default
            if (!this.isDefault()) {
              this.clear({ silent: true })
              this.set(this.defaults())
            }
          }
          catch (error) {
            console.log(
              'There was an error reset a Feature model to default' +
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
        //     var serializedFeature = '';

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
