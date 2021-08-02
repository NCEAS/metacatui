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

        /**
         * Executed when a new Layers collection is created.
         */
        initialize: function () {
          try {
            // Only allow one Layer in the collection to be selected at a time. When a
            // layer model's 'selected' attribute is changed to true, change all of the
            // other model's selected attribute to false.
            this.stopListening(this, 'change:selected');
            this.listenTo(this, 'change:selected', function (changedLayer, newValue) {
              if (newValue === true) {
                var otherModels = this.reject(function (layerModel) {
                  return layerModel === changedLayer
                })
                otherModels.forEach(function (otherModel) {
                  otherModel.set('selected', false)
                })
              }
            })
          }
          catch (error) {
            console.log(
              'There was an error initializing a Layers collection' +
              '. Error details: ' + error
            );
          }
        },

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