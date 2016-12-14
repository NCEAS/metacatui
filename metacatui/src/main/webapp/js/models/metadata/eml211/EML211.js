/* global define */
define(['jquery', 'underscore', 'backbone', 
        'models/metadata/ScienceMetadata',
        'models/metadata/eml211/EMLCoverage', 
        'models/metadata/eml211/EMLDistribution', 
        'models/metadata/eml211/EMLParty', 
        'models/metadata/eml211/EMLProject'], 
    function($, _, Backbone, ScienceMetadata, EMLCoverage, EMLDistribution, EMLParty, EMLProject) {
        
        /*
        An EML211 object represents an Ecological Metadata Language
        document, version 2.1.1
        */
        var EML211 = ScienceMetadata.extend({

        type: "EML",            

        	defaults: _.extend({
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
	            pubplace: null,
	            methods: [], // array of EMLMethods objects
	            project: [], // array of EMLProject objects
	            //type: "Metadata"
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
            	if(!options)
            		var options = {};
            	
            	//Add the authorization header and other AJAX settings
            	 _.extend(options, MetacatUI.appUserModel.createAjaxSettings(), {dataType: "text"});

            	//Call Backbone.Model.fetch to retrieve the info
                return Backbone.Model.prototype.fetch.call(this, options);
                
            },
            
         /*   get: function(attr, options){
            	if(options && options.raw) return Backbone.Model.prototype.get.call(this, attr);
            	
            	var parts = attr.split("."),
            		getValue = Backbone.Model.prototype.get.call(this, parts[0]);
            	
            	var lastValue = this.parseJSONSnippet(getValue, parts);
            	
            	if(typeof lastValue == "object"){
            		var keys = Object.keys(lastValue),
            			newObject = {};
            		
            	    for(var i=0; i<keys.length; i++){
            	    	newObject[keys[i]] = this.parseJSONSnippet(lastValue[keys[i]]);
            	    }            	    
            	}
            	
            	return lastValue;
            },
            
            parseJSONSnippet: function(jsonSnippet, attr){
            	var lastValue;
            	
            	for(var i=0; i<attr.length; i++){
            		var attrPart = attr[i];
            		
            		if(i==0)
            			lastValue = Backbone.Model.prototype.get.call(this, attrPart);
            		else if(typeof lastValue[attrPart] !== "undefined")
            			lastValue = lastValue[attrPart];
            		
            		
            		if((typeof lastValue.content !== "undefined") && !Array.isArray(lastValue)){
            			lastValue = lastValue.content;
            		}
            		else if(Array.isArray(lastValue)){
            			lastValue = _.pluck(lastValue, "content");
            		}
            	}
            	
            	return lastValue;
            },*/
                        
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
            		
            	var emlParties = ["metadataprovider", "associatedparty", "creator", "contact"],
            		emlDistribution = ["distribution"],
            		emlProject = ["project"],
            		skipNodes = ["datatable"];
            		
            	var nodes = datasetEl.children(),
            		modelJSON = {},
            		skippedXML = [];
            	
            	for(var i=0; i<nodes.length; i++){
            		console.log(nodes[i]);
            		var thisNode = nodes[i];
            		
            		if(_.contains(emlParties, thisNode.localName))
            			modelJSON[thisNode.localName] = new EMLParty({ xml: thisNode });
            		else if(_.contains(emlDistribution, thisNode.localName))
            			modelJSON[thisNode.localName] = new EMLDistribution({ xml: thisNode });
            		else if(_.contains(emlProject, thisNode.localName))
            			modelJSON[thisNode.localName] = new EMLProject({ xml: thisNode });
            		else if(thisNode.localName == "coverage"){
            			modelJSON.coverage = [];
            			
            			var temporal = $(thisNode).children("temporalCoverage"),
            				geo = $(thisNode).children("geographicCoverage");
            			
            			if(temporal.length)
            				modelJSON.coverage.push(new EMLCoverage({ xml: temporal }));
            			if(geo.length)
            				modelJSON.coverage.push(new EMLCoverage({ xml: geo }));
            		}
            		else if(_.contains(skipNodes, thisNode.localName)){
            			skippedXML.push(thisNode);
            		}
            		else
            			modelJSON[thisNode.localName] = this.toJson(thisNode);
            		
            	}
            	
            	console.log(modelJSON);
            	
            	return modelJSON;           	
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