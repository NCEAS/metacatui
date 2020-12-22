/* global define */
define(['jquery', 'underscore', 'backbone', 'models/DataONEObject'],
    function($, _, Backbone, DataONEObject){

        /**
        @class ScienceMetadata
         @classdesc ScienceMetadata represents a generic science metadata document.
         It's properties are limited to those shared across subclasses,
         such as the those found in the DataONE search index.
         TODO: incorporate Backbone.UniqueModel
         * @classcategory Models/Metadata
         * @extends DataONEObject
        */
        var ScienceMetadata = DataONEObject.extend(
          /** @lends ScienceMetadata.prototype */{

            // Only add fields present in the Solr service to the defaults
        	defaults: function(){ return _.extend(DataONEObject.prototype.defaults(), {
	            abstract: [],
	            attribute: [],
	            attributeDescription: [],
	            attributeLabel: [],
	            attributeName: [],
	            attributeUnit: [],
	            author: null,
	            authorGivenName: null,
	            authoritativeMN: null,
	            authorLastName: [],
	            authorSurName: null,
	            beginDate: null,
	            changePermission: [],
	            contactOrganization: [],
	            datasource: null,
	            dataUrl: null,
	            dateModified: null,
	            datePublished: null,
	            dateUploaded: null,
	            decade: null,
	            edition: null,
	            endDate: null,
	            fileID: null,
	            formatType: "METADATA",
	            gcmdKeyword: [],
	            investigator: [],
	            isDocumentedBy: [],
	            isPublic: null,
	            keyConcept: [],
	            keywords: [],
	            mediaType: null,
	            mediaTypeProperty: [],
	            origin: [],
	            originator: [],
	            placeKey: [],
	            presentationCat: null,
	            project: null,
	            pubDate: null,
	            purpose: null,
	            readPermission: [],
	            relatedOrganizations: [],
	            replicaMN: [],
	            sensor: [],
	            sensorText: [],
	            source: [],
	            scientificName: [],
                title: [],
                type: "Metadata",
	            species: [],
	            genus: [],
	            family: [],
	            class: [],
	            phylum: [],
	            order: [],
	            kingdom: [],
	            westBoundCoord: null,
	            eastBoundCoord: null,
	            northBoundCoord: null,
	            southBoundCoord: null,
	            site: [],
	            namedLocation: [],
	            noBoundingBox: null,
	            geoform: null,
	            isSpatial: null,
              sortOrder: 1,
	            geohash_1: [],
	            geohash_2: [],
	            geohash_3: [],
	            geohash_4: [],
	            geohash_5: [],
	            geohash_6: [],
	            geohash_7: [],
	            geohash_8: [],
	            geohash_9: [],
	            sem_annotated_by: [],
	            sem_annotates: [],
	            sem_annotation: [],
	            sem_comment: []
        	}) },

	        type: "ScienceMetadata",

	        nodeNameMap: function(){ return this.constructor.__super__.nodeNameMap(); },

            /* Initialize a ScienceMetadata object */
            initialize: function(attributes) {
                // Call initialize for the super class
            	 DataONEObject.prototype.initialize.call(this, attributes);


                // ScienceMetadata-specific init goes here
                 this.listenTo(MetacatUI.rootDataPackage.packageModel, "change:changed", function(){
                 	if(MetacatUI.rootDataPackage.packageModel.get("changed"))
                 		this.set("uploadStatus", "q");
                 });

            },

            /* Construct the Solr query URL to be called */
            url: function() {

                // Build the URL to include default fields in ScienceMetadata
                var fieldList = "*",//Object.keys(this.defaults),
                    lastField = _.last(fieldList),
                    searchFields = "",
                    query = "q=",
                    queryOptions = "&wt=json&fl=",
                    url = "";

                // Make a list of the search fields
                _.each(fieldList, function(value, key, list) {
                    if ( value === lastField ) {
                        searchFields += value;

                    } else {
                        searchFields += value;
                        searchFields += ",";

                    }
                });

                queryOptions += searchFields;
                query += 'id:"' + encodeURIComponent(this.get("id")) + '"';

                url = MetacatUI.appModel.get("queryServiceUrl") + query + queryOptions;
                return url;

            },

            /* Fetch the ScienceMetadata from the MN Solr service */
            fetch: function(options) {
            	if(!options)
            		var options = {};

            	//Add the authorization options
            	_.extend(options, MetacatUI.appUserModel.createAjaxSettings());

            	//Call Backbone.Model.fetch to retrieve the info
                return Backbone.Model.prototype.fetch.call(this, options);

            },


	        /*
	         * Updates the relationships with other models when this model has been updated
	         */
	        updateRelationships: function(){
	        	_.each(this.get("collections"), function(collection){
	        		//Get the old id for this model
	        		var oldId = this.get("oldPid");

	        		if(!oldId) return;

	        		//Find references to the old id in the documents relationship
	        		var	outdatedModels = collection.filter(function(m){
	        				return _.contains(m.get("isDocumentedBy"), oldId);
	        			});

	        		//Update the documents array in each model
	        		_.each(outdatedModels, function(model){
		        		var updatedDocumentedBy = _.without(model.get("isDocumentedBy"), oldId);
		        		updatedDocumentedBy.push(this.get("id"));

		        		model.set("isDocumentedBy", updatedDocumentedBy);
	        		}, this);

	        	}, this);

            //Update the documents relationship
            if( _.contains(this.get("documents"), this.get("oldPid")) ){
              var updatedDocuments = _.without(this.get("documents"), this.get("oldPid"));

              this.set("documents", updatedDocuments);
            }
	        }
        });
        return ScienceMetadata;
    }
);
