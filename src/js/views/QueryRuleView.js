define([
    "jquery",
    "underscore",
    "backbone",
    "views/SearchableSelectView",
    "views/QueryFieldSelectView",
    "views/NodeSelectView",
    'views/filters/NumericFilterView',
    "collections/QueryFields",
    "models/filters/Filter",
    "models/filters/BooleanFilter",
    "models/filters/NumericFilter",
    "models/filters/DateFilter",
  ],
  function(
    $, _, Backbone, SearchableSelect, QueryFieldSelect, NodeSelect,
    NumericFilterView, QueryFields, Filter, BooleanFilter, NumericFilter, DateFilter
  ) {

    /**
     * @class QueryRule
     * @classdesc A view that provides an interface for a user to construct a single filter that is part of a complex query
     * @extends Backbone.View
     * @constructor
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
        ruleColorPalette: ["#44AA99", "#137733", "#999934", "#DDCC76", "#CC6677", "#882355", "#AA4499","#332288", "#88CCEE"],

        /**
         * A single Filter model that is part of a Filters collection, such as
         * the definition filters for a Collection or Portal or the filters for
         * a Search model. The Filter model must be part of a Filters collection
         * (i.e. there must be a model.collection property)
         * @type {Filter|BooleanFilter|NumericFilter|DateFilter} 
         */
        model: undefined,

        /**
         * The events this view will listen to and the associated function to call.
         * @type {Object}
         */
        events: function() {
          var events = {};
          events["click ." + this.removeClass] = "removeSelf";
          events["mouseover ." + this.removeClass] = "previewRemove";
          events["mouseout ." + this.removeClass] = "previewRemove";
          return events
        },
        
        /**        
         * Maps the query field label to the filter model type. Keys in the 
         * object must match the labels that are provided in the Query Fields
         * collection categories {@link QueryFields#categories}, and values must
         * match the nodeNames of various filter types (e.g. "dateFilter")
         * @type {object}
         * @property {string} Text - the name of the filter to use with text fields
         * @property {string} Boolean - the name of the filter to use with boolean fields
         * @property {string} Numeric - the name of the filter to use with numeric fields
         * @property {string} Date - the name of the filter to use with model fields
         */         
        queryCategoryToFilterMap: {
          "Text" : "filter",
          "Boolean" : "booleanFilter",
          "Numeric" : "numericFilter",
          "Date" : "dateFilter"
        },
        
        /**        
         * // TODO: should this go into the Filters collection?
         * Defined the user-friendly operators that will be available in the
         * dropdown list to connect the query fields to the query values.
         * Each operator must be unique. This definition is used to pre-select
         * the correct operator based on attributes in the associated filter model,
         * as well as to update the filter model when a user selects a new operator.
         * @type {object[]}        
         * @property {string} label - The label to display to the user
         * @property {string} icon - An icon that represents the operator
         * @property {boolean} matchSubstring - Whether the matchSubstring attribute is true or false in the filter model that matches this operator
         * @property {boolean} exclude - Whether the exclude attribute is true or false in the filter model that matches this operator
         * @property {boolean} hasMax - Whether the filter model that matches this operator must have a max attribute
         * @property {boolean} hasMin - Whether the filter model that matches this operator must have a min attribute
         * @property {string[]} values - For this operator to work as desired, the values that should be set in the filter (e.g. ["true"] for the operator "is true")
         * @property {string[]} types - The node names of the filters that this operator is used for (e.g. "filter", "booleanFilter")
         */         
        operatorOptions: [
          {
            label: "equals",
            icon: "equal",
            matchSubstring: false,
            exclude: false,
            types: ["filter"]
          },
          {
            label: "does not equal",
            icon: "not-equal",
            matchSubstring: false,
            exclude: true,
            types: ["filter"]
          },
          {
            label: "contains",
            icon: "ok-circle",
            matchSubstring: true,
            exclude: false,
            types: ["filter"]
          },
          {
            label: "does not contain",
            icon: "ban-circle",
            matchSubstring: true,
            exclude: true,
            types: ["filter"]
          },
          {
            label: "is empty",
            icon: "circle-blank",
            matchSubstring: false,
            exclude: true,
            values: ["*"],
            types: ["filter"]
          },
          {
            label: "is not empty",
            icon: "circle",
            matchSubstring: false,
            exclude: false,
            values: ["*"],
            types: ["filter"]
          },
          {
            label: "is true",
            icon: "ok-circle",
            matchSubstring: false,
            exclude: false,
            values: [true],
            types: ["booleanFilter"]
          },
          {
            label: "is false",
            icon: "ban-circle",
            matchSubstring: false,
            exclude: false,
            values: [false],
            types: ["booleanFilter"]
          },
          {
            label: "is between",
            icon: "resize-horizontal",
            matchSubstring: false,
            exclude: false,
            hasMin: true,
            hasMax: true,
            types: ["numericFilter", "dateFilter"]
          },
          {
            label: "is less than",
            icon: "less-than",
            matchSubstring: false,
            exclude: false,
            hasMin: false,
            hasMax: true,
            types: ["numericFilter"]
          },
          {
            label: "is greater than",
            icon: "greater-than",
            matchSubstring: false,
            exclude: false,
            hasMin: true,
            hasMax: false,
            types: ["numericFilter"]
          },
          {
            label: "is exactly",
            icon: "equal",
            matchSubstring: false,
            exclude: false,
            hasMin: false,
            hasMax: false,
            types: ["numericFilter"]
          },
          // TODO: The dateFilter model & view need to be updated for these to work:
          // {
          //   label: "is before",
          //   icon: "less-than",
          //   matchSubstring: false,
          //   exclude: false,
          //   hasMin: false,
          //   hasMax: true,
          //   types: ["dateFilter"]
          // },
          // {
          //   label: "is after",
          //   icon: "greater-than",
          //   matchSubstring: false,
          //   exclude: false,
          //   hasMin: true,
          //   hasMax: false,
          //   types: ["dateFilter"]
          // },
          // {
          //   label: "is in the year",
          //   icon: "equal",
          //   matchSubstring: false,
          //   exclude: false,
          //   hasMin: false,
          //   hasMax: false,
          //   types: ["dateFilter"]
          // }
        ],

        /**
         * Creates a new QueryRuleView
         * @param {Object} options - A literal object with options to pass to the view
         */
        initialize: function(options) {
          try {

            // Get all the options and apply them to this view
            if (typeof options == "object") {
              var optionKeys = Object.keys(options);
              _.each(optionKeys, function(key, i) {
                this[key] = options[key];
              }, this);
            }

            // If no model is provided in the options, then set a new Filters model
            if (!this.model || typeof this.model === 'undefined') {
              // TODO: Parts of the view won't work if there is no collection...
              // Should we call an error if no model is provided?
              this.model = new Filter();
            }

          } catch (e) {
            console.log("Failed to initialize a Query Builder View, error message:", e);
          }
        },

        /**        
         * render - Render the view
         *          
         * @return {QueryRule}  Returns the view
         */
        render: function() {
          
          try {

            // TODO:
            // How to indicate whether multiple fields/values are AND'ed or OR'ed together?
            
            // Add the Rule number, and the number of datasets related to rule (TODO)
            this.addRuleInfo();
            this.listenTo(this.model.collection, "remove", this.updateRuleInfo);

            // Metadata Selector field
            // Add a metadata selector field whether the rule is new or has
            // already been created
            this.addFieldSelect();

            // Operator field and value field
            // Add an operator input only for already existing filters
            // (For new filters, a metadata field needs to be selected first)
            if(
              this.model.get("fields") &&
              this.model.get("fields").length
            ){
              this.addOperatorSelect();
              this.addValueSelect();
            }
            
            this.addRemoveButton();

            return this;

          } catch (e) {
            console.log("Error rendering the query Rule View, error message: ", e);
          }
        },
        
        addRuleInfo: function(){
          
          this.$indexEl = $(document.createElement("span"));
          this.$ruleInfoEl = $(document.createElement("div"))
                            .addClass(this.ruleInfoClass);
          this.$ruleInfoEl.append(this.$indexEl);
          
          this.$el.append(this.$ruleInfoEl);
          this.updateRuleInfo();
        },
        
        getPaletteColor: function(index){
          if(!this.ruleColorPalette || !this.ruleColorPalette.length){
            return
          }
          var numCols = this.ruleColorPalette.length;
          if((index + 1) > numCols){
            var n = Math.floor(index/numCols);
            index = index - (numCols * n);
          }
          return this.ruleColorPalette[index];
        },
        
        updateRuleInfo: function(){
          var index = this.model.collection.visibleIndexOf(this.model);
          if(typeof index === "number"){
            this.$indexEl.text("Rule " + (index + 1));
          } else {
            this.$indexEl.text("");
            return
          }
          var color = this.getPaletteColor(index);
          if(color){
            this.$ruleInfoEl[0].style.setProperty('--rule-color', color);
          }
        },
        
        /**        
         * addRemoveButton - Create and insert the button to remove the query rule      
         */         
        addRemoveButton: function(){
          try {
            var removeButton = $("<i class='" + this.removeClass + " icon icon-remove' title='Remove this query rule'></i>");
            this.el.append(removeButton[0]);
          } catch (e) {
            console.log("Failed to , error message: " + e);
          }
        },

        /**        
         * Create and insert an input that allows the user to select
         * a metadata field to query
         */
        addFieldSelect: function() {
          
          try {
            
            this.fieldSelect = new QueryFieldSelect({
              selected: this.model.get("fields")
            });
            this.fieldSelect.$el.addClass(this.fieldsClass);
            this.el.append(this.fieldSelect.el);
            this.fieldSelect.render();
            
            // Update model when the values change
            this.stopListening(this.fieldSelect, 'changeSelection', this.handleFieldChange);
            this.listenTo(this.fieldSelect, 'changeSelection', this.handleFieldChange);
            
          } catch (e) {
            console.log("Error adding a metadata selector input in the Query Rule View, error message:", e);
          }
        },
        
        /**        
         * handleFieldChange - Called when the Query Field Select View triggers
         * a change event. Updates the model with the new fields, and if required,
         * 1) converts the filter model to a different type based on the types of
         * fields selected, 2) updates the operator select and the value select
         *          
         * @param  {string[]} newFields The list of new query fields that were selected
         */         
        handleFieldChange: function(newFields){
          
          try {
            
            if(!newFields || newFields.length === 0 || newFields[0] === ""){
              if(this.operatorSelect){
                this.operatorSelect.changeSelection([""]);
              }
              this.model.set("fields", this.model.defaults().fields);
              return
            }
            // Get the current type of filter
            var typeBefore = this.model.get("nodeName");
            var typeAfter = this.getRequiredFilterType(newFields);
            // If the type has changed, then replace the model with one of the
            // correct type
            if(typeBefore != typeAfter){
              var filters = this.model.collection,
                  index = filters.indexOf(this.model),
                  oldModelId = this.model.cid;
              this.model = filters.add(
                { filterType: typeAfter, fields: newFields },
                { at: index }
              );
              filters.remove(oldModelId);
              this.removeInput("value")
              this.removeInput("operator")
              this.addOperatorSelect("");
              return
            }
            this.model.set("fields", newFields);
            if(!this.operatorSelect){
              this.addOperatorSelect("");
            }
          } catch (e) {
            console.log("Failed to handle query field change in the Query Rule View, error message: " + e);
          } 
          
        },
        
        /**        
         * getRequiredFilterType - Based on an array of query (Solr) fields,
         * get the type of filter model this rule should use. For example,
         * if the fields are type text, use a regular filter model. If
         * the fields are tdate, use a dateFilter. Also decide which filter
         * to use if the field types are mixed.
         *          
         * @param  {string[]} fields The list of selected fields
         * @return {string} The nodeName of the filter model to use
         */         
        getRequiredFilterType(fields){
          try {
            var types = [],
                nodeName = "",
                // when fields is empty or are different types
                defaultFilterType = this.queryCategoryToFilterMap["Text"];
                
            if(!fields || fields.length === 0 || fields[0] === ""){
              return defaultFilterType
            }
            
            fields.forEach((newField, i) => {
              // Get the type of the field from the Query Fields Collection
              var fieldModel = MetacatUI.queryFields.findWhere({ name:newField }),
                  // The specific type of field this is (e.g. tdate)
                  type = fieldModel.get("type"),
                  // The more general category (e.g. "Date")
                  generalType = MetacatUI.queryFields.categories.filter(
                    function(category){
                      return category.get("queryTypes").includes(type)
                    }
                  )
              if(generalType.length === 1){
                types.push(generalType[0].get("label"))
              }
              
            });
            
            // Test of all the fields are of the same type
            var allEqual = types.every( (val, i, arr) => val === arr[0] );
            
            if(allEqual){
              nodeName = this.queryCategoryToFilterMap[types[0]]
            } else {
              // Default to a text filter if the types are mixed, but this might
              // cause issues. We probably want to restrict filters to the same type.
              nodeName = defaultFilterType
            }
            
            return nodeName
          } catch (e) {
            console.log("Failed to detect the required filter type in the Query Rule View, error message: " + e);
          }
        },

        /**        
         * Create and insert an input field where the user can select an operator
         * for the given rule. Operators will vary depending on filter model type.
         * @param {string} selectedOperator - optional. The label of an operator to pre-select.
         */
        addOperatorSelect: function(selectedOperator) {
          try {
            
            var view = this;
          
            // Check which type of rule this is (boolean, numeric, text, date)
            var type = this.model.get("nodeName");
            
            // Get the list of options for a user to select from based on type
            var options = _.filter(this.operatorOptions, function(option){
              return option.types.includes(type)
            });
            
            // Identify the selected operator for existing models
            if(typeof selectedOperator !== "string"){
              selectedOperator = this.getSelectedOperator();
            }
            
            this.operatorSelect = new SearchableSelect({
              options: options,
              allowMulti: false,
              inputLabel: "Select an operator",
              selected: [selectedOperator]
            });
            this.operatorSelect.$el.addClass(this.operatorClass);
            this.el.append(this.operatorSelect.el);
            this.operatorSelect.render();
            
            // Update model when the values change
            this.stopListening(this.operatorSelect, 'changeSelection', this.handleOperatorChange);
            this.listenTo(this.operatorSelect, 'changeSelection', this.handleOperatorChange);
            
          } catch (e) {
            console.log("Error adding an operator selector input in the Query Rule View, error message:", e);
          }
        },
        
        /**        
         * handleOperatorChange - When the operator selection is changed, update
         * the model and re-set the value UI when required
         *          
         * @param  {string[]} newOperatorLabel The new operator label within an array, e.g. ["is greater than"]
         */         
        handleOperatorChange: function(newOperatorLabel){
          try {
            
            var view = this;
            
            if(!newOperatorLabel || newOperatorLabel[0] == ""){
              var modelDefaults = this.model.defaults();
              this.model.set({
                min: modelDefaults.min,
                max: modelDefaults.max,
                values: modelDefaults.values
              })
              this.removeInput("value");
              return;
            }
          
            // Get the properties of the newly selected operator
            // The newOperatorLabel will be an array with one value
            var operator = _.findWhere(
              this.operatorOptions,
              { label: newOperatorLabel[0] }
            );
          
            // Gather  information about which values are currently set on the model,
            // and which are required
            var // Type
                type            =   view.model.get("nodeName"),
                isNumeric       =   ["dateFilter", "numericFilter"].includes(type),
                isRange         =   operator.hasMin && operator.hasMax,
            
                // Values
                modelValues     =   this.model.get("values"),
                modelHasValues  =   modelValues ? modelValues && modelValues.length : false,
                modelFirstValue =   modelHasValues ? modelValues[0] : null,
                modelValueInt   =   parseInt(modelFirstValue) ? parseInt(modelFirstValue) : null,
                needsValue      =   isNumeric && !modelValueInt && !operator.hasMin && !operator.hasMax,
          
                // Min
                modelMin        =   this.model.get("min"),
                modelHasMin     =   modelMin === 0 || modelMin,
                needsMin        =   operator.hasMin && !modelHasMin,
          
                // Max
                modelMax        =   this.model.get("max"),
                modelHasMax     =   modelMax === 0 || modelMax,
                needsMax        =   operator.hasMax && !modelHasMax;
          
            // If the operator has a value requirement (e.g. true, false, *),
            // then update the filter model value and remove the value select field.
            if(operator.values && operator.values.length){
              this.removeInput("value");
              this.model.set("values", operator.values);
            // If the operator does not have a default value, then ensure that
            // there is a value select available.
            } else {
              if(!this.valueSelect){
                this.model.set("values", view.model.defaults().values);
                this.addValueSelect();
              }
            }
          
            // Update the model with true or false for matchSubstring and exclude
            ["matchSubstring", "exclude"].forEach((prop, i) => {
              if(typeof operator[prop] !== "undefined"){
                view.model.set(prop, operator[prop]);
              } else {
                view.model.set(prop, view.model.defaults()[prop]);
              }
            });
          
            // Set min & max values as required by the operator
            // // TODO - test this strategy with dates...
          
            // Add a minimum value if one is needed
            if(needsMin){
              // Search for the min in the values, then in the max
              if( modelValueInt || modelValueInt === 0){
                this.model.set("min", modelValueInt)
              } else if (modelHasMax) {
                this.model.set("min", modelMax)
              } else {
                this.model.set("min", 0)
              }
            }
          
            // Add a maximum value if one is needed
            if(needsMax){
              // Search for the min in the values, then in the max
              if( modelValueInt || modelValueInt === 0){
                this.model.set("max", modelValueInt)
              } else if (modelHasMin) {
                this.model.set("max", modelMin)
              } else {
                this.model.set("max", 0)
              }
            }
          
            // Add a value if one is needed
            if(needsValue){
              if (modelHasMin) {
                this.model.set("values", [modelMin])
              } else if (modelHasMax) {
                this.model.set("values", [modelMax])
              } else {
                this.model.set("values", [0])
              }
            }
            // Remove the minimum and max if they should not be included in the filter
            if(modelHasMax && !operator.hasMax){
              this.model.set("max", this.model.defaults().max)
            }
            if(modelHasMin && !operator.hasMin){
              this.model.set("min", this.model.defaults().min)
            }
          
            if(isRange){
              this.model.set("range", true)
            } else {
              if(isNumeric){
                this.model.set("range", false)
              } else {
                this.model.unset("range")
              }
            }
          
            // If the operator changed for a numeric or date field,
            // reset the value select. This way it can change from a range to a
            // single value input if needed.
            if(isNumeric){
              this.removeInput("value");
              this.addValueSelect();
            }
          } catch (e) {
            console.log("Failed to handle the operator selection in a query rule view, error message: " + e);
          }
        },
        
        /**        
         * getSelectedOperator - Based on values set on the model, get the label
         * to show in the "operator" filed of the Query Rule
         *          
         * @return {string} The operator label
         */         
        getSelectedOperator: function(){
          try {
            if(this.model.get("fields")[0]=="numberReplicas"){
              var db = true
            } else {
              var db = false
            }

                // This view
            var view = this,
                // The options that we will filter down
                options = this.operatorOptions,
                // The user-facing operator label that we will return
                selectedOperator = "";
            
            // --- Filter 1 - Filter options by type --- //
            
            // Reduce list of options to only  those that apply to the current
            // filter type
            var type = view.model.get("nodeName");
            var options = _.filter(options, function(option){
                  return option.types.includes(type)
                });
            
            // --- Filter 2 - filter by 'matchSubstring', 'exclude', 'min', 'max' --- //
            
            // Create the conditions based on the model
            var conditions = _.pick(
              this.model.attributes,
              'matchSubstring', 'exclude', 'min', 'max'
            );
            
            var isNumeric = ["dateFilter", "numericFilter"].includes(type);
            
            if(!conditions.min && conditions.min !== 0 ){
              if(isNumeric){
                conditions.hasMin = false
              }
            } else if (isNumeric){
              conditions.hasMin = true
            } 
            if(!conditions.max && conditions.max !== 0 ){
              if(isNumeric){
                conditions.hasMax = false
              }
            } else if (isNumeric){
              conditions.hasMax = true
            }
            
            delete conditions.min
            delete conditions.max
            
            var options = _.where(options, conditions);
            
            // --- Filter 3 - filter based on the value --- //
            
            // Model values that determine the user-facing operator
            // eg ["*"], [true], [false]
            var specialValues = _.compact(
                                    _.pluck(this.operatorOptions, "values")
                                  ),
                specialValues = specialValues.map(val => JSON.stringify(val)),
                specialValues = _.uniq(specialValues);
            
            options = options.filter(function(option){
              var modelValsStringified = JSON.stringify(view.model.get("values"));
              if(specialValues.includes(modelValsStringified)){
                if(JSON.stringify(option.values) === modelValsStringified){
                  return true
                }
              } else {
                if(!option.values){
                  return true
                }
              }
            })
            
            // --- Filter 3 - return value --- //
            
            if(options.length === 1){
              selectedOperator = options[0].label
            }
            
            return selectedOperator
          } catch (e) {
            console.log("Failed to select an operator in the Query Rule View, error message: " + e);
          }
        },

        /**        
         * Create and insert an input field where the user can provide a
         * search value
         */
        addValueSelect: function() {
          try {
            
            // TODO:
            //  - lookahead with values that are available for each fields
            //  - other specialized types of select fields
            
            var view = this;
            
            // To help guide users to create valid queries, the type of value
            // field will vary based on the type of field (i.e. filter nodeName),
            // and the operator selected.
            
            // Some user-facing operators (e.g. "is true") don't require a value to be set
            
            var selectedOperator = _.findWhere(
              this.operatorOptions,
              { label: this.getSelectedOperator() }
            );
            if(selectedOperator){
              if(selectedOperator.values && selectedOperator.values.length){
                return
              }
            }
            
            // Use a number slider for date and number filters
            if(["dateFilter", "numericFilter"].includes(view.model.get("nodeName"))){
              view.valueSelect = new NumericFilterView({
                model: this.model,
                showButton: false
              });
              var label = $("<p class='subtle searchable-select-label'>Choose a value</p>");
            
            // Use a select input that lists the member nodes for fields that
            // require a member node ID for the value
            // TODO - identify all fields that require a node ID for value
            // right now "authoritativeMN" is being used as the test field
            } else if(view.model.get("fields")[0] === "authoritativeMN") {
              
              view.valueSelect = new NodeSelect({
                selected: this.model.get("values")
              });
            
            // In all other cases, use a regular text value entry field
            } else {
              view.valueSelect = new SearchableSelect({
                options: [],
                allowMulti: true,
                allowAdditions: true,
                inputLabel: "Type a value",
                selected: this.model.get("values")
              });
            }
            
            // Append and render the choosen value selector
            this.el.append(view.valueSelect.el);
            this.valueSelect.$el.addClass(this.valuesClass);
            view.valueSelect.render();
            if(label){
              view.valueSelect.$el.prepend(label)
            }
            
            // Update model when the values change - note that the date &
            // numeric filter views do not trigger a 'changeSelection' event,
            // (because they are not based on a SearchSelect View,)
            // but update the models directly
            this.stopListening(view.valueSelect, 'changeSelection', this.handleValueChange);
            this.listenTo(view.valueSelect, 'changeSelection', this.handleValueChange);
            
            // Set the value to the value provided if there was one. Then validateValue()
          } catch (e) {
            console.log("Error adding a search value input in the Query Rule View, error message:", e);
          }
        },
        
        /**        
         * handleValueChange - Called when the select values for rule are changed.
         * Updates the model.
         *          
         * @param  {string[]} newValues The new values that were selected
         */         
        handleValueChange: function(newValues){
          
          try {
            // TODO:
            //  - validate values first?
            //  - how to update the model when values is empty?
            this.model.set("values", newValues);
          } catch (e) {
            console.log("Failed to handle a change in select values in the Query Ryle View, error message: " + e);
          }
        },

        /**        
         * Ensure the value entered is valid, given the metadata field selected.
         * If it's not, show an error. If it is, remove the error if there was one.
         *          
         * @return {type}  description         
         */
        validateValue: function() {
         // TODO
        },

        /**        
         * Remove one of the three input fields from the rule
         *          
         * @param  {string} inputType Which of the inputs to remove? "field", "operator", or "value"
         */
        removeInput: function(inputType) {
          try {
            // TODO - what model updates should happen here?
            switch (inputType) {
              case "value":
                  if(this.valueSelect){
                    this.stopListening(this.valueSelect, 'changeSelection');
                    this.valueSelect.remove();
                    this.valueSelect = null;
                  }
                break;
              case "operator":
                if(this.operatorSelect){
                  this.stopListening(this.operatorSelect, 'changeSelection');
                  this.operatorSelect.remove();
                  this.operatorSelect = null;
                }
                break;
              case "field":
                if(this.fieldSelect){
                  this.stopListening(this.fieldSelect, 'changeSelection');
                  this.fieldSelect.remove();
                  this.fieldSelect = null;
                }
                break;
              default:
                console.log("Must specify either value, operator, or field in the removeInput function in the Query Rule View")
            }
          } catch (e) {
            console.log("Error removing an input from the Query Rule View, error message:", e);
          }
        },

        /**        
         * completeRule - Trigger a rule completed event that the parent can
         * listen to when a user has added all the information required for this
         * rule
         *          
         * @return {type}  description         
         */
        completeRule: function() {
          // TODO
          // validate
        },
        
        previewRemove: function() {
          this.$el.toggleClass(this.removePreviewClass);
        },

        /**        
         * removeSelf - When the delete button is clicked, remove this entire
         * View and associated model
         *          
         * @return {type}  description         
         */
        removeSelf: function() {
          this.model.collection.remove(this.model);
          this.remove();
        },


      });
  });
