"use strict";

define([
  "jquery",
  "underscore",
  "backbone",
  "semantic",
  "views/searchSelect/SeparatorView",
  "views/searchSelect/SearchSelectOptionsView",
  "models/searchSelect/SearchSelect",
], ($, _, Backbone, Semantic, SeparatorView, OptionsView, SearchSelect) => {
  // The base class for the search select view
  const BASE_CLASS = "search-select";

  // Class names that we use in the view, including those from the dropdown
  // module
  const CLASS_NAMES = {
    inputLabel: [`${BASE_CLASS}-label`, "subtle"],
    popout: "popout-mode",
    accordion: "accordion-mode",
    chevronDown: "icon-chevron-down",
    chevronRight: "icon-chevron-right",
    dropdownIconRight: [
      Semantic.CLASS_NAMES.dropdown.base,
      "icon",
      "icon-on-right",
    ],
    accordionIcon: "accordion-mode-icon",
    popoutIcon: "popout-mode-icon",
    buttonStyle: Semantic.CLASS_NAMES.button.base,
    labeled: Semantic.CLASS_NAMES.button.labeled,
  };

  // The placeholder element needs both to work properly
  CLASS_NAMES.placeholder = [
    Semantic.CLASS_NAMES.dropdown.placeholder,
    Semantic.CLASS_NAMES.dropdown.text,
  ];

  // Classes to use for different types of messages
  const MESSAGE_TYPES = {
    error: {
      messageClass: "text-error",
      selectUIClass: "error",
    },
    warning: {
      messageClass: "text-warning",
      selectUIClass: "warning",
    },
    info: {
      messageClass: "text-info",
      selectUIClass: "",
    },
  };

  // The delimiter used to separate values in the dropdown
  const DELIMITER = ";";

  /**
   * @class SearchSelectView
   * @classdesc A select interface that allows the user to search from within
   * the options, and optionally select multiple items. Also allows the items to
   * be grouped, and to display an icon or image for each item.
   * @classcategory Views/SearchSelect
   * @augments Backbone.View
   * @class
   * @since 2.14.0
   * @screenshot views/searchSelect/SearchSelectView.png
   */
  const SearchSelectView = Backbone.View.extend(
    /** @lends SearchSelectView.prototype */
    {
      /** @inheritdoc */
      type: "SearchSelect",

      /** @inheritdoc */
      className: BASE_CLASS,

      /**
       * The constructor function for the model that this view uses. Must be a
       * SearchSelect or an extension of it.
       * @type {Backbone.Model}
       * @since 0.0.0
       */
      ModelType: SearchSelect,

      /**
       * Options and selected values for the search select interface show a
       * tooltip with the description of the option when the user hovers over
       * the option. This object is passed to the Formantic UI popup module to
       * configure the tooltip. Set to false to disable tooltips.
       * @see https://fomantic-ui.com/modules/popup.html#/settings
       * @type {object|boolean}
       * @since 0.0.0
       */
      tooltipSettings: {
        position: "top left",
        variation: `${Semantic.CLASS_NAMES.variations.inverted} ${Semantic.CLASS_NAMES.variations.mini}`,
        delay: {
          show: 450,
          hide: 10,
        },
        exclusive: true,
      },

      /** @inheritdoc */
      initialize(opts) {
        const options = opts || {};
        // Set options on the view and create the model
        const { modelAttrs, viewAttrs } = this.splitModelViewOptions(options);
        if (!options.model) this.createModel(modelAttrs);
        Object.assign(this, viewAttrs);
      },

      /**
       * Split the options passed to the view into model and view attributes.
       * @param {object} options The options passed to the view
       * @returns {object} An object with two keys: modelAttrs and viewAttrs
       * @since 0.0.0
       */
      splitModelViewOptions(options) {
        const modelAttrNames = Object.keys(this.ModelType.prototype.defaults());
        const modelAttrs = _.pick(options, modelAttrNames);
        const viewAttrs = _.omit(options, modelAttrNames);
        return { modelAttrs, viewAttrs };
      },

      /**
       * Create a new SearchSelect model and set it on the view. If a model
       * already exists, it will be destroyed.
       * @param {object} options The options to pass to the model
       * @since 0.0.0
       */
      createModel(options) {
        const modelAttrs = options || {};

        if (this.model) {
          this.stopListening(this.model);
          this.model.destroy();
        }

        // Selected values can be part of other models
        if (modelAttrs.selected) {
          modelAttrs.selected = [...modelAttrs.selected];
        }
        this.model = new this.ModelType(modelAttrs);
      },

      /** @inheritdoc */
      render() {
        this.el.innerHTML = "";

        this.labelEl = this.createLabel();
        this.selectContainerEl = this.createSelectContainer();
        this.inputEl = this.createInput();
        this.iconEl = this.createIcon();
        this.placeholderEl = this.createPlaceholder();
        this.menu = this.createMenu();
        this.menuEl = this.menu.el;

        this.el.append(this.labelEl, this.selectContainerEl);
        this.selectContainerEl.append(
          this.inputEl,
          this.iconEl,
          this.placeholderEl,
          this.menuEl,
        );

        this.$selectUI = $(this.selectContainerEl);
        this.inactivate();
        this.showLoading();
        this.renderSelectUI();
        this.showSelected(true);
        this.listenToModel();
        this.listenToSelectUI();
        this.checkForInvalidSelections();
        this.enable();
        this.hideLoading();

        return this;
      },

      /** Initialize the dropdown interface */
      renderSelectUI() {
        const view = this;

        // Destroy any previous dropdowns
        if (typeof this.$selectUI.dropdown === "function") {
          this.$selectUI.dropdown("destroy");
        }

        // Initialize the dropdown interface For explanations of settings, see:
        // https://semantic-ui.com/modules/dropdown.html#/settings
        this.$selectUI = this.$selectUI.dropdown({
          delimiter: DELIMITER,
          apiSettings: this.model.get("apiSettings"),
          fullTextSearch: true,
          duration: 90,
          forceSelection: false,
          ignoreDiacritics: true,
          clearable: view.model.get("clearable"),
          allowAdditions: view.model.get("allowAdditions"),
          hideAdditions: false,
          allowReselection: true,
          onChange() {
            if (view.enabled) {
              // Update the model with the selected values
              const selected = view.$selectUI.dropdown("get values");
              view.model.setSelected(selected);
            }
            // ensure the DOM is updated before modifying the elements
            requestAnimationFrame(() => {
              view.addTooltipsToSelectionEls();
              view.addSeparators();
              view.addClickToTexts();
            });
          },
        });
        view.$selectUI.data("view", view);
      },

      /**
       * Because we've modified the text elements to be hoverable to show the
       * tooltip, we needed to move them to a higher z-index which blocks the
       * click action on the dropdown input element. This function ensures that
       * the dropdown is shown when any part of the input is clicked, including
       * the selected text elements in a single-select dropdown.
       * @since 0.0.0
       */
      addClickToTexts(){
        const showMenu = () => { this.$selectUI.dropdown("show") };
        const texts = this.getTexts();
        if(!texts?.length) return;
        texts.forEach((text) => text.removeEventListener("click", showMenu));
        const text = this.getTexts()?.[0];
        if(!text) return;
        text.addEventListener("click", showMenu);
      },

      /**
       * Update the dropdown interface with the selected values from the model
       * @param {boolean} [silent] Set to true to prevent the dropdown from
       * triggering a change event (an infinite loop can occur if this is not set,
       * as the dropdown will trigger a change event, which will update the model).
       * @since 0.0.0
       */
      showSelected(silent = false) {
        const enabledBefore = this.enabled;
        this.inactivate();

        const selected = this.model.get("selected");
        // Add one at a time so that labels appear in the correct order
        selected.forEach((s) => {
          this.$selectUI.dropdown("set selected", s);
        });

        if (!silent) {
          // trigger once to ensure the model is updated
          this.$selectUI.dropdown("set selected", selected);
        }

        if (enabledBefore) {
          this.enable();
        }
      },

      /** @returns {HTMLElement[]} The selected label elements in a multi-select dropdown */
      getLabels() {
        return this.$selectUI.find(Semantic.DROPDOWN_SELECTORS.label).toArray();
      },

      /** @returns {HTMLElement[]} The selected text element in a single-select dropdown */
      getTexts() {
        // default text is the placeholder
        return this.$selectUI
          .find(
            `${Semantic.DROPDOWN_SELECTORS.text}:not(.${Semantic.CLASS_NAMES.dropdown.placeholder})`,
          )
          .toArray();
      },

      /** Add tooltips to the selected labels or text elements */
      addTooltipsToSelectionEls() {
        const els = this.getLabels().concat(this.getTexts());
        els.forEach((el) => this.addTooltip(el));
      },

      /** Remove all messages from the view */
      removeAllSeparators() {
        this.separators?.forEach((sep) => sep.remove());
      },

      /** Add separators between labels in the dropdown if required */
      addSeparators() {
        this.removeAllSeparators();
        const labels = this.getLabels();

        labels.forEach((label) => {
          const value = $(label).data("value");
          if (this.model.separatorRequired(value)) {
            this.addSeparator(label);
          }
        });
      },

      /**
       * Add a separator before the given label element
       * @param {HTMLElement} el The label element to add a separator before
       */
      addSeparator(el) {
        if (!this.separators) this.separators = [];
        const separator = this.createSeparator();
        if (separator) {
          // Attach the separator to the label so that we can easily remove it
          // when the label is removed.
          $(el).data("separator", separator);
          // Add it before the label element.
          separator.$el.insertBefore($(el));
          this.separators.push(separator);
        }
      },

      /**
       * Update the view when certain model attributes change
       * @since 0.0.0
       */
      listenToModel() {
        this.stopListening(this.model);
        const view = this;
        this.listenTo(this.model.get("options"), "add remove reset", () => {
          // If pre-selected values were not in the options previously, then
          // they would have been removed and/or shown as invalid selections.
          // Re-add & check selections, after a timeout to ensure the DOM is
          // updated.
          requestAnimationFrame(() => {
            view.showSelected(true);
            view.checkForInvalidSelections();
            // save defaults
            view.$selectUI.dropdown("save defaults");
            view.$selectUI.dropdown("refresh");
          });
        });
        this.listenTo(this.model, "change:submenuStyle", this.updateMenuMode);
        if (this.model.get("hideEmptyCategoriesOnSearch")) {
          this.listenTo(
            this.model,
            "change:searchTerm",
            (_model, searchTerm) => {
              if (searchTerm) {
                view.menu.hideEmptyCategories();
              } else {
                view.menu.showAllCategories();
              }
            },
          );
        }
      },

      /**
       * Listen to events from the select UI interface and update the model
       * @since 0.0.0
       */
      listenToSelectUI() {
        // Save the active search term in the model
        this.$selectUI.find("input").off("keyup blur focus");
        this.$selectUI.find("input").on("keyup blur focus", (e) => {
          this.model.set("lastInteraction", e.type);
          this.model.set("searchTerm", e.target.value);
        });
      },

      /**
       * Change the options available in the dropdown menu and re-render.
       * @param {SearchSelectOptions} options The new options
       * @since 2.24.0
       */
      updateOptions(options) {
        this.model.updateOptions(options);
      },

      /**
       * Create the HTML for a separator element to insert between two labels.
       * The view.separatorClass is added to the separator element.
       * @returns {JQuery} Returns the separator as a jQuery element
       * @since 2.15.0
       */
      createSeparator() {
        const separator = new SeparatorView({
          model: this.model,
          // hovering over one separator should highlight them all
          mouseEnterCallback: () =>
            this.separators.forEach((sep) => sep.highlight()),
          mouseOutCallback: () =>
            this.separators.forEach((sep) => sep.unhighlight()),
        });
        separator.render();
        this.separators = this.separators || [];
        this.separators.push(separator);
        return separator;
      },

      /**
       * Show an error message if the user has selected an invalid value
       * @since 0.0.0
       */
      checkForInvalidSelections() {
        const view = this;
        const invalidSelections = view.model.hasInvalidSelections();
        if (invalidSelections) {
          view.showInvalidSelectionError(invalidSelections);
        } else {
          view.removeMessages();
        }
      },

      /**
       * Create the label for the search select interface
       * @returns {HTMLElement|null} The label element, or null if no label is
       * specified.
       * @since 0.0.0
       */
      createLabel() {
        const inputLabel = this.model.get("inputLabel");
        if (!inputLabel) return null;
        const inputEl = document.createElement("label");
        inputEl.classList.add(...CLASS_NAMES.inputLabel);
        inputEl.textContent = inputLabel;
        return inputEl;
      },

      /**
       * Create the container for the select interface
       * @returns {HTMLElement} The select container element
       * @since 0.0.0
       */
      createSelectContainer() {
        const dropdownEl = document.createElement("div");
        let classesToAdd = [
          Semantic.CLASS_NAMES.base,
          Semantic.CLASS_NAMES.dropdown.dropdown,
          Semantic.CLASS_NAMES.dropdown.search,
          this.model.get("allowMulti")
            ? Semantic.CLASS_NAMES.dropdown.multiple
            : null,
          this.model.get("fluid")
            ? Semantic.CLASS_NAMES.variations.fluid
            : null,
          this.model.get("buttonStyle") ? CLASS_NAMES.buttonStyle : null,
          this.model.get("icon") ? Semantic.CLASS_NAMES.dropdown.icon : null,
          this.model.get("icon") ? CLASS_NAMES.labeled : null,
          this.model.get("icon")
            ? null
            : Semantic.CLASS_NAMES.dropdown.selection,
        ];

        classesToAdd = classesToAdd.filter(Boolean);
        classesToAdd = classesToAdd.map((c) => c.split(" ")).flat();

        dropdownEl.classList.add(...classesToAdd);

        return dropdownEl;
      },

      /**
       * Create the hidden input element that will store the selected values
       * @returns {HTMLElement} The input element
       * @since 0.0.0
       */
      createInput() {
        const inputEl = document.createElement("input");
        inputEl.name = `search-select-${this.cid}`;
        inputEl.type = "hidden";
        return inputEl;
      },

      /**
       * Create the icon element for the select interface
       * @returns {HTMLElement} The icon element
       * @since 0.0.0
       */
      createIcon() {
        let icon = this.model.get("icon");
        icon = icon ? `icon-${icon}` : "dropdown";
        const iconEl = document.createElement("i");
        iconEl.classList.add("icon", icon);
        return iconEl;
      },

      /**
       * Create the placeholder element for the select interface
       * @returns {HTMLElement} The placeholder element
       * @since 0.0.0
       */
      createPlaceholder() {
        const placeholder = this.model.get("placeholderText");
        const placeholderEl = document.createElement("span");
        placeholderEl.classList.add(...CLASS_NAMES.placeholder);
        placeholderEl.textContent = placeholder;
        return placeholderEl;
      },

      /**
       * Create the dropdown menu for the select interface
       * @returns {OptionsView} The dropdown menu
       * @since 0.0.0
       */
      createMenu() {
        const menu = new OptionsView({
          collection: this.model.get("options"),
          tooltipOptions: this.tooltipSettings,
          mode: this.model.get("submenuStyle"),
        });
        menu.render();
        return menu;
      },

      /**
       * Convert the submenu style to the style set in the model
       * @param {boolean} [force] Set to true to force the view to update
       * @since 0.0.0
       */
      updateMenuMode(force = false) {
        const mode = this.model.get("submenuStyle");
        this.menu.updateMode(mode, force);
      },

      /**
       * Show a message indicated that some of the selected values are not valid
       * choices.
       * @param {string[]} opts The values that are not valid choices
       */
      showInvalidSelectionError(opts) {
        let msg = "";
        if (opts?.length) {
          msg += opts.join(", ");
          if (opts.length > 1) {
            msg += " are not valid options. ";
          } else {
            msg += " is not a valid option. ";
          }
        }

        msg += "Please select from the available options.";

        this.showMessage(msg, "error", true);
      },

      /**
       * Get the option model given a dropdown text or label element. Label
       * elements are used for multi-select dropdowns, the value is a data
       * attribute. Text elements are for single-select dropdowns, so the value
       * is the current selection.
       * @param {HTMLElement} el The text or label element
       * @returns {SearchSelectOption|null} The option model or null if not
       * found
       * @since 0.0.0
       */
      optionFromSelectionEl(el) {
        if (!el) return null;
        const value =
          $(el).data("value") || this.$selectUI.dropdown("get value");
        if (!value && value !== 0) return null;
        return this.model.get("options").getOptionByLabelOrValue(value);
      },

      /**
       * Create HTML for a tooltip for a given option. By default this method
       * returns the description of the option, but can be overridden in
       * extended SearchSelectViews to return a custom HTML string based on
       * the option.
       * @param {SearchSelectOption} option The option to create a tooltip for
       * @param {JQuery} _$element The element to attach the tooltip to
       * @returns {string|null} An HTML string to use for the content of the
       * tooltip.
       * @since 0.0.0
       */
      tooltipHTML(option, _$element) {
        return option?.get("description") || null;
      },

      /**
       * Add a tooltip to a given element using the description in the options
       * object that's set on the view.
       * @param  {HTMLElement} element The HTML element a tooltip should be
       * added
       * @param  {object} settings Additional settings to override those set in
       * view.tooltipSettings.
       */
      addTooltip(element, settings) {
        // Tooltips are disabled when tooltipSettings is false
        const viewSettings = this.tooltipSettings;
        if (!viewSettings) return;

        const $element = $(element);
        const opt = this.optionFromSelectionEl(element);
        const html = this.tooltipHTML(opt, $element);
        if (!html) return;

        $element.popup({
          html,
          ...viewSettings,
          ...settings,
        });
      },

      /** Visually indicate that the select interface is enabled */
      enable() {
        this.enabled = true;
        this.$selectUI.removeClass(Semantic.CLASS_NAMES.dropdown.disabled);
      },

      /** Visually indicate that the select interface is inactive */
      inactivate() {
        this.enabled = false;
        this.$selectUI.addClass(Semantic.CLASS_NAMES.dropdown.disabled);
      },

      /**
       * Show an error, warning, or informational message, and highlight the
       * select interface in an appropriate colour.
       * @param  {string} message The message to display. Use an empty string to
       * only highlight the select interface without showing any message text.
       * @param  {string} type one of "error", "warning", or "info"
       * @param  {boolean} removeOnChange set to true to remove the message as
       * soon as the user changes the selection
       */
      showMessage(message, type = "info", removeOnChange = true) {
        if (!this.$selectUI) return;

        let level = typeof type === "string" ? type.toLowerCase() : "info";
        if (!Object.keys(MESSAGE_TYPES).includes(level)) {
          level = "info";
        }

        this.removeMessages();
        this.$selectUI.addClass(MESSAGE_TYPES[level].selectUIClass);

        if (message && message.length && typeof message === "string") {
          this.message = $(
            `<p style='margin:0.2rem' class='${MESSAGE_TYPES[level].messageClass}'><small>${message}</small></p>`,
          );
        }

        this.$el.append(this.message);

        if (removeOnChange) {
          this.listenToOnce(this.model, "change:selected", this.removeMessages);
        }
      },

      /** Remove all messages and classes set by the showMessage function */
      removeMessages() {
        if (!this.$selectUI) {
          return;
        }
        const classes = Object.values(MESSAGE_TYPES).map(
          (type) => type.selectUIClass,
        );
        this.$selectUI.removeClass(classes.join(" "));
        if (this.message) this.message.remove();
      },

      /** Visually indicate that dropdown options are loading */
      showLoading() {
        this.$selectUI.addClass(Semantic.CLASS_NAMES.dropdown.loading);
      },

      /** Remove the loading spinner set by the showLoading */
      hideLoading() {
        this.$selectUI.removeClass(Semantic.CLASS_NAMES.dropdown.loading);
      },
    },
  );

  return SearchSelectView;
});
