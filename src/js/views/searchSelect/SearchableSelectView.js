define([
    "jquery",
    "underscore",
    "backbone",
    "semanticUItransition",
    "text!" + MetacatUI.root + "/components/semanticUI/transition.min.css",
    "semanticUIdropdown",
    "text!" + MetacatUI.root + "/components/semanticUI/dropdown.min.css",
    "text!templates/selectUI/searchableSelect.html",
  ],
  function($, _, Backbone, Transition, TransitionCSS, Dropdown, DropdownCSS, Template) {

    /**
     * @class SearchableSelectView
     * @classdesc A select interface that allows the user to search from within
     * the options, and optionally select multiple items. Also allows the items
     * to be grouped, and to display an icon or image for each item.
     * @classcategory Views/SearchSelect
     * @extends Backbone.View
     * @constructor
     * @since 2.14.0
     * @screenshot views/searchSelect/SearchableSelectView.png
     */
    return Backbone.View.extend(
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
        className: "searchable-select",

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
         * Whether to allow users to select more than one value
         * @type {boolean}
         */
        allowMulti: true,

        /**
         * Setting to true gives users the ability to add their own options that
         * are not listed in this.options. This can work with either single
         * or multiple search select dropdowns
         * @type {boolean}
         */
        allowAdditions: false,

        /**
         * Whether the dropdown value can be cleared by the user after being
         * selected.
         * @type {boolean}
         */
        clearable: true,

        /**
        * When items are grouped within categories, this attribute determines how to display the items
        * within each category.
        * @type {string}
        * @example
        * // display the items in a traditional, non-interactive list below category titles
        * "list"
        * @example
        * // initially show only a list of category titles, and popout
        * // a submenu on the left or right when the user hovers over
        * // or touches a category (can lead to the sub-menu being hidden
        * // on mobile devices if the element is wide)
        * "popout"
        * @example
        * // initially show only a list of category titles, and expand
        * // the list of items below each category when a user clicks
        * // on the category title, much like an "accordion" element.
        * "accordion"
        * @default "list"
         */
        submenuStyle: "list",

        /**
         * Set to false to always display category headers in the dropdown,
         * even if there are no results in that category when a user is searching.
         * @type {boolean}
         */
        hideEmptyCategoriesOnSearch: true,

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
         * For select inputs where multiple values are allowed
         * ({@link SearchableSelectView#allowMulti} is true), optional text to insert
         * between labels. Separator text is useful for indicating operators in filter
         * fields or values.
         * @type {string}
         * @since 2.15.0
         */
        separatorText: "",

        /**
        * For select inputs where multiple values are allowed
        * ({@link SearchableSelectView#allowMulti} is true), a list of
        * {@link SearchableSelectView#separatorText} options. If a list is provided here
        * (AND a value is provided for the {@link SearchableSelectView#separatorText}
        * option), then a user can click on the separator text between two values to
        * change the text to the next string in this list. If separatorTextOptions is
        * false (or if there is no separatorText value), then changing the separator text
        * is not possible. This view will trigger a "separatorChanged" event when the
        * separator is updated.
        * @type {string[]}
        * @since 2.17.0
        */
        separatorTextOptions: ["AND", "OR"],

        /**
         * The HTML class name to add to the separator elements that are created for this
         * view.
         * @type {string}
         * @since 2.15.0
         */
        separatorClass: "separator",

        /** 
         * An additional HTML class to add to separator elements on hover when a user can
         * click that element to switch the text.
         * @type {string}
         * @since 2.17.0
         */
        changeableSeparatorClass: "changeable-separator",

        /**
         * For separators that are changeable (see
         * {@link SearchableSelectView#separatorTextOptions}), optional tooltip text to
         * show when a user hovers over a separator element.
         * @type {string}
         * @since 2.17.0
         */
        changeableSeparatorTooltip: "Click to switch the operator",

        /**
         * The list of options that a user can select from in the dropdown menu. For
         * un-categorized options, provide an array of objects, where each object is a
         * single option. To create category headings, provide an object containing named
         * objects, where the key for each object is the category title to display, and
         * the value of each object comprises the option properties.
         * @name SearchableSelectView#options
         * @type {Object[]|Object}
         * @property {string} icon - The name of a Font Awesome 3.2.1 icon to display to
         * the left of the label (e.g. "lemon", "heart")
         * @property {string} image - The complete path to an image to use instead of an
         * icon. If both icon and image are provided, the icon will be used.
         * @property {string} label - The label to show for the option
         * @property {string} description - A description of the option, displayed as a
         * tooltip when the user hovers over the label
         * @property {string} value - If the value differs from the label, the value to
         * return when this option is selected (otherwise label is returned)
         * @example
         * [
         *   {
         *     icon: "",
         *     image: "https://www.dataone.org/uploads/member_node_logos/bcodmo_hu707c109c683d6da57b432522b4add783_33081_300x0_resize_box_2.png",
         *     label: "BCO",
         *     description: "The The Biological and Chemical Oceanography Data Management Office (BCO-DMO) serve data from research projects funded by the Biological and Chemical Oceanography Sections and the Division of Polar Programs Antarctic Organisms & Ecosystems Program at the U.S. National Science Foundation.",
         *     value: "urn:node:BCODMO"
         *   },
         *   {
         *     icon: "",
         *     image: "https://www.dataone.org/uploads/member_node_logos/arctic.png",
         *     label: "ADC",
         *     description: "The US National Science Foundation Arctic Data Center operates as the primary repository supporting the NSF Arctic community for data preservation and access.",
         *     value: "urn:node:ARCTIC"
         *   },
         * ]
         * @example
         * {
         *   "category A": [
         *     {
         *       icon: "flag",
         *       label: "Flag",
         *       description: "This is a flag"
         *     },
         *     {
         *       icon: "gift",
         *       label: "Gift",
         *       description: "This is a gift"
         *     }
         *   ],
         *   "category B": [
         *     {
         *       icon: "pencil",
         *       label: "Pencil",
         *       description: "This is a pencil"
         *     },
         *     {
         *       icon: "hospital",
         *       label: "Hospital",
         *       description: "This is a hospital"
         *     }
         *   ]
         * }
         */
        options: [],

        /**
         * The values that a user has selected. If provided to the view upon
         * initialization, the values will be pre-selected. Selected values must
         * exist as a label in the options {@link SearchableSelect#options}
         * @type {string[]}
         */
        selected: [],

        /**
         * Can be set to an object to specify API settings for retrieving remote selection
         * menu content from an API endpoint. Details of what can be set here are
         * specified by the Semantic-UI / Fomantic-UI package. Set to false if not
         * retrieving remote content.
         * @type {Object|booealn}
         * @default false
         * @since 2.15.0
         * @see {@link https://fomantic-ui.com/modules/dropdown.html#remote-settings}
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
         * @param {Object} options - A literal object with options to pass to the view
         */
        initialize: function(options) {

          try {

            // Add CSS required for this view
            MetacatUI.appModel.addCSS(TransitionCSS, "semanticUItransition");
            MetacatUI.appModel.addCSS(DropdownCSS, "semanticUIdropdown");

            // If pre-selected values that are passed to this view are also attached to a
            // model (e.g. when they were passed to this view as {selected:
            // parentView.model.get("values")}), then it's important that we use a clone
            // instead. Otherwise this view may silently update the model, and important
            // events may not be triggered.
            if(options.selected){
              options.selected = _.clone(options.selected);
            }

            // If pre-selected values that are passed to this view are also attached to a
            // model (e.g. when they were passed to this view as {selected:
            // parentView.model.get("values")}), then it's important that we use a clone
            // instead. Otherwise this view may silently update the model, and important
            // events may not be triggered.
            if(options.selected){
              options.selected = _.clone(options.selected);
            }

            // Get all the options and apply them to this view
            if (typeof options == "object") {
              var optionKeys = Object.keys(options);
              _.each(optionKeys, function(key, i) {
                this[key] = options[key];
              }, this);
            }

          } catch (e) {
            console.log("Failed to initialize a Searchable Select view, error message:",
            e);
          }
        },

        /**
         * Render the view
         *
         * @return {SearchableSelect}  Returns the view
         */
        render: function() {

          try {

            var view = this;

            if(view.apiSettings && !view.semanticAPILoaded){
              require([MetacatUI.root + "/components/semanticUI/api.min.js"], function(SemanticAPI){
                view.semanticAPILoaded = true
                view.render();
              })
              return;
            }

            // Render the template using the view attributes
            this.$el.html(this.template(this));

            // Start the dropdown in a disabled state.
            // This allows us to pre-select values without triggering a change
            // event.
            this.disable();
            this.showLoading();

            // Initialize the dropdown interface
            // For explanations of settings, see:
            // https://semantic-ui.com/modules/dropdown.html#/settings
            this.$selectUI = this.$el.find('.ui.dropdown')
              .dropdown({
                keys : {
                  // So that a user may enter search text using a comma
                  delimiter  : false
                },
                apiSettings: this.apiSettings,
                fullTextSearch: true,
                duration: 90,
                forceSelection: false,
                ignoreDiacritics: true,
                clearable: view.clearable,
                allowAdditions: view.allowAdditions,
                hideAdditions: false,
                allowReselection: true,
                onRemove: function(removedValue){
                  // Callback when a value is removed *for multi-select inputs only*
                  // Remove the value from the selected array
                  view.selected = view.selected.filter(function(value){
                    return value !== removedValue
                  })
                },
                onLabelCreate: function(value, text){
                   // Callback when a label is created *for multi-select inputs only*

                  // Add the value to the selected array (but don't add twice). Do this in
                  // the onLabelCreate callback instead of in the onAdd callback because
                  // we would like to update the selected array before we create the
                  // separator element (below).
                  if(!view.selected.includes(value)){
                    view.selected.push(value)
                  }
                  // Add a separator between labels if required.
                  var label = this;
                  if(view.separatorRequired.call(view)){
                    // Create the separator element.
                    var separator = view.createSeparator.call(view);
                    if(separator){
                      // Attach the separator to the label so that we can easily remove it
                      // when the label is removed.
                      label.data("separator", separator);
                      // Add it before the label element.
                      label = separator.add(label);
                    }
                  }
                  return label
                },
                onLabelRemove(value){
                  // Call back when a user deletes a label *for multi-select inputs only*
                  var label = this;
                  // Remove the separator before this label if there is one.
                  var sep = label.data("separator")
                  if(sep){
                    sep.remove()
                  }
                  // If this is the first label in an input of at least two, then delete
                  // the separator directly *after* this label - The label that's second
                  // will become first, and should not have an separator before it.
                  var allLabels = view.$selectUI.find(".label");
                  if(allLabels.index(label) === 0){
                    var separatorAfter = label.next("." + view.separatorClass);
                    if(separatorAfter){
                      separatorAfter.remove();
                    }
                  }
                },
                onChange: function(values, text, $choice){

                  // Callback when values change for any type of input.

                  // NOTE: The "values" argument is a string that contains all the
                  // selected values separated by commas. We updated the view.selected
                  // array with the onLabelCreate and onRemove callbacks instead of using
                  // the values argument passed to this function in order to allow commas
                  // within individual values. For example, if the user selected the value
                  // "x" and the value "y,z", the values string would be "x,y,z" and it
                  // would be difficult to see that two values were selected instead of
                  // three.

                  // Update values for single-select inputs (multi-select are updated
                  // using the onLabelCreate and onRemove callbacks)
                  if(!view.allowMulti){
                    view.selected = [values]
                  }

                  // Trigger an event if items are selected after the UI has been rendered
                  // (It is set as disabled until fully rendered).
                  if(!$(this).hasClass("disabled")){
                    var newValues = _.clone(view.selected);
                    view.trigger('changeSelection', newValues);
                  }

                  // Refresh the tooltips on the labels/text

                  // Ensure tooltips for labels are removed
                  $(".search-select-tooltip").remove();

                  // Add a tooltip for single select elements (.text) or multi-select
                  // elements (.label). Delay so that to give time for DOM elements to be
                  // added or removed.
                  setTimeout(function(params) {
                    var textEl = view.$selectUI.find(".text:not(.default),.label");
                    // Single select text element will not have the value attribute, add
                    // it so that we can find the matching description for the tooltip
                    if(!textEl.data("value") && !view.allowMulti){
                      textEl.data("value", values)
                    }
                    if(textEl){
                      textEl.each(function(i, el){
                        view.addTooltip.call(view, el, "top");
                      })
                    }
                  }, 50);
                },
              });

            view.$selectUI.data("view", view);

            view.postRender();

            return this;

          } catch (e) {
            console.log("Error rendering the search select, error message: ", e);
          }
        },

        /**
         * Change the options available in the dropdown menu and re-render.
         * @param {SearchableSelectView#options} options - The new options
         * @since 2.24.0
         */
        updateOptions: function (options) {
          this.options = options;
          this.render();
        },

        /**
         * Checks whether a separator should be created for the label that was just
         * created, but not yet attached to the DOM
         * @return {boolean} - Returns true if a separator should be created, false
         * otherwise.
         * @since 2.15.0
         */
        separatorRequired: function(){
          try {
            if(
              // Separators not required if only one selection is allowed
              !this.allowMulti ||
              // Need separator text to create a separator element
              !this.separatorText ||
              // Need the list of selected values to determine the value's position
              !this.selected ||
              // Separator is only required between two or more values
              this.selected.length <= 1 ||
              // Separator is only required after the first element has been added
              this.$selectUI.find(".label").length === 0
            ){
              return false
            } else {
              return true
            }
          } catch (error) {
            console.log("Error checking if a label in a searchable select input " +
            "requires a separator. Assuming that it does not need one. Error details: " +
            error);
            return false
          }
        },

        /**
         * Create the HTML for a separator element to insert between two labels. The
         * view.separatorClass is added to the separator element.
         * @return {JQuery} Returns the separator as a jQuery element
         * @since 2.15.0
         */
        createSeparator: function(){
          try {
            var view = this;
            var separatorText = this.separatorText;
            // Text is required to create a separator.
            if(!separatorText){
              return null
            }
            var separator = $("<span>" + separatorText + "</span>");
            separator.addClass(this.separatorClass);
            
            // Set a listener to change the text to one of the separatorText
            // options on click, and to highlight all the separators when one is hovered
            var separatorElHovered = false
            if (view.separatorTextOptions && view.separatorTextOptions.length) {
              // Indicate that the separator is clickable
              separator.css('cursor', 'pointer');
              // Make sure the listeners set below are only set once
              separator.off("click mouseenter mouseout");
              // Change all the separator text when one is clicked
              separator.on("click", function () {
                view.changeSeparator();
              })
              // Create the tooltip
              if (view.changeableSeparatorTooltip) {
                $(separator).tooltip('destroy');
                $(separator).tooltip({
                  title: view.changeableSeparatorTooltip,
                  trigger: 'manual',
                })
              }
              // Highlight all of the separator elements when one is hovered
              separator.on("mouseenter", function () {
                var separatorEls = view.$el.find("." + view.separatorClass)
                separatorElHovered = true;
                // Add a delay before the highlight class is added
                setTimeout(function () {
                  if (separatorElHovered){
                    separatorEls.addClass(view.changeableSeparatorClass);
                    if (view.changeableSeparatorTooltip){
                      // Add an even longer delay before the tooltip is shown
                      setTimeout(function () {
                        if (separatorElHovered) {
                          $(separator).tooltip('show')
                        }
                      }, 600);
                    }
                  }
                }, 285);
              })
              // Hide all the tooltips and remove the highlight class on mouse out
              separator.on("mouseout", function () {
                separatorElHovered = false;
                var separatorEls = view.$el.find("." + view.separatorClass)
                separatorEls.removeClass(view.changeableSeparatorClass)
                separatorEls.tooltip('hide')
              })
            }
            return separator
          } catch (error) {
            console.log("There was an error creating a separator element in a " +
              "Searchable Select View. Error details: " + error);
          }
        },

        /**
         * Changes the separator text for all separator elements to the next value that's
         * set in the {@link SearchableSelectView#separatorTextOptions}. Triggers a
         * "separatorChanged" event that passes on the new separator value.
         */
        changeSeparator: function(){
          try {
            var view = this;
            if (
              !view.separatorTextOptions ||
              !view.separatorTextOptions.length ||
              !view.separatorText
            ){
              return
            }
            // Get the next separator text option
            var currentIndex = view.separatorTextOptions.indexOf(view.separatorText),
                nextIndex = currentIndex + 1;
            if (currentIndex === -1 || !view.separatorTextOptions[nextIndex] ){
              nextIndex = 0
            }
            // Update the current separator text on the view
            view.separatorText = view.separatorTextOptions[nextIndex]
            // Change the separator text for all of the separators in the view with an
            // animation
            var separatorEls = view.$el.find("." + view.separatorClass)
            separatorEls.transition({
              animation: 'pulse',
              displayType: 'inline-block',
              duration: '250ms',
              onComplete: function(){
                $(this).text(view.separatorText)
              }
            });
            // Trigger an event for parent views
            view.trigger("separatorChanged", view.separatorText);
          }
          catch (error) {
            console.log(
              'There was an error switching the separator text in a SearchableSelectView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * updateMenu - Re-render the menu of options. Useful after changing
         * the options that are set on the view.
         */
        updateMenu: function(){
          try {
            var menu = $(this.template(this).trim()).find(".menu")[0].innerHTML;
            this.$el.find(".menu").html(menu);
          } catch (e) {
            console.log("Failed to update a searchable select menu, error message: " + e);
          }
        },

        /**
         * postRender - Updates to the view once the dropdown UI has loaded
         */
        postRender: function(){
          try {

            var view = this;
            view.trigger("postRender");

            // Add tool tips for the description
            this.$el.find(".item").each(function(){
              view.addTooltip(this)
            });

            // Show an error message if the pre-selected options are not in the
            // list of available options (only if user additions are not allowed)
            if(!view.allowAdditions){
              if(view.selected && view.selected.length){
                var invalidOptions = [];
                view.selected.forEach(function(item){
                  if(!view.isValidOption(item)){
                    invalidOptions.push(item)
                  }
                });
                if(invalidOptions.length){
                  var optionsString = "\"" + invalidOptions.join(", ") + "\"";
                  var phrase = (invalidOptions.length === 1) ? "is not a valid option" : "are not valid options";
                  var ending = ". Please change selection."
                  var message = optionsString + " " + phrase + ending;
                  view.showMessage(message, "error", true);
                }
              }
            }

            // Set the selected values in the dropdown
            this.$selectUI.dropdown('set exactly', view.selected);
            this.$selectUI.dropdown('save defaults');
            this.enable();
            this.hideLoading();

            // Make sub-menus if the option is configured in this view
            if(this.submenuStyle === "popout"){
              this.convertToPopout();
            }
            else if (this.submenuStyle === "accordion"){
              this.convertToAccordion();
            }

            // Convert interactive submenus to lists and hide empty categories
            // when the user is searching for a term
            if(
              ["popout", "accordion"].includes(view.submenuStyle) ||
              view.hideEmptyCategoriesOnSearch
            ){
              this.$selectUI.find("input").on("keyup blur", function(e){

                inputVal = e.target.value;

                // When the input is NOT empty
                if(inputVal !== ""){
                  // For interactive type submenus where items are sometimes
                  // hidden, show all the matching items when a user is searching
                  if(["popout", "accordion"].includes(view.submenuStyle)){
                    view.convertToList();
                  }
                  if(view.hideEmptyCategoriesOnSearch){
                    view.hideEmptyCategories();
                  }

                // When the input is EMPTY
                } else {
                  // Convert back to sub-menus if the option is configured in this view
                  if(view.submenuStyle === "popout"){
                    view.convertToPopout();
                  }
                  else if (view.submenuStyle === "accordion"){
                    view.convertToAccordion();
                  }
                  // Show all the category titles again, in cases some where hidden
                  if(view.hideEmptyCategoriesOnSearch){
                    view.showAllCategories();
                  }
                }
              });
            }

            // Trigger an event when the user focuses in searchable inputs
            var inputEl = this.$el.find("input.search")
            if(inputEl){
              inputEl.off("focus");
              inputEl.on("focus", function(event){
                view.trigger("inputFocus", event)
              })
            }

          } catch (e) {
            console.log("The searchable select post-render function failed, error message: " + e);
          }
        },

        /**
         * isValidOption - Checks if a value is one of the values given in view.options
         *
         * @param  {string} value The value to check
         * @return {boolean}      returns true if the value is one of the values given in
         * view.options
         */
        isValidOption: function(value){

          try {
            var view = this;
            var options = view.options;

            // If there are no options set on the view, assume the value is invalid
            if(!options || options.length === 0){
              return false
            }

            // If the list of options doesn't have category headings, put it in the
            // same format as options that do have headings.
            if (Array.isArray(options)) { options = { "" : options } };

            // Reduce the options object to just an Array of value and label strings
            var validValues = _(options)
              .chain()
              .values()
              .flatten()
              .map(function(item){
                var items = [];
                if(item.value !== undefined ){ items.push(item.value) }
                if(item.label !== undefined ){ items.push(item.label) }
                return items
              })
              .flatten()
              .value();

            return validValues.includes(value);
          } catch (e) {
            console.log("Failed to check if an option is valid in a Searchable Select View, error message: " + e);
          }

        },

        /**
         * addTooltip - Add a tooltip to a given element using the description in the
         * options object that's set on the view.
         *
         * @param  {HTMLElement} element The HTML element a tooltip should be added
         * @param  {string} position how to position the tooltip - top | bottom | left |
         * right
         * @return {jQuery} The element with a tooltip wrapped by jQuery
         */
        addTooltip: function(element, position = "bottom"){

          try {
            if(!element){
              return
            }

            // Find the description in the options object, using the data-value
            // attribute set in the template. The data-value attribute is either
            // the label, or the value, depending on if a value is provided.
            var valueOrLabel = $(element).data("value");
            if(typeof valueOrLabel === "undefined"){
              return
            }
            if(typeof valueOrLabel === "boolean"){
              valueOrLabel = valueOrLabel.toString()
            }
            var opt = _.chain(this.options)
                            .values()
                            .flatten()
                            .find(function(option){
                              return option.label == valueOrLabel || option.value == valueOrLabel
                            })
                            .value()

            if(!opt){
              return
            }
            if(!opt.description){
              return
            }

            $(element).tooltip({
              title: opt.description,
              placement: position,
              container: "body",
              delay: {
                show: 900,
                hide: 50
              }
            })
            .on("show.bs.popover",
              function(){
                var $el = $(this);
                // Allow time for the popup to be added to the DOM
                setTimeout(function () {
                  // Then add a special class to identify
                  // these popups if they need to be removed.
                  $el.data('tooltip').$tip.addClass("search-select-tooltip")
                }, 10);
            });

            return $(element)
          } catch (e) {
            console.log("Failed to add tooltip in a searchable select view, error message: " + e);
          }

        },

        /**
         * convertToPopout - Re-arrange the HTML to display category contents
         * as sub-menus that popout to the left or right of category titles
         */
        convertToPopout: function(){
          try {
            if(!this.$selectUI){
              return
            }
            if(this.currentSubmenuMode === "popout"){
              return
            }
            this.currentSubmenuMode = "popout";
            this.$selectUI.addClass("popout-mode");
            var $headers = this.$selectUI.find(".header");
            if(!$headers || $headers.length === 0){
              return
            }
            $headers.each(function(i){
              var $itemGroup = $().add($(this).nextUntil(".header"));
              var $itemAndHeaderGroup = $(this).add($(this).nextUntil(".header"));
              var $icon = $(this).next().find(".icon");
              if($icon && $icon.length > 0){
                var $headerIcon = $icon
                  .clone()
                  .addClass("popout-mode-icon")
                  .css({
                    "opacity": "0.9",
                    "margin-right" : "1rem"
                  });
                $(this).prepend($headerIcon[0])
              }
              $itemAndHeaderGroup.wrapAll("<div class='item popout-mode'/>");
              $itemGroup.wrapAll("<div class='menu popout-mode'/>");
              $(this).append("<i class='popout-mode-icon dropdown icon icon-on-right icon-chevron-right'></i>")
            });
          } catch (e) {
            console.log("Failed to convert a Searchable Select interface to sub-menu mode, error message: " + e);
          }
        },

        /**
         * convertToList - Re-arrange HTML to display the full list of options
         * in one static menu
         */
        convertToList: function(){
          try {
            if(!this.$selectUI){
              return
            }
            if(this.currentSubmenuMode === "list"){
              return
            }
            this.currentSubmenuMode = "list";
            this.$selectUI.find(".popout-mode > *").unwrap();
            this.$selectUI.find(".accordion-mode > *").unwrap();
            this.$selectUI.find(".popout-mode-icon").remove();
            this.$selectUI.find(".accordion-mode-icon").remove();
            this.$selectUI.removeClass("popout-mode accordion-mode");
          } catch (e) {
            console.log("Failed to convert a Searchable Select interface to list mode, error message: " + e);
          }
        },


        /**
         * convertToAccordion - Re-arrange the HTML to display category items
         * with expandable sections, similar to an accordion element.
         */
        convertToAccordion: function(){

          try {

            if(!this.$selectUI){
              return
            }
            if(this.currentSubmenuMode === "accordion"){
              return
            }
            this.currentSubmenuMode = "accordion";
            this.$selectUI.addClass("accordion-mode");
            var $headers = this.$selectUI.find(".header");
            if(!$headers || $headers.length === 0){
              return
            }

            // Id to match the header to the
            $headers.each(function(i){

              // Create an ID
              var randomNum = Math.floor((Math.random() * 100000) + 1),
                  headerText = $(this).text().replace(/\W/g, ''),
                  id = headerText + randomNum;

              var $itemGroup = $().add($(this).nextUntil(".header"));
              var $icon = $(this).next().find(".icon");
              if($icon && $icon.length > 0){
                var $headerIcon = $icon
                  .clone()
                  .addClass("accordion-mode-icon")
                  .css({
                    "opacity": "0.9",
                    "margin-right" : "1rem"
                  });
                $(this).prepend($headerIcon[0])
                $(this).wrap("<a data-toggle='collapse' data-target='#" +
                                id +
                                "' class='accordion-mode collapsed'/>" )
              }
              $itemGroup.wrapAll("<div id='" + id + "' class='accordion-mode collapse'/>");
              $(this).append("<i class='accordion-mode-icon dropdown icon icon-on-right icon-chevron-down'></i>");

            });
          } catch (e) {
            console.log("Failed to convert a Searchable Select interface to accordion mode, error message: " + e);
          }
        },

        /**
         * hideEmptyCategories - In the searchable select interface, hide
         * category headers that are empty, if any
         */
        hideEmptyCategories: function(){
          try {
            var $headers = this.$selectUI.find(".header")
            if(!$headers || $headers.length === 0){
              return
            }
            $headers.each(function(i){
              // this is the header
              var $itemGroup = $().add($(this).nextUntil(".header"));
              var $itemGroupFiltered = $().add($(this).nextUntil(".header", ".filtered"));
              // If all items are filtered
              if($itemGroup.length === $itemGroupFiltered.length){
                // Then also hide the header
                $(this).hide()
              } else {
                $(this).show()
              }
            });
          } catch (e) {
            console.log("Failed to hide empty categories in a dropdown, error message: " + e);
          }
        },

        /**
         * showAllCategories - In the searchable select interface, show all
         * category headers that were previously empty
         */
        showAllCategories: function(){
          try {
            this.$selectUI.find(".header:hidden").show();
          } catch (e) {
            console.log("Failed to show all categories in a dropdown, error message: " + e);
          }
        },

        /**
         * changeSelection - Set selected values in the interface
         *
         * @param  {string[]} newValues - An array of strings to select
         */
        changeSelection: function(newValues, silent = false) {
          try {
            if(
              !this.$selectUI ||
              typeof newValues === "undefined" ||
              !Array.isArray(newValues)
            ){
              return
            }
            var view = this;
            this.selected = newValues;
            if(silent === true){
              view.disable();
            }
            this.$selectUI.dropdown('set exactly', newValues);
            if(silent === true){
              view.enable();
            }
          } catch (e) {
            console.log("Failed to change the selected values in a searchable select field, error message: " + e);
          }
        },

        /**
         * enable - Remove the class the makes the select UI appear disabled
         */
        enable: function(){
          try {
            this.$el.find('.ui.dropdown').removeClass("disabled");
          } catch (e) {
            console.log("Failed to enable the searchable select field, error message: " + e);
          }
        },

        /**
         * disable - Add the class the makes the select UI appear disabled
         */
        disable: function(){
          try {
            this.$el.find('.ui.dropdown').addClass("disabled");
          } catch (e) {
            console.log("Failed to enable the searchable select field, error message: " + e);
          }
        },

        /**
         * showMessage - Show an error, warning, or informational message, and highlight
         * the select interface in an appropriate colour.
         *
         * @param  {string} message The message to display. Use an empty string to only
         * highlight the select interface without showing any message text.
         * @param  {string} type one of "error", "warning", or "info"
         * @param  {boolean} removeOnChange set to true to remove the message as soon as
         * the user changes the selection
         *
         */
        showMessage: function(message, type = "info", removeOnChange = true){
          try {

            if(!this.$selectUI){
              console.warn("A select UI element wasn't found, can't display error.");
              return
            }

            var messageTypes = {
              error: {
                messageClass: "text-error",
                selectUIClass: "error"
              },
              warning: {
                messageClass: "text-warning",
                selectUIClass: "warning"
              },
              info: {
                messageClass: "text-info",
                selectUIClass: ""
              }
            };

            if(!messageTypes.hasOwnProperty(type)){
              console.log(type + "is not a message type for Select UI interfaces. Showing message as info type");
              type = "info"
            }

            this.removeMessages();
            this.$selectUI.addClass(messageTypes[type].selectUIClass);

            if(message && message.length && typeof message === "string"){
              this.message = $(
                "<p style='margin:0.2rem' class='" +
                messageTypes[type].messageClass +
                "'><small>" + message +
                "</small></p>"
              );
            }

            this.$el.append(this.message);

            if(removeOnChange){
              this.listenToOnce(this, "changeSelection", this.removeMessages);
            }

          } catch (e) {
            console.log("Failed to show an error state in a Searchable Select View, error message: " + e);
          }
        },


        /**
         * removeMessages - Remove all messages and classes set by the
         * showMessage function.
         */
        removeMessages: function(){
          try {
            if(!this.$selectUI){
              console.warn("A select UI element wasn't found, can't remove error.");
              return
            }

            this.$selectUI.removeClass("error warning");
            if(this.message){
              this.message.remove();
            }
          } catch (e) {
            console.log("Failed to hide an error state in a Searchable Select View, error message: " + e);
          }
        },

        /**
         * showLoading - Indicate that dropdown options are loading by showing
         * a spinner in the select interface
         */
        showLoading: function(){
          try {
            this.$el.find('.ui.dropdown').addClass("loading");
          } catch (e) {
            console.log("Failed to show a loading state in a Searchable Select View, error message: " + e);
          }
        },

        /**
         * hideLoading - Remove the loading spinner set by the showLoading
         */
        hideLoading: function(){
          try {
            this.$el.find('.ui.dropdown').removeClass("loading");
          } catch (e) {
            console.log("Failed to remove a loading state in a Searchable Select View, error message: " + e);
          }
        },

      });
  });
