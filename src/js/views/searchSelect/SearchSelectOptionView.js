"use strict";

define(["backbone", "semantic", "models/searchSelect/SearchSelectOption"], (
  Backbone,
  Semantic,
  OptionModel,
) => {
  const CLASS_NAMES = {
    icon: "icon",
    iconOnLeft: "icon-on-left",
    iconOnRight: "icon-on-right",
  };

  /**
   * @class
   * @classdesc One option (item) in a SearchSelectView dropdown menu.
   * @classcategory Views/SearchSelect
   * @augments SearchSelect
   * @class
   * @since 0.0.0
   * @screenshot
   */
  return Backbone.View.extend(
    /** @lends SearchSelectOptionView.prototype */
    {
      /** @inheritdoc */
      type: "SearchSelectOptionView",

      /** @inheritdoc */
      className: Semantic.CLASS_NAMES.dropdown.item,

      /**
       * The height and width in pixels of the image to display in the option.
       * Format: [width, height]
       * @type {number[]}
       */
      imageSize: [32, 32],

      /** @inheritdoc */
      events: {
        mouseenter: "addTooltip",
      },

      /**
       * Options for the Formantic UI popup module to configure the tooltip
       * that is shown on hover. Set to false to disable.
       * @see https://fomantic-ui.com/modules/popup.html#/settings
       * @type {object|boolean}
       */
      tooltipSettings: {
        position: "top left",
        variation: `${Semantic.CLASS_NAMES.variations.inverted} ${Semantic.CLASS_NAMES.variations.mini}`,
        delay: {
          show: 300,
          hide: 10,
        },
        exclusive: true,
      },

      /** @inheritdoc */
      initialize(opts = {}) {
        this.model = opts?.model || new OptionModel();
        this.listenTo(this.model, "change", this.render);
      },

      /** @inheritdoc */
      render() {
        this.el.innerHTML = "";
        this.removeTooltip();

        const label = this.model.get("label");
        const value = this.model.get("value") || label;
        this.el.setAttribute("data-value", value);

        const decorEl = this.createIconEl() || this.createImageEl() || "";
        const labelEl = document.createTextNode(label);

        this.el.append(decorEl, labelEl);
        return this;
      },

      /**
       * Creates an icon element for the option.
       * @returns {HTMLElement|null} The icon element, or null if no icon is
       * specified.
       */
      createIconEl() {
        const iconName = this.model.get("icon");
        if (!iconName) return null;
        const iconEl = document.createElement("i");
        iconEl.classList.add(
          CLASS_NAMES.icon,
          CLASS_NAMES.iconOnLeft,
          `icon-${iconName}`,
        );
        return iconEl;
      },

      /**
       * Creates an image element for the option.
       * @returns {HTMLElement|null} The image element, or null if no image is
       * specified.
       */
      createImageEl() {
        const image = this.model.get("image");
        if (!image) return null;

        const imageWidth = this.imageSize?.[0] || 32;
        const imageHeight = this.imageSize?.[1] || 32;
        const imgEl = document.createElement("img");
        imgEl.src = image;
        imgEl.style.cssText = `
          width: 100%;
          height: 100%;
          max-width: ${imageWidth}px;
          max-height:${imageHeight}px;
        `;
        return imgEl;
      },

      /**
       * Adds a tooltip to the option element. The tooltip is created when the
       * user first hovers over the option.
       */
      addTooltip() {
        const view = this;
        if (this.tooltipCreated || !this.tooltipSettings) return;
        const html = this.tooltipHTML();
        if (!html) return;
        this.$el.popup({
          html,
          ...this.tooltipSettings,
        });
        if (!this.tooltipCreated) {
          view.$el.popup("show");
        }
        this.tooltipCreated = true;
      },

      /** Removes the tooltip from the option element */
      removeTooltip() {
        if (!this.tooltipCreated) return;
        this.$el.popup("destroy");
        this.tooltipCreated = false;
      },

      /**
       * Create HTML for a tooltip for a given option.
       * @returns {string|null} An HTML string to use for the content of the
       * tooltip.
       * TODO: Pass on other options from the parent view.
       */
      tooltipHTML() {
        return this.model.get("description") || null;
      },

      /**
       * Returns true if the option is currently filtered out (hidden) by
       * Semantic UI in the menu.
       * @returns {boolean} True if the option is filtered, false otherwise.
       */
      isFiltered() {
        const filteredClass = Semantic.CLASS_NAMES.dropdown.filtered;
        return this.el.classList.contains(filteredClass);
      },
    },
  );
});
