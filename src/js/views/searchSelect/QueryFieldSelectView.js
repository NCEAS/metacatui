define([
    "jquery",
    "underscore",
    "backbone",
    "views/searchSelect/SearchableSelectView",
    "collections/queryFields/QueryFields"
  ],
  function($, _, Backbone, SearchableSelect, QueryFields) {

    /**
     * @class QueryFieldSelectView
     * @classdesc A select interface that allows the user to search for and
     * select metadata field(s).
     * @classcategory Views/SearchSelect
     * @extends SearchableSelect
     * @constructor
     * @since 2.14.0
     * @screenshot views/searchSelect/QueryFieldSelectView.png
     */
    var QueryFieldSelectView = SearchableSelect.extend(
      /** @lends QueryFieldSelectView.prototype */
      {
        /**
         * The type of View this is
         * @type {string}
         */
        type: "QueryFieldSelect",

        /**
         * className - the class names for this view element
         *
         * @type {string}
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
         * @see SearchableSelectView#submenuStyle
         * @default "accordion"
         */
        submenuStyle: "accordion",

        /**
         * A list of query fields names to exclude from the list of options
         * @type {string[]}
         */
        excludeFields: [],

        /**
         * An additional field object contains the properties an additional query field to
         * add that are required to render it correctly. An additional query field is one
         * that does not actually exist in the query service index.
         *
         * @typedef {Object} AdditionalField
         *
         * @property {string} name - A unique ID to represent this field. It must not
         * match the name of any other query fields.
         * @property {string[]} fields - The list of real query fields that this
         * abstracted field will represent. It must exactly match the names of the query
         * fields that actually exist.
         * @property {string} label - A user-facing label to display.
         * @property {string} description - A description for this field.
         * @property {string} category - The name of the category under which to place
         * this field. It must match one of the category names for an existing query
         * field.
         *
         * @since 2.15.0
         */

        /**
         * A list of additional fields which are not retrieved from the query service
         * index, but which should be added to the list of options. This can be used to
         * add abstracted fields which are a combination of multiple query fields, or to
         * add a duplicate field that has a different label.
         *
         * @type {AdditionalField[]}
         * @since 2.15.0
         */
        addFields: [],

        /**
         * A list of query fields names to display at the top of the menu, above
         * all other category headers
         * @type {string[]}
         */
        commonFields: ["text", "documents-special-field"],

        /**
         * The names of categories that should have items sorted alphabetically. Names
         * must exactly match those in the
         * {@link QueryField#categoriesMap Query Field model}
         * @type {string[]}
         * @since 2.15.0
         */
        categoriesToAlphabetize: ["General"],

        /**
         * Whether or not to exclude fields which are not searchable. Set to
         * false to keep query fields that are not searchable in the returned list
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
         * postRender - Updates the view once the dropdown UI has loaded. Processes the
         * QueryFields given the options passed to this view, then updates the menu and
         * selection. Processing the fields takes some time, which is why we allow the
         * view to render before starting that process. This prevents slowing down the
         * rendering of parent views.
         */
        postRender : function(){

          try {
            var view = this;
            _.defer(function(){
              view.processFields();
              view.updateMenu();
              // With the new menu in place, show the pre-selected values. Silent is set
              // to true so that it doesn't trigger an update of the model. Defer to make
              // sure the menu elements are attached.
              _.defer(function() {
                view.changeSelection(view.selected, true);
              });
              SearchableSelect.prototype.postRender.call(view);
            })
          }
          catch (error) {
            console.log( 'Post-render failed in a QueryFieldSelectView.' +
              ' Error details: ' + error );
          }
        },

        /**
         * Retrieves the queryFields collection if not already fetched, then organizes the
         * fields based on the options passed to this view.
         * @since 2.x
         */
        processFields : function(){
          try {
            var view = this;

            // Ensure the query fields are cached for the Query Field Select
            // View and the Query Rule View
            if (
              typeof MetacatUI.queryFields === "undefined" ||
              MetacatUI.queryFields.length === 0
            ) {
              if (typeof MetacatUI.queryFields === "undefined") {
                MetacatUI.queryFields = new QueryFields();
              }
              this.listenToOnce(MetacatUI.queryFields, "sync", this.processFields)
              MetacatUI.queryFields.fetch();
              return
            }

            // Convert the queryFields collection to an object formatted for the
            // SearchableSelect view.
            var fieldsJSON = MetacatUI.queryFields.toJSON();

            // Process & add additional fields set on this view (these are fields not
            // retrieved from the query service API)
            if (this.addFields && Array.isArray(this.addFields)) {
              // For each added field, find the icon and category order from the already
              // existing fields with the same category.
              this.addFields = _.map(this.addFields, function (field) {
                if (field.category) {
                  var categoryInfo = _.findWhere(fieldsJSON, { category: field.category });
                  ["icon", "categoryOrder"].forEach(function (prop) {
                    if (!field[prop]) {
                      field[prop] = categoryInfo[prop]
                    }
                  })
                }
                return field
              }, this);
              // Add the additional fields to the array of fields fetched from the
              // query service API
              fieldsJSON = fieldsJSON.concat(this.addFields);
            }

            // Move common fields to the top of the menu, outside of any
            // category headers, so that they are easy to find
            if (this.commonFields && Array.isArray(this.commonFields)) {
              this.commonFields.forEach(function (commonFieldName) {
                var i = _.findIndex(fieldsJSON, { name: commonFieldName });
                if (i > 0) {
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
                function (filter) {
                  if (this.excludeNonSearchable) {
                    if (["false", false].includes(filter.searchable)) {
                      return false
                    }
                  }
                  if (this.excludeFields && this.excludeFields.length) {
                    if (this.excludeFields.includes(filter.name)) {
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

            // Sort items alphabetically for the specified categories
            if (this.categoriesToAlphabetize && this.categoriesToAlphabetize.length) {
              this.categoriesToAlphabetize.forEach(function (categoryName) {
                // Sort by category label
                processedFields[categoryName].sort(function (a, b) {
                  // Ignore upper and lowercase
                  var nameA = a.label.toUpperCase();
                  var nameB = b.label.toUpperCase();
                  if (nameA < nameB)
                    return -1;
                  if (nameA > nameB)
                    return 1;
                  return 0;
                });
              })
            }

            // Set the formatted fields on the view
            this.options = processedFields;
          }
          catch (error) {
            console.log( 'There was an error organizing the Fields in a QueryFieldSelectView' +
              ' Error details: ' + error );
          }
        },

        /**
         * fieldToOption - Converts an object that represents a QueryField model in the
         * format specified by the SearchableSelectView.options
         *
         * @param  {object} field An object with properties corresponding to a QueryField
         * model
         * @return {object}       An object in the format specified by
         * SearchableSelectView.options
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
         * addTooltip - Add a tooltip to a given element using the description in the
         * options object that's set on the view. This overwrites the prototype addTooltip
         * function so that we can use popovers with more details for query select fields.
         *
         * @param  {HTMLElement} element The HTML element a tooltip should be added
         * @param  {string} position how to position the tooltip - top | bottom | left |
         * right
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
                          .value();

          var label = opt.label,
              value = opt.value,
              type = opt.type,
              description = (opt.description ? opt.description : "");

          // For added fields, the value set on the options.value element is just a
          // unique identifier. The values that should be used to build a query are saved
          // in the addFields array set on this view.
          if(this.addFields && Array.isArray(this.addFields)){
            var specialField = _.findWhere(this.addFields, { name: valueOrLabel });
            if(specialField){
              value = specialField.fields;
              type = [];
              specialField.fields.forEach(function(fieldName){
                var realField = MetacatUI.queryFields.findWhere({
                  name: fieldName
                });
                if(realField){
                  type.push(realField.get("type"))
                } else {
                  type.push("special field")
                }
              }, this);
              type = type.join(", ");
            }
          }

          var contentEl = $(document.createElement("div")),
              titleEl = $("<div>" + label + "</div>"),
              valueEl = $("<code class='pull-right'>" + value + "</code>"),
              typeEl = $("<span class='muted pull-right'><b>Type: " + type + "</b></span>"),
              descriptionEl = $("<p>" + description + "</p>");

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
                // If the selected value has been removed, re-add it.
                if(!view.selected.includes(value)){
                  view.selected.push(value)
                }
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
      return QueryFieldSelectView;
  });
