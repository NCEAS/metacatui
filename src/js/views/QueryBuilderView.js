define(["jquery",
    "underscore",
    "backbone",
    "collections/Filters",
    "views/QueryRuleView",
    "text!templates/queryBuilder.html", 'collections/ObjectFormats', "collections/QueryFields",
  ],
  function($, _, Backbone, Filters, QueryRule, Template,  ObjectFormats, QueryFields) {

    /**
     * @class QueryBuilder
     * @classdesc A view that provides an interface for a user to construct a complex search on DataONE
     * @extends Backbone.View
     * @constructor
     */
    return Backbone.View.extend(
      /** @lends QueryBuilderView.prototype */
      {
        
        /**
        * The type of View this is
        * @type {string}
        */
        type: "QueryBuilderView",

        /**
         * The HTML class names for this view element
         * @type {string}
         */
        className: "query-builder",
        
        /**
         * A jquery selector for the element in the template that will contain
         * the query rules
         * @type {string}
         */
        rulesContainerSelector: ".rules-container",
        
        
        /**
         * A jquery selector for the element in the template that a user should click to
         * add a new rule
         * @type {string}
         */        
        addRuleButtonSelector: ".add-rule",
        
        /**
        * A Filters collection that stores definition filters for a collection (or portal)
        * @type {Filters} 
        */
        model: undefined,

        /**
         * The primary HTML template for this view
         * @type {Underscore.template}
         */
        template: _.template(Template),

        
        /**        
         * events - A function that specifies a set of DOM events that will be
         * bound to methods on your View through Backbone.delegateEvents.
         * See: https://backbonejs.org/#View-events
         *          
         * @return {Object}  The events hash
         */         
        events: function(){
          var events = {};
          var addRuleAction = "click " + this.addRuleButtonSelector;
          events[addRuleAction] = "addQueryRule"
          return events
        },
        
        /**
         * The list of QueryRuleViews that are contained within this queryBuilder
         * @type {[QueryRule]}        
         */         
        rules: [],

        /**
         * Creates a new QueryBuilderView
         * @param {Object} options - A literal object with options to pass to the view
         */
        initialize: function(options) {
          
          try {
            
            // Ensure the query fields are cached for the Query Rule View to use
            if ( typeof MetacatUI.queryFields === "undefined" ) {
              MetacatUI.queryFields = new QueryFields();
              MetacatUI.queryFields.fetch();
            }
            
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
              this.model = new Filters()
            }

          } catch (e) {
            console.log("Failed to initialize the query builder view, error message:", e);
          }
        },

        /**        
         * render - Render the view
         *          
         * @return {QueryBuilder}  Returns the view
         */
        render: function() {
          try {
            // Insert the template into the view
            this.$el.html(this.template());
            
            // Add a row for each rule that exists already in the model
            if(this.model && this.model.models && this.model.models.length){
              this.model.models.forEach(function(model){
                this.addQueryRule(model)
              }, this);
            }
            // Render a new query rule at the end
            this.addQueryRule();
            
            return this;

          } catch (e) {
            console.log("Failed to render a Query Builder view, error message: ", e);
          }
        },
        
        /**        
         * Appends a new row (query rule view) to the end of the query builder
         *
         * @param {Filter} filterModel The filter model for which to create a rule for
         */         
        addQueryRule: function(filterModel){
          
          // Ensure that the object passed to this function is a filter.
          // When the "add rule" button is clicked, the Event object is passed
          // to this function.
          if(filterModel && !/filter/i.test(filterModel.type)){
            filterModel = null
          }
          
          try {
            // If no filter model is provided, assume that this is a new rule
            // insert QueryRuleView
            var rule = new QueryRule({
              model: filterModel,
              isNew: filterModel ? false : true
            });
            // Insert and render the rule
            this.$(this.rulesContainerSelector).append(rule.el);
            rule.render();
            // Add the rule to the list of rule sub-views
            this.rules.push(rule)
            
            // TODO: add listener for when this rule is complete, changed, or deleted?
            
          } catch (e) {
            console.log("Error adding a query rule, error message:", e);
          }
        },
        
        /**        
         * Removes a query rule from the list of rules
         *          
         * @param  {QueryRule} rule The query rule to remove
         */  
        removeQueryRule: function(rule){
          try {
            // TODO
            // Remove rule from the view
            // Remove rule from the parent model
          } catch (e) {
            console.log("Error removing a query rule, error message:", e);
          }
        },
        

      });
  });
