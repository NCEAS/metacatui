"use strict";

define([
  "underscore",
  "backbone",
  "text!templates/maps/visualization-panel.html",
], (_, Backbone, Template) => {
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

  /**
   * Tests a URL against the app's trustedContentSources list.
   * @param {string} url The URL to test.
   * @returns {boolean} True if the URL is trusted or the list is empty/absent.
   */
  function isTrustedUrl(url) {
    const sources = MetacatUI?.appModel?.get("trustedContentSources") ?? [];
    if (!sources.length) return false;
    return sources.some((pattern) => {
      // Convert glob-style wildcards to a regex.
      const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
      const regexStr = escaped.replace(/\*/g, ".*");
      return new RegExp(`^${regexStr}$`, "i").test(url);
    });
  }

  /**
   * @class VisualizationPanelView
   * @classdesc A full-screen overlay panel that displays an external
   * visualization application in an iframe above the map. Opened by clicking
   * the "Explore in App" button on a ZoomPresetView card that has an
   * `iframeUrl` configured. Closed by the close button, the Escape key, or
   * when a different card action is triggered.
   *
   * Security: the iframe `src` is only set when the URL matches the app's
   * `trustedContentSources` configuration. Untrusted URLs are displayed as a
   * plain link instead.
   * @classcategory Views/Maps
   * @name VisualizationPanelView
   * @augments Backbone.View
   * @since 2.x.0
   * @constructs VisualizationPanelView
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
       * Open the panel and load the given URL in the iframe. If the URL is
       * not trusted, show a plain link fallback instead.
       * @param {string} url The URL to load.
       * @param {string} [permissions] The
       * sandbox attribute value for the iframe.
       */
      open(url, permissions = "allow-scripts allow-same-origin") {
        const iframe = this.el.querySelector(`.${CLASS_NAMES.iframe}`);
        const untrusted = this.el.querySelector(`.${CLASS_NAMES.untrusted}`);
        const untrustedLink = this.el.querySelector(
          `.${CLASS_NAMES.untrustedLink}`,
        );

        if (isTrustedUrl(url)) {
          if (permissions) {
            iframe.setAttribute("sandbox", permissions);
          } else {
            iframe.removeAttribute("sandbox");
          }
          iframe.src = url;
          iframe.style.display = "";
          untrusted.style.display = "none";
        } else {
          iframe.removeAttribute("sandbox");
          iframe.src = "";
          iframe.style.display = "none";
          untrustedLink.href = url;
          untrustedLink.textContent = url;
          untrusted.style.display = "";
        }

        this.el.classList.add(CLASS_NAMES.open);
        this._boundEscapeHandler = this._onEscape.bind(this);
        document.addEventListener("keydown", this._boundEscapeHandler);
      },

      /**
       * Close the panel, stop the iframe, and fire a "close" event.
       */
      close() {
        const iframe = this.el.querySelector(`.${CLASS_NAMES.iframe}`);
        if (iframe) iframe.src = "";
        this.el.classList.remove(CLASS_NAMES.open);
        if (this._boundEscapeHandler) {
          document.removeEventListener("keydown", this._boundEscapeHandler);
          this._boundEscapeHandler = null;
        }
        this.trigger("close");
      },

      /**
       * Handle keydown events while the panel is open.
       * @param {KeyboardEvent} e
       */
      _onEscape(e) {
        if (e.key === "Escape") this.close();
      },

      /**
       * Render the panel. The panel is hidden by default; call `open()` to
       * show it.
       * @returns {VisualizationPanelView} Returns the rendered view element.
       */
      render() {
        this.el.innerHTML = _.template(Template)({ classNames: CLASS_NAMES });
        return this;
      },
    },
  );

  return VisualizationPanelView;
});
