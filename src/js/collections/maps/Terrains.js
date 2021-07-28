'use strict';

define(
  [
    'jquery',
    'underscore',
    'backbone',
    'models/maps/Terrain'
  ],
  function (
    $,
    _,
    Backbone,
    Terrain
  ) {

    /**
     * @class Terrains
     * @classdesc A Terrains collection is a group of Terrain models - models that
     * represent the underlying 3D structure of the surface of the Earth, to be used in 3D
     * maps.
     * @class Terrains
     * @classcategory Collections/Maps
     * @extends Backbone.Collection
     * @since 2.x.x
     * @constructor
     */
    var Terrains = Backbone.Collection.extend(
      /** @lends Terrains.prototype */ {

        /**
        * The class/model that this collection contains.
        * @type {Backbone.Model}
        */
        model: Terrain,

        // /**
        //  * Executed when a new Terrains collection is created.
        //  */
        // initialize: function () {
        //   try {

        //   }
        //   catch (error) {
        //     console.log(
        //       'There was an error initializing a Terrains collection' +
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
        //       'There was an error parsing a Terrains collection' +
        //       '. Error details: ' + error
        //     );
        //   }

        // },

      }
    );

    return Terrains;

  }
);