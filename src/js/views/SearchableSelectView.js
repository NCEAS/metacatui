define([
    "jquery",
    "underscore",
    "backbone",
    "semanticUItransition",
    "semanticUIdropdown",
    "text!templates/searchableSelect.html",
  ],
  function($, _, Backbone, Transition, Dropdown, Template) {

    /**
     * @class SearchableSelect
     * @classdesc A select interface that allows the user to search from within
     * the options, and optionally select multiple items. Also allows the items
     * to be grouped, and to display an icon or image for each item.
     * @extends Backbone.View
     * @constructor
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
         * Set to true to display list options as sub-menus of cateogories.
         * @type {boolean}        
         */         
        collapseCategories: false,
        
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
         * The path to the semanticUI transition CSS (required for this view to work)
         * @type {string}        
         */         
        transitionCSS: "/components/semanticUI/transition.min.css",
        
        /**        
         * The path to the semanticUI dropdown CSS (required for this view to work)
         * @type {string}        
         */ 
        dropdownCSS: "/components/semanticUI/dropdown.min.css",
        
        /**        
         * The list of options that a user can select from in the dropdown menu.
         * For uncategorized options, provide an array of objects, where each
         * object is a single option. To create category headings, provide an
         * object containing named objects, where the key for each object is
         * the category title to display, and the value of each object comprises
         * the option properties.
         * @type {Object[]|Object}       
         * @property {string} icon - The name of a Font Awesome 3.2.1 icon to display to the left of the label (e.g. "lemon", "heart")
         * @property {string} image - The complete path to an image to use instead of an icon. If both icon and image are provided, the icon will be used.
         * @property {string} label - The label to show for the option
         * @property {string} description - A description of the option, displayed as a tooltip when the user hovers over the label
         * @property {string} value - If the value differs from the label, the value to return when this option is selected (otherwise label is returned)
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
            
            var view = this;
            
            // Given a path, check whether a CSS file was already added to the
            // head, and add it if not. Prevents adding the CSS file multiple
            // times if the view is loaded more than once. The first time each
            // CSS path is added, we need to cache a record of the event. It
            // doesn't work to just search the document head for the file to
            // determine if the CSS has already been added, because each instance
            // of this view is initialized too quickly, before the previous
            // instance has had a chance to add the stylesheet element.
            const addCSS = function(path){
              if(!MetacatUI.loadedCSS){
                MetacatUI.loadedCSS = []
              }
              if(!MetacatUI.loadedCSS.includes(path)){
                MetacatUI.loadedCSS.push(path)
                const link = document.createElement("link");
                link.rel = "stylesheet";
                link.href = path;
                document.querySelector("head").appendChild(link);
              }
            }
            
            // Add the CSS required for semanticUI components
            addCSS(view.transitionCSS);
            addCSS(view.dropdownCSS);
            
            // Get all the options and apply them to this view
            if (typeof options == "object") {
              var optionKeys = Object.keys(options);
              _.each(optionKeys, function(key, i) {
                this[key] = options[key];
              }, this);
            }
            
          } catch (e) {
            console.log("Failed to initialize a Searchable Select view, error message:", e);
          }
        },
        
        /**        
         * Render the view
         *          
         * @return {SeachableSelect}  Returns the view
         */
        render: function() {
          
          try {
            
            var view = this;
            
            // The semantic UI dropdown module requires that the transition
            // module CSS is loaded. If a user tries to select a value before
            // this has a chance to load, semantic will throw an error.
            // Don't render until the required CSS is loaded.
            if(!this.ready){
              this.checkIfReady(this.render);
              return
            }
            
            // Render the template using the view attributes
            this.$el.html(this.template(this));
            
            // Start the dropdown in a disabled state.
            // This allows us to pre-select values without triggering a change
            // event.
            this.disable();
            
            // Initialize the dropdown interface
            // For explanations of settings, see:
            // https://semantic-ui.com/modules/dropdown.html#/settings
            this.$selectUI = this.$el.find('.ui.dropdown')
              .dropdown({
                fullTextSearch: true,
                duration: 90,
                clearable: true,
                allowAdditions: view.allowAdditions,
                hideAdditions: false,
                allowReselection: true,
                onLabelCreate: function(value, text){
                  // Add tooltips to the selected label elements
                  view.addTooltip.call(view, this, "top");
                  return this
                },
                onLabelRemove: function(){
                  // Ensure tooltips for labels are removed
                  $(".search-select-tooltip").remove();
                },
                onChange: function(value, text, $choice){
                  // Add tooltips to the selected fields that are not labels
                  // (i.e. that are not in multi-select UIs).
                  var textEl = view.$selectUI.find(".text")
                  if(textEl){
                    if(text == textEl.html()){
                      view.addTooltip.call(view, textEl, "top");
                    }
                  }
                  
                  // Trigger an event if items are selected after the UI
                  // has been rendered (It is set as disabled until fully rendered)
                  if(!$(this).hasClass("disabled")){
                    var newValues = value.split(",");
                    view.trigger('changeSelection', newValues);
                    view.selected = newValues;
                  }
                },
              });
            
            view.postRender();
            
            return this;

          } catch (e) {
            console.log("Error rendering the search select, error message: ", e);
          }
        },
        
        
        /**        
         * updateMenu - Re-render the menu of options
         */         
        updateMenu: function(){
          var menu = $(this.template(this)).find(".menu")[0].innerHTML;
          this.$el.find(".menu").html(menu);
        },
        
        /**        
         * postRender - Updates to the view once the dropdown UI has loaded
         */         
        postRender: function(){
          try {
            
            var view = this;
            view.trigger("postRender")
            
            // Add tool tips for the description
            this.$el.find(".item").each(function(){
              view.addTooltip(this)
            });
            
            this.$selectUI.dropdown('set exactly', view.selected);
            this.$selectUI.dropdown('save defaults');
            this.enable();
            
            if(this.collapseCategories){
              this.convertToSubmenus();
            }
            
            if(view.collapseCategories || view.hideEmptyCategoriesOnSearch){
              this.$selectUI.find("input").on("keyup blur", function(e){
                inputVal = e.target.value;
                if(inputVal !== ""){
                  if(view.collapseCategories){
                    view.revertToList();
                  }
                  if(view.hideEmptyCategoriesOnSearch){
                    view.hideEmptyCategories();
                  }
                } else {
                  if(view.collapseCategories){
                    view.convertToSubmenus();
                  }
                  if(view.hideEmptyCategoriesOnSearch){
                    view.showAllCategories();
                  }
                }
              });
            }
            
          } catch (e) {
            console.log("The searchable select post-render function failed, error message: " + e);
          }
        },
        
        /**        
         * addTooltip - Add a tooltip to a given element using the description
         * in the options object that's set on the view.
         *          
         * @param  {HTMLElement} element The HTML element a tooltip should be added
         * @param  {string} position how to position the tooltip - top | bottom | left | right
         * @return {jQuery} The element with a tooltip wrapped by jQuery
         */         
        addTooltip: function(element, position = "bottom"){
          
          if(!element){
            return
          }
          
          // Find the description in the options object, using the data-value
          // attribute set in the template. The data-value attribute is either
          // the label, or the value, depending on if a value is provided.
          var valueOrLabel = $(element).data("value"),
              opt = _.chain(this.options)
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
              show: 550,
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
        
        },
        
        /**        
         * convertToSubmenus - Re-arrange the HTML to display category contents
         * as sub-menus
         */         
        convertToSubmenus: function(){
          try {
            if(!this.$selectUI){
              return
            }
            if(this.mode === "submenu"){
              return
            }
            this.mode = "submenu";
            this.$selectUI.addClass("submenu-mode");
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
                  .addClass("submenu-mode-icon")
                  .css({
                    "opacity": "0.9",
                    "margin-right" : "1rem"
                  });
                $(this).prepend($headerIcon[0])
              }
              $itemAndHeaderGroup.wrapAll("<div class='item submenu-mode'/>");
              $itemGroup.wrapAll("<div class='menu submenu-mode'/>");
              $(this).append("<i class='submenu-mode-icon dropdown icon icon icon-on-right icon-chevron-right'></i>")
            });
          } catch (e) {
            console.log("Failed to convert a Searchable Select interface to sub-menu mode, error message: " + e);
          }
        },
        
        /**        
         * revertToList - Re-arrange HTML to display the full list of options
         * in one menu
         */         
        revertToList: function(){
          try {
            if(!this.$selectUI){
              return
            }
            if(this.mode === "list"){
              return
            }
            this.mode = "list";
            this.$selectUI.removeClass("submenu-mode");
            this.$selectUI.find(".submenu-mode > *").unwrap();
            this.$selectUI.find(".submenu-mode-icon").remove();
          } catch (e) {
            console.log("Failed to revert a Searchable Select interface to list mode, error message: " + e);
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
        changeSelection: function(newValues) {
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
            this.$selectUI.dropdown('set exactly', newValues);
          } catch (e) {
            console.log("Failed to change the selected values in a searchable select field, error message: " + e);
          }
        },

        /**        
         * checkIfReady - Check if the searchable select field is ready to use.
         * If the transition UI CSS file isn't loaded in time, search fields
         * might give error when selecting (or pre-selecting) values.
         *          
         * @param  {function} callback The function to call when the UI is ready
         */         
        checkIfReady: function(callback){
          
          var view = this;
          
          // prevent flash of unstyled content
          view.$el.css("display", "none");
          
          // Find the transition CSS in the head of the document.
          var transitionCSS = _.find(
            Array.from(document.styleSheets),
            function(ss){
              if(ss.href){
                return ss.href.includes(view.transitionCSS)
              }
            }
          );
          
          // What to do when the CSS isn't loaded yet
          const notReady = function(){
            view.ready = false;
            // check again in 15ms
            setTimeout(function () {
              view.checkIfReady(callback)
            }, 15);
          }
          
          const ready = function(){
            view.ready = true;
            callback.call(view);
            // prevent flash of unstyled content
            setTimeout(function () {
              view.$el.css("display", "block");
            }, 10);
          }
          
          if(view.ready){
            ready();
          }
          
          try {
            if ( transitionCSS.cssRules.length === 0 ) {
              notReady();
            } else {
              ready();
            }
          } catch (e) {
            notReady();
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
        
      });
  });
