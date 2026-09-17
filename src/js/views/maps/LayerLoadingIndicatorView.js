"use strict";

define(["underscore", "backbone"], (_, Backbone) => {
  const template = `
    <div class="map-status-bar__loading-row-inner">
      <div class="map-status-bar__loading-bar"></div>
      <div class="map-status-bar__loading-message">
        <span class="map-status-bar__loading-text"></span>
      </div>
    </div>
  `;

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
   * @since 0.0.0
   * @constructs
   */
  const LayerLoadingIndicatorView = Backbone.View.extend(
    /** @lends LayerLoadingIndicatorView.prototype */ {
      /** @inheritdoc */
      className: "map-status-bar__loading-row",

      /**
       * The primary HTML template for this view
       * @type {Underscore.template}
       */
      template: _.template(template),

      /** @inheritdoc */
      render() {
        this.$el.html(this.template());
        this.el.setAttribute("aria-live", "polite");
        this.el.setAttribute("aria-atomic", "true");
        this.messageEl = this.el.querySelector(
          ".map-status-bar__loading-text",
        );
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
       */
      setMessage(message) {
        if (this.messageEl) this.messageEl.innerHTML = message || "";
      },
    },
  );

  return LayerLoadingIndicatorView;
});
