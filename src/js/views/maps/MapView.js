'use strict';

define(
  [
    'jquery',
    'underscore',
    'backbone',
    'models/maps/Map',
    'text!templates/maps/map.html',
    // SubViews
    'views/maps/CesiumWidgetView',
    'views/maps/ToolbarView',
    'views/maps/ScaleBarView',
    'views/maps/FeatureInfoView',
    'views/maps/LayerDetailsView',
    // CSS
    "text!" + MetacatUI.root + "/css/map-view.css",
  ],
  function (
    $,
    _,
    Backbone,
    Map,
    Template,
    // SubViews
    CesiumWidgetView,
    ToolbarView,
    ScaleBarView,
    FeatureInfoView,
    LayerDetailsView,
    // CSS
    MapCSS
  ) {

    /**
    * @class MapView
    * @classdesc An interactive 2D or 3D map that allows visualization of geo-spatial
    * data.
    * @classcategory Views/Maps
    * @name MapView
    * @extends Backbone.View
    * @screenshot maps/MapView.png // TODO: add screenshot
    * @constructs
    */
    var MapView = Backbone.View.extend(
      /** @lends MapView.prototype */{

        /**
        * The type of View this is
        * @type {string}
        */
        type: 'MapView',

        /**
        * The HTML classes to use for this view's element
        * @type {string}
        */
        className: 'map-view',

        /**
        * The model that this view uses
        * @type {Map}
        */
        model: new Map(),

        /**
         * The primary HTML template for this view
         * @type {Underscore.template}
         */
        template: _.template(Template),

        /**
         * Classes that will be used to select specific elements from the template.
         * @name MapView#classes
         * @type {Object}
         * @property {string} mapWidgetContainer The element that will hold the map widget
         * (i.e. CesiumWidgetView)
         * @property {string} scaleBarContainer The container for the ScaleBarView
         * @property {string} featureInfoContainer The container for the box that will
         * show details about a selected feature
         * @property {string} toolbarContainer The container for the toolbar UI
         * @property {string} layerDetailsContainer The container for the element that
         * will show details about a specific layer
         */
        classes: {
          mapWidgetContainer: "map-view__map-widget-container",
          scaleBarContainer: "map-view__scale-bar-container",
          featureInfoContainer: "map-view__feature-info-container",
          toolbarContainer: "map-view__toolbar-container",
          layerDetailsContainer: "map-view__layer-details-container"
        },

        /**
        * The events this view will listen to and the associated function to call.
        * @type {Object}
        */
        events: {
          // 'event selector': 'function',
        },

        /**
        * Executed when a new MapView is created
        * @param {Object} [options] - A literal object with options to pass to the view.
        */
        initialize: function (options) {

          try {
            // Add the CSS required for this view and its sub-views.
            MetacatUI.appModel.addCSS(MapCSS, "mapView");

            // Get all the options and apply them to this view
            if (typeof options == 'object') {
              for (const [key, value] of Object.entries(options)) {
                this[key] = value;
              }
            }
          } catch (e) {
            console.log('A MapView failed to initialize. Error message: ' + e);
          }

        },

        /**
        * Renders this view
        * @return {MapView} Returns the rendered view element
        */
        render: function () {

          try {

            // Save a reference to this view
            var view = this;

            // TODO: Add a nice loading animation?

            // Insert the template into the view
            this.$el.html(this.template());

            // Ensure the view's main element has the given class name
            this.el.classList.add(this.className);

            // Select the elements that will be updatable
            this.subElements = {};
            for (const [element, className] of Object.entries(view.classes)) {
              view.subElements[element] = document.querySelector('.' + className)
            }

            // Render the (Cesium) map
            this.renderMapWidget();

            // Optionally add the toolbar, layer details, scale bar, and feature info box.
            if (this.model.get("showToolbar")) {
              this.renderToolbar();
              this.renderLayerDetails();
            }
            if (this.model.get("showScaleBar")) {
              this.renderScaleBar();
            }
            if (this.model.get("showFeatureInfo")) {
              this.renderFeatureInfo();
            }

            // Return this MapView
            return this

          }
          catch (error) {
            console.log(
              'There was an error rendering a MapView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Renders the view that shows the map/globe and all of the geo-spatial data.
         * Currently, this uses the CesiumWidgetView, but this function could be modified
         * to use an alternative map widget in the future.
         * @returns {CesiumWidgetView} Returns the rendered view
         */
        renderMapWidget : function(){
          try {
            this.mapWidget = new CesiumWidgetView({
              el: this.subElements.mapWidgetContainer,
              model: this.model
            })
            this.mapWidget.render()
            return this.mapWidget
          }
          catch (error) {
            console.log(
              'There was an error rendering the map widget in a MapView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Renders the toolbar element that contains sections for viewing and editing the
         * layer list.
         * @returns {ToolbarView} Returns the rendered view
         */
        renderToolbar : function(){
          try {
            this.toolbar = new ToolbarView({
              el: this.subElements.toolbarContainer,
              model: this.model
            })
            this.toolbar.render()
            return this.toolbar
          }
          catch (error) {
            console.log(
              'There was an error rendering a toolbarView in a MapView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Renders the info box that is displayed when a user clicks on a feature on the
         * map.
         * @returns {FeatureInfoView}  Returns the rendered view
         */
        renderFeatureInfo : function(){
          try {
            this.featureInfo = new FeatureInfoView({
              el: this.subElements.featureInfoContainer,
              model: this.model.get('selectedFeature')
            })
            this.featureInfo.render()
            // If the Feature model is ever completely replaced for any reason, make the
            // the Feature Info view gets updated.
            this.stopListening(this.model, 'change:selectedFeature')
            this.listenTo(this.model, 'change:selectedFeature', function (mapModel, FeatureModel) {
              this.featureInfo.model = FeatureModel
              this.featureInfo.update()
            })
            return this.featureInfo
          }
          catch (error) {
            console.log(
              'There was an error rendering a FeatureInfoView in a MapView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Renders the layer details view that is displayed when a user clicks on a layer
         * in the toolbar.
         * @returns {LayerDetailsView} Returns the rendered view
         */
        renderLayerDetails : function(){
          try {
            this.layerDetails = new LayerDetailsView({
              el: this.subElements.layerDetailsContainer
            })
            this.layerDetails.render()

            // When a layer is selected, show the layer details panel. When a layer is
            // de-selected, close it. The Layer model's 'selected' attribute gets updated
            // from the Layer Item View, and also from the Layers collection.
            this.stopListening(this.model.get('layers'))
            this.listenTo(this.model.get('layers'), 'change:selected',
              function (layerModel, selected) {
                if (selected === false) {
                  this.layerDetails.updateModel(null)
                  this.layerDetails.close()
                } else {
                  this.layerDetails.updateModel(layerModel)
                  this.layerDetails.open()
                }
              }
            )

            return this.layerDetails
          }
          catch (error) {
            console.log(
              'There was an error rendering a LayerDetailsView in a MapView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Renders the scale bar view that shows the current position of the mouse on the
         * map.
         * @returns {ScaleBarView} Returns the rendered view
         */
        renderScaleBar: function () {
          try {
            this.scaleBar = new ScaleBarView({
              el: this.subElements.scaleBarContainer
            })
            this.scaleBar.render()
            return this.scaleBar
          }
          catch (error) {
            console.log(
              'There was an error rendering a ScaleBarView in a MapView' +
              '. Error details: ' + error
            );
          }
        },

      }
    );

    return MapView;

  }
);
