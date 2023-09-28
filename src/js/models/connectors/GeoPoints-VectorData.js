/*global define */
define([
  "backbone",
  "collections/maps/GeoPoints",
  "models/maps/assets/CesiumVectorData",
], function (Backbone, GeoPoints, CesiumVectorData) {
  "use strict";

  /**
   * @class PointsVectorDataConnector
   * @classdesc This connector keeps a CesiumVectorData model in sync with the
   * points in a GeoPoints collection. This connector will listen for changes to
   * the GeoPoints collection and update the cesiumModel with the features
   * created from the points in the collection.
   * @name PointsVectorDataConnector
   * @extends Backbone.Model
   * @constructor
   * @classcategory Models/Connectors
   * @since x.x.x
   *
   * TODO: Extend to allow for a collection of GeoPoints collections, where each
   * GeoPoints collection can be represented as a different polygon in the
   * CesiumVectorData model.
   */
  return Backbone.Model.extend(
    /** @lends PointsVectorDataConnector.prototype */ {
      /**
       * The type of Backbone.Model this is.
       * @type {string}
       * @default "PointsVectorDataConnector"
       */
      type: "PointsVectorDataConnector",

      /**
       * Extends the default Backbone.Model.defaults() function to specify
       * default attributes for the PointsVectorDataConnector model.
       */
      defaults: function () {
        return {
          points: null,
          vectorLayer: null,
          isConnected: false,
        };
      },

      /**
       * Initialize the model.
       * @param {Object} attrs - The attributes for this model.
       * @param {GeoPoints | Object} [attributes.points] - The GeoPoints
       * collection to use for this connector or a JSON object with options to
       * create a new GeoPoints collection. If not provided, a new GeoPoints
       * collection will be created.
       * @param {CesiumVectorData | Object} [attributes.vectorLayer] - The
       * CesiumVectorData model to use for this connector or a JSON object with
       * options to create a new CesiumVectorData model. If not provided, a new
       * CesiumVectorData model will be created.
       */
      initialize: function (attrs) {
        try {
          attrs = attrs || {};
          this.setPoints(attrs.points);
          this.setVectorLayer(attrs.vectorLayer);
          if (attrs.isConnected) {
            this.connect();
          }
        } catch (e) {
          console.log("Error initializing a PointsVectorDataConnector", e);
        }
      },

      /**
       * Set or create and set the GeoPoints collection for this connector.
       * @param {GeoPoints | Object} [points] - The GeoPoints collection to use
       * for this connector or a JSON object with options to create a new
       * GeoPoints collection. If not provided, a new GeoPoints collection will
       * be created.
       * @returns {GeoPoints} The GeoPoints collection for this connector.
       */
      setPoints: function (points) {
        if (points instanceof GeoPoints) {
          this.set("points", points);
        } else {
          this.set("points", new GeoPoints(points));
        }
        return this.get("points");
      },

      /**
       * Set or create and set the CesiumVectorData model for this connector.
       * @param {CesiumVectorData | Object} [vectorLayer] - The CesiumVectorData
       * model to use for this connector or a JSON object with options to create
       * a new CesiumVectorData model. If not provided, a new CesiumVectorData
       * model will be created.
       * @returns {CesiumVectorData} The CesiumVectorData model for this
       * connector.
       */
      setVectorLayer: function (vectorLayer) {
        if (vectorLayer instanceof CesiumVectorData) {
          this.set("vectorLayer", vectorLayer);
        } else {
          this.set("vectorLayer", new CesiumVectorData(vectorLayer));
        }
        return this.get("vectorLayer");
      },

      /**
       * Listen for changes to the Points collection and update the
       * CesiumVectorData model with the features created from the points in
       * the collection.
       */
      connect: function () {
        try {
          const connector = this;
          this.disconnect();

          const handler = (this.eventHandler = new Backbone.Model());
          const points = this.get("points") || this.setPoints();

          // Update the vectorLayer when the points collection is updated.
          handler.listenTo(points, "update reset", () => {
            connector.updateVectorLayer();
          });

          // Restart listeners the points collection or the vectorLayer is
          // replaced with a new collection or model.
          handler.listenToOnce(this, "change:points change:vectorLayer", () => {
            if (this.get("isConnected")) {
              connector.connect();
            }
          });

          this.set("isConnected", true);
        } catch (e) {
          console.warn(
            "Error connecting a PointsVectorDataConnector, disconnecting.",
            e
          );
          connector.disconnect();
        }
      },

      /**
       * Stop listening for changes to the Points collection.
       */
      disconnect: function () {
        const handler = this.eventHandler;
        if (handler) {
          handler.stopListening();
          handler.clear();
          handler = null;
        }
        this.set("isConnected", false);
      },

      /**
       * Update the CesiumVectorData model with the features created from the
       * points in the collection.
       */
      updateVectorLayer: function () {
        const points = this.get("points") || this.setPoints();
        const layer = this.get("vectorLayer") || this.setVectorLayer();
        const type = model.get("type");
        const geom = "Polygon";
        const data = type === "geojson" ? points.toGeoJson(geom) : this.toCzml(geom);
        const opts = layer.getCesiumOptions() || {};
        opts.data = data;
        layer.set("cesiumOptions", opts);
      },
    }
  );
});
