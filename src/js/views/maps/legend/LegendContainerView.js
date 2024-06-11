"use strict";

define([
  "backbone",
  "underscore",
  "models/maps/Map",
  "views/maps/legend/LayerLegendView",
  "text!templates/maps/legend/legend-container.html",
], (Backbone, _, Map, LayerLegendView, Template) => {
  const BASE_CLASS = "legend-container";
  const CLASS_NAMES = {
    content: `${BASE_CLASS}__content`,
    header: `${BASE_CLASS}__header`,
    expandIcon: `${BASE_CLASS}__header-expand`,
  };

  /**
   * @class LegendContainerView
   * @classdesc A container for the legend overlay on the map.
   * @classcategory Views/Maps/Legend
   * @name LegendContainerView
   * @augments Backbone.View
   * @screenshot views/maps/legend/LegendContainerView.png
   * @since 0.0.0
   * @constructs
   */
  const LegendContainerView = Backbone.View.extend(
    /** @lends LegendContainerView.prototype */ {
      /** @inheritdoc */
      className: BASE_CLASS,

      /**
       * The model that this view uses
       * @type {Map}
       */
      model: null,

      /** Whether the legend is expanded or collapsed. */
      expanded: false,

      /** @inheritdoc */
      template: _.template(Template),

      /** @inheritdoc */
      events() {
        return { [`click .${CLASS_NAMES.header}`]: "toggleExpanded" };
      },

      /** @inheritdoc */
      initialize(options) {
        this.model = options.model;
      },

      /** @inheritdoc */
      render() {
        this.$el.html(
          this.template({
            classNames: CLASS_NAMES,
          }),
        );

        this.updateLegend();
        this.model.get("allLayers")?.forEach((layer) => {
          this.stopListening(layer, "change:visible");
          this.listenTo(layer, "change:visible", this.updateLegend);
        });
      },

      toggleExpanded() {
        this.expanded = !this.expanded;
        if (this.expanded) {
          this.$el.addClass("expanded");
        } else {
          this.$el.removeClass("expanded");
        }
      },

      updateLegend() {
        this.$(`.${CLASS_NAMES.content}`).empty();
        this.model.get("allLayers")?.forEach((layer) => {
          if (!layer.get("visible") || !layer.get("colorPalette")) {
            return;
          }
          const layerLegendView = new LayerLegendView({
            model: layer.get("colorPalette"),
          });
          layerLegendView.render();
          this.$(`.${CLASS_NAMES.content}`).append(layerLegendView.el);
        });
      },
    },
  );

  return LegendContainerView;
});
