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
   * @since 2.25.0
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
       * Initialize the collection and set the min and max precision levels.
       * @param {Geohash[]} models - Array of Geohash models.
       * @param {Object} options - Options to pass to the collection.
       * @param {number} [options.maxPrecision=9] - The maximum precision level
       * to use when adding geohashes to the collection.
       * @param {number} [options.minPrecision=1] - The minimum precision level
       * to use when adding geohashes to the collection.
       */
      initialize: function (models, options) {
        // Set the absolute min and max precision levels. Min should not be
        // lower than 1. Max must be greater than or equal to min.
        this.MAX_PRECISION = options?.maxPrecision || 9;
        this.MIN_PRECISION = options?.minPrecision || 1;
        if (this.MIN_PRECISION < 1) this.MIN_PRECISION = 1;
        if (this.MAX_PRECISION < this.MIN_PRECISION) {
          this.MAX_PRECISION = this.MIN_PRECISION;
        }
      },

      /**
       * Ensure that a precision or list of precisions is valid. A valid precision
       * is a positive number in the range of the MIN_PRECISION and MAX_PRECISION
       * set on the collection.
       * @param {number|number[]} precision - Precision level or array of
       * precision levels.
       * @param {boolean} [fix=true] - Whether to fix the precision by setting it
       * to the min or max precision if it is out of range. If false, then the function
       * will throw an error if the precision is invalid.
       * @returns {number|number[]} The precision level or array of precision
       * levels, corrected if needed and if fix is true.
       */
      validatePrecision: function (p, fix = true) {
        if (Array.isArray(p)) {
          return p.map((p) => this.validatePrecision(p, fix));
        }
        const min = this.MIN_PRECISION;
        const max = this.MAX_PRECISION;
        const isValid = typeof p === "number" && p >= min && p <= max;
        if (isValid) return p;
        if (fix) return p < min ? min : max;
        throw new Error(
          `Precision must be a number between ${min} and ${max}` +
            ` (inclusive), but got ${p}`
        );
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
      getHashStringsForBounds: function (bounds, precision) {
        this.validatePrecision(precision, false);
        if (!this.boundsAreValid(bounds)) {
          throw new Error("Bounds are invalid");
        }
        let hashStrings = [];
        bounds = this.splitBoundingBox(bounds);
        bounds.forEach(function (b) {
          hashStrings = hashStrings.concat(
            nGeohash.bboxes(b.south, b.west, b.north, b.east, precision)
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
          this.validatePrecision(precision, false);
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
      getAttr: function (attr) {
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
       * Add geohashes to the collection based on a bounding box.
       * @param {Object} bounds - Bounding box with north, south, east, and west
       * properties.
       * @param {boolean} [consolidate=false] - Whether to consolidate the
       * geohashes into the smallest set of geohashes that cover the same area.
       * This will be performed before creating the new models in order to
       * improve performance.
       * @param {number} [maxGeohashes=Infinity] - The maximum number of
       * geohashes to add to the collection. This will limit the precision of
       * the geohashes for larger bounding boxes. Depending on constraints such
       * as the min and max precision, and the size of the bounding box, the
       * actual number of geohashes added may sometimes exceed this number.
       * @param {boolean} [overwrite=false] - Whether to overwrite the current
       * collection.
       * @param {number} [minPrecision] - The minimum precision of the
       * geohashes to add to the collection, defaults to the min precision
       * level set on the collection.
       * @param {number} [maxPrecision] - The maximum precision of the
       * geohashes to add to the collection, defaults to the max precision
       * level set on the collection.
       *
       */
      addGeohashesByBounds: function (
        bounds,
        consolidate = false,
        maxGeohashes = Infinity,
        overwrite = false,
        minPrecision = this.MIN_PRECISION,
        maxPrecision = this.MAX_PRECISION
      ) {
        let hashStrings = [];
        if (consolidate) {
          hashStrings = this.getFewestHashStringsForBounds(
            bounds,
            minPrecision,
            maxPrecision,
            maxGeohashes
          );
        } else {
          const area = this.getBoundingBoxArea(bounds);
          const precision = this.getMaxPrecision(
            area,
            maxGeohashes,
            minPrecision,
            maxPrecision
          );
          hashStrings = this.getHashStringsForBounds(bounds, precision);
        }
        this.addGeohashesByHashString(hashStrings, overwrite);
      },

      /**
       * Get the area in degrees squared of a geohash "tile" for a given
       * precision level. The area is considered the product of the geohash's
       * latitude and longitude error margins.
       * @param {number} precision - The precision level to get the area for.
       * @returns {number} The area in degrees squared.
       */
      getGeohashArea: function (precision) {
        precision = this.validatePrecision(precision);
        // Number of bits used for encoding both coords
        const totalBits = precision * 5;
        const lonBits = Math.floor(totalBits / 2);
        const latBits = totalBits - lonBits;
        // Lat and long precision in degrees.
        const latPrecision = 180 / 2 ** latBits;
        const lonPrecision = 360 / 2 ** lonBits;
        return latPrecision * lonPrecision;
      },

      /**
       * For a range of precisions levels, get the area in degrees squared for
       * geohash "tiles" at each precision level. See {@link getGeohashArea}.
       * @param {Number} minPrecision - The minimum precision level for which to
       * calculate the area, defaults to the min precision level set on the
       * collection.
       * @param {Number} maxPrecision - The maximum precision level for which to
       * calculate the area, defaults to the max precision level set on the
       * collection.
       * @returns {Object} An object with the precision level as the key and the
       * area in degrees as the value.
       */
      getGeohashAreas: function (
        minPrecision = this.MIN_PRECISION,
        maxPrecision = this.MAX_PRECISION
      ) {
        minPrecision = this.validatePrecision(minPrecision);
        maxPrecision = this.validatePrecision(maxPrecision);
        if (!this.precisionAreas) this.precisionAreas = {};
        for (let i = minPrecision; i <= maxPrecision; i++) {
          if (!this.precisionAreas[i]) {
            this.precisionAreas[i] = this.getGeohashArea(i);
          }
        }
        return this.precisionAreas;
      },

      /**
       * Get the area of a bounding box in degrees.
       * @param {Object} bounds - Bounding box with north, south, east, and west
       * properties.
       * @returns {Number} The area of the bounding box in degrees.
       */
      getBoundingBoxArea: function (bounds) {
        if (!this.boundsAreValid(bounds)) {
          console.warn(
            `Bounds are invalid: ${JSON.stringify(bounds)}. ` +
              `Returning the globe's area for the given bounding box.`
          );
          return 360 * 180;
        }
        const { north, south, east, west } = bounds;
        // Account for cases where east < west, due to the bounds crossing the
        // prime meridian
        const lonDiff = east < west ? 360 - (west - east) : east - west;
        const latDiff = north - south;
        return Math.abs(latDiff * lonDiff);
      },

      /**
       * Check that a bounds object is valid for the purposes of other methods
       * in this Collection.
       * @param {Object} bounds - Bounding box with north, south, east, and west
       * properties.
       * @returns {boolean} Whether the bounds object is valid.
       */
      boundsAreValid: function (bounds) {
        return (
          bounds &&
          typeof bounds.north === "number" &&
          typeof bounds.south === "number" &&
          typeof bounds.east === "number" &&
          typeof bounds.west === "number" &&
          bounds.north <= 90 &&
          bounds.north >= -90 &&
          bounds.south >= -90 &&
          bounds.south <= 90 &&
          bounds.east <= 180 &&
          bounds.east >= -180 &&
          bounds.west >= -180 &&
          bounds.west <= 180
        );
      },

      /**
       * Given a bounding box, estimate the maximum geohash precision that can
       * be used to cover the area without exceeding a specified number of
       * geohashes. The goal is to find the smallest and most precise geohashes
       * possible without surpassing the maximum allowed number of geohashes.
       * @param {Number} area - The area of the bounding box in degrees squared.
       * @param {Number} maxGeohashes - The maximum number of geohashes that can
       * be used to cover the area.
       * @param {Number} [absMin] - The absolute minimum precision level to
       * consider. Defaults to the min set on the collection).
       * @param {Number} [absMax] - The absolute maximum precision level to
       * consider. Defaults to the max set on the collection.
       * @returns {Number} The maximum precision level that can be used to cover
       * the area without surpassing the given number of geohashes.
       */
      getMaxPrecision: function (
        area,
        maxGeohashes,
        absMin = this.MIN_PRECISION,
        absMax = this.MAX_PRECISION
      ) {
        absMin = this.validatePrecision(absMin);
        absMax = this.validatePrecision(absMax);
        const ghAreas = this.getGeohashAreas(absMin, absMax);

        // Start from the most precise level
        let precision = absMax;
        let conditionMet = false;

        // Work down to the lowest precision level
        while (precision >= absMin) {
          // Num of geohashes needed to cover the bounding box area
          const geohashesNeeded = area / ghAreas[precision];
          if (geohashesNeeded <= maxGeohashes) {
            conditionMet = true;
            break;
          }
          precision--;
        }

        if (!conditionMet) {
          console.warn(
            `The area is too large to cover with fewer than ${maxGeohashes} ` +
              `geohashes at the min precision level (${absMin}). Returning ` +
              `the min precision level, which may result in too many geohashes.`
          );
        }

        return precision;
      },

      /**
       * Calculate the smallest possible geohash precision level that has
       * geohash "tiles" larger than a given area.
       * @param {Number} area - The area of the bounding box in degrees squared.
       * @param {Number} absMin - The absolute minimum precision level to
       * consider. Defaults to the min set on the collection.
       * @param {Number} absMax - The absolute maximum precision level to
       * consider. Defaults to the max set on the collection.
       * @returns {Number} The minimum precision level that can be used to cover
       * the area with a single geohash.
       */
      getMinPrecision: function (
        area,
        absMin = this.MIN_PRECISION,
        absMax = this.MAX_PRECISION
      ) {
        absMin = this.validatePrecision(absMin);
        absMax = this.validatePrecision(absMax);
        const ghAreas = this.getGeohashAreas(absMin, absMax);

        // If area is a huge number and is larger than the largest geohash area,
        // return the min precision
        if (area >= ghAreas[absMin]) return absMin;

        // Start from the least precise level & work up
        let precision = absMin;
        while (precision < absMax) {
          if (ghAreas[precision] >= area && ghAreas[precision + 1] < area) {
            break;
          }
          precision++;
        }

        return precision;
      },

      /**
       * Get the optimal range of precision levels to consider using for a given
       * bounding box. See {@link getMaxPrecision} and {@link getMinPrecision}.
       * @param {Object} bounds - Bounding box with north, south, east, and west
       * properties.
       * @param {Number} maxGeohashes - The maximum number of geohashes that can
       * be used to cover the area.
       * @param {Number} absMin - The absolute minimum precision level to
       * consider. Defaults to the min set on the collection.
       * @param {Number} absMax - The absolute maximum precision level to
       * consider. Defaults to the max set on the collection.
       * @returns {Array} An array with the min and max precision levels to
       * consider.
       */
      getOptimalPrecisionRange: function (
        bounds,
        maxGeohashes = Infinity,
        absMin = this.MIN_PRECISION,
        absMax = this.MAX_PRECISION
      ) {
        if (!this.boundsAreValid(bounds)) {
          console.warn(
            `Bounds are invalid: ${JSON.stringify(bounds)}. ` +
              `Returning the min and max allowable precision levels.`
          );
          return [absMin, absMax];
        }
        absMin = this.validatePrecision(absMin);
        absMax = this.validatePrecision(absMax);
        const area = this.getBoundingBoxArea(bounds);
        const minP = this.getMinPrecision(area, absMin, absMax);
        if (minP === absMax || maxGeohashes === Infinity) return [minP, absMax];
        return [minP, this.getMaxPrecision(area, maxGeohashes, minP, absMax)];
      },

      /**
       * Get the fewest number of geohashes that can be used to cover a given
       * bounding box. This will return the optimal set of potentially
       * mixed-precision geohashes that cover the bounding box at the highest
       * precision possible without exceeding the maximum number of geohashes.
       * @param {Object} bounds - Bounding box with north, south, east, and west
       * properties.
       * @param {Number} [minPrecision] - The minimum precision level to
       * consider when calculating the optimal set of geohashes. Defaults to the
       * min precision level set on the collection.
       * @param {Number} [maxPrecision] - The maximum precision level to
       * consider when calculating the optimal set of geohashes. Defaults to the
       * max precision level set on the collection.
       * @param {Number} [maxGeohashes=Infinity] - The maximum number of
       * geohashes to add to the collection. This will limit the precision of
       * the geohashes for larger bounding boxes. Depending on constraints such
       * as the min and max precision, and the size of the bounding box, the
       * actual number of geohashes added may sometimes exceed this number.
       * @returns {string[]} Array of geohash hashStrings.
       */
      getFewestHashStringsForBounds: function (
        bounds,
        minPrecision = this.MIN_PRECISION,
        maxPrecision = this.MAX_PRECISION,
        maxGeohashes = Infinity
      ) {
        // Check the inputs
        if (!this.boundsAreValid(bounds)) return [];
        minPrecision = this.validatePrecision(minPrecision);
        maxPrecision = this.validatePrecision(maxPrecision);
        if (minPrecision > maxPrecision) minPrecision = maxPrecision;

        // Skip precision levels that result in too many geohashes or that have
        // geohash "tiles" larger than the bounding box.
        [minPrecision, maxPrecision] = this.getOptimalPrecisionRange(
          bounds,
          maxGeohashes,
          minPrecision,
          maxPrecision
        );

        // Base32 is the set of characters used to encode geohashes
        const base32 = [..."0123456789bcdefghjkmnpqrstuvwxyz"];

        // In case the bounding box crosses the prime meridian, split it in two
        const allBounds = this.splitBoundingBox(bounds);

        // If the bounds cover the world, return the base set of geohashes
        if (bounds.north >= 90 && bounds.south <= -90 && bounds.east >= 180 && bounds.west <= -180) {
          return base32;
        }

        // Checks if the given bounds are fully within the bounding box
        function fullyContained(n, e, s, w, north, east, south, west) {
          return s >= south && w >= west && n <= north && e <= east;
        }

        // Checks if the given bounds are fully outside the bounding box, assuming that
        function fullyOutside(n, e, s, w, north, east, south, west) {
          return n < south || s > north || e < west || w > east;
        }

        // Checks if a hash is fully contained, fully outside, or overlapping
        // the bounding box
        function hashPlacement(hash) {
          let [s, w, n, e] = nGeohash.decode_bbox(hash);
          let outside = [];
          for (const b of allBounds) {
            if (fullyContained(n, e, s, w, b.north, b.east, b.south, b.west)) {
              return "inside";
            } else if (
              fullyOutside(n, e, s, w, b.north, b.east, b.south, b.west)
            ) {
              outside.push(true);
            }
          }
          if (outside.length === allBounds.length) return "outside";
          return "overlap";
        }

        // Start with all hashes at minPrecision
        let precision = minPrecision;
        let hashes = this.getHashStringsForBounds(bounds, precision);
        const optimalSet = new Set();

        while (precision < maxPrecision && hashes.length > 0) {
          // If hash is part overlapping but not fully contained, check the
          // children; If hash is fully contained, it's one of the optimal
          // geohashes. Hashes fully outside the bounding box ignored.
          let overlapHashes = [];
          for (const hash of hashes) {
            let placement = hashPlacement(hash);
            if (placement == "overlap") overlapHashes.push(hash);
            else if (placement == "inside") optimalSet.add(hash);
          }

          // At the next highest precision level, check the children of the
          // hashes that are partially overlapping the bounding box.
          hashes = overlapHashes.flatMap((hash) => {
            return base32.map((char) => {
              return hash + char;
            });
          });
          precision++;
        }

        // Since want precision to be at least maxPrecision, we can add any
        // remaining hashes at maxPrecision that at least partly overlap the
        // bounding box.
        if (precision == maxPrecision) {
          for (const hash of hashes) {
            if (hashPlacement(hash) != "outside") {
              optimalSet.add(hash);
            }
          }
        }

        return Array.from(optimalSet);
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
        if (!this.boundsAreValid(bounds)) {
          console.warn(
            `Bounds are invalid: ${JSON.stringify(bounds)}. ` +
              `Returning an empty Geohashes collection.`
          );
          return new Geohashes();
        }
        const precisions = this.getPrecisions();
        let hashes = [];
        precisions.forEach((precision) => {
          hashes = hashes.concat(
            this.getHashStringsForBounds(bounds, precision)
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
       * @param {number} [level=1] - The level of the parent geohash to use to
       * group the geohashes. Defaults to 1, i.e. the parent geohash is one
       * level up.
       * @returns {Object} Object with groupIDs as keys and arrays of Geohash
       * models as values.
       */
      getGroups: function (level = 1) {
        const groups = {};
        this.forEach((geohash) => {
          const groupID = geohash.getGroupID(level);
          if (!groups[groupID]) {
            groups[groupID] = [];
          }
          groups[groupID].push(geohash);
        });
        return groups;
      },

      /**
       * Get the geohash groups in this collection that are complete, i.e. have
       * 32 child geohashes.
       * @returns {Object} Object with groupIDs as keys and arrays of Geohash
       * models as values.
       */
      getCompleteGroups: function () {
        const allGroups = {};
        const completeGroups = {};
        for (let i = 0; i < this.length; i++) {
          const geohash = this.at(i);
          const groupID = geohash.getGroupID();
          if (groupID) {
            if (!allGroups[groupID]) {
              allGroups[groupID] = [];
            }
            allGroups[groupID].push(geohash);
            if (allGroups[groupID].length === 32 && !completeGroups[groupID]) {
              completeGroups[groupID] = allGroups[groupID];
            }
          }
        }

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
        let toMerge;

        if (this.length <= 1) return this;

        do {
          toMerge = this.getCompleteGroups();
          let toRemove = [];
          let toAdd = [];

          Object.keys(toMerge).forEach((groupID) => {
            const parent = new Geohash({ hashString: groupID });
            toRemove.push(...toMerge[groupID]);
            toAdd.push(parent);
          });

          if (toRemove.length > 0) {
            this.remove(toRemove, { silent: true });
          }

          if (toAdd.length > 0) {
            this.add(toAdd, { silent: true });
          }
        } while (Object.keys(toMerge).length > 0);

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
            name: "Geohashes",
          },
        ];

        const czmlData = this.models.flatMap(function (geohash) {
          return geohash.toCZML(label);
        });

        return czmlHeader.concat(czmlData);
      },

      /**
       * Find the geohash from this collection that contains the provided
       * geohash hashString. If the hashString is already in the collection,
       * return that geohash. Otherwise, find the geohash that contains the
       * hashString.
       * @param {string} hashString - Geohash hashString.
       * @returns {Geohash} Parent geohash.
       */
      getContainingGeohash: function (hashString) {
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
