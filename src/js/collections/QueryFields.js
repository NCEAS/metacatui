/* global define */
define(
  ["jquery", "underscore", "backbone", "x2js", "models/QueryField"],
  function($, _, Backbone, X2JS, QueryField) {
    "use strict";

    /**
     * @class QueryFields
     * @classdesc The collection of queryable fields supported by the the
     * DataONE Solr index, as provided by the DataONE API
     * CNRead.getQueryEngineDescription() function. For more information, see:
     * https://indexer-documentation.readthedocs.io/en/latest/generated/solr_schema.html
     * https://dataone-architecture-documentation.readthedocs.io/en/latest/design/SearchMetadata.html
     * @name QueryFields
     * @extends Backbone.Collection
     * @constructor
     */
    var QueryFields = Backbone.Collection.extend(
      /** @lends QueryFields.prototype */
      {
        
        /**        
         * The type of Backbone model that this collection comprises
         */         
        model: QueryField,
        
        /**        
         * Assigns a readable label and Font Awesome 3.2.1 icon to each query field type
         * @type {Collection}        
         * @property {string} label - A human readable label to use to categorize query field types
         * @property {string} icon - The name of a Font Awesome 3.2.1 icon to represent the field type
         * @property {string[]} queryTypes - An array of the possible query field types, as named in the QueryField models, that belong in the given category
         */         
        categories: new Backbone.Collection([
          {
            label: "Text",
            icon: "font",
            queryTypes: ["string", "alphaOnlySort", "text_en_splitting", "text_en_splitting_tight", "text_general", "text_case_insensitive"],
          },
          {
            label: "Boolean",
            icon: "asterisk",
            queryTypes: ["boolean"],
          },
          {
            label: "Numeric",
            icon: "list-ol",
            queryTypes: ["int", "tfloat", "tlong"],
          },
          {
            label: "Date",
            icon: "calendar",
            queryTypes: ["tdate"],
          }
        ]),
        
        /**        
         * initialize - Creates a new QueryFields collection
         */         
        initialize: function(models, options) {
          try {
            if (typeof options === "undefined") {
              var options = {};
            }
          } catch (e) {
            console.log("Failed to initialize a Query Fields collection, error message: " + e);
          }
        },
        
        /**
         * The constructed URL of the collection
         * 
         * @returns {string} - The URL to use during fetch
         */
        url: function() {
          try {
            return MetacatUI.appModel.get("queryServiceUrl").replace(/\/\?$/, "");
          } catch (e) {
            return "https://cn.dataone.org/cn/v2/query/solr"
          }
        },
        
        /**
        * Retrieve the fields from the Coordinating Node
        * @extends Backbone.Collection#fetch
        */
        fetch: function(options) {
          try {
            var fetchOptions = _.extend({dataType: "text"}, options);
            return Backbone.Model.prototype.fetch.call(this, fetchOptions);
          } catch (e) {
            console.log("Failed to fetch Query Fields, error message: " + e);
          }
        },
        
        /**        
         * parse - Parse the XML response from the CN
         *          
         * @param  {string} response The queryEngineDescription XML as a string
         * @return {Array}  the Array of Query Field attributes to be added to the collection.
         */         
        parse: function(response) {
          try {
            // If the collection is already parsed, just return it
            if ( typeof response === "object" ){
              return response;
            }
            var x2js = new X2JS();
            var responseJSON = x2js.xml_str2json(response);
            if(responseJSON && responseJSON.queryEngineDescription){
              return responseJSON.queryEngineDescription.queryField;
            }
          } catch (e) {
            console.log("Failed to parse Query Fields response, error message: " + e);
          }
        },
        
        /**        
         * getCategorized - Sorts the query fields by the more general field
         * types specified in the QueryFields.categories attribute. Optionally
         * filters out fields which are not searchable, fields which are not
         * returnable, as well as additional specifiable fields. Returns the
         * categorized fields formatted for the 
         * (or SearchableSelectView)
         * {@link SearchableSelect#options}
         *          
         * @param  {boolean} excludeNonSearchable = true  Set to false to keep query fields that are not seachable in the returned list   
         * @param  {boolean} excludeNonReturnable = true  Set to false to keep query fields that are not returnable in the returned list          
         * @param  {[string]} excludeFields = []    A list of query fields to exclude from the returned list       
         * @return {Object}         Returns the query fields grouped by general field type, formatted for the QueryFieldSelectView {@link SearchableSelect#options}
         */         
        getCategorized: function(excludeNonSearchable = true, excludeNonReturnable = false, excludeFields = []){
          
          try {
            if(!this.categories){
              console.log("A categories attribute must be set on the Query " +
                    "Fields collection in order to return categorized fields");
              return
            }
            
            var collection = this,
                options = {};
            
            this.categories.each(function(category){
              
              options[category.get("label")] = [];
              
              _.each(category.get("queryTypes"), function(queryType){
                var filterBy = {
                  type: queryType
                }
                if(excludeNonSearchable){
                  filterBy["searchable"] = "true"
                }
                if(excludeNonReturnable){
                  filterBy["returnable"] = "true"
                }
                var matchingFields = collection.filter(filterBy)
                
                _.each(matchingFields, function(field){
                  if(!excludeFields.includes(field.get("name"))){
                    options[category.get("label")].push({
                      label: field.get("name"),
                      description: field.get("description"),
                      icon: category.get("icon")
                    })
                  }
                }, this);
                
              });
              
            }, this);
            
            return options;
          } catch (e) {
            console.log("Failed to categorize query fields, error message: " + e);
          }
        }
        
      });
    return QueryFields;
  });
