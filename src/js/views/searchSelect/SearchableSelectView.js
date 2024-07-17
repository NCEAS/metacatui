define([
  "jquery",
  "underscore",
  "backbone",
  "views/searchSelect/SeparatorView",
  "models/searchSelect/SearchSelect",
  "semanticUItransition",
  `text!${MetacatUI.root}/components/semanticUI/transition.min.css`,
  "semanticUIdropdown",
  `text!${MetacatUI.root}/components/semanticUI/dropdown.min.css`,
  "text!templates/selectUI/searchableSelect.html",
], (
  $,
  _,
  Backbone,
  SeparatorView,
  SearchSelect,
  _Transition,
  TransitionCSS,
  _Dropdown,
  DropdownCSS,
  Template,
) => {

  const BASE_CLASS = "searchable-select";
  const CLASS_NAMES = {
    // Classes from the Semantic UI dropdown module
    inactive: "disabled",
    loading: "loading",
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
       * Text to show in the input field before any value has been entered
       * @type {string}
       */
      placeholderText: "Search for or select a value",

      /**
       * Label for the input element
       * @type {string}
       */
      inputLabel: "Select a value",

      /**
       * The maximum width of images used for each option, in pixels
       * @type {number}
       */
      imageWidth: 30,

      /**
       * The maximum height of images used for each option, in pixels
       * @type {number}
       */
      imageHeight: 30,

      /**
       * Can be set to an object to specify API settings for retrieving remote
       * selection menu content from an API endpoint. Details of what can be set
       * here are specified by the Semantic-UI / Fomantic-UI package. Set to
       * false if not retrieving remote content.
       * @type {object | booealn}
       * @default false
       * @since 2.15.0
       * @see
       * {@link https://fomantic-ui.com/modules/dropdown.html#remote-settings}
       * @see {@link https://fomantic-ui.com/behaviors/api.html#/settings}
       */
      apiSettings: false,

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

        // Add CSS required for this view
        MetacatUI.appModel.addCSS(TransitionCSS, "semanticUItransition");
        MetacatUI.appModel.addCSS(DropdownCSS, "semanticUIdropdown");

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
        const modelAttrNames = Object.keys(SearchSelect.prototype.defaults);
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
        this.model = new SearchSelect(modelAttrs);
      },

      /**
       * Render the view
       * @returns {SearchableSelectView}  Returns the view
       */
      render() {
        const view = this;

        // TODO: 
        if (view.apiSettings && !view.semanticAPILoaded) {
          // eslint-disable-next-line import/no-dynamic-require
          require(["semanticAPI"], (_SemanticAPI) => {
            view.semanticAPILoaded = true;
            view.render();
          });
          return this;
        }

        // Render the template using the view attributes
        this.$el.html(this.renderTemplate());

        // Start the dropdown in an inactive state. This allows us to pre-select
        // values without triggering a change event.
        this.inactivate();
        this.showLoading();

        this.renderSelectUI();
        this.listenToModel();
        this.listenToSelectUI();

        // Add tool tips for the description
        this.$el.find(".item").each((_i, item) => {
          view.addTooltip(item);
        });

        const invalidSelections = view.model.hasInvalidSelections();
        if (invalidSelections) {
          view.showInvalidSelectionError(invalidSelections);
        }

        this.updateSubmenuStyle();

        this.enable();
        this.hideLoading();

        return this;
      },

      renderSelectUI() {
        const view = this;
        // Initialize the dropdown interface For explanations of settings, see:
        // https://semantic-ui.com/modules/dropdown.html#/settings
        this.$selectUI = this.$el.find(".ui.dropdown").dropdown({
          keys: {
            // So that a user may enter search text using a comma
            delimiter: false,
          },
          apiSettings: this.apiSettings,
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
          }

        });

        view.$selectUI.data("view", view);

        // Set the selected values in the dropdown
        const selected = this.model.get("selected");
        this.$selectUI.dropdown("set exactly", selected);
        this.$selectUI.dropdown("save defaults");
      },

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

        if (view.model.separatorRequired()) {
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
        const allLabels = view.$selectUI.find(".label");
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
        const view = this

        // Update values for single-select inputs (multi-select are updated
        // using the onLabelCreate and onRemove callbacks)
        if (!view.model.get("allowMulti")) {
          const silent = this.$selectUI.hasClass(CLASS_NAMES.inactive);
          view.model.setSelected(values, { silent });
        }

        // Refresh the tooltips on the labels/text

        // Ensure tooltips for labels are removed
        $(".search-select-tooltip").remove();

        // Add a tooltip for single select elements (.text) or multi-select
        // elements (.label). Delay so that to give time for DOM elements to be
        // added or removed.
        setTimeout(() => {
          const textEl = view.$selectUI.find(".text:not(.default),.label");
          // Single select text element will not have the value attribute, add
          // it so that we can find the matching description for the tooltip
          if (!textEl.data("value") && !view.model.get("allowMulti")) {
            textEl.data("value", values);
          }
          if (textEl) {
            textEl.each((i, el) => {
              view.addTooltip.call(view, el, "top");
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
        this.listenTo(this.model, "change:options", this.updateMenu);
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
       * Re-render the menu of options. Useful after changing the options that
       * are set on the view.
       * @since 0.0.0
       */
      updateMenu() {
        const menu = $(this.renderTemplate().trim()).find(".menu")[0].innerHTML;
        this.$el.find(".menu").html(menu);
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
        };
        const templateOptions = _.extend({}, this, templateOptionsFromModel);
        return this.template(templateOptions);
      },

      /**
       * Convert the submenu style to the style set in the model
       * @since 0.0.0
       */
      updateSubmenuStyle() {
        const subMenuStyle = this.model.get("submenuStyle");
        if (subMenuStyle === "popout") {
          this.convertToPopout();
        } else if (subMenuStyle === "accordion") {
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
       * Add a tooltip to a given element using the description in the options
       * object that's set on the view.
       * @param  {HTMLElement} element The HTML element a tooltip should be
       * added
       * @param  {"top"|"bottom"|"left"|"right"} position Tooltip position
       * @returns {jQuery} The element with a tooltip wrapped by jQuery
       */
      addTooltip(element, position = "bottom") {
        if (!element) {
          return $(element);
        }

        // Find the description in the options object, using the data-value
        // attribute set in the template. The data-value attribute is either the
        // label, or the value, depending on if a value is provided.
        let valueOrLabel = $(element).data("value");
        if (typeof valueOrLabel === "undefined") {
          return $(element);
        }
        if (typeof valueOrLabel === "boolean") {
          valueOrLabel = valueOrLabel.toString();
        }
        const opt = _.chain(this.options)
          .values()
          .flatten()
          .find(
            (option) =>
              option.label === valueOrLabel || option.value === valueOrLabel,
          )
          .value();

        if (!opt) {
          return $(element);
        }
        if (!opt.description) {
          return $(element);
        }

        $(element)
          .tooltip({
            title: opt.description,
            placement: position,
            container: "body",
            delay: {
              show: 900,
              hide: 50,
            },
          })
          .on("show.bs.popover", (e) => {
            const $el = $(e.target);
            // Allow time for the popup to be added to the DOM
            setTimeout(() => {
              // Add class to identify popups when they need to be removed.
              $el.data("tooltip").$tip.addClass("search-select-tooltip");
            }, 10);
          });

        return $(element);
      },

      /**
       * Re-arrange the HTML to display category contents as sub-menus that
       * popout to the left or right of category titles
       */
      convertToPopout() {
        if (!this.$selectUI) {
          return;
        }
        if (this.currentSubmenuMode === "popout") {
          return;
        }
        this.currentSubmenuMode = "popout";
        this.$selectUI.addClass("popout-mode");
        const $headers = this.$selectUI.find(".header");
        if (!$headers || $headers.length === 0) {
          return;
        }
        $headers.each((_i, header) => {
          const $header = $(header);
          const $itemGroup = $().add($header.nextUntil(".header"));
          const $itemAndHeaderGroup = $header.add($header.nextUntil(".header"));
          const $icon = $header.next().find(".icon");
          if ($icon && $icon.length > 0) {
            const $headerIcon = $icon.clone().addClass("popout-mode-icon").css({
              opacity: "0.9",
              "margin-right": "1rem",
            });
            $header.prepend($headerIcon[0]);
          }
          $itemAndHeaderGroup.wrapAll("<div class='item popout-mode'/>");
          $itemGroup.wrapAll("<div class='menu popout-mode'/>");
          $header.append(
            "<i class='popout-mode-icon dropdown icon icon-on-right icon-chevron-right'></i>",
          );
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
        this.$selectUI.find(".popout-mode > *").unwrap();
        this.$selectUI.find(".accordion-mode > *").unwrap();
        this.$selectUI.find(".popout-mode-icon").remove();
        this.$selectUI.find(".accordion-mode-icon").remove();
        this.$selectUI.removeClass("popout-mode accordion-mode");
      },

      /**
       * Re-arrange the HTML to display category items with expandable sections,
       * similar to an accordion element.
       */
      convertToAccordion() {
        if (!this.$selectUI) {
          return;
        }
        if (this.currentSubmenuMode === "accordion") {
          return;
        }
        this.currentSubmenuMode = "accordion";
        this.$selectUI.addClass("accordion-mode");
        const $headers = this.$selectUI.find(".header");
        if (!$headers || $headers.length === 0) {
          return;
        }

        // Id to match the header to the
        $headers.each((_i, header) => {
          const $header = $(header);
          // Create an ID
          const randomNum = Math.floor(Math.random() * 100000 + 1);
          const headerText = $header.text().replace(/\W/g, "");
          const id = headerText + randomNum;

          const $itemGroup = $().add($header.nextUntil(".header"));
          const $icon = $header.next().find(".icon");
          if ($icon && $icon.length > 0) {
            const $headerIcon = $icon
              .clone()
              .addClass("accordion-mode-icon")
              .css({
                opacity: "0.9",
                "margin-right": "1rem",
              });
            $header.prepend($headerIcon[0]);
            $header.wrap(
              `<a data-toggle='collapse' data-target='#${id}' class='accordion-mode collapsed'/>`,
            );
          }
          $itemGroup.wrapAll(
            `<div id='${id}' class='accordion-mode collapse'/>`,
          );
          $header.append(
            "<i class='accordion-mode-icon dropdown icon icon-on-right icon-chevron-down'></i>",
          );
        });
      },

      /**
       * In the searchable select interface, hide category headers that are
       * empty, if any
       */
      hideEmptyCategories() {
        const $headers = this.$selectUI.find(".header");
        if (!$headers || $headers.length === 0) {
          return;
        }
        $headers.each((_i, header) => {
          const $header = $(header);
          // this is the header
          const $itemGroup = $().add($header.nextUntil(".header"));
          const $itemGroupFiltered = $().add(
            $header.nextUntil(".header", ".filtered"),
          );
          // If all items are filtered
          if ($itemGroup.length === $itemGroupFiltered.length) {
            // Then also hide the header
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
        this.$selectUI.find(".header:hidden").show();
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
        this.$el.find(".ui.dropdown").removeClass(CLASS_NAMES.inactive);
      },

      /** Visually indicate that the select interface is inactive */
      inactivate() {
        this.enabled = false;
        this.$el.find(".ui.dropdown").addClass(CLASS_NAMES.inactive);
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
        const classes = Object.values(MESSAGE_TYPES).map((type) => type.selectUIClass);
        this.$selectUI.removeClass(classes.join(" "));
        if (this.message) this.message.remove();
      },

      /** Visually indicate that dropdown options are loading */
      showLoading() {
        this.$el.find(".ui.dropdown").addClass(CLASS_NAMES.loading);
      },

      /** Remove the loading spinner set by the showLoading */
      hideLoading() {
        this.$el.find(".ui.dropdown").removeClass(CLASS_NAMES.loading);
      },
    },
  )

  return SearchableSelectView;
});
