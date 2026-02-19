"use strict";

define(["backbone", "common/Utilities", "common/DateUtility"], (
  Backbone,
  Utilities,
  DateUtility,
) => {
  // SVG for the star icon used in the DOI badge
  const starIcon = `<i class="icon-star"></i>`;

  // The prefix for BEM-style class names for this view
  const BASE_CLASS = "object-version";

  /**
   * CSS class names used throughout the ObjectVersionView.
   * @enum {string}
   */
  const CLASS_NAMES = {
    base: BASE_CLASS,
    title: `${BASE_CLASS}__title`,
    link: `${BASE_CLASS}__link`,
    badgesContainer: `${BASE_CLASS}__badges`,
    badge: `label object-version__badge`,
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
      description: "This is the first version of this object.",
    },
    LATEST: {
      label: "Latest",
      className: CLASS_NAMES.badgeTypes.LATEST,
      description: "This is the newest version of this object.",
    },
    NEWER: {
      label: "Newer",
      className: CLASS_NAMES.badgeTypes.NEWER,
      description: "This was created more recently than the reference version.",
    },
    OLDER: {
      label: "Older",
      className: CLASS_NAMES.badgeTypes.OLDER,
      description: "This was created before the reference version.",
    },
    CURRENT: {
      label: "This Version",
      className: CLASS_NAMES.badgeTypes.CURRENT,
      description:
        "You are viewing the version history of this version, all versions are relative to this one.",
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
        "This version is referenced in the version history but was not found in this data repository.",
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
       * Initializes the ObjectVersionView.
       * @param {object} options - Options to configure the view.
       * @param {DataONEObject} options.model - The DataONEObject model to
       * represent in this view.
       */
      initialize(options) {
        this.model = options.model;
        if (typeof options.status === "string") {
          this.status = options.status;
        }
        this.referencePid = options.referencePid || null;
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

        return `
        <time class="${CLASS_NAMES.date}" datetime="${isoDate}" title="${friendlyDate}">${friendlyDate}</time>
          <a href="${viewUrl}" class="${CLASS_NAMES.link}" target="_blank" rel="noopener">
            <h4 class="${CLASS_NAMES.title}">${htmlIdentifier}</h4>
          </a>
          <div class ="${CLASS_NAMES.badgesContainer}">
            ${doiBadge}
            ${errorBadge}
            ${keyPointsBadge}
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
        if (this.referencePid === this.model.get("identifier")) {
          status = STATUS.CURRENT;
        }
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
          label: relativeDateString,
          className: status.className,
          description: status.description,
        });
      },

      /**
       * Get the badge that indicates any errors or warnings, like 401s or 404s.
       * @returns {string} HTML string for the badge.
       */
      getErrorBadge() {
        const errors = this.model.get("errors");
        let badges = "";
        if (errors?.length) {
          errors.array.forEach((error) => {
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
        return `<span class="${CLASS_NAMES.badge} ${className}" title="${description}">${label}</span>`;
        // TODO: add tooltip here using description.
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
        return this;
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
    },
  );

  return ObjectVersionView;
});
