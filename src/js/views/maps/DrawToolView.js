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
       * @type {CesiumVectorData}
       */
      drawLayer: undefined,

      /**
       * Initializes the DrawTool
       * @param {Object} options
       */
      initialize: function (options) {
        this.model = options.model;
        if (!this.model) {
          this.handleNoMapModel();
          return;
        }
        this.makeDrawLayer();
        this.activated = options.activated || false;
        if (this.activated) {
          this.activate();
        }
      },

      /**
       * Creates the polygon object that will be modified as a user draws on the
       * map. Saves it to the polygon property.
       */
      makeDrawLayer: function () {
        if (!this.model) return;
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
                  geometry: {
                    coordinates: [],
                    type: "Polygon",
                  },
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
        if (!this.model) return;
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
        return this;
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
          // make the button green for testing
          drawButton.style.backgroundColor = "green";
        });
        el.appendChild(drawButton);
        const clearButton = document.createElement("button");
        clearButton.innerHTML = "Clear";
        clearButton.addEventListener("click", function () {
          view.removeDrawLayer();
          // make the button red for testing
          drawButton.style.backgroundColor = "red";
        });
        el.appendChild(clearButton);
      },

      /**
       * Starts the listeners for the draw tool
       */
      startListeners: function () {
        this.stopListeners();

        const mapModel = this.model;
        this.interactions = mapModel?.get("interactions");
        this.clickedPosition = this.interactions?.get("clickedPosition");

        this.listenToOnce(mapModel, "change:interactions", this.startListeners);
        this.listenToOnce(
          this.interactions,
          "change:clickedPosition",
          this.startListeners
        );

        if (!this.originalClickAction) {
          this.originalClickAction = this.model.get("clickFeatureAction");
        }
        this.model.set("clickFeatureAction", null);

        this.listenTo(
          this.clickedPosition,
          "change:latitude change:longitude",
          this.handleClick
        );
      },

      /**
       * Stops the listeners for the draw tool
       */
      stopListeners: function () {
        const targets = [this.model, this.interactions, this.clickedPosition];
        targets.forEach((target) => {
          if (target) this.stopListening(target);
        }, this);
        if (this.originalClickAction) {
          this.model.set("clickFeatureAction", this.originalClickAction);
          this.originalClickAction = null;
        }
      },

      /**
       * Handles a click on the map. If the draw tool is active, it will add the
       * coordinates of the click to the polygon being drawn.
       */
      handleClick: function () {
        if (!this.activated) {
          return;
        }
        const coordinates = [
          this.clickedPosition.get("longitude"),
          this.clickedPosition.get("latitude"),
        ];
        this.addCoordinate(coordinates);
      },

      /**
       * Adds a coordinate to the polygon being drawn
       * @param {Array} coords - The coordinates to add, in the form [longitude,
       * latitude]
       */
      addCoordinate: function (coords) {

        // TODO: Something like this... We may also want to add a general method
        // to the VectorData model that allows us to add a coordinate, but this
        // will be specific to the GeoJsonDataSource
        const layer = this.drawLayer;
        const geoJSON = layer.get("cesiumOptions")?.data;
        const coordinates = geoJSON?.features[0]?.geometry?.coordinates?.[0];

        if (!coordinates || !coordinates.length) {
          // Create new coordinates array
          geoJSON.features[0].geometry.coordinates = [[]];
          // Add the coordinate to the new array
          geoJSON.features[0].geometry.coordinates[0].push(coords);
        } else {
          // Check if the last coordinate is the same as the first coordinate. If
          // so, we want to add the new coordinate as the second to last. Otherwise
          // we want to add it to the end.
          const lastCoord = coordinates[coordinates.length - 1];
          const firstCoord = coordinates[0];
          if (lastCoord[0] == firstCoord[0] && lastCoord[1] == firstCoord[1]) {
            // Add the coordinate as the second to last
            coordinates.splice(coordinates.length - 1, 0, coords);
          } else {
            // Add the coordinate to the end
            coordinates.push(coords);
            // Make the coordinates valid for a GeoJSON polygon by adding the first
            // coordinate to the end
            coordinates.push(coordinates[0]);
          }
        }

        layer.set("cesiumOptions", { data: geoJSON });
        layer.createCesiumModel(true);
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
