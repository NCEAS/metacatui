define([
  "jquery",
  "backbone",
  "models/sysmeta/VersionTracker",
  "semantic",
  "common/ErrorUtilities",
  "common/Utilities",
], ($, Backbone, VersionTracker, Semantic, ErrorUtilities, Utilities) => {
  "use strict";

  // Define class names used in the view
  const CLASS_NAMES = {
    BASE: "version-navigation-view",
    PREV_VERSION_CONTAINER: "prev-version-container",
    NEXT_VERSION_CONTAINER: "next-version-container",
    ALL_VERSIONS_LINK_CONTAINER: "all-versions-link-container",

    // Bootstrap
    BUTTON: "btn",
    BUTTON_LINK: "btn-link",
    BUTTON_LINK_NEUTRAL: "btn-link--neutral",
    BUTTON_MINI: "btn-mini",
  };

  // Define button classes
  const BUTTON_CLASSES = `${CLASS_NAMES.BUTTON} ${CLASS_NAMES.BUTTON_LINK} ${CLASS_NAMES.BUTTON_LINK_NEUTRAL}`;

  // Default document type for tooltip descriptions
  const DEFAULT_DOC_TYPE = "document";

  /**
   * Build default tooltip descriptions based on a document type.
   * @param {string} [type] Document type to interpolate.
   * @returns {{prev: string, next: string, all: string}} The default
   * descriptions.
   */
  const GET_DEFAULT_DESCRIPTION = (type) => {
    const docType = type || DEFAULT_DOC_TYPE;
    return {
      prev: `View the previous version of this ${docType}`,
      next: `View the next version of this ${docType}`,
      all: `Browse all versions of this ${docType}`,
    };
  };

  /**
   * @class VersionNavigationView
   * @classdesc A view showing buttons that lead to the previous and next
   * versions of a metadata document, as well as a link to show all versions if
   * configured.
   * @since 2.36.0
   * @classcategory Views
   * @augments Backbone.View
   * @class
   * @screenshot views/VersionNavigationView.png
   */
  const VersionNavigationView = Backbone.View.extend(
    /** @lends MetadataView.prototype */ {
      /**
       * The type of the view
       * @type {string}
       */
      type: "VersionNavigationView",

      /** @inheritdoc */
      tagName: "span",

      /** @inheritdoc */
      className: CLASS_NAMES.BASE,

      /**
       * Settings for the tooltips
       * @type {object}
       * @see https://fomantic-ui.com/modules/popup.html#/settings
       */
      tooltipSettings: {
        position: "top center",
        variation: `${Semantic.CLASS_NAMES.variations.inverted} ${Semantic.CLASS_NAMES.variations.mini}`,
        delay: {
          show: 400,
          hide: 20,
        },
        exclusive: true,
      },

      /**
       * Descriptions for the tooltips
       * @type {object}
       */
      descriptions: GET_DEFAULT_DESCRIPTION(),

      /**
       * Template for the view
       * @returns {string} The HTML string for the view
       */
      template() {
        const CN = CLASS_NAMES;

        return `
            <span class="${CN.PREV_VERSION_CONTAINER}"></span>
            <span class="${CN.ALL_VERSIONS_LINK_CONTAINER}"></span>
            <span class="${CN.NEXT_VERSION_CONTAINER}"></span>
        `;
      },

      /**
       * Template for the Previous and Next version buttons
       * @param {string} url The URL for the button
       * @param {"next"|"prev"} direction The direction of the button
       * @returns {string} The HTML string for the button
       */
      prevNextBtnTemplate(url, direction) {
        if (!url) return "";
        const text = direction === "next" ? "Next" : "Previous";
        const icon = direction === "next" ? "right" : "left";
        const iconHTML = `<span class="icon-arrow-${icon}" aria-hidden="true"></span>`;

        return `
          <a href=${url} class="${BUTTON_CLASSES}" title="${text} Version">
            ${iconHTML}
          </a>
        `;
      },

      /**
       * Template for the All Versions link
       * @param {string} url The URL for the link
       * @returns {string} The HTML string for the link
       */
      allVersionsTemplate(url) {
        const extraStyles = url ? "" : " pointer-events: none; opacity: 0.8;";
        return `
          <a href="${url}" class="${BUTTON_CLASSES}" title="View All Versions" style="${extraStyles}">
            Version History
          </a>
        `;
      },

      /**
       * Initialize the VersionNavigationView
       * @param {object} options Object containing the view's options
       * @param {pid} options.pid The PID of the metadata document
       * @param {boolean} [options.showAllVersionsLink] Whether to show a link
       * to view all versions of the document. This will be always be false if
       * the AppModel's showVersionHistory setting is false.
       * @param {object} [options.descriptions] An object containing custom
       * descriptions for the tooltips
       * @param {string} [options.documentType] The type of document (e.g.
       * dataset, article, etc.) to use in the default tooltip descriptions
       * @param {AbortSignal} [options.signal] Signal used to abort version
       * lookups
       */
      initialize(options = {}) {
        this.pid = options.pid;
        this.signal = options.signal || null;
        this.showAllVersionsLink = options.showAllVersionsLink !== false;
        if (
          MetacatUI.appModel &&
          MetacatUI.appModel.get("showVersionHistory") === false
        ) {
          this.showAllVersionsLink = false;
        }
        if (options.descriptions) {
          this.descriptions = { ...this.descriptions, ...options.descriptions };
        } else if (options.documentType) {
          this.descriptions = GET_DEFAULT_DESCRIPTION(options.documentType);
        }
      },

      /**
       * Convenience method to select important containers in the view
       * @returns {object} An object containing references to the containers for
       * the previous & next button containers and the all versions link
       * container.
       */
      selectContainers() {
        this.$prevVersionContainer = this.el.querySelector(
          `.${CLASS_NAMES.PREV_VERSION_CONTAINER}`,
        );
        this.$nextVersionContainer = this.el.querySelector(
          `.${CLASS_NAMES.NEXT_VERSION_CONTAINER}`,
        );
        this.$allVersionsLinkContainer = this.el.querySelector(
          `.${CLASS_NAMES.ALL_VERSIONS_LINK_CONTAINER}`,
        );
        return {
          prev: this.$prevVersionContainer,
          next: this.$nextVersionContainer,
          allVersionsLink: this.$allVersionsLinkContainer,
        };
      },

      /** @inheritdoc */
      async render() {
        if (!this.pid) return this;
        if (!this.versionTracker) {
          const metaServiceUrl = await Utilities.awaitMetacatUI({
            property: "metaServiceUrl",
          });
          if (this.signal?.aborted) return this;
          this.versionTracker = new VersionTracker({ metaServiceUrl });
        }

        this.el.innerHTML = this.template();
        const { prev, next, allVersionsLink } = this.selectContainers();
        let nextPid;
        let prevPid;
        try {
          nextPid = await this.versionTracker.getNext(this.pid, {
            signal: this.signal,
          });
          if (this.signal?.aborted) return this;
          prevPid = await this.versionTracker.getPrev(this.pid, {
            signal: this.signal,
          });
          if (this.signal?.aborted) return this;
        } catch (error) {
          if (ErrorUtilities.isAbortError(error)) return this;
          throw error;
        }

        if (nextPid) {
          const nextUrl = this.getViewUrl(nextPid);
          next.innerHTML = this.prevNextBtnTemplate(nextUrl, "next");
          this.addTooltip(next, this.descriptions.next);
        }
        if (prevPid) {
          const prevUrl = this.getViewUrl(prevPid);
          prev.innerHTML = this.prevNextBtnTemplate(prevUrl, "prev");
          this.addTooltip(prev, this.descriptions.prev);
        }
        if (prevPid || nextPid) {
          const allUrl = this.getAllVersionsUrl(this.pid);
          allVersionsLink.innerHTML = this.allVersionsTemplate(allUrl);
          this.addTooltip(allVersionsLink, this.descriptions.allVersions);
        }

        return this;
      },

      /**
       * Add a tooltip to an element
       * @param {HTMLElement} element The element to add the tooltip to
       * @param {string} content The content of the tooltip
       */
      addTooltip(element, content) {
        if (!element || !content) return;
        $(element)
          .find("a")
          .popup({
            content,
            ...this.tooltipSettings,
          });
      },

      /**
       * Get the URL to view a metadata document by its PID
       * @param {string} pid The PID of the metadata document
       * @returns {string} The URL to view the metadata document
       */
      getViewUrl(pid) {
        if (!pid) return "";
        return `${MetacatUI.root}/view/${encodeURIComponent(pid)}`;
      },

      /**
       * Get the URL to view all versions of a metadata document by its PID
       * @param {string} pid The PID of the metadata document
       * @returns {string} The URL to view all versions of the metadata document
       */
      getAllVersionsUrl(pid) {
        if (!pid || !this.showAllVersionsLink) return "";
        return `${MetacatUI.root}/versionHistory/${encodeURIComponent(pid)}`;
      },

      /** Clean up tasks before the view is closed */
      onClose() {
        this.$el.find(".popup").popup("destroy");
      },

      /** @inheritdoc */
      remove() {
        this.onClose();
        return Backbone.View.prototype.remove.call(this);
      },
    },
  );

  return VersionNavigationView;
});
