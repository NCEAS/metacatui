define(["backbone", "semantic"], (Backbone, Semantic) => {
  /**
   * @class ToggleView
   * @classdesc A configurable two-option toggle with optional description area.
   * Uses the "button group" or "segmented control" UI pattern, which indicates
   * mutually exclusive options more clearly than switch toggles or radio
   * buttons.
   * @classcategory Views/UIElements
   * @augments Backbone.View
   * @screenshot views/uiElements/toggleView.png
   * @since 2.34.0
   */

  const CLASS_NAMES = {
    container: "toggle-container",
    switch: "toggle-switch",
    option: "toggle-option",
    active: "toggle-option--active",
    description: "toggle-description",
    disabled: "toggle-container--disabled",
  };

  const DEFAULT_ICON = "check-sign";
  const SEM_VARIATIONS = Semantic.CLASS_NAMES.variations;
  const DEFAULT_TOOLTIP_SETTINGS = {
    variation: `${SEM_VARIATIONS.mini} ${SEM_VARIATIONS.inverted}`,
    position: "top center",
    on: "hover",
    hoverable: true,
    delay: {
      show: 250,
      hide: 40,
    },
  };

  const ToggleView = Backbone.View.extend(
    /** @lends ToggleView.prototype */ {
      /**
       * @typedef {object} ToggleOption
       * @property {*} value - Internal value of the option
       * @property {string} label - Display label for the option
       * @property {string} [description] - Optional description for the option
       * @property {string} [icon] - Optional icon for the option. A
       * font-awesome 3 icon name, e.g. "star-empty". Defaults to "check-sign".
       * @property {string} [tooltip] - Optional tooltip content for the option.
       */

      /**
       * @param {object} options - Configuration options
       * @param {ToggleOption[]} options.options - Array of exactly two options
       * @param {*} [options.selected] - The value of the initially selected option
       * @param {boolean} [options.showDescription] - Whether to show
       * description below toggle. True by default.
       * @param {object|boolean} [options.tooltipSettings] - Custom settings for
       * Formantic UI popup tooltips. Set to false to disable tooltips entirely.
       */
      initialize(options = {}) {
        if (!options.options || options.options.length !== 2) {
          throw new Error("ToggleView requires exactly two options");
        }

        this.disabled = options.disabled === true;

        this.toggleOptions = options.options;
        this.showDescription = options.showDescription !== false;
        this.selected =
          typeof options.selected !== "undefined"
            ? options.selected
            : this.toggleOptions[0].value;

        this.tooltipSettings =
          options.tooltipSettings === false
            ? false
            : {
                ...DEFAULT_TOOLTIP_SETTINGS,
                ...(options.tooltipSettings || {}),
              };

        if (!this.getOptionByKey(`${this.selected}`)) {
          this.selected = this.toggleOptions[0].value;
        }
      },

      /** @inheritdoc */
      className: CLASS_NAMES.container,

      /** @inheritdoc */
      events() {
        const events = {};
        events[`click .${CLASS_NAMES.option}`] = "onToggle";
        return events;
      },

      /**
       * Render the toggle UI
       * @returns {ToggleView} This view instance
       */
      render() {
        this.toggleDisabled(this.disabled);
        const { toggleOptions, showDescription } = this;
        this.removeTooltips();

        const container = document.createDocumentFragment();

        const toggle = document.createElement("div");
        toggle.className = CLASS_NAMES.switch;

        toggleOptions.forEach((opt) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = CLASS_NAMES.option;
          button.dataset.value = `${opt.value}`;
          toggle.appendChild(button);
        });

        container.appendChild(toggle);

        if (showDescription) {
          const desc = document.createElement("div");
          desc.className = CLASS_NAMES.description;
          container.appendChild(desc);
        }

        this.el.innerHTML = "";
        this.el.appendChild(container);

        // Set initial state for buttons and description
        this.updateButtonsAndDescription(this.selected);
        this.addTooltips();

        return this;
      },

      /**
       * Updates the toggle buttons' active state and icons
       * @param {*} selectedValue - The value of the currently selected option
       */
      updateButtonsAndDescription(selectedValue) {
        const selectedOption =
          this.getOptionByKey(`${selectedValue}`) || this.toggleOptions[0];
        const selectedValueKey = `${selectedOption.value}`;
        this.selected = selectedOption.value;

        const buttons = this.el.querySelectorAll(`.${CLASS_NAMES.option}`);
        buttons.forEach((button) => {
          const btn = button;
          const opt = this.getOptionByKey(btn.dataset.value);
          const isActive = btn.dataset.value === selectedValueKey;

          if (!opt) {
            return;
          }

          btn.classList.toggle(CLASS_NAMES.active, isActive);
          btn.setAttribute("aria-pressed", isActive.toString());
          btn.innerHTML = "";

          if (isActive) {
            const iconName = opt.icon || DEFAULT_ICON;
            const iconEl = document.createElement("i");
            iconEl.className = `icon icon-${iconName}`;
            btn.append(iconEl, document.createTextNode(` ${opt.label}`));
          } else {
            btn.textContent = opt.label;
          }
        });

        if (this.showDescription) {
          const descEl = this.el.querySelector(`.${CLASS_NAMES.description}`);
          if (descEl) {
            descEl.textContent = selectedOption.description || "";
          }
        }
      },

      /**
       * Enable or disable the toggle
       * @param {boolean} disabled Whether the toggle should be disabled
       */
      toggleDisabled(disabled) {
        if (disabled) {
          this.disabled = true;
          this.el.classList.add(CLASS_NAMES.disabled);
        } else {
          this.disabled = false;
          this.el.classList.remove(CLASS_NAMES.disabled);
        }
      },

      /** Disable the toggle */
      disable() {
        this.toggleDisabled(true);
      },

      /** Enable the toggle */
      enable() {
        this.toggleDisabled(false);
      },

      /**
       * Handles toggle option click
       * @param {MouseEvent} e - Click event
       */
      onToggle(e) {
        if (this.disabled) return;
        const newValueKey = e.currentTarget.dataset.value;
        const selectedOption = this.getOptionByKey(newValueKey);
        if (!selectedOption) return;

        if (newValueKey === `${this.selected}`) return;

        this.selected = selectedOption.value;
        this.updateButtonsAndDescription(this.selected);
        this.trigger("toggle:change", this.selected, selectedOption);
        this.trigger("change", this.selected, selectedOption);
      },

      /**
       * Initialize option tooltips using the Formantic UI popup module.
       */
      addTooltips() {
        if (!this.tooltipSettings) return;

        const buttons = this.el.querySelectorAll(`.${CLASS_NAMES.option}`);
        buttons.forEach((button) => {
          const option = this.getOptionByKey(button.dataset.value);
          const tooltip = option?.tooltip;
          const $button = this.$(button);

          if (tooltip) {
            button.setAttribute("data-content", tooltip);
            $button.popup({
              content: tooltip,
              ...this.tooltipSettings,
            });
          } else {
            button.removeAttribute("data-content");
            $button.popup("destroy");
          }
        });
      },

      /**
       * Remove Formantic UI popup instances from this toggle's options.
       */
      removeTooltips() {
        const buttons = this.el.querySelectorAll(`.${CLASS_NAMES.option}`);
        buttons.forEach((button) => {
          this.$(button).popup("destroy");
        });
      },

      /**
       * Get an option by its DOM key.
       * @param {string} valueKey - String key from DOM data attribute.
       * @returns {ToggleOption|undefined} The matching option, or undefined if not found.
       */
      getOptionByKey(valueKey) {
        return this.toggleOptions.find(
          (option) => `${option.value}` === valueKey,
        );
      },

      /** @inheritdoc */
      remove() {
        this.removeTooltips();
        return Backbone.View.prototype.remove.call(this);
      },
    },
  );

  return ToggleView;
});
