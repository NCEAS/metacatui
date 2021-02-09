define([
  "jquery", "underscore", "backbone",
  "models/filters/Filter", "models/filters/BooleanFilter", "models/filters/ChoiceFilter",
  "models/filters/DateFilter", "models/filters/NumericFilter", "models/filters/ToggleFilter",
],
  function (
    $, _, Backbone,
    Filter, BooleanFilter, ChoiceFilter,
    DateFilter, NumericFilter, ToggleFilter,
  ) {
    "use strict";

    /**
     * @class Filters
     * @classdesc A collection of Filter models that represents a full search
     * @classcategory Collections
     * @name Filters
     * @extends Backbone.Collection
    * @constructor
     */
    var Filters = Backbone.Collection.extend(
          /** @lends Filters.prototype */{

        /**
        * If the search results must always match one of the ids in the id filters,
        * then the id filters will be added to the query with an AND operator.
        * @type {boolean}
        */
        mustMatchIds: false,

        /**
        * Function executed whenever a new Filters collection is created.
        * @param {Filter|BooleanFilter|ChoiceFilter|DateFilter|NumericFilter|ToggleFilter|FilterGroup[]} models -
        * Array of filter or filter group models to add to this creation
        * @param {Object} [options] - 
        * @property {boolean} isUIFilterType - Set to true to indicate that these filters
        * or filterGroups are part of a UIFilterGroup (aka custom Portal search filter).
        * Otherwise, it's assumed that this model is in a Collection model definition.
        * @property {XMLElement} objectDOM -  A FilterGroupType or UIFilterGroupType XML
        * element from a portal or collection document. If provided, the XML will be
        * parsed and the Filters models extracted
        * @property {boolean} catalogSearch  - If set to true, a catalog search phrase
        * will be appended to the search query that limits the results to un-obsoleted
        * metadata.
        */
        initialize: function (models, options) {
          try {
            if (typeof options === "undefined") {
              var options = {};
            }
            if (options && options.objectDOM) {
              // Models are automatically added to the collection by the parse function.
              var isUIFilterType = options.isUIFilterType == true ? true : false
              this.parse(options.objectDOM, isUIFilterType);
            }
            if (options.catalogSearch) {
              this.createCatalogSearchQuery();
            }
          } catch (error) {
            console.log("Error initializing a Filters collection. Error details: " + error);
          }
        },

        /**
        * Creates the type of Filter Model based on the given filter type. This
        * function is typically not called directly. It is used by Backbone.js when adding
        * a new model to the collection.
        * @param {object} attrs - A literal object that contains the attributes to pass to the model
        * @property {string} attrs.filterType - The type of Filter to create
        * @property {XMLElement} attrs.objectDOM - The Filter XML
        * @param {object} options - A literal object of additional options to pass to the model
        * @returns {Filter|BooleanFilter|ChoiceFilter|DateFilter|NumericFilter|ToggleFilter|FilterGroup}
        */
        model: function (attrs, options) {

          // Get the model type
          var type = ""
          // If no filterType was specified, but an objectDOM exists (from parsing a
          // Collection or Portal document), get the filter type from the objectDOM
          // node name
          if (!attrs.filterType && attrs.objectDOM) {
            type = attrs.objectDOM.nodeName;
          } else if (attrs.filterType) {
            type = attrs.filterType;
          }
          // Ignoring the case of the type allows using either the
          // filter type (e.g. BooleanFilter) or the nodeName value
          // (e.g. "booleanFilter")
          type = type.toLowerCase();

          switch (type) {
            case "booleanfilter":
              return new BooleanFilter(attrs, options);

            case "datefilter":
              return new DateFilter(attrs, options);

            case "numericfilter":
              return new NumericFilter(attrs, options);

            case "filtergroup":
              // We must initialize a Filter Group using the inline require syntax to
              // avoid the problem of circular dependencies. Filters requires Filter
              // Groups, and Filter Groups require Filters. For more info, see
              // https://requirejs.org/docs/api.html#circular
              var FilterGroup = require('models/filters/FilterGroup');
              var newFilterGroup = new FilterGroup(attrs, options)
              return newFilterGroup;

            case "choicefilter":
              return new ChoiceFilter(attrs, options);

            case "togglefilter":
              return new ToggleFilter(attrs, options);

            default:
              return new Filter(attrs, options);
          }

        },

        /**
         * Parses a <filterGroup> or <definition> element from a collection or portal
         * document and sets the resulting models on this collection.
         *
         *  @param {XMLElement} objectDOM - A FilterGroupType or UIFilterGroupType XML
         *  element from a portal or collection document
         *  @param {boolean} isUIFilterType - Set to true to indicate that these filters
         *  or filterGroups are part of a UIFilterGroup (aka custom Portal search filter).
         *  Otherwise, it's assumed that the filters are part of a Collection model
         *  definition.
         *  @return {JSON} The result of the parsed XML, in JSON.
        */
        parse: function (objectDOM, isUIFilterType) {
          
          var filters = this;
          
          $(objectDOM).children().each(function (i, filterNode) {
            filters.add({
              objectDOM: filterNode,
              isUIFilterType: isUIFilterType == true ? true : false
            })
          });

          return filters.toJSON();
        },

        /**
         * Builds the query string to send to the query engine. Iterates over each filter
         * in the collection and adds to the query string.
         * 
         * @param {string} [operator=AND] The operator to use to combine multiple filters in this filter group. Must be AND or OR.
         * @return {string} The query string to send to Solr
         */
        getQuery: function (operator = "AND") {

          // The complete query string that eventually gets returned
          var completeQuery = ""

          // Ensure that the operator is AND or OR so that the query string will be valid.
          // Default to AND.
          if (typeof operator !== "string") {
            var operator = "AND";
          }
          operator = operator.toUpperCase();
          if(!["AND", "OR"].includes(operator)){
            operator = "AND"
          }

          // Adds URI encoded spaces to either side of a string
          var padString = function(string){ return "%20" + string + "%20" }

          // Get the list of filters that use id fields since these are used differently.
          var idFilters = this.getIdFilters();
          // Get the remaining filters that don't contain any ID fields
          var mainFilters = this.getNonIdFilters();

          // Create the grouped query for the id filters
          var idFilterQuery = this.getGroupQuery(idFilters, "OR");
          // Make a query for all of the filters that do not contain ID fields
          var mainQuery = this.getGroupQuery(mainFilters, operator);

          // First add the query string built from the non-ID filters
          completeQuery += mainQuery;

          // Then add the Data Catalog filters if Filters was initialized with the
          // catalogSearch = true option. Filters that are used in the data catalog are
          // treated specially
          if(this.catalogSearchQuery && this.catalogSearchQuery.length){
            // If there are other filters besides the catalog filters, AND the catalog
            // filters to the end of the query for the other filters, regardless of which
            // operator this function uses to combine other filters.
            if (completeQuery && completeQuery.trim().length) {
              completeQuery += padString("AND");
            }
            completeQuery += this.catalogSearchQuery
          }

          // Finally, add the ID filters to the very end of the query. This is done so
          // that the query string is constructed with these filters "OR"ed into the
          // query. For example, a query might be to look for datasets by a certain
          // scientist OR with the given id. If those filters were ANDed together, the
          // search would essentially ignore the creator filter and only return the
          // dataset with the matching id.
          if(idFilterQuery && idFilterQuery.length){
            if (completeQuery && completeQuery.trim().length) {
              // If the search results must always match one of the ids in the id filters,
              // then add the id filters to the query with the AND operator. This flag
              // is set on this Collection. Otherwise, use the OR operator
              var idOperator = this.mustMatchIds ? padString("AND") : padString("OR");
              completeQuery = "(" + completeQuery + ")" + idOperator + idFilterQuery;
            } else {
              // If the query is ONLY made of id filters, then the id filter query is the
              // complete query
              completeQuery += idFilterQuery
            }
          }

          // Return the completed query
          return completeQuery;

        },
        
        /**
         * Searches the Filter models in this collection and returns any that have at
         * least one field that matches any of the ID query fields, such as by id, seriesId, or the isPartOf relationship.
         * @returns {Filter|BooleanFilter|ChoiceFilter|DateFilter|NumericFilter|ToggleFilter|FilterGroup[]}
         * Returns an array of filter models that include at least one ID field
         */
        getIdFilters: function(){
          try {
            var idFields = MetacatUI.appModel.get("queryIdentifierFields");
            var idFilters = this.filter(function (filter) {
              var fields = filter.get("fields")
              // FilterGroup will not return anything for fields
              if( !fields ) { return false }
              // Match if any of the filter fields are one of the ID fields
              return ( _.some( idFields, function(idField) {
                return fields.includes(idField)
              }));
            });
            return idFilters
          } catch (error) {
            console.log("Error trying to find ID Filters, error details: " + error);
          }
        },

        /**
         * Searches the Filter models in this collection and returns all have no fields
         * matching any of the ID query fields.
         * @returns {Filter|BooleanFilter|ChoiceFilter|DateFilter|NumericFilter|ToggleFilter|FilterGroup[]}
         * Returns an array of filter models that do not include any ID fields
         */
        getNonIdFilters: function(){
          try {
            return this.difference(this.getIdFilters());
          } catch (error) {
            console.log("Error trying to find non-ID Filters, error details: " + error);
          }
        },

        /**
        * Get a query string for a group of Filters.
        * The Filters will be ANDed together, unless a different operator is given.
        * @param {Filter|BooleanFilter|ChoiceFilter|DateFilter|NumericFilter|ToggleFilter|FilterGroup[]} filterModels - The Filters to turn into a query string
        * @param {string} [operator="AND"] - The operator to use between filter models
        * @return {string} The query string
        */
        getGroupQuery: function (filterModels, operator="AND") {

          try {
            if(!filterModels || !filterModels.length || !this.getNonEmptyFilters(filterModels)){
              return ""
            }
            //Start an array to contain the query fragments
            var groupQueryFragments = [];
  
            //For each Filter in this group, get the query string
            _.each(filterModels, function (filterModel) {
              //Get the Solr query string from this model
              var filterQuery = filterModel.getQuery();
              //Add the filter query string to the overall array
              if (filterQuery && filterQuery.length > 0) {
                groupQueryFragments.push(filterQuery);
              }
            }, this);
            
            //Join this group's query fragments with an OR operator
            if (groupQueryFragments.length) {
              return "(" + groupQueryFragments.join("%20" + operator + "%20") + ")"
            }
            //Otherwise, return an empty string
            else {
              return "";
            }
          } catch (error) {
            console.log("Error creating a group query, returning a blank string. " +
              " Error details: " + error);
            return ""
          }

        },

        /**
         * Given a Solr field name, determines if that field is set as a filter option
         */
        filterIsAvailable: function (field) {

          var matchingFilter = this.find(function (filterModel) {
            return _.contains(filterModel.fields, field);
          });

          if (matchingFilter) {
            return true;
          } else {
            return false;
          }
        },

        /*
         * Returns an array of filter models in this collection that have a value set
         *
         * @return {Array} - an array of filter models in this collection that have a value set
         */
        getCurrentFilters: function () {
          var currentFilters = new Array();

          this.each(function (filterModel) {
            //If the filter model has values set differently than the default AND it is
            // not an invisible filter, then add it to the current filters array
            if (!filterModel.get("isInvisible") &&
              ((Array.isArray(filterModel.get("values")) && filterModel.get("values").length &&
                _.difference(filterModel.get("values"), filterModel.defaults().values).length) ||
                (!Array.isArray(filterModel.get("values")) && filterModel.get("values") !== filterModel.defaults().values))
            ) {
              currentFilters.push(filterModel);
            }
          });

          return currentFilters;
        },

        /*
         * Clear the values of all geohash-related models in the collection
         */
        resetGeohash: function () {
          //Find all the filters in this collection that are related to geohashes
          this.each(function (filterModel) {
            if (!filterModel.get("isInvisible") &&
              (filterModel.type == "SpatialFilter" ||
                _.intersection(filterModel.fields, ["geohashes", "geohashLevel", "geohashGroups"]).length)) {
              filterModel.resetValue();
            }
          });
        },

        /**
         * Create a partial query string that's required for catalog searches and save it
         * to the Filters collection, to be used when building a full query
         */
        createCatalogSearchQuery: function(){
          var catalogFilters = new Filters([
            {
              fields: ["obsoletedBy"],
              values: ["*"],
              exclude: true
            },
            {
              fields: ["formatType"],
              values: ["METADATA"],
              matchSubstring: false
            }]);
          var query = catalogFilters.getGroupQuery(catalogFilters.models, "AND");
          this.catalogSearchQuery = query;
        },

        /**
        * Creates and adds a Filter to this collection that filters datasets
        * to only those that the logged-in user has permission to change permission of.
        */
        addOwnershipFilter: function () {

          if (MetacatUI.appUserModel.get("loggedIn")) {
            //Filter datasets by their ownership
            this.add({
              fields: ["rightsHolder", "changePermission"],
              values: MetacatUI.appUserModel.get("allIdentitiesAndGroups"),
              operator: "OR",
              fieldsOperator: "OR",
              matchSubstring: false,
              exclude: false
            });
          }

        },

        /**
        * Creates and adds a Filter to this collection that filters datasets
        * to only those that the logged-in user has permission to write to.
        */
        addWritePermissionFilter: function () {

          if (MetacatUI.appUserModel.get("loggedIn")) {
            //Filter datasets by their ownership
            this.add({
              fields: ["rightsHolder", "writePermission", "changePermission"],
              values: MetacatUI.appUserModel.get("allIdentitiesAndGroups"),
              operator: "OR",
              fieldsOperator: "OR",
              matchSubstring: false,
              exclude: false
            });
          }

        },

        /**
        * Removes Filter models from this collection if they match the given field
        * @param {string} field - The field whose matching filters that should be removed from this collection
        */
        removeFiltersByField: function (field) {

          var toRemove = [];

          this.each(function (filter) {
            if (filter.get("fields").includes(field)) {
              toRemove.push(filter);
            }
          });

          this.remove(toRemove);

        },

        /**            
         * removeEmptyFilters - Remove filters from the collection that are
         * lacking fields, values, and in the case of a numeric filter,
         * a min and max value.        
         */
        removeEmptyFilters: function () {
          try {
            var toRemove = this.difference(this.getNonEmptyFilters());
            this.remove(toRemove);
          } catch (error) {
            console.log("Error removing empty Filter models from a Filters collection. " +
              "Error details: " + error
            );
          }
        },

        /**            
         * getNonEmptyFilters - Returns the array of filters that are not empty
         * @return {Filter|BooleanFilter|ChoiceFilter|DateFilter|NumericFilter|ToggleFilter|FilterGroup[]}
         * returns an array of Filter or FilterGroup models that are not empty
         */
        getNonEmptyFilters: function(){
          try {
            return this.filter(function(filterModel){
              return !filterModel.isEmpty();
            });
          } catch (e) {
            console.log("Failed to remove empty Filter models from the Filters collection, error message: " + e);
          }
        },

        /**            
         * replaceModel - Remove a Filter from the Filters collection
         * silently, and replace it with a new model.
         *              
         * @param  {Filter} model    The model to replace
         * @param  {object} newAttrs Attributes for the replacement model. Use the filterType attribute to replace with a different type of Filter.
         * @return {Filter}          Returns the replacement Filter model, which is already part of the Filters collection.
         */
        replaceModel: function (model, newAttrs) {
          try {
            var index = this.indexOf(model),
              oldModelId = model.cid;
            var newModel = this.add(
              newAttrs,
              { at: index }
            );
            this.remove(oldModelId, { silent: true });
            return newModel;
          } catch (e) {
            console.log("Failed to replace a Filter model in a Filters collection, error message: " + e);
          }
        },

        /**            
         * visibleIndexOf - Get the index of a given model, excluding any
         * filters that are marked as invisible.
         *              
         * @param  {Filter|BooleanFilter|NumericFilter|DateFilter} model The filter model for which to get the visible index
         * @return {number} An integer representing the filter model's position in the list of visible filters.
         */
        visibleIndexOf: function (model) {
          try {
            // Don't count invisible filters in the index we display to the user
            var visibleFilters = this.filter(function (filterModel) {
              var isInvisible = filterModel.get("isInvisible");
              return typeof isInvisible == "undefined" || isInvisible === false
            });
            return _.indexOf(visibleFilters, model);
          } catch (e) {
            console.log("Failed to get the index of a Filter within the collection of visible Filters, error message: " + e);
          }
        },

        /*
        hasGeohashFilter: function() {

            var currentFilters = this.getCurrentFilters();
            var geohashFilter = _.find(currentFilters, function(filterModel){
                return (_.intersection(filterModel.get("fields"),
                    ["geohashes", "geohash"]).length > 0);
            });

            if(geohashFilter) {
                return true;
            } else {
                return false;
            }
        }
        */
      });
    return Filters;
  });
