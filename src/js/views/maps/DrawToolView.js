"use strict";

define([
  "backbone",
  "models/connectors/GeoPoints-CesiumPolygon",
  "models/connectors/GeoPoints-CesiumPoints",
  "collections/maps/GeoPoints",
], function (Backbone, GeoPointsVectorData, GeoPointsCesiumPoints, GeoPoints) {
  /**
   * @class DrawTool
   * @classdesc The DrawTool view allows a user to draw an arbitrary polygon on
   * the map. The polygon is stored in a GeoPoints collection and displayed on
   * the map using a connected CesiumVectorData model.
   * @classcategory Views/Maps
   * @name DrawTool
   * @extends Backbone.View
   * @screenshot views/maps/DrawTool.png
   * @since 2.27.0
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
       * Class to use for the active button
       * @type {string}
       */
      buttonClassActive: "map-view__button--active",

      /**
       * @typedef {Object} DrawToolButtonOptions
       * @property {string} name - The name of the button. This should be the
       * same as the mode that the button will activate (if the button is
       * supposed to activate a mode).
       * @property {string} label - The label to display on the button.
       * @property {string} icon - The name of the icon to display on the
       * button.
       * @property {string} [method] - The name of the method to call when the
       * button is clicked. If this is not provided, the button will toggle the
       * mode of the draw tool.
       */

      /**
       * The buttons to display in the toolbar and their corresponding actions.
       * @type {DrawToolButtonOptions[]}
       */
      buttons: [
        {
          name: "remove",
          label: "Remove Point",
          icon: "eraser",
        },
        {
          name: "move",
          label: "Move Point",
          icon: "move",
        },
         {
          name: "draw",
          label: "Draw Polygon",
          icon: "pencil",
        },
        {
          name: "save",
          label: "Save",
          icon: "save",
          method: "savetocsv",
        },

        {
          name: "clear",
          label: "Clear Polygon",
          icon: "trash",
          method: "reset",
        },

      ],

      /**
       * The buttons that have been rendered in the toolbar. Formatted as an
       * object with the button name as the key and the button element as the
       * value.
       * @type {Object}
       */
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
      opacity: 0.3,

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
          console.warn("No map model was provided.");
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
          hideInLayerList: true,
          outlineColor: this.color,
          highlightColor: this.color,
          opacity: this.opacity,
          colorPalette: {
            colors: [
              {
                color: this.color,
              },
            ],
          },
        });
      },

      /**
       * Sets up the connector to connect the GeoPoints collection to the
       * CesiumVectorData model. Adds the connector and points properties to
       * this view.
       * @returns {GeoPointsVectorData} The connector
       */
      setUpConnectors: function () {
        const points = (this.points = new GeoPoints());
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
       * Resets the draw tool to its initial state.
       */
      reset: function () {
        this.setMode(false);
        this.clearPoints();
        this.removeClickListeners();
      },

      /**
       * Removes the polygon object from the map
       */
      removeLayer: function () {
        if (!this.mapModel || !this.layer) return;
        this.polygonConnector.disconnect();
        this.polygonConnector.set("vectorLayer", null);
        this.pointsConnector.disconnect();
        this.pointsConnector.set("vectorLayer", null);
        this.mapModel.removeAsset(this.layer);
      },

      /**
       * Renders the DrawTool
       * @returns {DrawTool} Returns the view
       */
      render: function () {
        if (!this.mapModel) {
          this.showError("No map model was provided.");
          return this;
        }
        this.renderToolbar();
        return this;
      },

      /**
       * Show an error message to the user if the map model is not available
       * or any other error occurs.
       * @param {string} [message] - The error message to show to the user.
       */
      showError: function (message) {
        const str =
          `<i class="icon-warning-sign icon-left"></i>` +
          `<span> The draw tool is not available. ${message}</span>`;
        this.el.innerHTML = str;
      },

      /**
       * Create and insert the buttons for drawing and clearing the polygon.
       */
      renderToolbar: function () {
        const view = this;
        const el = this.el;

        // Create the buttons
        view.buttons.forEach((options) => {
          const button = document.createElement("button");
          button.className = this.buttonClass;
          button.innerHTML = `<i class="icon icon-${options.icon}"></i> ${options.label}`;
          button.addEventListener("click", function () {
            const method = options.method;
            if (method) view[method]();
            else view.toggleMode(options.name);
          });
          if (!view.buttonEls) view.buttonEls = {};
          view.buttonEls[options.name + "Button"] = button;
          el.appendChild(button);
        });
      },

      /**
       * Sends the polygon coordinates to a callback function to do something
       * with them.
       * @param {Function} callback - The callback function to send the polygon
       * coordinates to.
       */
      // save: function (callback) {
      //   this.setMode(false);
      //   if (callback && typeof callback === "function") {
      //     callback(this.points.toJSON());
      //   }
      // },
      savetocsv: function (callback) {
        this.setMode(false);

        // Convert JSON to CSV
        function convertToCSV(jsonData) {
          console.log("Converting JSON data to CSV...");
          console.log("Raw JSON data:", jsonData);
          var polygon = jsonData.reverse().map(function(i){
            return [
              i.longitude,i.latitude,
            ];
          });
          polygon.push([
            jsonData[0].longitude,
            jsonData[0].latitude
          ]);

          var data = {
            "type": "FeatureCollection",
            "features": [
              {
                "type": "Feature",
                "properties": {},
                "geometry": {
                  "coordinates": [
                    polygon
                  ],
                  "type": "Polygon"
                }
              }
            ]
          };

          return data;
        }

        // Create and download CSV
        function downloadCSV(csvData, filename) {
          console.log("Downloading CSV...");
          const blob = new Blob([JSON.stringify(csvData)], { type: 'text/json' });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          console.log("CSV Download complete.");
        }

        // Get JSON data from layer
        const jsonData = this.points.toJSON();
        console.log("JSON data from layer.toJSON():", jsonData);

        // Convert JSON data to CSV and download it
        const data = convertToCSV(jsonData);
        downloadCSV(data, 'data.json');

        // Invoke the callback if it exists
        if (callback && typeof callback === "function") {
          callback(jsonData);
        } else {
          console.log("No callback provided, proceeding without it.");
        }
      }
      ,
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
        if (!buttonEl) return;
        this.resetButtonStyles();
        buttonEl.classList.add(this.buttonClassActive);
      },

      /**
       * Resets the styles of all of the buttons to indicate that they are not
       * active.
       */
      resetButtonStyles: function () {
        // Iterate through the buttonEls object and reset the styles
        for (const button in this.buttonEls) {
          if (this.buttonEls.hasOwnProperty(button)) {
            const buttonEl = this.buttonEls[button];
            buttonEl.classList.remove(this.buttonClassActive);
          }
        }
      },

      /**
       * Removes the click listeners from the map model and sets the
       * clickFeatureAction back to its original value.
       */
      removeClickListeners: function () {
        const handler = this.clickHandler;
        const originalAction = this.originalAction;
        if (handler) {
          handler.stopListening();
          handler.clear();
          this.clickHandler = null;
        }
        this.mapModel.set("clickFeatureAction", originalAction);
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
          },
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
          },
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
        if (this.clickActionBlocked) return;
        this.clickActionBlocked = true;
        setTimeout(() => {
          this.clickActionBlocked = false;
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
    },
  );

  return DrawTool;
});
