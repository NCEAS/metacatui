"use strict";

define([
  "jquery",
  "underscore",
  "backbone",
  "models/maps/Map",
  "text!templates/maps/map.html",
  // SubViews
  "views/maps/MapWidgetContainerView",
  "views/maps/ToolbarView",
  "views/maps/FeatureInfoView",
  "views/maps/LayerDetailsView",
  "views/maps/VisualizationPanelView",
  // CSS
  `text!${MetacatUI.root}/css/map-view.css`,
], (
  $,
  _,
  Backbone,
  Map,
  Template,
  // SubViews
  MapWidgetContainerView,
  ToolbarView,
  FeatureInfoView,
  LayerDetailsView,
  VisualizationPanelView,
  // CSS
  MapCSS,
) => {
  const LOADING_INDICATOR_DELAY_MS = 500;

  const CLASS_NAMES = {
    loadingIndicator: "map-view__loading-indicator",
    loadingBar: "map-view__loading-bar",
    loadingMessage: "map-view__loading-message",
    loadingText: "map-view__loading-text",
    mapWidgetContainer: "map-view__map-widget-container",
    featureInfoContainer: "map-view__feature-info-container",
    toolbarContainer: "map-view__toolbar-container",
    layerDetailsContainer: "map-view__layer-details-container",
    portalIndicator: "map-view__portal",
  };

  /**
   * @class MapView
   * @classdesc An interactive 2D or 3D map that allows visualization of geo-spatial
   * data.
   * @classcategory Views/Maps
   * @name MapView
   * @augments Backbone.View
   * @screenshot views/maps/MapView.png
   * @since 2.18.0
   * @constructs
   */
  const MapView = Backbone.View.extend(
    /** @lends MapView.prototype */ {
      /**
       * The type of View this is
       * @type {string}
       */
      type: "MapView",

      /**
       * The HTML classes to use for this view's element
       * @type {string}
       */
      className: "map-view",

      /**
       * The model that this view uses
       * @type {Map}
       */
      model: null,

      /**
       * The primary HTML template for this view
       * @type {Underscore.template}
       */
      template: _.template(Template),

      /**
       * The events this view will listen to and the associated function to call.
       * @type {object}
       */
      events: {
        // 'event selector': 'function',
      },

      /**
       * @typedef {object} MapViewOptions
       * @property {Map} model The map model that contains the configs for this map view.
       * @property {boolean} isPortalMap Indicates whether the map view is a part of a
       * portal, which is styled differently.
       */

      /** @inheritdoc */
      initialize(options) {
        // Add the CSS required for this view and its sub-views.
        MetacatUI.appModel.addCSS(MapCSS, "mapView");

        this.model = options?.model ? options.model : new Map();
        this.isPortalMap = options?.isPortalMap;
      },

      /**
       * Renders this view
       * @returns {MapView} Returns the rendered view element
       */
      render() {
        // Save a reference to this view
        const view = this;

        // TODO: Add a nice loading animation?

        // Insert the template into the view
        this.$el.html(this.template());

        // Ensure the view's main element has the given class name
        this.el.classList.add(this.className);
        if (this.isPortalMap) {
          this.el.classList.add(CLASS_NAMES.portalIndicator);
        }

        // Select the elements that will be updatable
        this.subElements = {};
        Object.entries(CLASS_NAMES).forEach(([element, className]) => {
          view.subElements[element] = this.el.querySelector(`.${className}`);
        });

        // Render the (Cesium) map
        this.renderMapWidget();
        this.renderLayerLoadingIndicator();
        this.updateLayerLoadingIndicator();
        this.stopListening(
          this.model,
          "change:isLoadingLayers change:loadingLayersMessage",
        );
        this.listenTo(
          this.model,
          "change:isLoadingLayers change:loadingLayersMessage",
          this.updateLayerLoadingIndicator,
        );

        // Optionally add the toolbar, layer details, and feature info box.
        if (this.model.get("showToolbar")) {
          this.renderToolbar();
          this.renderLayerDetails();
        }
        if (this.model.get("showFeatureInfo")) {
          this.renderFeatureInfo();
        }
        this.renderVisualizationPanel();
        return this;
      },

      /**
       * Clear any pending delayed loading-indicator reveal.
       * @since 0.0.0
       */
      clearLayerLoadingIndicatorTimer() {
        if (this.loadingIndicatorTimer) {
          clearTimeout(this.loadingIndicatorTimer);
          this.loadingIndicatorTimer = null;
        }
      },

      /**
       * Render the map-level loading indicator within the map widget container.
       * @returns {HTMLElement|null} The loading indicator element.
       * @since 0.0.0
       */
      renderLayerLoadingIndicator() {
        const container = this.subElements?.mapWidgetContainer;
        if (!container) return null;

        const indicator = document.createElement("div");
        indicator.className = CLASS_NAMES.loadingIndicator;
        indicator.hidden = true;
        indicator.setAttribute("aria-live", "polite");
        indicator.setAttribute("aria-atomic", "true");
        indicator.innerHTML = `
          <div class="${CLASS_NAMES.loadingBar}"></div>
          <div class="${CLASS_NAMES.loadingMessage}">
            <span class="${CLASS_NAMES.loadingText}"></span>
          </div>
        `;
        container.appendChild(indicator);

        this.subElements.loadingIndicator = indicator;
        this.subElements.loadingBar = indicator.querySelector(
          `.${CLASS_NAMES.loadingBar}`,
        );
        this.subElements.loadingMessage = indicator.querySelector(
          `.${CLASS_NAMES.loadingMessage}`,
        );
        this.subElements.loadingText = indicator.querySelector(
          `.${CLASS_NAMES.loadingText}`,
        );

        return indicator;
      },

      /**
       * Update the map-level loading indicator based on aggregate layer state.
       * @since 0.0.0
       */
      updateLayerLoadingIndicator() {
        const indicator = this.subElements?.loadingIndicator;
        const messageTextEl = this.subElements?.loadingText;
        if (!indicator || !messageTextEl) return;

        const isLoading = this.model.get("isLoadingLayers") === true;
        const message = this.model.get("loadingLayersMessage") || "Loading layers";

        messageTextEl.textContent = message;

        if (!isLoading) {
          this.clearLayerLoadingIndicatorTimer();
          indicator.hidden = true;
          return;
        }

        if (!this.loadingIndicatorTimer && indicator.hidden) {
          this.loadingIndicatorTimer = setTimeout(() => {
            this.loadingIndicatorTimer = null;
            if (this.model.get("isLoadingLayers") === true) {
              messageTextEl.textContent =
                this.model.get("loadingLayersMessage") || "Loading layers";
              indicator.hidden = false;
            }
          }, LOADING_INDICATOR_DELAY_MS);
        }
      },

      /**
       * Renders the full-screen visualization overlay panel and wires it to
       * the map model's activeVisualizationUrl attribute.
       * @returns {VisualizationPanelView} Returns the rendered panel view.
       * @since 2.37.0
       */
      renderVisualizationPanel() {
        const view = this;
        view.visualizationPanel = new VisualizationPanelView();
        view.visualizationPanel.render();
        view.subElements.mapWidgetContainer.appendChild(
          view.visualizationPanel.el,
        );

        view.stopListening(view.model, "change:activeVisualizationUrl");
        view.listenTo(
          view.model,
          "change:activeVisualizationUrl",
          (model, url) => {
            if (url) {
              view.visualizationPanel.open({
                action: model.get("activeVisualizationAction"),
                url,
              });
            } else {
              view.visualizationPanel.close();
            }
          },
        );

        const activeVisualizationUrl = view.model.get("activeVisualizationUrl");
        if (activeVisualizationUrl) {
          view.visualizationPanel.open({
            action: view.model.get("activeVisualizationAction"),
            url: activeVisualizationUrl,
          });
        }

        view.stopListening(view.visualizationPanel, "mcui:state");
        view.listenTo(view.visualizationPanel, "mcui:state", (payload) => {
          view.model.trigger("visualization:state", payload);
        });

        // Keep map model in sync when the panel is closed via its own button
        // or the Escape key (which triggers the "close" event on the panel).
        view.stopListening(view.visualizationPanel, "close");
        view.listenTo(view.visualizationPanel, "close", () => {
          view.model.set({
            activeVisualizationAction: null,
            activeVisualizationActionId: null,
            activeVisualizationUrl: null,
          });
        });

        return view.visualizationPanel;
      },

      /**
       * Renders the view that shows the map/globe and all of the geo-spatial data.
       * @returns {MapWidgetContainerView} Returns the rendered view
       */
      renderMapWidget() {
        this.mapWidgetContainer = new MapWidgetContainerView({
          el: this.subElements.mapWidgetContainer,
          model: this.model,
        });
        this.mapWidgetContainer.render();
        return this.mapWidgetContainer;
      },

      /**
       * Renders the toolbar element that contains sections for viewing and editing the
       * layer list.
       * @returns {ToolbarView} Returns the rendered view
       */
      renderToolbar() {
        const initialOpenPanelId =
          this.model.get("restoreState")?.openPanel || null;
        this.toolbar = new ToolbarView({
          el: this.subElements.toolbarContainer,
          model: this.model,
          initialOpenPanelId,
        });
        this.stopListening(this.toolbar, "toolbar:activePanelChanged");
        this.listenTo(this.toolbar, "toolbar:activePanelChanged", (panelId) => {
          const restoreState = this.model.get("restoreState") || {};
          if (restoreState.openPanel === panelId) return;

          this.model.set("restoreState", {
            ...restoreState,
            openPanel: panelId,
          });
          this.model.updateSearchParams();
        });
        this.toolbar.render();
        return this.toolbar;
      },

      /**
       * Renders the info box that is displayed when a user clicks on a feature on the
       * map. If there are multiple features selected, this will show information for
       * the first one only.
       * @returns {FeatureInfoView}  Returns the rendered view
       */
      renderFeatureInfo() {
        const view = this;
        const interactions = view.model.get("interactions");
        const features = view.model.getSelectedFeatures();

        view.featureInfo = new FeatureInfoView({
          el: view.subElements.featureInfoContainer,
          model: features.at(0),
        }).render();

        // When the selectedFeatures collection changes, update the feature
        // info view
        view.stopListening(features, "update");
        view.listenTo(features, "update", () => {
          view.featureInfo.changeModel(features.at(-1));
        });

        // If the Feature model is ever completely replaced for any reason,
        // make the the Feature Info view gets updated.
        const event = "change:selectedFeatures";
        view.stopListening(interactions, event);
        view.listenTo(interactions, event, view.renderFeatureInfo);
        return view.featureInfo;
      },

      /**
       * Renders the layer details view that is displayed when a user clicks on a layer
       * in the toolbar.
       * @returns {LayerDetailsView} Returns the rendered view
       */
      renderLayerDetails() {
        this.layerDetails = new LayerDetailsView({
          el: this.subElements.layerDetailsContainer,
        });
        this.layerDetails.render();

        // When a layer is selected, show the layer details panel. When a layer is
        // de-selected, close it. The Layer model's 'selected' attribute gets updated
        // from the Layer Item View, and also from the Layers collection.
        this.model.getLayerGroups().forEach((layers) => {
          this.stopListening(layers);
          this.listenTo(layers, "change:selected", (layerModel, selected) => {
            if (selected === false) {
              this.layerDetails.updateModel(null);
              this.layerDetails.close();
            } else {
              this.layerDetails.updateModel(layerModel);
              this.layerDetails.open();
            }
          });
        });

        return this.layerDetails;
      },

      /**
       * Get a list of the views that this view contains.
       * @returns {Backbone.View[]} Returns an array of all of the sub-views.
       * Some may be undefined if they have not been rendered yet.
       * @since 2.27.0
       */
      getSubViews() {
        return [
          this.mapWidgetContainer,
          this.toolbar,
          this.featureInfo,
          this.layerDetails,
          this.visualizationPanel,
        ];
      },

      /**
       * Executed when the view is closed. This will close all of the sub-views.
       * @since 2.27.0
       */
      onClose() {
        this.clearLayerLoadingIndicatorTimer();
        const subViews = this.getSubViews();
        subViews.forEach((subView) => {
          if (subView && typeof subView.onClose === "function") {
            subView.onClose();
          }
        });
      },
    },
  );

  return MapView;
});
