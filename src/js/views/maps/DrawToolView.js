"use strict";

define(["backbone"], function (Backbone) {
  /**
   * @class DrawTool
   * @classdesc Functionality for drawing an arbitrary polygon on a Cesium map
   * using the mouse.
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
       * Whether or not the draw tool is currently active. If not active, it
       * will not listen for mouse clicks.
       * @type {boolean}
       */
      activated: false,

      /**
       * The Cesium map model to draw on. This must be the same model that the
       * mapWidget is using.
       * @type {Map}
       */
      model: undefined,

      /**
       * The CesiumVectorData model that we will use to store the drawn
       * polygon(s)
       * @type {
       */
      drawLayer: undefined,

      /**
       * Initializes the DrawTool
       * @param {Object} options
       */
      initialize: function (options) {
        this.model = this.model;
        if (!this.model) {
          this.handleNoMapModel();
          return
        }
        this.activated = options.activated || false;
        this.makeDrawLayer();
        if (this.activated) {
          this.activate();
        }
      },

      /**
       * Creates the polygon object that will be modified as a user draws on the
       * map. Saves it to the polygon property.
       */
      makeDrawLayer: function () {
        if (!this.model) return
        this.drawLayer = this.model.addAsset({
          type: "GeoJsonDataSource",
          hideInLayerList: true, // <- TODO: Look for this property in the
          // layer list view. If it's true, don't show it. Document it in the
          // map config docs.
          cesiumOptions: {
            data: {
              type: "FeatureCollection",
              features: [
                {
                  type: "Feature",
                  properties: {},
                  "geometry": {
                    "coordinates": [],
                    "type": "Polygon"
                  }
                },
              ],
            },
          },
        });
      },

      /**
       * Removes the polygon object from the map
       */
      removeDrawLayer: function () {
        if (!this.model) return
        this.model.removeAsset(this.model);
      },

      /**
       * Renders the DrawTool
       * @returns {DrawTool} Returns the view
       */
      render: function () {
        if (!this.model) {
          this.handleNoMapModel();
          return;
        }
        this.renderToolbar();
        this.startListeners();
      },

      /**
       * What to do when this view doesn't have a map view to draw on
       */
      handleNoMapModel: function () {
        console.warn("No map model provided to DrawTool");
      },

      /**
       * Create and insert the buttons for drawing and clearing the polygon
       */
      renderToolbar: function () {
        // TODO: At a minimum we need buttons to: Start drawing, Clear drawing.
        // Just some place holder buttons for now:
        const view = this;
        const el = this.el;
        const drawButton = document.createElement("button");
        drawButton.innerHTML = "Draw";
        drawButton.addEventListener("click", function () {
          view.activate();
        });
        el.appendChild(drawButton);
        const clearButton = document.createElement("button");
        clearButton.innerHTML = "Clear";
        clearButton.addEventListener("click", function () {
          view.removeDrawLayer();
        });
        el.appendChild(clearButton);

      },

      /**
       * Starts the listeners for the draw tool
       */
      startListeners: function () {
        this.stopListening();
        // TODO: Make a general method in the map widget that gives the
        // coordinates of the mouse click
        this.listenTo(this.model, "change:clickedCoordinates", this.handleClick);
      },

      /**
       * Stops the listeners for the draw tool
       */
      stopListeners: function () {
        this.stopListening(this.model);
      },

      /**
       * Handles a click on the map. If the draw tool is active, it will add the
       * coordinates of the click to the polygon being drawn.
       * @param {Number[]} coordinates - The most recently clicked coordinates
       */
      handleClick: function (coordinates) {
        if (!this.activated) {
          return;
        }
        this.addCoordinate(coordinates);
      },

      /**
       * Adds a coordinate to the polygon being drawn
       * @param {Array} coords - The coordinates to add
       */
      addCoordinate: function (coords) {
        // TODO: Something like this... We may also want to add a general method
        // to the VectorData model that allows us to add a coordinate, but this
        // will be specific to the GeoJsonDataSource
        const layer = this.drawLayer;
        const geoJSON = layer.get("cesiumOptions")?.data
        const coordinates = geoJSON?.features[0]?.geometry?.coordinates
        if (!coordinates) {
          // Create new coordinates array
          geoJSON.features[0].geometry.coordinates = [coords]
        } else {
          // Add to existing coordinates array
          coordinates.push(coords)
        }
        layer.set("cesiumOptions", { data: geoJSON })
      },

      /**
       * Activates the draw tool. This means that it will listen for mouse
       * clicks on the map and draw a polygon based on those clicks.
       */
      activate: function () {
        this.activated = true;
        this.startListeners();
      },

      /**
       * Deactivates the draw tool. This means that it will no longer listen for
       * mouse clicks on the map.
       */
      deactivate: function () {
        this.activated = false;
        this.stopListeners();
      },

      /**
       * Clears the polygon that is being drawn
       */
      onClose: function () {
        this.removeAsset();
        this.deactivate();
      },
    }
  );

  return DrawTool;
});
