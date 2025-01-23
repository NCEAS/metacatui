"use strict";

define([
  "backbone",
  "text!templates/maps/download-panel.html",
  "models/connectors/GeoPoints-CesiumPolygon",
  "models/connectors/GeoPoints-CesiumPoints",
  "collections/maps/GeoPoints",
  "cesium",
  "views/maps/CesiumWidgetView",
  "views/maps/MapView",
  // "views/maps/DrawToolDataPanelView",
], (
  Backbone,
  Template,
  GeoPointsVectorData,
  GeoPointsCesiumPoints,
  GeoPoints,
  Cesium,
  CesiumWidgetView, 
  MapView,

) => {
  /**
   * @class DownloadPanelView
   * @classdesc The DownloadPanelView allows a user to draw an arbitrary polygon on
   * the map. The polygon is stored in a GeoPoints collection and displayed on
   * the map using a connected CesiumVectorData model.
   * @classcategory Views/Maps
   * @name DownloadPanelView
   * @extends Backbone.View
   * @screenshot views/maps/DrawTool.png
   * @since 2.28.0
   * @constructs DownloadPanelView
   */
  const DownloadPanelView = Backbone.View.extend(
    /** @lends DownloadPanelView.prototype */ {
      /**
       * The type of View this is
       * @type {string}
       */
      type: "DownloadPanelView",

      /**
       * The HTML classes to use for this view's element
       * @type {string}
       */
      // className: "draw-tool",
      className: "draw__all-content",

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
       * The HTML classes to use for this view's HTML elements.
       * @type {Object<string,string>}
       */
      classNames: {
        search: "layers-panel__search",
        // layers: "layers-panel__layers",
      },

      /**
       * @typedef {Object} DrawToolButtonOptions
       * @property {Map} The Map model that contains layers information.
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

      buttons: [
        {
          name: "draw", // === mode
          label: "Draw Area of Interest",
          icon: "pencil",
          // icon: "draw-polygon",
        },
        {
          name: "clear",
          label: "Clear Area of Interest",
          icon: "trash",
          method: "reset",
        },
        {
          name: "save",
          label: "Save",
          icon: "download-alt",
          method: "save",
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
       * The primary HTML template for this view
       * @type {Underscore.template}
       */
           template: _.template(Template),

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
       * The GeoPoints collection that stores the points of the polygon that is
       * being drawn.
       * @type {MapInteraction}
       */
         mapinteraction: undefined,

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
       * @param {CesiumWidgetView} options.cesiumWidgetView 
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
        // console.log(this.layer);
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
       * Render the view by updating the HTML of the element.
       * The new HTML is computed from an HTML template that
       * is passed an object with relevant view state.
       * */
      render: function () {
         // Insert the template into the view
         if (!this.mapModel) {
          this.showError("No map model was provided.");
          return this;
        }
        this.$el.html(this.template());

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
       * @param buttonName
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
      
      // added by Shirly - listed to changes in previousAction
        handler.listenTo(
          interactions,
          "change:previousAction",
          function () {
            if (interactions.get("previousAction") == "LEFT_DOUBLE_CLICK") {
              // view.generatePreviewPanel();
            }
          },
        );

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
       * Create and insert the buttons for drawing and clearing the polygon.
       */
      renderToolbar() {
        const view = this;
        const el = this.el;
        const drawContainer = this.el.querySelector(".draw-tool");
        if (!drawContainer) {
          console.error("Error: .draw__all-content container not found");
          return;
        }
        // Create the buttons
        view.buttons.forEach((options) => {
          const button = document.createElement("button");
          button.className = this.buttonClass;
          // button.innerHTML = `<i class="icon icon-${options.icon}"></i> ${options.label}`;
          button.innerHTML = `
              <span class="custom-circle">
                <i class="icon icon-${options.icon}"></i>
              </span> 
              <span class="draw-button-label">${options.label}</span> `;
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

      // generatePreviewPanel() {
      //   // this.model = options.model;
      //   const drawToolDataPanel = new DrawToolDataPanelView({
      //     model: this.mapModel,
      //   });
      //   drawToolDataPanel.render();
      //   this.$el.append(drawToolDataPanel.el);
      //   alert("Finished drawing");
      // },
      // /**
      //  * Clears the polygon that is being drawn
      //  */
      onClose: function () {
        this.removeLayer();
        this.removeClickListeners();
      },
   
    },
  );

  return DownloadPanelView;
});
