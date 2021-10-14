define(["jquery",
    "underscore",
    "backbone",
    "collections/Filters",
    "collections/queryFields/QueryFields",
    "views/searchSelect/SearchableSelectView",
    "views/queryBuilder/QueryRuleView",
    "text!templates/queryBuilder/queryBuilder.html"
  ],
  function($, _, Backbone, Filters, QueryFields, SearchableSelect, QueryRule, Template) {

    /**
     * @class QueryBuilderView
     * @classdesc A view that provides a UI for users to construct a complex search
     * through the DataONE Solr index
     * @classcategory Views/QueryBuilder
     * @screenshot views/QueryBuilderView.png
     * @extends Backbone.View
     * @constructor
     * @since 2.14.0
     */
    var QueryBuilderView = Backbone.View.extend(
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
         * A JQuery selector for the element in the template that will contain the query
         * rules
         * @type {string}
         */
        rulesContainerSelector: ".rules-container",

        /**
         * An ID for the element in the template that a user should click to add a new
         * rule. A unique ID will be appended to this ID, and the ID will be added to the
         * template.
         * @type {string}
         * @since 2.17.0
         */
        addRuleButtonID: "add-rule-",

        /**
         * An ID for the element in the template that a user should click to add a new
         * rule group. A unique ID will be appended to this ID, and the ID will be added
         * to the template.
         * @type {string}
         * @since 2.17.0
         */
        addRuleGroupButtonID: "add-rule-group-",

        /**
         * A JQuery selector for the element in the template that will contain the input
         * allowing a user to switch the exclude attribute from "include" to "exclude"
         * (i.e. to switch between exclude:false and exclude:true in the filterGroup
         * model.)
         * @type {string}
         * @since 2.17.0
         */
        excludeInputSelector: ".exclude-input",

        /**
         * A JQuery selector for the element in the template that will contain the input
         * allowing a user to switch the operator from "all" to "any" (i.e. to switch
         * between operator:"AND" and exclude:"OR" in the filterGroup model.)
         * @type {string}
         * @since 2.17.0
         */
        operatorInputSelector: ".operator-input",

        /**
         * The maximum number of levels nested Rule Groups (i.e. nested FilterGroup
         * models) that a user is permitted to *build* in the Query Builder. If a
         * Portal/Collection document is loaded into the Query Builder that has more than
         * the maximum allowable nested levels, those levels will still be displayed. This
         * only prevents the "Add Rule Group" button from being shown.
         * @type {number}
         * @since 2.17.0
         */
        nestedLevelsAllowed: 1,

        /**
         * An array of hex color codes used to help distinguish between different rules
         * @type {string[]}
         */
        ruleColorPalette: ["#44AA99", "#137733", "#c9a538", "#CC6677", "#882355",
          "#AA4499","#332288"
        ],

        /**
         * Query fields to exclude in the metadata field selector of each Query Rule. This
         * is a list of field names that exist in the query service index (i.e. Solr), but
         * which should be hidden in the Query Builder
         * @type {string[]}
         */
        excludeFields: [],

        /**        
         * Query fields to exclude in the metadata field selector for any Query Rules that
         * are in nested Query Builders (i.e. in nested Filter Groups). This is a list of
         * field names that exist in the query service index (i.e. Solr), but which should
         * be hidden in nested Query Builders
         * @type {string[]}
         */
        nestedExcludeFields: [],

        /**
         * Query fields that do not exist in the query service index, but which we would
         * like to show as options in the Query Builder field input.
         * 
         * @type {SpecialField[]}
         *
         * @since 2.15.0
         */
        specialFields: [],

        /**
        * A Filters collection that stores filters to be edited with this Query Builder,
        * e.g. the definitionFilters in a Collection or Portal model. If a filterGroup is
        * set, then collection doesn't necessarily need to be set, as the Filters
        * collection from within the FilterGroup model will automatically be set on view.
        * @type {Filters}
        */
        collection: null,

        /**
        * The FilterGroup model that stores the filters, the exclude attribute, and the
        * group operator to be edited with this Query Builder. This does not need to be
        * set; just a Filters collection can be set on the view instead, but then there
        * will be no input to switch between the include & exclude and any & all, since
        * these are the exclude and operator attributes on the filterGroup model.
        * @type {FilterGroup}
        * @since 2.17.0
        */
        filterGroup: null,

        /**
         * The primary HTML template for this view
         * @type {Underscore.template}
         */
        template: _.template(Template),

        /**
         * events - A function that specifies a set of DOM events that will be bound to
         * methods on your View through Backbone.delegateEvents.
         * @see {@link https://backbonejs.org/#View-events}
         *
         * @return {Object}  The events hash
         */
        events: function(){
          try {
            var events = {};
            var addRuleAction = "click #" + this.addRuleButtonID + this.cid;
            events[addRuleAction] = "addQueryRule"
            var addRuleGroupAction = "click #" + this.addRuleGroupButtonID + this.cid;
            events[addRuleGroupAction] = "addQueryRuleGroup"
            return events
          } catch (e) {
            console.error("Failed to specify events for  the Query Builder View," +
              " error message: " + e);
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

            // If neither a Filters collection nor a FilterGroup model is provided in the
            // options for this view, then create a new FilterGroup model and set it on
            // the view.
            if(!this.collection && !this.filterGroup){
              this.filterGroup = new FilterGroup()
            }

            // If there is a FilterGroup model set, but no Filters collection, then use
            // the Filters from within the FilterGroup model as the Filters collection.
            if(!this.collection && this.filterGroup){
              this.collection = this.filterGroup.get("filters")
            }

          } catch (e) {
            console.error(
              "Failed to initialize the Query Builder view, error message:", e
            );
          }
        },

        /**
         * render - Render the view
         *
         * @return {QueryBuilder}  Returns the view
         */
        render: function() {

          try {

            // Ensure the query fields are cached for the Query Field Select View and the
            // Query Rule View
            if (
              typeof MetacatUI.queryFields === "undefined" ||
              MetacatUI.queryFields.length === 0
            ) {
              MetacatUI.queryFields = new QueryFields();
              this.listenToOnce(MetacatUI.queryFields, "sync", this.render)
              MetacatUI.queryFields.fetch();
              return
            }

            // Insert the template into the view
            this.$el.html(this.template({
              addRuleButtonID: this.addRuleButtonID + this.cid,
              addRuleGroupButtonID: this.addRuleGroupButtonID + this.cid,
            }));

            // Nested Query Builders are used to display nested filterGroup models.
            // They need to be styled slightly different from the parent Query Builder.
            if(this.parentRule){
              this.$el.addClass("nested")
            }

            // Remove the rule group button ID if no more nested Query Builders are
            // allowed.
            if(
              typeof this.nestedLevelsAllowed == "number" &&
              this.nestedLevelsAllowed < 1
            ){
              this.$el.find("#" + this.addRuleGroupButtonID + this.cid).remove()
            };

            // Save the rules container element to the view before we add any nested
            // QueryBuilders (nested FilterGroups), since their rules container uses the
            // same selector.
            this.rulesContainer = this.$el.find(this.rulesContainerSelector);

            // If there is a FilterGroup model set on this view (not just a Filters
            // collection) then render the inputs that allow a user to edit the "exclude"
            // and "operator" attributes
            if(this.filterGroup){
              this.renderExcludeOperatorInputs();
            }

            // Add a row for each rule that exists already in the model
            if(
              this.collection && this.collection.models &&
              this.collection.models.length
            ){
              this.collection.models.forEach(function(model){
                this.addQueryRule(model)
              }, this);
            }
            // Render a new Query Rule at the end
            this.addQueryRule();

            return this;

          } catch (e) {
            console.error("Failed to render a Query Builder view, error message: ", e);
          }
        },
        
        /**
         * Insert two inputs: one that allows the user to edit the "exclude" attribute in
         * the FilterGroup model by selecting either "include" or "exclude"; and a second
         * that allows the user to edit the "operator" attribute in the FilterGroup model
         * by selecting between "all" and "any".
         * @since 2.17.0
         */
        renderExcludeOperatorInputs: function(){

          try {

            if(!this.filterGroup){
              console.log("A filterGroup model is required to edit the exclude and " +
                "operator attributes in a Query Builder View.");
              return
            }

            // Select the elements in the template where the two inputs should be inserted
            var excludeContainer = this.$el.find(this.excludeInputSelector);
            var operatorContainer = this.$el.find(this.operatorInputSelector);
            // Create the exclude input
            var excludeInput = new SearchableSelect({
              options: [
                { label: "Include",
                  value: "false",
                  description: "Include all datasets with metadata that matches the rules" +
                    " that are set below."
                },
                { label: "Exclude",
                  value: "true",
                  description: "Match any dataset except those with metadata that match" +
                    " the rules that are set below"
                }
              ],
              allowMulti: false,
              allowAdditions: false,
              inputLabel: "",
              selected: [this.filterGroup.get("exclude").toString()],
              clearable: false,
            });
            // Create the operator input
            var operatorInput = new SearchableSelect({
              options: [
                { label: "all",
                  value: "AND",
                  description: "For a dataset to match, it must have metadata that " +
                    "matches every rule set below."
                },
                { label: "any",
                  value: "OR",
                  description: "For a dataset to match, its metadata only needs to " +
                  "match one of the rules set below."
                }
              ],
              allowMulti: false,
              allowAdditions: false,
              inputLabel: "",
              selected: [this.filterGroup.get("operator")],
              clearable: false,
            })
            // Update the FilterGroup model when the user changes the operator or exclude
            // options. newValues will always be an Array, but since these inputs don't
            // allow multiple selections (allowMulti: false), then there will only ever be
            // one value.
            this.stopListening(excludeInput)
            this.listenTo(excludeInput, "changeSelection", function(newValues){
              // Convert the string (necessary to be used as a value in SearchableSelect)
              // to a boolean. It should be "true" or "false".
              var newExclude = newValues[0] == "true";
              this.filterGroup.set("exclude", newExclude);
            });
            this.stopListening(operatorInput)
            this.listenTo(operatorInput, "changeSelection", function(newValues){
              this.filterGroup.set("operator", newValues[0]);
            });
            // Render the inputs and insert them into the view. Replace the default text
            // within the containers otherwise.
            excludeContainer.html(excludeInput.render().el);
            operatorContainer.html(operatorInput.render().el);
          } catch (error) {
            console.log("There was a problem rendering the exclude and operator " +
            "inputs in a QueryBuilderView, error details: " + error);
          }
        },

        /**
         * Appends a new row (Query Rule View) to the end of the Query Builder
         *
         * @param {Filter|FilterGroup} filterModel The Filter model or FilterGroup model
         * for which to create a rule. If none is provided, then a Filter group model
         * will be created and added to the collection.
         */
        addQueryRule: function(filterModel){
          try {

            // Ensure that the object passed to this function is a filter. When the "add
            // rule" button is clicked, the Event object is passed to this function
            // instead. If no filter model is provided, assume that this is a new rule
            if(!filterModel || (filterModel && !/filter/i.test(filterModel.type))){
              filterModel = this.collection.add({
                nodeName: "filter",
                operator: "OR",
                fieldsOperator: "OR"
              });
            }

            // Don't show invisible rules
            if(filterModel.get("isInvisible")){
              return
            }

            // insert QueryRuleView
            var rule = new QueryRule({
              model: filterModel,
              ruleColorPalette: this.ruleColorPalette,
              excludeFields: this.excludeFields,
              nestedExcludeFields: this.nestedExcludeFields,
              specialFields: this.specialFields,
              parentRule: this.parentRule,
              nestedLevelsAllowed: this.nestedLevelsAllowed,
            });

            // Insert and render the rule
            this.rulesContainer.append(rule.el);
            rule.render();
            // Add the rule to the list of rule sub-views
            // TODO: is this really needed? are they removed when rule removed?
            this.rules.push(rule);

          } catch (e) {
            console.error("Error adding a Query Rule, error message:", e);
          }
        },

        /**
         * Exactly the same as {@link QueryBuilderView#addQueryRule}, except that if no
         * model is provided to this function, then a FilterGroup model will be created
         * instead of a Filter model.
         * @param  {FilterGroup} filterGroupModel
         */
        addQueryRuleGroup: function(filterGroupModel){
          try {
            // Ensure that the object passed to this function is a filter. When the "add
            // rule" button is clicked, the Event object is passed to this function
            // instead. If no filter model is provided, assume that this is a new rule
            if(!filterGroupModel || (filterGroupModel && filterGroupModel.type != "FilterGroup")){
              filterGroupModel = this.collection.add({
                filterType: "FilterGroup",
              });
            };
            this.addQueryRule(filterGroupModel)
          } catch (error) {
            console.log("Error adding a Query Rule Group in a Query Builder View. " +
            "Error details: " + error);
          }
        },

      });
      return QueryBuilderView;
  });
