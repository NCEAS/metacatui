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
     * scale for an asset in a map. The last color in the collection is treated as a
     * default.
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
         * Finds the last color model in the collection. If there are no colors in the
         * collection, returns the default color set in a new Asset Color model.
         * @return {AssetColor}
         */
        getDefaultColor: function () {
          let defaultColor = this.at(-1)
          if (!defaultColor) {
            defaultColor = new AssetColor();
          }
          return defaultColor
        }
      }
    );

    return AssetColors;

  }
);