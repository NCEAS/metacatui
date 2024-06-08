"use strict";

define([
  "backbone",
  "underscore",
  "models/maps/AssetColorPalette",
  "views/maps/legend/CategoricalSwatchView",
  "views/maps/legend/ContinuousSwatchView",
  "text!templates/maps/legend/layer-legend.html",
], (
  Backbone,
  _,
  AssetColorPalette,
  CategoricalSwatchView,
  ContinuousSwatchView,
  Template,
) => {
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
   * @screenshot views/maps/legend/LayerLegendView.png
   * @since 0.0.0
   * @constructs
   */
  const LayerLegendView = Backbone.View.extend(
    /** @lends LayerLegendView.prototype */ {
      /** @inheritdoc */
      className: BASE_CLASS,

      /**
       * The palette model that this view uses
       * @type {AssetColorPalette}
       */
      model: null,

      /**
       * The name of the layer that this legend applies to.
       * @type {string}
       */
      layerName: null,

      /** @inheritdoc */
      template: _.template(Template),

      /** @inheritdoc */
      initialize(options) {
        this.model = options.model;
        this.layerName = options.layerName;
      },

      /** @inheritdoc */
      render() {
        const paletteType = this.model.get("paletteType");
        if (paletteType === "categorical") {
          this.renderCategoricalPalette();
        } else if (paletteType === "continuous") {
          this.renderContinuousPalette();
        }
      },

      /** Populates the view template with variabels. */
      renderTemplate() {
        let name;
        const property = this.model.get("label") || this.model.get("property");
        if (this.layerName && property) {
          name = `${this.layerName} (${property})`;
        } else {
          name = this.layerName || property;
        }

        this.$el.html(
          this.template({
            classNames: CLASS_NAMES,
            name,
          }),
        );
      },

      /** Fills the palette div with categorical swatches. */
      renderCategoricalPalette() {
        this.renderTemplate();
        this.model.get("colors").forEach((color) => {
          const swatch = new CategoricalSwatchView({ model: color });
          swatch.render();

          this.$(`.${CLASS_NAMES.palette}`).append(swatch.el);
        });
      },

      /** Fills the palette div with a continuous swatch. */
      renderContinuousPalette() {
        this.renderTemplate();
        const swatch = new ContinuousSwatchView({
          collection: this.model.get("colors"),
        });
        swatch.render();

        this.$(`.${CLASS_NAMES.palette}`).append(swatch.el);
      },
    },
  );

  return LayerLegendView;
});
