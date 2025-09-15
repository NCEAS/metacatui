"use strict";

define([
  "backbone",
  "underscore",
  "text!templates/maps/legend/categorical-swatch.html",
], (Backbone, _, Template) => {
  const BASE_CLASS = "categorical-swatch";
  const CLASS_NAMES = {
    swatch: `${BASE_CLASS}__swatch`,
  };

  /**
   * @class CategoricalSwatchView
   * @classdesc A view for a categorical swatch-value pair in a legend.
   * @classcategory Views/Maps/Legend
   * @name CategoricalSwatchView
   * @augments Backbone.View
   * @screenshot views/maps/legend/CategoricalSwatchView.png
   * @since 2.30.0
   * @constructs
   */
  const CategoricalSwatchView = Backbone.View.extend(
    /** @lends CategoricalSwatchView.prototype */ {
      /** @inheritdoc */
      className: BASE_CLASS,

      /** @inheritdoc */
      template: _.template(Template),

      /**
       * The model that this view uses
       * @type {AssetColor}
       */
      model: null,

      /**
       * A function that gives the events this view will listen to and the associated
       * function to call.
       * @returns {object} Returns an object with events in the format 'event selector':
       * 'function'
       */
      events() {
        return {
          click: "onLegendItemClick", // fires when you click anywhere on each legend swatch element
        };
      },

      /** @inheritdoc */
      initialize(options) {
        this.model = options.model;
        this.filterModel = options.filterModel;
        this.layer = options.layerModel;
      },

      /** @inheritdoc */
      render() {
        this.$el.html(
          this.template({
            classNames: CLASS_NAMES,
            value: this.model.get("label") || this.model.get("value"),
          }),
        );

        this.$(`.${CLASS_NAMES.swatch}`).css(
          "background-color",
          this.model.getCss(),
        );

        if (this.filterModel) {
          // Add list-item class to the view's main element
          // This class is added to reuse functionality of the class from layer list items
          this.el.classList.add("list-item");

          // Rebind event after DOM content is replaced
          // this.delegateEvents();

          // Update visual filter state
          this.showFilterStatus();
        }
      },

      /**
       * Apply the correct opacity styling based on filterActive state.
       * - When filterActive is true, opacity = 0.25 (transparent).
       * - When filterActive is false, opacity = 1 (fully visible).
       */
      showFilterStatus() {
        const opacity = this.model.get("filterActive") ? 1 : 0.25;
        this.$(`.${CLASS_NAMES.swatch}`).css("opacity", opacity);
        this.$(".categorical-swatch__value").css("opacity", opacity);
      },

      /**
       * Handles click events on legend swatch items.
       *
       * This function toggles the selection state of a legend item's value in the filter model:
       *  - If the clicked value is already selected, it removes it from the filter model.
       *  - If the clicked value is not selected, it adds it to the filter model.
       *  - Adjusts the opacity of the legend item's swatch and label to visually reflect its selection state.
       */
      onLegendItemClick() {
        if (!this.filterModel) return;

        const selectedValue =
          this.model.get("label") || this.model.get("value");
        const oldFilterValues = this.filterModel.get("values") || [];
        let newFilterValues;

        if (oldFilterValues.includes(selectedValue)) {
          newFilterValues = oldFilterValues.filter((v) => v !== selectedValue);
          this.model.set("filterActive", false);
        } else {
          newFilterValues = [...oldFilterValues, selectedValue];
          this.model.set("filterActive", true);
        }
        // Set a new array reference to trigger vector filter's change event
        if (!newFilterValues?.length) {
          // When all values are cleared from the attribute values dropdown, the
          // layer visibility is set to false, and the filter icon is turned off
          // (i.e., transparent).
          this.layer.set("visible", false);
        } else {
          this.filterModel.set("values", newFilterValues.slice());
        }
        // Update visual filter state
        this.showFilterStatus();
      },
    },
  );

  return CategoricalSwatchView;
});
