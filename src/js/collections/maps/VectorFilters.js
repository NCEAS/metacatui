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
     * @classcategory Collections/Maps
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
        model: VectorFilter

      }
    );

    return VectorFilters;

  }
);