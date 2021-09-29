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
     * @classdesc A VectorFilter Model represents one condition used to show or hide
     * specific features of a vector layer on a map. The filter defines rules used to show
     * features conditionally based on properties of the feature.
     * @classcategory Models/Maps
     * @class VectorFilter
     * @name VectorFilter
     * @extends Backbone.Model
     * @since 2.x.x
     * @constructor
    */
    var VectorFilter = Backbone.Model.extend(
      /** @lends VectorFilter.prototype */ {

        /**
         * The name of this type of model
         * @type {string}
        */
        type: 'VectorFilter',

        /**
         * Default attributes for VectorFilter models
         * @name VectorFilter#defaults
         * @type {Object}
         * @property {string} filterType Set to 'categorical' or 'numeric'. If
         * categorical, then a feature will be visible when its property value exactly
         * matches one of those listed in the values attribute. If numerical, then a
         * feature will be visible when its property value is between the min and max.
         * @property {string} property The property (attribute) of the feature to filter
         * on.
         * @property {string[]|number[]} values Only used for categorical filters. If the
         * property matches one of the values listed, the feature will be displayed. If
         * the filter type is categorical and no values are set, then features will not be
         * filtered on this property.
         * @property {number} max Only used for numeric filters. The property's value must
         * be less than the value set here for the feature to be visible. If the filter
         * type is numeric, and max is set, then the max is infinite.
         * @property {number} min Only used for numeric filters. The property's value must
         * be greater than the value set here for the feature to be visible. If the filter
         * type is numeric, and min is set, then the min is minus infinity.
         *
        */
        defaults: function () {
          return {
            filterType: 'categorical',
            property: null,
            values: [],
            max: null,
            min: null
          }
        },

        // /**
        //  * Executed when a new VectorFilter model is created.
        //  * @param {Object} [attributes] The initial values of the attributes, which will
        //  * be set on the model.
        //  * @param {Object} [options] Options for the initialize function.
        //  */
        // initialize: function (attributes, options) {
        //   try {

        //   }
        //   catch (error) {
        //     console.log(
        //       'There was an error initializing a VectorFilter model' +
        //       '. Error details: ' + error
        //     );
        //   }
        // },

        // /**
        //  * Parses the given input into a JSON object to be set on the model.
        //  *
        //  * @param {TODO} input - The raw response object
        //  * @return {TODO} - The JSON object of all the VectorFilter attributes
        //  */
        // parse: function (input) {

        //   try {

        //     var modelJSON = {};

        //     return modelJSON

        //   }
        //   catch (error) {
        //     console.log(
        //       'There was an error parsing a VectorFilter model' +
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
        //       'There was an error validating a VectorFilter model' +
        //       '. Error details: ' + error
        //     );
        //   }
        // },

        // /**
        //  * Creates a string using the values set on this model's attributes.
        //  * @return {string} The VectorFilter string
        //  */
        // serialize: function () {
        //   try {
        //     var serializedVectorFilter = '';

        //     return serializedVectorFilter;
        //   }
        //   catch (error) {
        //     console.log(
        //       'There was an error serializing a VectorFilter model' +
        //       '. Error details: ' + error
        //     );
        //   }
        // },

      });

    return VectorFilter;

  }
);
