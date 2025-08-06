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
       * @property {string[]} [allValues] Only used for categorical filters. The
       * list of all possible values that can be set for the property. This is
       * used to allow dynamic filtering of categorical properties.
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

          // Active status is set conditionally based on whether any features are filtered
          const filterEvents =
            "change:values change:min change:max change:filterType";
          this.stopListening(this, filterEvents);
          this.listenTo(this, filterEvents, this.setActiveState);
          // Set the initial active state
          this.setActiveState();
        }
      },

      /**
       * Sets the active state of the filter based values (for categorical
       * filters) or min/max (for numeric filters).
       * @since 2.34.0
       */
      setActiveState() {
        this.set("active", this.isActive() === true);
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

      /**
       * This function checks if the filter is active based on its configuration.
       * A filter is considered active if it has values set (for categorical filters)
       * or if it has a min or max set (for numeric filters).
       * @returns {boolean} Returns true if the filter is active, false otherwise.
       * @since 2.34.0
       */
      isActive() {
        const isDefinedNumber = (num) => num && num !== 0;
        const type = this.get("filterType");
        if (type === "categorical") {
          // A filter is active if it has values set, or if it has a min or max set
          const values = this.get("values");
          const allValues = this.get("allValues");
          return (
            Array.isArray(values) &&
            values.length &&
            values.length < allValues.length
          );
        }
        if (type === "numeric") {
          // A numeric filter is active if it has a min or max set
          const min = this.get("min");
          const max = this.get("max");
          return isDefinedNumber(min) || isDefinedNumber(max);
        }
        return false; // If filterType is not recognized, return false
      },
    },
  );

  return VectorFilter;
});
