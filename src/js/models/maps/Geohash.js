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
       * Default attributes for Geohash models. Note that attributes like
       * precision, bounds, etc. are all calculated on the fly during the get
       * method.
       * @name Geohash#defaults
       * @type {Object}
       * @property {string} hashString The hashString of the geohash.
       * @property {Object} [properties] An object containing arbitrary
       * properties associated with the geohash. (e.g. count values from
       * SolrResults)
       */
      defaults: function () {
        return {
          hashString: "",
          properties: {},
        };
      },

      /**
       * Overwrite the get method to calculate bounds, point, precision, and
       * arbitrary properties on the fly.
       * @param {string} attr The attribute to get the value of.
       * @returns {*} The value of the attribute.
       */
      get: function (attr) {
        if (attr === "bounds") return this.getBounds();
        if (attr === "point") return this.getPoint();
        if (attr === "precision") return this.getPrecision();
        if (attr === "geojson") return this.toGeoJSON();
        if (attr === "groupID") return this.getGroupID();
        if (this.isProperty(attr)) return this.getProperty(attr);
        return Backbone.Model.prototype.get.call(this, attr);
      },

      /**
       * Checks if the geohash is empty. It is considered empty if it has no
       * hashString set.
       * @returns {boolean} true if the geohash is empty, false otherwise.
       */
      isEmpty: function () {
        const hashString = this.get("hashString");
        return !hashString || hashString.length === 0;
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
        if (!this.isProperty(key)) return null;
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
        return nGeohash.decode_bbox(this.get("hashString"));
      },

      /**
       * Get the center point of the geohash.
       * @returns {Object|null} Returns object with latitude and longitude keys.
       */
      getPoint: function () {
        if (this.isEmpty()) return null;
        return nGeohash.decode(this.get("hashString"));
      },

      /**
       * Get the precision of the geohash.
       * @returns {number|null} The precision of the geohash.
       */
      getPrecision: function () {
        if (this.isEmpty()) return null;
        return this.get("hashString").length;
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
        const hashString = this.get("hashString");
        for (let i = 0; i < 32; i++) {
          geohashes.push(
            new Geohash({
              hashString: hashString + i.toString(32),
              properties: keepProperties ? this.get("properties") : {},
            })
          );
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
        return new Geohash({
          hashString: this.getGroupID(),
          properties: keepProperties ? this.get("properties") : {},
        });
      },

      /**
       * Get all geohashes that belong in the same complete group of
       * 32 geohashes.
       */
      getGeohashGroup: function () {
        if (this.isEmpty()) return null;
        const parent = this.getParentGeohash();
        if (!parent) return null;
        return parent.getChildGeohashes();
      },

      /**
       * Get the group ID of the geohash. The group ID is the hashString of the
       * geohash without the last character, i.e. the hashString of the "parent"
       * geohash.
       * @returns {string} The group ID of the geohash.
       */
      getGroupID: function () {
        if (this.isEmpty()) return "";
        return this.get("hashString").slice(0, -1);
      },

      /**
       * Get the geohash as a GeoJSON Feature.
       * @returns {Object} A GeoJSON Feature representing the geohash.
       */
      toGeoJSON: function () {
        if (this.isEmpty()) return null;
        const bounds = this.getBounds();
        if (!bounds) return null;
        let [south, west, north, east] = bounds;
        if (!south && !west && !north && !east) return null;
        const properties = this.get("properties");
        properties["hashString"] = this.get("hashString");
        // Set min latitude to -89.99999 for Geohashes. This is for Cesium.
        if (south === -90) south = -89.99999;
        return {
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [west, south],
                [east, south],
                [east, north],
                [west, north],
                [west, south],
              ],
            ],
          },
          properties: properties,
        };
      },
    }
  );

  return Geohash;
});
