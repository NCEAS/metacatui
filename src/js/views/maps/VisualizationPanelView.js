"use strict";

define([
  "backbone",
  "common/TrustedContentUtilities",
  "common/UriTemplateUtilities",
], (Backbone, trustedContent, UriTemplateUtilities) => {
  const BASE_CLASS = "visualization-panel";
  const CLASS_NAMES = {
    body: `${BASE_CLASS}__body`,
    closeButton: `${BASE_CLASS}__close-button`,
    header: `${BASE_CLASS}__header`,
    iframe: `${BASE_CLASS}__iframe`,
    open: `${BASE_CLASS}--open`,
    untrustedMessage: `${BASE_CLASS}__untrusted-message`,
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
        <p class="${CLASS_NAMES.untrustedMessage}">This content cannot be displayed here because its source is not in the list of trusted sources.</p>
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
   * @since 2.37.0
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
        this.handleMessage = (event) => {
          const iframe = this.el.querySelector(`.${CLASS_NAMES.iframe}`);
          if (!iframe || !iframe.contentWindow) return;

          if (
            typeof this.activeVisualizationOrigin === "string" &&
            this.activeVisualizationOrigin.length &&
            event.origin !== this.activeVisualizationOrigin
          ) {
            return;
          }

          if (!this.isSourceFromActiveIframe(iframe.contentWindow, event.source)) {
            return;
          }

          const data = event?.data;
          if (!data || typeof data !== "object") return;
          if (data.type !== "mcui:state") return;

          const version = data.version == null ? 1 : Number(data.version);
          if (!Number.isFinite(version) || version !== 1) return;
          if (typeof data.url !== "string" || !data.url.length) return;

          try {
            if (new URL(data.url).origin !== this.activeVisualizationOrigin) {
              return;
            }
          } catch (_e) {
            return;
          }

          this.trigger("mcui:state", {
            action: this.activeVisualizationAction || null,
            url: data.url,
            version,
          });
        };
      },

      /**
       * Check whether a postMessage source window belongs to the active
       * iframe's browsing context. This accepts the iframe window itself and
       * same-origin descendant frames within that iframe.
       * @param {Window} iframeWindow The active iframe content window.
       * @param {WindowProxy|null} sourceWindow The postMessage source window.
       * @returns {boolean} `true` when sourceWindow is the iframe or a descendant.
       * @since 0.0.0
       */
      isSourceFromActiveIframe(iframeWindow, sourceWindow) {
        if (!iframeWindow || !sourceWindow) {
          return false;
        }

        if (sourceWindow === iframeWindow) {
          return true;
        }

        let currentWindow = sourceWindow;
        let hops = 0;
        while (currentWindow && hops < 20) {
          if (currentWindow === iframeWindow) {
            return true;
          }

          let parentWindow;
          try {
            parentWindow = currentWindow.parent;
          } catch (_e) {
            return false;
          }

          if (!parentWindow || parentWindow === currentWindow) {
            return false;
          }

          currentWindow = parentWindow;
          hops += 1;
        }

        return false;
      },

      /**
       * Resolve expected postMessage origin for the current iframe action.
       * @param {object|null} action The active iframe action object.
       * @param {string} resolvedUrl The URL currently loaded in the iframe.
       * @returns {string|null} Strict origin expected for postMessage events.
       * @since 0.0.0
       */
      getExpectedMessageOrigin(action, resolvedUrl) {
        const templateUrl =
          typeof action?.url === "string" ? action.url : resolvedUrl;
        if (typeof templateUrl !== "string" || !templateUrl.length) {
          return null;
        }

        const baseUrl = UriTemplateUtilities.getTemplateBaseUrl(templateUrl);

        try {
          return new URL(baseUrl || resolvedUrl).origin;
        } catch (_e) {
          return null;
        }
      },

      /**
       * Open the panel and load the given URL in the iframe. If the URL is
       * not trusted, show a plain link fallback instead.
       * @param {string|object} payload The URL string to load or an object
       * with `{ url, action }` for URL-template-aware visualizations.
       */
      open(payload) {
        const resolvedUrl =
          typeof payload === "string" ? payload : payload?.url || "";
        this.activeVisualizationAction =
          payload && typeof payload === "object"
            ? payload.action || null
            : null;
        this.activeVisualizationOrigin = this.getExpectedMessageOrigin(
          this.activeVisualizationAction,
          resolvedUrl,
        );

        const iframe = this.el.querySelector(`.${CLASS_NAMES.iframe}`);
        const untrustedMessage = this.el.querySelector(
          `.${CLASS_NAMES.untrustedMessage}`,
        );
        const untrusted = this.el.querySelector(`.${CLASS_NAMES.untrusted}`);
        const untrustedLink = this.el.querySelector(
          `.${CLASS_NAMES.untrustedLink}`,
        );

        document.addEventListener("keydown", this.handleEscapeKey);
        window.addEventListener("message", this.handleMessage);

        if (trustedContent.isTrustedUrl(resolvedUrl)) {
          iframe.setAttribute(
            "sandbox",
            trustedContent.getTrustedIframeSandbox(resolvedUrl),
          );
          iframe.src = resolvedUrl;
          iframe.style.display = "";
          untrusted.style.display = "none";
        } else {
          iframe.removeAttribute("sandbox");
          iframe.removeAttribute("src");
          iframe.style.display = "none";

          if (trustedContent.isHttpUrl(resolvedUrl)) {
            untrustedMessage.textContent =
              "This content cannot be displayed here because its source is not in the list of trusted sources.";
            untrustedLink.href = resolvedUrl;
            untrustedLink.textContent = resolvedUrl;
            untrustedLink.style.display = "";
          } else {
            untrustedMessage.textContent =
              "This content cannot be displayed here because the URL protocol is unsafe.";
            untrustedLink.removeAttribute("href");
            untrustedLink.textContent = "";
            untrustedLink.style.display = "none";
          }

          untrusted.style.display = "";
        }

        this.el.classList.add(CLASS_NAMES.open);
      },

      /**
       * Close the panel, stop the iframe, and fire a "close" event.
       */
      close() {
        const iframe = this.el.querySelector(`.${CLASS_NAMES.iframe}`);
        if (iframe) iframe.removeAttribute("src");
        this.el.classList.remove(CLASS_NAMES.open);
        document.removeEventListener("keydown", this.handleEscapeKey);
        window.removeEventListener("message", this.handleMessage);
        this.activeVisualizationAction = null;
        this.activeVisualizationOrigin = null;
        this.trigger("close");
      },

      /**
       * Cleanup global handlers if the view is destroyed while open.
       */
      onClose() {
        document.removeEventListener("keydown", this.handleEscapeKey);
        window.removeEventListener("message", this.handleMessage);
        const iframe = this.el.querySelector(`.${CLASS_NAMES.iframe}`);
        if (iframe) iframe.removeAttribute("src");
        this.activeVisualizationAction = null;
        this.activeVisualizationOrigin = null;
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
