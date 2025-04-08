"use strict";

define([
  "underscore",
  "backbone",
  "jszip",
  "text!templates/maps/download-panel.html",
  "models/connectors/GeoPoints-CesiumPolygon",
  "models/connectors/GeoPoints-CesiumPoints",
  "collections/maps/GeoPoints",
], (
  _,
  Backbone,
  JSZip,
  Template,
  GeoPointsVectorData,
  GeoPointsCesiumPoints,
  GeoPoints,
) => {
  // Classes used in the view
  const CLASS_NAMES = {
    button: "draw__button",
    buttonFocus: "draw__button--active",
    buttonDisable: "draw__button--disable",
    layerItemPanelToggle: "download-expansion-panel__toggle",
    layerItemCheckbox: "download-expansion-panel__checkbox",
    dropdown: "downloads-dropdown",
    resolutionDropdown: "resolution-dropdown",
    fileTypeDropdown: "fileType-downloads-dropdown",
    error: "error",
    wmtsCopy: "wmts-copy",
  };

  /**
   * @class DownloadPanelView
   * @classdesc The DownloadPanelView allows a user to draw an arbitrary polygon
   * on the map and download the data within that polygon. The user can select
   * the resolution and file type of the data to download. The view is
   * responsible for rendering the buttons, handling user interactions, and
   * generating the download links for the selected data.
   * @classcategory Views/Maps
   * @name DownloadPanelView
   * @augments Backbone.View
   * @screenshot views/maps/DownloadPanelView.png
   * @since 2.33.0
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
      className: "download-panel",

      /**
       * Class to use for the buttons
       * @type {string}
       */
      buttonClass: "draw__button ",

      /**
       * Class to use for the active button
       * @type {string}
       */
      buttonClassActive: "draw__button--active",

      /**
       * Class to disable button
       * @type {string}
       */
      buttonClassDisable: "draw__button--disable",

      /**
       * The HTML classes to use for this data panel element
       * @type {string}
       */
      dataPanelClass: "download-panel",

      /**
       * The maximum size of the download in bytes. If download is estimated to exceed
       * this size, the download will be blocked.
       * @type {number}
       */
      downloadSizeLimit: 1050000, // 1 GB

      /**
       * @typedef {object} DrawToolButtonOptions
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
       * @property {boolean} [blockMethodIfDeactivated] - If true, the button's
       * method won't run if the button is in the deactivated state.
       */

      /**
       * The buttons to display in the toolbar.
       * @type {DrawToolButtonOptions[]}
       */
      buttons: [
        {
          name: "draw",
          label: "Draw Area of Interest",
          icon: "pencil",
          method: "toggleDraw",
          blockMethodIfDeactivated: false,
        },
        {
          name: "clear",
          label: "Clear Area of Interest",
          icon: "trash",
          method: "reset",
          blockMethodIfDeactivated: true,
        },
        {
          name: "save",
          label: "Download",
          icon: "download-alt",
          method: "downloadData",
          blockMethodIfDeactivated: true,
        },
      ],

      /** @inheritdoc */
      events() {
        const events = {};
        const CN = CLASS_NAMES;
        events[`click .${CN.button}`] = "handleButtonClick";
        events[`click .${CN.layerItemPanelToggle}`] = "toggleLayerSection";
        return events;
      },

      /**
       * The buttons that have been rendered in the toolbar. Formatted as an
       * object with the button name as the key and the button element as the
       * value.
       * @type {object}
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
       * The TileMatrixSet.
       * @type {string}
       */
      tileMatrixSet: "WGS1984Quad",

      /**
       * The file size for tiled data in geotiff format (in KB).
       * @type {number}
       */
      fileSizes: {
        tif: 513,
        png: 2.7,
        wmts: 15,
        gpkg: 180,
      },

      /**
       * The array that store the list of URLs for each data layer that is
       * selected for partial download.
       * @type {Array}
       */
      dataDownloadLinks: {},

      /**
       * The classes of the sub-elements that combined to create the download
       * panel view.
       */
      classes: {
        toolbarLink: ".toolbar__links",
        toolbarLinkActive: "toolbar__link--active",
        toolbarContentActive: "toolbar__content--active",
        layerItemPanel: "download-expansion-panel",
        layerItemTitle: "download-expansion-panel__title",
        layerItemContent: "download-expansion-panel__content",
        dropdownWrapper: "downloads-dropdown-wrapper",
        dropdownContainer: "downloads-dropdown-container",
        fileSizeBox: "downloads-textbox",
      },

      /**
       * The z levels available for download along with their approximate pixel
       * resolution.
       * @type {object}
       */
      zoomLevels: {
        0: "156543.03 m/px",
        1: "78271.52 m/px",
        2: "39135.76 m/px",
        3: "19567.88 m/px",
        4: "9783.94 m/px",
        5: "4891.97 m/px",
        6: "2445.98 m/px",
        7: "1222.99 m/px",
        8: "611.49 m/px",
        9: "305.75 m/px",
        10: "152.87 m/px",
        11: "76.44 m/px",
        12: "38.22 m/px",
        13: "19.12 m/px",
        14: "9.55 m/px",
        15: "4.78 m/px",
      },

      /**
       * UI options for the dropdowns
       * @type {object}
       * @property {object} resolution - The resolution dropdown options
       * @property {object} fileType - The file type dropdown options
       * @property {string} label - The label for the dropdown
       * @property {string} defaultValue - The default value for the dropdown
       * @property {string} defaultText - The default text for the dropdown
       */
      dropdownOptions: {
        resolution: {
          label: "Resolution",
          defaultValue: "",
          defaultText: "Select Resolution",
        },
        fileType: {
          label: "File Format",
          defaultValue: "",
          defaultText: "Select File Type",
        },
      },

      /**
       * The objectServiceUrl from the MapModel
       * @type {string}
       */
      objectServiceUrl: "",

      /**
       * Initializes the DrawTool
       * @param {object} options - A literal object with options to pass to the
       * view
       * @param {Map} options.model - The Cesium map model to draw on. This must
       * be the same model that the mapWidget is using.
       * @param {CesiumWidgetView} options.cesiumWidgetView - The
       * CesiumWidgetView that contains the map.
       * @param {string} [options.mode] - The initial mode of the draw tool.
       */
      initialize(options) {
        this.mapModel = options.model || new Map();
        this.objectServiceUrl = MetacatUI.appModel.get("objectServiceUrl");
        // Add models & collections, interactions, layer, connector, points
        this.setUpMapModel();
        this.setUpLayer();
        this.setUpConnectors();
      },

      /** Adds reference to interaction model to view */
      setUpMapModel() {
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
      setUpLayer() {
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
        return this.layer;
      },

      /**
       * Sets up the connector to connect the GeoPoints collection to the
       * CesiumVectorData model. Adds the connector and points properties to
       * this view.
       * @returns {GeoPointsVectorData} The connector
       */
      setUpConnectors() {
        const points = new GeoPoints();
        this.points = points;
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
       * @param {object} point - The point to add to the polygon. This should
       * have a latitude and longitude property.
       * @returns {GeoPoint} The GeoPoint model that was added to the polygon.
       */
      addPoint(point) {
        return this.points?.addPoint(point);
      },

      /**
       * Clears the polygon that is being drawn.
       */
      clearPoints() {
        this.points?.reset(null);
      },

      /**
       * Resets the draw tool to its initial state.
       */
      reset() {
        this.toggleDraw(true);
        this.clearPoints();
        this.removeClickListeners();

        document.querySelector(".download-data-list__panel").textContent =
          "Draw Area of Interest: Single-click to add vertices, double-click to complete.";

        document.querySelector(".download-data-list").innerHTML = "";
        this.setButtonStatuses({
          draw: "enabled",
          clear: "deactivated",
          save: "deactivated",
        });
      },

      /**
       * Removes the polygon object from the map
       */
      removeLayer() {
        if (!this.mapModel || !this.layer) return;
        this.polygonConnector.disconnect();
        this.polygonConnector.set("vectorLayer", null);
        this.pointsConnector.disconnect();
        this.pointsConnector.set("vectorLayer", null);
        this.mapModel.removeAsset(this.layer);
      },

      /**
       * Render the view by updating the HTML of the element. The new HTML is
       * computed from an HTML template that is passed an object with relevant
       * view state.
       * @returns {DownloadPanelView} This view
       */
      render() {
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
       * Show an error message to the user if the map model is not available or
       * any other error occurs.
       * @param {string} [message] - The error message to show to the user.
       */
      showError(message) {
        const str =
          `<i class="icon-warning-sign icon-left"></i>` +
          `<span> The draw tool is not available. ${message}</span>`;
        this.el.innerHTML = str;
      },

      /**
       * Handles a click on a button in the toolbar. If the button has a
       * method property, it will call that method. Otherwise, it will toggle the
       * mode of the draw tool.
       * @param {Event} event - The click event.
       */
      handleButtonClick(event) {
        const button = event.currentTarget;
        const { name } = button.dataset;
        if (!name) return;
        const options = this.buttons.find((btn) => btn.name === name);
        const methodName = options.method;
        const method = this[methodName];
        if (typeof method === "function") {
          if (
            options.blockMethodIfDeactivated &&
            button.dataset.status === "deactivated"
          ) {
            return;
          }
          method.call(this, event);
        }
      },

      /**
       * Toggles the draw tool on and off.
       * @param {boolean} [draw] - If true, the draw tool will be turned on. If
       * false, it will be turned off. If not provided, the draw tool will
       * toggle to the opposite of the current state.
       * @param {"enabled"|"deactivated"} [offStatus] - The status to set the
       * button to when the toggle is off.
       */
      toggleDraw(draw, offStatus = "enabled") {
        const buttonEl = this.buttonEls.drawButton;
        if (!buttonEl) return;

        // if the button is deactivated, do nothing, unless a boolean is
        // explicitly passed, i.e. it's not a simple click event.
        if (
          buttonEl.dataset.status === "deactivated" &&
          typeof draw !== "boolean"
        ) {
          return;
        }

        // If a boolean is passed, use that to determine whether to turn on or
        // off the draw tool. Otherwise, switch to the opposite of the current
        // state.
        const turnOn = typeof draw === "boolean" ? draw : !this.draw;

        if (turnOn) {
          // Turn on drawing mode
          this.draw = true;
          this.setClickListeners();
          this.setButtonStatus("draw", "focused");
        } else {
          // Turn off drawing mode
          this.draw = false;
          this.removeClickListeners();
          this.setButtonStatus("draw", offStatus);
        }
      },

      /**
       * Sets the status of the button to either "enabled", "deactivated", or
       * "focused".
       * @param {string} name - The name of the button to set the status for.
       * @param {"enabled"|"deactivated"|"focused"} status - The status to set
       * the button to.
       */
      setButtonStatus(name, status) {
        const buttonEl = this.buttonEls[`${name}Button`];
        if (!buttonEl || buttonEl.dataset.status === status) return;

        // Reset all button styles - default to enabled
        buttonEl.classList.remove(CLASS_NAMES.buttonFocus);
        buttonEl.classList.remove(CLASS_NAMES.buttonDisable);
        buttonEl.dataset.status = status;

        if (status === "deactivated") {
          buttonEl.classList.add(CLASS_NAMES.buttonDisable);
        } else if (status === "focused") {
          buttonEl.classList.add(CLASS_NAMES.buttonFocus);
        }

        // Special case for the draw button, which sets the draw mode
        if (name === "draw") {
          const turnOnDraw = status === "focused";
          this.toggleDraw(turnOnDraw, status);
        }
      },

      /**
       * Set the status on multiple buttons at once
       * @param {object} statues - An object with the button names as keys and
       * the status as values
       */
      setButtonStatuses(statues) {
        Object.entries(statues).forEach(([name, status]) => {
          this.setButtonStatus(name, status);
        });
      },

      /**
       * Removes the click listeners from the map model and sets the
       * clickFeatureAction back to its original value.
       */
      removeClickListeners() {
        const handler = this.clickHandler;
        if (handler) {
          handler.stopListening();
          handler.clear();
          this.clickHandler = null;
        }
        this.interactions.enableClickAction();
        this.listeningForClicks = false;
      },

      /**
       * Set listeners to call the handleClick method when the user clicks on
       * the map.
       */
      setClickListeners() {
        const view = this;
        // Remove click listeners first so that we don't have duplicated
        // listeners performing the same action
        view.removeClickListeners();
        const handler = new Backbone.Model();
        this.clickHandler = handler;
        const { interactions } = this;
        const clickedPosition = interactions.get("clickedPosition");
        this.interactions.preventClickAction();
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
        handler.listenToOnce(interactions, "change:clickedPosition", () => {
          if (view.listeningForClicks) {
            view.handleClick();
            view.setClickListeners();
          }
        });

        handler.listenToOnce(this.mapModel, "change:interactions", () => {
          if (view.listeningForClicks) {
            view.handleClick();
            view.setClickListeners();
          }
        });

        handler.listenTo(interactions, "change:previousAction", () => {
          if (interactions.get("previousAction") === "LEFT_DOUBLE_CLICK") {
            view.generatePreviewPanel();
          }
        });
      },

      /**
       * Handles a click on the map. If the draw tool is active, it will add the
       * coordinates of the click to the polygon being drawn.
       * @param {number} [throttle=50] - The number of milliseconds to block
       * clicks for after a click is handled. This prevents double clicks.
       */

      handleClick(throttle = 50) {
        // Prevent double clicks
        if (this.clickActionBlocked) return;
        this.clickActionBlocked = true;
        setTimeout(() => {
          this.clickActionBlocked = false;
        }, throttle);
        // Add the point to the polygon
        if (this.draw === true) {
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
        // alert("Rendering draw toolbar");
        const view = this;
        const drawContainer = this.el.querySelector(".draw-tool");
        if (!drawContainer) return;
        // Create the buttons
        view.buttons.forEach((options) => {
          const button = document.createElement("button");
          button.className = this.buttonClass;
          button.innerHTML = `
              <span class="custom-circle">
                <i class="icon icon-${options.icon}"></i>
              </span> 
              <span class="draw-button-label">${options.label}</span> `;
          button.dataset.name = options.name;
          if (!view.buttonEls) view.buttonEls = {};
          view.buttonEls[`${options.name}Button`] = button;
          drawContainer.appendChild(button);
        });

        // Set the buttons to the default state
        this.setButtonStatuses({
          draw: "enabled",
          clear: "deactivated",
          save: "deactivated",
        });

        view.generatePreviewPanel();
        const closeDownloadPanelButton = this.el.querySelector(
          ".download-panel-close__button",
        );
        closeDownloadPanelButton.addEventListener("click", () => {
          view.close();
        });
      },

      /**
       * Closes the download panel and resets the draw tool to its initial
       * state.
       */
      close() {
        this.reset();
        // The parent ToolbarView will handle closing the panel so it can
        // coordinate with the layer panel and track the state of the download
        // panel.
        this.trigger("close");
      },

      /**
       * Generates the preview panel for downloading selected map layers.
       * Retrieves the selected layers, removes duplicates, and dynamically
       * creates a user interface for selecting resolution, file type, and
       * initiating downloads. It also handles UI interactions such as toggling
       * panels, enabling/disabling buttons, and updating file size information
       * based on user selections.
       */
      generatePreviewPanel() {
        const view = this;
        let selectedResolution;
        this.clearButtonEl = this.buttonEls.clearButton;
        this.saveButtonEl = this.buttonEls.saveButton;
        this.drawButtonEl = this.buttonEls.drawButton;

        // Get the selected layers from the Layer Panel View and retreive the
        // following information
        //  - layerID - layer identifier
        //  - downloadLink - the link for accesssing dataset that is tiled
        //  - layerName - full name of the layer
        //  - fullDownloadLink - download link for the entire dataset
        let selectedLayersList = [];

        this.mapModel.get("allLayers").forEach((value) => {
          // value is the map layer

          // Re-generate the preview panel when the layer visibility changes.
          view.stopListening(
            value,
            "change:visible",
            view.generatePreviewPanel,
          );
          view.listenTo(value, "change:visible", view.generatePreviewPanel);
          if (
            value.attributes?.visible === true &&
            value.attributes.type === "WebMapTileServiceImageryProvider" &&
            value.attributes.label !== "Alaska High Resolution Imagery"
            // &&
            // "metadataPid" in value.attributes // Instead of not including data layers without metadataPid, rather during download skip the metadata doc download
          ) {
            let wmtsDownloadLink;
            // Get WMTS service from map config
            if (value.attributes && Array.isArray(value.attributes.services)) {
              wmtsDownloadLink = value.attributes.services.find(
                (service) => service.type === "wmts",
              ).endpoint;
            } else {
              wmtsDownloadLink = null;
            }
            // Get PNG download link from map config
            let pngDownloadLink;
            if (value.attributes && Array.isArray(value.attributes.services)) {
              pngDownloadLink = value.attributes.services.find(
                (service) => service.type === "png",
              ).endpoint;
            } else {
              pngDownloadLink = null;
            }
            // Get Geotiff download link from map config
            let tiffService;
            if (value.attributes && Array.isArray(value.attributes.services)) {
              tiffService = value.attributes.services.find(
                (service) => service.type === "geotiff",
              );
            } else {
              tiffService = null;
            }
            // Get Geopackage download link from map config
            let geopckgService = null;
            if (value.attributes && Array.isArray(value.attributes.services)) {
              geopckgService = value.attributes.services.find(
                (service) => service.type === "geopackage",
              );
            } else {
              geopckgService = null;
            }

            const selectedLayer = {
              layerID: value.attributes.layerId,
              ID: value.attributes.id
                ? value.attributes.id.split("/").pop()
                : null,
              downloadLink: value.attributes.downloadLink,
              layerName: value.attributes.label.replace(
                "<sub>2</sub>",
                "\u2082",
              ),
              fullDownloadLink: value.attributes.moreInfoLink,
              // pngDownloadLink: value.attributes.cesiumOptions.url,
              pngDownloadLink,
              wmtsDownloadLink,
              metadataPid: value.attributes.metadataPid,
              gpkgDownloadLink: geopckgService ? geopckgService.endpoint : null,
              tiffDownloadLink: tiffService ? tiffService.endpoint : null,
            };
            selectedLayersList.push(selectedLayer);
          }
        });
        // Remove duplicate layers
        selectedLayersList = selectedLayersList.filter(
          (layer, index, self) =>
            index === self.findIndex((l) => l.layerID === layer.layerID),
        );
        // Create download tool panel
        const downloadDataPanel = document.querySelector(".download-data-list");

        if (!downloadDataPanel) return;

        // Clear any previously added layer items in case of a rerender
        downloadDataPanel.innerHTML = "";

        // If there is no polygon on the map, quit here.
        if (!this.points.length) return;

        this.setButtonStatuses({
          draw: "deactivated",
          clear: "enabled",
          save: "deactivated",
        });

        if (!selectedLayersList.length) {
          // Update the text of download-data-list__panel
          document.querySelector(".download-data-list__panel").textContent =
            "No layers are available for download. Click on layers in the list above to make them visible on the Map and available for download. Only select layers have data products available for download.";
          view.setButtonStatuses({
            save: "deactivated",
            draw: "deactivated",
            clear: "enabled",
          });
        } else {
          // Loop through selected data layers
          selectedLayersList.forEach((item) => {
            const fileTypeOptions = {
              tif: "Geotiff",
              png: "PNG",
              wmts: "WMTS file",
              gpkg: "Geopackage",
            };

            // Create panel container for each layer that intersects the
            // bounding box
            const downloadDataPanelContainer = document.createElement("div");
            downloadDataPanelContainer.classList.add(
              this.classes.layerItemPanel,
            );
            const layerItem = document.createElement("div");
            layerItem.classList.add(CLASS_NAMES.layerItemPanelToggle);

            // Create checkbox that allows user to select the layer
            const layerItemSelectBox = document.createElement("input");
            layerItemSelectBox.type = "checkbox";
            layerItemSelectBox.classList.add(CLASS_NAMES.layerItemCheckbox);

            // Attach layer attributes to the checkbox
            layerItemSelectBox.dataset.layerId = item.layerID;
            layerItemSelectBox.dataset.downloadLink = item.downloadLink;
            layerItemSelectBox.dataset.layerName = item.layerName;
            layerItemSelectBox.dataset.fullDownloadLink = item.fullDownloadLink;
            layerItemSelectBox.dataset.pngDownloadLink = item.pngDownloadLink;
            layerItemSelectBox.dataset.id = item.ID;
            layerItemSelectBox.dataset.wmtsDownloadLink = item.wmtsDownloadLink;
            layerItemSelectBox.dataset.gpkgDownloadLink = item.gpkgDownloadLink;
            layerItemSelectBox.dataset.tiffDownloadLink = item.tiffDownloadLink;
            layerItemSelectBox.dataset.metadataPid = item.metadataPid;

            const layerItemSpan = document.createElement("span");
            layerItemSpan.classList.add(this.classes.layerItemTitle);
            layerItemSpan.textContent = item.layerName;

            layerItem.appendChild(layerItemSelectBox);
            layerItem.appendChild(layerItemSpan);

            const layerItemSelectContent = document.createElement("div");
            layerItemSelectContent.classList.add(this.classes.layerItemContent);

            // Create the "Resolution" dropdown
            const resolutionDropdownWrapper = document.createElement("div");
            resolutionDropdownWrapper.classList.add(
              this.classes.dropdownWrapper,
            );
            const resolutionLabel = document.createElement("label");
            resolutionLabel.textContent = this.dropdownOptions.resolution.label;

            const resolutionDropdown = document.createElement("select");
            resolutionDropdown.classList.add(CLASS_NAMES.dropdown);
            resolutionDropdown.classList.add(CLASS_NAMES.resolutionDropdown);

            // Add a default select option
            const defaultResolutionOption = document.createElement("option");
            defaultResolutionOption.value =
              this.dropdownOptions.resolution.defaultValue;
            defaultResolutionOption.textContent =
              this.dropdownOptions.resolution.defaultText;
            defaultResolutionOption.disabled = true; // Make it non-selectable
            defaultResolutionOption.selected = true; // Make it the default selection
            resolutionDropdown.appendChild(defaultResolutionOption);

            Object.entries(this.zoomLevels).forEach(
              ([zoomLevel, pixelResolution]) => {
                const option = document.createElement("option");
                option.value = zoomLevel;
                option.textContent = `${zoomLevel} - ${pixelResolution}`;
                resolutionDropdown.appendChild(option);
              },
            );

            resolutionDropdownWrapper.appendChild(resolutionLabel);
            resolutionDropdownWrapper.appendChild(resolutionDropdown);

            // Create the "File Type" dropdown
            const fileTypeDropdownWrapper = document.createElement("div");
            fileTypeDropdownWrapper.classList.add(this.classes.dropdownWrapper);
            const fileTypeLabel = document.createElement("label");
            fileTypeLabel.textContent = this.dropdownOptions.fileType.label;

            const fileTypeDropdown = document.createElement("select");
            fileTypeDropdown.classList.add(CLASS_NAMES.dropdown);
            fileTypeDropdown.classList.add(CLASS_NAMES.fileTypeDropdown);

            if (item.tiffDownloadLink == null) {
              delete fileTypeOptions.tif;
            }

            if (item.gpkgDownloadLink == null) {
              delete fileTypeOptions.gpkg;
            }
            // Add a default select option
            const defaultFileTypeOption = document.createElement("option");
            defaultFileTypeOption.value =
              this.dropdownOptions.fileType.defaultValue;
            defaultFileTypeOption.textContent =
              this.dropdownOptions.fileType.defaultText;
            defaultFileTypeOption.disabled = true; // Make it non-selectable
            defaultFileTypeOption.selected = true; // Make it the default selection
            fileTypeDropdown.appendChild(defaultFileTypeOption);

            Object.entries(fileTypeOptions).forEach(
              ([fileType, fileTypeName]) => {
                const option = document.createElement("option");
                option.value = fileType;
                option.textContent = fileTypeName;
                fileTypeDropdown.appendChild(option);
              },
            );

            fileTypeDropdownWrapper.appendChild(fileTypeLabel);
            fileTypeDropdownWrapper.appendChild(fileTypeDropdown);
            fileTypeDropdown.disabled = true; // initially setting it to true

            const dropdownContainer = document.createElement("div");
            dropdownContainer.classList.add(this.classes.dropdownContainer);

            // Append both dropdown wrappers
            dropdownContainer.appendChild(resolutionDropdownWrapper);
            dropdownContainer.appendChild(fileTypeDropdownWrapper);
            layerItemSelectContent.appendChild(dropdownContainer);

            // Textbox to display file size
            const fileSizeInfoBox = document.createElement("label");
            fileSizeInfoBox.classList.add(this.classes.fileSizeBox);
            fileSizeInfoBox.textContent =
              "Select resolution and file format to download...";
            layerItemSelectContent.appendChild(fileSizeInfoBox);

            // Handle change event for "Resolution" dropdown
            resolutionDropdown.addEventListener("change", () => {
              selectedResolution = resolutionDropdown.value;
              if (selectedResolution !== "") {
                fileTypeDropdown.disabled = false; // Enable the fileTypeDropdown
              }
              fileTypeDropdown.value = defaultFileTypeOption.value;
            });

            // Update approximate file size when a file type is selected in
            // fileTypeDropdown
            fileTypeDropdown.addEventListener("change", () => {
              view.fileTypeSelection(layerItemSelectBox.dataset.layerId); // Update Save button state -- moved from layer check-box change event
              const fileSize = view.getRawFileSize(
                resolutionDropdown.value,
                fileTypeDropdown.value,
                layerItemSelectBox.dataset.layerId,
                layerItemSelectBox.dataset.fullDownloadLink,
                layerItemSelectBox.dataset.pngDownloadLink,
                layerItemSelectBox.dataset.gpkgDownloadLink,
                layerItemSelectBox.dataset.id,
                layerItemSelectBox.dataset.layerName,
                layerItemSelectBox.dataset.wmtsDownloadLink,
                layerItemSelectBox.dataset.metadataPid,
                layerItemSelectBox.dataset.tiffDownloadLink,
              );
              view.updateTextbox(
                fileSizeInfoBox,
                fileSize,
                fileTypeDropdown.value,
                layerItemSelectBox.dataset.layerId,
              );
            });

            // Append elements
            downloadDataPanelContainer.appendChild(layerItem);
            downloadDataPanelContainer.appendChild(layerItemSelectContent);
            downloadDataPanel.appendChild(downloadDataPanelContainer);

            // Toggle the expansion panel content on click
            layerItem.addEventListener("click", () => {
              downloadDataPanelContainer.classList.toggle("show-content");
            });
          });
          // Update the text of download-data-list__panel
          document.querySelector(".download-data-list__panel").textContent =
            "Select products below and click the download button. To download full datasets (including original shapefiles) please use the Layers panel above. ";

          // Progress Bar
          const dataListPanel = document.querySelector(
            ".download-data-list__panel",
          );
          // Create the download status bar container
          const downloadStatusContainer = document.createElement("div");
          downloadStatusContainer.classList.add("download-status-container");
          downloadStatusContainer.style.display = "none"; // Hidden by default

          // Create the progress bar element
          const progressBar = document.createElement("div");
          progressBar.classList.add("progress-bar");
          progressBar.style.width = "0%"; // Initial width
          progressBar.textContent = "0%"; // Initial text

          downloadStatusContainer.appendChild(progressBar);
          dataListPanel.appendChild(downloadStatusContainer);

          // Save reference to the progress bar and related elements for
          // updating later.
          view.downloadStatusContainer = downloadStatusContainer;
          view.progressBar = progressBar;
        }
      },

      /**
       * Open or close the data/layer item in the list of downloadable layers.
       * @param {Event} event - The click event that triggered this function.
       */
      toggleLayerSection(event) {
        // TODO: Use the accordion view to handle this
        const view = this;
        const itemToggle = event.currentTarget;
        const itemContent = itemToggle.nextElementSibling;
        const checkbox = itemToggle.querySelector(
          `.${CLASS_NAMES.layerItemCheckbox}`,
        );
        const resolutionDropdown = itemContent.querySelector(
          `.${CLASS_NAMES.resolutionDropdown}`,
        );
        const fileTypeDropdown = itemContent.querySelector(
          `.${CLASS_NAMES.fileTypeDropdown}`,
        );

        const isOpen = itemToggle.classList.contains("show-content");

        // If it's open, close it
        if (isOpen) {
          // Close it
          itemToggle.classList.remove("show-content");
          itemContent.style.display = "none";
          checkbox.checked = false; // Uncheck the checkbox
        } else {
          itemToggle.classList.add("show-content");
          itemContent.style.display = "block";
          checkbox.checked = true; // Check the checkbox
          // Reset resolution dropdown to the default value
          resolutionDropdown.value =
            this.dropdownOptions.resolution.defaultValue;
          // Disable fileTypeDropdown if necessary
          fileTypeDropdown.disabled = true;
        }
        view.layerSelection(); // Update Save button state
      },

      /**
       * Handles the selection of map layers and updates the state of the save
       * button and other UI elements based on whether any checkboxes are
       * checked.
       */
      layerSelection() {
        const view = this;
        const checkboxes = document.querySelectorAll(
          ".download-expansion-panel__checkbox",
        );
        const isAnyChecked = Array.from(checkboxes).some(
          (checkbox) => checkbox.checked,
        );
        const dropdowns = document.querySelectorAll(
          ".downloads-dropdown-container .fileType-downloads-dropdown",
        );

        const isanyFileTypeSelected = Array.from(dropdowns).some((dropdown) =>
          ["png", "tif", "gpkg"].includes(dropdown.value.toLowerCase()),
        );

        if (isAnyChecked && isanyFileTypeSelected) {
          view.setButtonStatuses({
            draw: "deactivated",
            save: "enabled",
            clear: "enabled",
          });
        } else {
          view.setButtonStatuses({
            draw: "deactivated",
            save: "deactivated",
            clear: "enabled",
          });
        }

        const uncheckedLayerIds = Array.from(checkboxes)
          .filter((checkbox) => !checkbox.checked)
          .map((checkbox) => checkbox.dataset.layerId);

        uncheckedLayerIds.forEach((layerID) => {
          delete view.dataDownloadLinks[layerID];
        });
      },

      /**
       * Handles the selection of file type and updates the state of the save
       * button and other UI elements based on whether any checkboxes are
       * checked.
       * @param {string} layerID - The ID of the map layer being interacted
       * with.
       */
      fileTypeSelection(layerID) {
        const view = this;
        const dropdowns = document.querySelectorAll(
          ".downloads-dropdown-container .fileType-downloads-dropdown",
        );

        const isPNGorTIFSelected = Array.from(dropdowns).some((dropdown) =>
          ["png", "tif", "gpkg"].includes(dropdown.value.toLowerCase()),
        );
        if (!isPNGorTIFSelected) {
          view.setButtonStatuses({
            draw: "deactivated",
            save: "deactivated",
            clear: "enabled",
          });
        } else {
          view.setButtonStatuses({
            draw: "deactivated",
            save: "enabled",
            clear: "enabled",
          });
        }
        if (layerID in view.dataDownloadLinks) {
          delete view.dataDownloadLinks[layerID];
          // alert("Deleted download links for " + layerID);
        }
      },

      /**
       * Updates the text content of the provided info box with file size
       * details and file type information.
       * @param {HTMLElement} infoBox - The HTML element where the file size
       * information will be displayed.
       * @param {number} fileSizeDetails - The size of the file in kilobytes
       * (KB).
       * @param {string} fileType - The type of the file (e.g., "wmts").
       * @param {string} layerID - The ID of the map layer being interacted
       * with.
       */
      updateTextbox(infoBox, fileSizeDetails, fileType, layerID) {
        const fileSizeInfoBox = infoBox;
        if (!fileSizeInfoBox) return;
        fileSizeInfoBox.classList.remove(CLASS_NAMES.error);
        fileSizeInfoBox.classList.remove(CLASS_NAMES.wmtsCopy);
        const view = this;
        if (fileType === "wmts") {
          fileSizeInfoBox.innerHTML = `
            <span id="fileSizeText">${fileSizeDetails}</span>
            <i id="copyWMTS" class="icon-copy" title="Copy to Clipboard"></i>
          `;
          fileSizeInfoBox.classList.add(CLASS_NAMES.wmtsCopy);

          // Add event listener for copying
          document.getElementById("copyWMTS").addEventListener("click", () => {
            const textToCopy =
              document.getElementById("fileSizeText").textContent;
            navigator.clipboard
              .writeText(textToCopy)
              .then(() => {
                const currentContent = fileSizeInfoBox.innerHTML;
                // alert("Copied to clipboard!");
                fileSizeInfoBox.innerHTML = "Copied to clipboard!";
                setTimeout(() => {
                  fileSizeInfoBox.innerHTML = currentContent;
                }, 2000); // Reset after 2 seconds
              })
              .catch(() => {
                const currentContent = fileSizeInfoBox.innerHTML;
                fileSizeInfoBox.innerHTML = "Copy failed!";
                setTimeout(() => {
                  fileSizeInfoBox.innerHTML = currentContent;
                }, 2000); // Reset after 2 seconds
              });
          });
        } else {
          const optionalComment =
            "Use WMTS for accessing large data volume or re-draw AOI.";
          const maxSizeGB = `${(view.downloadSizeLimit / 1e9).toFixed(2)} GB`;
          if (fileSizeDetails > view.downloadSizeLimit) {
            fileSizeInfoBox.textContent = `Download size is too big ( > ${maxSizeGB}). ${optionalComment}.`;
            fileSizeInfoBox.classList.add(CLASS_NAMES.error);
          } else {
            fileSizeInfoBox.textContent = `Estimated download file size is ≤ ${(fileSizeDetails / 1000).toFixed(2)} MB.`;
          }
        }

        // Instead of disabling the Download button for large file sizes simply
        // remove the layer from the the download list variable (i.e.,
        // dataDownloadLinks)
        if (view.dataDownloadLinks[layerID].fileSize > view.downloadSizeLimit) {
          delete view.dataDownloadLinks[layerID];
        }
      },

      /**
       * Calculates the total file size for a given map layer based on the file
       * type, zoom level, and bounding box. Generates URLs for individual tiles
       * or retrieves a single download link for the layer. Updates the
       * `dataDownloadLinks` object with the generated URLs and metadata for the
       * specified layer.
       * @param {number} resolution - The zoom level for the map tiles.
       * @param {string} fileFormat - The format of the file to download (e.g.,
       * "png", "tif", "wmts").
       * @param {string} layerID - The unique identifier for the data layer.
       * @param {string} fullDownloadLink - The full download link for the
       * layer.
       * @param {string} pngDownloadLink - The template URL for downloading PNG
       * tiles.
       * @param {string} gpkgDownloadLink - The template URL for downloading
       * Geopackage tiles.
       * @param {string} id - A unique identifier for the layer or dataset.
       * @param {string} layerName - The name of the data layer.
       * @param {string} [wmtsDownloadLink] - (Optional) The WMTS download link
       * for the layer. Currently unused.
       * @param {string} metadataURL - The metadata URL for the layer.
       * @param {string} tiffDownloadLink - The template URL for downloading
       * TIFF tiles.
       * @returns {number} The total file size for the specified layer in bytes.
       */
      getRawFileSize(
        resolution,
        fileFormat,
        layerID,
        fullDownloadLink,
        pngDownloadLink,
        gpkgDownloadLink,
        id,
        layerName,
        wmtsDownloadLink,
        metadataURL,
        tiffDownloadLink,
      ) {
        const layerSelectBoxes = document.querySelectorAll(
          ".download-expansion-panel__checkbox",
        );
        const selectedLayerSelectBoxes = Array.from(layerSelectBoxes).filter(
          (checkbox) => checkbox.checked,
        );

        this.polygon = this.getPolygon(this.points.toJSON());
        this.boundingBox = this.getBoundingBox(this.polygon);
        let totalFileSize;
        const urls = [];
        let baseURL;
        if (fileFormat !== "wmts") {
          this.tileDetails = this.getTileCoordinates(
            this.boundingBox,
            resolution,
          );

          const { tileXWest, tileXEast, tileYNorth, tileYSouth } =
            this.tileDetails;

          // Generate TileMatrix entries for each tile in range
          if (fileFormat === "png") {
            [baseURL] = pngDownloadLink.split("{");
          } else if (fileFormat === "tif") {
            // [baseURL] = this.layerDownloadLinks[layerID];
            [baseURL] = tiffDownloadLink.split("{"); // test using tiff url from map config
          } else if (fileFormat === "gpkg") {
            [baseURL] = gpkgDownloadLink.split(this.tileMatrixSet);
          }
          for (let x = tileXWest; x <= tileXEast; x += 1) {
            for (let y = tileYNorth; y <= tileYSouth; y += 1) {
              // Update --  retrieving png from map config
              const resourceURL = `${baseURL}${this.tileMatrixSet}/${resolution}/${x}/${y}.${fileFormat}`;
              urls.push(resourceURL);
            }
          }
          const urlCount = urls.length;
          totalFileSize = urlCount * this.fileSizes[fileFormat];
        } else {
          // Instead of downloading the WMTS file, just provide the URL (below
          // the dropdowns)
          totalFileSize = wmtsDownloadLink;
        }

        // Update this.dataDownloadLinks - If the layerID in dataDownloadLinks
        // is not in the selectedLayerIDs list, remove it
        if (selectedLayerSelectBoxes.length > 1) {
          const selectedLayerIDs = Array.from(selectedLayerSelectBoxes).map(
            (checkbox) => checkbox.dataset.layerId,
          );
          Object.keys(this.dataDownloadLinks).forEach((downloadLink) => {
            if (!selectedLayerIDs.includes(downloadLink)) {
              delete this.dataDownloadLinks[downloadLink];
              // alert("Successfully deleted" + layerID);
            }
          });
        }
        // Store or update URLs for the given layerID
        this.dataDownloadLinks[layerID] = {
          urls, // URLs for the data
          fullDownloadLink, // Full download link
          pngDownloadLink, // PNG download link
          id, // Layer ID or any other unique identifier
          zoomLevel: resolution,
          baseURL: baseURL || null,
          layerName,
          fileType: fileFormat,
          fileSize: totalFileSize,
          metadataPid: metadataURL,
        };
        return totalFileSize;
      },

      /**
       * Converts an array of geographic points into a polygon representation.
       * The input array is reversed, and the first point is appended to the end
       * to close the polygon.
       * @param {object[]} jsonData - An array of objects representing
       * geographic points. Each object should have `longitude` and `latitude`
       * properties.
       * @returns {number[][]} An array of arrays representing the polygon.
       */
      getPolygon(jsonData) {
        // this.jsonData = this.points.toJSON();
        const polygon = jsonData
          .reverse()
          .map((i) => [i.longitude, i.latitude]);
        polygon.push([jsonData[0].longitude, jsonData[0].latitude]);
        // Return a polygon
        return polygon;
      },

      /**
       * Calculates the bounding box of a given polygon.
       * @param {number[][]} polygon - An array of points representing the
       * polygon, where each point is an array of two numbers [longitude,
       * latitude].
       * @returns {object} An object representing the bounding box with the
       * following properties:
       *   - {number} west - The minimum longitude (x-coordinate).
       *   - {number} south - The minimum latitude (y-coordinate).
       *   - {number} east - The maximum longitude (x-coordinate).
       *   - {number} north - The maximum latitude (y-coordinate).
       */
      getBoundingBox(polygon) {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        // Iterate through each point in the polygon to find min/max coordinates
        polygon.forEach((point) => {
          const [longitude, latitude] = point;
          if (longitude < minX) minX = longitude;
          if (latitude < minY) minY = latitude;
          if (longitude > maxX) maxX = longitude;
          if (latitude > maxY) maxY = latitude;
        });
        // Return the bounding box as an object
        return {
          west: minX,
          south: minY,
          east: maxX,
          north: maxY,
        };
      },

      /**
       * Converts geographic coordinates (longitude and latitude) into tile
       * coordinates for a given zoom level, based on the WGS1984Quad tiling
       * scheme.
       * @param {number} lon - The longitude in degrees, ranging from -180 to
       * 180.
       * @param {number} lat - The latitude in degrees, ranging from -90 to 90.
       * @param {number} zoom - The zoom level, where higher values represent
       * greater detail.
       * @returns {{x: number, y: number, z: number}} An object containing the
       * tile coordinates:
       *   - `x`: The horizontal tile index.
       *   - `y`: The vertical tile index (inverted for WGS84).
       *   - `z`: The zoom level.
       */
      tileFromLatLon(lon, lat, zoom) {
        const resolution = 180 / 2 ** zoom; // WGS1984Quad uses 180° range
        const x = Math.floor((lon + 180) / resolution);
        const y = Math.floor((90 - lat) / resolution); // Y is inverted for WGS84
        return { x, y, z: zoom };
      },

      /**
       * Calculates the tile coordinates for a given bounding box and zoom
       * level.
       * @param {object} boundingBox - The geographical bounding box.
       * @param {number} boundingBox.west - The western longitude
       * @param {number} boundingBox.east - The eastern longitude
       * @param {number} boundingBox.south - The southern latitude
       * @param {number} boundingBox.north - The northern latitude
       * @param {number} zoomLevel - The zoom level for which to calculate the
       * tile coordinates.
       * @returns {object} An object containing the zoom level and the tile
       * coordinates:
       * - `zoom`: The zoom level.
       * - `tileXWest`: The tile column for the western edge.
       * - `tileXEast`: The tile column for the eastern edge.
       * - `tileYSouth`: The tile row for the southern edge.
       * - `tileYNorth`: The tile row for the northern edge.
       */
      getTileCoordinates(boundingBox, zoomLevel) {
        const { west } = boundingBox;
        const { east } = boundingBox;
        const { south } = boundingBox;
        const { north } = boundingBox;

        // Get tiles for each edge of the bounding box
        const tileXWest = this.tileFromLatLon(
          west,
          (north + south) / 2,
          zoomLevel,
        ); // West edge
        const tileXEast = this.tileFromLatLon(
          east,
          (north + south) / 2,
          zoomLevel,
        ); // East edge
        const tileYNorth = this.tileFromLatLon(
          (west + east) / 2,
          north,
          zoomLevel,
        ); // North edge
        const tileYSouth = this.tileFromLatLon(
          (west + east) / 2,
          south,
          zoomLevel,
        ); // South edge;

        // Return TileMatrix (zoom level) and TileCol, TileRow
        return {
          zoom: zoomLevel,
          tileXWest: tileXWest.x, // or choose one of the calculated tileX values based on your needs
          tileYSouth: tileYSouth.y, // or choose one of the calculated tileY values based on your needs
          tileXEast: tileXEast.x, // or choose one of the calculated tileX values based on your needs
          tileYNorth: tileYNorth.y, // or choose one of the calculated tileY values based on your needs
        };
      },

      /**
       * Downloads data for each layer specified in `dataDownloadLinks` and
       * provides progress updates. This function iterates through the
       * `dataDownloadLinks` object, retrieves data for each layer, and
       * generates a ZIP file for download. It updates a progress bar to reflect
       * the download status and handles errors or cases where no data is
       * available.
       * @returns {Promise} Resolves when all data layers have been processed.
       * @property {object} dataDownloadLinks - An object containing data layer
       * information.
       * @property {string} dataDownloadLinks.layerID - The unique identifier
       * for the data layer.
       * @property {object} dataDownloadLinks.data - Metadata for the data
       * layer.
       * @property {string[]} dataDownloadLinks.data.urls - Array of URLs to
       * retrieve data from.
       * @property {string} dataDownloadLinks.data.baseURL - Base URL for the
       * data layer.
       * @property {string} dataDownloadLinks.data.fileType - The file type of
       * the data (e.g., "zip").
       * @property {number} dataDownloadLinks.data.fileSize - The size of the
       * data file in bytes.
       * @property {string} dataDownloadLinks.data.layerName - The name of the
       * data layer.
       * @property {string} dataDownloadLinks.data.metadataPid - The metadata
       * pid of the data layer.
       */
      async downloadData() {
        const view = this;
        // Loop through each layerID in dataDownloadLinks and process them
        // individually
        Object.entries(this.dataDownloadLinks).forEach(
          async ([layerID, data]) => {
            // WMTS files - provide a service url instead of a download
            if (data.fileType === "wmts") {
              return;
            }

            // If file size is approximately over a GB then do not download
            if (data.fileSize >= view.downloadSizeLimit) {
              const maxSizeGB = `${(view.downloadSizeLimit / 1e9).toFixed(2)} GB`;
              view.updateStatusBar({
                error: true,
                message: `File size for ${data.layerName} > the max download size, ${maxSizeGB}. Select lower resolution/ draw smaller AOI.`,
              });
              return;
            }

            // If no URL for the layers, nothing to download
            if (!data.urls?.length) {
              view.updateStatusBar({
                error: true,
                message:
                  "No data available for selected data layer(s) within area of interest.",
              });
              return;
            }

            // Show the progress bar for the current layer
            const updateStatusBar = (progress) => {
              view.updateStatusBar({
                progress,
                message: `Downloading data for ${data.layerName} (${progress}%)`,
              });
            };
            // Start progress tracking
            updateStatusBar(0);

            try {
              const layerZip = await view.retrieveDataFromURL(
                layerID,
                data.urls,
                data.baseURL,
                data.fileType,
                (progress) => {
                  // Progress tracking callback function
                  updateStatusBar(progress);
                },
              );

              // Stop if no data
              if (!Object.keys(layerZip.files).length) {
                view.updateStatusBar({
                  message:
                    "No data available for selected data layer(s) within area of interest.",
                  error: true,
                });
                return;
              }

              const numFiles = Object.keys(layerZip.files).length;
              view.updateStatusBar({
                message: `Generating ZIP file for ${data.layerName} (${numFiles} files)...`,
              });

              if (data.metadataPid) {
                const metadataUrl = `${this.objectServiceUrl}${data.metadataPid}`;
                fetch(metadataUrl)
                  .then((response) => {
                    if (!response.ok) {
                      throw new Error(
                        `Failed to fetch metadata for ${layerID}: ${response.statusText}`,
                      );
                    }
                    return response.blob();
                  })
                  .then((metadataBlob) => {
                    layerZip.file(`${layerID}_metadata.xml`, metadataBlob);
                  })
                  .catch((error) => {
                    let message = `Error fetching metadata for ${layerID}`;
                    if (error.message) {
                      message += `: ${error.message}`;
                    }

                    view.updateStatusBar({
                      error: true,
                      message,
                    });
                  })
                  .finally(() => {
                    // Always generate the ZIP, regardless of metadata result
                    layerZip.generateAsync({ type: "blob" }).then((zipBlob) => {
                      view.updateStatusBar({
                        message: "Download Complete!",
                        progress: 100,
                      });
                      const link = document.createElement("a");
                      link.href = URL.createObjectURL(zipBlob);
                      link.download = `${layerID}_${data.fileType}_zoom-level-${data.zoomLevel}.zip`;
                      link.click();
                    });
                  });
              } else {
                // No metadata to fetch, just generate the ZIP
                layerZip.generateAsync({ type: "blob" }).then((zipBlob) => {
                  view.updateStatusBar({
                    message: "Download Complete!",
                    progress: 100,
                  });
                  const link = document.createElement("a");
                  link.href = URL.createObjectURL(zipBlob);
                  link.download = `${layerID}_${data.fileType}_zoom-level-${data.zoomLevel}.zip`;
                  link.click();
                });
              }
            } catch (error) {
              let message =
                "Failed to download data files for selected data layer(s) within area of interest. ";
              if (error.message) {
                message += error.message;
              }

              view.updateStatusBar({
                message,
                error: true,
              });
            }
          },
        );
      },

      /**
       * Updates the status bar with a message, progress, and visibility
       * options.
       * @param {object} options - The options for updating the status bar.
       * @param {string} [options.message] - The message to display in the
       * status bar.
       * @param {number|null} [options.progress] - The progress percentage
       * (0-100) to display. Ignored if a message is provided.
       * @param {boolean} [options.show] - Whether to show or hide the status
       * bar.
       * @param {boolean} [options.error] - Whether the status bar should
       * indicate an error state.
       */
      updateStatusBar({
        message = "",
        progress = null,
        show = true,
        error = false,
      }) {
        const view = this;
        const { downloadStatusContainer, progressBar } = view;

        if (show) {
          downloadStatusContainer.style.display = "block";
        } else {
          downloadStatusContainer.style.display = "none";
          return;
        }

        if (error) {
          progressBar.classList.remove("progress-bar");
          progressBar.classList.add("progress-bar-no-data");
        } else {
          progressBar.classList.remove("progress-bar-no-data");
          progressBar.classList.add("progress-bar");
        }

        if (typeof progress === "number") {
          progressBar.style.width = `${progress}%`;
          if (progress > 0) {
            progressBar.textContent = `Progress: ${progress}%`;
          } else {
            progressBar.textContent = "";
          }
          progressBar.classList.remove("progress-bar-no-data");
          progressBar.classList.add("progress-bar");
        } else {
          progressBar.style.width = "100%";
        }

        if (message) {
          progressBar.textContent = message;
        }
      },

      /**
       * Retrieves data from a list of URLs, processes the data, and packages it
       * into a ZIP file.
       * @param {string} layerID - The identifier for the layer being processed.
       * @param {string[]} urls - An array of URLs to fetch data from.
       * @param {string} baseURL - The base URL used to sanitize and structure
       * file paths.
       * @param {string} fileType - The type of file being processed (e.g.,
       * "wmts").
       * @param {function(number): void} [onProgress] - Optional callback
       * function to report download progress as a percentage.
       * @returns {Promise<JSZip>} A promise that resolves to a JSZip instance
       * containing the downloaded files.
       * @throws {Error} If there is an issue with fetching or processing the
       * data.
       */
      async retrieveDataFromURL(layerID, urls, baseURL, fileType, onProgress) {
        // Initialize JSZip
        const zip = new JSZip();

        // Create an array of promises
        const fetchPromises = urls.map(async (url) => {
          const response = await fetch(url);
          if (!response.ok) {
            if (response.status === 404) {
              // We can safely skip 404 errors because we don't expect all URLs
              // to be valid
              return null;
            }
            // Other errors should be handled
            throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
          }

          const contentLength = response.headers.get("Content-Length");
          const totalBytes = contentLength ? parseInt(contentLength, 10) : null;
          let loadedBytes = 0;

          const reader = response.body.getReader();
          const chunks = [];

          let done = false;
          while (!done) {
            // Streaming must be sequential, so we await each chunk.
            // eslint-disable-next-line no-await-in-loop
            const { done: isDone, value } = await reader.read();
            done = isDone;
            if (value) {
              chunks.push(value);
              loadedBytes += value.length;

              if (onProgress && totalBytes) {
                const progress = Math.floor((loadedBytes / totalBytes) * 100);
                onProgress(progress); // Update progress
              }
            }
          }

          const blob = new Blob(chunks);
          const urlParts = url.split(baseURL).filter((part) => part !== "");
          // Sanitize URL to avoid unwanted folder hierarchy issues
          const sanitizedUrl = url.replace(/[:/?&=]/g, "_");
          const fileName =
            fileType === "wmts"
              ? `${layerID}/${sanitizedUrl}`
              : `${urlParts.slice(-3).join("_")}`;

          return { fileName, blob };
        });

        // Wait for all fetches to complete
        const results = await Promise.all(fetchPromises);

        // Add files to zip
        results.forEach((result) => {
          if (result) {
            zip.file(result.fileName, result.blob);
          }
        });

        return zip;
      },
    },
  );

  return DownloadPanelView;
});
