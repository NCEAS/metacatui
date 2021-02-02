define([
    "jquery", "underscore", "backbone",
    "models/filters/Filter", "models/filters/BooleanFilter", "models/filters/ChoiceFilter",
    "models/filters/DateFilter", "models/filters/NumericFilter", "models/filters/ToggleFilter",
  ],
    function(
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
            * Is executed when a new Filters collection is created
            */
            initialize: function(models, options) {

                if (typeof options === "undefined") {
                    var options = {};
                }

                if (options && options.objectDOM) {
                  // Models are automatically added to the collection by the parse function.
                  this.parse(options.objectDOM);
                }

                if (options.catalogSearch) {
                  this.createCatalogFilters();
                }
            },

            /**
            * Creates the type of Filter Model based on the given filter type. This
            * function is typically not called directly. It is used by Backbone.js when adding
            * a new model to the collection.
            * @param {object} attrs - A literal object that contains the attributes to pass to the model
            * @property {string} attrs.filterType - The type of Filter to create
            * @property {string} attrs.objectDOM - The Filter XML
            * @param {object} options - A literal object of additional options to pass to the model
            * @returns {Filter|BooleanFilter|ChoiceFilter|DateFilter|NumericFilter|ToggleFilter|FilterGroup}
            */
            model: function(attrs, options){

              // Get the model type
              var type = ""
              // If no filterType was specified, but an objectDOM exists (from parsing a
              // Collection or Portal document), get the filter type from the objectDOM
              // node name
              if(!attrs.filterType && attrs.objectDOM){
                type = attrs.objectDOM.nodeName;
              } else if( attrs.filterType ) {
                type = attrs.filterType;
              }
              // Ignoring the case of the type allows using either the
              // filter type (e.g. BooleanFilter) or the nodeName value
              // (e.g. "booleanFilter")
              type = type.toLowerCase();

              switch( type ){
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
                  var x = new FilterGroup(attrs, options)
                  return x;

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
             * document
             *
             *  @param {XMLElement} objectDOM - A FilterGroupType or UIFilterGroupType XML
             *  element from a portal or collection document
             *  @return {JSON} The result of the parsed XML, in JSON. To be set directly
             *  on the model.
            */
            parse: function(objectDOM){

              var filters = this;

              // TODO
              // inFilterGroup: true

              $(objectDOM).children().each(function(i, filterNode){
                filters.add({
                  objectDOM: filterNode
                })
              });

              return filters.toJSON();
            },

            /**
             * Builds the query string to send to the query engine. Iterates over each filter
             * in the collection and adds to the query string.
             *
             * @return {string} The query string to send to Solr
             */
            getQuery: function() {

              //Create an array to store all the query pieces
              var allGroupsQueryFragments = [],
                  //The complete query string that eventually gets returned
                  completeQuery = "",
                  // Get the list of filters that use the 'id', 'seriesId', or
                  // 'identifier' field, since these are used differently
                  idFilters = this.filter(function(filter){
                    return (
                      filter.get("fields").includes("id") ||
                      filter.get("fields").includes("identifier") ||
                      filter.get("fields").includes("seriesId")
                    );
                  }),
                  otherFilters = this.difference(idFilters),
                  //Separate the filter models in this collection by their query group.
                  groupedFilters = _.groupBy(otherFilters, function(m){
                    return m.get("queryGroup");
                  });

              //Filters that are used in the data catalog are treated specially
              var catalogFilters = groupedFilters.catalog;
              delete groupedFilters.catalog;

              //Create a query string for each group of filters
              _.mapObject(groupedFilters, function(filterModels, groupName) {

                //Get a query string for this group of Filters
                var groupQuery = this.getGroupQuery(filterModels);

                //If there is a query string, add it to the array
                if( groupQuery ){
                  allGroupsQueryFragments.push(groupQuery);
                }

              }, this);

              //Join the query fragments with an OR. By default, Filter model groups are ORed together
              if( allGroupsQueryFragments.length ){
                completeQuery += "(" + allGroupsQueryFragments.join("%20OR%20") + ")";
              }

              //Add the Data Catalog filters, if there are any
              if( Array.isArray(catalogFilters) && catalogFilters.length ){

                //If there are other filters besides the catalog filters, AND them
                if( completeQuery.trim().length ){
                  completeQuery += "%20AND%20";
                }

                //Get the query string for the catalog filters
                completeQuery += this.getGroupQuery(catalogFilters);
              }

              //Create the grouped query for the id filters
              var idFilterQuery = this.getGroupQuery(idFilters, "OR");

              //Add the grouped query for the id filters
              if( completeQuery.length && idFilterQuery.length ){

                //If the search results must always match one of the ids in the id filters,
                // then add the id filters to the query with the AND operator. This flag
                // is set on this Collection.
                if( this.mustMatchIds ){
                  completeQuery = "(" + completeQuery + ")%20AND%20" + idFilterQuery;
                }
                //Otherwise, use the OR operator
                else{
                  completeQuery = "(" + completeQuery + ")%20OR%20" + idFilterQuery;
                }
              }
              //If the query is ONLY made of id filters, then the id filter query is the complete query
              else if( !completeQuery.length && idFilterQuery.length ){
                completeQuery = idFilterQuery;
              }

              //Return the completed query
              return completeQuery;

            },

            /**
            * Get a query string for a group of Filters.
            * The Filters will be ANDed together, unless a different operator is given.
            * @param {Filter[]} filterModels - The Filters to turn into a query string
            * @param {string} [operator] - The oeprator to use between filter models
            * @return {string} The query string
            */
            getGroupQuery: function(filterModels, operator){

              //Default to the AND operator
              if(typeof operator != "string"){
                var operator = "AND";
              }

              //Start an array to contian the query fragments
              var groupQueryFragments = [];

              //For each Filter in this group, get the query string
              _.each(filterModels, function(filterModel){

                //Get the Solr query string from this model
                var filterQuery = filterModel.getQuery();

                //Add the filter query string to the overall array
                if ( filterQuery && filterQuery.length > 0 ) {
                  groupQueryFragments.push(filterQuery);
                }
              }, this);

              //Join this group's query fragments with an OR operator
              if( groupQueryFragments.length ){
                return "(" + groupQueryFragments.join("%20" + operator + "%20") + ")"
              }
              //Otherwise, return an empty string
              else{
                return "";
              }

            },

            /**
             * Given a Solr field name, determines if that field is set as a filter option
             */
            filterIsAvailable: function(field) {
                var matchingFilter = this.find(function(filterModel) {
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
            getCurrentFilters: function() {
                var currentFilters = new Array();

                this.each(function(filterModel) {
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
            resetGeohash: function() {
                //Find all the filters in this collection that are related to geohashes
                this.each(function(filterModel) {
                    if (!filterModel.get("isInvisible") &&
                        ( filterModel.type == "SpatialFilter" ||
                          _.intersection(filterModel.fields, ["geohashes", "geohashLevel", "geohashGroups"]).length )) {
                        filterModel.resetValue();
                    }
                });
            },

            /*
             * Creates and adds FilterModels to this collection that are standard filters
             * to be sent with every Data Catalog query.
             */
            createCatalogFilters: function() {

                //Exclude obsoleted objects from the search
                this.add(new Filter({
                    fields: ["obsoletedBy"],
                    values: ["*"],
                    exclude: true,
                    isInvisible: true,
                    queryGroup: "catalog"
                }));

                //Only search for metadata objects
                this.add(new Filter({
                    fields: ["formatType"],
                    values: ["METADATA"],
                    matchSubstring: false,
                    isInvisible: true,
                    queryGroup: "catalog"
                }));
            },

            /**
            * Creates and adds a Filter to this collection that filters datasets
            * to only those that the logged-in user has permission to change permission of.
            */
            addOwnershipFilter: function(){

              if( MetacatUI.appUserModel.get("loggedIn") ){
                //Filter datasets by their ownership
                this.add({
                  fields: ["rightsHolder", "changePermission"],
                  values: MetacatUI.appUserModel.get("allIdentitiesAndGroups"),
                  operator: "OR",
                  matchSubstring: false,
                  exclude: false
                });
              }

            },

            /**
            * Creates and adds a Filter to this collection that filters datasets
            * to only those that the logged-in user has permission to write to.
            */
            addWritePermissionFilter: function(){

              if( MetacatUI.appUserModel.get("loggedIn") ){
                //Filter datasets by their ownership
                this.add({
                  fields: ["rightsHolder", "writePermission", "changePermission"],
                  values: MetacatUI.appUserModel.get("allIdentitiesAndGroups"),
                  operator: "OR",
                  matchSubstring: false,
                  exclude: false
                });
              }

            },

            /**
            * Removes Filter models from this collection if they match the given field
            * @param {string} field - The field whose matching filters that should be removed from this collection
            */
            removeFiltersByField: function(field){

              var toRemove = [];

              this.each(function(filter){
                if(filter.get("fields").includes(field)){
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
            removeEmptyFilters: function(){
              
              try {
                var toRemove = [];
                
                var noneEmpty = this.every(function(filter){ return !filter.isEmpty() });
                if(noneEmpty){
                  return
                }
                
                this.each(function(filter){
                  if(filter){
                    if(filter.isEmpty()){
                      toRemove.push(filter);
                    }
                  }
                });

                this.remove(toRemove);
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
            replaceModel: function(model, newAttrs){
              try {
                var index = this.indexOf(model),
                    oldModelId = model.cid;
                var newModel = this.add(
                  newAttrs,
                  { at: index }
                );
                this.remove(oldModelId, {silent:true});
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
            visibleIndexOf: function(model){
              try {
                // Don't count invisible filters in the index we display to the user
                var visibleFilters = this.filter(function(filterModel){
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
