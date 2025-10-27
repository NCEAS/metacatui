define(["backbone", "models/sysmeta/VersionTracker"], (
  Backbone,
  VersionTracker,
) => {
  "use strict";

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

  const BUTTON_CLASSES = `${CLASS_NAMES.BUTTON} ${CLASS_NAMES.BUTTON_LINK} ${CLASS_NAMES.BUTTON_LINK_NEUTRAL}`;

  /**
   * @class VersionNavigationView
   * @classdesc A view showing buttons that lead to the previous and next
   * versions of a metadata document, as well as a link to show all versions if
   * configured.
   * @since 0.0.0
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
       *  to view all versions of the document
       */
      initialize(options = {}) {
        this.pid = options.pid;
        this.showAllVersionsLink = options.showAllVersionsLink !== false;
        this.versionTracker = VersionTracker.get();
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

        this.el.innerHTML = this.template();
        const { prev, next, allVersionsLink } = this.selectContainers();
        const versions = await this.versionTracker.getAdjacent(this.pid, true);

        if (versions.next) {
          const nextUrl = this.getViewUrl(versions.next);
          next.innerHTML = this.prevNextBtnTemplate(nextUrl, "next");
        }
        if (versions.prev) {
          const prevUrl = this.getViewUrl(versions.prev);
          prev.innerHTML = this.prevNextBtnTemplate(prevUrl, "prev");
        }
        if (this.showAllVersionsLink && (versions.prev || versions.next)) {
          const allUrl = this.getAllVersionsUrl(this.pid);
          allVersionsLink.innerHTML = this.allVersionsTemplate(allUrl);
        }

        return this;
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

      // TODO: Implement version history page
      getAllVersionsUrl(_pid) {
        return "";
        // if (!pid) return "";
        // return `${MetacatUI.root}/versionHistory/${encodeURIComponent(pid)}`;
      },
    },
  );

  return VersionNavigationView;
});
