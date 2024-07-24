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
  // CSS
  MapCSS,
) => {
  const CLASS_NAMES = {
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
       * @typedef {object} ViewfinderViewOptions
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

        // Optionally add the toolbar, layer details, and feature info box.
        if (this.model.get("showToolbar")) {
          this.renderToolbar();
          this.renderLayerDetails();
        }
        this.renderFeatureInfo();
        return this;
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
        this.toolbar = new ToolbarView({
          el: this.subElements.toolbarContainer,
          model: this.model,
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
        ];
      },

      /**
       * Executed when the view is closed. This will close all of the sub-views.
       * @since 2.27.0
       */
      onClose() {
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
