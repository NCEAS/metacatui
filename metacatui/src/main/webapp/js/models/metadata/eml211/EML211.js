/* global define */
define(['jquery', 'underscore', 'backbone', 'models/metadata/ScienceMetadata'], 
    function($, _, Backbone, ScienceMetadata) {
        
        /*
        An EML211 object represents an Ecological Metadata Language
        document, version 2.1.1
        */
        var EML211 = ScienceMetadata.extend({

        	defaults: _.extend({
	            type: "Metadata",            
	            isEditable: false,
	            alternateIdentifier: [],
	            shortName: null,
	            title: null,
	            creator: [], // array of EMLParty objects
	            metadataProvider: [], // array of EMLParty objects
	            associatedParty : [], // array of EMLParty objects
	            pubdate: null,
	            language: null,
	            series: null,
	            abstract: [],
	            keywordset: [], // array of EMLKeyword objects
	            additionalInfo: [],
	            intellectualrights: [],
	            onlineDist: [], // array of EMLOnlineDist objects
	            offlineDist: [], // array of EMLOfflineDist objects
	            geographicCoverages : [], //an array for GeographicCoverages
	            temporalCoverages : [], //an array of TemporalCoverages
	            taxonomicClassifications : [], //an array of Taxons
	            purpose: [],
	            contact: [], // array of EMLParty objects
	            publisher: [], // array of EMLParty objects
	            pubPlace: null,
	            methods: [], // array of EMLMethods objects
	            project: [], // array of EMLProject objects
        	}),
        	
            initialize: function(options) {
                // Call initialize for the super class
               // this.constructor.__super__.initialize.apply(this, options);
                
                // EML211-specific init goes here
            	
                
            },
            
            url: function(){
            	return MetacatUI.appModel.get("objectServiceUrl") + (this.get("id") || this.get("seriesid"));
            },
            
            /* 
             Validate this EML 211 document
            */
            validate: function() {
                var valid = false;
                
                return valid;
                
            },
            
            /*
             * A proxy to Backbone.Model.fetch() so that we can pass custom options to the AJAX request
             */
         /*   _fetch: function(options){
            	
            	var fetchOptions = _.extend(options, {
            		dataType: "text"
            	});
            },
            */
            
            /* 
             Deserialize an EML 2.1.1 XML document
            */
            parse: function(response) {
            	//If the response is XML
            	if((typeof response == "string") && response.indexOf("<") == 0){
            		var responseElements = $.parseHTML(response.trim());
            		var emlElement = $(responseElements).filter("eml\\:eml");
            	}
            	
            	var datasetEl;
            	if(emlElement[0])
            		datasetEl = $(emlElement[0]).find("dataset");
            	
            	if(!datasetEl || !datasetEl.length)
            		return {};
            	
            	return this.xmlToJson(datasetEl[0]);            	
            },
            
            /* 
             Serialize the EML211 object to XML
            */
            toXML: function(){
                var xml = "";
                
                return xml;
            },
            
            /*
             Add an entity into the EML 2.1.1 object
            */
            addEntity: function(emlEntity) {
                
                return this;
            },
            /*
             Remove an entity from the EML 2.1.1 object
            */
            removeEntity: function(emlEntityId) {
                
            }
            
        });
        return EML211;
    }
    
);