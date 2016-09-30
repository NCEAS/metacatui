/* global define */
define(['jquery', 'underscore', 'backbone', 'models/metadata/ScienceMetadata'], 
    function($, _, Backbone, ScienceMetadata) {
        
        /*
        An EML211 object represents an Ecological Metadata Language
        document, version 2.1.1
        */
        var EML211 = ScienceMetadata.extend({

        	defaults: {
	            type: "Metadata",            
	            isEditable: false,
	            alternateIdentifier: [],
	            shortName: null,
	            title: null,
	            creator: [], // array of EMLParty objects
	            metadataProvider: [], // array of EMLParty objects
	            associatedParty : [], // array of EMLParty objects
	            pubDate: null,
	            language: null,
	            series: null,
	            abstract: [],
	            keywordSet: [], // array of EMLKeyword objects
	            additionalInfo: [],
	            intellectualRights: [],
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
        	},
        	
            /* 
             Validate this EML 211 document
            */
            validate: function() {
                var valid = false;
                
                return valid;
                
            },
            
            
            /* 
             Deserialize an EML 2.1.1 XML document
            */
            parse: function(document) {
                var EML211;
                
                return EML211;
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