define([
    "jquery",
    "underscore",
    "backbone",
    "collections/QueryFields",
    "models/filters/Filter",
    "models/filters/DateFilter",
    // TODO: All the other filter models... ?
  ],
  function($, _, Backbone, QueryFields, Filter, DateFilter) {

    /**
     * @class QueryRule
     * @classdesc A view that provides an interface for a user to construct a complex search on DataONE
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
        className: "query-builder",
        
        /**
        * A filter model that stores one filter that's part of a Filters
        * definition for a collection or portal
        * @type {Filter} 
        */
        model: undefined,
        
        /**
        * If true, this view represents a new QueryRule that is not yet complete
        * @type {boolean}
        */
        isNew: false,
        
        // /**
        //  * The primary HTML template for this view
        //  * @type {Underscore.template}
        //  */
        // template: _.template(Template),

        /**
         * The events this view will listen to and the associated function to call.
         * @type {Object}
         */
        events: {
          // "action selector": "functionName"
          "blur .metadata-input" : "addOperatorSelector",
          "blur .operator-input" : "handleOperatorSelection",
          "click .remove-rule"   : "removeSelf",
          "blur .value-input"    : "validateValue"
        },

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
            if(!this.model || typeof this.model === 'undefined'){
              // TODO: Which properties to set?
              this.model = new Filter()
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
            // Insert the template into the view
            // this.$el.html(this.template());
            
            // TODO:
            // How to handle multiple fields already set in models?
            // How to handle multiple values already set in models - write AND between them?
            
            // Metadata Selector field
            // Add an empty input in the case when this rule is new
            var selectedField = ""
            if(this.model && this.model.get("fields")){
              // For now just take the first one....
              if(this.model.get("fields").length){
                selectedField = this.model.get("fields")[0]
              }
            }
            this.addMetadataSelector(selectedField)
            
            // Operator field
            
            // Value field
            
            return this;

          } catch (e) {
            console.log("Error rendering the query Rule View, error message: ", e);
          }
        },
        
        /**        
         * Create and insert an input field that allows the user to select
         * a metadata field
         * 
         * @param {string} field - If rendering a rule that's already built, the value that was selected for the metadata field
         */         
        addMetadataSelector: function(field){
          try {
            // Create lookahead with all the metadata fields, and description of those fields as tooltips
            var metadataSelector = document.createElement("INPUT");
            
            if(field){
              metadataSelector.setAttribute("value", field)
            }
            this.$el.append(metadataSelector);
          } catch (e) {
            console.log("Error adding a metadata selector input in the query builder, error message:", e);
          }
        },
        
        /**             
         * handleOperatorSelection - Depending on the type of operator selected,
         * either trigger a 'completed rule' event, or insert a value input
         *          
         * @param  {Object} event the event when a user has finished selecting an operator
         */         
        handleOperatorSelection: function(event){
          try {
            // If the operator selected doesn't require a corresponding value
            // (e.g. "is empty", "is true", "is not empty"), then trigger a
            // completed rule
            // 
            // this.completeRule();
            // 
            // Otherwise, if a value is required, insert a value input field
            // 
            // this.addValueInput();
          } catch (e) {
            console.log("Error handling the operator selection in a query builder, error message: ", e);
          }
        },
        
        /**        
         * Create and insert an input field where the user can select an operator
         * for the given rule. Operators will vary depending on type of rule.
         * 
         * @param {string} operator - If rendering a rule that's already built, the value that was selected for the operator input
         */              
        addOperatorSelector: function(operator){
          try {
            // Check which type of rule this is (boolean, numeric, text, date)
            // Provide a list of options based on the rule type (switch)
            // 
            // Pre-select the operator provided if there was one, and if the operator is valid
          } catch (e) {
            console.log("Error adding an operator selector input in the query builder, error message:", e);
          }
        },
        
        /**        
         * Create and insert an input field where the user can provide a
         * search value
         * 
         * @param {string|number} value - If rendering a rule that's already built, the number or string that was provided for the value input
         */         
        addValueInput: function(value){
          try {
            // Check which type of rule this is (boolean, numeric, text, date)
            // Provide a list of options based on the rule type (switch)
            // 
            // Set the value to the value provided if there was one. Then validateValue()
          } catch (e) {
            console.log("Error adding a search value input in the query builder, error message:", e);
          }
        },
        
        /**        
         * Ensure the value entered is valid, given the metadata field selected.
         * If it's not, show an error. If it is, remove the error if there was one.
         *          
         * @return {type}  description         
         */         
        validateValue: function(){
          
        },
        
        /**        
         * Remove one of the three input fields from the rule
         *          
         * @param  {string} input Which of the inputs to remove? "metadata", "operator", or "value"
         */         
        removeInput: function(input){
          try {
            // Remove the input (switch)
          } catch (e) {
            console.log("Error adding a search value input in the query builder, error message:", e);
          }
        },
        
        /**        
         * completeRule - Trigger a rule completed event that the parent can
         * listen to when a user has added all the information required for this
         * rule
         *          
         * @return {type}  description         
         */         
        completeRule: function(){
          // Validate first - here?
        },
        
        /**        
         * removeSelf - When the delete button is clicked, remove this entire
         * View and trigger an event (so that the parent can remove
         * corresponding filter from the collection)
         *          
         * @return {type}  description         
         */         
        removeSelf: function(){
          
        },
        

      });
  });
