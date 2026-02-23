"use strict";

define([
  "jquery",
  "backbone",
  "common/Utilities",
  "common/DateUtility",
  "semantic",
], ($, Backbone, Utilities, DateUtility, Semantic) => {
  // SVG for the star icon used in the DOI badge
  const starIcon = `<i class="icon-star"></i>`;

  // The prefix for BEM-style class names for this view
  const BASE_CLASS = "object-version";

  // Semantic UI class names for variations, used in tooltipSettings
  const SEM_VARIATIONS = Semantic.CLASS_NAMES.variations;

  /**
   * CSS class names used throughout the ObjectVersionView.
   * @enum {string}
   */
  const CLASS_NAMES = {
    base: BASE_CLASS,
    title: `${BASE_CLASS}__title`,
    link: `${BASE_CLASS}__link`,
    badgesContainer: `${BASE_CLASS}__badges`,
    label: `label`, // Bootstrap
    badge: `object-version__badge`,
    date: `${BASE_CLASS}__date`,
    size: `${BASE_CLASS}__size`,
    hidden: `${BASE_CLASS}--hidden`,
    doi: `${BASE_CLASS}--doi`,
    badgeTypes: {
      FIRST: `${BASE_CLASS}__badge--first`,
      LATEST: `${BASE_CLASS}__badge--latest`,
      NEWER: `${BASE_CLASS}__badge--newer`,
      OLDER: `${BASE_CLASS}__badge--older`,
      EMPTY: `${BASE_CLASS}__badge--empty`,
      CURRENT: `${BASE_CLASS}__badge--current`,
      PRIVATE: `${BASE_CLASS}__badge--private`,
      NOTFOUND: `${BASE_CLASS}__badge--not-found`,
      DOI: `${BASE_CLASS}__badge--doi`,
    },
  };

  const STATUS = {
    FIRST: {
      label: "First",
      className: CLASS_NAMES.badgeTypes.FIRST,
      description: "This version is the first in the series.",
    },
    LATEST: {
      label: "Latest",
      className: CLASS_NAMES.badgeTypes.LATEST,
      description: "This version is the latest in the series.",
    },
    NEWER: {
      label: (timeDiff) => `${timeDiff} Newer`,
      className: CLASS_NAMES.badgeTypes.NEWER,
      description: (timeDiff) =>
        `This version was created ${timeDiff} after the reference version.`,
    },
    OLDER: {
      label: (timeDiff) => `${timeDiff} Older`,
      className: CLASS_NAMES.badgeTypes.OLDER,
      description: (timeDiff) =>
        `This version was created ${timeDiff} before the reference version.`,
    },
    AHEAD: {
      label: (index, versionWord) => `${index} ${versionWord} Ahead`,
      className: CLASS_NAMES.badgeTypes.NEWER,
      description: (versionDiff, versionWord) =>
        `This version is ${versionDiff} ${versionWord} ahead of the reference version`,
    },
    BEHIND: {
      label: (index, versionWord) => `${index} ${versionWord} Behind`,
      className: CLASS_NAMES.badgeTypes.OLDER,
      description: (versionDiff, versionWord) =>
        `This version is ${versionDiff} ${versionWord} behind the reference version`,
    },
    CURRENT: {
      label: "This Version",
      className: CLASS_NAMES.badgeTypes.CURRENT,
      description:
        "All other versions are shown relative to this reference version.",
    },
    EMPTY: {
      label: "",
      className: CLASS_NAMES.badgeTypes.EMPTY,
      description: "",
    },
    PRIVATE: {
      label: "Private",
      className: CLASS_NAMES.badgeTypes.PRIVATE,
      description:
        "This version is private and cannot be accessed with your current credentials. Login with an account that has access to this version to view it.",
    },
    NOTFOUND: {
      label: "Not Found",
      className: CLASS_NAMES.badgeTypes.NOTFOUND,
      description:
        "This version is referenced in the history but was not found in this data repository.",
    },
    DOI: {
      label: `${starIcon} DOI`,
      className: CLASS_NAMES.badgeTypes.DOI,
      description:
        "This version has been published with a Data Object Identifier (DOI).",
    },
  };

  /**
   * @class ObjectVersionView
   * @classdesc Renders a single object version as an <li> element. An object
   * version displays the identifier, upload date, and a status badge indicating
   * whether this version is the first, latest, newer, or older relative to a
   * reference version. If the version is private or not found, appropriate
   * badges are shown. Clicking the version's identifier link opens the object's
   * view page in a new tab.
   * @classcategory Views/VersionHistory
   * @augments Backbone.View
   * @screenshot views/VersionHistory/ObjectVersionView.png
   * @since 0.0.0
   */
  const ObjectVersionView = Backbone.View.extend(
    /** @lends ObjectVersionView.prototype */ {
      /**
       * Identifier used when the application inspects view types.
       * @type {string}
       */
      type: "ObjectVersionView",

      /** @inheritdoc */
      tagName: "li",

      /** @inheritdoc */
      className: CLASS_NAMES.base,

      /**
       * Settings passed to the Formantic UI popup module to configure a tooltip
       * shown over item titles. The item must have a description set in order
       * for the tooltip to be shown.
       * @see https://fomantic-ui.com/modules/popup.html#/settings
       * @type {object|boolean}
       */
      tooltipSettings: {
        variation: `${SEM_VARIATIONS.mini} ${SEM_VARIATIONS.inverted}`,
        position: "top center",
        on: "hover",
        hoverable: true,
        delay: {
          show: 250,
          hide: 0,
        },
      },

      /**
       * Initializes the ObjectVersionView.
       * @param {object} options Options to configure the view.
       * @param {DataONEObject} options.model - The DataONEObject model to
       * represent in this view.
       * @param {string} [options.referencePid] The identifier of the
       * reference version to compare against for relative date badges. If not
       * provided, no relative date badges will be shown.
       * @param {object} [options.tooltipSettings] Optional settings to
       * override the default tooltipSettings for this view instance. See
       * tooltipSettings property for details on available settings and
       * defaults.
       */
      initialize(options) {
        this.model = options.model;
        this.referencePid = options.referencePid || null;
        if (
          options.tooltipSettings &&
          typeof options.tooltipSettings === "object"
        ) {
          this.tooltipSettings = options.tooltipSettings;
        }
        this.listenTo(this.model, "change", this.render);
      },

      /**
       * Determines if the current version is a DOI based on its identifier.
       * @returns {boolean} True if the version is a DOI, false otherwise.
       */
      isDOI() {
        const identifier = this.model.get("identifier");
        if (!identifier) return false;
        return this.model.isDOI(identifier);
      },

      /**
       * Generates the markup representing a single version entry.
       * @param {DataONEObject} model The DataONEObject model to represent.
       * @returns {string} The HTML string.
       */
      template(model) {
        const { identifier, dateUploaded } = model.toJSON();

        let friendlyDate = DateUtility.toLocalTimestampWithZone(dateUploaded);
        let isoDate = DateUtility.toISOString(dateUploaded);
        if (!friendlyDate) {
          friendlyDate = "Unknown Date";
          isoDate = "";
        }
        const viewUrl = this.createViewURL(model);
        const htmlIdentifier = Utilities.encodeHTML(identifier);

        const doiBadge = this.getDOIBadge();
        const dateBadge = this.getRelativeDateBadge();
        const errorBadge = this.getErrorBadge();
        const keyPointsBadge = this.getKeyPointsBadge();
        const versionOrderBadge = this.getVersionOrderBadge();

        return `
        <time class="${CLASS_NAMES.date}" datetime="${isoDate}" title="${friendlyDate}">${friendlyDate}</time>
          <a href="${viewUrl}" class="${CLASS_NAMES.link}" target="_blank" rel="noopener">
            <h4 class="${CLASS_NAMES.title}">${htmlIdentifier}</h4>
          </a>
          <div class ="${CLASS_NAMES.badgesContainer}">
            ${doiBadge}
            ${errorBadge}
            ${keyPointsBadge}
            ${versionOrderBadge}
            ${dateBadge}
          </div>
        `;
      },

      /**
       * Build a MetacatUI view URL for the given model.
       * @param {DataONEObject} model Model to build the URL for.
       * @returns {string} View URL for the object.
       */
      createViewURL(model) {
        // DataONEObject.createViewURL prefers seriesId here.
        return `${MetacatUI.root}/view/${encodeURIComponent(
          model.get("identifier"),
        )}`;
      },

      /**
       * Special badge for versions that are first or last in the version
       * history, or the current reference version.
       * @returns {string} HTML string for the badge.
       */
      getKeyPointsBadge() {
        const { obsoletes, obsoletedBy } = this.model.toJSON();

        let status = STATUS.EMPTY;
        if (!obsoletes && obsoletedBy) {
          status = STATUS.FIRST;
        }
        if (obsoletes && !obsoletedBy) {
          status = STATUS.LATEST;
        }
        return this.createBadge(status);
      },

      /**
       * Get the badge that indicates how old or new this version is (based on
       * dateUploaded) relative to the reference version. If it's the reference
       * version, return the "current" badge.
       * @returns {string} HTML string for the badge.
       */
      getRelativeDateBadge() {
        let status = STATUS.EMPTY;
        const emptyBadge = this.createEmptyBadge();
        if (this.referencePid === this.model.get("identifier")) {
          return emptyBadge;
        }
        const { collection } = this.model;
        const referenceModel = collection?.findWhere({
          identifier: this.referencePid,
        });
        if (!referenceModel) {
          return emptyBadge;
        }
        const referenceDate = referenceModel.get("dateUploaded");
        const thisDate = this.model.get("dateUploaded");
        if (!referenceDate || !thisDate) {
          return emptyBadge;
        }
        const thisDateObj = DateUtility.toDate(thisDate);
        const referenceDateObj = DateUtility.toDate(referenceDate);
        const relativeDateString = DateUtility.getRelativeDateString(
          thisDateObj,
          referenceDateObj,
          {
            newerWord: "",
            olderWord: "",
            currentWord: "current",
          },
        );
        if (relativeDateString === "current") {
          return emptyBadge;
        }
        if (thisDate > referenceDate) {
          status = STATUS.NEWER;
        }
        if (thisDate < referenceDate) {
          status = STATUS.OLDER;
        }
        return this.createBadge({
          label: status.label(relativeDateString),
          className: status.className,
          description: status.description(relativeDateString),
        });
      },

      /**
       * Get the badge that indicates how many versions ahead or behind this
       * version is relative to the reference version, based on the version
       * history index. If it's the reference version, return the "current"
       * badge.
       * @returns {string} HTML string for the badge.
       */
      getVersionOrderBadge() {
        const emptyBadge = this.createEmptyBadge();
        const vh = this.model.get("versionHistory");
        const refPid = this.referencePid;
        if (!vh || !refPid) return emptyBadge;
        const index = vh[refPid];
        if (!index && index !== 0) return emptyBadge;
        const absIndex = Math.abs(index);
        const versionWord = absIndex === 1 ? "version" : "versions";
        let settings = STATUS.EMPTY;
        if (absIndex === 0) {
          settings = STATUS.CURRENT;
        } else {
          settings = index > 0 ? STATUS.AHEAD : STATUS.BEHIND;
          settings = { ...settings };
          settings.label = settings.label(absIndex, versionWord);
          settings.description = settings.description(absIndex, versionWord);
        }

        return this.createBadge(settings);
      },

      /**
       * Get the badge that indicates any errors or warnings, like 401s or 404s.
       * @returns {string} HTML string for the badge.
       */
      getErrorBadge() {
        const errors = this.model.get("errors");
        let badges = "";
        if (errors?.length) {
          errors.forEach((error) => {
            if (error === 401) {
              badges += this.createBadge(STATUS.PRIVATE);
            } else if (error === 404) {
              badges += this.createBadge(STATUS.NOTFOUND);
            }
          });
        } else {
          badges += this.createEmptyBadge();
        }
        return badges;
      },

      /**
       * Get the DOI badge if this version has a DOI identifier.
       * @returns {string} HTML string for the DOI badge, or an empty string if
       * this version does not have a DOI.
       */
      getDOIBadge() {
        if (this.isDOI()) return this.createBadge(STATUS.DOI);
        return this.createEmptyBadge();
      },

      /**
       * Helper method to create a badge HTML string based on the given status.
       * @param {{label: string, className: string, description: string}} status
       * Status object containing label, CSS class name, and description for the
       * badge.
       * @returns {string} HTML string for the badge.
       */
      createBadge({ label, className, description }) {
        return `<span class="${CLASS_NAMES.label} ${CLASS_NAMES.badge} ${className}" title="${description}">${label}</span>`;
      },

      /**
       * Helper method to create an empty badge for spacing consistency when no
       * status badge is needed.
       * @returns {string} HTML string for an empty badge.
       */
      createEmptyBadge() {
        return this.createBadge(STATUS.EMPTY);
      },

      /** @inheritdoc */
      render() {
        this.removeTooltips();
        this.el.classList.remove(`${CLASS_NAMES.hidden}`);
        if (this.model.get("hiddenByUI") === true) {
          this.el.innerHTML = "";
          this.el.classList.add(`${CLASS_NAMES.hidden}`);
          return this;
        }
        this.el.innerHTML = this.template(this.model);
        if (this.isDOI()) {
          this.el.classList.add(`${CLASS_NAMES.doi}`);
        }
        this.addTooltips();
        return this;
      },

      /**
       * Add Semantic UI tooltips to badge elements based on their title attributes and the view's tooltipSettings.
       */
      addTooltips() {
        if (!this.tooltipSettings || !this.el.isConnected) {
          return;
        }
        const badgeElements = this.el.querySelectorAll(`.${CLASS_NAMES.badge}`);
        badgeElements.forEach((badge) => {
          const title = badge.getAttribute("title");
          const $badge = this.$(badge);
          if (title) {
            $badge.popup("destroy");
            $badge.popup({
              content: title,
              ...this.tooltipSettings,
            });
          } else {
            $badge.popup("destroy");
          }
        });
      },

      /**
       * Remove all Formantic popup instances from badge elements in this row.
       */
      removeTooltips() {
        const badgeElements = this.el.querySelectorAll(`.${CLASS_NAMES.badge}`);
        badgeElements.forEach((badge) => {
          this.$(badge).popup("destroy");
        });
      },

      /**
       * Swap the underlying DataONEObject instance and refresh bindings.
       * @param {DataONEObject} newModel The new DataONEObject model.
       */
      changeModel(newModel) {
        if (this.model !== newModel) {
          this.stopListening(this.model);
          this.model = newModel;
          this.listenTo(this.model, "change", this.render);
          this.render();
        }
      },

      /**
       * Clean up view resources before removal.
       */
      onClose() {
        this.removeTooltips();
      },

      /** @inheritdoc */
      remove() {
        this.onClose();
        return Backbone.View.prototype.remove.call(this);
      },
    },
  );

  return ObjectVersionView;
});
