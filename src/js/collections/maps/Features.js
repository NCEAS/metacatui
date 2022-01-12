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
     * @since 2.18.0
     * @constructor
     */
    var Features = Backbone.Collection.extend(
      /** @lends Features.prototype */ {

        /**
        * The class/model that this collection contains.
        * @type {Backbone.Model}
        */
        model: Feature,

        /**
         * Get an array of all of the unique Map Assets that are associated with this
         * collection. (When a feature model is part of a layer, it will have the layer
         * model (Map Asset) set as a property)
         * @returns {MapAsset[]} Returns an a array of all the unique Map Assets (imagery,
         * tile sets, etc.) in this collection.
         */
        getMapAssets: function () {
          return this.getUniqueAttrs('mapAsset')
        },

        /**
         * Get an array of all the unique feature objects associated with this collection.
         * @param {string} [type] Optionally set a type of feature to return. If set, then
         * only features that have this constructor name will be returned.
         * @returns {Array} Returns an array of all of the unique feature objects in the
         * collection. Feature objects are the objects used by the map widget to represent
         * a feature in the map. For example, in Cesium this could be a
         * Cesium3DTileFeature or an Entity.
         */
        getFeatureObjects: function (type) {
          let featureObjects = this.getUniqueAttrs('featureObject')
          if (type) {
            featureObjects = featureObjects.filter(function (featureObject) {
              return featureObject.constructor.name === type
            })
          }
          return featureObjects
        },

        /**
         * Get an array of unique values for some attribute that may be set on the models
         * in this collection
         * @param {string} attrName The name of the attr to get unique values for
         * @returns {Array} Returns an array of unique values of the given attribute
         */
        getUniqueAttrs: function (attrName) {
          try {
            let uniqueAttrs = []
            this.each(function (featureModel) {
              const attr = featureModel.get(attrName)
              if (attr && !uniqueAttrs.includes(attr)) {
                uniqueAttrs.push(attr)
              }
            })
            return uniqueAttrs
          }
          catch (error) {
            console.log(
              'Failed to get unique values for an attribute in a Features collection' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Checks if a given feature object is an attribute in one of the Feature models
         * in this collection.
         * @param {*} featureObject 
         * @returns {boolean} Returns true if the given feature object is in this
         * collection, false otherwise.
         */
        containsFeature: function (featureObject) {
          const match = this.findWhere({ featureObject: featureObject })
          return match ? true : false
        },

      }
    );

    return Features;

  }
);