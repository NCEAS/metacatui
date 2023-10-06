"use strict";

/*global define */
define(["cesium", "models/connectors/GeoPoints-Cesium"], function (
  Cesium,
  GeoPointsCesiumConnector
) {
  /**
   * @class GeoPointsCesiumPolygonConnector
   * @classdesc This connector keeps a CesiumVectorData model in sync with the
   * points in a GeoPoints collection. This connector will listen for changes to
   * the GeoPoints collection and update the cesiumModel a polygon with vertices
   * created from the points in the collection.
   * @name GeoPointsCesiumPolygonConnector
   * @extends GeoPointsCesiumConnector
   * @constructor
   * @classcategory Models/Connectors
   * @since x.x.x
   */
  return GeoPointsCesiumConnector.extend(
    /** @lends GeoPointsCesiumPolygonConnector.prototype */ {
      /**
       * The type of Backbone.Model this is.
       * @type {string}
       * @default "GeoPointsCesiumPolygonConnector"
       */
      type: "GeoPointsCesiumPolygonConnector",

      /**
       * Extends the default Backbone.Model.defaults() function to specify
       * default attributes for the GeoPointsCesiumPolygonConnector model.
       * @extends GeoPointsCesiumConnector.defaults
       * @returns {Object} The default attributes
       * @property {Cesium.Entity} polygon - The polygon entity that has
       * vertices created from the points in the collection.
       */
      defaults: function () {
        return {
          // extend the defaults from the parent class
          ...GeoPointsCesiumConnector.prototype.defaults(),
          polygon: null,
        };
      },

      /**
       * Create a Cesium.Polygon entity and add it to the layer.
       * @returns {Cesium.Entity} The Cesium.Polygon entity that was added to
       * the CesiumVectorData model.
       */
      addPolygon: function () {
        const layer = this.get("layer") || this.setVectorLayer();
        const geoPoints = this.get("geoPoints") || this.setPoints();
        return layer.addEntity({
          polygon: {
            height: null, // <- clamp to ground
            hierarchy: new Cesium.CallbackProperty(() => {
              return new Cesium.PolygonHierarchy(geoPoints.asMapWidgetCoords());
            }, false),
          },
        });
      },

      /**
       * Reset the positions of the polygon vertices to the current points in
       * the GeoPoints collection.
       */
      handleCollectionChange: function () {
        this.get("polygon") || this.addPolygon();
        this.get("layer").updateAppearance();
      },
    }
  );
});
