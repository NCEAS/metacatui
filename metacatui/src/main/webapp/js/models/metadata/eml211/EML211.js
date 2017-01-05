﻿/* global define */
define(['jquery', 'underscore', 'backbone', 'uuid',
        'models/metadata/ScienceMetadata',
        'models/metadata/eml211/EMLCoverage', 
        'models/metadata/eml211/EMLDistribution', 
        'models/metadata/eml211/EMLParty', 
        'models/metadata/eml211/EMLProject'], 
    function($, _, Backbone, uuid, ScienceMetadata, EMLCoverage, EMLDistribution, EMLParty, EMLProject) {
        
        /*
        An EML211 object represents an Ecological Metadata Language
        document, version 2.1.1
        */
        var EML211 = ScienceMetadata.extend({

        	type: "EML",            

        	defaults: _.extend(ScienceMetadata.prototype.defaults, {
        		id: "urn:uuid:" + uuid.v4(),
        		formatId: "eml://ecoinformatics.org/eml-2.1.1",
        		objectXML: null,
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
	            geographicCoverage : [], //an array for GeographicCoverages
	            temporalCoverage : [], //an array of TemporalCoverages
	            taxonomicCoverage : [], //an array of Taxons
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
             * Maps the lower-case EML node names (valid in HTML DOM) to the camel-cased EML node names (valid in EML). 
             * Used during parse() and serialize()
             */
            nodeNameMap: {
            	"alternateidentifier" : "alternateIdentifier",
            	"additionalinfo" : "additionalInfo",
            	"intellectualrights" : "intellectualRights",
            	"keywordset" : "keywordSet",
            	"metadataprovider" : "metadataProvider",
            	"otherentity" : "otherEntity",
            	"pubdate" : "pubDate",
            	"geographiccoverage" : "geographicCoverage",
            	"taxonomiccoverage" : "taxonomicCoverage",
            	"temporalcoverage" : "temporalCoverage"
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
            		this.set("objectXML", response);
            		var emlElement = $($.parseHTML(response)).filter("eml\\:eml");
            	}
            	
            	var datasetEl;
            	if(emlElement[0])
            		datasetEl = $(emlElement[0]).find("dataset");
            	
            	if(!datasetEl || !datasetEl.length)
            		return {};
            		
            	var emlParties = ["metadataprovider", "associatedparty", "creator", "contact"],
            		emlDistribution = ["distribution"],
            		emlProject = ["project"];
            		
            	var nodes = datasetEl.children(),
            		modelJSON = {};
            	
            	for(var i=0; i<nodes.length; i++){
            		console.log(nodes[i]);
            		var thisNode = nodes[i];
            		
            		//EML Party modules are stored in EMLParty models
            		if(_.contains(emlParties, thisNode.localName))
            			modelJSON[thisNode.localName] = new EMLParty({ xml: thisNode });
            		//EML Distribution modules are stored in EMLDistribution models
            		else if(_.contains(emlDistribution, thisNode.localName))
            			modelJSON[thisNode.localName] = new EMLDistribution({ xml: thisNode });
            		//EML Project modules are stored in EMLProject models
            		else if(_.contains(emlProject, thisNode.localName))
            			modelJSON[thisNode.localName] = new EMLProject({ xml: thisNode });
            		//EML Temporal and Geographic Coverage modules are stored as EMLCoverage models
            		else if(thisNode.localName == "coverage"){
            			modelJSON.coverage = [];
            			
            			var temporal = $(thisNode).children("temporalCoverage"),
            				geo = $(thisNode).children("geographicCoverage");
            			
            			if(temporal.length)
            				modelJSON.coverage.push(new EMLCoverage({ xml: temporal }));
            			if(geo.length)
            				modelJSON.coverage.push(new EMLCoverage({ xml: geo }));
            		}
            		else{
            			var convertedName = this.nodeNameMap[thisNode.localName];
            			//Is this a multi-valued field in EML?
            			if(Array.isArray(this.get(convertedName))){
            				//If we already have a value for this field, then add this value to the array
            				if(Array.isArray(modelJSON[convertedName]))
            					modelJSON[convertedName].push(this.toJson(thisNode));
            				//If it's the first value for this field, then create a new array
            				else
            					modelJSON[convertedName] = [this.toJson(thisNode)];
            			}
            			else
            				modelJSON[convertedName] = this.toJson(thisNode);
            		}
            		
            	}
            	
            	console.log(modelJSON);
            	
            	return modelJSON;           	
            },
            
            /*
             * Retireves the model attributes and serializes into EML XML, to produce the new or modified EML document.
             * Returns the EML XML as a string.
             * TODO: Use the EML submodels to serialize certain sections, such as EMLParty.
             */
            serialize: function(){
            	//TODO: Flush out this function. This is a stub right now that just returns the original XML.
	           
	           	//Get the EML document
	           	var eml = this.get("objectXML");
	           
				//TODO: Camel case the XML string
	           	return $(document.createElement("div")).append(eml).html();
            },
            
            /*
             * Saves the EML document to the server using the DataONE API
             */
            save: function(attributes, options){
            	 //Set the upload transfer as in progress
   			 	this.set("uploadStatus", "p");
   			 
   			 	try{
   			 		var xml = this.serialize();
   			 	}
   			 	catch(error){
   			 		console.log("error serializing the EML.", error);
   			 		this.trigger("error");
   			 		return;
   			 	}
   			 	
	   			//Create a FormData object to send data with our XHR
	   			var formData = new FormData();
     			
   			//Create the system metadata XML
     			var sysMetaXML = this.serializeSysMeta();
     			//Send the system metadata as a Blob 
   			var xmlBlob = new Blob([sysMetaXML], {type : 'application/xml'});			
     			//Add the system metadata XML to the XHR data
     			formData.append("sysmeta", xmlBlob, "sysmeta");
     			
     			//Add the identifier to the XHR data
   			formData.append("pid", this.get("id"));
            },
            
            /*
	         * Checks if this model has updates that need to be synced with the server.
	         */
	        hasUpdates: function(){
	        	return false;
	        	if(this.constructor.__super__.hasUpdates.call(this)) return true;	    
	        	
	        	//If nothing else has been changed, then this object hasn't had any updates
	        	return false;
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