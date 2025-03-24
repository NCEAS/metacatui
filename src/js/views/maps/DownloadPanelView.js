"use strict";

define([
  "backbone",
  "collections/jszip",
  "text!templates/maps/download-panel.html",
  "models/connectors/GeoPoints-CesiumPolygon",
  "models/connectors/GeoPoints-CesiumPoints",
  "collections/maps/GeoPoints",
], (
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
          label: "Download",
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

      fileTypeOptions: {
        tif: "Geotiff", 
        png: "PNG", 
        wmts: "WMTS file",
      },

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

      geotiffDownloadLinks: {
        A2KW57K57: "https://arcticdata.io/data/10.18739/A2KW57K57/iwp_geotiff_high/WGS1984Quad/", // iwp
        A21J97929: "https://arcticdata.io/data/10.18739/A21J97929/output/geotiff/WGS1984Quad/", // infrastructure
      },
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

        document.querySelector(".download-data-list__panel").textContent = 
          "Draw Area of Interest: Single-click to add vertices, double-click to complete.";
    
        document.querySelector(".download-data-list").innerHTML = "";
        this.resetButtonStyles();
        const drawButtonEl = this.buttonEls["draw" + "Button"];
        const clearButtonEl = this.buttonEls["clear" + "Button"];
        const saveButtonEl = this.buttonEls["save" + "Button"];
        drawButtonEl.classList.remove(this.buttonClassDisable);
        clearButtonEl.classList.add(this.buttonClassDisable);
        saveButtonEl.classList.add(this.buttonClassDisable);
        view.activateButton("draw");
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
          // this.resetButtonStyles();
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
        // this.resetButtonStyles();
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
              view.generatePreviewPanel();
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
        // alert("Rendering draw toolbar");
        const view = this;
        const el = this.el;
        const drawContainer = this.el.querySelector(".draw-tool");
        if (!drawContainer) {
          console.error("Error: .draw__tool-panel container not found");
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
        const saveButtonEl = this.buttonEls["save" + "Button"];
        const clearButtonEl = this.buttonEls["clear" + "Button"];
        saveButtonEl.classList.add(this.buttonClassDisable);
        clearButtonEl.classList.add(this.buttonClassDisable);
        view.activateButton("draw")
        
        view.generatePreviewPanel;    
        const closeDownloadPanelButton = this.el.querySelector('.download-panel-close__button');  
        closeDownloadPanelButton.addEventListener('click', function() {
          view.close();
        });
      },
      

      close() {
        const toolbarLinks = document.querySelector(this.classes.toolbarLink);
        const sectionEl = toolbarLinks.children[2];
        sectionEl.classList.remove(this.classes.toolbarLinkActive); // Change the toolbar link to inactive
        sectionEl.classList.remove(this.classes.toolbarContentActive);
        this.reset();
        const drawPanel = document.querySelector(this.classes.drawPanel); 
        const downloadPanel = document.querySelector(this.classes.downloadPanel);  
        drawPanel.style.visibility = this.displayOptions.invisible; // this needs to be moved to CSS
        downloadPanel.style.visibility = this.displayOptions.invisible ; // this needs to be moved to CSS
      },

      generatePreviewPanel() {
        const view = this;
        const jsonData = this.points.toJSON();
        var selectedResolution;
        var selectedFileFormat;
        this.clearButtonEl = this.buttonEls["clear" + "Button"];
        this.clearButtonEl.classList.remove(this.buttonClassDisable);

        // Get all elements with class 'layer-item--shown' within 'layer-category-list'
        const selectedLayerItems = document.querySelectorAll(".layer-category-list .layer-item--shown");
        // Extract titles from nested span elements
        const titles = Array.from(selectedLayerItems).map(item => {
            const titleSpan = item.querySelector(".layer-item__label-text");
            return titleSpan ? titleSpan.textContent.trim() : null;
          }).filter(Boolean); // Remove nulls in case of missing title spans

        /** Get the selected layers from the Layer Panel View and retreive the following information
         * layerID - layer identifier
         * downloadLink - the link for accesssing dataset that is tiled
         * layerName - full name of the layer
         * fullDownloadLink - download link for the entire dataset
         */
        let selectedLayersList = [];  
        const layerList = this.mapModel.attributes.allLayers._byId; // Retrieve to get layer details
        // alert("Display layer list");
        // console.log(layerList);
        
        Object.entries(layerList).forEach(([key, value]) => {
          // if(value?.attributes?.originalVisibility === true && value.attributes.type === "WebMapTileServiceImageryProvider") {
          if(titles.includes(value?.attributes?.label) && value.attributes.type === "WebMapTileServiceImageryProvider") {
          let selectedLayer = {
            "layerID": value.attributes.layerId ,
            "ID": value.attributes.id ? value.attributes.id.split("/").pop() : null,
            "downloadLink": value.attributes.downloadLink ,
            "layerName": value.attributes.label ,
            "fullDownloadLink": value.attributes.moreInfoLink,
            "pngDownloadLink":  value.attributes.cesiumOptions.url,
          };
          selectedLayersList.push(selectedLayer); 
        } });
         /** Remove duplicate layers */
        selectedLayersList = selectedLayersList.filter((layer, index, self) =>
          index === self.findIndex(l => l.layerID === layer.layerID)
        );
        
        /** Create download tool panel */
        const panel = document.querySelector(this.classes.downloadPanel);
        const toolbarContainer = document.querySelector(this.classes.toolbarLinkActive);
        const downloadDataPanel = document.querySelector('.download-data-list');
        const closeDownloadPanelButton = document.querySelector('.download-panel-close__button');  
        closeDownloadPanelButton.addEventListener('click', function() {
          view.close();
        });
        // this.saveButtonEl = this.buttonEls["save" + "Button"];
        // this.drawButtonEl = this.buttonEls["draw" + "Button"];
        
        if (panel && toolbarContainer) {
          toolbarContainer.appendChild(panel); // Move panel into .toolbar__all-content
        }

        if (downloadDataPanel) {
           // TESTING the new button
           this.resetButtonStyles();
           this.saveButtonEl = this.buttonEls["save" + "Button"];
           this.drawButtonEl = this.buttonEls["draw" + "Button"];
        
           this.drawButtonEl.classList.add(this.buttonClassDisable);
          //  saveButtonEl.classList.add(this.buttonClassDisable);
           this.clearButtonEl.classList.remove(this.buttonClassDisable);
           view.activateButton("clear")

          if (!selectedLayersList.length) {
          // Update the text of download-data-list__panel
          document.querySelector(".download-data-list__panel").textContent = 
          "No layers are available for download. Select layers of interest in the Layer Panel before drawing an area of interest. (Note: After selections are made in the Layer Panel clear current area of interest before drawing a new one.)";
          view.resetButtonStyles();
          // saveButtonEl.disabled = true; 
          this.drawButtonEl.classList.add(this.buttonClassDisable);
          this.classList.add(this.buttonClassDisable);
          view.activateButton("clear")
          }
          
          else {
            function layerSelection(saveButtonEl, buttonClassDisable) {
              const checkboxes = document.querySelectorAll(".download-expansion-panel__checkbox");
              const isAnyChecked = Array.from(checkboxes).some(checkbox => checkbox.checked);
              if(isAnyChecked)
              {
                saveButtonEl.classList.remove(buttonClassDisable);
                view.activateButton("save");
                view.activateButton("clear");
              }
              else{
                alert("Adding disable");
                view.resetButtonStyles();
                saveButtonEl.classList.add(buttonClassDisable);
                view.activateButton("clear");
              }
            }
            
          
            // Loop through selected data layers     
            selectedLayersList.forEach(item => {
            
            // Create panel container for each layer that intersects the bounding box
            const downloadDataPanelContainer = document.createElement("div");
            downloadDataPanelContainer.classList.add(this.classes.layerItemPanel);
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
            layerItemSelectBox.dataset.fullDownloadLink = item.fullDownloadLink;
            layerItemSelectBox.dataset.pngDownloadLink = item.pngDownloadLink;
            layerItemSelectBox.dataset.id = item.ID;

            const layerItemSpan = document.createElement("span");
            layerItemSpan.classList.add(this.classes.layerItemTitle);
            layerItemSpan.textContent = item.layerName; // TO DO - edit to remove special characters
            
            layerItem.appendChild(layerItemSelectBox);
            layerItem.appendChild(layerItemSpan);
            
            const layerItemSelectContent = document.createElement("div");
            layerItemSelectContent.classList.add(this.classes.layerItemContent);
          
            // Create the "Resolution" dropdown
            const resolutionDropdownWrapper = document.createElement("div");
            resolutionDropdownWrapper.classList.add(this.classes.dropdownWrapper);
            const resolutionLabel = document.createElement("label");
            resolutionLabel.textContent = this.resolutionDropdownOptions.resolutionDropdownLabel;

            const resolutionDropdown = document.createElement("select");
            resolutionDropdown.classList.add(this.classes.dropdown);  
            
            // Add a default select option
            const defaultResolutionOption = document.createElement("option");
            defaultResolutionOption.value = this.resolutionDropdownOptions.resolutionDropdownDefaultValue; 
            defaultResolutionOption.textContent = this.resolutionDropdownOptions.resolutionDropdownDefaultText; 
            defaultResolutionOption.disabled = true;  // Make it non-selectable
            defaultResolutionOption.selected = true;  // Make it the default selection
            resolutionDropdown.appendChild(defaultResolutionOption);

            Object.entries(this.zoomLevels).forEach(([zoomLevel, pixelResolution]) => {
              const option = document.createElement("option");
              option.value = zoomLevel; 
              // option.textContent = `Zoom level ${zoomLevel} - ${pixelResolution}`;
              option.textContent = `${zoomLevel} - ${pixelResolution}`;
              resolutionDropdown.appendChild(option);
              });
           
            resolutionDropdownWrapper.appendChild(resolutionLabel);
            resolutionDropdownWrapper.appendChild(resolutionDropdown);

            // Create the "File Type" dropdown
            const fileTypeDropdownWrapper = document.createElement("div");
            fileTypeDropdownWrapper.classList.add(this.classes.dropdownWrapper);
            const fileTypeLabel = document.createElement("label");
            fileTypeLabel.textContent = this.fileTypeDropdownOptions.fileTypeDropdownLabel;

            const fileTypeDropdown = document.createElement("select");
            fileTypeDropdown.classList.add(this.classes.dropdown);  

            // Add a default select option
            const defaultFileTypeOption = document.createElement("option");
            defaultFileTypeOption.value = this.fileTypeDropdownOptions.fileTypeDropdownDefaultValue; 
            defaultFileTypeOption.textContent = this.fileTypeDropdownOptions.fileTypeDropdownDefaultText; 
            defaultFileTypeOption.disabled = true;  // Make it non-selectable
            defaultFileTypeOption.selected = true;  // Make it the default selection
            fileTypeDropdown.appendChild(defaultFileTypeOption);

            Object.entries(this.fileTypeOptions).forEach(([fileType, fileTypeName]) => {
              const option = document.createElement("option");
              option.value = fileType; 
              option.textContent = fileTypeName;
              fileTypeDropdown.appendChild(option);
              });

            fileTypeDropdownWrapper.appendChild(fileTypeLabel);
            fileTypeDropdownWrapper.appendChild(fileTypeDropdown);
            fileTypeDropdown.disabled = true;  //initially setting it to true
            
            // Handle change event for "File Type" dropdown
            fileTypeDropdown.addEventListener("change", function() {
            selectedFileFormat = fileTypeDropdown.value;
            });

            fileTypeDropdown.disabled = true;  //initially setting it to true
            
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
                  resolutionDropdown.value = this.resolutionDropdownOptions.resolutionDropdownDefaultValue ; 
        
                  // Disable fileTypeDropdown if necessary
                  fileTypeDropdown.disabled = true; 
              }
              layerSelection(this.saveButtonEl, this.buttonClassDisable);  // Update Save button state
            });

            // Textbox to display file size
            const fileSizeInfoBox = document.createElement("label");
            fileSizeInfoBox.classList.add(this.classes.fileSizeBox);
            fileSizeInfoBox.textContent = "Select resolution and file format to download...";
            layerItemSelectContent.appendChild(fileSizeInfoBox);

            // Handle change event for "Resolution" dropdown
            resolutionDropdown.addEventListener("change", function() {
              selectedResolution = resolutionDropdown.value;
              if (selectedResolution !== "") {
                  fileTypeDropdown.disabled = false; // Enable the fileTypeDropdown
              }
              fileTypeDropdown.value = defaultFileTypeOption.value; 

            });

            // Update approximate file size when a file type is selected in fileTypeDropdown
            fileTypeDropdown.addEventListener("change", function() {
                const fileSize = view.getRawFileSize(resolutionDropdown.value, fileTypeDropdown.value, 
                                    layerItemSelectBox.dataset.layerId, layerItemSelectBox.dataset.fullDownloadLink, 
                                    layerItemSelectBox.dataset.pngDownloadLink, layerItemSelectBox.dataset.id, 
                                    layerItemSelectBox.dataset.layerName);
                updateTextbox(fileSize);
            });

            function updateTextbox(fileSizeDetails) {
                // alert(fileSizeDetails);
                fileSizeInfoBox.textContent = `Estimated file size: ${fileSizeDetails/1000} MB`;
            }

            // Append elements
            downloadDataPanelContainer.appendChild(layerItem);
            downloadDataPanelContainer.appendChild(layerItemSelectContent)
            downloadDataPanel.appendChild(downloadDataPanelContainer);

            // Toggle the expansion panel content on click
            layerItem.addEventListener("click", () => {
              downloadDataPanelContainer.classList.toggle("show-content");
            });

          
        });
            // Update the text of download-data-list__panel
            document.querySelector(".download-data-list__panel").textContent = 
            "Select products below and click 'Download'. Access full downloads (including original shapefiles) in the Layers panel above. ";

            //Progress Bar
            const dataListPanel = document.querySelector(".download-data-list__panel")
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
            
            this.saveButtonEl.addEventListener("click", function () {
              view.downloadData();
            });
            
         }

        }
      },

      getRawFileSize(zoomLevel, fileType, layerID, fullDownloadLink, pngDownloadLink, id, layerName){
        const layerSelectBoxes = document.querySelectorAll(".download-expansion-panel__checkbox");
        const selectedLayerSelectBoxes = Array.from(layerSelectBoxes).filter(checkbox => checkbox.checked);

        this.polygon = this.getPolygon(this.points.toJSON());
        this.boundingBox = this.getBoundingBox(this.polygon);
        let totalFileSize;
        if(fileType!= "wmts"){
        
          this.tileDetails = this.getTileCoordinates(this.boundingBox, zoomLevel);

          const tileXWest = this.tileDetails["tileX_West"];
          const tileXEast = this.tileDetails["tileX_East"];
          const tileYNorth = this.tileDetails["tileY_North"];
          const tileYSouth = this.tileDetails["tileY_South"];
          
          // Generate TileMatrix entries for each tile in range
          const urls = [];   
          let baseURL;
          if (fileType === 'png') {
            baseURL = pngDownloadLink.split('{')[0];
          } else if (fileType === 'tif') {
            baseURL = this.geotiffDownloadLinks[id];
          } 

          // let baseURL = pngDownloadLink.split('{')[0];
          for (let x = tileXWest; x <= tileXEast; x++) {
            for (let y = tileYNorth; y <= tileYSouth; y++) {
                // pngDownloadLink = "https://arcticdata.io/data/tiles/10.18739/A2KW57K57/WGS1984Quad/{TileMatrix}/{TileCol}/{TileRow}.png"
                
                let resourceURL = `${baseURL}${zoomLevel}/${x}/${y}.${fileType}`;
                urls.push(resourceURL);
                }}

          // Update this.dataDownloadLinks
          // If the layerID in dataDownloadLinks is not in the selectedLayerIDs list, remove it
          if (selectedLayerSelectBoxes.length > 1) {
            const selectedLayerIDs = Array.from(selectedLayerSelectBoxes).map(checkbox => checkbox.dataset.layerId);
                    Object.keys(this.dataDownloadLinks).forEach(layerID => {
                if (!selectedLayerIDs.includes(layerID)) {
                    delete this.dataDownloadLinks[layerID]; 
                }
            });
          }

          // Store or update URLs for the given layerID
          this.dataDownloadLinks [layerID] = {
                urls: urls,  // URLs for the data
                fullDownloadLink: fullDownloadLink, // Full download link
                pngDownloadLink: pngDownloadLink,  // PNG download link
                id: id,  // Layer ID or any other unique identifier
                baseURL: baseURL,
                layerName: layerName
          };
          const urlCount =  urls.length;
          // alert(fileType);
          // alert(this.fileSizes.tif);
          totalFileSize = urlCount * this.fileSizes[fileType];
        }
        else{totalFileSize = "Irrelevant - This is a single file";}

        return totalFileSize;

      },

         // Function to get Polygon from json
         getPolygon(jsonData) {
          // this.jsonData = this.points.toJSON();
          var polygon = jsonData.reverse().map(function(i){
            return [
              i.longitude,i.latitude,
            ];
          });
          polygon.push([
            jsonData[0].longitude,
            jsonData[0].latitude
          ]);
          // Return a polygon
          return polygon;
        },

        getBoundingBox(polygon) {
          let minX = Infinity, minY = Infinity;
          let maxX = -Infinity, maxY = -Infinity;

          // Iterate through each point in the polygon to find min/max coordinates
          polygon.forEach(point => {
            // console.log("Get point coordinates");
            // console.log(point[0]);
            if (point[0] < minX) minX = point[0];
            if (point[1] < minY) minY = point[1];
            if (point[0] > maxX) maxX = point[0];
            if (point[1] > maxY) maxY = point[1];
          });
          // Return the bounding box as an object
          return {
            west: minX,
            south: minY,
            east: maxX,
            north: maxY
          };
        },

        getTileCoordinates(boundingBox, zoomLevel) {
    
          var n = Math.pow(2, zoomLevel);
        
          const tileFromLatLon = (lon, lat, zoom) => {
          const resolution = 180 / Math.pow(2, zoom); // WGS1984Quad uses 180° range
          const x = Math.floor((lon + 180) / resolution);
          const y = Math.floor((90 - lat) / resolution); // Y is inverted for WGS84
                return { x, y, z: zoom };
          };

          const west = boundingBox.west;
          const east = boundingBox.east;
          const south = boundingBox.south;
          const north = boundingBox.north;

          // Get tiles for each edge of the bounding box
          const tileXWest = tileFromLatLon(west, (north + south) / 2, zoomLevel); // West edge
          const tileXEast = tileFromLatLon(east, (north + south) / 2, zoomLevel); // East edge
          const tileYNorth = tileFromLatLon((west + east) / 2, north, zoomLevel); // North edge
          const tileYSouth = tileFromLatLon((west + east) / 2, south, zoomLevel); // South edge;


          // Return TileMatrix (zoom level) and TileCol, TileRow
          return {
            zoom: zoomLevel,
            tileX_West: tileXWest.x,  // or choose one of the calculated tileX values based on your needs
            tileY_South: tileYSouth.y,   // or choose one of the calculated tileY values based on your needs
            tileX_East: tileXEast.x,  // or choose one of the calculated tileX values based on your needs
            tileY_North: tileYNorth.y   // or choose one of the calculated tileY values based on your needs
          };
        },

        // Function to handle submit button click
        async downloadData() {

           async function retrieveDataFromURL(layerID, urls, baseURL, onProgress) {
              //Fetch data files from URLs
              var zip = new JSZip();  // Initialize JSZip
              for (let i = 0; i < urls.length; i++) {
                const url = urls[i];
                try {
                  const response = await fetch(url);
                  if (!response.ok) {
                    // If the status code is 404 or other errors, skip or handle accordingly
                    if (response.status === 404) {
                      console.log(`URL not found: ${url}`);
                      return; // Skip processing for 404
                    } else {
                      console.error('Fetch error:', response.statusText);
                      continue;
                    }
                  }
                //   const blob = await response.blob();
                //   const urlParts = url.split(baseURL).filter(part => part !== ""); 
                //   const fileName = urlParts.slice(-3).join("_"); 
                  
                //   zip.file(fileName, blob);
                // } catch (error) {
                //   console.error(`Error fetching ${url}:`, error);
                // }

                const contentLength = response.headers.get('Content-Length');
                const totalBytes = contentLength ? parseInt(contentLength, 10) : null;
                let loadedBytes = 0;

                const reader = response.body.getReader();
                const chunks = [];

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
    
                    chunks.push(value);
                    loadedBytes += value.length;
    
                    if (onProgress && totalBytes) {
                        const progress = Math.floor((loadedBytes / totalBytes) * 100);
                        onProgress(progress);  // Update progress
                    }
                }

                const blob = new Blob(chunks);
                const urlParts = url.split(baseURL).filter(part => part !== ""); 
                const fileName = urlParts.slice(-3).join("_"); 

                zip.file(fileName, blob);
                } catch (error) {
                    console.error(`Error fetching ${url}:`, error);
                }
            
              }
              return zip;
           }

          const downloadStatusContainer = document.querySelector(".download-status-container");
          // Loop through each layerID in dataDownloadLinks and process them individually
          for (const [layerID, data] of Object.entries(this.dataDownloadLinks)) {
            
            if (data.urls && data.urls.length > 0) {
              // Show the progress bar for the current layer
              downloadStatusContainer.style.display = "block"; // Show progress container

              // Reset progress bar for each new layer
              const progressBar = document.querySelector(".progress-bar");
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
            const layerZip = await retrieveDataFromURL(
              layerID,
              data.urls,
              data.baseURL,
              (progress) => { // Progress tracking callback function
                  updateProgressBar(progress);
              }
            );

            if (Object.keys(layerZip.files).length > 0) {
                console.log(`The ZIP for layer ${data.layerName} contains ${Object.keys(layerZip.files).length} file(s). Ready to download.`);

                // Generate the ZIP file for this layerID
                layerZip.generateAsync({ type: "blob" }).then((zipBlob) => {
                    progressBar.style.width = "100%";
                    progressBar.textContent = "Download Complete!";

                    // Create a download link for the ZIP file
                    const link = document.createElement("a");
                    link.href = URL.createObjectURL(zipBlob);
                    link.download = `${layerID}.zip`;  
                    link.click();
                });
            } else {
                progressBar.textContent = `No data files are available for ${data.layerName} at the selected resolution.`;
                console.log(`No files were added for ${data.layerName}`);
            }

          } catch (error) {
              console.error(`Error downloading data files for ${data.layerName}:`, error);
              progressBar.textContent = `Failed to download ${data.layerName}.`;
          }
        
          } else {
              console.log(`No URLs available for ${data.layerName}`);
          }
        }
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
