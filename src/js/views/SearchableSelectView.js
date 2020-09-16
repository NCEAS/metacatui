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

        // /**
        //  * The events this view will listen to and the associated function to call.
        //  * @type {Object}
        //  */
        // events: {
        //   // "action selector": "functionName"
        // },

        /**
         * Creates a new SearchableSelectView
         * @param {Object} options - A literal object with options to pass to the view
         */
        initialize: function(options) {
          
          try {
            
            var view = this;
            
            // Given a path, check whether a CSS file was already added to the
            // head, and add it if not. Prevents adding the CSS file multiple
            // times if the view is loaded more than once.
            const addCSS = function(path){
              if($("style:contains(" + path + ")").length <= 0 ){
                $('<style>@import "' + path + '"</style>').appendTo('head');
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
                onChange: function(value, text, $choice){
                  if(!$(this).hasClass("disabled")){
                    var newValues = value.split(",");
                    view.trigger('changeSelection', newValues);
                  }
                }
              });
              
              // There must be a delay before setting the pre-selected values to
              // avoid a semantic UI bug with transitions. The delay also
              // creates a nice animation.
              setTimeout(function () {
                view.$selectUI.dropdown('set exactly', view.selected);
                view.$selectUI.dropdown('save defaults');
                view.enable();
              }, 100);
              
            // Activate the tooltips (option descriptions, inserted in the template)
            this.$el.tooltip({
              selector: '[data-toggle=tooltip]'
            });
            
            return this;

          } catch (e) {
            console.log("Error rendering the search select, error message: ", e);
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
          try {
            var view = this;
            
            // Search for the semanticUI transition CSS
            var transitionCSS = _.filter(document.styleSheets, function(ss){
              try {
                return ss.cssRules[0].cssText.indexOf(view.transitionCSS) != -1
              } catch {}
            });
            // If the semanticUI transition CSS was not found...
            if(transitionCSS.length < 1){
              // ... check again in 20ms
              setTimeout(function () {
                view.checkIfReady(callback)
              }, 50);
              return
            // If the CSS was found, call the callback function and mark the
            // view as ready
            } else {
              view.ready = true;
              setTimeout(function () {
                callback.call(view);
              }, 20);
            }
          } catch (e) {
            console.log("Failed to check whether the searchable select field is ready, error message: " + e);
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
