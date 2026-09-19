"use strict";

define([
  "backbone",
  "views/maps/CesiumWidgetView",
  "views/maps/legend/LegendContainerView",
  "views/maps/MapStatusBarView",
], (Backbone, CesiumWidgetView, LegendContainerView, MapStatusBarView) => {
  /**
   * @class MapWidgetContainerView
   * @classdesc A container for CesiumWidgetView and other map overlays, e.g. lat/lng, legends, etc.
   * @classcategory Views/Maps
   * @name MapWidgetContainerView
   * @augments Backbone.View
   * @since 2.30.0
   * @constructs
   */
  const MapWidgetContainerView = Backbone.View.extend(
    /** @lends MapWidgetContainerView.prototype */ {
      /**
       * The model that this view uses
       * @type {Map}
       */
      model: null,

      /** @inheritdoc */
      el: null,

      /** @inheritdoc */
      initialize(options) {
        this.el = options.el;
        this.model = options.model;
      },

      /** @inheritdoc */
      render() {
        this.renderMapWidget();
        this.renderLegendContainer();

        if (this.model.get("showScaleBar")) {
          this.renderStatusBar();
        }
      },

      /** Renders Cesium map. Currently, this uses the MapWidgetContainerView, but this function could be modified to use an alternative map widget in the future. */
      renderMapWidget() {
        const mapWidget = new CesiumWidgetView({
          el: this.el,
          model: this.model,
        });
        mapWidget.render();
        this.mapWidget = mapWidget;
      },

      /** Renders legend overlay. */
      renderLegendContainer() {
        const legendContainerView = new LegendContainerView({
          model: this.model,
        });
        legendContainerView.render();
        this.$el.append(legendContainerView.el);
        this.legendContainerView = legendContainerView;
      },

      /**
       * Renders the status bar, which shows the scale bar (current mouse position
       * and map scale) along with a loading indicator that appears beneath it while
       * map layers are loading.
       */
      renderStatusBar() {
        const interactions = this.model.get("interactions");
        if (!interactions) {
          this.listenToOnce(
            this.model,
            "change:interactions",
            this.renderStatusBar,
          );
          return;
        }
        const statusBar = new MapStatusBarView({
          model: this.model,
          scaleModel: interactions.get("scale"),
          pointModel: interactions.get("mousePosition"),
        });
        statusBar.render();
        this.statusBar = statusBar;
        this.$el.append(statusBar.el);

        // If the interaction model or relevant sub-models are ever completely
        // replaced for any reason, re-render the status bar.
        this.listenToOnce(
          interactions,
          "change:scale change:mousePosition",
          this.renderStatusBar,
        );
        this.listenToOnce(
          this.model,
          "change:interactions",
          this.renderStatusBar,
        );
      },

      /** Call the onClose method of each subview. */
      onClose() {
        const subViews = [
          this.statusBar,
          this.legendContainerView,
          this.mapWidget,
        ];
        subViews.forEach((subView) => {
          if (subView && typeof subView.onClose === "function") {
            subView.onClose();
          }
        });
      },
    },
  );

  return MapWidgetContainerView;
});
