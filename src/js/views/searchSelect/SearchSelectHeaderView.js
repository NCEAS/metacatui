"use strict";

define(["backbone", "semantic"], (Backbone, Semantic) => {
  
  // The class for the outermost element of the header.
  const BASE_CLASS = Semantic.CLASS_NAMES.dropdown.header;

  // The class names for the various icons in the header.
  const CLASS_NAMES = {
    icon: "icon",
    chevronDown: "icon-chevron-down",
    chevronRight: "icon-chevron-right",
    accordionIcon: "accordion-mode-icon",
    popoutIcon: "popout-mode-icon",
    categoryIcon: "category-icon",
  };

  // The layout modes for the header.
  const MODES = ["list", "popout", "accordion"];

  /**
   * @class
   * @classdesc A category header in a SearchSelectMenuView.
   * @classcategory Views/SearchSelect
   * @augments SearchSelect
   * @class
   * @since 0.0.0
   * @screenshot TODO
   */
  return Backbone.View.extend(
    /** @lends SearchSelectHeaderView.prototype */
    {
      /** @inheritdoc */
      type: "SearchSelectHeaderView",

      /** @inheritdoc */
      className: BASE_CLASS,

      /** @inheritdoc */
      tagName: "h6",

      /**
       * The label of the category to display.
       * @type {string}
       */
      category: "",

      /**
       * The fontawesome icon associated with the category.
       * @type {string}
       */
      categoryIcon: "",

      /**
       * The layout for the menu - can be "popout", "accordion", or "list".
       * @type {string}
       */
      mode: "list",

      /** @inheritdoc */
      initialize(opts = {}) {
        this.category = opts?.category || "";
        this.categoryIcon = opts?.categoryIcon || "";
        if (opts?.mode && this.isValidMode(opts.mode)) {
          this.mode = opts.mode;
        }
      },

      /** @inheritdoc */
      render() {
        this.icons = {};

        this.icons.category = this.createIconEl(
          [CLASS_NAMES.icon, `${CLASS_NAMES.icon}-${this.categoryIcon}`, CLASS_NAMES.categoryIcon]
        );
        this.icons.accordion = this.createIconEl([
          CLASS_NAMES.chevronDown,
          CLASS_NAMES.accordionIcon,
        ]);
        this.icons.popout = this.createIconEl([
          CLASS_NAMES.chevronRight,
          CLASS_NAMES.popoutIcon,
        ]);

        this.el.textContent = this.category;
        this.el.prepend(this.icons.category);
        this.el.append(this.icons.accordion, this.icons.popout);

        this.updateMode(this.mode, true);

        return this;
      },

      /**
       * Create an icon element.
       * @param {string[]} classes - The classes to add to the icon element.
       * @returns {HTMLElement} The icon element.
       */
      createIconEl(classes) {
        const el = document.createElement("i");
        el.classList.add(...classes);
        return el;
      },

      /** Hide the accordion, popout, and category icons. */
      hideAllIcons() {
        Object.values(this.icons).forEach((icon) => this.hideIcon(icon));
      },

      /** Show the category icon. */
      showCategoryIcon() {
        this.showIcon(this.icons.category);
      },

      /** Show the accordion icon. */
      showAccordionIcon() {
        this.showIcon(this.icons.accordion);
      },

      /** Show the popout icon. */
      showPopoutIcon() {
        this.showIcon(this.icons.popout);
      },

      /**
       * Show a given icon element.
       * @param {HTMLElement} iconEl - The icon element to show.
       */
      showIcon(iconEl) {
        if (!iconEl) return;
        const styles = iconEl.style;
        styles.display = "inline";
      },

      /**
       * Hide a given icon element.
       * @param {HTMLElement} iconEl - The icon element to hide.
       */
      hideIcon(iconEl) {
        if (!iconEl) return;
        const styles = iconEl.style;
        styles.display = "none";
      },

      /** Hide the header. */
      hide() {
        this.el.style.display = "none";
      },

      /** Show the header. */
      show() {
        this.el.style.display = "block";
      },

      /**
       * Update the layout mode of the header.
       * @param {string} mode - The new layout mode.
       */
      updateMode(mode) {
        if (!this.isValidMode(mode)) return;
        const modeMap = {
          list: this.toList,
          popout: this.toPopout,
          accordion: this.toAccordion,
        };
        modeMap[mode].call(this);
      },

      /** Set the layout mode to "popout". */
      toPopout() {
        this.mode = "popout";
        this.showCategoryIcon();
        this.showPopoutIcon();
      },

      /** Set the layout mode to "accordion". */
      toAccordion() {
        this.mode = "accordion";
        this.showCategoryIcon();
        this.showAccordionIcon();
      },

      /** Set the layout mode to "list". */
      toList() {
        this.mode = "list";
        this.hideAllIcons();
      },

      /**
       * Check if a given mode is a valid layout mode.
       * @param {string} mode - The mode to check.
       * @returns {boolean} Whether the mode is valid.
       */
      isValidMode(mode) {
        return MODES.includes(mode);
      },
    },
  );
});
