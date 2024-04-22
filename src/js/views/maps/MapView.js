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
    'text!' + MetacatUI.root + '/css/map-view.css',
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
    const CLASS_NAMES = {
      mapWidgetContainer: 'map-view__map-widget-container',
      scaleBarContainer: 'map-view__scale-bar-container',
      featureInfoContainer: 'map-view__feature-info-container',
      toolbarContainer: 'map-view__toolbar-container',
      layerDetailsContainer: 'map-view__layer-details-container',
      portalIndicator: 'map-view__portal',
    };

    /**
    * @class MapView
    * @classdesc An interactive 2D or 3D map that allows visualization of geo-spatial
    * data.
    * @classcategory Views/Maps
    * @name MapView
    * @extends Backbone.View
    * @screenshot views/maps/MapView.png
    * @since 2.18.0
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
        model: null,

        /**
         * The primary HTML template for this view
         * @type {Underscore.template}
         */
        template: _.template(Template),

        /**
        * The events this view will listen to and the associated function to call.
        * @type {Object}
        */
        events: {
          // 'event selector': 'function',
        },

        /**
        * @typedef {Object} ViewfinderViewOptions
        * @property {Map} model The map model that contains the configs for this map view.
        * @property {boolean} isPortalMap Indicates whether the map view is a part of a
        * portal, which is styled differently.
        */

        /**
        * Executed when a new MapView is created
        * @param {ViewfinderViewOptions} options
        */
        initialize: function (options) {
          // Add the CSS required for this view and its sub-views.
          MetacatUI.appModel.addCSS(MapCSS, 'mapView');

          this.model = options?.model ? options.model : new Map();
          this.isPortalMap = options?.isPortalMap;
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
            if (this.isPortalMap) {
              this.el.classList.add(CLASS_NAMES.portalIndicator);
            }

            // Select the elements that will be updatable
            this.subElements = {};
            for (const [element, className] of Object.entries(CLASS_NAMES)) {
              view.subElements[element] = document.querySelector('.' + className)
            }

            // Render the (Cesium) map
            this.renderMapWidget();

            // Optionally add the toolbar, layer details, scale bar, and feature info box.
            if (this.model.get('showToolbar')) {
              this.renderToolbar();
              this.renderLayerDetails();
            }
            if (this.model.get('showScaleBar')) {
              this.renderScaleBar();
            }
            if (
              this.model.get('showFeatureInfo') &
              this.model.get('clickFeatureAction') === 'showDetails'
            ) {
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
        renderMapWidget: function () {
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
        renderToolbar: function () {
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
         * map. If there are multiple features selected, this will show information for
         * the first one only.
         * @returns {FeatureInfoView}  Returns the rendered view
         */
        renderFeatureInfo: function () {
          try {
            const view = this;
            const interactions = view.model.get('interactions')
            const features = view.model.getSelectedFeatures();

            view.featureInfo = new FeatureInfoView({
              el: view.subElements.featureInfoContainer,
              model: features.at(0)
            }).render()

            // When the selectedFeatures collection changes, update the feature
            // info view
            view.stopListening(features, 'update')
            view.listenTo(features, 'update', function () {
              view.featureInfo.changeModel(features.at(-1))
            })

            // If the Feature model is ever completely replaced for any reason,
            // make the the Feature Info view gets updated.
            const event = 'change:selectedFeatures'
            view.stopListening(interactions, event)
            view.listenTo(interactions, event, view.renderFeatureInfo);
            return view.featureInfo
          }
          catch (e) {
            console.log('Error rendering a FeatureInfoView in a MapView', e);
          }
        },

        /**
         * Renders the layer details view that is displayed when a user clicks on a layer
         * in the toolbar.
         * @returns {LayerDetailsView} Returns the rendered view
         */
        renderLayerDetails: function () {
          this.layerDetails = new LayerDetailsView({
            el: this.subElements.layerDetailsContainer
          });
          this.layerDetails.render();

          // When a layer is selected, show the layer details panel. When a layer is
          // de-selected, close it. The Layer model's 'selected' attribute gets updated
          // from the Layer Item View, and also from the Layers collection.
          for (const layers of this.model.getLayerGroups()) {
            this.stopListening(layers);
            this.listenTo(layers, 'change:selected',
              function (layerModel, selected) {
                if (selected === false) {
                  this.layerDetails.updateModel(null);
                  this.layerDetails.close();
                } else {
                  this.layerDetails.updateModel(layerModel);
                  this.layerDetails.open();
                }
              }
            );
          }

          return this.layerDetails;
        },

        /**
         * Renders the scale bar view that shows the current position of the mouse on the
         * map.
         * @returns {ScaleBarView} Returns the rendered view
         */
        renderScaleBar: function () {
          try {
            const interactions = this.model.get('interactions')
            if (!interactions) {
              this.listenToOnce(this.model, 'change:interactions', this.renderScaleBar);
              return
            }
            this.scaleBar = new ScaleBarView({
              el: this.subElements.scaleBarContainer,
              scaleModel: interactions.get('scale'),
              pointModel: interactions.get('mousePosition')
            })
            this.scaleBar.render();

            // If the interaction model or relevant sub-models are ever completely
            // replaced for any reason, re-render the scale bar.
            this.listenToOnce(interactions, 'change:scale change:mousePosition', this.renderScaleBar);
            this.listenToOnce(this.model, 'change:interactions', this.renderScaleBar);

            return this.scaleBar;
          }
          catch (error) {
            console.log(
              'There was an error rendering a ScaleBarView in a MapView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Get a list of the views that this view contains.
         * @returns {Backbone.View[]} Returns an array of all of the sub-views.
         * Some may be undefined if they have not been rendered yet.
         * @since 2.27.0
         */
        getSubViews: function () {
          return [
            this.mapWidget,
            this.toolbar,
            this.featureInfo,
            this.layerDetails,
            this.scaleBar
          ]
        },

        /**
         * Executed when the view is closed. This will close all of the sub-views.
         * @since 2.27.0
         */
        onClose: function () {
          const subViews = this.getSubViews()
          subViews.forEach(subView => {
            if (subView && typeof subView.onClose === 'function') {
              subView.onClose()
            }
          })
        }

      }
    );

    return MapView;

  }
);
