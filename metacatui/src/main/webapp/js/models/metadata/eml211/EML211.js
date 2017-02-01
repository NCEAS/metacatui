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
	            keywordSets: [], //array of EMLKeyword objects
	            additionalInfo: [],
	            intellectualRights: "",
	            onlineDist: [], // array of EMLOnlineDist objects
	            offlineDist: [], // array of EMLOfflineDist objects
	            geoCoverage : [], //an array for EMLGeoCoverages
	            temporalCoverage : null, //One EMLTempCoverage model
	            taxonCoverage : [], //an array of EMLTaxonCoverages
	            purpose: [],
	            pubplace: null,
	            methods: [], // array of EMLMethods objects
	            project: [] // array of EMLProject objects
	            //type: "Metadata"
        	}),

            initialize: function(attributes) {
                // Call initialize for the super class
                ScienceMetadata.prototype.initialize.call(this, attributes);
                
                // EML211-specific init goes here                
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
            			EMLGeoCoverage.prototype.nodeNameMap(),
            			EMLTaxonCoverage.prototype.nodeNameMap(),
            			EMLTemporalCoverage.prototype.nodeNameMap(),
            			EMLDistribution.prototype.nodeNameMap(),
            			EMLParty.prototype.nodeNameMap(),
            		//	EMLProject.prototype.nodeNameMap(),
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
			            	"keywordset" : "keywordSet",
			            	"keywordthesaurus" : "keywordThesaurus",
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
            	if(!options)
            		var options = {};
            	
            	if(options.sysMeta)
            		options.url = MetacatUI.appModel.get("metaServiceUrl");
            	
            	//Add the authorization header and other AJAX settings
            	 _.extend(options, MetacatUI.appUserModel.createAjaxSettings(), {dataType: "text"});

                // Merge the system metadata into the object first
                _.extend(options, {merge: true});
                DataONEObject.prototype.fetch.call(this, options);
                
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
            		emlText = ["abstract", "intellectualrights", "additionalinfo"];
           // 		emlProject = ["project"];
            		
            	var nodes = datasetEl.children(),
            		modelJSON = {};
            	
            	for(var i=0; i<nodes.length; i++){
            		// console.log(nodes[i]);
            		var thisNode = nodes[i];
            		
            		//EML Party modules are stored in EMLParty models
            		if(_.contains(emlParties, thisNode.localName)){
            			if(typeof modelJSON[thisNode.localName] == "undefined") modelJSON[thisNode.localName] = [];
            			
            			modelJSON[thisNode.localName].push(new EMLParty({ 
            				objectDOM: thisNode,
            				parentModel: model 
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
            		//EML Project modules are stored in EMLProject models
            	/*	else if(_.contains(emlProject, thisNode.localName))
            	 *      if(typeof modelJSON[thisNode.localName] == "undefined") modelJSON[thisNode.localName] = [];

            			modelJSON[thisNode.localName].push(new EMLProject({ 
            				objectDOM: thisNode,
            				parentModel: model
            			 })); 
            	*/
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
	           		datasetNode = $(eml).filter("dataset");
	           	
	           	var nodeNameMap = this.nodeNameMap();
	           	
	           	//Serialize the parts of EML that are eml-text modules
	           	var textFields = ["abstract"];
	           	_.each(textFields, function(field){
	           		
	           		var fieldName = this.nodeNameMap()[field] || field;
	           		
	           		//Get the EMLText model
	           		var emlTextModels = this.get(field);
	           		if(!emlTextModels.length) return;
	           		
	           		//Get the node from the EML doc
	           		var nodes = $(eml).find(fieldName);
	           		
	           		//Clear the node
	           	//	$(parentNode).empty();
	           			
	           		//Update the DOMs for each model
	           		_.each(emlTextModels, function(thisTextModel, i){
	           			var node; 
	           			
	           			//Get the existing node or create a new one
	           			if(nodes.length < i+1)
	           				node = document.createElement(fieldName);
	           			else
	           				node = nodes[i];
	           				
	           			node.replaceWith(thisTextModel.updateDOM());
	           			
	           		}, this);
	           		
	           		//Remove the extra nodes
	           		var extraNodes =  nodes.length - emlTextModels.length;
	           		if(extraNodes > 0){
	           			for(var i = emlTextModels.length; i < nodes.length; i++){
	           				$(nodes[i]).remove();
	           			}
	           		}
	           			
	           	}, this);
	           	
	           	//Serialize the geographic coverage
	           	_.each(this.get("geoCoverage"), function(geoCoverage){
		           	$(eml).find("geographiccoverage").replaceWith(geoCoverage.updateDOM());
	           	});
	           	
	           	//Serialize the taxonomic coverage
	           	_.each(this.get("taxonCoverage"), function(taxonCoverage){
	           		$(eml).find("taxonomiccoverage").replaceWith(taxonCoverage.updateDOM());
	           	});	 
	           	
	        	//Serialize the temporal coverage
		        $(eml).find("temporalcoverage").replaceWith(this.get("temporalCoverage").updateDOM());
	           	
	           	//Serialize the metadata providers
	           	_.each(this.get("metadataProvider"), function(metadataProvider){
	           		$(eml).find("metadataprovider#" + metadataProvider.get("id")).replaceWith(metadataProvider.updateDOM());
	           	});
	           	
	           	//Serialize the creators
	           	_.each(this.get("creator"), function(creator){
	           		$(eml).find("creator#" + creator.get("id")).replaceWith(creator.updateDOM());
	           	});
	           	
	        	//Serialize the associated parties
	           	_.each(this.get("associatedParty"), function(associatedParty){
	           		$(eml).find("associatedparty#" + associatedParty.get("id")).replaceWith(associatedParty.updateDOM());
	           	});
	           	
	           	//Serialize the contacts
	           	_.each(this.get("contact"), function(contact){
	           		$(eml).find("contact#" + contact.get("id")).replaceWith(contact.updateDOM());
	           	});
	           	
	           	//Serialize the publishers
	           	_.each(this.get("publisher"), function(publisher){
	           		$(eml).find("publisher#" + publisher.get("id")).replaceWith(publisher.updateDOM());
	           	});
	           	
	           	//Serialize the keywords
	           	var keywordNodes = $(eml).find("keywordset");
	        	_.each(this.get("keywordSets"), function(keywordSet, i){

	           		if(i < keywordNodes.length)
	           			$(keywordNodes[i]).replaceWith(keywordSet.updateDOM());
	           		else
	           			$(eml).find("keywordset").last().after(keywordSet.updateDOM());
	           		
	           	});
	           	
	           	//Serialize the basic text fields
	           	var basicText = ["alternateIdentifier", "intellectualRights"];
	           	_.each(basicText, function(fieldName){
	           		var basicTextValues = this.get(fieldName);
	           		
	           		if(!Array.isArray(basicTextValues)) basicTextValues = [basicTextValues];
	           		
	           		var nodes = $(eml).find(fieldName.toLowerCase());
	           		
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
	           					$(eml).find("dataset").append(newNode);
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
             * Saves the EML document to the server using the DataONE API
             */
            save: function(attributes, options){
            	
            /*	 if(!this.hasUpdates()){
    				 this.set("uploadStatus", null);
    				 return;
    			 }
            	*/ 
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
            
            updateKeywords: function(keyword, thesaurus, num){
            	
            	if(!keyword) return;

            	var keywordSet = this.get("keywordset");

            	if(typeof num == "undefined")
            		var num = keywordSet.length;
            	
        		keywordSet[num] = {
        			keyword: keyword,
        			keywordthesaurus: thesaurus || "None"
        		}
        		
        		this.model
        		
        		this.trigger("change");
            },
            
            /*
	         * Checks if this model has updates that need to be synced with the server.
	         */
	        hasUpdates: function(){
	        	if(this.constructor.__super__.hasUpdates.call(this)) return true;	    
	        	
	        	//If nothing else has been changed, then this object hasn't had any updates
	        	return false;
	        },
	        
	        isNew: function(){
	        	//Check if there is an original XML document that was retrieved from the server
	        	if(!this.get("objectXML") && this.get("synced")) return true;
	        	else return false;
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