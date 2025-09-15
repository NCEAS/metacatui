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
    icon: "layer-item__icon",
    filterIcon: "layer-item__filter-icon",
    filterIconActive: "layer-item__filter-icon--active",
    layerName: `${BASE_CLASS}__layer-name`,
  };

  /**
   * @class LayerLegendView
   * @classdesc A legend view for a particular layer that contains the layer name and the color
   * details.
   * @classcategory Views/Maps/Legend
   * @name LayerLegendView
   * @augments Backbone.View
   * @screenshot views/maps/legend/LayerLegendView.png
   * @since 2.30.0
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
        this.filterModel = options.filterModel;
        this.model = options.model;
        this.layerName = options.layerName;
        this.layerModel = options.layerModel;
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

        // Insert the filter icon to the right of the label element text. This
        //  icon appears for layers that are "filterable" based on their
        //  atrributes.
        this.swatchEl = this.el.querySelector(`.${CLASS_NAMES.layerName}`);
        if (this.filterModel && this.swatchEl) {
          const filterIconEl = document.createElement("span");
          const classes = [
            CLASS_NAMES.icon,
            CLASS_NAMES.filterIcon,
            CLASS_NAMES.filterIconActive,
          ];
          filterIconEl.classList.add(...classes);
          filterIconEl.title = "Filter by property"; // add tooltip
          filterIconEl.innerHTML = `<i class="icon icon-filter"></i>`;
          this.swatchEl.prepend(filterIconEl);
        }
      },

      /** Fills the palette div with categorical swatches. */
      renderCategoricalPalette() {
        this.renderTemplate();
        this.model.get("colors").forEach((color) => {
          // if (color.get("value")) {
          // const swatch = new CategoricalSwatchView({ model: color });
          const swatch = new CategoricalSwatchView({
            model: color,
            filterModel: this.filterModel,
            layerModel: this.layerModel,
          });
          swatch.render();

          this.$(`.${CLASS_NAMES.palette}`).append(swatch.el);
          // }
        });
      },

      /** Fills the palette div with a continuous swatch. */
      renderContinuousPalette() {
        this.renderTemplate();
        const swatch = new ContinuousSwatchView({
          model: this.model,
        });
        swatch.render();

        this.$(`.${CLASS_NAMES.palette}`).append(swatch.el);
      },
    },
  );

  return LayerLegendView;
});
