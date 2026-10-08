"use strict";

define(["backbone"], (Backbone) => {
  const BASE_CLASS = "expansion-panel";
  const CLASS_NAMES = {
    BASE: BASE_CLASS,
    TOGGLE: `${BASE_CLASS}__toggle`,
    ICON: `${BASE_CLASS}__icon`,
    TITLE: `${BASE_CLASS}__title`,
    ICON_TOGGLE: `${BASE_CLASS}__icon-toggle`,
    CONTENT: `${BASE_CLASS}__content`,
    EXPANDED: "show-content",
    ICON_FONT: "icon",
    CARET_DOWN: "icon-caret-down",
    CARET_UP: "icon-caret-up",
  };
  const TOGGLE_CATEGORY_ATTRIBUTE = "data-toggle-category";
  const CONTENT_ID_SUFFIX = "layers";

  /**
   * @class MapAssetCategoryView
   * @classdesc Presents a category header and shows or hides its layers in the
   * editor.
   * @classcategory Views/Maps/MapEditor
   * @augments Backbone.View
   * @screenshot views/maps/mapEditor/MapAssetCategoryView.png
   * @since 0.0.0
   */
  const MapAssetCategoryView = Backbone.View.extend(
    /** @lends MapAssetCategoryView.prototype */ {
      /** @inheritdoc */
      tagName: "section",

      /** @inheritdoc */
      className: CLASS_NAMES.BASE,

      /** @inheritdoc */
      events: {
        [`click [${TOGGLE_CATEGORY_ATTRIBUTE}]`]: "toggleCategory",
      },

      /** Start expanded and subscribe to category label and icon changes */
      initialize() {
        this.expanded = true;
        this.listenTo(this.model, "change:label", this.updateLabel);
        this.listenTo(this.model, "change:icon", this.updateIcon);
      },

      /**
       * Create the category disclosure and its content container.
       * @returns {string} The category HTML
       */
      template() {
        return `
          <h5>
            <button type="button" class="${CLASS_NAMES.TOGGLE}" ${TOGGLE_CATEGORY_ATTRIBUTE}="${this.model.cid}"
              aria-controls="${this.cid}-${CONTENT_ID_SUFFIX}">
              <span class="${CLASS_NAMES.ICON}" aria-hidden="true"></span>
              <span class="${CLASS_NAMES.TITLE}"></span>
              <span class="${CLASS_NAMES.ICON_TOGGLE}" aria-hidden="true">
                <i class="${CLASS_NAMES.ICON_FONT} ${CLASS_NAMES.CARET_DOWN}"></i>
                <i class="${CLASS_NAMES.ICON_FONT} ${CLASS_NAMES.CARET_UP}"></i>
              </span>
            </button>
          </h5>
          <div id="${this.cid}-${CONTENT_ID_SUFFIX}" class="${CLASS_NAMES.CONTENT}"></div>
        `;
      },

      /**
       * Render the header and save container to view to add rows to
       * @returns {MapAssetCategoryView} This view
       */
      render() {
        this.el.innerHTML = this.template();
        this.contentEl = this.el.querySelector(`.${CLASS_NAMES.CONTENT}`);
        this.updateLabel();
        this.updateIcon();
        this.setExpanded(this.expanded);
        return this;
      },

      /** Update title text without replacing the header button */
      updateLabel() {
        this.el.querySelector(`.${CLASS_NAMES.TITLE}`).textContent =
          this.model.get("label");
      },

      /** Display the icon sanitized by the category model */
      updateIcon() {
        this.el.querySelector(`.${CLASS_NAMES.ICON}`).innerHTML =
          this.model.get("icon");
      },

      /** Show or hide this category's layers in the editor */
      toggleCategory() {
        this.setExpanded(!this.expanded);
      },

      /**
       * Show or hide this category in the editor without changing
       * AssetCategory.expanded in the saved map config.
       * @param {boolean} expanded Whether to show the category's layers
       */
      setExpanded(expanded) {
        this.expanded = expanded;
        this.el.classList.toggle(CLASS_NAMES.EXPANDED, expanded);
        this.el
          .querySelector(`[${TOGGLE_CATEGORY_ATTRIBUTE}]`)
          .setAttribute("aria-expanded", String(expanded));
        this.contentEl.hidden = !expanded;
      },
    },
  );

  return MapAssetCategoryView;
});
