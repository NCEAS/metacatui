"use strict";

define(["backbone", "models/maps/GeoPoint"], function (Backbone, GeoPoint) {
  /**
   * @class GeoPoints
   * @classdesc A group of ordered geographic points.
   * @class GeoPoints
   * @classcategory Collections/Maps
   * @extends Backbone.Collection
   * @since 2.27.0
   * @constructor
   */
  var GeoPoints = Backbone.Collection.extend(
    /** @lends GeoPoints.prototype */ {
      /**
       * The class/model that this collection contains.
       * @type {Backbone.Model}
       */
      model: GeoPoint,

      /**
       * Given a point in various formats, format it such that it can be used to
       * add to this collection.
       * @param {Array|Object|GeoPoint} point - Accepted formats are:
       *   - An array of the form [longitude, latitude], with an optional third
       *     element for height
       *   - An object with a "longitude" and "latitude" property, and
       *     optionally a "height" property
       *   - A GeoPoint model
       * @returns {Object|GeoPoint} Returns an object with "longitude" and
       * "latitude" properties, and optionally a "height" property, or a
       * GeoPoint model.
       */
      formatPoint: function (point) {
        let attributes = {};
        if (Array.isArray(point) && point.length > 1) {
          attributes.longitude = point[0];
          attributes.latitude = point[1];
          if (point[2]) {
            attributes.height = point[2];
          }
        } else if (
          point instanceof GeoPoint ||
          (point.latitude && point.longitude)
        ) {
          attributes = point;
        }
        return attributes;
      },

      /**
       * Add a point to the collection. Use this rather than the Backbone add
       * method to allow for different formats of points to be added.
       * @param {Array|Object|GeoPoint} point - See {@link formatPoint} for
       * accepted formats.
       * @returns {GeoPoint} Returns the GeoPoint model that was added.
       */
      addPoint: function (point) {
        point = this.formatPoint(point);
        return this.add(point);
      },

      /**
       * Remove a specific point from the collection. Use this rather than the
       * Backbone remove method to allow for different formats of points to be
       * removed.
       * @param {Array|Object|GeoPoint|Number} indexOrPoint - The index of the
       * point to remove, or the point itself. See {@link formatPoint} for
       * accepted formats.
       * @returns {GeoPoint} Returns the GeoPoint model that was removed.
       */
      removePoint(indexOrPoint) {
        if (typeof indexOrPoint === "number") {
          return this.removePointByIndex(indexOrPoint);
        } else if (Array.isArray(indexOrPoint)) {
          return this.removePointByAttr(indexOrPoint);
        } else {
          // try just removing the point
          return this.remove(indexOrPoint);
        }
      },

      /**
       * Remove a point from the collection based on its attributes.
       * @param {Array|Object|GeoPoint} point - Any format supported by
       * {@link formatPoint} is accepted.
       * @returns {GeoPoint} Returns the GeoPoint model that was removed.
       */
      removePointByAttr: function (point) {
        point = this.formatPoint(point);
        const model = this.findWhere(point);
        return this.remove(model);
      },

      /**
       * Remove a point from the collection based on its index.
       * @param {Number} index - The index of the point to remove.
       * @returns {GeoPoint} Returns the GeoPoint model that was removed.
       */
      removePointByIndex: function (index) {
        if (index < 0 || index >= this.length) {
          console.warn("Index out of bounds, GeoPoint not removed.");
          return;
        }
        const model = this.at(index);
        return this.remove(model);
      },

      /**
       * Convert the collection to a GeoJSON object. The output can be the
       * series of points as Point features, the points connected as a
       * LineString feature, or the points connected and closed as a Polygon.
       *
       * Note: For a "Polygon" geometry type, when there's only one point in the
       * collection, the output will be a "Point". If there are only two points,
       * the output will be a "LineString", unless `forceAsPolygon` is set to
       * true.
       *
       * @param {String} geometryType - The type of geometry to create. Can be
       * "Point", "LineString", or "Polygon".
       * @param {Boolean} [forceAsPolygon=false] - Set to true to enforce the
       * output as a polygon for the "Polygon" geometry type, regardless of the
       * number of points in the collection.
       * @returns {Object} Returns a GeoJSON object of type "Point",
       * "LineString", or "Polygon".
       */
      toGeoJson: function (geometryType, forceAsPolygon = false) {
        if (!forceAsPolygon && geometryType === "Polygon" && this.length < 3) {
          geometryType = this.length === 1 ? "Point" : "LineString";
        }
        return {
          type: "FeatureCollection",
          features: this.toGeoJsonFeatures(geometryType),
        };
      },

      // TODO: Move this to a CZML model, use in GeoHash/es

      /**
       * Get the header object for a CZML document.
       * @returns {Object} Returns a CZML header object.
       */
      getCZMLHeader: function () {
        return {
          id: "document",
          version: "1.0",
          name: "GeoPoints",
        };
      },

      /**
       * Convert the collection to a CZML document.
       * @param {String} geometryType - The type of geometry to create.
       * @param {Boolean} [forceAsPolygon=false] - Set to true to enforce the
       * output as a polygon for the "Polygon" geometry type, regardless of the
       * number of points in the collection.
       * @returns {Object[]} Returns an array of CZML objects.
       */
      toCzml: function (geometryType, forceAsPolygon = false) {
        if (!forceAsPolygon && geometryType === "Polygon" && this.length < 3) {
          geometryType = this.length === 1 ? "Point" : "LineString";
        }
        let czml = [this.getCZMLHeader()];
        switch (geometryType) {
          case "Point":
            czml = czml.concat(this.toCZMLPoints());
            break;
          case "LineString":
            czml.push(this.getCZMLLineString());
            break;
          case "Polygon":
            czml.push(this.getCZMLPolygon());
            break;
          default:
            break;
        }
        return czml;
      },

      /**
       * Convert the collection to an array of CZML point objects.
       * @returns {Object[]} Returns an array of CZML point objects.
       */
      toCZMLPoints: function () {
        return this.models.map((model) => {
          return model.toCZML();
        });
      },

      /**
       * Convert the collection to a CZML polygon object.
       * @returns {Object} Returns a CZML polygon object.
       */
      getCZMLPolygon: function () {
        const coords = this.toECEFArray();
        return {
          id: this.cid,
          name: "Polygon",
          polygon: {
            positions: {
              cartesian: coords,
            },
          },
        };
      },

      /**
       * Convert the collection to a CZML line string object.
       * @returns {Object} Returns a CZML line string object.
       */
      getCZMLLineString: function () {
        const coords = this.toECEFArray();
        return {
          id: this.cid,
          name: "LineString",
          polyline: {
            positions: {
              cartesian: coords,
            },
          },
        };
      },

      /**
       * Convert the collection to a GeoJSON object. The output can be the
       * series of points as Point features, the points connected as a
       * LineString feature, or the points connected and closed as a Polygon.
       * @param {"Point"|"LineString"|"Polygon"} geometryType - The type of
       * geometry to create.
       * @returns {Object[]} Returns an array of GeoJSON features.
       */
      toGeoJsonFeatures: function (geometryType) {
        switch (geometryType) {
          case "Point":
            return this.toGeoJsonPointFeatures();
          case "LineString":
            return [this.toGeoJsonLineStringFeature()];
          case "Polygon":
            return [this.toGeoJsonPolygonFeature()];
          default:
            return [];
        }
      },

      /**
       * Convert the collection to an array of GeoJSON point features.
       * @returns {Object[]} Returns an array of GeoJSON point features.
       */
      toGeoJsonPointFeatures: function () {
        return this.models.map((model) => {
          return model.toGeoJsonFeature();
        });
      },

      /**
       * Convert the collection to a GeoJSON LineString feature.
       * @returns {Object} Returns a GeoJSON LineString feature.
       */
      toGeoJsonLineStringFeature: function () {
        return {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: this.to2DArray(),
          },
          properties: {},
        };
      },

      /**
       * Convert the collection to a GeoJSON Polygon feature. The polygon will
       * be closed if it isn't already.
       * @returns {Object} Returns a GeoJSON Polygon feature.
       */
      toGeoJsonPolygonFeature: function () {
        const coordinates = this.to2DArray();
        // Make sure the polygon is closed
        if (coordinates[0] != coordinates[coordinates.length - 1]) {
          coordinates.push(coordinates[0]);
        }
        return {
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [coordinates],
          },
          properties: {},
        };
      },

      /**
       * Convert the collection to an array of arrays, where each sub-array
       * contains the longitude and latitude of a point.
       * @returns {Array[]} Returns an array of arrays.
       */
      to2DArray: function () {
        return this.models.map((model) => {
          return model.to2DArray();
        });
      },

      /**
       * Convert the collection to a cartesian array, where each every three
       * elements represents the x, y, and z coordinates of a vertex, e.g.
       * [x1, y1, z1, x2, y2, z2, ...].
       * @returns {Array} Returns an array of numbers.
       */
      toECEFArray: function () {
        return this.models.flatMap((model) => {
          return model.toECEFArray();
        });
      },

      /**
       * Convert the collection to an array of coordinates in the format
       * native to the map widget. For Cesium, this is an array of
       * Cartesian3 objects in ECEF coordinates.
       * @returns {Array} An array of coordinates that can be used by the map
       * widget.
       */
      asMapWidgetCoords: function () {
        return this.models.map((model) => {
          return model.get("mapWidgetCoords");
        });
      },
    },
  );

  return GeoPoints;
});
