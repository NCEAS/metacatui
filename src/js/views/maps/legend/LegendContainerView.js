"use strict";

define([
  "backbone",
  "underscore",
  "models/maps/Map",
  "models/maps/AssetColorPalette",
  "views/maps/legend/LayerLegendView",
  "text!templates/maps/legend/legend-container.html",
], (Backbone, _, Map, AssetColorPalette, LayerLegendView, Template) => {
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
        const allLayers =
          typeof this.model.getAllLayers === "function"
            ? this.model.getAllLayers()
            : this.model.get("allLayers")?.models || [];

        allLayers.forEach((layer) => {
          this.stopListening(layer, "change:visible");
          this.listenTo(layer, "change:visible", this.updateLegend);

          // Updates the legend when the Filter model is updated (through the Filter by Property feature).
          const colorPaletteProperty = layer
            ?.get("colorPalette")
            ?.get("property");
          layer?.get("filters")?.forEach((model) => {
            if (model.get("property") === colorPaletteProperty) {
              this.filterModel = model;
            }
          });
          if (this.filterModel) {
            this.stopListening(this.filterModel, "change:values");
            this.listenTo(this.filterModel, "change:values", this.updateLegend);
          }
        });
      },

      /**
       * Sets the active state of the filter based values (for categorical
       * filters) in the Color Palette model.
       * @returns {AssetColorPalette} - Return the updated color palette model
       * @param layer - Layer item model
       * @param colorPaletteModel - Asset color palette model
       */
      updateColorPalette(layer, colorPaletteModel) {
        const colorPaletteProperty = colorPaletteModel.get("property");
        let layerValues;
        layer.get("filters")?.forEach((model) => {
          if (model.get("property") === colorPaletteProperty) {
            layerValues = model.get("values");
          }
        }); // Find the values on filter model, whose property matches the colorPaletteProperty

        colorPaletteModel.get("colors").forEach((color) => {
          if (layerValues.includes(color.get("value"))) {
            color.set("filterActive", true);
          } else {
            color.set("filterActive", false);
          }
        });
        return colorPaletteModel;
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
        const allLayers =
          typeof this.model.getAllLayers === "function"
            ? this.model.getAllLayers()
            : this.model.get("allLayers")?.models || [];

        allLayers.forEach((layer) => {
          if (
            !layer.get("visible") ||
            !layer.get("colorPalette") ||
            layer.get("colorPalette").get("colors").isEmpty()
          ) {
            return;
          }

          let colorPaletteModel = layer.get("colorPalette");
          const colorPaletteProperty = colorPaletteModel.get("property"); // Get the property name on which color palette is set

          const filters = layer?.get("filters"); // Retrieve filters attribute
          let filterModel = null;

          filters?.forEach((model) => {
            if (model.get("property") === colorPaletteProperty) {
              filterModel = model;
            }
          }); // Find the filter model that matches the colorPaletteProperty

          if (filterModel) {
            colorPaletteModel = this.updateColorPalette(
              layer,
              colorPaletteModel,
            ); // Update the color palette model
          }

          const layerLegendView = new LayerLegendView({
            filterModel, // pass filter model to update filter values in CategoricalSwatchView
            model: colorPaletteModel,
            layerName: layer.get("label"),
            layerModel: layer, // pass layer model to update visibility in CategoricalSwatchView
          });
          layerLegendView.render();
          content.append(layerLegendView.el);
        });
      },
    },
  );

  return LegendContainerView;
});
