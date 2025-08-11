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

      /** @inheritdoc */
      initialize(options) {
        this.model = options.model;
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

        // When filterActive is true, opacity = 0.25 (transparent).
        // When filterActive is false, opacity = 1 (fully visible).
        const opacity = this.model.get("filterActive") ? 1 : 0.25;
        this.$(`.${CLASS_NAMES.swatch}`).css("opacity", opacity);
        this.$(".categorical-swatch__value").css("opacity", opacity);
      },
    },
  );

  return CategoricalSwatchView;
});
