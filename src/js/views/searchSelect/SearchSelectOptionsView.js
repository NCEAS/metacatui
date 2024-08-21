"use strict";

define([
  "backbone",
  "semantic",
  "collections/searchSelect/SearchSelectOptions",
  "views/searchSelect/SearchSelectOptionView",
  "views/searchSelect/SearchSelectHeaderView",
], (
  Backbone,
  Semantic,
  SearchSelectOptions,
  SearchSelectOptionView,
  SearchSelectHeaderView,
) => {
  // Base class for the dropdown menu
  const BASE_CLASS = Semantic.CLASS_NAMES.dropdown.menu;

  // Classes that we use from the semantic module
  const CLASS_NAMES = {
    popout: "popout-mode",
    accordion: "accordion-mode",
  };

  // Classes that we use from the bootstrap module
  const BOOTSTRAP_CLASS_NAMES = {
    collapse: "collapse",
    collapsed: "collapsed",
  };

  // Allowaable modes for the menu
  const MODES = ["list", "popout", "accordion"];

  /**
   * @class
   * @classdesc The menu in a SearchSelectView. Handles the connection between
   * the SearchSelectOptions collection and the dropdown menu.
   * @classcategory Views/SearchSelect
   * @augments SearchSelect
   * @class
   * @since 0.0.0
   * @screenshot TODO
   */
  return Backbone.View.extend(
    /** @lends SearchSelectMenuView.prototype */
    {
      /** @inheritdoc */
      type: "SearchSelectMenuView",

      /** @inheritdoc */
      className: BASE_CLASS,

      /** The current layout mode for the menu */
      mode: "list",

      /**
       * @inheritdoc
       * @param {object} opts - The options for the view
       * @param {SearchSelectOptions} opts.collection - The collection of options
       * @param {string} opts.mode - The initial layout mode for the menu
       */
      initialize(opts = {}) {
        this.collection = opts?.collection || new SearchSelectOptions();
        this.listenTo(this.collection, "add", (option) =>
          this.addOption(option, true),
        );
        this.listenTo(this.collection, "remove", this.removeOption);
        this.listenTo(this.collection, "reset", this.render);
        if (opts?.mode && this.isValidMode(opts.mode)) {
          this.mode = opts.mode;
        }
      },

      /** @inheritdoc */
      render() {
        this.el.innerHTML = "";
        this.collection.each((option) => this.addOption(option));
        this.updateMode(this.mode, true);
        return this;
      },

      /**
       * Add an option to the menu
       * @param {SearchSelectOption} option The model to add
       * @param {boolean} appendInOrder Whether to add the option in order
       * according to the collection
       */
      addOption(option, appendInOrder = false) {
        const category = option.get("category") || "";
        const categoryIcon = option.get("icon") || "";

        if (!this.getHeader(category) && category) {
          this.addHeader(category, categoryIcon);
        }
        const optionView = new SearchSelectOptionView({
          model: option,
        }).render();

        // Add the option to the view in the correct order
        let appendBeforeView = null;
        if (appendInOrder && this.collection.length > 1 && this.optionViews) {
          const modelIndex = this.collection.indexOf(option);
          const prevOption = this.collection.at(modelIndex - 1);
          appendBeforeView = this.getOptionView(prevOption);
        }
        if (appendBeforeView) {
          appendBeforeView.el.before(optionView.el);
        } else {
          this.el.append(optionView.el);
        }

        if (!this.optionViews) this.optionViews = {};
        if (!this.optionViews[category]) this.optionViews[category] = [];
        this.optionViews[category].push(optionView);
      },

      /**
       * Add a header element to the menu
       * @param {string} category The category label
       * @param {string} categoryIcon The icon for the category
       */
      addHeader(category, categoryIcon) {
        const { mode } = this;
        const headerView = new SearchSelectHeaderView({
          category,
          categoryIcon,
          mode,
        }).render();
        if (!this.headers) this.headers = {};
        this.headers[category] = headerView;
        this.el.append(headerView.el);
      },

      /**
       * Get the header view for a category
       * @param {string} category The category label
       * @returns {SearchSelectHeaderView|null} The header view, or null if not
       */
      getHeader(category) {
        return this.headers?.[category];
      },

      /**
       * Given an option model, find the corresponding option view
       * @param {SearchSelectOption} option - The option model
       * @returns {SearchSelectOptionView|null} The option view, or null if not
       * found
       */
      getOptionView(option) {
        if (!this.optionViews?.length || !option) return null;
        const category = option.get("category") || "";
        return this.optionViews?.[category]?.find(
          (view) => view.model === option,
        );
      },

      /** Hide category headers for which all options are filtered */
      hideEmptyCategories() {
        if (!this.optionViews) return;
        Object.entries(this.optionViews).forEach(([category, views]) => {
          const allItemsFiltered = views.every((view) => view.isFiltered);
          if (allItemsFiltered) {
            this.headers?.[category]?.hide();
          } else {
            this.headers?.[category]?.show();
          }
        });
      },

      /** Show all category headers */
      showAllCategories() {
        if (!this.headers) return;
        Object.values(this.headers).forEach((header) => header.show());
      },

      /**
       * Remove an option from the menu
       * @param {SearchSelectOption} option - The option model to remove
       */
      removeOption(option) {
        const optionView = this.optionViews.find(
          (view) => view.model === option,
        );
        optionView.remove();
        this.optionViews = this.optionViews.filter(
          (view) => view !== optionView,
        );
      },

      /**
       * Wrap a set of elements in a new container element
       * @param {HTMLElement[]} items - The elements to wrap
       * @param {string} tagName - The tag name for the wrapper element
       * @param {string[]} classes - The classes to add to the wrapper element
       * @returns {HTMLElement} The wrapper element
       */
      wrapAll(items, tagName = "div", classes = []) {
        // Items can be views or HTML elements
        const els = items.map((item) => item.el || item);
        const wrapperEl = document.createElement(tagName);
        const parent = els[0].parentNode;
        wrapperEl.className = classes.join(" ");
        parent.insertBefore(wrapperEl, els[0]);
        wrapperEl.append(...els);
        return wrapperEl;
      },

      /** Unwrap all elements that have been wrapped in the menu */
      unwrapAll() {
        this.wrapperEls?.forEach((el) => {
          el.replaceWith(...el.childNodes);
        });
        this.wrapperEls = [];
      },

      /**
       * Update the layout mode for the menu
       * @param {string} mode - The new mode
       * @param {boolean} force - Whether to force the update
       */
      updateMode(mode, force = false) {
        if (!this.isValidMode(mode)) return;
        if (force) this.mode = null;
        if (this.mode === mode) return;
        const methodMap = {
          list: this.toList,
          popout: this.toPopout,
          accordion: this.toAccordion,
        };
        methodMap[mode].call(this, force);
      },

      /** Change the menu to list mode */
      toList() {
        if (this.mode === "list") return;
        this.mode = "list";
        this.el.classList.remove(CLASS_NAMES.popout, CLASS_NAMES.accordion);
        this.unwrapAll();
        if (this.headers) {
          Object.values(this.headers)?.forEach((header) => header.toList());
        }
      },

      /** Change the menu to popout mode */
      toPopout() {
        if (this.mode === "popout") return;
        this.toList();
        this.mode = "popout";
        if (!this.optionViews) return;

        if (!this.wrapperEls) this.wrapperEls = [];
        // TODO: the class was originally added to the selectUI element.
        // Can we change the styles to target the menu instead?
        this.$el.addClass(CLASS_NAMES.popout);

        Object.entries(this.optionViews).forEach(([category, optionViews]) => {
          const header = this.getHeader(category);
          const headerAndItems = [header, ...optionViews];
          header.toPopout();
          const groupWrapper = this.wrapAll(headerAndItems, "div");
          const itemsWrapper = this.wrapAll(optionViews, "div", [
            Semantic.CLASS_NAMES.dropdown.menu,
            CLASS_NAMES.popout,
          ]);
          this.wrapperEls.push(groupWrapper, itemsWrapper);
        });
      },

      /** Change the menu to accordion mode */
      toAccordion() {
        if (this.mode === "accordion") return;

        this.toList();
        this.mode = "accordion";
        if (!this.optionViews) return;

        if (!this.wrapperEls) this.wrapperEls = [];

        this.$el.addClass(CLASS_NAMES.accordion);

        Object.entries(this.optionViews).forEach(([category, optionViews]) => {
          const header = this.getHeader(category);
          if (!header) return;
          header.toAccordion();
          // Create a unique ID for each header
          const groupId = Math.floor(Math.random() * 100000 + 1);
          const headerWrapper = this.wrapAll([header], "a", [
            CLASS_NAMES.accordion,
            BOOTSTRAP_CLASS_NAMES.collapsed,
          ]);
          headerWrapper.setAttribute(
            "data-toggle",
            BOOTSTRAP_CLASS_NAMES.collapse,
          );
          headerWrapper.setAttribute("data-target", `#${groupId}`);

          const itemsWrapper = this.wrapAll(optionViews, "div", [
            CLASS_NAMES.accordion,
            BOOTSTRAP_CLASS_NAMES.collapse,
          ]);
          itemsWrapper.setAttribute("id", groupId);

          this.wrapperEls.push(headerWrapper, itemsWrapper);
        });
      },

      /**
       * Check if a mode is valid
       * @param {string} mode - The mode to check
       * @returns {boolean} Whether the mode is valid
       */
      isValidMode(mode) {
        return MODES.includes(mode);
      },
    },
  );
});
