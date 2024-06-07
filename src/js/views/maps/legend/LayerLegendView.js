"use strict";

define([
  "backbone",
  "underscore",
  "models/maps/AssetColorPalette",
  "text!templates/maps/legend/layer-legend.html",
], (Backbone, _, AssetColorPalette, Template) => {
  const BASE_CLASS = "layer-legend";
  const CLASS_NAMES = {
    palette: `${BASE_CLASS}__palette`,
  };

  /**
   * @class LayerLegendView
   * @classdesc A legend view for a particular layer that contains the layer name and the color
   * details.
   * @classcategory Views/Maps/Legend
   * @name LayerLegendView
   * @augments Backbone.View
   * @since 0.0.0
   * @constructs
   */
  const LayerLegendView = Backbone.View.extend(
    /** @lends LayerLegendView.prototype */ {
      /** @inheritdoc */
      className: BASE_CLASS,

      /**
       * The model that this view uses
       * @type {AssetColorPalette}
       */
      model: null,

      /** @inheritdoc */
      template: _.template(Template),

      /** @inheritdoc */
      initialize(options) {
        this.model = options.model;
      },

      /** @inheritdoc */
      render() {
        this.$el.html(
          this.template({
            classNames: CLASS_NAMES,
            name: this.model.get("label"),
          }),
        );

        const paletteType = this.model.get("paletteType");
        if (paletteType === "categorical") {
          this.renderCategoricalPalette();
        } else if (paletteType === "continuous") {
          this.renderContinuousPalette();
        }
      },

      renderCategoricalPalette() {
        // TODO
      },

      renderContinuousPalette() {
        // TODO
      },
    },
  );

  return LayerLegendView;
});
