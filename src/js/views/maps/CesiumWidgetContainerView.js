"use strict";

define([
  "backbone",
  "models/maps/Map",
  "views/maps/CesiumWidgetView",
], (Backbone, Map, CesiumWidgetView) => {
  /**
   * @class CesiumWidgetContainerView
   * @classdesc A container for CesiumWidgetView and other map overlays, e.g. lat/lng, legends, etc.
   * @classcategory Views/Maps
   * @name CesiumWidgetContainerView
   * @augments Backbone.View
   * @since 0.0.0
   * @constructs
   */
  const CesiumWidgetContainerView = Backbone.View.extend(
    /** @lends CesiumWidgetContainerView.prototype */ {
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
        this.renderMapWidget(this.el, this.model);
      },

      /** Renders Cesium map. */
      renderMapWidget() {
        const mapWidget = new CesiumWidgetView({
          el: this.el,
          model: this.model,
        });
        mapWidget.render();
      },
    },
  );

  return CesiumWidgetContainerView;
});
