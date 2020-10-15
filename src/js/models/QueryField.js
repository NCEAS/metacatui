/* global define */
define(
  ['jquery', 'underscore', 'backbone'],
  function($, _, Backbone) {
    "use strict";

    /**
     * @class QueryField
     * @classdesc A QueryField is one of the fields supported by the the DataONE
     * Solr index, as provided by the DataONE API
     * CNRead.getQueryEngineDescription() function. For more information, see:
     * https://indexer-documentation.readthedocs.io/en/latest/generated/solr_schema.html
     * https://dataone-architecture-documentation.readthedocs.io/en/latest/design/SearchMetadata.html
     * @name QueryField
     * @extends Backbone.Model
     */
    var QueryField = Backbone.Model.extend({
      /** @lends QueryField */
      
      /**
       * Overrides the default Backbone.Model.defaults() function to
       * specify default attributes for the query fields model
       * 
       * @return {object}
       */
      defaults: function() {
        return {
          name: null,
          type: null,
          searchable: null,
          returnable: null,
          sortable: null,
          multivalued: null,
          filterType: "filter",
          category: null,
          categoryOrder: null,
          icon: null,
          label: null,
        };
      },
      
      
      /**      
       * initialize - When a new query field is created, set the label, category,
       * and filterType attributes   
       */       
      initialize: function(attrs, options){
        
        // Set a human-readable label
        var label = this.getReadableName();
        if(label){
          this.set("label", label);
        }
        
        // Set a category and icon
        var category = this.getCategory();
        if (category){
          if(category.icon){
            this.set("icon", category.icon);
          }
          if(category.label){
            this.set("category", category.label);
          }
          if(category.index || category.index === 0){
            this.set("categoryOrder", category.index);
          }
        }
      
        // Set a filter type
        var filterType = this.getFilterType();
        if (filterType){
          this.set("filterType", filterType)
        }
        
      },
      
      /**      
       * aliases - Returns a map that matches query field names (key) to a more
       * human readable alias (value).
       *        
       * @return {object}  A map of field names as keys and aliases (string) as values.
       */       
      aliases: function(){
        return {
          abstract: "Abstract",
          author: "First Author Full Name",
          authorGivenNameSort: "First Author First Name",
          authorLastName: "All Author Last Names",
          authorSurNameSort: "First Author Last Name",
          beginDate: "Year of Data Collection",
          blockedReplicationMN: "Blocked Replication Repository",
          changePermission: "Is Owner",
          contactOrganizationText: "Creator Organization Names",
          datasource: "Original Member Repository",
          dateModified: "Date Technical Details Last Modified",
          datePublished: "Date Published",
          dateUploaded: "Date Last Updated",
          documents: "Identifier - Data Object",
          eastBoundCoord: "Eastern Most Longitude",
          endDate: "Year of Data Collection",
          formatId: "Metadata Format",
          funderIdentifier: "Funder Id",
          fundingText: "Funding Description",
          identifier: "Identifier",
          investigatorText: "Creator People Names",
          isPartOf: "Added to This Portal Manually",
          isPublic: "Publicly Available Datasets",
          isService: "Data Available via Service",
          northBoundCoord: "Northern Most Latitude",
          numberReplicas: "Number of Replicas",
          originText: "Creator Full Names and Organization Names",
          placeKey: "Place Keyword",
          preferredReplicationMN: "Preferred Replication Repository",
          projectText: "Project",
          pubDate: "Date Published",
          readPermission: "Can View",
          replicaMN: "Replica Repository",
          replicationAllowed: "Datasets Available for Replication",
          replicaVerifiedDate: "Date of Replication",
          resourceMap: "Identifier - Resource Map",
          rightsHolder: "Is Owner",
          sem_annotated_by: "Annotated By",
          sem_annotates: "Annotates",
          sem_annotation: "Semantic Annotation",
          sem_comment: "Comment",
          seriesId: "Series Id",
          serviceCoupling: "Data Service Coupling",
          serviceDescription: "Data Service Description",
          serviceEndpoint: "Data Service Endpoint",
          serviceOutput: "Data Service Output",
          serviceTitle: "Data Service Title",
          serviceType: "Data Service Type",
          size: "File Size",
          southBoundCoord: "Southern Most Latitude",
          submitter: "Submitter Username",
          text: "All Search Fields",
          westBoundCoord: "Western Most Longitude",
          writePermission: "Can Edit"
        }
      },
      
      /**             
       * filterTypesMap -  Returns a map that matches every type of query field
       * available in the index to the appropriate filter to use
       * @return {object}  Returns an object where the keys are the nodenames of
       *  the filters to use and the values are an array of the associated query types. 
       *  The query types in the array must exactly match the query types in the
       *  type attribute of a query field model.
       */
      filterTypesMap: function(){
        return {
          filter  : ["string", "alphaOnlySort", "text_en_splitting", "text_en_splitting_tight", "text_general", "text_case_insensitive"],
          booleanFilter : ["boolean"],
          numericFilter : ["int", "tfloat", "tlong", "long"],
          dateFilter : ["tdate"]
        }
      },
      
      /**
       * @typedef {Object} CategoryMap - An object that defines a single category for each field.
       * In addition to a label and icon property, each CategoryMap should have a queryTypes
       * property OR a a queryFields property, not both.
       * @property {string} label - A human readable label to use as a general category for groups of query fields
       * @property {string} icon - The name of a Font Awesome 3.2.1 icon to represent the field type
       * @property {string[]} queryTypes - An array of the possible query field types, as named in the type attribute, that belong in the given category. If a queryType array is provided, the queryFields array will be ignored.
       * @property {string[]} queryFields - As an alternative to grouping fields by type, they may also be grouped by field name. Use this property instead of queryTypes to list fields by their name attribute.
       */
      /**      
       * categoriesMap - Returns an array of objects that can be used to
       * add a general category and icon to a query field model. Each object
       * in the array comprises a label (string)
       *        
       * @return {CategoryMap[]}  Returns an array of objects that define how to categorize fields.
       */       
      categoriesMap: function(){
        return [
          {
            label: "General",
            icon: "list-ul",
            queryFields: [
              "abstract", "text", "isPartOf", "keywordsText", "seriesId",
              "title", "purpose"
            ],
          },
          {
            label: "People & organizations",
            icon: "group",
            queryFields: [
              "author", "authorGivenNameSort", "authorLastName",
              "authorSurNameSort", "contactOrganization",
              "contactOrganizationText", "investigator", "investigatorText",
              "originator", "originatorText", "submitter", "originText",
            ],
          },
          {
            label: "Geography",
            icon: "globe",
            queryFields: [
              "westBoundCoord", "geoform", "eastBoundCoord", "namedLocation",
              "northBoundCoord", "placeKey", "site", "southBoundCoord",
            ],
          },
          {
            label: "Dates",
            icon: "calendar",
            queryFields: [
              "dateModified", "dateUploaded", "beginDate", "endDate", "pubDate",
            ],
          },
          {
            label: "Taxon",
            icon: "sitemap",
            queryFields: [
              "scientificName", "kingdom", "phylum", "class", "order", "family",
              "genus", "species"
            ],
          },
          {
            label: "Awards & funding",
            icon: "certificate",
            queryFields: [
              "projectText", "awardNumber", "awardTitle", "funderIdentifier",
              "funderName", "fundingText",
            ],
          },
          {
            label: "Repository information",
            icon: "archive",
            queryFields: [
              "authoritativeMN", "datasource"
            ],
          },
          {
            label: "Permissions",
            icon: "lock",
            queryFields: [
              "writePermission", "readPermission", "changePermission",
              "rightsHolder", "isPublic",
            ],
          },
          {
            label: "Identifier",
            icon: "tag",
            queryFields: [
              "documents", "resourceMap", "identifier",
            ],
          },
          {
            label: "Data attributes",
            icon: "table",
            queryFields: [
              "sem_annotation", "attribute", "attributeDescription",
              "attributeLabel", "attributeName", "attributeUnit",
            ],
          },
          {
            label: "File details",
            icon: "file",
            queryFields: [ 
              "fileName", "formatId", "size",
            ],
          },
          {
            label: "DataONE replication",
            icon: "copy",
            queryFields: [
              "replicationStatus", "blockedReplicationMN",
              "preferredReplicationMN", "replicaMN", "replicaVerifiedDate",
              "replicationAllowed", "numberReplicas",
            ]
          },
          {
            label: "Advanced",
            icon: "code",
            queryFields: [
              "serviceCoupling", "serviceDescription", "serviceEndpoint",
              "serviceOutput","serviceTitle","serviceType","isService",
            ]
          },
          // {
          //   label: "True or False Fields",
          //   icon: "asterisk",
          //   queryTypes: ["boolean"]
          // },
          // {
          //   label: "Numeric",
          //   icon: "list-ol",
          //   queryTypes: ["int", "tfloat", "tlong", "long"]
          // },
          // {
          //   label: "Text",
          //   icon: "font",
          //   queryTypes: [
          //     "string", "alphaOnlySort", "text_en_splitting",
          //     "text_en_splitting_tight", "text_general", "text_case_insensitive"
          //   ]
          // },
        ]
      },
      
      /**      
       * getReadableName - Creates and returns a more human-friendly label for the field
       *        
       * @return {string}  A humanized alias for the field
       */       
      getReadableName: function(){
        
        try {
          var name  =  this.get("name"),
              alias =  this.aliases()[name];
          
          // First see if there's an alias
          if(alias){
            return alias;
          }
          
          // Otherwise, humanize the camel-cased field
          return name
            // Replace "MN" at the end of a name with "Repository"
            .replace(/MN$/, "Repository")
            // Replace underscores with spaces
            .replace(/_/g, ' ')
            // Insert a space before all caps
            .replace(/([A-Z])/g, ' $1')
            // Remove white space from both ends (e.g. when converting _root_)
            .trim()
            // Uppercase the first character
            .replace(/^./, function(str){ return str.toUpperCase(); })
          
        } catch (e) {
          console.log("Failed to create a readable name for a Query Field, error message: " + e);
        }
      },
      
      /**      
       * getCategory - Finds the matching category for this field based on the 
       * categoriesMap. The function will first check for a matching field name,
       * and if not found, will match by field type.
       *        
       * @return {object}  returns an object with an icon and category property (both strings)
       */       
      getCategory: function(){
        try {
          
          var categoriesMap = this.categoriesMap(),
              fieldType = this.get("type"),
              fieldName = this.get("name"),
              match = null,
              category = {};
            
            // First check for a matching field name.
            match = _.find(categoriesMap, function(category){
              if(category.queryFields){
                return category.queryFields.includes(fieldName);
              }
            });
            
            // If a matching field name wasn't found, then match by field type.
            if(!match){
              match = _.find(categoriesMap, function(category){
                if(category.queryTypes){
                  return category.queryTypes.includes(fieldType);
                }
              });
            }
            
            if(match){
              match.index = _.indexOf(categoriesMap, match);
            }
            
            return match
          
        } catch (e) {
          console.log("Failed to categorize a Query Field, error message: " + e);
        }
      },
      
      
      /**      
       * getFilterType - Searches the filterTypesMap and returns the filter type
       * that is required for this query field
       *        
       * @return {string}  The nodeName of the filter that should be used for this query field
       */       
      getFilterType: function(){
        try {
          var filterMap = this.filterTypesMap(),
              fieldType = this.get("type"),
              filterType = null;
          
          for (const [key, value] of Object.entries(filterMap)) {
            if (value.includes(fieldType)){
              filterType = key
            }
          }
          
          return filterType;
          
        } catch (e) {
          console.log("Failed to find a matching filter type for a Query Field, error message: " + e);
        }
      },
      
      /**      
       * isType - Checks if this field is a certian type
       *        
       * @param  {string} type the solr field type
       * @return {boolean}     returns true of the field exactly matches
       */       
      isType: function(type){
        try {
          return this.get('type') === type
        } catch (e) {
          console.log("Failed to check if query field is a type, error message: " + e);
        }
      },

      /**    
       * Overwrites the Backbone save function because query fields are read only
       *      
       * @return {boolean}  always returns false
       */
      save: function() {
        return false;
      }

    });

    return QueryField;
  });
