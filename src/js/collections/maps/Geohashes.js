"use strict";

define([
  "jquery",
  "underscore",
  "backbone",
  "nGeohash",
  "models/maps/Geohash",
], function ($, _, Backbone, nGeohash, Geohash) {
  /**
   * @classdesc A collection of adjacent geohashes, potentially at mixed
   * precision levels.
   * @classcategory Collections/Geohashes
   * @class Geohashes
   * @name Geohashes
   * @extends Backbone.Collection
   * @since x.x.x
   * @constructor
   */
  var Geohashes = Backbone.Collection.extend(
    /** @lends Geohashes.prototype */ {
      /**
       * The name of this type of collection
       * @type {string}
       */
      type: "Geohashes",

      /**
       * The model class for this collection
       * @type {Geohash}
       */
      model: Geohash,

      /**
       * Add a comparator to sort the geohashes by length.
       * @param {Geohash} model - Geohash model to compare.
       * @returns {number} Length of the geohash.
       */
      comparator: function (model) {
        return model.get("hashString")?.length || 0;
      },

      /**
       * Get the precision height map.
       * @returns {Object} Precision height map, where the key is the geohash
       * precision level and the value is the height in meters.
       */
      getPrecisionHeightMap: function () {
        return {
          1: 6800000,
          2: 2400000,
          3: 550000,
          4: 120000,
          5: 7000,
          6: 0,
        };
      },

      /**
       * Get the geohash precision level to use for a given height.
       * @param {number} [height] - Altitude to use to calculate the geohash
       * precision, in meters.
       * @returns {number} Geohash precision level.
       */
      heightToPrecision: function (height) {
        try {
          const precisionHeightMap = this.getPrecisionHeightMap();
          let precision = Object.keys(precisionHeightMap).find(
            (key) => height >= precisionHeightMap[key]
          );
          return precision ? parseInt(precision) : 1;
        } catch (e) {
          console.log("Failed to get geohash precision, returning 1" + e);
          return 1;
        }
      },

      /**
       * Checks if the geohashes in this model are empty or if there are no
       * models
       * @returns {boolean} True if this collection is empty.
       */
      isEmpty: function () {
        return (
          this.length === 0 || this.models.every((model) => model.isEmpty())
        );
      },

      /**
       * Returns true if the set of geohashes in this model collection are the
       * 32 geohashes at precision 1, i.e. [0-9a-v]
       * @returns {boolean} True if there are 32 geohashes with one character
       * each.
       */
      isCompleteRootLevel: function () {
        const hashStrings = this.getAllHashStrings();
        if (hashStrings.length !== 32) return false;
        if (hashStrings.some((hash) => hash.length !== 1)) return false;
        return true;
      },

      /**
       * Returns true if the geohashes in this model cover the entire earth.
       * @returns {boolean} True if the geohashes cover the entire earth.
       */
      coversEarth: function () {
        if (this.isEmpty()) return false;
        if (this.isCompleteRootLevel()) return true;
        return this.clone().consolidate().isCompleteRootLevel();
      },

      /**
       * Creates hashStrings for geohashes that are within the provided bounding
       * boxes at the given precision. The returned hashStrings are not
       * necessarily in the collection.
       * @param {Object} bounds - Bounding box with north, south, east, and west
       * properties.
       * @param {number} precision - Geohash precision level.
       * @returns {string[]} Array of geohash hashStrings.
       */
      getHashStringsByExtent: function (bounds, precision) {
        let hashStrings = [];
        bounds = this.splitBoundingBox(bounds);
        bounds.forEach(function (bb) {
          hashStrings = hashStrings.concat(
            nGeohash.bboxes(bb.south, bb.west, bb.north, bb.east, precision)
          );
        });
        return hashStrings;
      },

      /**
       * Returns a list of hashStrings in this collection. Optionally provide a
       * precision to only return hashes of that length.
       * @param {Number} precision - Geohash precision level.
       * @returns {string[]} Array of geohash hashStrings.
       */
      getAllHashStrings: function (precision) {
        const hashes = this.map((geohash) => geohash.get("hashString"));
        if (precision) {
          return hashes.filter((hash) => hash.length === precision);
        } else {
          return hashes;
        }
      },

      /**
       * Get an array of all the values for a given property in the geohash
       * models in this collection.
       * @param {string} attr The key of the property in the properties object
       * in each geohash model.
       */
      getAttr(attr) {
        return this.models.map((geohash) => geohash.get(attr));
      },

      /**
       * Splits a given bounding box if it crosses the prime meridian. Returns
       * an array of bounding boxes.
       * @param {Object} bounds - Bounding box object with north, south, east,
       * and west properties.
       * @returns {Object[]} Array of bounding box objects.
       */
      splitBoundingBox: function (bounds) {
        if (!bounds) return [];
        const { north, south, east, west } = bounds;
        if (east < west) {
          return [
            { north, south, east: 180, west },
            { north, south, east, west: -180 },
          ];
        } else {
          return [{ north, south, east, west }];
        }
      },

      /**
       * Add geohashes to the collection based on a bounding box and height. All
       * geohashes within the bounding box at the corresponding precision will
       * be added to the collection.
       * @param {Object} bounds - Bounding box with north, south, east, and west
       * properties.
       * @param {number} height - Altitude in meters to use to calculate the
       * geohash precision level.
       * @param {boolean} [overwrite=false] - Whether to overwrite the current
       * collection.
       */
      addGeohashesByExtent: function (bounds, height, overwrite = false) {
        const precision = this.heightToPrecision(height);
        const hashStrings = this.getHashStringsByExtent(bounds, precision);
        this.addGeohashesByHashString(hashStrings, overwrite);
      },

      /**
       * Add geohashes to the collection based on an array of geohash
       * hashStrings.
       * @param {string[]} hashStrings - Array of geohash hashStrings.
       * @param {boolean} [overwrite=false] - Whether to overwrite the current
       * collection.
       */
      addGeohashesByHashString: function (hashStrings, overwrite = false) {
        const method = overwrite ? "reset" : "add";
        const geohashAttrs = hashStrings.map((gh) => {
          return { hashString: gh };
        });
        this[method](geohashAttrs);
      },

      /**
       * Get a subset of geohashes from this collection that are within the
       * provided bounding box.
       * @param {Object} bounds - Bounding box with north, south, east, and west
       * properties.
       * @returns {Geohashes} Subset of geohashes.
       */
      getSubsetByBounds: function (bounds) {
        const precisions = this.getPrecisions();
        let hashes = [];
        precisions.forEach((precision) => {
          hashes = hashes.concat(
            this.getHashStringsByExtent(bounds, precision)
          );
        });
        const subsetModels = this.filter((geohash) => {
          return hashes.includes(geohash.get("hashString"));
        });
        return new Geohashes(subsetModels);
      },

      /**
       * Check if a geohash is in the collection. This will only consider
       * geohash hashStrings, not properties or any other attributes on the
       * Geohash models.
       * @param {Geohash} target - Geohash model or geohash hashString.
       * @returns {boolean} Whether the target is part of this collection.
       */
      includes: function (geohash) {
        const allHashes = this.getAllHashStrings();
        const targetHash =
          geohash instanceof Geohash ? geohash.get("hashString") : geohash;
        return allHashes.includes(targetHash);
      },

      /**
       * Group the geohashes in the collection by their groupID. Their groupID
       * is the hashString of the parent geohash, i.e. the hashString of the
       * geohash with the last character removed.
       * @returns {Object} Object with groupIDs as keys and arrays of Geohash
       * models as values.
       */
      getGroups: function () {
        return this.groupBy((geohash) => {
          return geohash.get("groupID");
        });
      },

      /**
       * Get the geohash groups in this collection that are complete, i.e. have
       * 32 child geohashes.
       * @returns {Object} Object with groupIDs as keys and arrays of Geohash
       * models as values.
       */
      getCompleteGroups: function () {
        const groups = this.getGroups();
        const completeGroups = {};
        Object.keys(groups).forEach((groupID) => {
          if (groups[groupID].length === 32) {
            completeGroups[groupID] = groups[groupID];
          }
        });
        delete completeGroups[""];
        delete completeGroups[null];
        return completeGroups;
      },

      /**
       * Consolidate this collection: Merge complete groups of geohashes into a
       * single, lower precision "parent" geohash. Groups are complete if all 32
       * "child" geohashes that make up the "parent" geohash are in the
       * collection. Add and remove events will not be triggered during
       * consolidation.
       */
      consolidate: function () {
        let changed = true;
        while (changed) {
          changed = false;
          const toMerge = this.getCompleteGroups();
          let toRemove = [];
          let toAdd = [];
          Object.keys(toMerge).forEach((groupID) => {
            const parent = new Geohash({ hashString: groupID });
            toRemove = toRemove.concat(toMerge[groupID]);
            toAdd.push(parent);
            changed = true;
          });
          this.remove(toRemove, { silent: true });
          this.add(toAdd, { silent: true });
        }
        return this;
      },

      /**
       * Reduce the precision of the geohashes in the collection by a certain
       * number of levels. This will remove geohashes from the collection and
       * add new geohashes with lower precision. The properties of the
       * geohashes will be summarized using the provided propertySummaries.
       * @param {Number} by - Number of levels to reduce precision by.
       * @param {Object} propertySummaries - To keep properties in the resulting
       * geohashes, provide methods to summarize the properties of the child
       * geohashes. The keys of this object should be the names of the
       * properties to keep, and the values should be functions that take an
       * array of values and return a single value.
       */
      reducePrecision: function (by = 1, propertySummaries = {}) {
        // Group the geohashes by their parent geohash.
        const groups = this.getGroups();
        // Combine the geohashes in each group into a single geohash with lower
        // precision.
        const reduced = Object.keys(groups).map((groupID) => {
          const parent = new Geohash({ hashString: groupID });
          const children = groups[groupID];
          const properties = {};
          Object.keys(propertySummaries).forEach((key) => {
            const values = children.map((child) => {
              return child.get(key);
            });
            // log("values", values);
            properties[key] = propertySummaries[key](values);
          });
          parent.set("properties", properties);
          return parent;
        });
        // Remove the original geohashes and add the new ones.
        this.reset(reduced);
        return this;
      },

      /**
       * Get the unique geohash precision levels present in the collection.
       */
      getPrecisions: function () {
        return Array.from(new Set(this.map((gh) => gh.get("precision"))));
      },

      /**
       * Return the geohashes as a GeoJSON FeatureCollection, where each geohash
       * is represented as a GeoJSON Polygon (rectangle).
       * @returns {Object} GeoJSON FeatureCollection.
       */
      toGeoJSON: function () {
        return {
          type: "FeatureCollection",
          features: this.map(function (geohash) {
            return geohash.toGeoJSON();
          }),
        };
      },

      /**
       * Return the geohashes as a GeoJSON FeatureCollection, where each geohash
       * is represented as a GeoJSON Point.
       * @returns {Object} GeoJSON FeatureCollection.
       */
      toGeoJSONPoints: function () {
        return {
          type: "FeatureCollection",
          features: this.map(function (geohash) {
            return geohash.toGeoJSONPoint();
          }),
        };
      },

      /**
       * Return the geohashes as a CZML document, where each geohash is
       * represented as a CZML Polygon (rectangle) and a CZML Label.
       * @param {string} [label] - The key for the property that should be
       * displayed with a label for each geohash, e.g. "count"
       * @returns {Array} CZML document.
       */
      toCZML: function (label) {
        const czmlHeader = [
          {
            id: "document",
            version: "1.0",
            name: "Geohashes"
          },
        ];

        const czmlData = this.models.flatMap(function (geohash) {
          return geohash.toCZML(label);
        });

        return czmlHeader.concat(czmlData);
      },

      /**
       * Find the parent geohash from this collection that contains the provided
       * geohash hashString. If the hashString is already in the collection,
       * return that geohash. Otherwise, find the geohash that contains the
       * hashString.
       * @param {string} hashString - Geohash hashString.
       * @returns {Geohash} Parent geohash.
       */
      findParentByHashString: function (hashString) {
        if (!hashString || hashString.length === 0) return null;
        // First check if the hashString is already in the collection
        let geohash = this.findWhere({ hashString: hashString });
        if (geohash) return geohash;
        geohash = this.find((gh) => {
          return gh.isParentOf(hashString);
        });
        return geohash;
      },
    }
  );

  return Geohashes;
});
