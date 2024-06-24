"use strict";

define([
  "backbone",
  "underscore",
  "common/Utilities",
  "text!templates/maps/legend/continuous-swatch.html",
], (Backbone, _, Utilities, Template) => {
  const BASE_CLASS = "continuous-swatch";
  const CLASS_NAMES = {
    swatch: `${BASE_CLASS}__swatch`,
  };

  /**
   * @class ContinuousSwatchView
   * @classdesc A view for a continuous swatch-value pair in a legend.
   * @classcategory Views/Maps/Legend
   * @name ContinuousSwatchView
   * @augments Backbone.View
   * @screenshot views/maps/legend/ContinuousSwatchView.png
   * @since 0.0.0
   * @constructs
   */
  const ContinuousSwatchView = Backbone.View.extend(
    /** @lends ContinuousSwatchView.prototype */ {
      /** @inheritdoc */
      className: BASE_CLASS,

      /** @inheritdoc */
      template: _.template(Template),

      /**
       * The palette model that this view uses
       * @type {AssetColorPalette}
       */
      model: null,

      /** @inheritdoc */
      initialize(options) {
        this.model = options.model;

        this.stopListening(this.model, "change:minVal change:maxVal");
        this.listenTo(this.model, "change:minVal change:maxVal", this.render);
      },

      /** @inheritdoc */
      render() {
        const colors = this.model.get("colors");
        const min =
          colors.first().get("value") === "min"
            ? this.model.get("minVal")
            : colors.first().get("value");
        const max =
          colors.last().get("value") === "max"
            ? this.model.get("maxVal")
            : colors.last().get("value");
        const mid = (min + max) / 2;
        const range = max - min;
        this.$el.html(
          this.template({
            classNames: CLASS_NAMES,
            min: Utilities.formatNumber(min, range),
            mid: Utilities.formatNumber(mid, range),
            max: Utilities.formatNumber(max, range),
          }),
        );

        const gradient = colors.reduce(
          (memo, color) => memo + (memo ? ", " : "") + color.getCss(),
          "",
        );

        this.$(`.${CLASS_NAMES.swatch}`).css(
          "background-image",
          `linear-gradient(${gradient})`,
        );
      },
    },
  );

  return ContinuousSwatchView;
});
