/* global define */
define(
  ["jquery", "underscore", "backbone", "x2js", "models/queryFields/QueryField"],
  function($, _, Backbone, X2JS, QueryField) {
    "use strict";

    /**
     * @class QueryFields
     * @classdesc The collection of queryable fields supported by the the
     * DataONE Solr index, as provided by the DataONE API
     * CNRead.getQueryEngineDescription() function. For more information, see:
     * https://indexer-documentation.readthedocs.io/en/latest/generated/solr_schema.html
     * https://dataone-architecture-documentation.readthedocs.io/en/latest/design/SearchMetadata.html
     * @classcategory Collections/QueryFields
     * @name QueryFields
     * @extends Backbone.Collection
     * @since 2.14.0
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
         * comparator - A sortBy function that returns the order of each Query
         * Filter model based on its position in the categoriesMap object.
         *
         * @param  {QueryFilter} model The individual Query Filter model
         * @return {number}      A numeric value by which the model should be ordered relative to others.
         */
        comparator: function(model){
          try {
            var categoriesMap = model.categoriesMap();
            var order = _(categoriesMap)
              .chain()
              .pluck("queryFields")
              .flatten()
              .value();
            return order.indexOf(model.get("name"));
          } catch (e) {
            console.log("Failed to sort the Query Fields Collection, error message: " + e);
            return 0
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
        }

      });
    return QueryFields;
  });
