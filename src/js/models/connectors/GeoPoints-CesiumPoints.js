"use strict";

/*global define */
define(["cesium", "models/connectors/GeoPoints-Cesium"], function (
  Cesium,
  GeoPointsCesiumConnector
) {
  /**
   * @class GeoPointsCesiumPointsConnector
   * @classdesc This connector keeps a CesiumVectorData model in sync with the
   * points in a GeoPoints collection. This connector will listen for changes to
   * the GeoPoints collection and update the cesiumModel with point entities
   * created from the points in the collection.
   * @name GeoPointsCesiumPointsConnector
   * @extends GeoPointsCesiumConnector
   * @constructor
   * @classcategory Models/Connectors
   * @since x.x.x
   */
  return GeoPointsCesiumConnector.extend(
    /** @lends GeoPointsCesiumPointsConnector.prototype */ {
      /**
       * The type of Backbone.Model this is.
       * @type {string}
       * @default "GeoPointsCesiumPointsConnector"
       */
      type: "GeoPointsCesiumPointsConnector",

      /**
       * Extends the default Backbone.Model.defaults() function to specify
       * default attributes for the GeoPointsCesiumPointsConnector model.
       * @extends GeoPointsCesiumConnector.defaults
       * @returns {Object} The default attributes
       * @property {Array} layerPoints - The list of point entities that have
       * been added to the layer.
       */
      defaults: function () {
        return {
          // extend the defaults from the parent class
          ...GeoPointsCesiumConnector.prototype.defaults(),
          layerPoints: [],
        };
      },

      /**
       * Handle add, remove, merge, and reset events from the points collection
       * @param {"update"|"reset"} eventName - The name of the event
       * @param {GeoPoints} collection - The points collection
       * @param {Object} options - Options for the event, as passed by Backbone
       */
      handleCollectionChange(eventName, collection, options) {
        try {
          // For merges and resets, just remove all points and re-add them
          if (!options?.add && !options?.remove) {
            this.resetLayerPoints();
            return;
          }
          // For adds and removes, just add or remove the points that changed
          if (eventName === "update") {
            if (options.add) {
              const newModels = options.changes.added;
              newModels.forEach((model) => {
                this.addLayerPoint(model);
              });
            }
            if (options.remove) {
              const removedModels = options.changes.removed;
              removedModels.forEach((model) => {
                this.removeLayerPoint(model);
              });
            }
          }
        } catch (e) {
          console.warn('Error handling a "' + eventName + '" event.', e);
        }
      },

      /**
       * Resync the layer points with the points from the points collection.
       * This removes all point entities previously added to the layer and adds
       * new ones for each point in the points collection.
       */
      resetLayerPoints: function () {
        const layer = this.get("layer");
        layer.suspendEvents();
        this.removeAllLayerPoints();
        this.addAllLayerPoints();
        layer.resumeEvents();
      },

      /**
       * Remove all layer points previously added to the layer.
       * @returns {Boolean} Whether the layer points were removed
       */
      removeAllLayerPoints: function () {
        const layer = this.get("layer");
        if (!layer) return false;
        const layerPoints = this.get("layerPoints");
        layerPoints.forEach((entity) => {
          layer.removeEntity(entity);
        });
        return true;
      },

      /**
       * Add all points from the points collection to the layer.
       * @returns {Boolean} Whether the layer points were added
       */
      addAllLayerPoints: function () {
        const layer = this.get("layer");
        if (!layer) return false;
        const geoPoints = this.get("geoPoints");
        geoPoints.each((model) => {
          this.addLayerPoint(model);
        });
        return true;
      },

      /**
       * Add a point from the points collection to the layer. Adds the point
       * entity to the layerPoints array for tracking.
       * @param {GeoPoint} model - The point model to add to the layer
       * @returns {Cesium.Entity} The layer point that was created
       */
      addLayerPoint: function (model) {
        try {
          const layer = this.get("layer") || this.setLayer();
          const layerPoint = layer.addEntity({
            id: model.cid,
            position: model.get("mapWidgetCoords"),
            point: {
              pixelSize: 2,
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            },
          });
          // Track the layer point so we can remove it later
          const layerPoints = this.get("layerPoints");
          layerPoints.push(layerPoint);
          return layerPoint;
        } catch (e) {
          console.log("Failed to add a point to a CesiumVectorData.", e);
        }
      },

      /**
       * Remove a point from the points collection from the layer. Removes the
       * point entity from the layerPoints array.
       * @param {GeoPoint} model - The point model to remove from the layer
       * @returns {Cesium.Entity} The layer point that was removed
       */
      removeLayerPoint: function (model) {
        try {
          const layer = this.get("layer");
          if (!layer) return false;
          const removedPoint = layer.removeEntity(model.cid);
          // Remove the layer point from the list of layer points
          const layerPoints = this.get("layerPoints");
          const index = layerPoints.indexOf(removedPoint);
          if (index > -1) {
            layerPoints.splice(index, 1);
          }
          return removedPoint;
        } catch (e) {
          console.log("Failed to remove a point from a CesiumVectorData.", e);
        }
      },
    }
  );
});
