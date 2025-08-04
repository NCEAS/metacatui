"use strict";

define(["jquery", "underscore", "backbone"], function ($, _, Backbone) {
  /**
   * @classdesc A VectorFilter Model represents one condition used to show or hide
   * specific features of a vector layer on a map. The filter defines rules used to show
   * features conditionally based on properties of the feature. For example, it could
   * specify hiding all vectors for an asset that have an area greater than 10 km2.
   * @classcategory Models/Maps
   * @class VectorFilter
   * @name VectorFilter
   * @extends Backbone.Model
   * @since 2.18.0
   * @constructor
   */
  var VectorFilter = Backbone.Model.extend(
    /** @lends VectorFilter.prototype */ {
      /**
       * The name of this type of model
       * @type {string}
       */
      type: "VectorFilter",

      /**
       * A VectorFilterConfig specifies conditions under which specific features of a
       * vector layer on a map should be visible. The filter defines rules used to show
       * features conditionally based on properties of the feature. For example, it
       * could specify hiding all vectors for an asset that have an area greater than
       * 10km2. This configuration is passed to the {@link VectorFilter} model.
       * @typedef {Object} VectorFilterConfig
       * @name MapConfig#VectorFilterConfig
       * @property {('categorical'|'numeric')} filterType If categorical, then a feature
       * will be visible when its property value exactly matches one of those listed in
       * the values attribute. If numeric, then a feature will be visible when its
       * property value is between the min and max.
       * @property {string} property The property (attribute) of the {@link MapAsset}
       * feature to filter on.
       * @property {(string[]|number[])} values Only used for categorical filters. If
       * the property matches one of the values listed, the feature will be displayed.
       * If the filter type is categorical and no values are set, then features will not
       * be filtered on this property.
       * @property {number} max Only used for numeric filters. The property's value must
       * be less than the value set here for the feature to be visible. If the filter
       * type is numeric, and max is set, then the max is infinite.
       * @property {number} min Only used for numeric filters. The property's value must
       * be greater than the value set here for the feature to be visible. If the filter
       * type is numeric, and min is set, then the min is minus infinity.
       *
       * @example
       * // Only show vectors with an 'area' property set to less than 10
       * {
       *   filterType: 'numeric'
       *   property: 'area'
       *   max: 10
       * }
       *
       * @example
       * // Show only features that have the 'boreal' or 'tropical' property set on their 'forestType' attribute
       * {
       *   filterType: 'categorical'
       *   property: 'forestType'
       *   values: ['boreal', 'tropical']
       * }
       */

      /**
       * Default attributes for VectorFilter models
       * @name VectorFilter#defaults
       * @type {Object}
       * @property {('categorical'|'numeric')} [filterType='categorical'] If
       * categorical, then a feature will be visible when its property value exactly
       * matches one of those listed in the values attribute. If numerical, then a
       * feature will be visible when its property value is between the min and max.
       * @property {string} property The property (attribute) of the feature to filter
       * on.
       * @property {(string[]|number[])} values Only used for categorical filters. If
       * the property matches one of the values listed, the feature will be displayed.
       * If the filter type is categorical and no values are set, then features will not
       * be filtered on this property.
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
          filterType: "categorical",
          property: null,
          values: [],
          max: null,
          min: null,
        };
      },

      /** @inheritdoc */
      initialize(attributes, _options) {
        if (attributes.filterType === "categorical") {
          // Read filter model values
          const allValues = attributes?.allValues || [];
          const values = attributes?.values || [];

          // Check if filter model value exist and are are non-empty arrays
          const hasValues = Array.isArray(values) && values.length;
          const hasAllValues = Array.isArray(allValues) && allValues.length;

          // If allValues is not defined in the filter model but values is, copy current values into allValues
          if (!hasAllValues && hasValues) {
            this.set("allValues", [...values]);
          }

          // Assign values that is initially set in filter model to modelValues if hasValues is true,
          // otherwise if hasAllValues is true, assign allValues to modelValues.
          // If neither hasValues or hasAllValues is true, then set modelValues to an empty array.
          let modelValues = hasValues ? values : null;
          if (!modelValues) modelValues = hasAllValues ? allValues : [];
          this.set("values", [...modelValues]);

          // Store a copy of the initial value selection as a default
          this.set("defaultValues", [...modelValues]);

          // If neither values nor allValues exist, then filterModelAvailable is set to false.
          // This is used to show/hide the Filter by Property panel.
          // This has to be tested in the future with other portal configs, where this might be the case
          // if (!hasValues && !hasAllValues) {
          //   this.set("filterModelAvailable", false);
          // } else {
          //   this.set("filterModelAvailable", true);
          // }
        }
      },

      /**
       * This function checks if a feature is visible based on the filter's rules.
       * @param {Object} properties The properties of the feature to be filtered. (See
       * the 'properties' attribute of {@link Feature#defaults}.)
       * @returns {boolean} Returns true if the feature properties pass this filter
       */
      featureIsVisible: function (properties) {
        try {
          if (!properties) {
            properties = {};
          }
          var visible = true;
          if (this.get("filterType") === "categorical") {
            var values = this.get("values");
            if (values.length > 0) {
              visible = _.contains(values, properties[this.get("property")]);
            }
          } else if (this.get("filterType") === "numeric") {
            var max = this.get("max");
            var min = this.get("min");
            if (max !== null) {
              visible = properties[this.get("property")] < max;
            }
            if (min !== null) {
              visible = properties[this.get("property")] > min && visible;
            }
          }
          return visible;
        } catch (error) {
          console.log(
            "There was an error checking feature visibility in a VectorFilter" +
              ". Error details: " +
              error,
          );
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
    },
  );

  return VectorFilter;
});
