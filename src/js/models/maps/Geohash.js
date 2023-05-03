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
        if (attr === "czml") return this.toCZML();
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
        const properties = Backbone.Model.prototype.get.call(
          this,
          "properties"
        );
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
       * Get the group ID of the geohash at the specified level.
       * @param {number} level - The number of levels to go up from the current geohash.
       * @returns {string} The group ID of the geohash at the specified level.
       */
      getGroupID: function (level = 1) {
        if (this.isEmpty()) return "";
        const hashString = this.get("hashString");
        const newLength = Math.max(0, hashString.length - level);
        return hashString.slice(0, newLength);
      },

      /**
       * Checks if this geohash contains the given geohash
       * @param {string} hashString The hashString of the geohash to check.
       */
      isParentOf: function (hashString) {
        if (this.isEmpty()) return false;
        if (hashString.length < this.get("hashString").length) return false;
        return hashString.startsWith(this.get("hashString"));
      },

      /**
       * Get the data from this model that is needed to create geometries for various
       * formats of geospacial data, like GeoJSON and CZML.
       * @param {string} geometry The type of geometry to get. Can be "rectangle",
       * "point", or "both".
       * @returns {Object|null} An object with the keys "rectangle", "point", and
       * "properties".
       */
      getGeoData: function (geometry = "both") {
        if (this.isEmpty()) return null;

        const geoData = {};

        const properties = this.get("properties");
        properties["hashString"] = this.get("hashString");
        geoData["properties"] = properties;

        if (geometry === "rectangle" || geometry === "both") {
          const bounds = this.getBounds();
          if (bounds) {
            let [south, west, north, east] = bounds;
            // Set min latitude to -89.99999 for Geohashes. This is for Cesium.
            if (south && west && north && east) {
              if (south === -90) south = -89.99999;
            }
            geoData["rectangle"] = [
              [west, south],
              [east, south],
              [east, north],
              [west, north],
              [west, south],
            ];
          }
        }
        if (geometry === "point" || geometry === "both") {
          geoData["point"] = this.getPoint();
        }

        return geoData;
      },

      /**
       * Get the geohash as a GeoJSON Feature.
       * @returns {Object} A GeoJSON Feature representing the geohash.
       */
      toGeoJSON: function () {
        const geoData = this.getGeoData("rectangle");
        if (!geoData) return null;
        const { rectangle, properties } = geoData;
        if (!rectangle) return null;
        return {
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [rectangle],
          },
          properties: properties,
        };
      },

      toGeoJSONPoint: function () {
        const geoData = this.getGeoData("point");
        if (!geoData) return null;
        const { point, properties } = geoData;
        return {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [point.longitude, point.latitude],
          },
          properties: properties,
        };
      },

      /**
       * Get the geohash as a CZML Feature.
       * @param {*} label The key for the property to display as a label.
       * @returns {Object} A CZML Feature representing the geohash, including
       * a polygon of the geohash area and a label with the value of the
       * property specified by the label parameter.
       */
      toCZML: function (label) {
        const geoData = this.getGeoData("both");
        if (!geoData) return null;
        const { rectangle, point, properties } = geoData;
        const id = properties["hashString"];

        const ecefCoordinates = rectangle.map((coord) =>
          this.geodeticToECEF(coord)
        );
        const ecefPosition = this.geodeticToECEF([
          point.longitude,
          point.latitude,
        ]);
        const feature = {
          id: id,
          polygon: {
            positions: {
              cartesian: ecefCoordinates.flat(),
            },
            height: 0,
          },
          properties: properties,
        };
        if (label) {
          (feature["label"] = {
            text: properties[label].toString(),
            show: true,
            fillColor: {
              rgba: [255, 255, 255, 255],
            },
            outlineColor: {
              rgba: [0, 0, 0, 255],
            },
            outlineWidth: 1,
            style: "FILL_AND_OUTLINE",
            font: "14pt Helvetica",
            horizontalOrigin: "CENTER",
            verticalOrigin: "CENTER",
            heightReference: "CLAMP_TO_GROUND",
            disableDepthTestDistance: 10000000,
          }),
            (feature["position"] = { cartesian: ecefPosition });
        }
        return [feature];
      },

      /**
       * Convert geodetic coordinates to Earth-Centered, Earth-Fixed (ECEF)
       * coordinates.
       * @param {Object} coord The geodetic coordinates, an array of longitude
       * and latitude.
       * @returns {Array} The ECEF coordinates.
       */
      geodeticToECEF: function (coord) {
        const a = 6378137; // WGS-84 semi-major axis (meters)
        const f = 1 / 298.257223563; // WGS-84 flattening
        const e2 = 2 * f - f * f; // Square of eccentricity

        const lon = coord[0] * (Math.PI / 180); // Convert longitude to radians
        const lat = coord[1] * (Math.PI / 180); // Convert latitude to radians
        const alt = 10000;
        const sinLon = Math.sin(lon);
        const cosLon = Math.cos(lon);
        const sinLat = Math.sin(lat);
        const cosLat = Math.cos(lat);

        const N = a / Math.sqrt(1 - e2 * sinLat * sinLat); // Prime vertical radius of curvature
        const x = (N + alt) * cosLat * cosLon;
        const y = (N + alt) * cosLat * sinLon;
        const z = (N * (1 - e2) + alt) * sinLat;

        return [x, y, z];
      },
    }
  );

  return Geohash;
});
