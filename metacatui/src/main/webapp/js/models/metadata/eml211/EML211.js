/* global define */
define(['jquery', 'underscore', 'backbone', 'models/metadata/ScienceMetadata'], 
    function($, _, Backbone, ScienceMetadata) {
        
        /*
        An EML211 object represents an Ecological Metadata Language
        document, version 2.1.1
        */
        var EML211 = ScienceMetadata.extend({

            type: "EML",            

        	defaults: _.extend({
	            isEditable: false,
	            alternateidentifier: [],
	            shortname: null,
	            title: null,
	            creator: [], // array of EMLParty objects
	            metadataprovider: [], // array of EMLParty objects
	            associatedparty : [], // array of EMLParty objects
	            pubdate: null,
	            language: null,
	            series: null,
	            abstract: [],
	            keywordset: [], // array of EMLKeyword objects
	            additionalinfo: [],
	            intellectualrights: [],
	            onlinedist: [], // array of EMLOnlineDist objects
	            offlinedist: [], // array of EMLOfflineDist objects
	            geographiccoverages : [], //an array for GeographicCoverages
	            temporalcoverages : [], //an array of TemporalCoverages
	            taxonomicclassifications : [], //an array of Taxons
	            purpose: [],
	            contact: [], // array of EMLParty objects
	            publisher: [], // array of EMLParty objects
	            pubplace: null,
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
            
            /* Fetch the EML from the MN object service */
            fetch: function(options) {
            	//Add the authorization options 
            	fetchOptions = _.extend(options, MetacatUI.appUserModel.createAjaxSettings());

            	//Add other AJAX options
                fetchOptions = _.extend({dataType: "text"}, fetchOptions);
                
            	//Call Backbone.Model.fetch to retrieve the info
                return Backbone.Model.prototype.fetch.call(this, fetchOptions);
                
            },
            
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
            	
            	return this.toJson(datasetEl[0]);            	
            },
            
            serialize: function(){
            	var eml = '<eml:eml xmlns:eml="eml://ecoinformatics.org/eml-2.1.1"' +
            			'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"' + 
            			'xmlns:ds="eml://ecoinformatics.org/dataset-2.1.1"' + 
            			'xmlns:stmml="http://www.xml-cml.org/schema/stmml-1.1"' +
            			'packageId="' + this.get("id") + '"' + 
            			'system="' + MetacatUI.appModel.get("baseUrl") + '"' +
            			'xsi:schemaLocation="eml://ecoinformatics.org/eml-2.1.1 eml.xsd">';
            
	           //Get the attributes for EML only
	           var emlAttr = ["title", "creator", "alternateidentifier", "metadataprovider", "associatedparty",
	                          "contact", "pubdate", "abstract", "coverage", "project", "intellectualrights", 
	                          "distribution"],
	               model = this;
	           
	           //Start the dataset node
	           var dataset = document.createElement("dataset");
	           
	           //Get the JSON version of the model and pick out only the EML relevant attributes
	           var modelJSON = this.toJSON();
	           modelJSON = _.pick(modelJSON, emlAttr);
	           
	           console.log(this.toXML(modelJSON, dataset));
	          	           
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