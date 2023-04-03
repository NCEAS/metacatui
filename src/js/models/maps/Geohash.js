"use strict";

define(["jquery", "underscore", "backbone", "nGeohash"], function (
  $,
  _,
  Backbone,
  nGeohash
) {
  /**
   * @classdesc A Geohash Model represents a single geohash.
   * @classcategory Models/Geohashes
   * @class Geohash
   * @name Geohash
   * @extends Backbone.Model
   * @since x.x.x
   * @constructor
   */
  var Geohash = Backbone.Model.extend(
    /** @lends Geohash.prototype */ {
      /**
       * The name of this type of model
       * @type {string}
       */
      type: "Geohash",

      /**
       * Default attributes for Geohash models
       * @name Geohash#defaults
       * @type {Object}
       * @property {string} geohash The geohash value/ID.
       * @property {Object} [properties] An object containing arbitrary
       * properties associated with the geohash. (e.g. count values from
       * SolrResults)
       */
      defaults: function () {
        return {
          geohash: "", // TODO: the proper name for a geohash ID is hashstring or hash. Rename this in all places it is used. Also rename "level" to precision.
          properties: {},
        };
      },

      /**
       * Overwrite the get method to calculate bounds, point, level, and
       * arbitrary properties on the fly.
       * @param {string} attr The attribute to get the value of.
       * @returns {*} The value of the attribute.
       */
      get: function (attr) {
        if (attr === "bounds") return this.getBounds();
        if (attr === "point") return this.getPoint();
        if (attr === "level") return this.getLevel();
        if (attr === "geojson") return this.toGeoJSON();
        if (this.isProperty(attr)) return this.getProperty(attr);
        return Backbone.Model.prototype.get.call(this, attr);
      },

      /**
       * Checks if the geohash is empty. it is empty if it has no ID set.
       * @returns {boolean} True if the geohash is empty, false otherwise.
       */
      isEmpty: function () {
        const geohash = this.get("geohash");
        return !geohash || geohash.length === 0;
      },

      /**
       * Checks if the geohash has a property with the given key.
       * @param {string} key The key to check for.
       * @returns {boolean} True if the geohash has a property with the given
       * key, false otherwise.
       */
      isProperty: function (key) {
        // Must use prototype.get to avoid infinite loop
        const properties = Backbone.Model.prototype.get.call(this, key);
        return properties?.hasOwnProperty(key);
      },

      /**
       * Get a property from the geohash.
       * @param {string} key The key of the property to get.
       * @returns {*} The value of the property.
       */
      getProperty: function (key) {
        if (!key) return null;
        if (!this.isProperty(key)) {
          return null;
        }
        return this.get("properties")[key];
      },

      /**
       * Set a property on the geohash.
       * @param {string} key The key of the property to set.
       * @param {*} value The value of the property to set.
       */
      addProperty: function (key, value) {
        if (!key) return;
        const properties = this.get("properties");
        properties[key] = value;
        this.set("properties", properties);
      },

      /**
       * Remove a property from the geohash.
       * @param {string} key The key of the property to remove.
       */
      removeProperty: function (key) {
        if (!key) return;
        const properties = this.get("properties");
        delete properties[key];
        this.set("properties", properties);
      },

      /**
       * Get the bounds of the geohash "tile".
       * @returns {Array|null} An array containing the bounds of the geohash.
       */
      getBounds: function () {
        if (this.isEmpty()) return null;
        return nGeohash.decode_bbox(this.get("geohash"));
      },

      /**
       * Get the center point of the geohash.
       * @returns {Object|null} Returns object with latitude and longitude keys.
       */
      getPoint: function () {
        if (this.isEmpty()) return null;
        return nGeohash.decode(this.get("geohash"));
      },

      /**
       * Get the level of the geohash.
       * @returns {number|null} The level of the geohash.
       */
      getLevel: function () {
        if (this.isEmpty()) return null;
        return this.get("geohash").length;
      },

      /**
       * Get the 32 child geohashes of the geohash.
       * @param {boolean} [keepProperties=false] If true, the child geohashes
       * will have the same properties as the parent geohash.
       * @returns {Geohash[]} An array of Geohash models.
       */
      getChildGeohashes: function (keepProperties = false) {
        if (this.isEmpty()) return null;
        const geohashes = [];
        const geohash = this.get("geohash");
        for (let i = 0; i < 32; i++) {
          geohashes.push(new Geohash({
            geohash: geohash + i.toString(32),
            properties: keepProperties ? this.get("properties") : {}
          }));
        }
        return geohashes;
      },

      /**
       * Get the parent geohash of the geohash.
       * @param {boolean} [keepProperties=false] If true, the parent geohash
       * will have the same properties as this child geohash.
       * @returns {Geohash|null} A Geohash model or null if the geohash is empty.
       */
      getParentGeohash: function (keepProperties = false) {
        if (this.isEmpty()) return null;
        const geohash = this.get("geohash");
        if (geohash.length === 0) return null;
        return new Geohash({
          geohash: geohash.slice(0, -1),
          properties: keepProperties ? this.get("properties") : {}
        });
      },

      /**
       * Get the geohash as a GeoJSON Feature.
       * @returns {Object} A GeoJSON Feature representing the geohash.
       */
      toGeoJSON: function () {
        const bounds = this.getBounds();
        if (!bounds) return null;
        return {
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [bounds[0], bounds[1]],
                [bounds[2], bounds[1]],
                [bounds[2], bounds[3]],
                [bounds[0], bounds[3]],
                [bounds[0], bounds[1]],
              ],
            ],
          },
          properties: this.get("properties"),
        };
      },
    }
  );

  return Geohash;
});
