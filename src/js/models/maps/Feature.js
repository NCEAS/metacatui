"use strict";

define(["jquery", "underscore", "backbone"], function ($, _, Backbone) {
  /**
   * @classdesc A Feature Model organizes information about a single feature of
   * a vector layer in a map.
   * @classcategory Models/Maps
   * @class Feature
   * @name Feature
   * @extends Backbone.Model
   * @since 2.18.0
   * @constructor
   */
  var Feature = Backbone.Model.extend(
    /** @lends Feature.prototype */ {
      /**
       * The name of this type of model
       * @type {string}
       */
      type: "Feature",

      /**
       * Default attributes for Feature models
       * @name Feature#defaults
       * @type {Object}
       * @property {Object} properties Property names (keys) and property values
       * (values) for properties set on this feature. For example, the
       * properties that would be in an attributes table for a shapefile.
       * @property {MapAsset} mapAsset If the feature is part of a Map Asset,
       * then the model for that asset. For example, if this is a feature if a
       * 3D tileset, then the Cesium3DTileset map asset model.
       * @property {string|number} featureID An ID that's used to identify this
       * feature in the map. It should be unique among all map features. (In
       * Cesium, this is the Pick ID key.)
       * @property {*} featureObject The object that a Map widget uses to
       * represent this feature in the map. For example, in Cesium this could be
       * a Cesium.Cesium3DTileFeature or a Cesium.Entity.
       * @property {string} label An optional friendly label or name for this
       * feature.
       */
      defaults: function () {
        return {
          properties: {},
          mapAsset: null,
          featureID: null,
          featureObject: null,
          label: null,
        };
      },

      /**
       * Checks if the attributes for this model are only the default
       * attributes.
       * @returns {boolean} Returns true if all of the attributes are equal to
       * the default attributes, false otherwise.
       */
      isDefault: function () {
        try {
          var defaults = this.defaults();
          var current = this.attributes;
          return _.isEqual(defaults, current);
        } catch (error) {
          console.log(
            "Failed to check if a Feature model is the default.",
            error,
          );
        }
      },

      /**
       * Clears all the model attributes and sets them to the default values.
       * This will trigger a change event. No event is triggered if all of the
       * value are already set to default.
       */
      setToDefault: function () {
        try {
          // Don't make changes if model is already the default
          if (!this.isDefault()) {
            this.clear({ silent: true });
            this.set(this.defaults());
          }
        } catch (error) {
          console.log(
            "There was an error reset a Feature model to default" +
              ". Error details: " +
              error,
          );
        }
      },

      /**
       * Given an map-widget-specific-object representing a feature, and a
       * MapAssets collection, this function will attempt to find the
       * corresponding MapAsset model in the collection, and extract the
       * feature attributes from that model.
       * @param {*} feature - An object representing a feature in the map. For
       * example, in Cesium this could be a Cesium.Cesium3DTileFeature or a
       * Cesium.Entity.
       * @param {MapAssets} assets - A MapAssets collection to use to extract
       * feature attributes from a feature object.
       * @returns {object} - The JSON object of all the Feature attributes
       * @since 2.27.0
       */
      attrsFromFeatureObject: function (feature, assets) {
        if (feature instanceof Feature) {
          return feature.clone().attributes;
        }
        let attrs = null;
        // if this is already an object with feature attributes, return it
        if (typeof feature == "object") {
          if (
            feature.hasOwnProperty("mapAsset") &&
            feature.hasOwnProperty("properties")
          ) {
            attrs = feature;
          } else if (assets) {
            attrs = assets.getFeatureAttributes([feature])[0];
          }
        }
        return attrs;
      },

      /**
       * Parses the given input into a JSON object to be set on the model. If
       * passed a MapAssets collection as an option, and the input includes an
       * assets property, then the parse function will attempt to find the
       * feature object's corresponding MapAsset model in the collection, and
       * extract the feature attributes from that model.
       *
       * @param {object} input - The raw response object
       * @param {object} [options] - Options for the parse function
       * @property {MapAssets} [options.assets] - A MapAssets collection to use
       * to extract feature attributes from a feature object.
       * @return {object} - The JSON object of all the Feature attributes
       */
      parse: function (input, options) {
        try {
          if (!input) return null;
          if (input.featureObject && options.assets) {
            const attrs = this.attrsFromFeatureObject(
              input.featureObject,
              options.assets,
            );
            input = Object.assign({}, input, attrs);
          }

          return input;
        } catch (error) {
          console.log("Failed to parse a Feature model", error);
        }
      },
    },
  );

  return Feature;
});
