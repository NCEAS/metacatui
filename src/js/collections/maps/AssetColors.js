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
     * scale for an asset in a map. The last color in the collection should ideally be a
     * default (see {@link AssetColor#defaults} for details on how to set a default
     * color.)
     * @class AssetColors
     * @classcategory Collections/Maps
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

        /**
         * Finds the last color model in the collection that has its value attribute set
         * to null. If no such color model is found, returns a default color model.
         * @return {AssetColor}
         */
        getDefaultColor: function () {
          let defaultColor = this.where({ value: null }) || this.where({ value: '' })
          if (defaultColor.length) {
            // Get the last colour in the array, in case there's more than one
            defaultColor = defaultColor.slice(-1).pop()
          }
          if (!defaultColor || !defaultColor.length) {
            defaultColor = new AssetColor();
          }
          return defaultColor
        }
      }
    );

    return AssetColors;

  }
);