/* global define */
define(['jquery', 'underscore', 'backbone', 'uuid',
        'models/metadata/ScienceMetadata',
        'models/DataONEObject',
        'models/metadata/eml211/EMLGeoCoverage', 
        'models/metadata/eml211/EMLKeywordSet', 
        'models/metadata/eml211/EMLTaxonCoverage', 
        'models/metadata/eml211/EMLTemporalCoverage', 
        'models/metadata/eml211/EMLDistribution', 
        'models/metadata/eml211/EMLParty', 
        'models/metadata/eml211/EMLProject',
        'models/metadata/eml211/EMLText'], 
    function($, _, Backbone, uuid, ScienceMetadata, DataONEObject, 
    		EMLGeoCoverage, EMLKeywordSet, EMLTaxonCoverage, EMLTemporalCoverage, EMLDistribution, EMLParty, EMLProject, EMLText) {
        
        /*
        An EML211 object represents an Ecological Metadata Language
        document, version 2.1.1
        */
        var EML211 = ScienceMetadata.extend({

        	type: "EML",            

        	defaults: _.extend(ScienceMetadata.prototype.defaults(), {
        		id: "urn:uuid:" + uuid.v4(),
        		formatId: "eml://ecoinformatics.org/eml-2.1.1",
        		objectXML: null,
	            isEditable: false,
	            alternateIdentifier: [],
	            shortName: null,
	            title: [],
	            creator: [], // array of EMLParty objects
	            metadataProvider: [], // array of EMLParty objects
	            associatedParty : [], // array of EMLParty objects
	            contact: [], // array of EMLParty objects
	            publisher: [], // array of EMLParty objects
	            pubDate: null,
	            language: null,
	            series: null,
	            abstract: [], //array of EMLText objects
	            keywordSets: [], //array of EMLKeywordSet objects
	            additionalInfo: [],
	            intellectualRights: "",
	            intellRightsOptions: ["This work is dedicated to the public domain under the Creative Commons Universal 1.0 Public Domain Dedication." +
	                                  "To view a copy of this dedication, visit https://creativecommons.org/publicdomain/zero/1.0/.",
	                                  "This work is licensed under the Creative Commons Attribution 4.0 International " + 
	                                  "License. To view a copy of this license, visit http://creativecommons.org/licenses/by/4.0/."],
	            onlineDist: [], // array of EMLOnlineDist objects
	            offlineDist: [], // array of EMLOfflineDist objects
	            geoCoverage : [], //an array for EMLGeoCoverages
	            temporalCoverage : null, //One EMLTempCoverage model
	            taxonCoverage : [], //an array of EMLTaxonCoverages
	            purpose: [],
	            pubplace: null,
	            methods: [], // array of EMLMethods objects
	            project: null // An EMLProject object
	            //type: "Metadata"
        	}),

            initialize: function(attributes) {
                // Call initialize for the super class
                ScienceMetadata.prototype.initialize.call(this, attributes);
                
                // EML211-specific init goes here
                // this.set("objectXML", this.createXML());
                this.parse(this.createXML());
            },
            
            url: function(){
            	return MetacatUI.appModel.get("objectServiceUrl") + (this.get("id") || this.get("seriesid"));
            },
            
            /*
             * Maps the lower-case EML node names (valid in HTML DOM) to the camel-cased EML node names (valid in EML). 
             * Used during parse() and serialize()
             */
            nodeNameMap: function(){
            	return _.extend(
            			this.constructor.__super__.nodeNameMap(),
            			EMLDistribution.prototype.nodeNameMap(),
            			EMLGeoCoverage.prototype.nodeNameMap(),
            			EMLKeywordSet.prototype.nodeNameMap(),
            			EMLParty.prototype.nodeNameMap(),
            			EMLProject.prototype.nodeNameMap(),
            			EMLTaxonCoverage.prototype.nodeNameMap(),
            			EMLTemporalCoverage.prototype.nodeNameMap(),
            			{
			            	"additionalinfo" : "additionalInfo",
			            	"allowfirst" : "allowFirst",
			            	"alternateidentifier" : "alternateIdentifier",
			            	"asneeded" : "asNeeded",
			            	"associatedparty" : "associatedParty",
			            	"changehistory" : "changeHistory",
			            	"changedate" : "changeDate",
			            	"changescope" : "changeScope",
			            	"dataformat" : "dataFormat",
			            	"entityname" : "entityName",
			            	"entitytype" : "entityType",
			            	"externallydefinedformat" : "externallyDefinedFormat",
			            	"formatname" : "formatName",
			            	"intellectualrights" : "intellectualRights",
			            	"maintenanceupdatefrequency" : "maintenanceUpdateFrequency",
			            	"methodstep" : "methodStep",
			            	"notplanned" : "notPlanned",
			            	"objectname" : "objectName",
			            	"oldvalue" : "oldValue",
			            	"otherentity" : "otherEntity",
			            	"othermaintenanceperiod" : "otherMaintenancePeriod",
			            	"packageid" : "packageId",
			            	"pubdate" : "pubDate",
			            	"pubplace" : "pubPlace",
			            	"samplingdescription" : "samplingDescription",
			            	"studyextent" : "studyExtent",
                            "xsi:schemalocation" : "xsi:schemaLocation"
            			}
            	);
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
            	if( ! options ) var options = {};
            	
            	//Add the authorization header and other AJAX settings
            	 _.extend(options, MetacatUI.appUserModel.createAjaxSettings(), {dataType: "text"});

                // Merge the system metadata into the object first
                _.extend(options, {merge: true});
                this.fetchSystemMetadata(options);
                
                //If we are retrieving system metadata only, then exit now
                if(options.sysMeta)
                	return;
                
            	//Call Backbone.Model.fetch to retrieve the info
                return Backbone.Model.prototype.fetch.call(this, options);
                
            },
                        
            /* 
             Deserialize an EML 2.1.1 XML document
            */
            parse: function(response) {
				// Save a reference to this model for use in setting the 
				// parentModel inside anonymous functions
				var model = this;

            	//If the response is XML
            	if((typeof response == "string") && response.indexOf("<") == 0){
            		//Look for a system metadata tag and call DataONEObject parse instead
            		if(response.indexOf("systemMetadata>") > -1) 
            			return DataONEObject.prototype.parse.call(this, response);
            			
            		this.set("objectXML", response);
            		var emlElement = $($.parseHTML(response)).filter("eml\\:eml");
            	}
            	
            	var datasetEl;
            	if(emlElement[0])
            		datasetEl = $(emlElement[0]).find("dataset");
            	
            	if(!datasetEl || !datasetEl.length)
            		return {};
            		
            	var emlParties = ["metadataprovider", "associatedparty", "creator", "contact", "publisher"],
            		emlDistribution = ["distribution"],
            		emlText = ["abstract", "additionalinfo"];
            		
            	var nodes = datasetEl.children(),
            		modelJSON = {};
            	
            	for(var i=0; i<nodes.length; i++){

            		var thisNode = nodes[i];
            		
            		//EML Party modules are stored in EMLParty models
            		if(_.contains(emlParties, thisNode.localName)){
            			if(thisNode.localName == "metadataprovider")
            				var attributeName = "metadataProvider";
            			else if(thisNode.localName == "associatedparty")
            				var attributeName = "associatedParty";
            			else
            				var attributeName = thisNode.localName;
            			
            			if(typeof modelJSON[attributeName] == "undefined") modelJSON[attributeName] = [];
            			
            			modelJSON[attributeName].push(new EMLParty({ 
            				objectDOM: thisNode,
            				parentModel: model,
            				type: attributeName
            			}));
            		}
            		//EML Distribution modules are stored in EMLDistribution models
            		else if(_.contains(emlDistribution, thisNode.localName)){
            			if(typeof modelJSON[thisNode.localName] == "undefined") modelJSON[thisNode.localName] = [];

            			modelJSON[thisNode.localName].push(new EMLDistribution({ 
            				objectDOM: thisNode,
            				parentModel: model
            			}));
            		}
            		//The EML Project is stored in the EMLProject model
            		else if(thisNode.localName == "project"){

            			modelJSON.project = new EMLProject({ 
            				objectDOM: thisNode,
            				parentModel: model
            			 }); 
            			
            		}
            		//EML Temporal, Taxonomic, and Geographic Coverage modules are stored in their own models
            		else if(thisNode.localName == "coverage"){
            			
            			var temporal = $(thisNode).children("temporalcoverage"),
            				geo      = $(thisNode).children("geographiccoverage"),
            				taxon    = $(thisNode).children("taxonomiccoverage");
            			
            			if(temporal.length){
            				modelJSON.temporalCoverage = new EMLTemporalCoverage({ 
        						objectDOM: temporal[0],
        						parentModel: model
                			});
            			}
            						
            			if(geo.length){
            				modelJSON.geoCoverage = [];
            				_.each(geo, function(g){
                				modelJSON.geoCoverage.push(new EMLGeoCoverage({ 
                					objectDOM: g,
                					parentModel: model 
                    			}));
            				});
            				
            			}
            			
            			if(taxon.length){
            				modelJSON.taxonCoverage = [];
            				_.each(taxon, function(t){
                				modelJSON.taxonCoverage.push(new EMLTaxonCoverage({ 
                					objectDOM: t,
                					parentModel: model 
                    				}));
            				});
            				
            			}

            		}
            		//Parse EMLText modules
            		else if(_.contains(emlText, thisNode.localName)){
            			if(typeof modelJSON[thisNode.localName] == "undefined") modelJSON[thisNode.localName] = [];
            			
            			var emlText = new EMLText({ 
	            				objectDOM: thisNode, 
	            				parentModel: model
            				});
            			modelJSON[thisNode.localName].push(emlText);
            			
            			
            		}
            		//Parse keywords
            		else if(thisNode.localName == "keywordset"){
            			//Start an array of keyword sets
            			if(typeof modelJSON["keywordSets"] == "undefined") modelJSON["keywordSets"] = [];
            			
            			modelJSON["keywordSets"].push(new EMLKeywordSet({
            				objectDOM: thisNode,
            				parentModel: model
            			}));
            		}
            		//Parse intellectual rights
            		else if(thisNode.localName == "intellectualrights"){
            			var value = "";
            			
            			if($(thisNode).children("para").length == 1)
            				value = $(thisNode).children("para").first().text().trim();
            			else
            				$(thisNode).text().trim();
            			
            			//If the value is one of our pre-defined options, then add it to the model
            			if(_.contains(this.get("intellRightsOptions"), value))
            				modelJSON["intellectualRights"] = value;
            			
            		}
            		else{
            			var convertedName = this.nodeNameMap()[thisNode.localName] || thisNode.localName;
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
             */
            serialize: function(){
	           
	           	//Get the EML document
	           	var xmlString = this.get("objectXML"),
	           		eml = $.parseHTML(xmlString),
	           		datasetNode = $(eml).filter("eml\\:eml").find("dataset");
	           	
	           	var nodeNameMap = this.nodeNameMap();
	           	
	           	// Serialize the parts of EML that are eml-text modules
	           	var textFields = ["abstract"];
	           	_.each(textFields, function(field){
	           		
	           		var fieldName = this.nodeNameMap()[field] || field;
	           		
	           		// Get the EMLText model
	           		var emlTextModels = Array.isArray(this.get(field)) ? this.get(field) : [this.get(field)];
	           		if( ! emlTextModels.length ) return;
	           		
	           		// Get the node from the EML doc
	           		var nodes = $(eml).find(fieldName);
	           		
	           		// Update the DOMs for each model
	           		_.each(emlTextModels, function(thisTextModel, i){
	           			//Don't serialize falsey values
	           			if(!thisTextModel) return;
	           			
	           			var node; 
	           			
	           			//Get the existing node or create a new one
	           			if(nodes.length < i+1){
	           				node = document.createElement(fieldName);
                            this.getEMLPosition(eml, fieldName).after(node);
	           			    
	           			} else {
	           				node = nodes[i];
	           			    
	           			}
	           				
	           			$(node).html($(thisTextModel.updateDOM()).html());
	           			
	           		}, this);
	           		
	           		// Remove the extra nodes
	           		var extraNodes =  nodes.length - emlTextModels.length;
	           		if(extraNodes > 0){
	           			for(var i = emlTextModels.length; i < nodes.length; i++){
	           				$(nodes[i]).remove();
	           			}
	           		}
	           			
	           	}, this);
	           	
	           	//Serialize the geographic coverage
	           /*	_.each(this.get("geoCoverage"), function(geoCoverage){
		           	$(eml).find("geographiccoverage").replaceWith(geoCoverage.updateDOM());
	           	});
	          */ 	
	           	//Serialize the taxonomic coverage

				if ( typeof this.get('taxonCoverage') !== 'undefined' && this.get('taxonCoverage').length != null) {
					if ($(eml).find('coverage').length === 0) {
						$(eml).find('dataset').append(document.createElement('coverage'));
					}

					$(eml).find("taxonomiccoverage").remove()

					_.each(this.get("taxonCoverage"), function(taxonCoverage){
						$(eml).find('coverage').append(taxonCoverage.updateDOM());
					});	 
				}
				
	        	//Serialize the temporal coverage
                if ( typeof this.get("temporalCoverage") !== "undefined" && this.get("temporalCoverage") !== null ) {
    		        $(eml).find("temporalcoverage").replaceWith(this.get("temporalCoverage").updateDOM());
                    
                }
                
                //Create the creator from the current user if none is provided
                if(!this.get("creator").length){
	           		var party = new EMLParty({ parentModel: this, type: "creator" });
	           		
	           		party.createFromUser();
	           		
	           		this.set("creator", [party]);
                }
	           	
		        //Serialize the creators
		        this.serializeParties(eml, "creator");

	           	//Serialize the metadata providers
	           	this.serializeParties(eml, "metadataProvider");
	           	
	        	//Serialize the associated parties
	           	this.serializeParties(eml, "associatedParty");
	           	
	           	//Serialize the contacts
	           	this.serializeParties(eml, "contact");
	           	
	           	//Serialize the publishers
	           	this.serializeParties(eml, "publisher");
	           	
	           	//Serialize the keywords
	           	var keywordNodes = $(eml).find("keywordset");
	        	_.each(this.get("keywordSets"), function(keywordSet, i){

	        		//Replace the existing keywordSet nodes with the new values
	           		if(i < keywordNodes.length)
	           			$(keywordNodes[i]).replaceWith(keywordSet.updateDOM());
	           		//Or add new keywordSet nodes for new keywords
	           		else{
	           			//Append to the list of keywordSet nodes
	           			if($(eml).find("keywordset").length)
	           				$(eml).find("keywordset").last().after(keywordSet.updateDOM());
	           			//Or if there are no keywordSet nodes, then find where this gets inserted into the EML doc
	           			else
	           				this.getEMLPosition(eml, "keywordset").after(keywordSet.updateDOM());
	           		}
	           	}, this);
	        	
	        	//Serialize the intellectual rights
	        	if(this.get("intellectualRights")){
	        		if($(eml).find("intellectualRights").length)
	        			$(eml).find("intellectualRights").html("<para>" + this.get("intellectualRights") + "</para>")
	        		else{
	        			
	        			this.getEMLPosition(eml, "intellectualrights").after(
	        					$(document.createElement("intellectualRights"))
	        						.html("<para>" + this.get("intellectualRights") + "</para>"));
	        		}
	        	}
	        	
	        	//Serialize the project
	        	if($(eml).find("project").length)
	        		$(eml).find("project").replaceWith(this.get("project").updateDOM());
	        	else if(this.get("project"))
	        		this.getEMLPosition(eml, "project").after(this.get("project").updateDOM());
	           	
	           	//Serialize the basic text fields
	           	var basicText = ["alternateIdentifier", "title"];
	           	_.each(basicText, function(fieldName){
	           		var basicTextValues = this.get(fieldName);
	           		
	           		if(!Array.isArray(basicTextValues)) basicTextValues = [basicTextValues];
	           		
	           		var nodes = $(datasetNode).children(fieldName.toLowerCase());
	           		
	           		_.each(basicTextValues, function(text, i){
	           			var node = nodes[i];
	           			
	           			//Change the value of the existing node
	           			if(node)
	           				$(node).text(text);
           				//Or create a new node	           			
	           			else{
	           				var newNode = $(document.createElement(fieldName.toLowerCase())).text(text);
	           				
	           				//Insert the new node at the end
	           				if(nodes.length)
	           					nodes.last().after(newNode);
	           				//If this is the first node of its kind, insert it at the end of the dataset node
	           				else
	           					this.getEMLPosition(eml, fieldName).after(newNode);
	           			}
	           				
	           		}, this);
	           		
	           	}, this);
	              	           	
	           	//Camel-case the XML
		    	var emlString = ""; 
		    	_.each(eml, function(rootEMLNode){ emlString += this.formatXML(rootEMLNode); }, this);
		    	           	     
		    	console.log(emlString);
		    	
	           	return emlString;
            },
            
            /*
             * Given an EML DOM and party type, this function updated and/or adds the EMLParties to the EML
             */
            serializeParties: function(eml, type){
            	
	           	_.each(this.get(type), function(party){
	           		//Get the existing nodes in the EML
	           		var existingNode = $(eml).find(type.toLowerCase() + "#" + party.get("xmlID"));
	           		
	           		//Update the EMLParty DOM and insert into the EML
	           		if(existingNode.length)
	           			existingNode.replaceWith(party.updateDOM());
	           		else{
	           			var insertAfter = $(eml).find(type.toLowerCase()).last();
	           			if(!insertAfter || !insertAfter.length)
	           				insertAfter = this.getEMLPosition(eml, type.toLowerCase());
	           			
	           			insertAfter.after(party.updateDOM());
	           		}
	           	}, this);
	           	
	        	//Create a certain parties from the current app user if none is given
	          	if(type == "contact" && !this.get("contact").length){
	          		//Get the creators
	          		var creators = this.get("creator"),
	          			contacts = [];
	          		
	          		_.each(creators, function(creator){
	          			//Clone the creator model and add it to the contacts array
	          			var newModel = new EMLParty({ parentModel: this });
	          			newModel.set(creator.toJSON());
	          			newModel.set("type", type);
	          			
	          			contacts.push(newModel);
	          		}, this);
	          			           		           		
	           		this.set(type, contacts);
	           		
	           		//Call this function again to serialize the new models
	           		this.serializeParties(eml, type);	           		
	           	}
            },
            
            /*
             * Saves the EML document to the server using the DataONE API
             */
            save: function(attributes, options){
                
                // Set missing file names before saving
                if ( ! this.get("fileName") ) {
                    this.setMissingFileName();
                  
                }

            	//Set the upload transfer as in progress
   			 	this.set("uploadStatus", "p"); 
   			 	
   			 	//If this is an existing object and there is no system metadata, retrieve it
   			 	if(!this.isNew() && !this.get("sysMetaXML")){
   			 		var model = this;
   			 		
   			 		//When the system metadata is fetched, try saving again
   			 		var fetchOptions = {
		 				success: function(response){
		 					model.set(DataONEObject.prototype.parse.call(model, response));
		 					model.save(attributes, options);
		 				}
   			 		}
   			 		
   			 		//Fetch the system metadata now
   			 		this.fetchSystemMetadata(fetchOptions);
   			 		
   			 		return;
   			 	}
   			 	
	   			//Create a FormData object to send data with our XHR
	   			var formData = new FormData();
     			
	   			try{
	     			
	     			//Add the identifier to the XHR data
	    			if(this.isNew()){
	    				formData.append("pid", this.get("id"));
	    			}
	    			else{
	    				//Create a new ID
	    				this.updateID();
						
	    				//Add the ids to the form data
						formData.append("newPid", this.get("id"));
						formData.append("pid", this.get("oldPid"));
	    			}
	    			
	     			//Serialize the EML XML
	     			var xml = this.serialize();
	     			var xmlBlob = new Blob([xml], {type : 'application/xml'});
	     			
	     			//Get the size of the new EML XML
					this.set("size", xmlBlob.size);
					
					//Get the new checksum of the EML XML
					var checksum = md5(xmlBlob);
					this.set("checksum", checksum);
	     			
	     			//Create the system metadata XML
	     			var sysMetaXML = this.serializeSysMeta();
	     			
	     			//Send the system metadata as a Blob 
	     			var sysMetaXMLBlob = new Blob([sysMetaXML], {type : 'application/xml'});
	     			
	     			//Add the object XML and System Metadata XML to the form data
	     			formData.append("object", xmlBlob);	     			
	     			formData.append("sysmeta", sysMetaXMLBlob, "sysmeta");
	   			}
	   			catch(error){
	   				//Reset the identifier since we didn't actually update the object
	   				this.resetID();
	   				
	   				console.log("error during EML.save(): ", error);
	   				
	   				this.set("uploadStatus", "e"); 
	   				this.trigger("error");
	   				return false;
	   			}
	   			
	   			var model = this;
	   			var saveOptions = options || {};
	   			_.extend(saveOptions, {
	   				data : formData,
		   			cache: false,
				    contentType: false,
				    dataType: "text",
				    processData: false,
					parse: false,
					//Use the URL function to determine the URL, unless this is an update - then make sure the URL uses the old pid
					url: this.isNew()? this.url() : MetacatUI.appModel.get("objectServiceUrl") + this.get("oldPid"),
					success: function(model, response, xhr){
						console.log('yay, EML has been saved');
						
						model.set("uploadStatus", "c");
                        model.set("sysMetaXML", model.serializeSysMeta());
						model.trigger("successSaving");
                        model.fetch({merge: true, sysMeta: true});
                        
					},
					error: function(model, response, xhr){
						console.log("error updating EML: ", response.responseText);
						model.set("uploadStatus", "e");
						model.resetID();
						model.trigger("errorSaving", response.responseText);
					}
	   			}, MetacatUI.appUserModel.createAjaxSettings());
	   			
	   			return Backbone.Model.prototype.save.call(this, attributes, saveOptions);		
            },
            
            /*
             * Sends an AJAX request to fetch the system metadata for this EML object.
             * Will not trigger a sync event since it does not use Backbone.Model.fetch 
             */
            fetchSystemMetadata: function(options){
            	if(this.isNew()) return;
            	
            	if(!options) var options = {};
            	else options = _.clone(options);
            	
            	var model = this,
            		fetchOptions = _.extend({
	            		url: MetacatUI.appModel.get("metaServiceUrl") + this.get("id"),
	            		dataType: "text",
	            		success: function(response){
	            			model.set(DataONEObject.prototype.parse.call(model, response));
	            		},
	            		error: function(){
	            			console.log("error!")
	            			model.trigger('error');
	            		}
            		}, options);
            	
            	//Add the authorization header and other AJAX settings
           	   _.extend(fetchOptions, MetacatUI.appUserModel.createAjaxSettings(), {dataType: "text"});
            	
            	$.ajax(fetchOptions);
            },
            
            /*
             * Returns the node in the given EML document that the given node type should be inserted after
             */
            getEMLPosition: function(eml, nodeName){
            	var nodeOrder = ["alternateidentifier", "shortname", "title", "creator", "metadataprovider", "associatedparty",
	           		             "pubdate", "language", "series", "abstract", "keywordset", "additionalinfo", "intellectualrights", 
	           		             "distribution", "coverage", "contact", "methods", "project", "datatable", "otherentity"];
            	
            	var position = _.indexOf(nodeOrder, nodeName);
            	if(position == -1)
            		return $(eml).find("dataset").children().last();
            	
            	//Go through each node in the node list and find the position where this node will be inserted after
            	for(var i=position-1; i>=0; i--){
            		if($(eml).find(nodeOrder[i]).length)
            			return $(eml).find(nodeOrder[i]).last();
            	}
            	
            	return $(eml).find("dataset").children().last();
            },
                        
            /*
	         * Checks if this model has updates that need to be synced with the server.
	         */
	        hasUpdates: function(){
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
                
            },
            
            /* Initialize the object XML for brand spankin' new EML objects */
            createXML: function() {
                var xml = "<eml:eml xmlns:eml=\"eml://ecoinformatics.org/eml-2.1.1\"></eml:eml>",
                    eml = $($.parseHTML(xml));
                    
                    // Set base attributes
                    eml.attr("xmlns:xsi", "http://www.w3.org/2001/XMLSchema-instance");
                    eml.attr("xmlns:stmml", "http://www.xml-cml.org/schema/stmml-1.1");
                    eml.attr("xsi:schemaLocation", "eml://ecoinformatics.org/eml-2.1.1 eml.xsd");
                    eml.attr("packageId", this.get("id"));
                    eml.attr("system", "knb"); // We could make this configurable at some point
                    
                    // Add the dataset
                    eml.append(document.createElement("dataset"));
                    eml.find("dataset").append(document.createElement("title"));
                                            
                    emlString = $(document.createElement("div")).append(eml.clone()).html();
                    
                    return emlString;
            }
            
        });
        return EML211;
    }
    
);