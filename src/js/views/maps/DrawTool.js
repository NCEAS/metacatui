"use strict";

define(["backbone", "cesium"], function (Backbone, Cesium) {
  // TODO <- Does Cesium need to be a dependency?
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
       * The Cesium map view to draw on
       * @type {CesiumWidgetView}
       */
      mapView: undefined,

      /**
       * The CesiumVectorData model that we will use to store the drawn polygon
       * @type {
       */
      mapData: undefined,

      /**
       * Initializes the DrawTool
       * @param {Object} options
       */
      initialize: function (options) {
        this.mapView = options.mapView;
        this.activated = options.activated || false;
        this.makeAsset();
        if (this.activated) {
          this.activate();
        }
      },

      /**
       * Creates the polygon object that will be modified as a user draws on the
       * map. Saves it to the polygon property.
       */
      makeAsset: function () {
        this.mapData = this.mapView.addNewAsset({
          type: "GeoJsonDataSource",
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
      removeAsset: function () {
        if (this.mapData) {
          this.mapView.removeAsset(this.mapData);
        }
      },

      /**
       * Renders the DrawTool
       * @returns {DrawTool} Returns the view
       */
      render: function () {
        if (!this.mapView) {
          this.handleNoMapView();
          return;
        }
        this.renderToolbar();
        this.startListeners();
      },

      /**
       * What to do when this view doesn't have a map view to draw on
       */
      handleNoMapView: function () {
        console.warn("No map view provided to DrawTool");
      },

      /**
       * Create and insert the buttons for drawing and clearing the polygon
       */
      renderToolbar: function () {
        // TODO: At a minimum we need buttons to: Start drawing, Clear drawing
      },

      /**
       * Starts the listeners for the draw tool
       */
      startListeners: function () {
        this.stopListening();
        // TODO: We should either make a general method in the map that gives
        // the coordinates of the mouse click, or we should add the Cesium event
        // handler here.
        this.listenTo(this.mapView, "click", this.handleClick);
      },

      /**
       * Stops the listeners for the draw tool
       */
      stopListeners: function () {
        this.stopListening(this.mapView);
      },

      /**
       * Handles a click on the map. If the draw tool is active, it will add the
       * coordinates of the click to the polygon being drawn.
       * @param {Event} event - The click event
       */
      handleClick: function (event) {
        if (!this.activated) {
          return;
        }
        var coords = this.mapView.getMouseCoords(event); // <- TODO: This method doesn't exist yet
        this.addCoordinate(coords);
      },

      /**
       * Adds a coordinate to the polygon being drawn
       * @param {Array} coords - The coordinates to add
       */
      addCoordinate: function (coords) {
        // TODO: Something like this... We may also want to add a general method
        // to the VectorData model that allows us to add a coordinate, but this
        // will be specific to the GeoJsonDataSource
        const geoJsonDataSource = this.mapData.get("cesiumModel");
        const geoJsonFeature = geoJsonDataSource.entities.values[0];
        const coordinates = geoJsonFeature.geometry.coordinates;
        coordinates.push(coords);
        geoJsonFeature.geometry.coordinates = coordinates;
        geoJsonDataSource.entities.values[0] = geoJsonFeature;
        this.mapData.updateAppearance();
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
