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
    expanded: `${BASE_CLASS}--expanded`,
  };

  /**
   * @class LegendContainerView
   * @classdesc A container for the legend overlay on the map.
   * @classcategory Views/Maps/Legend
   * @name LegendContainerView
   * @augments Backbone.View
   * @screenshot views/maps/legend/LegendContainerView.png
   * @since 2.30.0
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

      /**
       * Toggles the expanded state of the legend container.
       */
      toggleExpanded() {
        this.$el.toggleClass(CLASS_NAMES.expanded);
      },

      /**
       * Updates the legend with the current color palettes.
       */
      updateLegend() {
        const content = this.$(`.${CLASS_NAMES.content}`).empty();
        this.model.get("allLayers")?.forEach((layer) => {
          if (
            !layer.get("visible") ||
            !layer.get("colorPalette") ||
            layer.get("colorPalette").get("colors").isEmpty()
          ) {
            return;
          }
          const layerLegendView = new LayerLegendView({
            model: layer.get("colorPalette"),
            layerName: layer.get("label"),
          });
          layerLegendView.render();
          content.append(layerLegendView.el);
        });
      },
    },
  );

  return LegendContainerView;
});
