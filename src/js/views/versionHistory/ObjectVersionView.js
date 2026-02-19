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
    },
    LATEST: {
      label: "Latest",
      className: CLASS_NAMES.badgeTypes.LATEST,
    },
    NEWER: {
      label: "Newer",
      className: CLASS_NAMES.badgeTypes.NEWER,
    },
    OLDER: {
      label: "Older",
      className: CLASS_NAMES.badgeTypes.OLDER,
    },
    CURRENT: {
      label: "This Version",
      className: CLASS_NAMES.badgeTypes.CURRENT,
    },
    EMPTY: {
      label: "",
      className: CLASS_NAMES.badgeTypes.EMPTY,
    },
    PRIVATE: {
      label: "Private",
      className: CLASS_NAMES.badgeTypes.PRIVATE,
    },
    NOTFOUND: {
      label: "Not Found",
      className: CLASS_NAMES.badgeTypes.NOTFOUND,
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
       * Set to false to hide the status badge.
       * @type {boolean}
       */
      showStatus: true,

      /**
       * Initializes the ObjectVersionView.
       * @param {object} options - Options to configure the view.
       * @param {DataONEObject} options.model - The DataONEObject model to
       * represent in this view.
       */
      initialize(options) {
        this.model = options.model;
        if (options.showStatus === false) {
          this.showStatus = false;
        }
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
        const status = this.getStatus();

        let doiBadge = "<span></span>";
        if (this.isDOI()) {
          doiBadge = `<span class="${CLASS_NAMES.badge} ${CLASS_NAMES.badgeTypes.DOI}">${starIcon} DOI</span>`;
        }
        const htmlIdentifier = Utilities.encodeHTML(identifier);
        const statusBadge = `<span class="${CLASS_NAMES.badge} ${status.className}">${status.label}</span>`;
        return `
        <time class="${CLASS_NAMES.date}" datetime="${isoDate}" title="${friendlyDate}">${friendlyDate}</time>
          <a href="${viewUrl}" class="${CLASS_NAMES.link}" target="_blank" rel="noopener">
            <h4 class="${CLASS_NAMES.title}">${htmlIdentifier}</h4>
          </a>
          <div class ="${CLASS_NAMES.badgesContainer}">
            ${doiBadge}
            ${statusBadge}
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
       * Determine the status badge for the current model.
       * @returns {{label: string, className: string}} Status display info.
       */
      getStatus() {
        if (this.showStatus === false) {
          return STATUS.EMPTY;
        }

        const { obsoletes, obsoletedBy, errors, versionHistory } =
          this.model.toJSON();

        if (this.referencePid === this.model.get("identifier")) {
          return STATUS.CURRENT;
        }
        if (errors?.length) {
          // For now support only one error per object
          const error = errors[0];
          if (error === 401) {
            return STATUS.PRIVATE;
          }
          if (error === 404) {
            return STATUS.NOTFOUND;
          }
        }
        if (!obsoletes && obsoletedBy) {
          return STATUS.FIRST;
        }
        if (obsoletes && !obsoletedBy) {
          return STATUS.LATEST;
        }

        const index = versionHistory?.[this.referencePid];
        if (index > 0) {
          return STATUS.NEWER;
        }
        if (index < 0) {
          return STATUS.OLDER;
        }

        return STATUS.EMPTY;
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
