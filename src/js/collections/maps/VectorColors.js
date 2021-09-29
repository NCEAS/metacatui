'use strict';

define(
  [
    'jquery',
    'underscore',
    'backbone',
    'models/maps/VectorColor'
  ],
  function (
    $,
    _,
    Backbone,
    VectorColor
  ) {

    /**
     * @class VectorColors
     * @classdesc A VectorColors collection represents the colors used to create a color
     * scale for a Vector layer in a map. The last color in the collection should ideally
     * be a default (see VectorColor model for details on how to set a default color.)
     * @class VectorColors
     * @classcategory Collections/maps
     * @extends Backbone.Collection
     * @since 2.x.x
     * @constructor
     */
    var VectorColors = Backbone.Collection.extend(
      /** @lends VectorColors.prototype */ {

        /**
        * The class/model that this collection contains.
        * @type {Backbone.Model}
        */
        model: VectorColor,

        // /**
        //  * Executed when a new VectorColors collection is created.
        //  */
        // initialize: function () {
        //   try {

        //   }
        //   catch (error) {
        //     console.log(
        //       'There was an error initializing a VectorColors collection' +
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
        //       'There was an error parsing a VectorColors collection' +
        //       '. Error details: ' + error
        //     );
        //   }

        // },

      }
    );

    return VectorColors;

  }
);