"use strict";

define([
  "jquery",
  "underscore",
  "backbone",
  "views/searchSelect/SeparatorView",
  "models/searchSelect/SearchSelect",
  "semanticUItransition",
  "semanticUIdropdown",
  "semanticPopup",
  `text!${MetacatUI.root}/components/semanticUI/transition.min.css`,
  `text!${MetacatUI.root}/components/semanticUI/dropdown.min.css`,
  `text!${MetacatUI.root}/components/semanticUI/popup.min.css`,
  `text!${MetacatUI.root}/components/semanticUI/card.min.css`,
  "text!templates/selectUI/searchableSelect.html",
], (
  $,
  _,
  Backbone,
  SeparatorView,
  SearchSelect,
  _Transition,
  _Dropdown,
  _Popup,
  TransitionCSS,
  DropdownCSS,
  PopupCSS,
  CardCSS,
  Template,
) => {
  // The base class for the searchable select view
  const BASE_CLASS = "searchable-select";

  // Class names that we use in the view, including those from the dropdown
  // module
  const CLASS_NAMES = {
    inputLabel: `${BASE_CLASS}-label`,
    placeholder: "default text", // Not sure where these come from
    popout: "popout-mode",
    accordion: "accordion-mode",
    chevronDown: "dropdown icon icon-on-right icon-chevron-down",
    chevronRight: "dropdown icon icon-on-right icon-chevron-right",
    accordionIcon: "accordion-mode-icon",
    popoutIcon: "popout-mode-icon",
    dropdown: $().dropdown.settings.className,
  };

  // This is missing from older version of the dropdown module TODO: On updating
  // to new version, this should be available
  CLASS_NAMES.dropdown.text = "text";

  // Selectors for the dropdown module
  const DROPDOWN_SELECTORS = $().dropdown.settings.selector;

  // Classes that we use from the bootstrap module
  const BOOTSTRAP_CLASS_NAMES = {
    collapse: "collapse",
    collapsed: "collapsed",
  };

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

  /**
   * @class SearchableSelectView
   * @classdesc A select interface that allows the user to search from within
   * the options, and optionally select multiple items. Also allows the items to
   * be grouped, and to display an icon or image for each item.
   * @classcategory Views/SearchSelect
   * @augments Backbone.View
   * @class
   * @since 2.14.0
   * @screenshot views/searchSelect/SearchableSelectView.png
   */
  const SearchableSelectView = Backbone.View.extend(
    /** @lends SearchableSelectView.prototype */
    {
      /**
       * The type of View this is
       * @type {string}
       */
      type: "SearchableSelect",

      /**
       * The HTML class names for this view element
       * @type {string}
       */
      className: BASE_CLASS,

      /**
       * The constructor function for the model that this view uses. Must be a
       * SearchSelect or an extension of it.
       * @type {Backbone.Model}
       * @since 0.0.0
       */
      ModelType: SearchSelect,

      /**
       * The max height and width of images used for each option in pixels, respectively
       * @type {number[]}
       * @since 0.0.0
       */
      imageSize: [30, 30],

      /**
       * Options and selected values for the searchable select interface show a
       * tooltip with the description of the option when the user hovers over
       * the option. This object is passed to the Formantic UI popup module to
       * configure the tooltip. Set to false to disable tooltips.
       * @see https://fomantic-ui.com/modules/popup.html#/settings
       * @type {object|boolean}
       * @since 0.0.0
       */
      tooltipSettings: {
        position: "top left",
        delay: {
          show: 450,
          hide: 10,
        },
        exclusive: true,
      },

      /**
       * The primary HTML template for this view. The template follows the
       * structure specified for the semanticUI dropdown module, see:
       * https://semantic-ui.com/modules/dropdown.html#/definition
       * @type {Underscore.template}
       */
      template: _.template(Template),

      /**
       * Creates a new SearchableSelectView
       * @param {object} opts A literal object with options to pass to the view
       */
      initialize(opts) {
        const options = opts || {};

        // TODO: Make a bundle of required CSS files for semantic UI
        MetacatUI.appModel.addCSS(TransitionCSS, "semanticUItransition");
        MetacatUI.appModel.addCSS(DropdownCSS, "semanticUIdropdown");
        MetacatUI.appModel.addCSS(PopupCSS, "semanticUIpopup");
        MetacatUI.appModel.addCSS(CardCSS, "semanticUIcard");

        // Set options on the view and create the model
        const { modelAttrs, viewAttrs } = this.splitModelViewOptions(options);
        if (!options.model) this.createModel(modelAttrs);
        _.extend(this, viewAttrs);
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
          modelAttrs.selected = _.clone(options.selected);
        }
        this.model = new this.ModelType(modelAttrs);
      },

      /** @inheritdoc */
      render() {
        const view = this;

        // If we're using remote content, load the semantic API module
        if (view.model.get("apiSettings") && !view.semanticAPILoaded) {
          // eslint-disable-next-line import/no-dynamic-require
          require(["semanticAPI"], (_SemanticAPI) => {
            view.semanticAPILoaded = true;
            view.render();
          });
          return this;
        }

        // Render the template using the view attributes
        this.$el.html(this.renderTemplate());
        this.$selectUI = this.$el.find(DROPDOWN_SELECTORS.dropdown);

        // Start the dropdown in an inactive state. This allows us to pre-select
        // values without triggering a change event.
        this.inactivate();
        this.showLoading();

        this.renderSelectUI();
        this.listenToModel();
        this.listenToSelectUI();

        this.updateSubmenuStyle(true);
        this.addTooltipsToItems();
        this.checkForInvalidSelections();

        this.enable();
        this.hideLoading();

        return this;
      },

      /** Initialize the dropdown interface */
      renderSelectUI() {
        const view = this;
        // Initialize the dropdown interface For explanations of settings, see:
        // https://semantic-ui.com/modules/dropdown.html#/settings
        this.$selectUI = this.$selectUI.dropdown({
          keys: {
            // So that a user may enter search text using a comma
            delimiter: false,
          },
          apiSettings: this.model.get("apiSettings"),
          fullTextSearch: true,
          duration: 90,
          forceSelection: false,
          ignoreDiacritics: true,
          clearable: view.model.get("clearable"),
          allowAdditions: view.model.get("allowAdditions"),
          hideAdditions: false,
          allowReselection: true,
          onRemove(removedValue) {
            view.model.removeSelected(removedValue);
          },
          onLabelCreate(value, _text) {
            const $label = this;
            return view.onLabelCreate.call(view, value, _text, $label);
          },
          onLabelRemove(value) {
            const $label = this;
            view.onLabelRemove.call(view, value, $label);
          },
          onChange(values, _text, _$choice) {
            view.onChange.call(view, values, _text, _$choice);
          },
        });

        view.$selectUI.data("view", view);

        // Set the selected values in the dropdown
        const selected = this.model.get("selected");
        this.$selectUI.dropdown("set exactly", selected);
        this.$selectUI.dropdown("save defaults");
      },

      /**
       * Callback when a label is created in the dropdown interface. This
       * function adds a separator between labels if required.
       * @param {string} value The value of the label that was created
       * @param {string} _text The text of the label that was created
       * @param {JQuery} $label The label element that was created
       * @returns {JQuery} The updated label element
       * @since 0.0.0
       */
      onLabelCreate(value, _text, $label) {
        const view = this;
        // Callback when a label is created *for multi-select inputs only*

        // Add the value to the selected array (but don't add twice). Do this in
        // the onLabelCreate callback instead of in the onAdd callback because
        // we would like to update the selected array before we create the
        // separator element (below).
        view.model.addSelected(value);
        // Add a separator between labels if required.

        let $updatedLabel = $label;

        if (view.model.separatorRequired(value)) {
          // Create the separator element.
          const separator = view.createSeparator();
          if (separator) {
            // Attach the separator to the label so that we can easily remove it
            // when the label is removed.
            $label.data("separator", separator);
            // Add it before the label element.
            $updatedLabel = separator.$el.add($label);
          }
        }
        return $updatedLabel;
      },

      /**
       * Call back from the select UI when a label is removed from multi-select
       * inputs. This function removes separators that are no longer needed.
       * @param {string} _value The value of the label that was removed
       * @param {JQuery} $label The label element that was removed
       * @since 0.0.0
       */
      onLabelRemove(_value, $label) {
        const view = this;
        const sep = $label.data("separator");
        sep?.remove();
        // Remove separator from second label if the first label is the one
        // being removed
        const allLabels = view.$selectUI.find(DROPDOWN_SELECTORS.siblingLabel);
        if (allLabels.index($label) === 0) {
          allLabels.eq(1)?.data("separator")?.remove();
        }
      },

      /**
       * Callback when the user changes the selection in the dropdown. We update
       * the model with the new selection when the dropdown is a single-select.
       * Multi-select dropdowns are updated in the onLabelCreate and
       * onLabelRemove
       * @param {string} values The selected values separated by commas
       * @param {string} _text The text of the selected values
       * @param {JQuery} _$choice The selected choice element
       * @since 0.0.0
       */
      onChange(values, _text, _$choice) {
        const view = this;

        // Update values for single-select inputs (multi-select are updated
        // using the onLabelCreate and onRemove callbacks)
        if (!view.model.get("allowMulti")) {
          const silent = this.$selectUI.hasClass(CLASS_NAMES.dropdown.disabled);
          view.model.setSelected(values, { silent });
        }

        // Refresh the tooltips on the labels/text

        // Add a tooltip for single select elements (.text) or multi-select
        // elements (.label). Delay so that to give time for DOM elements to be
        // added or removed.
        setTimeout(() => {
          const selector = `.${CLASS_NAMES.dropdown.text}:not(.default),${DROPDOWN_SELECTORS.siblingLabel}`;
          const textEl = view.$selectUI.find(selector);

          // Single select text element will not have the value attribute, add
          // it so that we can find the matching description for the tooltip
          if (!textEl.data("value") && !view.model.get("allowMulti")) {
            textEl.data("value", values);
          }
          if (textEl) {
            textEl.each((_i, el) => {
              view.addTooltip.call(view, el);
            });
          }
        }, 50);
      },

      /**
       * Update the view when certain model attributes change
       * @since 0.0.0
       */
      listenToModel() {
        const view = this;
        this.listenTo(this.model, "change:options", this.render);
        this.listenTo(
          this.model,
          "change:submenuStyle",
          this.updateSubmenuStyle,
        );
        if (this.model.get("hideEmptyCategoriesOnSearch")) {
          this.listenTo(
            this.model,
            "change:searchTerm",
            (_model, searchTerm) => {
              if (searchTerm) {
                view.hideEmptyCategories();
              } else {
                view.showAllCategories();
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
       * @param {SearchableSelectOptions} options The new options
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
          // clear any error messages
          view.removeMessages();
        }
      },

      /**
       * Add tooltips to the items in the dropdown menu
       * @since 0.0.0
       */
      addTooltipsToItems() {
        const view = this;
        const items = this.$el.find(`.${CLASS_NAMES.dropdown.item}`);
        items.each((_i, item) => view.addTooltip(item));
      },

      /**
       * Renders the template for the view
       * @returns {string} The HTML for the view
       * @since 0.0.0
       */
      renderTemplate() {
        const templateOptionsFromModel = {
          allowMulti: this.model.get("allowMulti"),
          options: this.model.optionsAsJSON(true),
          classes: CLASS_NAMES,
          placeholderText: this.model.get("placeholderText"),
          inputLabel: this.model.get("inputLabel"),
          imageHeight: this.imageSize?.[0] || 30,
          imageWidth: this.imageSize?.[1] || 30,
        };
        const templateOptions = _.extend({}, this, templateOptionsFromModel);
        return this.template(templateOptions);
      },

      /**
       * Convert the submenu style to the style set in the model
       * @param {boolean} [force] Set to true to force the view to update
       * @since 0.0.0
       */
      updateSubmenuStyle(force = false) {
        if (force === true) this.currentSubmenuMode = null;
        const submenuStyle = this.model.get("submenuStyle");
        if (submenuStyle === "popout") {
          this.convertToPopout();
        } else if (submenuStyle === "accordion") {
          this.convertToAccordion();
        } else {
          this.convertToList();
        }
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
       * Get the option model given a dropdown text or label element
       * @param {HTMLElement} label The label element
       * @returns {SearchSelectOption|null} The option model or null if not
       * found
       * @since 0.0.0
       */
      optionFromLabel(label) {
        const $label = $(label);
        if (!$label) return null;
        const value = $label.data("value");
        if (!value) return null;
        return this.model.get("options").getOptionByLabelOrValue(value);
      },

      /**
       * Create HTML for a tooltip for a given option. By default this method
       * returns the description of the option, but can be overridden in
       * extended SearchableSelectViews to return a custom HTML string based on
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
        const opt = this.optionFromLabel(element);
        const html = this.tooltipHTML(opt, $element);
        if (!html) return;

        $element.popup({
          html,
          ...viewSettings,
          ...settings,
        });
      },

      /**
       * Re-arrange HTML to display the full list of options in one static menu
       */
      convertToList() {
        if (!this.$selectUI) {
          return;
        }
        if (this.currentSubmenuMode === "list") {
          return;
        }
        this.currentSubmenuMode = "list";

        this.$selectUI.find(`.${CLASS_NAMES.popout} > *`).unwrap();
        this.$selectUI.find(`.${CLASS_NAMES.accordion} > *`).unwrap();

        // TODO
        this.$selectUI.find(`.${CLASS_NAMES.accordionIcon}`).remove();
        this.$selectUI.find(`.${CLASS_NAMES.popoutIcon}`).remove();

        this.$selectUI.removeClass(
          `${CLASS_NAMES.popout} ${CLASS_NAMES.accordion}`,
        );
      },

      /**
       * Re-arrange the HTML to display category contents as sub-menus that
       * popout to the left or right of category titles
       */
      convertToPopout() {
        if (!this.$selectUI || this.currentSubmenuMode === "popout") return;
        this.currentSubmenuMode = "popout";
        this.$selectUI.addClass(CLASS_NAMES.popout);

        const $headers = this.getItemHeaders();

        if (!$headers?.length) return;

        $headers.each((_i, header) => {
          const $header = $(header);
          const $itemGroup = $().add(
            $header.nextUntil(`.${CLASS_NAMES.dropdown.header}`),
          );
          const $itemAndHeaderGroup = $header.add(
            $header.nextUntil(`.${CLASS_NAMES.dropdown.header}`),
          );
          const $icon = $header.next().find(`.${CLASS_NAMES.dropdown.icon}`);
          if ($icon && $icon.length > 0) {
            const $headerIcon = $icon.clone().css({
              opacity: "0.9",
              "margin-right": "1rem",
            });
            $header.prepend($headerIcon[0]);
          }
          $itemAndHeaderGroup.wrapAll(
            `<div class='${CLASS_NAMES.item} ${CLASS_NAMES.popout}'/>`,
          );
          $itemGroup.wrapAll(
            `<div class='${CLASS_NAMES.dropdown.menu} ${CLASS_NAMES.popout}'/>`,
          );
          $header.append(
            `<i class='${CLASS_NAMES.popoutIcon} ${CLASS_NAMES.chevronRight}'></i>`,
          );
        });
      },

      /**
       * Re-arrange the HTML to display category items with expandable sections,
       * similar to an accordion element.
       */
      convertToAccordion() {
        if (!this.$selectUI || this.currentSubmenuMode === "accordion") return;

        this.currentSubmenuMode = "accordion";
        this.$selectUI.addClass(CLASS_NAMES.accordion);

        const $headers = this.getItemHeaders();
        if (!$headers?.length) return;

        // Id to match the header to the
        $headers.each((_i, header) => {
          const $header = $(header);
          // Create an ID
          const randomNum = Math.floor(Math.random() * 100000 + 1);
          const headerText = $header.text().replace(/\W/g, "");
          const id = headerText + randomNum;

          const $itemGroup = $().add(
            $header.nextUntil(`.${CLASS_NAMES.dropdown.header}`),
          );
          const $icon = $header.next().find(`.${CLASS_NAMES.dropdown.icon}`);
          if ($icon && $icon.length > 0) {
            const $headerIcon = $icon
              .clone()
              .addClass(CLASS_NAMES.accordionIcon)
              .css({
                opacity: "0.9",
                "margin-right": "1rem",
              });
            $header.prepend($headerIcon[0]);
            $header.wrap(
              `<a data-toggle='${BOOTSTRAP_CLASS_NAMES.collapse}' data-target='#${id}' class='${CLASS_NAMES.accordion} ${BOOTSTRAP_CLASS_NAMES.collapsed}'/>`,
            );
          }
          $itemGroup.wrapAll(
            `<div id='${id}' class='${CLASS_NAMES.accordion} ${BOOTSTRAP_CLASS_NAMES.collapse}'/>`,
          );
          $header.append(
            `<i class='${CLASS_NAMES.accordionIcon} ${CLASS_NAMES.chevronDown}'></i>`,
          );
        });
      },

      /**
       * Get the category headers in the dropdown menu
       * @returns {JQuery} The category headers
       * @since 0.0.0
       */
      getItemHeaders() {
        return this.$selectUI.find(`.${CLASS_NAMES.dropdown.header}`);
      },

      /**
       * In the searchable select interface, hide category headers that are
       * empty, if any
       */
      hideEmptyCategories() {
        const $headers = this.getItemHeaders();
        if (!$headers?.length) return;

        $headers.each((_i, header) => {
          const $header = $(header);
          // this is the header
          const $itemGroup = $().add(
            $header.nextUntil(`.${CLASS_NAMES.dropdown.header}`),
          );
          const $itemGroupFiltered = $().add(
            $header.nextUntil(
              `.${CLASS_NAMES.dropdown.header}`,
              `.${CLASS_NAMES.dropdown.filtered}`,
            ),
          );
          // If all items are filtered then also hide the header
          if ($itemGroup.length === $itemGroupFiltered.length) {
            $header.hide();
          } else {
            $header.show();
          }
        });
      },

      /**
       * In the searchable select interface, show all category headers that we
       * re previously empty
       */
      showAllCategories() {
        this.getItemHeaders().show();
      },

      /**
       * Add a value to the selected array in the model to reflect the user's
       * selection in the interface
       * @param {string} newValue The value to add to the selected array
       * @param {boolean} silent Set to true to inactivate the select interface
       * and prevent the model from triggering a change event
       * @since 0.0.0
       */
      addSelected(newValue, silent = false) {
        const view = this;
        if (silent === true) {
          view.inactivate();
        }
        this.model.addSelected(newValue, { silent });
        const selected = this.model.get("selected");
        this.$selectUI.dropdown("set selected", selected);
        if (silent === true) {
          view.enable();
        }
      },

      /**
       * Set selected values in the interface
       * @param  {string[]} newValues An array of strings to select
       * @param  {boolean} silent Set to true to inactivate the select interface
       */
      changeSelection(newValues, silent = false) {
        if (
          !this.$selectUI ||
          typeof newValues === "undefined" ||
          !Array.isArray(newValues)
        ) {
          return;
        }
        const view = this;
        if (silent === true) {
          view.inactivate();
        }
        this.model.setSelected(newValues, { silent });
        this.$selectUI.dropdown("set exactly", newValues);
        if (silent === true) {
          view.enable();
        }
      },

      /** Visually indicate that the select interface is enabled */
      enable() {
        this.enabled = true;
        this.$selectUI.removeClass(CLASS_NAMES.dropdown.disabled);
      },

      /** Visually indicate that the select interface is inactive */
      inactivate() {
        this.enabled = false;
        this.$selectUI.addClass(CLASS_NAMES.dropdown.disabled);
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
        this.$selectUI.addClass(CLASS_NAMES.dropdown.loading);
      },

      /** Remove the loading spinner set by the showLoading */
      hideLoading() {
        this.$selectUI.removeClass(CLASS_NAMES.dropdown.loading);
      },
    },
  );

  return SearchableSelectView;
});
