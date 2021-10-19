'use strict';

define(
  [
    'jquery',
    'underscore',
    'backbone',
    'models/maps/AssetColor'
  ],
  function (
    $,
    _,
    Backbone,
    AssetColor
  ) {

    /**
     * @class AssetColors
     * @classdesc An AssetColors collection represents the colors used to create a color
     * scale for an asset in a map. The last color in the collection should ideally
     * be a default (see AssetColor model for details on how to set a default color.)
     * @class AssetColors
     * @classcategory Collections/maps
     * @extends Backbone.Collection
     * @since 2.x.x
     * @constructor
     */
    var AssetColors = Backbone.Collection.extend(
      /** @lends AssetColors.prototype */ {

        /**
        * The class/model that this collection contains.
        * @type {Backbone.Model}
        */
        model: AssetColor,

        // /**
        //  * Executed when a new AssetColors collection is created.
        //  */
        // initialize: function () {
        //   try {

        //   }
        //   catch (error) {
        //     console.log(
        //       'There was an error initializing a AssetColors collection' +
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
        //       'There was an error parsing a AssetColors collection' +
        //       '. Error details: ' + error
        //     );
        //   }

        // },

      }
    );

    return AssetColors;

  }
);