"use strict";

define(["backbone", "models/connectors/GeoPoints-VectorData"], function (
  Backbone,
  GeoPointsVectorData
) {
  /**
   * @class DrawTool
   * @classdesc The DrawTool view allows a user to draw an arbitrary polygon on
   * the map. The polygon is stored in a GeoPoints collection and displayed on
   * the map using a connected CesiumVectorData model.
   * @classcategory Views/Maps
   * @name DrawTool
   * @extends Backbone.View
   * @screenshot views/maps/DrawTool.png
   * @since x.x.x
   * @constructs DrawTool
   */
  var DrawTool = Backbone.View.extend(
    /** @lends DrawTool.prototype */ {
      /**
       * The type of View this is
       * @type {string}
       */
      type: "DrawTool",

      /**
       * The HTML classes to use for this view's element
       * @type {string}
       */
      className: "draw-tool",

      /**
       * The current mode of the draw tool. This could be "draw", "edit",
       * "delete", or false to indicate that the draw tool is not active.
       * Currently only "draw" and false are supported.
       */
      mode: false,

      /**
       * The Cesium map model to draw on. This must be the same model that the
       * mapWidget is using.
       * @type {Map}
       */
      mapModel: undefined,

      /**
       * A reference to the MapInteraction model on the MapModel that is used to
       * listen for clicks on the map.
       * @type {MapInteraction}
       */
      interactions: undefined,

      /**
       * The CesiumVectorData model that will display the polygon that is being
       * drawn.
       * @type {CesiumVectorData}
       */
      layer: undefined,

      /**
       * The GeoPoints collection that stores the points of the polygon that is
       * being drawn.
       * @type {GeoPoints}
       */
      points: undefined,

      /**
       * Initializes the DrawTool
       * @param {Object} options - A literal object with options to pass to the
       * view
       * @param {Map} options.model - The Cesium map model to draw on. This must
       * be the same model that the mapWidget is using.
       * @param {string} [options.mode=false] - The initial mode of the draw
       * tool.
       */
      initialize: function (options) {
        this.mapModel = options.model;
        if (!this.mapModel) {
          this.handleNoMapModel();
          return;
        }
        // Add models & collections and add interactions, layer, connector,
        // points, and originalAction properties to this view
        this.setUpMapModel();
        this.setUpLayer();
        this.setUpConnector();
      },

      /**
       * Sets up the map model and adds the interactions and originalAction
       * properties to this view.
       */
      setUpMapModel: function () {
        this.originalAction = this.mapModel.get("clickFeatureAction");
        this.interactions =
          this.mapModel.get("interactions") ||
          this.mapModel.setUpInteractions();
      },

      /**
       * Sets up the layer to show the polygon on the map that is being drawn.
       * Adds the layer property to this view.
       * @returns {CesiumVectorData} The CesiumVectorData model that will
       * display the polygon that is being drawn.
       */
      setUpLayer: function () {
        this.layer = this.mapModel.addAsset({
          type: "GeoJsonDataSource",
          hideInLayerList: true, // <- TODO: Hide in LayerList, doc in mapConfig
        });
        return this.layer;
      },

      /**
       * Sets up the connector to connect the GeoPoints collection to the
       * CesiumVectorData model. Adds the connector and points properties to
       * this view.
       * @returns {GeoPointsVectorData} The connector
       */
      setUpConnector: function () {
        this.connector = new GeoPointsVectorData({
          vectorLayer: this.layer,
        });
        this.points = this.connector.get("points");
        this.connector.connect();
        return this.connector;
      },

      /**
       * Adds a point to the polygon that is being drawn.
       * @param {Object} point - The point to add to the polygon. This should
       * have a latitude and longitude property.
       * @returns {GeoPoint} The GeoPoint model that was added to the polygon.
       */
      addPoint: function (point) {
        return this.points.addPoint(point);
      },

      /**
       * Clears the polygon that is being drawn.
       */
      clearPoints: function () {
        this.points.reset(null);
      },

      /**
       * Removes the polygon object from the map
       * TODO: Test this
       */
      removeLayer: function () {
        if (!this.mapModel || !this.layer) return;
        this.connector.disconnect();
        this.connector.set("vectorLayer", null);
        this.mapModel.removeAsset(this.layer);
      },

      /**
       * Renders the DrawTool
       * @returns {DrawTool} Returns the view
       */
      render: function () {
        this.renderToolbar();
        return this;
      },

      /**
       * What to do when this view doesn't have a map view to draw on
       */
      handleNoMapModel: function () {
        console.warn("No map model provided to DrawTool");
        // TODO: Add a message to the view to let the user know that the draw
        // tool is not available
      },

      /**
       * Create and insert the buttons for drawing and clearing the polygon.
       * TODO: Add all buttons and style them. This is just a WIP for now.
       */
      renderToolbar: function () {
        const view = this;
        const el = this.el;
        const drawButton = document.createElement("button");
        drawButton.innerHTML = "Draw";
        drawButton.addEventListener("click", function () {
          if (view.mode === "draw") {
            view.setMode(false);
          } else {
            view.setMode("draw");
          }
        });
        this.drawButton = drawButton;
        el.appendChild(drawButton);
        const clearButton = document.createElement("button");
        clearButton.innerHTML = "Clear";
        clearButton.addEventListener("click", function () {
          view.clearPoints();
          view.setMode(false);
        });
        el.appendChild(clearButton);
      },

      /**
       * Sets the mode of the draw tool. Currently only "draw" and false are
       * supported.
       * @param {string|boolean} mode - The mode to set. This can be "draw" or
       * false to indicate that the draw tool should not be active.
       */
      setMode: function (mode) {
        if (this.mode === mode) return;
        this.mode = mode;
        if (mode === "draw") {
          this.setClickListeners();
          this.drawButton.style.backgroundColor = "green";
        } else if (mode === false) {
          this.removeClickListeners();
          this.drawButton.style.backgroundColor = "grey";
        }
      },

      /**
       * Removes the click listeners from the map model and sets the
       * clickFeatureAction back to its original value.
       */
      removeClickListeners: function () {
        const handler = this.clickHandler;
        if (handler) {
          handler.stopListening();
          handler.clear();
          this.clickHandler = null;
        }
        this.mapModel.set("clickFeatureAction", this.originalClickAction);
        this.listeningForClicks = false;
      },

      /**
       * Set listeners to call the handleClick method when the user clicks on
       * the map.
       */
      setClickListeners: function () {
        const view = this;
        const handler = (this.clickHandler = new Backbone.Model());
        const interactions = this.interactions;
        const clickedPosition = interactions.get("clickedPosition");
        this.mapModel.set("clickFeatureAction", null);
        handler.listenTo(
          clickedPosition,
          "change:latitude change:longitude",
          () => {
            view.handleClick();
          }
        );
        this.listeningForClicks = true;
        // When the clickedPosition GeoPoint model or the MapInteractions model
        // is replaced, restart the listeners on the new model.
        handler.listenToOnce(
          interactions,
          "change:clickedPosition",
          function () {
            if (view.listeningForClicks) {
              view.handleClick();
              view.setClickListeners();
            }
          }
        );
        handler.listenToOnce(this.mapModel, "change:interactions", function () {
          if (view.listeningForClicks) {
            view.handleClick();
            view.setClickListeners();
          }
        });
      },

      /**
       * Handles a click on the map. If the draw tool is active, it will add the
       * coordinates of the click to the polygon being drawn.
       * @param {Number} [throttle=50] - The number of milliseconds to block
       * clicks for after a click is handled. This prevents double clicks.
       */
      handleClick: function (throttle = 50) {
        // Prevent double clicks
        if (this.blockClick) return;
        this.blockClick = true;
        setTimeout(() => {
          this.blockClick = false;
        }, throttle);
        // Add the point to the polygon
        if (this.mode === "draw") {
          const point = this.interactions.get("clickedPosition");
          console.log("Adding point", point);
          this.addPoint({
            latitude: point.get("latitude"),
            longitude: point.get("longitude"),
          });
        }
      },

      /**
       * Clears the polygon that is being drawn
       */
      onClose: function () {
        this.removeLayer();
        this.removeClickListeners();
      },
    }
  );

  return DrawTool;
});
