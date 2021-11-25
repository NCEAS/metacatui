'use strict';

define(
  [
    'jquery',
    'underscore',
    'backbone',
    'models/maps/VectorFilter'
  ],
  function (
    $,
    _,
    Backbone,
    VectorFilter
  ) {

    /**
     * @class VectorFilters
     * @classdesc A VectorFilters collection is a set of conditions used to show or hide
     * features of a vector layer on a map.
     * @class VectorFilters
     * @classcategory Collections/Maps
     * @extends Backbone.Collection
     * @since 2.x.x
     * @constructor
     */
    var VectorFilters = Backbone.Collection.extend(
      /** @lends VectorFilters.prototype */ {

        /**
        * The class/model that this collection contains.
        * @type {Backbone.Model}
        */
        model: VectorFilter,

        /**
         * This function is used to determine if a feature should be shown or hidden based
         * on the current filters.
         * @param {Object} properties The properties of the feature to be filtered.
         * (See the 'properties' attribute of {@link Feature#defaults}.)
         * @returns {boolean} Returns true if the feature passes all of the filters.
         */
        featureIsVisible: function (properties) {
          try {
            if (!properties) {
              properties = {};
            }
            let visible = true;
            this.each(function (filter) {
              visible = visible && filter.featureIsVisible(properties);
            });
            return visible;
          }
          catch (error) {
            console.log(
              'There was an error filtering a feature in a VectorFilters collection' +
              '. Error details: ' + error + '. The feature will be visible.'
            );
            return true;
          }
        }

      }
    );

    return VectorFilters;

  }
);