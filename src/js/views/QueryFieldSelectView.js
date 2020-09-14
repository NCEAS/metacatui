define([
    "jquery",
    "underscore",
    "backbone",
    "views/SearchableSelectView",
    "collections/QueryFields"
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
        placeholderText: "Search for or select a metadata field",
        
        /**       
         * Label for the input element
         * @type {string}        
         */ 
        inputLabel: "Select a metadata field to query",
        
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
            // Need the query fields before a rule can be rendered
            if (!MetacatUI.queryFields || MetacatUI.queryFields.length === 0) {
              MetacatUI.queryFields.on('sync', this.render, this);
              return
            }
            this.options = MetacatUI.queryFields.getCategorized();
            SearchableSelect.prototype.render.call(this);
          } catch (e) {
            console.log("Failed to render a Query Field Select View, error message: " + e);
          }
        }

      });
      return QueryFieldSelect;
  });
