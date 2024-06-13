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
       * The colors collection that this view uses
       * @type {AssetColors}
       */
      collection: null,

      /** @inheritdoc */
      initialize(options) {
        this.collection = options.collection;
      },

      /** @inheritdoc */
      render() {
        const min = this.collection.first().get("value");
        const max = this.collection.last().get("value");
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

        const gradient = this.collection.reduce(
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
