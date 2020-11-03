define([
    "jquery",
    "underscore",
    "backbone",
    "views/selectUI/SearchableSelectView",
    "collections/queryFields/QueryFields"
  ],
  function($, _, Backbone, SearchableSelect, QueryFields) {

    /**
     * @class QueryFieldSelect
     * @classdesc A select interface that allows the user to search for and
     * select metadata field(s).
     * @extends SearchableSelect
     * @constructor
     */
    var QueryFieldSelect = SearchableSelect.extend(
      /** @lends QueryFieldSelectView.prototype */
      {
        /**
         * The type of View this is
         * @type {string}
         */
        type: "QueryFieldSelect",
        
        /**        
         * className - Returns the class names for this view element
         *          
         * @return {string}  class names
         */         
        className: SearchableSelect.prototype.className + " query-field-select",
        
        /**       
         * Text to show in the input field before any value has been entered
         * @type {string}        
         */ 
        placeholderText: "Search for or select a field",
        
        /**       
         * Label for the input element
         * @type {string}        
         */ 
        inputLabel: "Select one or more metadata fields to query",
        
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
         * Set to true to display list options as sub-menus of cateogories,
         * rather than one long list.
         * @type {boolean}        
         */         
        collapseCategories: true,
        
        /**        
         * A list of query fields names to exclude from the list of options
         * @type {string[]}
         */         
        excludeFields: [],
        
        /**        
         * A list of query fields names to display at the top of the menu, above
         * all other category headers
         */         
        commonFields: ["text"],
        
        /**        
         * Whether or not to exclude fields which are not searchable. Set to
         * false to keep query fields that are not seachable in the returned list      
         * @type {boolean}
         */         
        excludeNonSearchable: true,
        
        /**
         * Creates a new QueryFieldSelectView
         * @param {Object} options - A literal object with options to pass to the view
         */ 
        initialize: function(options){
          try {
            // Ensure the query fields are cached
            if ( typeof MetacatUI.queryFields === "undefined" ) {
              MetacatUI.queryFields = new QueryFields();
              MetacatUI.queryFields.fetch();
            }
            SearchableSelect.prototype.initialize.call(this, options);
          } catch (e) {
            console.log("Failed to initialize a Query Field Select View, error message: " + e);
          }
        },
        
        /**        
         * Render the view
         *          
         * @return {SeachableSelect}  Returns the view
         */         
        render: function(){
          
          try {
            
            var view = this;
            
            // Ensure the query fields are cached for the Query Field Select
            // View and the Query Rule View
            if ( typeof MetacatUI.queryFields === "undefined" || MetacatUI.queryFields.length === 0 ) {
              MetacatUI.queryFields = new QueryFields();
              this.listenToOnce(MetacatUI.queryFields, "sync", this.render)
              MetacatUI.queryFields.fetch();
              return
            }
            
            // Convert the queryFields collection to an object formatted for the
            // SearchableSelect view.
            var fieldsJSON = MetacatUI.queryFields.toJSON();
            
            // Move common fields to the top of the menu, outside of any
            // category headers, so that they are easy to find
            if(this.commonFields.length){
              this.commonFields.forEach(function(commonFieldName){
                var i = _.findIndex(fieldsJSON, { name: commonFieldName});
                if(i>0){
                  // If the category name is an empty string, no header will
                  // be created in the menu
                  fieldsJSON[i].category = ""
                  // The min categoryOrder in the QueryFields collection is 1
                  fieldsJSON[i].categoryOrder = 0
                  fieldsJSON[i].icon = "star"
                }
              });
            }
            
            // Filter out non-searchable fields (if option is true),
            // and fields that should be excluded
            var processedFields = _(fieldsJSON)
              .chain()
              .sortBy("categoryOrder")
              .filter(
                function(filter){
                  if(this.excludeNonSearchable){
                    if(filter.searchable !== "true"){
                      return false
                    }
                  }
                  if(this.excludeFields && this.excludeFields.length){
                    if(this.excludeFields.includes(filter.name)){
                      return false
                    }
                  }
                  return true
                }, this
              )
              .map(view.fieldToOption)
              .groupBy("categoryOrder")
              .value();
            
            // Rename the grouped categories
            for (const [key, value] of Object.entries(processedFields)) {
              processedFields[value[0].category] = value;
              delete processedFields[key];
            }
              
            // Set the formatted fields on the view
            this.options = processedFields;
            
            SearchableSelect.prototype.render.call(this);
            
          } catch (e) {
            console.log("Failed to render a Query Field Select View, error message: " + e);
          }
        },
        
        
        /**        
         * fieldToOption - Converts an object that represents a QueryField model
         * in the format specified by the SearchableSelectView.options
         *          
         * @param  {object} field An object with properties corresponding to a QueryField model
         * @return {object}       An object in the format specified by SearchableSelectView.options
         */         
        fieldToOption: function(field) {
           return {
            label: field.label ? field.label : field.name,
            value: field.name,
            description: field.friendlyDescription ? field.friendlyDescription : field.description,
            icon: field.icon,
            category: field.category,
            categoryOrder: field.categoryOrder,
            type: field.type
          };
        },
        
        /**        
         * addTooltip - Add a tooltip to a given element using the description
         * in the options object that's set on the view.
         * This overwrites the prototype addTooltip function so that we can use
         * popovers with more details for query select fields.
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
          
          var contentEl = $(document.createElement("div")),
              titleEl = $("<div>" + opt.label + "</div>"),
              valueEl = $("<code class='pull-right'>" + opt.value + "</code>"),
              typeEl = $("<span class='muted pull-right'><b>Type: " + opt.type + "</b></span>"),
              descriptionEl = $("<p>" + opt.description + "</p>");
              
            titleEl.append(valueEl);
            contentEl.append(descriptionEl, typeEl)
          
          $(element).popover({
            title: titleEl,
            content: contentEl,
            html: true,
            trigger: "hover",
            placement: position,
            container: "body",
            delay: {
              show: 1100,
              hide: 50
            }
          })
          .on("show.bs.popover",
            function(){
              var $el = $(this);
              // Allow time for the popup to be added to the DOM
              setTimeout(function () {
                // Then add some css rules, and a special class to identify
                // these popups if they need to be removed.
                $el.data('popover').$tip
                  .css({
                    "maxWidth": "400px",
                    "pointerEvents" : "none"
                  })
                  .addClass("search-select-tooltip");
              }, 10);
          });
          
          return $(element)
        
        },
        
        /**        
         * isValidOption - Checks if a value is one of the values given in view.options
         *          
         * @param  {string} value The value to check
         * @return {boolean}      returns true if the value is one of the values given in view.options
         */         
        isValidOption: function(value){
          
          try {
            var view = this;
            
            // First check if the value is one of the fields that's excluded.
            if(view.excludeFields.includes(value)){
              // If it is, then add it to the list of options
              var newField = MetacatUI.queryFields.findWhere({
                name: value
              });
              if(newField){
                newField = view.fieldToOption(newField.toJSON());
              }
              view.options[newField.category].push(newField);
              view.updateMenu();
              // Make sure the new menu is attached before updating the selections
              setTimeout(function () {
                view.changeSelection(view.selected, silent = true);
              }, 25);
              return true
            } else {
              var isValid = SearchableSelect.prototype.isValidOption.call(view, value);
              return isValid
            }
          } catch (e) {
            console.log("Failed to check if option is valid in a Query Field Select View, error message: " + e);
          }
          
        },

      });
      return QueryFieldSelect;
  });
