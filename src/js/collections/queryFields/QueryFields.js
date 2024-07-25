define(["underscore", "backbone", "x2js", "models/queryFields/QueryField"], (
  _,
  Backbone,
  X2JS,
  QueryField,
) => {
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
   * @augments Backbone.Collection
   * @since 2.14.0
   * @class
   */
  const QueryFields = Backbone.Collection.extend(
    /** @lends QueryFields.prototype */
    {
      /**
       * The type of Backbone model that this collection comprises
       */
      model: QueryField,

      /**
       * comparator - A sortBy function that returns the order of each Query
       * Filter model based on its position in the categoriesMap object.
       * @param  {QueryFilter} model The individual Query Filter model
       * @returns {number}      A numeric value by which the model should be ordered relative to others.
       */
      comparator(model) {
        try {
          const categoriesMap = model.categoriesMap();
          const order = _(categoriesMap)
            .chain()
            .pluck("queryFields")
            .flatten()
            .value();
          return order.indexOf(model.get("name"));
        } catch {
          return 0;
        }
      },

      /**
       * The constructed URL of the collection
       * @returns {string} - The URL to use during fetch
       */
      url() {
        try {
          return MetacatUI.appModel.get("queryServiceUrl").replace(/\/\?$/, "");
        } catch (e) {
          return "https://cn.dataone.org/cn/v2/query/solr";
        }
      },

      /**
       * Retrieve the fields from the Coordinating Node
       * @param {object} options Options to pass to the fetch method
       * @augments Backbone.Collection#fetch
       * @returns {Array} The array of Query Field attributes to be added to the collection.
       */
      fetch(options) {
        const fetchOptions = _.extend({ dataType: "text" }, options);
        return Backbone.Model.prototype.fetch.call(this, fetchOptions);
      },

      /**
       * parse - Parse the XML response from the CN
       * @param  {string} response The queryEngineDescription XML as a string
       * @returns {Array}  the Array of Query Field attributes to be added to the collection.
       */
      parse(response) {
        // If the collection is already parsed, just return it
        if (typeof response === "object") {
          return response;
        }
        const x2js = new X2JS();
        const responseJSON = x2js.xml_str2json(response);
        if (responseJSON && responseJSON.queryEngineDescription) {
          return responseJSON.queryEngineDescription.queryField;
        }
        return [];
      },

      /**
       * getRequiredFilterType - Based on an array of query (Solr) field names, get the
       * type of filter model to use with these fields. For example, if the fields are
       * type text, use a regular filter model. If the fields are tdate, use a
       * dateFilter. If the field types are mixed, then returns the filterType default
       * value in QueryField models.
       * @param  {string[]} fields The list of Query Field names
       * @returns {string} The nodeName of the filter model to use (one of the four types
       * of fields that are set in {@link QueryField#filterTypesMap})
       */
      getRequiredFilterType(fields) {
        const defaultFilterType = this.model.prototype.defaults().filterType;

        const types = [];
        // When fields is empty or are different types

        if (!fields || fields.length === 0 || fields[0] === "") {
          return defaultFilterType;
        }

        fields.forEach((newField) => {
          const fieldModel = MetacatUI.queryFields.findWhere({
            name: newField,
          });
          const newType = fieldModel?.get("filterType");
          if (newType) {
            types.push(newType);
          } else {
            // TODO:
            // console.log("ERROR! No filter type found for field", newField);
          }
        });

        // Test of all the fields are of the same type
        const allEqual = types.every((val, i, arr) => val === arr[0]);

        if (allEqual) {
          return types[0];
        }
        return defaultFilterType;
      },
    },
  );
  return QueryFields;
});
