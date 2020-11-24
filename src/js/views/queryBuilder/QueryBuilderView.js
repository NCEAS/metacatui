define(["jquery",
    "underscore",
    "backbone",
    "collections/Filters",
    "collections/queryFields/QueryFields",
    "views/queryBuilder/QueryRuleView",
    "text!templates/queryBuilder/queryBuilder.html",
    "collections/queryFields/QueryFields",
  ],
  function($, _, Backbone, Filters, QueryFields, QueryRule, Template, QueryFields) {

    /**
     * @class QueryBuilder
     * @classdesc A view that provides a UI for users to construct a complex
     * search through the DataONE Solr index
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
         * An array of hex color codes used to help distinguish between different rules
         * @type {string[]}    
         */     
        ruleColorPalette: ["#44AA99", "#137733", "#c9a538", "#CC6677", "#882355", "#AA4499","#332288"],
        
        /**        
         * Search index fields to exclude in the metadata field selector of each query rule        
         * @type {string[]}
         */         
        excludeFields: [],
        
        /**
        * A Filters collection that stores definition filters for a collection (or portal)
        * @type {Filters} 
        */
        collection: undefined,

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
          try {
            var events = {};
            var addRuleAction = "click " + this.addRuleButtonSelector;
            events[addRuleAction] = "addQueryRule"
            return events
          } catch (e) {
            console.log("Failed to specify events for  the Query Builder View, error message: " + e);
          }
        },
        
        /**
         * The list of QueryRuleViews that are contained within this queryBuilder
         * @type {QueryRuleView[]}        
         */         
        rules: [],

        /**
         * Creates a new QueryBuilderView
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
            
            // If no filters collection is provided in the options, then set a
            // new Filters collection
            if(!this.collection || typeof this.collection === 'undefined'){
              // TODO: Which properties to set?
              this.collection = new Filters()
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
            
            // Ensure the query fields are cached for the Query Field Select
            // View and the Query Rule View
            if ( typeof MetacatUI.queryFields === "undefined" || MetacatUI.queryFields.length === 0) {
              MetacatUI.queryFields = new QueryFields();
              this.listenToOnce(MetacatUI.queryFields, "sync", this.render)
              MetacatUI.queryFields.fetch();
              return
            }
            
            // Insert the template into the view
            this.$el.html(this.template());
            
            // Add a row for each rule that exists already in the model
            if(this.collection && this.collection.models && this.collection.models.length){
              this.collection.models.forEach(function(model){
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
          
          try {
            
            var view = this;
            
            // Ensure that the object passed to this function is a filter.
            // When the "add rule" button is clicked, the Event object is passed
            // to this function instead.
            if(!filterModel || (filterModel && !/filter/i.test(filterModel.type))){
              filterModel = this.collection.add({
                nodeName: "filter",
                operator: "OR"
              });
            }
            
            // Don't show invisible rules
            if(filterModel.get("isInvisible")){
              return
            }
            
            // If no filter model is provided, assume that this is a new rule
            // insert QueryRuleView
            var rule = new QueryRule({
              model: filterModel,
              ruleColorPalette: this.ruleColorPalette,
              excludeFields: this.excludeFields
            });
            
            // Insert and render the rule
            this.$(this.rulesContainerSelector).append(rule.el);
            rule.render();
            // Add the rule to the list of rule sub-views
            this.rules.push(rule);
            
            
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
            // Remove rule collection
          } catch (e) {
            console.log("Error removing a query rule, error message:", e);
          }
        },
        

      });
  });
