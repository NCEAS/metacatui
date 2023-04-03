"use strict";

define([
  "jquery",
  "underscore",
  "backbone",
  "nGeohash",
  "models/maps/Geohash",
], function ($, _, Backbone, nGeohash, Geohash) {
  /**
   * @classdesc A Geohashes Collection represents a collection of Geohash models.
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
        return model.get("geohash")?.length || 0;
      },

      /**
       * Get the geohash level to use for a given height.
       * @param {number} [height] - Altitude to use to calculate the geohash
       * level/precision, in meters.
       * @returns {number} Geohash level.
       */
      getLevelHeightMap: function () {
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
       * Get the geohash level to use for a given height.
       *
       * @param {number} [height] - Altitude to use to calculate the geohash
       * level/precision.
       */
      heightToLevel: function (height) {
        try {
          const levelHeightMap = this.getLevelHeightMap();
          return Object.keys(levelHeightMap).find(
            (key) => height >= levelHeightMap[key]
          );
        } catch (e) {
          console.log("Failed to get geohash level, returning 1" + e);
          return 1;
        }
      },

      /**
       * Retrieves the geohash IDs for the provided bounding boxes and level.
       *
       * @param {Object} bounds - Bounding box with north, south, east, and west
       * properties.
       * @param {number} level - Geohash level.
       * @returns {string[]} Array of geohash IDs.
       */
      getGeohashIDs: function (bounds, level) {
        let geohashIDs = [];
        bounds = this.splitBoundingBox(bounds);
        bounds.forEach(function (bb) {
          geohashIDs = geohashIDs.concat(
            nGeohash.bboxes(bb.south, bb.west, bb.north, bb.east, level)
          );
        });
        return geohashIDs;
      },

      /**
       * Splits the bounding box if it crosses the prime meridian. Returns an
       * array of bounding boxes.
       *
       * @param {Object} bounds - Bounding box object with north, south, east,
       * and west properties.
       * @returns {Array<Object>} Array of bounding box objects.
       * @since x.x.x
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
       * Add geohashes to the collection based on a bounding box and height.
       * @param {Object} bounds - Bounding box with north, south, east, and west
       * properties.
       * @param {number} height - Altitude to use to calculate the geohash
       * level/precision.
       * @param {boolean} [overwrite=false] - Whether to overwrite the current
       * collection.
       */
      addGeohashesByExtent: function (bounds, height, overwrite = false) {
        const level = this.heightToLevel(height);
        const geohashIDs = this.getGeohashIDs(bounds, level);
        this.addGeohashesById(geohashIDs, overwrite);
      },

      /**
       * Add geohashes to the collection based on an array of geohash IDs.
       * @param {string[]} geohashIDs - Array of geohash IDs.
       * @param {boolean} [overwrite=false] - Whether to overwrite the current
       * collection.
       */
      addGeohashesById: function (geohashIDs, overwrite = false) {
        if (overwrite) this.reset();
        this.add(geohashIDs.map((id) => ({ geohash: id })));
      },

      /**
       * Get a subset of geohashes from this collection that are within the
       * provided bounding box.
       * @param {Object} bounds - Bounding box with north, south, east, and west
       * properties.
       * @returns {Geohashes} Subset of geohashes.
       */
      getSubsetByBounds: function (bounds) {
        const levels = this.getLevels();
        const hashes = [];
        levels.forEach((level) => {
          hashes = hashes.concat(this.getGeohashIDs(bounds, level));
        });
        const geohashes = this.filter((geohash) => {
          return hashes.includes(geohash.get("geohash"));
        });
        return new Geohashes(geohashes);
      },

      /**
       * Check if a geohash is in the collection. This will only consider
       * geohash IDs, not properties or any other attributes on the Geohash
       * models.
       * @param {Geohash} target - Geohash model or geohash hashstring.
       * @returns {boolean} Whether the geohash is in the collection.
       */
      includes: function (geohash) {
        const allHashes = this.getGeohashIDs();
        const geohashID =
          geohash instanceof Geohash ? geohash.get("geohash") : geohash;
        return allHashes.includes(geohashID);
      },

      /**
       * Determine if a set of geohashes can be merged into a single geohash.
       * They can be merged if all of the child geohashes are in the collection.
       * @param {Geohashes} geohashes - Geohashes collection.
       * @param {Geohash} target - Geohash model.
       * @returns {boolean} Whether the geohashes can be merged.
       */
      canMerge: function (geohashes, target) {
        const children = target.getChildGeohashes();
        return children.every((child) => geohashes.includes(child));
      },

      /**
       * Reduce the set of Geohashes to the minimal set of Geohashes that
       * completely cover the same area as the current set. Warning: this will
       * remove any properties or attributes from the returned Geohash models.
       * @returns {Geohashes} A new Geohashes collection.
       */
      getMerged: function () {
        // We will merge recursively, so we need to make a copy of the
        // collection.
        const geohashes = this.clone();
        let changed = true;
        while (changed) {
          changed = false;
          geohashes.sort();
          for (let i = 0; i < geohashes.length; i++) {
            const target = geohashes.at(i);
            if (this.canMerge(geohashes, target)) {
              const parent = target.getParentGeohash();
              const children = target.getChildGeohashes();
              geohashes.remove(children);
              geohashes.add(parent);
              changed = true;
              break;
            }
          }
        }
        return geohashes;
      },

      /**
       * Get the unique geohash levels for all geohashes in the collection.
       */
      getLevels: function () {
        return Array.from(new Set(this.map((geohash) => geohash.get("level"))));
      },
      /**
       * Return the geohashes as a GeoJSON FeatureCollection, where each
       * geohash is represented as a GeoJSON Polygon (rectangle).
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
    }
  );

  return Geohashes;
});

// TODO: consider adding this back in to optionally limit the number of geohashes
// const limit = this.get("maxGeohashes");
// if (limit && geohashIDs.length > limit && level > 1) {
//   while (geohashIDs.length > limit && level > 1) {
//     level--;
//     geohashIDs = this.getGeohashIDs(bounds, level);
//   }
// }
