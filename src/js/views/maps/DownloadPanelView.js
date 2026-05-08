"use strict";

define([
  "underscore",
  "backbone",
  "jszip",
  "common/Utilities",
  "text!templates/maps/download-panel.html",
  "models/connectors/GeoPoints-CesiumPolygon",
  "models/connectors/GeoPoints-CesiumPoints",
  "collections/maps/GeoPoints",
  "views/maps/LayerDownloadView",
], (
  _,
  Backbone,
  JSZip,
  Utilities,
  Template,
  GeoPointsVectorData,
  GeoPointsCesiumPoints,
  GeoPoints,
  LayerDownloadView,
) => {
  // Classes used in the view
  const CLASS_NAMES = {
    // Block
    block: "download-panel",
    // Header elements
    header: "download-panel__header",
    titleGroup: "download-panel__title-group",
    title: "download-panel__title",
    closeButton: "download-panel__close-button",
    // Body elements
    instructions: "download-panel__instructions",
    dataList: "download-panel__data-list",
    // Draw tool block
    drawTool: "draw-tool",
    // Draw toolbar buttons
    button: "draw-tool__button",
    buttonActive: "draw-tool__button--active",
    buttonDisable: "draw-tool__button--disable",
    // Draw toolbar button internals
    buttonIconWrap: "draw-tool__button-icon-wrap",
    buttonIconWrapDisabled: "draw-tool__button-icon-wrap--disabled",
    buttonLabel: "draw-tool__button-label",
    // Shared toolbar classes (used for coordinating with ToolbarView)
    toolbarLink: "toolbar__links",
    toolbarLinkActive: "toolbar__link--active",
    toolbarContentActive: "toolbar__content--active",
    // Info box states (used in updateTextbox)
    error: "error",
    informationWmts: "layer-download__information--wmts",
    wmtsText: "layer-download__wmts-text",
    copyIcon: "layer-download__copy-icon",
    // Progress bar (created in initializeDownloadPanel)
    progressContainer: "download-panel__progress-container",
    progressBar: "download-panel__progress-bar",
    progressBarNoData: "download-panel__progress-bar--no-data",
  };

  const MESSAGES = {
    // Plain strings
    downloadComplete: "Download Complete!",
    downloadFailed:
      "Failed to download data files for selected data layer(s) within area of interest. ",
    drawInstructions:
      "Draw Area of Interest: Single-click to add vertices, double-click to complete.",
    noDataAvailable:
      "No data available for selected data layer(s) within area of interest.",
    noLayersAvailable:
      "No layers are available for download. Click on layers in the list above to make them visible on the Map and available for download. Only select layers have data products available for download.",
    noMapModel: "No map model was provided.",
    selectProducts:
      "Select products below and click the download button. To download full datasets (including original shapefiles) please use the Layers panel above. ",
    wmtsComment: "Use WMTS for accessing large data volume or re-draw AOI",
    // Functions
    downloading: (layerName, progress) =>
      `Downloading data for ${layerName} (${progress}%)`,
    downloadSizeTooLarge: (maxSize, comment) =>
      `Download size is too big ( > ${maxSize}). ${comment}.`,
    drawToolUnavailable: (detail) =>
      `The draw tool is not available. ${detail}`,
    estimatedFileSize: (size) =>
      `Estimated download file size is \u2264 ${size}.`,
    fileSizeExceedsLimit: (layerName, maxSize) =>
      `File size for ${layerName} > the max download size, ${maxSize}. Select lower resolution/ draw smaller AOI.`,
    generatingZip: (layerName, numFiles) =>
      `Generating ZIP file for ${layerName} (${numFiles} files)...`,
    metadataError: (layerID) => `Error fetching metadata for ${layerID}`,
    metadataFetchFailed: (layerID, statusText) =>
      `Failed to fetch metadata for ${layerID}: ${statusText}`,
    progress: (pct) => `Progress: ${pct}%`,
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
      className: CLASS_NAMES.block,

      /**
       * The maximum size of the download in bytes. If download is estimated to exceed
       * this size, the download will be blocked.
       * @type {number}
       */
      downloadSizeLimit: 1000000000, // 1 GB

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
        events[`click .${CN.closeButton}`] = "close";
        events[`click .${CN.copyIcon}`] = "handleCopyIconClick";
        return events;
      },

      /**
       * The buttons that have been rendered in the toolbar. Formatted as an
       * object with the button name as the key and the button element as the
       * value. Initialized in initialize() to avoid shared state across
       * instances.
       * @type {object}
       */
      buttonEls: undefined,

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
       * The estimated file size per tile for each format, in bytes.
       * @type {object}
       */
      fileSizes: {
        tif: 525312, // ~513 KiB per tile
        png: 2765, // ~2.7 KiB per tile
        wmts: 15360, // ~15 KiB per tile
        gpkg: 184320, // ~180 KiB per tile
      },

      /**
       * The array that store the list of URLs for each data layer that is
       * selected for partial download. Initialized in initialize() to avoid
       * shared state across instances.
       * @type {object}
       */
      dataDownloadLinks: undefined,

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
        this.dataDownloadLinks = {};
        this.buttonEls = {};
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
        this.clearPoints();
        this.removeClickListeners();

        this.instructionsEl.textContent = MESSAGES.drawInstructions;

        if (this.layerDownloadViews) {
          this.layerDownloadViews.forEach((ldv) => ldv.remove());
          this.layerDownloadViews = [];
        }
        this.dataDownloadLinks = {};
        this.dataListEl.innerHTML = "";
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
        // Clean up any previously rendered child views before rebuilding the
        // DOM, so their event listeners and references are properly torn down.
        if (this.layerDownloadViews) {
          this.layerDownloadViews.forEach((ldv) => ldv.remove());
          this.layerDownloadViews = [];
        }
        this.buttonEls = {};

        // Insert the template into the view
        if (!this.mapModel) {
          this.showError(MESSAGES.noMapModel);
          return this;
        }
        this.$el.html(this.template());
        this.instructionsEl = this.el.querySelector(
          `.${CLASS_NAMES.instructions}`,
        );
        this.dataListEl = this.el.querySelector(`.${CLASS_NAMES.dataList}`);
        this.drawToolEl = this.el.querySelector(`.${CLASS_NAMES.drawTool}`);

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
          `<span> ${MESSAGES.drawToolUnavailable(message)}</span>`;
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
       * Handles a click on the copy icon in the WMTS info box. Copies the WMTS
       * URL text to the clipboard and briefly shows a confirmation message.
       * @param {Event} event - The click event.
       */
      handleCopyIconClick(event) {
        const informationEl = event.currentTarget.closest(
          `.${CLASS_NAMES.informationWmts}`,
        );
        if (!informationEl) return;
        const wmtsText = informationEl.querySelector(
          `.${CLASS_NAMES.wmtsText}`,
        );
        if (!wmtsText) return;
        const text = wmtsText.textContent;
        navigator.clipboard
          .writeText(text)
          .then(() => {
            wmtsText.textContent = "Copied to clipboard!";
            setTimeout(() => {
              wmtsText.textContent = text;
            }, 2000);
          })
          .catch(() => {
            wmtsText.textContent = "Copy failed!";
            setTimeout(() => {
              wmtsText.textContent = text;
            }, 2000);
          });
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
          this.setButtonStatus("draw", "active");
        } else {
          // Turn off drawing mode
          this.draw = false;
          this.removeClickListeners();
          this.setButtonStatus("draw", offStatus);
        }
      },

      /**
       * Sets the status of the button to either "enabled", "deactivated", or
       * "active".
       * @param {string} name - The name of the button to set the status for.
       * @param {"enabled"|"deactivated"|"active"} status - The status to set
       * the button to.
       */
      setButtonStatus(name, status) {
        const buttonEl = this.buttonEls[`${name}Button`];
        if (!buttonEl || buttonEl.dataset.status === status) return;
        const iconWrapEl = buttonEl.querySelector(
          `.${CLASS_NAMES.buttonIconWrap}`,
        );

        // Reset all button styles - default to enabled
        buttonEl.classList.remove(CLASS_NAMES.buttonActive);
        buttonEl.classList.remove(CLASS_NAMES.buttonDisable);
        if (iconWrapEl) {
          iconWrapEl.classList.remove(CLASS_NAMES.buttonIconWrapDisabled);
        }
        buttonEl.dataset.status = status;

        if (status === "deactivated") {
          buttonEl.classList.add(CLASS_NAMES.buttonDisable);
          if (iconWrapEl) {
            iconWrapEl.classList.add(CLASS_NAMES.buttonIconWrapDisabled);
          }
        } else if (status === "active") {
          buttonEl.classList.add(CLASS_NAMES.buttonActive);
        }

        // Special case for the draw button, which sets the draw mode
        if (name === "draw") {
          const turnOnDraw = status === "active";
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
        const view = this;
        if (!this.drawToolEl) return;
        // Create the buttons
        view.buttons.forEach((options) => {
          const button = document.createElement("button");
          button.className = CLASS_NAMES.button;
          button.innerHTML = `
              <span class="${CLASS_NAMES.buttonIconWrap}">
                <i class="icon icon-${options.icon}"></i>
              </span> 
              <span class="${CLASS_NAMES.buttonLabel}">${options.label}</span> `;
          button.dataset.name = options.name;
          view.buttonEls[`${options.name}Button`] = button;
          this.drawToolEl.appendChild(button);
        });

        // Set the buttons to the default state
        this.setButtonStatuses({
          draw: "enabled",
          clear: "deactivated",
          save: "deactivated",
        });

        view.generatePreviewPanel();
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
              )?.endpoint;
            } else {
              wmtsDownloadLink = null;
            }
            // Get PNG download link from map config
            let pngDownloadLink;
            if (value.attributes && Array.isArray(value.attributes.services)) {
              pngDownloadLink = value.attributes.services.find(
                (service) => service.type === "png",
              )?.endpoint;
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
        if (!this.dataListEl) return;

        // Clean up tracked view instances from the previous render.
        if (this.layerDownloadViews) {
          this.layerDownloadViews.forEach((ldv) => ldv.remove());
        }
        this.dataListEl.innerHTML = "";
        this.layerDownloadViews = [];

        // If there is no polygon on the map, quit here.
        if (!this.points.length) return;

        this.setButtonStatuses({
          draw: "deactivated",
          clear: "enabled",
          save: "deactivated",
        });

        if (!selectedLayersList.length) {
          // Update the text of download-panel__instructions
          this.instructionsEl.textContent = MESSAGES.noLayersAvailable;
          view.setButtonStatuses({
            save: "deactivated",
            draw: "deactivated",
            clear: "enabled",
          });
        } else {
          // Loop through selected data layers
          selectedLayersList.forEach((item) => {
            // Create a LayerDownloadView for this layer's controls
            const layerDownloadView = new LayerDownloadView({
              item,
              downloadPanelView: view,
            });

            layerDownloadView.render();
            this.dataListEl.appendChild(layerDownloadView.el);

            // When the resolution is changed, the previously calculated
            // download link for this layer is no longer valid.
            view.listenTo(
              layerDownloadView,
              "download:invalidated",
              (layerID) => {
                delete view.dataDownloadLinks[layerID];
              },
            );

            view.layerDownloadViews.push(layerDownloadView);
          });
          // Update the text of download-panel__instructions
          this.instructionsEl.textContent = MESSAGES.selectProducts;

          // Progress Bar
          // Create the download status bar container
          const progressContainerEl = document.createElement("div");
          progressContainerEl.classList.add(CLASS_NAMES.progressContainer);
          progressContainerEl.style.display = "none"; // Hidden by default

          // Create the progress bar element
          const progressBarEl = document.createElement("div");
          progressBarEl.classList.add(CLASS_NAMES.progressBar);
          progressBarEl.style.width = "0%"; // Initial width
          progressBarEl.textContent = "0%"; // Initial text

          progressContainerEl.appendChild(progressBarEl);
          this.instructionsEl.appendChild(progressContainerEl);

          // Save reference to the progress bar and related elements for
          // updating later.
          view.progressContainerEl = progressContainerEl;
          view.progressBarEl = progressBarEl;
        }
      },

      /**
       * Handles the selection of map layers and updates the state of the save
       * button and other UI elements based on whether any checkboxes are
       * checked.
       */
      layerSelection() {
        const view = this;
        const isAnyChecked = view.layerDownloadViews.some(
          (ldv) => ldv.isSelected,
        );
        const isAnyFileTypeSelected = view.layerDownloadViews.some(
          (ldv) =>
            ldv.isSelected &&
            ["png", "tif", "gpkg"].includes(ldv.selectedFileType),
        );

        if (isAnyChecked && isAnyFileTypeSelected) {
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

        view.layerDownloadViews
          .filter((ldv) => !ldv.isSelected)
          .forEach((ldv) => {
            delete view.dataDownloadLinks[ldv.item.layerID];
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
        const isAnyFileTypeSelected = view.layerDownloadViews.some(
          (ldv) =>
            ldv.isSelected &&
            ["png", "tif", "gpkg"].includes(ldv.selectedFileType),
        );
        if (!isAnyFileTypeSelected) {
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
        }
      },

      /**
       * Updates the text content of the provided info box with file size
       * details and file type information.
       * @param {HTMLElement} infoBox - The HTML element where the file size
       * information will be displayed.
       * @param {number|null} fileSizeDetails - The estimated size of the file
       * in bytes, or null for WMTS layers.
       * @param {string} fileType - The type of the file (e.g., "wmts").
       * @param {string} layerID - The ID of the map layer being interacted
       * with.
       */
      updateTextbox(infoBox, fileSizeDetails, fileType, layerID) {
        const fileSizeInfoBox = infoBox;
        if (!fileSizeInfoBox) return;
        fileSizeInfoBox.classList.remove(CLASS_NAMES.error);
        fileSizeInfoBox.classList.remove(CLASS_NAMES.informationWmts);
        if (fileType === "wmts") {
          const wmtsUrl = this.dataDownloadLinks[layerID]?.wmtsUrl ?? "";
          fileSizeInfoBox.innerHTML = `
            <span class="${CLASS_NAMES.wmtsText}">${wmtsUrl}</span>
            <i class="${CLASS_NAMES.copyIcon} icon-copy" title="Copy to Clipboard"></i>
          `;
          fileSizeInfoBox.classList.add(CLASS_NAMES.informationWmts);
        } else {
          const maxSize = Utilities.bytesToSize(this.downloadSizeLimit, 2);
          if (fileSizeDetails > this.downloadSizeLimit) {
            fileSizeInfoBox.textContent = MESSAGES.downloadSizeTooLarge(
              maxSize,
              MESSAGES.wmtsComment,
            );
            fileSizeInfoBox.classList.add(CLASS_NAMES.error);
          } else {
            fileSizeInfoBox.textContent = MESSAGES.estimatedFileSize(
              Utilities.bytesToSize(fileSizeDetails, 2),
            );
          }
        }

        // fileSize is always numeric or null, so this comparison is safe for
        // all file types including WMTS (null > limit is false).
        if (this.dataDownloadLinks[layerID]?.fileSize > this.downloadSizeLimit) {
          // Instead of disabling the Download button for large file sizes simply
          // remove the layer from the the download list variable (i.e.,
          // dataDownloadLinks)
          delete this.dataDownloadLinks[layerID];
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
       * @returns {number} The estimated total file size for the specified layer
       * in bytes.
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
          // WMTS: no tile download, just surface the service URL to the user.
          // fileSize remains undefined; wmtsUrl is stored separately.
          totalFileSize = null;
        }

        // Sync dataDownloadLinks: remove entries for layers no longer selected.
        const selectedLayerIDs = (this.layerDownloadViews || [])
          .filter((ldv) => ldv.isSelected)
          .map((ldv) => ldv.item.layerID);
        if (selectedLayerIDs.length > 1) {
          Object.keys(this.dataDownloadLinks).forEach((downloadLink) => {
            if (!selectedLayerIDs.includes(downloadLink)) {
              delete this.dataDownloadLinks[downloadLink];
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
          // fileSize is always a byte count (number) or null
          fileSize: totalFileSize,
          wmtsUrl: fileFormat === "wmts" ? wmtsDownloadLink : null,
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
        const reversed = [...jsonData].reverse();
        const polygon = reversed.map((i) => [i.longitude, i.latitude]);
        polygon.push([reversed[0].longitude, reversed[0].latitude]);
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
       * @property {number|null} dataDownloadLinks.data.fileSize - The size of
       * the data file in bytes, or null for WMTS layers.
       * @property {string|null} dataDownloadLinks.data.wmtsUrl - The WMTS
       * service URL for the layer, or null for non-WMTS layers.
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
              const maxSize = Utilities.bytesToSize(view.downloadSizeLimit, 2);
              view.updateStatusBar({
                error: true,
                message: MESSAGES.fileSizeExceedsLimit(data.layerName, maxSize),
              });
              return;
            }

            // If no URL for the layers, nothing to download
            if (!data.urls?.length) {
              view.updateStatusBar({
                error: true,
                message: MESSAGES.noDataAvailable,
              });
              return;
            }

            // Show the progress bar for the current layer
            const updateStatusBar = (progress) => {
              view.updateStatusBar({
                progress,
                message: MESSAGES.downloading(data.layerName, progress),
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
                  message: MESSAGES.noDataAvailable,
                  error: true,
                });
                return;
              }

              const numFiles = Object.keys(layerZip.files).length;
              view.updateStatusBar({
                message: MESSAGES.generatingZip(data.layerName, numFiles),
              });

              if (data.metadataPid) {
                const metadataUrl = `${this.objectServiceUrl}${data.metadataPid}`;
                fetch(metadataUrl)
                  .then((response) => {
                    if (!response.ok) {
                      throw new Error(
                        MESSAGES.metadataFetchFailed(
                          layerID,
                          response.statusText,
                        ),
                      );
                    }
                    return response.blob();
                  })
                  .then((metadataBlob) => {
                    layerZip.file(`${layerID}_metadata.xml`, metadataBlob);
                  })
                  .catch((error) => {
                    let message = MESSAGES.metadataError(layerID);
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
                        message: MESSAGES.downloadComplete,
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
                    message: MESSAGES.downloadComplete,
                    progress: 100,
                  });
                  const link = document.createElement("a");
                  link.href = URL.createObjectURL(zipBlob);
                  link.download = `${layerID}_${data.fileType}_zoom-level-${data.zoomLevel}.zip`;
                  link.click();
                });
              }
            } catch (error) {
              let message = MESSAGES.downloadFailed;
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
        const { progressContainerEl, progressBarEl } = view;

        if (show) {
          progressContainerEl.style.display = "block";
        } else {
          progressContainerEl.style.display = "none";
          return;
        }

        if (error) {
          progressBarEl.classList.remove(CLASS_NAMES.progressBar);
          progressBarEl.classList.add(CLASS_NAMES.progressBarNoData);
        } else {
          progressBarEl.classList.remove(CLASS_NAMES.progressBarNoData);
          progressBarEl.classList.add(CLASS_NAMES.progressBar);
        }

        if (typeof progress === "number") {
          progressBarEl.style.width = `${progress}%`;
          if (progress > 0) {
            progressBarEl.textContent = MESSAGES.progress(progress);
          } else {
            progressBarEl.textContent = "";
          }
          progressBarEl.classList.remove(CLASS_NAMES.progressBarNoData);
          progressBarEl.classList.add(CLASS_NAMES.progressBar);
        } else {
          progressBarEl.style.width = "100%";
        }

        if (message) {
          progressBarEl.textContent = message;
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
