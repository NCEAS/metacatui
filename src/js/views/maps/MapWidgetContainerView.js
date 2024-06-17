"use strict";

define([
  "backbone",
  "models/maps/Map",
  "views/maps/CesiumWidgetView",
  "views/maps/legend/LegendContainerView",
], (Backbone, Map, CesiumWidgetView, LegendContainerView) => {
  /**
   * @class MapWidgetContainerView
   * @classdesc A container for CesiumWidgetView and other map overlays, e.g. lat/lng, legends, etc.
   * @classcategory Views/Maps
   * @name MapWidgetContainerView
   * @augments Backbone.View
   * @since 0.0.0
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
      },

      /** Renders Cesium map. Currently, this uses the MapWidgetContainerView, but this function could be modified to use an alternative map widget in the future. */
      renderMapWidget() {
        const mapWidget = new CesiumWidgetView({
          el: this.el,
          model: this.model,
        });
        mapWidget.render();
      },

      /** Renders legend overlay. */
      renderLegendContainer() {
        const legendContainerView = new LegendContainerView({
          model: this.model,
        });
        legendContainerView.render();
        this.$el.append(legendContainerView.el);
      },
    },
  );

  return MapWidgetContainerView;
});
