"use strict";

define(["backbone"], (Backbone) => {
  /** CSS class names used by this view. */
  const CLASS_NAMES = {
    row: "map-status-bar__loading-row",
    rowInner: "map-status-bar__loading-row-inner",
    bar: "map-status-bar__loading-bar",
    message: "map-status-bar__loading-message",
    text: "map-status-bar__loading-text",
  };

  /**
   * @class LayerLoadingIndicatorView
   * @classdesc A small progress row (an animated bar plus a text message) that
   * communicates map layer loading progress. This view is purely presentational: it
   * has no concept of timing or delays, it only ever renders whatever message it is
   * given. The animation used to reveal/hide this view is owned by the parent
   * {@link MapStatusBarView}.
   * @classcategory Views/Maps
   * @name LayerLoadingIndicatorView
   * @augments Backbone.View
   * @screenshot views/maps/LayerLoadingIndicatorView.png
   * @since 0.0.0
   * @constructs
   */
  const LayerLoadingIndicatorView = Backbone.View.extend(
    /** @lends LayerLoadingIndicatorView.prototype */ {
      /** @inheritdoc */
      className: CLASS_NAMES.row,

      /**
       * The primary HTML template for this view
       * @type {string}
       */
      template: `
        <div class="${CLASS_NAMES.rowInner}">
          <div class="${CLASS_NAMES.bar}"></div>
          <div class="${CLASS_NAMES.message}">
            <span class="${CLASS_NAMES.text}"></span>
          </div>
        </div>
      `,

      /** @inheritdoc */
      render() {
        this.$el.html(this.template);
        this.el.setAttribute("aria-live", "polite");
        this.el.setAttribute("aria-atomic", "true");
        this.messageEl = this.el.querySelector(`.${CLASS_NAMES.text}`);
        return this;
      },

      /**
       * Update the message shown next to the loading bar. The message may
       * contain HTML markup carried over from a layer's `label` (see
       * `LayerLoadingCoordinator.getLoadingLayerLabel`), the same trusted,
       * config-authored content already rendered as HTML by the layer menu
       * (`LayerItemView`), so it's set here via `innerHTML` rather than
       * `textContent` to render the same way.
       * @param {string} message The message to display.
       * @since 0.0.0
       */
      setMessage(message) {
        if (this.messageEl) this.messageEl.innerHTML = message || "";
      },
    },
  );

  return LayerLoadingIndicatorView;
});
