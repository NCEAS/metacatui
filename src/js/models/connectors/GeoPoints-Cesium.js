"use strict";

define([
  "backbone",
  "cesium",
  "collections/maps/GeoPoints",
  "models/maps/assets/CesiumVectorData",
], function (Backbone, Cesium, GeoPoints, CesiumVectorData) {
  /**
   * @class GeoPointsCesiumConnector
   * @classdesc This is the base model for other connectors that create geometry
   * in Cesium based on points in a GeoPoints collection.
   * @name GeoPointsCesiumConnector
   * @extends Backbone.Model
   * @constructor
   * @classcategory Models/Connectors
   * @since 2.27.0
   */
  return Backbone.Model.extend(
    /** @lends GeoPointsCesiumConnector.prototype */ {
      /**
       * The type of Backbone.Model this is.
       * @type {string}
       * @default "GeoPointsCesiumConnector"
       */
      type: "GeoPointsCesiumConnector",

      /**
       * Extends the default Backbone.Model.defaults() function to specify
       * default attributes for the GeoPointsCesiumConnector model.
       * @returns {Object} The default attributes
       * @property {GeoPoints} geoPoints - The points collection to visualize
       * @property {CesiumVectorData} layer - The CesiumVectorData model to use
       * to visualize the points. This must be a CesiumVectorData model.
       * @property {Boolean} isConnected - Whether the layer is currently being
       * updated with changes to the points collection.
       */
      defaults: function () {
        return {
          geoPoints: null,
          layer: null,
          isConnected: false,
        };
      },

      /**
       * Initialize the model.
       * @param {Object} attrs - The attributes for this model.
       * @param {GeoPoints | Array} [attributes.geoPoints] - The GeoPoints
       * collection to use for this connector or an array of JSON attributes to
       * create a new GeoPoints collection. If not provided, a new empty
       * GeoPoints collection will be created.
       * @param {CesiumVectorData | Object} [attributes.layer] - The
       * CesiumVectorData CesiumVectorData model to use for this connector or a
       * JSON object with options to create a model. If not provided, a new
       * layer will be created.
       */
      initialize: function (attrs) {
        try {
          attrs = attrs || {};
          this.setGeoPoints(attrs.geoPoints);
          this.setLayer(attrs.layer);
          if (attrs.isConnected) {
            this.connect();
          }
        } catch (e) {
          console.log("Error initializing a GeoPointsCesiumConnector", e);
        }
      },

      /**
       * Set or create and set the GeoPoints collection for this connector.
       * @param {GeoPoints | Object} [points] - The GeoPoints collection to use
       * for this connector or an array of JSON attributes to create points.
       * @returns {GeoPoints} The GeoPoints collection for this connector.
       */
      setGeoPoints: function (geoPoints) {
        if (geoPoints instanceof GeoPoints) {
          this.set("geoPoints", geoPoints);
        } else {
          this.set("geoPoints", new GeoPoints(geoPoints));
        }
        return this.get("geoPoints");
      },

      /**
       * Set or create and set the CesiumVectorData model for this connector.
       * @param {CesiumVectorData | Object} [layer] - The CesiumVectorData model
       * to use for this connector or a JSON object with options to create a new
       * CesiumVectorData model. If not provided, a new CesiumVectorData model
       * will be created.
       * @returns {CesiumVectorData} The CesiumVectorData model for this
       * connector.
       */
      setLayer: function (layer) {
        if (layer instanceof CesiumVectorData) {
          this.set("layer", layer);
        } else {
          this.set("layer", new CesiumVectorData(layer));
        }
        return this.get("layer");
      },

      /**
       * Listen for changes to the Points collection and update the
       * CesiumVectorData model with point entities.
       */
      connect: function () {
        try {
          this.disconnect();
          // Listen for changes to the points collection and update the layer
          const geoPoints = this.get("geoPoints");
          const events = ["update", "reset"];

          events.forEach((eventName) => {
            this.listenTo(geoPoints, eventName, function (...args) {
              this.handleCollectionChange(eventName, ...args);
            });
          });

          // Restart listeners when points or the layer is replaced
          this.listenToOnce(this, "change:geoPoints change:layer", () => {
            if (this.get("isConnected")) {
              this.connect();
            }
          });
          // Restart listeners when points or the layer is replaced
          this.listenToOnce(this, "change:geoPoints change:layer", () => {
            if (this.get("isConnected")) {
              this.connect();
            }
          });

          this.set("isConnected", true);
        } catch (e) {
          console.warn("Error connecting Points to Cesium. Disconnecting.", e);
          this.disconnect();
        }
      },

      /**
       * Stop listening for changes to the Points collection.
       */
      disconnect: function () {
        const geoPoints = this.get("geoPoints");
        if (geoPoints) this.stopListening(geoPoints);
        this.set("isConnected", false);
      },

      /**
       * Handle add, remove, merge, and reset events from the points collection
       * @param {"update"|"reset"} eventName - The name of the event
       * @param {GeoPoints} collection - The points collection
       * @param {Object} options - Options for the event, as passed by Backbone
       */
      handleCollectionChange(eventName, collection, options) {
        try {
          // What to do when the collection changes
        } catch (e) {
          console.warn('Error handling a "' + eventName + '" event.', e);
        }
      },
    },
  );
});
