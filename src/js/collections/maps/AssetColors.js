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
        model: AssetColor

      }
    );

    return AssetColors;

  }
);