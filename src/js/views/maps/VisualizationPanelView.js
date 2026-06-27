"use strict";

define(["backbone", "common/TrustedContentUtilities"], (
  Backbone,
  trustedContent,
) => {
  const BASE_CLASS = "visualization-panel";
  const CLASS_NAMES = {
    body: `${BASE_CLASS}__body`,
    closeButton: `${BASE_CLASS}__close-button`,
    header: `${BASE_CLASS}__header`,
    iframe: `${BASE_CLASS}__iframe`,
    open: `${BASE_CLASS}--open`,
    untrusted: `${BASE_CLASS}__untrusted`,
    untrustedLink: `${BASE_CLASS}__untrusted-link`,
  };

  const VIEW_TEMPLATE = `
    <div class="${CLASS_NAMES.header}">
      <button class="${CLASS_NAMES.closeButton} map-view__button" type="button" aria-label="Close visualization"><i class="icon-remove"></i></button>
    </div>
    <div class="${CLASS_NAMES.body}">
      <iframe
        class="${CLASS_NAMES.iframe}"
        title="Visualization"
      ></iframe>
      <div class="${CLASS_NAMES.untrusted}" style="display:none">
        <p>This content cannot be displayed here because its source is not in the list of trusted sources.</p>
        <a class="${CLASS_NAMES.untrustedLink} map-view__button map-view__button--emphasis" target="_blank" rel="noopener noreferrer">
          <i class="icon icon-external-link"></i>
          Open in Browser
        </a>
      </div>
    </div>
  `;

  /**
   * @class VisualizationPanelView
   * @classdesc A full-screen overlay panel that displays an external
   * visualization application in an iframe above the map. Opened by clicking
   * an 'iframe' type button on a ViewfinderCardView card. Closed by clicking
   * the close button in the upper right, pressing the Escape key, or by clicking
   * another card action.
   *
   * Security: the iframe `src` is only set when the URL matches the app's
   * `trustedContentSources` configuration. Untrusted URLs are displayed as a
   * plain link instead.
   * @classcategory Views/Maps
   * @name VisualizationPanelView
   * @augments Backbone.View
   * @constructs VisualizationPanelView
   * @screenshot views/maps/VisualizationPanelView.png
   * @since 0.0.0
   */
  const VisualizationPanelView = Backbone.View.extend(
    /** @lends VisualizationPanelView.prototype */ {
      /**
       * The type of View this is
       * @type {string}
       */
      type: "VisualizationPanelView",

      /** @inheritdoc */
      className: BASE_CLASS,

      /**
       * The events this view will listen to and the associated function to
       * call.
       * @type {object}
       */
      events() {
        return {
          [`click .${CLASS_NAMES.closeButton}`]: "close",
        };
      },

      /**
       * Bind the Escape-key handler once so the same reference can be
       * added and removed from the document.
       */
      initialize() {
        this.handleEscapeKey = (e) => {
          if (e.key === "Escape") this.close();
        };
      },

      /**
       * Open the panel and load the given URL in the iframe. If the URL is
       * not trusted, show a plain link fallback instead.
       * @param {string} url The URL to load.
       */
      open(url) {
        const iframe = this.el.querySelector(`.${CLASS_NAMES.iframe}`);
        const untrusted = this.el.querySelector(`.${CLASS_NAMES.untrusted}`);
        const untrustedLink = this.el.querySelector(
          `.${CLASS_NAMES.untrustedLink}`,
        );

        if (trustedContent.isTrustedUrl(url)) {
          iframe.setAttribute(
            "sandbox",
            trustedContent.getTrustedIframeSandbox(url),
          );
          iframe.src = url;
          iframe.style.display = "";
          untrusted.style.display = "none";
        } else {
          iframe.removeAttribute("sandbox");
          iframe.removeAttribute("src");
          iframe.style.display = "none";
          untrustedLink.href = url;
          untrustedLink.textContent = url;
          untrusted.style.display = "";
        }

        this.el.classList.add(CLASS_NAMES.open);
        document.addEventListener("keydown", this.handleEscapeKey);
      },

      /**
       * Close the panel, stop the iframe, and fire a "close" event.
       */
      close() {
        const iframe = this.el.querySelector(`.${CLASS_NAMES.iframe}`);
        if (iframe) iframe.removeAttribute("src");
        this.el.classList.remove(CLASS_NAMES.open);
        document.removeEventListener("keydown", this.handleEscapeKey);
        this.trigger("close");
      },

      /**
       * Cleanup global handlers if the view is destroyed while open.
       */
      onClose() {
        document.removeEventListener("keydown", this.handleEscapeKey);
        const iframe = this.el.querySelector(`.${CLASS_NAMES.iframe}`);
        if (iframe) iframe.removeAttribute("src");
      },

      /**
       * Render the panel. The panel is hidden by default; call `open()` to
       * show it.
       * @returns {VisualizationPanelView} Returns the rendered view element.
       */
      render() {
        this.el.innerHTML = VIEW_TEMPLATE;
        return this;
      },
    },
  );

  return VisualizationPanelView;
});
