'use strict';

define(
  [
    'jquery',
    'underscore',
    'backbone',
    'models/maps/Layer'
  ],
  function (
    $,
    _,
    Backbone,
    Layer
  ) {

    /**
     * @class Layers
     * @classdesc A Layers collection is a group of Layer models - models that provide the
     * information required to render geo-spatial layers on a map.
     * @class Layers
     * @classcategory Collections/Maps
     * @extends Backbone.Collection
     * @since 2.x.x
     * @constructor
     */
    var Layers = Backbone.Collection.extend(
      /** @lends Layers.prototype */ {

        /**
        * The class/model that this collection contains.
        * @type {Backbone.Model}
        */
        model: Layer,

        // /**
        //  * Executed when a new Layers collection is created.
        //  */
        // initialize: function () {
        //   try {

        //   }
        //   catch (error) {
        //     console.log(
        //       'There was an error initializing a Layers collection' +
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
        //       'There was an error parsing a Layers collection' +
        //       '. Error details: ' + error
        //     );
        //   }

        // },

      }
    );

    return Layers;

  }
);