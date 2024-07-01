"use strict";

define([
  "backbone",
  "views/maps/CesiumWidgetView",
  "views/maps/legend/LegendContainerView",
  "views/maps/ScaleBarView",
], (Backbone, CesiumWidgetView, LegendContainerView, ScaleBarView) => {
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
          this.renderScaleBar();
        }
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

      /**
       * Renders the scale bar view that shows the current position of the mouse on the
       * map.
       */
      renderScaleBar() {
        const interactions = this.model.get("interactions");
        if (!interactions) {
          this.listenToOnce(
            this.model,
            "change:interactions",
            this.renderScaleBar,
          );
          return;
        }
        const scaleBar = new ScaleBarView({
          // el: this.el,
          scaleModel: interactions.get("scale"),
          pointModel: interactions.get("mousePosition"),
        });
        scaleBar.render();
        this.$el.append(scaleBar.el);

        // If the interaction model or relevant sub-models are ever completely
        // replaced for any reason, re-render the scale bar.
        this.listenToOnce(
          interactions,
          "change:scale change:mousePosition",
          this.renderScaleBar,
        );
        this.listenToOnce(
          this.model,
          "change:interactions",
          this.renderScaleBar,
        );
      },
    },
  );

  return MapWidgetContainerView;
});
