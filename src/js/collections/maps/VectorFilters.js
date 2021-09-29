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
     * @classcategory Collections/maps
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

        // /**
        //  * Executed when a new VectorFilters collection is created.
        //  */
        // initialize: function () {
        //   try {

        //   }
        //   catch (error) {
        //     console.log(
        //       'There was an error initializing a VectorFilters collection' +
        //       '. Error details: ' + error
        //     );
        //   }
        // },

        // /**
        //  * Parses the given input into JSON objects used to create this collection's
        //  * models.
        //  *
        //  * @param {TODO} input - The raw response object
        //  * @return {Object[]} - The array of model attributes to be added to the
        //  * collection.
        //  */
        // parse: function (input) {

        //   try {

        //     var modelAttrs = [];

        //     return modelAttrs

        //   }
        //   catch (error) {
        //     console.log(
        //       'There was an error parsing a VectorFilters collection' +
        //       '. Error details: ' + error
        //     );
        //   }

        // },

      }
    );

    return VectorFilters;

  }
);