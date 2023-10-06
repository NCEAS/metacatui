"use strict";

define(["backbone", "models/connectors/GeoPoints-CesiumPolygon", "models/connectors/GeoPoints-CesiumPoints", "collections/maps/GeoPoints"], function (
  Backbone,
  GeoPointsVectorData,
  GeoPointsCesiumPoints,
  GeoPoints
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
       * Class to use for the buttons
       * @type {string}
       */
      buttonClass: "map-view__button",

      /**
       * The buttons to display in the toolbar and their corresponding actions.
       * TODO: Finish documenting this when more finalized.
       */
      buttons: [
        {
          name: "draw", // === mode
          label: "Draw Polygon",
          icon: "pencil",
        },
        {
          name: "move",
          label: "Move Point",
          icon: "move",
        },
        {
          name: "remove",
          label: "Remove Point",
          icon: "eraser",
        },
        {
          name: "clear",
          label: "Clear Polygon",
          icon: "trash",
          method: "clearPoints",
        },
        {
          name: "save",
          label: "Save",
          icon: "save",
          method: "save",
        },
      ],

      buttonEls: {},

      /**
       * The current mode of the draw tool. This can be "draw", "move",
       * "remove", or "add" - any of the "name" properties of the buttons array,
       * excluding buttons like "clear" and "save" that have a method property.
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
       * The color of the polygon that is being drawn as a hex string.
       * @type {string}
       */
      color: "#a31840",

      /**
       * The initial opacity of the polygon that is being drawn. A number
       * between 0 and 1.
       * @type {number}
       */
      opacity: 0.8,

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
        this.setUpConnectors();
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
          type: "CustomDataSource",
          label: "Your Polygon",
          description: "The polygon that you are drawing on the map",
          hideInLayerList: true, // TODO: Hide in LayerList, doc in mapConfig
          outlineColor: this.color,
          opacity: this.opacity,
          colorPalette: {
            colors: [
              {
                color: this.color,
              },
            ],
          },
        })
      },

      /**
       * Sets up the connector to connect the GeoPoints collection to the
       * CesiumVectorData model. Adds the connector and points properties to
       * this view.
       * @returns {GeoPointsVectorData} The connector
       */
      setUpConnectors: function () {
        const points = this.points = new GeoPoints();
        this.polygonConnector = new GeoPointsVectorData({
          layer: this.layer,
          geoPoints: points,
        });
        this.pointsConnector = new GeoPointsCesiumPoints({
          layer: this.layer,
          geoPoints: points,
        });
        this.polygonConnector.connect();
        this.pointsConnector.connect();
        return this.connector;
      },

      /**
       * Adds a point to the polygon that is being drawn.
       * @param {Object} point - The point to add to the polygon. This should
       * have a latitude and longitude property.
       * @returns {GeoPoint} The GeoPoint model that was added to the polygon.
       */
      addPoint: function (point) {
        return this.points?.addPoint(point);
      },

      /**
       * Clears the polygon that is being drawn.
       */
      clearPoints: function () {
        this.points?.reset(null);
      },

      /**
       * Removes the polygon object from the map
       * TODO: Test this
       */
      removeLayer: function () {
        if (!this.mapModel || !this.layer) return;
        // TODO
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

        // Create the buttons
        view.buttons.forEach(options => {
          const button = document.createElement("button");
          button.className = this.buttonClass;
          button.innerHTML = `<i class="icon icon-${options.icon}"></i> ${options.label}`;
          button.addEventListener("click", function () {
            const method = options.method;
            if(method) view[method]();
            else view.toggleMode(options.name);
          });
          if(!view.buttonEls) view.buttonEls = {};
          view.buttonEls[options.name + "Button"] = button;
          el.appendChild(button);
        });
      },

      /**
       * Sends the polygon coordinates to a callback function to do something
       * with them.
       * TODO: This is a WIP.
       */
      save: function () {
        this.setMode(false);
        this.removeClickListeners();
        console.log(this.points.toJSON());
        // TODO: Call a callback function to save the polygon
      },

      /**
       * Toggles the mode of the draw tool.
       * @param {string} mode - The mode to toggle to.
       */
      toggleMode: function (mode) {
        if (this.mode === mode) {
          this.setMode(false);
        } else {
          this.setMode(mode);
        }
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
        if (mode) {
          if (!this.listeningForClicks) this.setClickListeners();
          this.activateButton(mode);
        } else {
          this.resetButtonStyles();
          this.removeClickListeners();
        }
      },

      /**
       * Sets the style of the button with the given name to indicate that it is
       * active.
       */
      activateButton: function (buttonName) {
        const buttonEl = this.buttonEls[buttonName + "Button"];
        if(!buttonEl) return;
        this.resetButtonStyles();
        buttonEl.style.backgroundColor = "blue"; // TODO - create active style
      },

      /**
       * Resets the styles of all of the buttons to indicate that they are not
       * active.
       */
      resetButtonStyles: function () {
        // Iterate through the buttonEls object and reset the styles
        for (const button in this.buttonEls) {
          this.buttonEls[button].style.backgroundColor = "grey"; // TODO - create default style
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
          this.addPoint({
            latitude: point.get("latitude"),
            longitude: point.get("longitude"),
            height: point.get("height"),
            mapWidgetCoords: point.get("mapWidgetCoords"),
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
