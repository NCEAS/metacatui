define(["backbone"], (Backbone) => {
  /**
   * @class ToggleView
   * @classdesc A configurable two-option toggle with optional description area.
   * Uses the "button group" or "segmented control" UI pattern, which indicates
   * mutually exclusive options more clearly than switch toggles or radio
   * buttons.
   * @classcategory Views/UIElements
   * @augments Backbone.View
   * @screenshot views/uiElements/toggleView.png
   * @since 0.0.0
   */

  const CLASS_NAMES = {
    container: "toggle-container",
    switch: "toggle-switch",
    option: "toggle-option",
    active: "toggle-option--active",
    description: "toggle-description",
  };

  const DEFAULT_ICON = "check-sign";

  const ToggleView = Backbone.View.extend(
    /** @lends ToggleView.prototype */ {
      /**
       * @typedef {object} ToggleOption
       * @property {string} value - Internal value of the option
       * @property {string} label - Display label for the option
       * @property {description} [description] - Optional description for the
       * option
       * @property {string} [icon] - Optional icon for the option. A
       * font-awesome 3 icon name, e.g. "star-empty". Defaults to "check-sign".
       */

      /**
       * @param {object} options - Configuration options
       * @param {ToggleOption[]} options.options - Array of exactly two options
       * @param {string} options.selected - The value of the initially selected
       * option
       * @param {boolean} [options.showDescription] - Whether to show
       * description below toggle. True by default.
       */
      initialize(options = {}) {
        if (!options.options || options.options.length !== 2) {
          throw new Error("ToggleView requires exactly two options");
        }
        this.options = options.options;
        this.showDescription = options.showDescription !== false;
        this.selected = options.selected;
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
        const { options, showDescription } = this;

        const container = document.createDocumentFragment();

        const toggle = document.createElement("div");
        toggle.className = CLASS_NAMES.switch;

        options.forEach((opt) => {
          const button = document.createElement("button");
          button.className = CLASS_NAMES.option;
          button.dataset.value = opt.value;
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

        return this;
      },

      /**
       * Updates the toggle buttons' active state and icons
       * @param {string} selectedValue - The value of the currently selected option
       */
      updateButtonsAndDescription(selectedValue) {
        const buttons = this.el.querySelectorAll(`.${CLASS_NAMES.option}`);
        buttons.forEach((button) => {
          const btn = button;
          const opt = this.options.find((o) => o.value === btn.dataset.value);
          if (btn.dataset.value === selectedValue) {
            btn.classList.add(CLASS_NAMES.active);
            const iconName = (opt && opt.icon) || DEFAULT_ICON;
            btn.innerHTML = `<i class="icon icon-${iconName}"></i> ${opt.label}`;
          } else {
            btn.classList.remove(CLASS_NAMES.active);
            btn.innerHTML = opt.label;
          }
        });

        if (this.showDescription) {
          const opt = this.options.find((o) => o.value === selectedValue);
          const descEl = this.el.querySelector(`.${CLASS_NAMES.description}`);
          if (descEl) {
            descEl.textContent = (opt && opt.description) || "";
          }
        }
      },

      /**
       * Handles toggle option click
       * @param {MouseEvent} e - Click event
       */
      onToggle(e) {
        const newValue = e.currentTarget.dataset.value;
        if (newValue === this.selected) return;

        this.selected = newValue;
        this.updateButtonsAndDescription(newValue);
        this.trigger("toggle:change", this.selected);
      },
    },
  );

  return ToggleView;
});
