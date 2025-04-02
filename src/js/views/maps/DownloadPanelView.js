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
  /**
   * @class DownloadPanelView
   * @classdesc The DownloadPanelView allows a user to draw an arbitrary polygon on
   * the map. The polygon is stored in a GeoPoints collection and displayed on
   * the map using a connected CesiumVectorData model.
   * @classcategory Views/Maps
   * @name DownloadPanelView
   * @augments Backbone.View
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
      className: "draw__tool-panel",

      /**
       * Class to use for the buttons
       * @type {string}
       */
      // buttonClass: "map-view__button",
      buttonClass: "draw__button ",

      /**
       * Class to use for the active button
       * @type {string}
       */
      // buttonClassActive: "map-view__button--active",
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
          label: "Download",
          icon: "download-alt",
          method: "save",
        },
      ],

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
       * The file size for tiled data in geotiff format
       * (in KB).
       * @type {number}
       */
      fileSizes: {
        tif: 513,
        png: 2.7,
        wmts: 15,
      },

      /**
       * The array that store the list of URLs for each data layer
       * that is selected for partial download.
       * @type {Array}
       */
      dataDownloadLinks: {},

      /**
       * The classes of the sub-elements that combined to create the download panel view.
       */
      classes: {
        toolbarLink: ".toolbar__links",
        toolbarLinkActive: "toolbar__link--active",
        toolbarContentActive: "toolbar__content--active",
        drawPanel: ".draw__tool-panel",
        downloadPanel: ".download-panel",
        layerItemPanel: "download-expansion-panel",
        layerItemPanelToggle: "download-expansion-panel__toggle",
        layerItemCheckbox: "download-expansion-panel__checkbox",
        layerItemTitle: "download-expansion-panel__title",
        layerItemContent: "download-expansion-panel__content",
        dropdownWrapper: "downloads-dropdown-wrapper",
        dropdown: "downloads-dropdown",
        dropdownContainer: "downloads-dropdown-container",
        fileSizeBox: "downloads-textbox",
      },

      displayOptions: {
        invisible: "hidden",
        visible: "",
      },

      zoomLevels: {
        0: "156543.03 m/px",
        1: "78271.52 m/px",
        2: "39135.76 m/px",
        3: "19567,88 m/px",
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

      // fileTypeOptions: {
      //   tif: "Geotiff",
      //   png: "PNG",
      //   wmts: "WMTS file",
      // },

      resolutionDropdownOptions: {
        resolutionDropdownLabel: "Resolution",
        resolutionDropdownDefaultValue: "",
        resolutionDropdownDefaultText: "Select Resolution",
      },

      fileTypeDropdownOptions: {
        fileTypeDropdownLabel: "File Format",
        fileTypeDropdownDefaultValue: "",
        fileTypeDropdownDefaultText: "Select File Type",
      },

      /**
       * The download links for all the tiled datasets
       * key: layer ID
       * value 0: geotiff link
       * value 1: wmts link
       */

      layerDownloadLinks: {
        iwp: [
          "https://arcticdata.io/data/10.18739/A2KW57K57/iwp_geotiff_high/WGS1984Quad/",
          "https://arcticdata.io/data/tiles/10.18739/A2KW57K57/WMTSCapabilities.xml",
        ], // iwp
        infrastructure: [
          "https://arcticdata.io/data/10.18739/A21J97929/output/geotiff/WGS1984Quad/",
          "https://arcticdata.io/data/tiles/10.18739/A21J97929/WMTSCapabilities.xml",
        ], // infrastructure
        swi: [
          null,
          "https://arcticdata.io/data/tiles/10.18739/A2037V/WMTSCapabilities.xml",
        ], // surface water
        dlbns1419: [
          null,
          "https://arcticdata.io/data/tiles/10.18739/A2K35MF71/WMTSCapabilities.xml",
        ], // drained lake basins
        avg: [
          null,
          "https://arcticdata.io/data/tiles/10.3334/ORNLDAAC/2377/WMTSCapabilities.xml",
        ], // average Terrestrial Net CO2 Balance
        fire: [
          null,
          "https://arcticdata.io/data/tiles/10.3334/ORNLDAAC/2377/WMTSCapabilities.xml",
        ], // average Fire Emissions
        trend: [
          null,
          "https://arcticdata.io/data/tiles/10.3334/ORNLDAAC/2377/WMTSCapabilities.xml",
        ], // trends In Terrestrial Net CO2 Balance
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
       * @param {CesiumWidgetView} options.cesiumWidgetView
       * @param {string} [options.mode=false] - The initial mode of the draw
       * tool.
       */

      initialize(options) {
        this.mapModel = options.model || new Map();
        this.objectServiceUrl = MetacatUI.appModel.get("objectServiceUrl");
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
      setUpMapModel() {
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
        this.setMode(false);
        this.clearPoints();
        this.removeClickListeners();

        document.querySelector(".download-data-list__panel").textContent =
          "Draw Area of Interest: Single-click to add vertices, double-click to complete.";

        document.querySelector(".download-data-list").innerHTML = "";
        this.resetButtonStyles();
        const drawButtonEl = this.buttonEls.drawButton;
        const clearButtonEl = this.buttonEls.clearButton;
        const saveButtonEl = this.buttonEls.saveButton;
        drawButtonEl.classList.remove(this.buttonClassDisable);
        clearButtonEl.classList.add(this.buttonClassDisable);
        saveButtonEl.classList.add(this.buttonClassDisable);
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
       * Show an error message to the user if the map model is not available
       * or any other error occurs.
       * @param {string} [message] - The error message to show to the user.
       */
      showError(message) {
        const str =
          `<i class="icon-warning-sign icon-left"></i>` +
          `<span> The draw tool is not available. ${message}</span>`;
        this.el.innerHTML = str;
      },

      /**
       * Toggles the mode of the draw tool.
       * @param {string} mode - The mode to toggle to.
       */
      toggleMode(mode) {
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
      setMode(mode) {
        if (this.mode === mode) return;
        this.mode = mode;
        if (mode) {
          if (!this.listeningForClicks) this.setClickListeners();
          this.activateButton(mode);
        } else {
          // this.resetButtonStyles();
          this.removeClickListeners();
        }
      },

      /**
       * Sets the style of the button with the given name to indicate that it is
       * active.
       * @param {string} buttonName - The name of the button to activate.
       */
      activateButton(buttonName) {
        const buttonEl = this.buttonEls[`${buttonName}Button`];
        if (!buttonEl) return;
        // this.resetButtonStyles();
        buttonEl.classList.add(this.buttonClassActive);
      },

      /**
       * Resets the styles of all of the buttons to indicate that they are not
       * active.
       */
      resetButtonStyles() {
        // Iterate through the buttonEls object and reset the styles
        Object.keys(this.buttonEls).forEach((button) => {
          if (Object.prototype.hasOwnProperty.call(this.buttonEls, button)) {
            const buttonEl = this.buttonEls[button];
            buttonEl.classList.remove(this.buttonClassActive);
          }
        });
      },

      /**
       * Removes the click listeners from the map model and sets the
       * clickFeatureAction back to its original value.
       */
      removeClickListeners() {
        const handler = this.clickHandler;
        const { originalAction } = this;
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
      setClickListeners() {
        const view = this;
        const handler = new Backbone.Model();
        this.clickHandler = handler;
        const { interactions } = this;
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

        // added by Shirly - listed to changes in previousAction
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
        // alert("Rendering draw toolbar");
        const view = this;
        const { el } = this;
        const drawContainer = this.el.querySelector(".draw-tool");
        if (!drawContainer) return;
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
          button.addEventListener("click", () => {
            const { method } = options;
            if (method) view[method]();
            else view.toggleMode(options.name);
          });
          if (!view.buttonEls) view.buttonEls = {};
          view.buttonEls[`${options.name}Button`] = button;
          el.appendChild(button);
        });
        const saveButtonEl = this.buttonEls.saveButton;
        const clearButtonEl = this.buttonEls.clearButton;

        saveButtonEl.classList.add(this.buttonClassDisable);
        clearButtonEl.classList.add(this.buttonClassDisable);
        // view.activateButton("draw"); // Removing as we only want the button to have the active symbol (blue circle border) upon user clicking it

        view.generatePreviewPanel();
        const closeDownloadPanelButton = this.el.querySelector(
          ".download-panel-close__button",
        );
        closeDownloadPanelButton.addEventListener("click", () => {
          view.close();
        });
      },

      close() {
        const toolbarLinks = document.querySelector(this.classes.toolbarLink);
        const sectionEl = toolbarLinks.children[3]; // TO DO: this is a temporary fix. This should use the HTML class/element ID instead of an index
        sectionEl.classList.remove(this.classes.toolbarLinkActive); // Change the toolbar link to inactive
        sectionEl.classList.remove(this.classes.toolbarContentActive);
        this.reset();
        const drawPanel = document.querySelector(this.classes.drawPanel);
        const downloadPanel = document.querySelector(
          this.classes.downloadPanel,
        );
        drawPanel.style.visibility = this.displayOptions.invisible; // this needs to be moved to CSS
        downloadPanel.style.visibility = this.displayOptions.invisible; // this needs to be moved to CSS
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

        // // Get all elements with class 'layer-item--shown' within 'layer-category-list'
        // const selectedLayerItems = document.querySelectorAll(
        //   ".layer-category-list .layer-item--shown",
        // );
        // // Extract titles from nested span elements
        // const titles = Array.from(selectedLayerItems)
        //   .map((item) => {
        //     const titleSpan = item.querySelector(".layer-item__label-text");
        //     return titleSpan ? titleSpan.textContent.trim() : null;
        //   })
        //   .filter(Boolean); // Remove nulls in case of missing title spans

        /**
         * Get the selected layers from the Layer Panel View and retreive the following information
         * layerID - layer identifier
         * downloadLink - the link for accesssing dataset that is tiled
         * layerName - full name of the layer
         * fullDownloadLink - download link for the entire dataset
         */
        let selectedLayersList = [];

        // alert("Display layer list");
        // console.log(this.mapModel.get("allLayers"));

        this.mapModel.get("allLayers").forEach((value) => {
          // if(value?.attributes?.originalVisibility === true && value.attributes.type === "WebMapTileServiceImageryProvider") {
          if (
            value.attributes?.visible === true &&
            value.attributes.type === "WebMapTileServiceImageryProvider" &&
            value.attributes.label !== "Alaska High Resolution Imagery"
          ) {
            let wmtsDownloadLink;
            if (
              this.layerDownloadLinks[value.attributes.layerId] &&
              this.layerDownloadLinks[value.attributes.layerId].length > 1
            ) {
              [, wmtsDownloadLink] =
                this.layerDownloadLinks[value.attributes.layerId] || [];
            } else {
              wmtsDownloadLink = null; // the production PDG demo config has layers that currently do not have WMTS layers
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
              pngDownloadLink: value.attributes.cesiumOptions.url,
              wmtsDownloadLink,
              metadataPid: value.attributes.metadataPid,
            };
            selectedLayersList.push(selectedLayer);
          }
        });
        /** Remove duplicate layers */
        selectedLayersList = selectedLayersList.filter(
          (layer, index, self) =>
            index === self.findIndex((l) => l.layerID === layer.layerID),
        );
        /** Create download tool panel */
        const panel = document.querySelector(this.classes.downloadPanel);
        const toolbarContainer = document.querySelector(
          this.classes.toolbarLinkActive,
        );
        const downloadDataPanel = document.querySelector(".download-data-list");

        if (panel && toolbarContainer) {
          toolbarContainer.appendChild(panel); // Move panel into .toolbar__all-content
        }

        if (downloadDataPanel) {
          this.resetButtonStyles();
          this.drawButtonEl.classList.add(this.buttonClassDisable);
          this.clearButtonEl.classList.remove(this.buttonClassDisable);
          view.activateButton("clear");

          if (!selectedLayersList.length) {
            // Update the text of download-data-list__panel
            document.querySelector(".download-data-list__panel").textContent =
              "No layers are available for download. Select layers of interest in the Layer Panel before drawing an area of interest. (Note: After selections are made in the Layer Panel clear current area of interest before drawing a new one.)";
            view.resetButtonStyles();
            // saveButtonEl.disabled = true;
            this.drawButtonEl.classList.add(this.buttonClassDisable);
            this.clearButtonEl.classList.remove(this.buttonClassDisable);
            view.activateButton("clear");
          } else {
            // Loop through selected data layers
            selectedLayersList.forEach((item) => {
              const fileTypeOptions = {
                tif: "Geotiff",
                png: "PNG",
                wmts: "WMTS file",
              };

              // Create panel container for each layer that intersects the bounding box
              const downloadDataPanelContainer = document.createElement("div");
              downloadDataPanelContainer.classList.add(
                this.classes.layerItemPanel,
              );
              const layerItem = document.createElement("div");
              layerItem.classList.add(this.classes.layerItemPanelToggle);

              // Create checkbox that allows user to select the layer
              const layerItemSelectBox = document.createElement("input");
              layerItemSelectBox.type = "checkbox";
              layerItemSelectBox.classList.add(this.classes.layerItemCheckbox);

              // Attach layer attributes to the checkbox
              layerItemSelectBox.dataset.layerId = item.layerID;
              layerItemSelectBox.dataset.downloadLink = item.downloadLink;
              layerItemSelectBox.dataset.layerName = item.layerName;
              layerItemSelectBox.dataset.fullDownloadLink =
                item.fullDownloadLink;
              layerItemSelectBox.dataset.pngDownloadLink = item.pngDownloadLink;
              layerItemSelectBox.dataset.id = item.ID;
              layerItemSelectBox.dataset.wmtsDownloadLink =
                item.wmtsDownloadLink;
              layerItemSelectBox.dataset.metadataPid = item.metadataPid;

              const layerItemSpan = document.createElement("span");
              layerItemSpan.classList.add(this.classes.layerItemTitle);
              layerItemSpan.textContent = item.layerName;

              layerItem.appendChild(layerItemSelectBox);
              layerItem.appendChild(layerItemSpan);

              const layerItemSelectContent = document.createElement("div");
              layerItemSelectContent.classList.add(
                this.classes.layerItemContent,
              );

              // Create the "Resolution" dropdown
              const resolutionDropdownWrapper = document.createElement("div");
              resolutionDropdownWrapper.classList.add(
                this.classes.dropdownWrapper,
              );
              const resolutionLabel = document.createElement("label");
              resolutionLabel.textContent =
                this.resolutionDropdownOptions.resolutionDropdownLabel;

              const resolutionDropdown = document.createElement("select");
              resolutionDropdown.classList.add(this.classes.dropdown);

              // Add a default select option
              const defaultResolutionOption = document.createElement("option");
              defaultResolutionOption.value =
                this.resolutionDropdownOptions.resolutionDropdownDefaultValue;
              defaultResolutionOption.textContent =
                this.resolutionDropdownOptions.resolutionDropdownDefaultText;
              defaultResolutionOption.disabled = true; // Make it non-selectable
              defaultResolutionOption.selected = true; // Make it the default selection
              resolutionDropdown.appendChild(defaultResolutionOption);

              Object.entries(this.zoomLevels).forEach(
                ([zoomLevel, pixelResolution]) => {
                  const option = document.createElement("option");
                  option.value = zoomLevel;
                  // option.textContent = `Zoom level ${zoomLevel} - ${pixelResolution}`;
                  option.textContent = `${zoomLevel} - ${pixelResolution}`;
                  resolutionDropdown.appendChild(option);
                },
              );

              resolutionDropdownWrapper.appendChild(resolutionLabel);
              resolutionDropdownWrapper.appendChild(resolutionDropdown);

              // Create the "File Type" dropdown
              const fileTypeDropdownWrapper = document.createElement("div");
              fileTypeDropdownWrapper.classList.add(
                this.classes.dropdownWrapper,
              );
              const fileTypeLabel = document.createElement("label");
              fileTypeLabel.textContent =
                this.fileTypeDropdownOptions.fileTypeDropdownLabel;

              const fileTypeDropdown = document.createElement("select");
              fileTypeDropdown.classList.add(this.classes.dropdown);

              // Check if all first values in layerDownloadLinks are null
              const hasValidTifLinkForLayer =
                this.layerDownloadLinks[item.layerID]?.[0] !== null;
              // Remove 'tif' key if no valid Geotiff links exist
              if (!hasValidTifLinkForLayer) {
                delete fileTypeOptions.tif;
              }

              // Add a default select option
              const defaultFileTypeOption = document.createElement("option");
              defaultFileTypeOption.value =
                this.fileTypeDropdownOptions.fileTypeDropdownDefaultValue;
              defaultFileTypeOption.textContent =
                this.fileTypeDropdownOptions.fileTypeDropdownDefaultText;
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

              // Add event listener to toggle expansion panel visibility
              layerItemSelectBox.addEventListener("change", () => {
                if (layerItemSelectBox.checked) {
                  downloadDataPanelContainer.classList.add("show-content"); // Open panel when checkbox is checked
                  layerItemSelectContent.style.display = "block";
                } else {
                  downloadDataPanelContainer.classList.remove("show-content"); // Close panel when checkbox is unchecked
                  layerItemSelectContent.style.display = "none";
                  // Reset resolution dropdown to the default value
                  resolutionDropdown.value =
                    this.resolutionDropdownOptions.resolutionDropdownDefaultValue;

                  // Disable fileTypeDropdown if necessary
                  fileTypeDropdown.disabled = true;
                }
                view.layerSelection(
                  this.saveButtonEl,
                  this.buttonClassDisable,
                  layerItemSelectBox.dataset.layerId,
                ); // Update Save button state
              });

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

              // Update approximate file size when a file type is selected in fileTypeDropdown
              fileTypeDropdown.addEventListener("change", () => {
                const fileSize = view.getRawFileSize(
                  resolutionDropdown.value,
                  fileTypeDropdown.value,
                  layerItemSelectBox.dataset.layerId,
                  layerItemSelectBox.dataset.fullDownloadLink,
                  layerItemSelectBox.dataset.pngDownloadLink,
                  layerItemSelectBox.dataset.id,
                  layerItemSelectBox.dataset.layerName,
                  layerItemSelectBox.dataset.wmtsDownloadLink,
                  layerItemSelectBox.dataset.metadataPid,
                );
                view.updateTextbox(
                  fileSizeInfoBox,
                  fileSize,
                  fileTypeDropdown.value,
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
              "Select products below and click 'Download'. Access full downloads (including original shapefiles) in the Layers panel above. ";

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

            // Create the text element to show the current downloading layer
            const downloadingText = document.createElement("div");
            downloadingText.classList.add(this.classes.fileSizeBox);
            downloadingText.style.marginTop = "2px"; // Add some spacing between progress bar and text

            downloadStatusContainer.appendChild(progressBar);
            downloadStatusContainer.appendChild(downloadingText);
            dataListPanel.appendChild(downloadStatusContainer);

            // Add the provided method as a click event listener

            this.saveButtonEl.addEventListener("click", () => {
              view.downloadData();
            });
          }
        }
      },

      /**
       * Handles the selection of map layers and updates the state of the save button
       * and other UI elements based on whether any checkboxes are checked.
       * @param {HTMLElement} saveButtonEl - The save button element to enable or disable.
       * @param {string} buttonClassDisable - The CSS class name used to disable the save button.
       * @param {string} layerID - The ID of the map layer being interacted with.
       */
      layerSelection(saveButtonEl, buttonClassDisable, layerID) {
        const view = this;
        const checkboxes = document.querySelectorAll(
          ".download-expansion-panel__checkbox",
        );
        const isAnyChecked = Array.from(checkboxes).some(
          (checkbox) => checkbox.checked,
        );
        if (isAnyChecked) {
          saveButtonEl.classList.remove(buttonClassDisable);
          view.activateButton("save");
          view.activateButton("clear");
        } else {
          view.resetButtonStyles();
          saveButtonEl.classList.add(buttonClassDisable);
          view.activateButton("clear");
        }
        if (layerID in view.dataDownloadLinks) {
          delete view.dataDownloadLinks[layerID];
          // alert("Deleted download links for " + layerID);
        }
      },

      /**
       * Updates the text content of the provided info box with file size details
       * and file type information.
       * @param {HTMLElement} infoBox - The HTML element where the file size information will be displayed.
       * @param {number} fileSizeDetails - The size of the file in kilobytes (KB).
       * @param {string} fileType - The type of the file (e.g., "wmts").
       */
      updateTextbox(infoBox, fileSizeDetails, fileType) {
        const fileSizeInfoBox = infoBox;
        if (fileType === "wmts") {
          fileSizeInfoBox.textContent = `Single WMTS file ≈ ${fileSizeDetails} KB`;
        } else {
          fileSizeInfoBox.textContent = `Download file size ≤ ${(fileSizeDetails / 1000).toFixed(2)} MB`;
        }
      },

      /**
       * Calculates the total file size for a given map layer based on the file type, zoom level, and bounding box.
       * Generates URLs for individual tiles or retrieves a single download link for the layer.
       * Updates the `dataDownloadLinks` object with the generated URLs and metadata for the specified layer.
       * @param {number} zoomLevel - The zoom level for the map tiles.
       * @param {string} fileType - The type of file to download (e.g., "png", "tif", "wmts").
       * @param {string} layerID - The unique identifier for the data layer.
       * @param {string} fullDownloadLink - The full download link for the layer.
       * @param {string} pngDownloadLink - The template URL for downloading PNG tiles.
       * @param {string} id - A unique identifier for the layer or dataset.
       * @param {string} layerName - The name of the data layer.
       * @param {string} [_wmtsDownloadLink] - (Optional) The WMTS download link for the layer. Currently unused.
       * * @param {string} metadataPid - The metadataPid of the data layer.
       * @returns {number} The total file size for the specified layer in bytes.
       */
      getRawFileSize(
        zoomLevel,
        fileType,
        layerID,
        fullDownloadLink,
        pngDownloadLink,
        id,
        layerName,
        _wmtsDownloadLink, // TODO: Leading underscore indicates that this parameter is not used. Remove if it is later used in this function.
        metadataPid,
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
        if (fileType !== "wmts") {
          this.tileDetails = this.getTileCoordinates(
            this.boundingBox,
            zoomLevel,
          );

          const { tileXWest, tileXEast, tileYNorth, tileYSouth } =
            this.tileDetails;

          // Generate TileMatrix entries for each tile in range
          if (fileType === "png") {
            [baseURL] = pngDownloadLink.split("{");
          } else if (fileType === "tif") {
            [baseURL] = this.layerDownloadLinks[layerID];
          }

          for (let x = tileXWest; x <= tileXEast; x += 1) {
            for (let y = tileYNorth; y <= tileYSouth; y += 1) {
              // pngDownloadLink = "https://arcticdata.io/data/tiles/10.18739/A2KW57K57/WGS1984Quad/{TileMatrix}/{TileCol}/{TileRow}.png"

              const resourceURL = `${baseURL}${zoomLevel}/${x}/${y}.${fileType}`;
              urls.push(resourceURL);
            }
          }
          const urlCount = urls.length;
          totalFileSize = urlCount * this.fileSizes[fileType];
        } else {
          urls.push(this.layerDownloadLinks[layerID][1]);
          totalFileSize = this.fileSizes[fileType];
        }

        // Update this.dataDownloadLinks
        // If the layerID in dataDownloadLinks is not in the selectedLayerIDs list, remove it
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
          baseURL: baseURL || null,
          layerName,
          fileType,
          fileSize: totalFileSize,
          metadataPid: metadataPid,
        };
        return totalFileSize;
      },

      /**
       * Converts an array of geographic points into a polygon representation.
       * The input array is reversed, and the first point is appended to the end
       * to close the polygon.
       * @param {object[]} jsonData - An array of objects representing geographic points.
       * Each object should have `longitude` and `latitude` properties.
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
          // console.log("Get point coordinates");
          // console.log(point[0]);
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
       * Converts geographic coordinates (longitude and latitude) into tile coordinates
       * for a given zoom level, based on the WGS1984Quad tiling scheme.
       * @param {number} lon - The longitude in degrees, ranging from -180 to 180.
       * @param {number} lat - The latitude in degrees, ranging from -90 to 90.
       * @param {number} zoom - The zoom level, where higher values represent greater detail.
       * @returns {{x: number, y: number, z: number}} An object containing the tile coordinates:
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
       * * @property {string} dataDownloadLinks.data.metadataPid - The metadata pid of the
       * data layer.
       */
      async downloadData() {
        const view = this;
        const downloadStatusContainer = document.querySelector(
          ".download-status-container",
        );
        // Loop through each layerID in dataDownloadLinks and process them individually
        Object.entries(this.dataDownloadLinks).forEach(
          async ([layerID, data]) => {
            // Show the progress bar for the current layer
            downloadStatusContainer.style.display = "block"; // Show progress container
            // Reset progress bar for each new layer
            const progressBar = document.querySelector(".progress-bar");
            progressBar.classList.remove("progress-bar-no-data");
            progressBar.classList.add("progress-bar");
            progressBar.style.width = "0%";
            if (data.fileSize < 1050000) {
              // If file size is approximately over a GB then do not download
              if (data.urls && data.urls.length > 0) {
                // Show the progress bar for the current layer
                // downloadStatusContainer.style.display = "block"; // Show progress container

                // Reset progress bar for each new layer
                // const progressBar = document.querySelector(".progress-bar");
                // progressBar.classList.remove("progress-bar-no-data");
                // progressBar.classList.add("progress-bar");
                progressBar.style.width = "0%";
                progressBar.textContent = `Retrieving data for ${data.layerName} (0%)`;

                // Create a function to update the progress bar
                const updateProgressBar = (progress) => {
                  progressBar.style.width = `${progress}%`;
                  progressBar.textContent = `Downloading data for ${data.layerName} (${progress}%)`;
                };

                // Start progress tracking
                updateProgressBar(0);

                try {
                  const layerZip = await view.retrieveDataFromURL(
                    layerID,
                    data.urls,
                    data.baseURL,
                    data.fileType,
                    (progress) => {
                      // Progress tracking callback function
                      updateProgressBar(progress);
                    },
                  );

                  if (Object.keys(layerZip.files).length > 0) {
                    const numFiles = Object.keys(layerZip.files).length;
                    progressBar.textContent = `Generating ZIP file for ${data.layerName} (${numFiles} files)...`;

                    // Fetch metadata file from metadataPid and add it to the ZIP
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
                        // Add metadata file at the top level of the ZIP
                        layerZip.file(`${layerID}_metadata.eml`, metadataBlob);
                      })
                      .catch((error) => {
                        console.error(
                          "Error fetching metadata for ${layerID}:",
                          error,
                        );
                      })
                      .finally(() => {
                        // Generate the ZIP file for this layerID after adding metadata
                        layerZip
                          .generateAsync({ type: "blob" })
                          .then((zipBlob) => {
                            progressBar.style.width = "100%";
                            progressBar.textContent = "Download Complete!";

                            // Create a download link for the ZIP file
                            const link = document.createElement("a");
                            link.href = URL.createObjectURL(zipBlob);
                            link.download = `${layerID}.zip`;
                            link.click();
                          });
                      });
                  } else {
                    progressBar.classList.remove("progress-bar");
                    progressBar.classList.add("progress-bar-no-data");
                    progressBar.style.width = "100%";
                    progressBar.textContent = `No data files are available for selected data layer(s) within area of interest.`;
                  }
                } catch (error) {
                  progressBar.classList.remove("progress-bar");
                  progressBar.classList.add("progress-bar-no-data");
                  progressBar.style.width = "100%";
                  progressBar.textContent = `Failed to download data files for selected data layer(s) within area of interest.`;
                }
              } else {
                progressBar.classList.remove("progress-bar");
                progressBar.classList.add("progress-bar-no-data");
                progressBar.style.width = "100%";
                progressBar.textContent = `No data available for selected data layer(s) within area of interest.`;
              }
            } else {
              progressBar.classList.remove("progress-bar");
              progressBar.classList.add("progress-bar-no-data");
              progressBar.style.width = "100%";
              progressBar.textContent = `File size for ${data.layerName} > 1 GB. Select lower resolution/ draw smaller AOI.`;
            }
          },
        );
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
              // We can safely skip 404 errors because we don't expect all
              // URLs to be valid
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
              : `${layerID}/WGS1984Quad/${urlParts.slice(-3).join("_")}`;

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

      // /**
      //  * Clears the polygon that is being drawn
      //  */
      // onClose: function () {

      //   this.removeLayer();
      //   this.removeClickListeners();
      // },
    },
  );

  return DownloadPanelView;
});
