define([
  "jquery",
  "underscore",
  "backbone",
  "views/searchSelect/SearchableSelectView",
  "views/searchSelect/QueryFieldSelectView",
  "views/searchSelect/NodeSelectView",
  "views/searchSelect/AccountSelectView",
  "views/filters/NumericFilterView",
  "views/filters/DateFilterView",
  "views/searchSelect/ObjectFormatSelectView",
  "views/searchSelect/AnnotationFilterView",
  "models/filters/Filter",
  "models/filters/BooleanFilter",
  "models/filters/NumericFilter",
  "models/filters/DateFilter"
],
  function (
    $, _, Backbone, SearchableSelect, QueryFieldSelect, NodeSelect, AccountSelect,
    NumericFilterView, DateFilterView, ObjectFormatSelect, AnnotationFilter, Filter, BooleanFilter,
    NumericFilter, DateFilter
  ) {

    /**
     * @class QueryRuleView
     * @classdesc A view that provides an UI for a user to construct a single filter that
     * is part of a complex query
     * @classcategory Views/QueryBuilder
     * @screenshot views/QueryRuleView.png
     * @extends Backbone.View
     * @constructor
     * @since 2.14.0
     */
    return Backbone.View.extend(
      /** @lends QueryRuleView.prototype */
      {
        /**
         * The type of View this is
         * @type {string}
         */
        type: "QueryRule",

        /**
         * The HTML class names for this view element
         * @type {string}
         */
        className: "query-rule",

        /**
         * The class to add to the rule number and other information on the left
         * @type {string}
         */
        ruleInfoClass: "rule-info",

        /**
         * The class to add to the field select element
         * @type {string}
         */
        fieldsClass: "field",

        /**
         * The class to add to the operator select element
         * @type {string}
         */
        operatorClass: "operator",

        /**
         * The class to add to the value select element
         * @type {string}
         */
        valuesClass: "value",

        /**
         * The class to add to the button that a user clicks to remove a rule
         * @type {string}
         */
        removeClass: "remove-rule",

        /**
         * The class to add to the view when a user hovers over the remove button
         * @type {string}
         */
        removePreviewClass: "remove-rule-preview",

        /**
         * An array of hex color codes used to help distinguish between different rules
         * @type {string[]}
         */
        ruleColorPalette: ["#44AA99", "#137733", "#c9a538", "#CC6677", "#882355",
          "#AA4499", "#332288"],

        /**
         * Search index fields to exclude in the metadata field selector
         * @type {string[]}
         */
        excludeFields: [],

        /**
         * A single Filter model that is part of a Filters collection, such as the
         * definition filters for a Collection or Portal or the filters for a Search
         * model. The Filter model must be part of a Filters collection (i.e. there must
         * be a model.collection property)
         * @type {Filter|BooleanFilter|NumericFilter|DateFilter}
         */
        model: undefined,

        /**
         * A function that creates and returns the Backbone events object.
         * @return {Object} Returns a Backbone events object
         */
        events: function () {
          var events = {};
          events["click ." + this.removeClass] = "removeSelf";
          events["mouseover ." + this.removeClass] = "previewRemove";
          events["mouseout ." + this.removeClass] = "previewRemove";
          return events
        },

        /**
         * A list of additional fields which are not retrieved from the query API, but
         * which should be added to the list of options. This can be used to add
         * abstracted fields which are a combination of multiple query fields, or to add a
         * duplicate field that has a different label. These special fields are passed on
         * to {@link QueryFieldSelectView#addFields}.
         *
         * @type {SpecialField[]}
         *
         * @since 2.15.0
         */
        specialFields: [
          {
            name: "documents-special-field",
            fields: ["documents"],
            label: "Contains Data Files",
            description: "Limit results to packages that include data files. Without" +
              " this rule, results may include packages with metadata but no data.",
            category: "General",
            values: ["*"]
          },
          {
            name: "year-data-collection",
            fields: ["beginDate", "endDate"],
            label: "Year of Data Collection",
            description: "The temporal range of content described by the metadata",
            category: "Dates"
          }
        ],

        /**
         * An operator option is an object that lists the properties of one of the
         * operators that will be displayed to the user in the Query Rule "operator"
         * dropdown list. The operator properties are used to pre-select the correct
         * operator based on attributes in the associated
         * {@link Filter#defaults Filter model}, as well as to update the Filter model
         * when a user selects a new operator. Operators can set the exclude and
         * matchSubstring properties of the model, and sometimes the values as well.
         * Either the types property OR the fields property must be set, not both.
         *
         * @typedef {Object} OperatorOption
         * @property {string} label - The label to display to the user
         * @property {string} icon - An icon that represents the operator
         * @property {boolean} matchSubstring - Whether the matchSubstring attribute is
         * true or false in the filter model that matches this operator
         * @property {boolean} exclude - Whether the exclude attribute is true or false in
         * the filter model that matches this operator
         * @property {boolean} hasMax - Whether the filter model that matches this
         * operator must have a max attribute
         * @property {boolean} hasMin - Whether the filter model that matches this
         * operator must have a min attribute
         * @property {string[]} values - For this operator to work as desired, the values
         * that should be set in the filter (e.g. ["true"] for the operator "is true")
         * @property {string[]} [types] - The node names of the filters that this operator
         * is used for (e.g. "filter", "booleanFilter")
         * @property {string[]} [fields] - The query field names of the filters that this
         * operator is used for. If this is used for a
         * {@link QueryRuleView#specialFields special field}, then list the special field
         * name (id), and not the real query field names. If this fields property is set,
         * then the types property will be ignored. (i.e. fields is more specific than
         * types.)
         */

        /**
         * The list of operators that will be available in the dropdown list that connects
         * the query fields to the values. Each operator must be unique.
         *
         * @type {OperatorOption[]}
         */
        operatorOptions: [
          {
            label: "is true",
            description: "The data package includes data files (and not only metadata)",
            icon: "ok-circle",
            matchSubstring: false,
            exclude: false,
            values: ["*"],
            fields: ["documents-special-field"]
          },
          {
            label: "is false",
            description: "The data package only contains metadata; it contains no data files.",
            icon: "ban-circle",
            matchSubstring: false,
            exclude: true,
            values: ["*"],
            fields: ["documents-special-field"]
          },
          {
            label: "equals",
            description: "The text in the metadata field is an exact match to the" +
              " selected value",
            icon: "equal",
            matchSubstring: false,
            exclude: false,
            types: ["filter"]
          },
          {
            label: "does not equal",
            description: "The text in the metadata field is anything except an exact" +
              " match to the selected value",
            icon: "not-equal",
            matchSubstring: false,
            exclude: true,
            types: ["filter"]
          },
          {
            label: "contains",
            description: "The text in the metadata field matches or contains the words" +
              " or phrase selected",
            icon: "ok-circle",
            matchSubstring: true,
            exclude: false,
            types: ["filter"]
          },
          {
            label: "does not contain",
            description: "The words or phrase selected are not contained within the" +
              " metadata field",
            icon: "ban-circle",
            matchSubstring: true,
            exclude: true,
            types: ["filter"]
          },
          {
            label: "is empty",
            description: "The metadata field contains no text or value",
            icon: "circle-blank",
            matchSubstring: false,
            exclude: true,
            values: ["*"],
            types: ["filter"]
          },
          {
            label: "is not empty",
            description: "The metadata field is filled in with any text at all",
            icon: "circle",
            matchSubstring: false,
            exclude: false,
            values: ["*"],
            types: ["filter"]
          },
          {
            label: "is true",
            description: "The metadata field is set to true",
            icon: "ok-circle",
            matchSubstring: false,
            exclude: false,
            values: [true],
            types: ["booleanFilter"]
          },
          {
            label: "is false",
            description: "The metadata field is set to false",
            icon: "ban-circle",
            matchSubstring: false,
            exclude: false,
            values: [false],
            types: ["booleanFilter"]
          },
          {
            label: "is between",
            description: "The metadata field is a value between the range selected" +
              " (inclusive of both values)",
            icon: "resize-horizontal",
            matchSubstring: false,
            exclude: false,
            hasMin: true,
            hasMax: true,
            types: ["numericFilter", "dateFilter"]
          },
          {
            label: "is less than or equal to",
            description: "The metadata field is a number less than the value selected",
            icon: "less-than-or-eq",
            matchSubstring: false,
            exclude: false,
            hasMin: false,
            hasMax: true,
            types: ["numericFilter"]
          },
          {
            label: "is greater than or equal to",
            description: "The metadata field is a number greater than the value selected",
            icon: "greater-than-or-eq",
            matchSubstring: false,
            exclude: false,
            hasMin: true,
            hasMax: false,
            types: ["numericFilter"]
          },
          {
            label: "is exactly",
            description: "The metadata field exactly equals the value selected",
            icon: "equal",
            matchSubstring: false,
            exclude: false,
            hasMin: false,
            hasMax: false,
            types: ["numericFilter"]
          },
          // TODO: The dateFilter model & view need to be updated for these to work:
          // {
          //   label: "is during or before", icon: "less-than-or-eq", matchSubstring:
          //   false, exclude: false, hasMin: false, hasMax: true, types: ["dateFilter"]
          // },
          // {
          //   label: "is during or after", icon: "greater-than", matchSubstring: false,
          //   exclude: false, hasMin: true, hasMax: false, types: ["dateFilter"]
          // },
          // {
          //   label: "is in the year", icon: "equal", matchSubstring: false, exclude:
          //   false, hasMin: false, hasMax: false, types: ["dateFilter"]
          // }
        ],


        /**
         * The third input in each query rule is where the user enters a value, minimum,
         * or maximum for the filter model. Different types of values are appropriate for
         * different solr query fields, and so we display different interfaces depending
         * on the type and category of the selected query fields. A Value Input Option
         * object defines a of interface to show for a given type and category.
         *
         * @typedef {Object} ValueInputOption
         * @property {string[]} filterTypes - An array of one or more filter types that
         * are allowed for this interface.  If none are provided then any filter type is
         * allowed.
         * @property {string[]} categories - An array of one or more categories that are
         * allowed for this interface. These strings must exactly match the categories
         * provided in QueryField.categoriesMap(). If none are provided then any category
         * is allowed.
         * @property {string[]} queryFields - Specific names of fields that are allowed in
         * this interface. If none are provided, then any query fields are allowed that
         * match the other properties. If this value select should be used for a
         * {@link QueryRuleView#specialFields special field}, then use the name (id) of
         * the special field, not the actual query fields that it represents.
         * @property {string} label - If the interface does not include a label (e.g.
         * number filter), include a string to display here.
         * @property {function} uiFunction - A function that returns the UI view to use
         * with all appropriate options set. The function will be called with this view as
         * the context.
         */

        /**
         * This list defines which type of value input to show depending on filter type,
         * category, and query fields. The value input options are ordered from *most*
         * specific to *least*, since the first match will be selected. The filter model
         * must match either the queryFields, or both the filterTypes AND the categories
         * for a UI to be selected.
         * @type {ValueInputOption[]}
         */
        valueSelectUImap: [
          // serviceCoupling field
          {
            queryFields: ["serviceCoupling"],
            uiFunction: function () {
              return new SearchableSelect({
                options: [
                  {
                    label: "tight",
                    description: "Tight coupled service work only on the data described" +
                      " by this metadata document."
                  },
                  {
                    label: "mixed",
                    description: "Loose coupling means service works on any data."
                  },
                  {
                    label: "loose",
                    description: "Mixed coupling means service works on data described" +
                      " by this metadata document but may work on other data."
                  }
                ],
                allowMulti: true,
                allowAdditions: false,
                inputLabel: "Select a coupling",
                selected: this.model.get("values")
              })
            }
          },
          // Metadata format IDs
          {
            queryFields: ["formatId"],
            uiFunction: function () {
              return new ObjectFormatSelect({
                selected: this.model.get("values")
              })
            }
          },
          // Semantic annotation picker
          {
            queryFields: ["sem_annotation"],
            uiFunction: function () {
              // A bioportalAPIKey is required for the Annotation Filter UI
              if (MetacatUI.appModel.get("bioportalAPIKey")) {
                return new AnnotationFilter({
                  selected: this.model.get("values"),
                  multiselect: true
                });
                // If there's no API key, render the default UI (the last in this list)
              } else {
                return this.valueSelectUImap.slice(-1)[0].uiFunction.call(this);
              }
            }
          },
          // User/Organization account ID lookup
          {
            queryFields: ["writePermission", "readPermission", "changePermission", "rightsHolder", "submitter"],
            uiFunction: function () {
              return new AccountSelect({
                selected: this.model.get("values")
              });
            },
          },
          // Repository picker for fields that need a member node ID
          {
            filterTypes: ["filter"],
            queryFields: ["blockedReplicationMN", "preferredReplicationMN", "replicaMN",
              "authoritativeMN", "datasource"],
            uiFunction: function () {
              return new NodeSelect({
                selected: this.model.get("values")
              })
            }
          },
          // Any numeric fields don't fit one of the above options
          {
            filterTypes: ["numericFilter"],
            label: "Choose a value",
            uiFunction: function () {
              return new NumericFilterView({
                model: this.model,
                showButton: false
              })
            }
          },
          // Any date fields that don't fit one of the above options
          {
            filterTypes: ["dateFilter"],
            label: "Choose a year",
            uiFunction: function () {
              return new DateFilterView({
                model: this.model
              })
            }
          },
          // The last is the default value selection UI
          {
            uiFunction: function () {
              return new SearchableSelect({
                options: [],
                allowMulti: true,
                allowAdditions: true,
                inputLabel: "Type a value",
                selected: this.model.get("values")
              })
            }
          }
        ],

        /**
         * Creates a new QueryRuleView
         * @param {Object} options - A literal object with options to pass to the view
         */
        initialize: function (options) {
          try {

            // Get all the options and apply them to this view
            if (typeof options == "object") {
              var optionKeys = Object.keys(options);
              _.each(optionKeys, function (key, i) {
                this[key] = options[key];
              }, this);
            }

            // If no model is provided in the options, we cannot render this view. A
            // filter model cannot be created, because it must be part of a collection.
            if (!this.model || !this.model.collection) {
              console.error("error: A Filter model that's part of a Filters collection"
                + " is required to initialize a Query Rule view.")
              return
            }

            // The model may be removed during the save process if it's empty. Remove this
            // Rule Group view when that happens.
            this.stopListening(this.model, "remove");
            this.listenTo(this.model, "remove", function () {
              this.removeSelf();
            });

          } catch (e) {
            console.log("Failed to initialize a Query Builder View, error message:", e);
          }
        },

        /**
         * render - Render the view
         *
         * @return {QueryRule}  Returns the view
         */
        render: function () {

          try {

            // TODO: How to indicate whether multiple fields/values are AND'ed or OR'ed
            // together?

            // Add the Rule number.
            // TODO: Also add the number of datasets related to rule
            this.addRuleInfo();
            this.stopListening(this.model.collection, "remove");
            this.listenTo(this.model.collection, "remove", this.updateRuleInfo);

            // Metadata Selector field Add a metadata selector field whether the rule is
            // new or has already been created
            this.addFieldSelect();

            // Operator field and value field Add an operator input only for already
            // existing filters (For new filters, a metadata field needs to be selected
            // first)
            if (
              this.model.get("fields") &&
              this.model.get("fields").length
            ) {
              this.addOperatorSelect();
              this.addValueSelect();
            }
            this.addRemoveButton();

            return this;

          } catch (e) {
            console.error("Error rendering the query Rule View, error message: ", e);
          }
        },

        /**
         * Insert container for the color-coded rule numbering.
         */
        addRuleInfo: function () {
          try {
            this.$indexEl = $(document.createElement("span"));
            this.$ruleInfoEl = $(document.createElement("div"))
              .addClass(this.ruleInfoClass);
            this.$ruleInfoEl.append(this.$indexEl);

            this.$el.append(this.$ruleInfoEl);
            this.updateRuleInfo();
          } catch (error) {
            console.log(
              "Error adding rule info container for a query rule, details: " + error
            );
          }
        },

        /**
         * Selects a color from the
         * {@link QueryRuleView#ruleColorPalette rule colour palette array}, given an
         * index. If the index is greater than the length of the palette, then the palette
         * is effectively repeated until long enough (i.e. colours will be recycled). If
         * no index in provided, the first colour in the palette will be selected.
         *
         * @param  {number} [index=0] - The position of the rule within the Filters
         * collection.
         * @param  {string} [defaultColor="#57b39c"] - A default colour to use in case
         * there is problem with this function (hex color code beginning with '#'). 
         * @return {string} - Returns a hex color code string
         */
        getPaletteColor: function (index = 0, defaultColor = "#57b39c") {
          try {
            if (!this.ruleColorPalette || !this.ruleColorPalette.length) {
              return defaultColor;
            }
            var numCols = this.ruleColorPalette.length;
            if ((index + 1) > numCols) {
              var n = Math.floor(index / numCols);
              index = index - (numCols * n);
            }
            return this.ruleColorPalette[index];
          } catch (error) {
            console.log(
              "Error getting a color for a query rule, using the default colour"
              + " instead. Error details: " + error
            );
            return defaultColor;
          }
        },

        /**
         * Adds or updates the color-coded query rule information displayed to the user.
         * This needs to be run when rules are added or removed. Rule information includes
         * the rule number, but may one day also display information such as the number of
         * results that there are for this individual rule.
         */
        updateRuleInfo: function () {
          try {
            var index = this.model.collection.visibleIndexOf(this.model);
            if (typeof index === "number") {
              this.$indexEl.text("Rule " + (index + 1));
            } else {
              this.$indexEl.text("");
              return
            }
            var color = this.getPaletteColor(index);
            if (color) {
              this.$ruleInfoEl[0].style.setProperty('--rule-color', color);
            }
          } catch (error) {
            console.log(
              "Error updating the rule numbering for a query rule. Details: " + error
            );
          }
        },

        /**
         * addRemoveButton - Create and insert the button to remove the query rule
         */
        addRemoveButton: function () {
          try {
            var removeButton = $(
              "<i class='" + this.removeClass +
              " icon icon-remove' title='Remove this query rule'></i>"
            );
            this.el.append(removeButton[0]);
          } catch (e) {
            console.error("Failed to , error message: " + e);
          }
        },
        
        /**
         * Determines whether the filter model that this rule renders matches one of the
         * {@link QueryRuleView#specialFields special fields} set on this view. If it
         * does, returns the first special field object that matches. For a filter model
         * to match to one of the special fields, it must contain all of the fields listed
         * in the special field's "fields" property. If the special field has an array set
         * for "values", then the model's values must also exactly match the special
         * field's values.
         *
         * @param  {string[]} [fields] - Optionally set a list of query fields to search
         * with. If not set, then the fields that are set on the view's filter model are
         * used.
         * @returns {SpecialField|null} - The matching special field, or null if no match
         * was found.
         *
         * @since 2.15.0
         */
        getSpecialField: function(fields){

            // Get information about the filter model (or used the fields passed to this
            // function)
            var selectedFields = fields || this.model.get("fields");
            var selectedFields = _.clone(selectedFields);
            var selectedValues = this.model.get("values");

            if(!this.specialFields || !Array.isArray(this.specialFields)){
              return null
            }
            
            var matchingSpecialField = _.find(this.specialFields, function(specialField){
              
              var fieldsMatch = false,
                  mustMatchValues = false,
                  valuesMatch = false;

              // If *all* the fields in the fields array are present in the list
              // of fields that the special field represents, then count this as a match.
              var commonFields = _.intersection(specialField.fields, selectedFields);
              if(commonFields.length === specialField.fields.length){
                fieldsMatch = true
              }
              
              // The selected value must *exactly match* if one is set in the special
              // field
              if(specialField.values){
                mustMatchValues = true;
                valuesMatch = _.isEqual(specialField.values, selectedValues)
              }

              return fieldsMatch && (
                !mustMatchValues || (mustMatchValues && valuesMatch)
              )
              
            }, this);

            // If this model matches one of the special fields, render it differently
            return matchingSpecialField || null
        },

        /**
         * Takes a list of query field names, checks if the model matches any of the
         * special fields, and if it does, returns the list of fields with the actual
         * field names replaced with the
         * {@link QueryRuleView#specialFields special field name}. This function is the
         * opposite of {@link QueryRuleView#convertFromSpecialFields}
         * @param  {string[]} fields - The list of field names to convert
         * @returns {string[]} - The converted list of field names. If there were no
         * special fields detected, or if there's an error, then then the field names are
         * returned unchanged.
         *
         * @param {string[]} fields - The list of fields to convert to special fields, if
         * the model matches any of the special field objects
         * @returns {string[]} - Returns the list of fields with actual query field names
         * replaced with special field names, if any match
         *
         * @since 2.15.0
         */
        convertToSpecialFields: function(fields){

          try {

            var fields = _.clone(fields);

            // Insert the special field name at the same position as the associated
            // query fields that we will remove
            var replaceWithSpecialField = function(fields, specialField){
              if(specialField){
                position = _.findIndex(fields, function(selectedField){
                  return specialField.fields.includes(selectedField);
                }, this);
                fields.splice(position, 0, specialField.name);
                fields = _.difference(fields, specialField.fields);
              }
              return fields
            }
            

            // If the user selected a special field, make sure we convert those first
            if( this.selectedSpecialFields && this.selectedSpecialFields.length ){
              this.selectedSpecialFields.forEach(function(specialFiend){
                fields = replaceWithSpecialField(fields, specialFiend)
              }, this);
            }

            // Search for remaining special fields given the fields and model values
            var matchingSpecialField = this.getSpecialField(fields);

            // There may be more than one special field in the list of fields...
            while(matchingSpecialField !== null){
              fields = replaceWithSpecialField(fields, matchingSpecialField)
              // Check if there are more special fields remaining
              matchingSpecialField = this.getSpecialField(fields);

            }

            return fields;

          } catch (error) {
            console.log(
              "Error converting query field names to special field names in" +
              " a Query Rule View. Returning the list of fields unchanged." +
              " Error details : " + error
            );
            return fields
          }
          
        },

        /**
         * Takes a list of query field names and checks if it contains any of the
         * {@link QueryRuleView#specialFields special field names}. Returns the list with
         * the special field names replaced with the actual field names that those special
         * fields represent. Stores the name of each special field name removed in an
         * array set on the view's selectedSpecialFields property. selectedSpecialFields
         * is cleared each time this function runs. This function is the opposite of
         * {@link QueryRuleView#convertToSpecialFields}
         * @param  {string[]} fields] - The list of field names to convert
         * @returns {string[]} - The converted list of field names. If there were no
         * special fields detected, or if there's an error, then then the field names are
         * returned unchanged.
         *
         * @param {string[]} fields - The list of fields to convert to actual query
         * service index fields
         * @returns {string[]} - Returns the list of fields with any special field
         * replaced with real fields from the query service index
         *
         * @since 2.15.0
         */
        convertFromSpecialFields: function(fields){
          try {
            this.selectedSpecialFields = [];
            if(this.specialFields){
              this.specialFields.forEach(function(specialField){
                var index = fields.indexOf(specialField.name);
                if(index >= 0){
                  // Keep a record that the user selected a special field (useful in the
                  // case that the special field is just a duplicate of another field)
                  this.selectedSpecialFields.push(specialField);
                  fields.splice.apply(fields, [index, 1].concat(specialField.fields));
                }
              }, this);
            }
            return fields
          } catch (error) {
            console.log(
              "Error converting special query fields to query fields that" +
              " exist in the index in a Query Rule View. Returning the fields" +
              " unchanged. Error details: " + error
            );
            return fields
          }
        },

        /**
         * Create and insert an input that allows the user to select a metadata field to
         * query
         */
        addFieldSelect: function () {

          try {

            // Check whether the filter model set on this view contains query fields
            // and values that match one of the special rules. If it does,
            // convert the list of field names to special field to pass on to the
            // Query Field Select View.
            var selectedFields = _.clone(this.model.get("fields"));
            var selectedFields = this.convertToSpecialFields(selectedFields);

            this.fieldSelect = new QueryFieldSelect({
              selected: selectedFields,
              excludeFields: this.excludeFields,
              addFields: this.specialFields,
            });
            this.fieldSelect.$el.addClass(this.fieldsClass);
            this.el.append(this.fieldSelect.el);
            this.fieldSelect.render();

            // Update model when the values change
            this.stopListening(
              this.fieldSelect,
              'changeSelection'
            );
            this.listenTo(
              this.fieldSelect,
              'changeSelection',
              this.handleFieldChange
            );

          } catch (e) {
            console.error("Error adding a metadata selector input in the Query Rule"
              + " View, error message:", e);
          }
        },

        /**
         * handleFieldChange - Called when the Query Field Select View triggers a change
         * event. Updates the model with the new fields, and if required,
         * 1) converts the filter model to a different type based on the types of fields
         *    selected, 2) updates the operator select and the value select
         *
         * @param  {string[]} newFields The list of new query fields that were selected
         */
        handleFieldChange: function (newFields) {

          try {

            // Uncomment the following chunk to clear operator & values when the field
            // input is cleared.
            // if(!newFields || newFields.length === 0 || newFields[0] === ""){
            //   if(this.operatorSelect){
            //     this.operatorSelect.changeSelection([""]);
            //   }
            //   this.model.set("fields", this.model.defaults().fields);
            //   return
            // }

            // Get the selected operator before the field changed
            var opBefore = this.getSelectedOperator();

            // If any of the new fields are special fields, replace them with the
            // actual query fields before setting them in the model...
            newFields = this.convertFromSpecialFields(newFields);

            // Get the current type of filter and required type given the newly selected
            // fields
            var typeBefore = this.model.get("nodeName"),
                typeAfter = this.getRequiredFilterType(newFields);

            // If the type has changed, then replace the model with one of the correct
            // type, update the value and operator inputs, and do nothing else
            if (typeBefore != typeAfter) {
              this.model = this.model.collection.replaceModel(
                this.model,
                { filterType: typeAfter, fields: newFields }
              );
              this.removeInput("value")
              this.removeInput("operator")
              this.addOperatorSelect("");
              return
            }

            // If the filter model type is the same, and the operator options are the same
            // for the selected fields, then update the model
            this.model.set("fields", newFields);

            // Get the selected operator now that we've updated the model with new fields
            var opAfter = this.getSelectedOperator();

            // Add an empty operator input field, if there isn't one
            if (!this.operatorSelect) {
              this.addOperatorSelect("");
            // If the operator options have changed, refresh the operator input
            } else if (opAfter !== opBefore){
              this.removeInput("operator");
              // Make sure that we overwrite any values that don't apply to the new options.
              this.handleOperatorChange([""]);
              this.addOperatorSelect("");
              return
            }

            // Refresh the value select in case a different value input is required for
            // the new fields
            if (this.valueSelect) {
              this.removeInput("value");
              this.addValueSelect();
            }

          } catch (e) {
            console.error("Failed to handle query field change in the Query Rule View," +
              " error message: " + e);
          }

        },

        /**
         * getRequiredFilterType - Based on an array of query (Solr) fields, get the type
         * of filter model this rule should use. For example, if the fields are type text,
         * use a regular filter model. If the fields are tdate, use a dateFilter. Also
         * decide which filter to use if the field types are mixed.
         *
         * @param  {string[]} fields The list of selected fields
         * @return {string} The nodeName of the filter model to use
         */
        getRequiredFilterType: function (fields) {
          try {
            var types = [],
              // When fields is empty or are different types
              defaultFilterType = MetacatUI.queryFields.models[0].defaults().filterType;

            if (!fields || fields.length === 0 || fields[0] === "") {
              return defaultFilterType
            }

            fields.forEach((newField, i) => {
              var fieldModel = MetacatUI.queryFields.findWhere({ name: newField });
                types.push(fieldModel.get("filterType"));
            });

            // Test of all the fields are of the same type
            var allEqual = types.every((val, i, arr) => val === arr[0]);

            if (allEqual) {
              return types[0]
            } else {
              return defaultFilterType
            }

          } catch (e) {
            console.log("Failed to detect the required filter type in the Query Rule" +
              " View, error message: " + e);
          }
        },

        /**
         * Create and insert an input field where the user can select an operator for the
         * given rule. Operators will vary depending on filter model type.
         * 
         * @param {string} selectedOperator - optional. The label of an operator to
         * pre-select. Set to an empty string to render an empty operator selector.
         */
        addOperatorSelect: function (selectedOperator) {
          try {

            var view = this;
            var operatorError = false;

            var options = this.getOperatorOptions();

            // Identify the selected operator for existing models
            if (typeof selectedOperator !== "string") {
              selectedOperator = this.getSelectedOperator();
              // If there was no operator found, then this is probably an unsupported
              // combination of exclude + matchSubstring + filterType
              if (selectedOperator === "") {
                operatorError = true;
              }
            }

            if (selectedOperator === "") {
              selectedOperator = []
            } else {
              selectedOperator = [selectedOperator]
            }

            this.operatorSelect = new SearchableSelect({
              options: options,
              allowMulti: false,
              inputLabel: "Select an operator",
              clearable: false,
              placeholderText: "Select an operator",
              selected: selectedOperator
            });
            this.operatorSelect.$el.addClass(this.operatorClass);
            this.el.append(this.operatorSelect.el);

            if (operatorError) {
              view.listenToOnce(view.operatorSelect, "postRender", function () {
                view.operatorSelect.showMessage(
                  "Please select a valid operator",
                  "error",
                  true
                )
              })
            }

            this.operatorSelect.render();

            // Update model when the values change
            this.stopListening(
              this.operatorSelect,
              'changeSelection'
            );
            this.listenTo(
              this.operatorSelect,
              'changeSelection',
              this.handleOperatorChange
            );

          } catch (e) {
            console.error("Error adding an operator selector input in the Query Rule " +
              "View, error message:", e);
          }
        },

        /**
         * handleOperatorChange - When the operator selection is changed, update the model
         * and re-set the value UI when required
         *
         * @param  {string[]} newOperatorLabel The new operator label within an array,
         * e.g. ["is greater than"]
         */
        handleOperatorChange: function (newOperatorLabel) {

          try {

            var view = this;

            if (!newOperatorLabel || newOperatorLabel[0] == "") {
              var modelDefaults = this.model.defaults();
              this.model.set({
                min: modelDefaults.min,
                max: modelDefaults.max,
                values: modelDefaults.values
              })
              this.removeInput("value");
              return;
            }

            // Get the properties of the newly selected operator. The newOperatorLabel
            // will be an array with one value.
            var operator = _.findWhere(
              this.operatorOptions,
              { label: newOperatorLabel[0] }
            );

            // Gather  information about which values are currently set on the model, and
            // which are required
            var // Type
              type = view.model.get("nodeName"),
              isNumeric = ["dateFilter", "numericFilter"].includes(type),
              isRange = operator.hasMin && operator.hasMax,

              // Values
              modelValues = this.model.get("values"),
              modelHasValues = modelValues ? modelValues && modelValues.length : false,
              modelFirstValue = modelHasValues ? modelValues[0] : null,
              modelValueInt = parseInt(modelFirstValue) ? parseInt(modelFirstValue) : null,
              needsValue = isNumeric && !modelValueInt && !operator.hasMin && !operator.hasMax,

              // Min
              modelMin = this.model.get("min"),
              modelHasMin = modelMin === 0 || modelMin,
              needsMin = operator.hasMin && !modelHasMin,

              // Max
              modelMax = this.model.get("max"),
              modelHasMax = modelMax === 0 || modelMax,
              needsMax = operator.hasMax && !modelHasMax;

            // Some operator options include a specific value to be set on the model. For
            // example, "is not empty", should set the model value to the "*" wildcard.
            // For operators with these specific value requirements, update the filter
            // model value and remove the value select input.
            if (operator.values && operator.values.length) {
              this.removeInput("value");
              this.model.set("values", operator.values);
              // If the operator does not have a default value, then ensure that there is
              // a value select available.
            } else {
              if (!this.valueSelect) {
                this.model.set("values", view.model.defaults().values);
                this.addValueSelect();
              }
            }

            // Update the model with true or false for matchSubstring and exclude
            ["matchSubstring", "exclude"].forEach((prop, i) => {
              if (typeof operator[prop] !== "undefined") {
                view.model.set(prop, operator[prop]);
              } else {
                view.model.set(prop, view.model.defaults()[prop]);
              }
            });

            // Set min & max values as required by the operator
            // TODO - test this strategy with dates...

            // Add a minimum value if one is needed
            if (needsMin) {
              // Search for the min in the values, then in the max
              if (modelValueInt || modelValueInt === 0) {
                this.model.set("min", modelValueInt)
              } else if (modelHasMax) {
                this.model.set("min", modelMax)
              } else {
                this.model.set("min", 0)
              }
            }

            // Add a maximum value if one is needed
            if (needsMax) {
              // Search for the min in the values, then in the max
              if (modelValueInt || modelValueInt === 0) {
                this.model.set("max", modelValueInt)
              } else if (modelHasMin) {
                this.model.set("max", modelMin)
              } else {
                this.model.set("max", 0)
              }
            }

            // Add a value if one is needed
            if (needsValue) {
              if (modelHasMin) {
                this.model.set("values", [modelMin])
              } else if (modelHasMax) {
                this.model.set("values", [modelMax])
              } else {
                this.model.set("values", [0])
              }
            }

            // Remove the minimum and max if they should not be included in the filter
            if (modelHasMax && !operator.hasMax) {
              this.model.set("max", this.model.defaults().max)
            }
            if (modelHasMin && !operator.hasMin) {
              this.model.set("min", this.model.defaults().min)
            }

            if (isRange) {
              this.model.set("range", true)
            } else {
              if (isNumeric) {
                this.model.set("range", false)
              } else {
                this.model.unset("range")
              }
            }

            // If the operator changed for a numeric or date field, reset the value
            // select. This way it can change from a range to a single value input if
            // needed.
            if (isNumeric) {
              this.removeInput("value");
              this.addValueSelect();
            }
          } catch (e) {
            console.error("Failed to handle the operator selection in a query rule " +
              "view, error message: " + e);
          }
        },

        /**
         * Get a list of {@link QueryRuleView#operatorOptions operatorOptions} that are
         * allowed for this view's filter model
         *
         * @param  {string[]} [fields] - Optional list of fields to use instead of the
         * fields set on this view's Filter model
         *
         * @since 2.15.0
         */
        getOperatorOptions: function(fields){

          try {
            // Check which type of rule this is (boolean, numeric, text, date)
            var type = this.model.get("nodeName");

            // If this rule contains a special field, replace the real query field names
            // with the special field names for the purpose of selecting operator options
            var fields = fields || this.model.get("fields");
            var fields = _.clone(fields);
            var fields = this.convertToSpecialFields(fields);

            // Get the list of options for a user to select from based on field name.
            // All of the rule's fields must be contained within the operator option's
            // list of allowed fields for it to be a match.
            var options = _.filter(this.operatorOptions, function (option) {
              if(option.fields){
                return _.every(fields, function(fieldName){
                  return option.fields.includes(fieldName)
                })
              }
            });

            // Get the list of options for a user to select from based on type, if there
            // were none that matched based on field names
            if(!options || !options.length){
              options = _.filter(this.operatorOptions, function (option) {
                if(option.types){
                  return option.types.includes(type)
                }
              }, this);
            }

            return options
          } catch (error) {
            console.log("Error getting operator options in a Query Rule View, " +
            "Error details: " + error);
          }
        },

        /**
         * getSelectedOperator - Based on values set on the model, get the label to show
         * in the "operator" filed of the Query Rule
         *
         * @return {string} The operator label
         */
        getSelectedOperator: function () {

          try {

            // This view
            var view = this,
              // The options that we will filter down
              options = this.operatorOptions,
              // The user-facing operator label that we will return
              selectedOperator = "";

            // --- Filter 1 - Filter options by type --- //

            // Reduce list of options to only  those that apply to the current filter type
            var type = view.model.get("nodeName");
            var options = this.getOperatorOptions();

            // --- Filter 2 - filter by 'matchSubstring', 'exclude', 'min', 'max' --- //

            // Create the conditions based on the model
            var conditions = _.pick(
              this.model.attributes,
              'matchSubstring', 'exclude', 'min', 'max'
            );

            var isNumeric = ["dateFilter", "numericFilter"].includes(type);

            if (!conditions.min && conditions.min !== 0) {
              if (isNumeric) {
                conditions.hasMin = false
              }
            } else if (isNumeric) {
              conditions.hasMin = true
            }
            if (!conditions.max && conditions.max !== 0) {
              if (isNumeric) {
                conditions.hasMax = false
              }
            } else if (isNumeric) {
              conditions.hasMax = true
            }

            delete conditions.min
            delete conditions.max

            var options = _.where(options, conditions);

            // --- Filter 3 - filter based on the value, if there's > 1 option --- //

            if (options.length > 1) {
              // Model values that determine the user-facing operator eg ["*"], [true],
              // [false]
              var specialValues = _.compact(
                _.pluck(this.operatorOptions, "values")
              ),
                specialValues = specialValues.map(val => JSON.stringify(val)),
                specialValues = _.uniq(specialValues);

              options = options.filter(function (option) {
                var modelValsStringified = JSON.stringify(view.model.get("values"));
                if (specialValues.includes(modelValsStringified)) {
                  if (JSON.stringify(option.values) === modelValsStringified) {
                    return true
                  }
                } else {
                  if (!option.values) {
                    return true
                  }
                }
              })
            }
            // --- Return value --- //

            if (options.length === 1) {
              selectedOperator = options[0].label
            }

            return selectedOperator
          } catch (e) {
            console.error("Failed to select an operator in the Query Rule View, error" +
              " message: " + e);
          }
        },

        /**
         * getCategory - Given an array of query fields, get the user-facing category that
         * these fields belong to. If there are fields from multiple categories, then a
         * default "Text" category is returned.
         *
         * @param  {string[]} fields An array of query (Solr) fields
         * @return {string} The label for the category that the given fields belong to
         */
        getCategory: function (fields) {

          try {
            var categories = [],
              // When fields is empty or are different types
              defaultCategory = "Text";

            if (!fields || fields.length === 0 || fields[0] === "") {
              return defaultCategory
            }

            fields.forEach((field, i) => {
              // Get the category of the field from the matching filter model in the Query
              // Fields Collection
              var fieldModel = MetacatUI.queryFields.findWhere({ name: field });
              categories.push(fieldModel.get("category"))
            });

            // Test of all the fields are of the same type
            var allEqual = categories.every((val, i, arr) => val === arr[0]);

            if (allEqual) {
              return categories[0]
            } else {
              return defaultCategory
            }

          } catch (e) {
            console.log("Failed to detect the category for a group of filters in the" +
              " Query Rule View, error message: " + e);
          }

        },

        /**
         * Create and insert an input field where the user can provide a search value
         */
        addValueSelect: function () {
          try {

            var view = this
              fields = this.model.get("fields"),
              filterType = this.getRequiredFilterType(fields),
              category = this.getCategory(fields),
              interfaces = this.valueSelectUImap,
              label = "";

            // To help guide users to create valid queries, the type of value field will
            // vary based on the type of field (i.e. filter nodeName), and the operator
            // selected.

            // Some user-facing operators (e.g. "is true") don't require a value to be set
            var selectedOperator = _.findWhere(
              this.operatorOptions,
              { label: this.getSelectedOperator() }
            );
            if (selectedOperator) {
              if (selectedOperator.values && selectedOperator.values.length) {
                return
              }
            }

            // Find the appropriate UI to use the the value select field. Find the first
            // match in the valueSelectUImap according to the filter type and the
            // categories associated with the metadata field.
            var interfaceProperties = _.find(interfaces, function (thisInterface) {
              var typesMatch = true,
                categoriesMatch = true,
                namesMatch = true;
              if (thisInterface.queryFields && thisInterface.queryFields.length) {
                fields.forEach((field, i) => {
                  if (thisInterface.queryFields.includes(field) === false) {
                    namesMatch = false;
                  }
                });
              }
              if (thisInterface.filterTypes && thisInterface.filterTypes.length) {
                typesMatch = thisInterface.filterTypes.includes(filterType)
              }
              if (thisInterface.categories && thisInterface.categories.length) {
                categoriesMatch = thisInterface.categories.includes(category)
              }
              return typesMatch && categoriesMatch && namesMatch
            });

            this.valueSelect = interfaceProperties.uiFunction.call(this);
            if (interfaceProperties.label && interfaceProperties.label.length) {
              label = $(
                "<p class='subtle searchable-select-label'>" +
                interfaceProperties.label + "</p>"
              );
            }

            // Append and render the chosen value selector
            this.el.append(view.valueSelect.el);
            this.valueSelect.$el.addClass(this.valuesClass);
            view.valueSelect.render();
            if (label) {
              view.valueSelect.$el.prepend(label)
            }

            // Update model when the values change - note that the date & numeric filter
            // views do not trigger a 'changeSelection' event, (because they are not based
            // on a SearchSelect View) but update the models directly
            this.stopListening(
              view.valueSelect,
              'changeSelection'
            );
            this.listenTo(
              view.valueSelect,
              'changeSelection',
              this.handleValueChange
            );

            // Set the value to the value provided if there was one. Then validateValue()
          } catch (e) {
            console.error("Error adding a search value input in the Query Rule View," +
              " error message:", e);
          }
        },

        /**
         * handleValueChange - Called when the select values for rule are changed. Updates
         * the model.
         *
         * @param  {string[]} newValues The new values that were selected
         */
        handleValueChange: function (newValues) {

          try {
            // TODO:
            //  - validate values first?
            //  - how to update the model when values is empty?

            // Don't add empty values to the model
            newValues = _.reject(newValues, function (val) { return val === "" });
            this.model.set("values", newValues);
          } catch (e) {
            console.error("Failed to handle a change in select values in the Query Ryle" +
              " View, error message: " + e);
          }
        },

        // /**
        //  * Ensure the value entered is valid, given the metadata field selected.
        //  * If it's not, show an error. If it is, remove the error if there was one.
        //  *
        //  * @return {type}  description
        //    */
        // validateValue: function() {// TODO
        // },

        /**
         * Remove one of the three input fields from the rule
         *
         * @param  {string} inputType Which of the inputs to remove? "field", "operator",
         * or "value"
         */
        removeInput: function (inputType) {
          try {
            // TODO - what, if any, model updates should happen here?
            switch (inputType) {
              case "value":
                if (this.valueSelect) {
                  this.stopListening(this.valueSelect, 'changeSelection');
                  this.valueSelect.remove();
                  this.valueSelect = null;
                }
                break;
              case "operator":
                if (this.operatorSelect) {
                  this.stopListening(this.operatorSelect, 'changeSelection');
                  this.operatorSelect.remove();
                  this.operatorSelect = null;
                }
                break;
              case "field":
                if (this.fieldSelect) {
                  this.stopListening(this.fieldSelect, 'changeSelection');
                  this.fieldSelect.remove();
                  this.fieldSelect = null;
                }
                break;
              default:
                console.error("Must specify either value, operator, or field in the" +
                  " removeInput function in the Query Rule View")
            }
          } catch (e) {
            console.error("Error removing an input from the Query Rule View, error" +
              " message:", e);
          }
        },

        /**
         * Indicate to the user that the rule will be removed when they hover over the
         * remove button.
         */
        previewRemove: function () {
          try {
            this.$el.toggleClass(this.removePreviewClass);
          } catch (error) {
            console.log("Error showing a preview of the removal of a Query Rule View," +
              " details: " + error);
          }
        },

        /**
         * removeSelf - When the delete button is clicked, remove this entire View and
         * associated model
         */
        removeSelf: function () {
          try {
            $("body .popover").remove();
            $("body .tooltip").remove();
            if (this.model && this.model.collection) {
              this.model.collection.remove(this.model);
            }
            this.remove();
          } catch (error) {
            console.log("Error removing a Query Rule View, details: " + error);
          }
        },

      });
  });
