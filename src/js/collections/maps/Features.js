'use strict';

define(
  [
    'jquery',
    'underscore',
    'backbone',
    'models/maps/Feature'
  ],
  function (
    $,
    _,
    Backbone,
    Feature
  ) {

    /**
     * @class Features
     * @classdesc A Features collection contains the relevant properties of a group of
     * selected geo-spatial features from a map.
     * @class Features
     * @classcategory Collections/Maps
     * @extends Backbone.Collection
     * @since 2.x.x
     * @constructor
     */
    var Features = Backbone.Collection.extend(
      /** @lends Features.prototype */ {

        /**
        * The class/model that this collection contains.
        * @type {Backbone.Model}
        */
        model: Feature,

        // /**
        //  * Executed when a new Features collection is created.
        //  */
        // initialize: function () {
        //   try {

        //   }
        //   catch (error) {
        //     console.log(
        //       'There was an error initializing a Features collection' +
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
        //       'There was an error parsing a Features collection' +
        //       '. Error details: ' + error
        //     );
        //   }

        // },

      }
    );

    return Features;

  }
);