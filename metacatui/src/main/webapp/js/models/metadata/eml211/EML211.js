/* global define */
define(['jquery', 'underscore', 'backbone', 'uuid',
        'collections/Units',
        'models/metadata/ScienceMetadata',
        'models/DataONEObject',
        'models/metadata/eml211/EMLGeoCoverage', 
        'models/metadata/eml211/EMLKeywordSet', 
        'models/metadata/eml211/EMLTaxonCoverage', 
        'models/metadata/eml211/EMLTemporalCoverage', 
        'models/metadata/eml211/EMLDistribution', 
        'models/metadata/eml211/EMLEntity',
        'models/metadata/eml211/EMLParty', 
        'models/metadata/eml211/EMLProject',
        'models/metadata/eml211/EMLText',
		'models/metadata/eml211/EMLMethods'], 
    function($, _, Backbone, uuid, Units, ScienceMetadata, DataONEObject, 
    		EMLGeoCoverage, EMLKeywordSet, EMLTaxonCoverage, EMLTemporalCoverage, EMLDistribution, EMLEntity, EMLParty, EMLProject, EMLText, EMLMethods) {
        
        /*
        An EML211 object represents an Ecological Metadata Language
        document, version 2.1.1
        */
        var EML211 = ScienceMetadata.extend({

        	type: "EML",            

        	defaults: function(){
        		return _.extend(ScienceMetadata.prototype.defaults(), {
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
		            onlineDist: [], // array of EMLOnlineDist objects
		            offlineDist: [], // array of EMLOfflineDist objects
		            geoCoverage : [], //an array for EMLGeoCoverages
		            temporalCoverage : null, //One EMLTempCoverage model
		            taxonCoverage : [], //an array of EMLTaxonCoverages
		            purpose: [],
		            entities: [], //An array of EMLEntities
		            pubplace: null,
		            methods: null, // An EMLMethods objects
		            project: null // An EMLProject object
        		});
        	},

            initialize: function(attributes) {
                // Call initialize for the super class
                ScienceMetadata.prototype.initialize.call(this, attributes);
                
                // EML211-specific init goes here
                // this.set("objectXML", this.createXML());
                this.parse(this.createXML());
                
                this.on("sync", function(){
                	this.set("synced", true);
                });
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
						EMLMethods.prototype.nodeNameMap(),
            			{
            				"additionalclassifications" : "additionalClassifications",
			            	"additionalinfo" : "additionalInfo",
			            	"additionallinks" : "additionalLinks",
			            	"additionalmetadata" : "additionalMetadata",
			            	"allowfirst" : "allowFirst",
			            	"alternateidentifier" : "alternateIdentifier",
			            	"asneeded" : "asNeeded",
			            	"associatedparty" : "associatedParty",
			            	"attributeaccuracyexplanation" : "attributeAccuracyExplanation",
			            	"attributeaccuracyreport" : "attributeAccuracyReport",
			            	"attributeaccuracyvalue" : "attributeAccuracyValue",
			            	"attributedefinition" : "attributeDefinition",
			            	"attributelabel" : "attributeLabel",
			            	"attributelist" : "attributeList",
			            	"attributename" : "attributeName",
			            	"attributeorientation" : "attributeOrientation",
			            	"casesensitive" : "caseSensitive",
			            	"changehistory" : "changeHistory",
			            	"changedate" : "changeDate",
			            	"changescope" : "changeScope",
			            	"codedefinition" : "codeDefinition",
			            	"codeexplanation" : "codeExplanation",
			            	"codesetname" : "codesetName",
			            	"codeseturl" : "codesetURL",
			            	"customunit" : "customUnit",
			            	"dataformat" : "dataFormat",
			            	"datatable" : "dataTable",
			            	"datetime" : "dateTime",
			            	"datetimedomain" : "dateTimeDomain",
			            	"datetimeprecision" : "dateTimePrecision",
			            	"definitionattributereference" : "definitionAttributeReference",
			            	"entitycodelist" : "entityCodeList",
			            	"entitydescription" : "entityDescription",
			            	"entityname" : "entityName",
			            	"entityreference" : "entityReference",
			            	"entitytype" : "entityType",
			            	"enumerateddomain" : "enumeratedDomain",
			            	"externalcodeset" : "externalCodeSet",
			            	"externallydefinedformat" : "externallyDefinedFormat",
			            	"fielddelimiter" : "fieldDelimiter",
			            	"formatname" : "formatName",
			            	"formatstring" : "formatString",
			            	"intellectualrights" : "intellectualRights",
			            	"maintenanceupdatefrequency" : "maintenanceUpdateFrequency",
			            	"maxrecordlength" : "maxRecordLength",
			            	"measurementscale" : "measurementScale",
			            	"methodstep" : "methodStep",
			            	"missingvaluecode" : "missingValueCode",
			            	"nonnumericdomain" : "nonNumericDomain",
			            	"notplanned" : "notPlanned",
			            	"numbertype" : "numberType",
			            	"numericdomain" : "numericDomain",
			            	"numfooterlines" : "numFooterLines",
			            	"numheaderlines" : "numHeaderLines",
			            	"numberofrecords" : "numberOfRecords",
			            	"numphysicallinesperrecord" : "numPhysicalLinesPerRecord",
			            	"objectname" : "objectName",
			            	"oldvalue" : "oldValue",
			            	"orderattributereference" : "orderAttributeReference",
			            	"otherentity" : "otherEntity",
			            	"othermaintenanceperiod" : "otherMaintenancePeriod",
			            	"packageid" : "packageId",
			            	"physicallinedelimiter" : "physicalLineDelimiter",
			            	"pubdate" : "pubDate",
			            	"pubplace" : "pubPlace",
			            	"quantitativeattributeaccuracyassessment" : "quantitativeAttributeAccuracyAssessment",
			            	"researchtopic" : "researchTopic",
			            	"recorddelimiter" : "recordDelimiter",
			            	"samplingdescription" : "samplingDescription",
			            	"simpledelimited" : "simpleDelimited",
			            	"standardunit" : "standardUnit",
			            	"storagetype" : "storageType",
			            	"studyextent" : "studyExtent",
			            	"studytype" : "studyType",
			            	"textdomain" : "textDomain",
			            	"textformat" : "textFormat",
			            	"valueattributereference" : "valueAttributeReference",
                            "xsi:schemalocation" : "xsi:schemaLocation"
            			}
            	);
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
            			
            		response = this.cleanUpXML(response);
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
            		emlEntities = ["datatable", "otherentity", "spatialvector"],
            		emlText = ["abstract", "additionalinfo"],
					emlMethods = ["methods"];
            		
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
					else if(_.contains(emlMethods, thisNode.localName)) {
						if(typeof modelJSON[thisNode.localName] === "undefined") modelJSON[thisNode.localName] = [];
						
						var emlMethods = new EMLMethods({
							objectDOM: thisNode,
							parentModel: model
						})

						modelJSON[thisNode.localName] = emlMethods;
	
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
            			//if(_.contains(this.get("intellRightsOptions"), value))
            			modelJSON["intellectualRights"] = value;
            			
            		}
            		//Parse Data Tables
            		else if(_.contains(emlEntities, thisNode.localName)){
            			var convertedName = this.nodeNameMap()[thisNode.localName] || thisNode.localName;

            			//Start an array of Entities
            			if(typeof modelJSON["entities"] == "undefined") 
            				modelJSON["entities"] = [];
            			
            			//Create the model
            			var entityModel;
            			if(thisNode.localName == "otherentity"){
            				entityModel = new EMLOtherEntity({
                				objectDOM: thisNode,
                				parentModel: model
                			}, {
                				parse: true
                			});
            			}
            			else{
            				entityModel = new EMLEntity({
                				objectDOM: thisNode,
                				parentModel: model
                			}, {
                				parse: true
                			});
            			}
            			
            			modelJSON["entities"].push(entityModel);            			
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
	           	
	           	//Serialize the basic text fields
	           	var basicText = ["alternateIdentifier", "title"];
	           	_.each(basicText, function(fieldName){
	           		var basicTextValues = this.get(fieldName);
	           		
	           		if(!Array.isArray(basicTextValues)) basicTextValues = [basicTextValues];
	           		
					// Remove existing nodes
	           		datasetNode.find(fieldName.toLowerCase()).remove();
					
					// Create new nodes
					var nodes = _.map(basicTextValues, function(value) {
						var node = document.createElement(fieldName.toLowerCase());
						$(node).text(value);
						return node;
					});

					// Insert new nodes
					if (fieldName.toLowerCase() === "alternateidentifier") {
						datasetNode.prepend(nodes);
					} else if (fieldName.toLowerCase() === "title") {
						if (datasetNode.find("alternateidentifier").length > 0) {
							datasetNode.find("alternateidentifier").last().after(nodes);
						} else {
							datasetNode.prepend(nodes);
						}
					}
	           	}, this);
	           	
	           	// Serialize the parts of EML that are eml-text modules
	           	var textFields = ["abstract"];
	           	_.each(textFields, function(field){
	           		
	           		var fieldName = this.nodeNameMap()[field] || field;
	           		
	           		// Get the EMLText model
	           		var emlTextModels = Array.isArray(this.get(field)) ? this.get(field) : [this.get(field)];
	           		if( ! emlTextModels.length ) return;
	           		
	           		// Get the node from the EML doc
	           		var nodes = datasetNode.find(fieldName);
	           		
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
	           		this.removeExtraNodes(nodes, emlTextModels);
	           			
	           	}, this);
	           	
	           	//Serialize the geographic coverage
				if ( typeof this.get('geoCoverage') !== 'undefined' && this.get('geoCoverage').length > 0) {		

					// Don't serialize if geoCoverage is invalid
					var validCoverages = _.filter(this.get('geoCoverage'), function(cov) {
						return cov.isValid();			
					});

					if ( datasetNode.find('coverage').length === 0 && validCoverages.length ) {
						var coveragePosition = this.getEMLPosition(eml, 'coverage');
						
						if(coveragePosition)
							coveragePosition.after(document.createElement('coverage'));
						else
							datasetNode.append(document.createElement('coverage'));
					}
					
					//Get the existing geo coverage nodes from the EML
					var existingGeoCov = datasetNode.find("geographiccoverage");

					//Update the DOM of each model
					_.each(validCoverages, function(cov, position){
						
						//Update the existing node if it exists
						if(existingGeoCov.length-1 >= position){
							$(existingGeoCov[position]).replaceWith(cov.updateDOM());
						}
						//Or, append new nodes
						else{
							var insertAfter = existingGeoCov.length? datasetNode.find("geographiccoverage").last() : null;
							
							if(insertAfter)
								insertAfter.after(cov.updateDOM());	
							else
								datasetNode.find("coverage").append(cov.updateDOM());
						}
					}, this);	 
					
					//Remove existing taxon coverage nodes that don't have an accompanying model
					this.removeExtraNodes(datasetNode.find("geographiccoverage"), validCoverages);					
				}
	           	
	           	//Serialize the taxonomic coverage
				if ( typeof this.get('taxonCoverage') !== 'undefined' && this.get('taxonCoverage').length > 0) {
					// TODO: This nonEmptyCoverages business could be wrapped up in a empty()
					// method on the model itself			
					var nonEmptyCoverages;

					// Don't serialize if taxonCoverage is empty
					nonEmptyCoverages = _.filter(this.get('taxonCoverage'), function(t) {
						return _.flatten(t.get('taxonomicClassification')).length > 0;			
					});

					if (nonEmptyCoverages.length > 0) {
						if (datasetNode.find('coverage').length === 0) {
							this.getEMLPosition(eml, 'coverage').after(document.createElement('coverage'));
						}
						
						//Get the existing taxon coverage nodes from the EML
						var existingTaxonCov = datasetNode.find("taxonomiccoverage");

						//Update the DOM of each model
						_.each(this.get("taxonCoverage"), function(taxonCoverage, position){
							
							//Update the existing taxonCoverage node if it exists
							if(existingTaxonCov.length-1 >= position){
								$(existingTaxonCov[position]).replaceWith(taxonCoverage.updateDOM());
							}
							//Or, append new nodes
							else{
								datasetNode.find('coverage').append(taxonCoverage.updateDOM());	
							}
						});	 
						
						//Remove existing taxon coverage nodes that don't have an accompanying model
						this.removeExtraNodes(existingTaxonCov, this.get("taxonCoverage"));
							
					}
				}
				
	        	//Serialize the temporal coverage
                if ( typeof this.get("temporalCoverage") !== "undefined" && this.get("temporalCoverage") !== null ) {
                	datasetNode.find("temporalcoverage").replaceWith(this.get("temporalCoverage").updateDOM());
                    
                }
                
                if(datasetNode.find("coverage").children().length == 0)
                	datasetNode.find("coverage").remove();
                
                //If there is no creator, create one from the user
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
	           	
				// Serialize methods
				if (this.get('methods')) {
					if(datasetNode.find('methods').length > 0) {
						datasetNode.find('methods').remove();
					}
					
					var methodsEl = this.get('methods').updateDOM();

					if ($(methodsEl).children().length > 0) {
						this.getEMLPosition(eml, "methods").after(methodsEl);
					}
					
				}
	           	//Serialize the keywords
				this.serializeKeywords(eml, "keywordSets");
	        	
	        	//Serialize the intellectual rights
	        	if(this.get("intellectualRights")){
	        		if(datasetNode.find("intellectualRights").length)
	        			datasetNode.find("intellectualRights").html("<para>" + this.get("intellectualRights") + "</para>")
	        		else{
	        			
	        			this.getEMLPosition(eml, "intellectualrights").after(
	        					$(document.createElement("intellectualRights"))
	        						.html("<para>" + this.get("intellectualRights") + "</para>"));
	        		}
	        	}
	        	
	        	//Serialize the project
	        	if(datasetNode.find("project").length)
	        		datasetNode.find("project").replaceWith(this.get("project").updateDOM());
	        	else if(this.get("project"))
	        		this.getEMLPosition(eml, "project").after(this.get("project").updateDOM());
	              	           	
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
            	
	           	_.each(this.get(type), function(party, i){
	           		//Get the existing nodes in the EML
	           		var existingNode = $(eml).find(type.toLowerCase() + "#" + party.get("xmlID"));
	           		
	           		if(!existingNode.length){
	           			existingNode = $(eml).find(type.toLowerCase());
	           			if( existingNode.length )
	           				existingNode = existingNode.eq(i);
	           		}
	           			
	           		//Update the EMLParty DOM and insert into the EML
	           		if ( existingNode.length ) {
	           			existingNode.replaceWith(party.updateDOM());
                        
	           		} else {
	           			var insertAfter = $(eml).find(type.toLowerCase()).last();
	           			if( !insertAfter.length ) {
	           				insertAfter = this.getEMLPosition(eml, type);
	           			    
	           			}
	           			
                        if ( insertAfter.length ) {
    	           			insertAfter.after(party.updateDOM());
                            
                        } else {
                            
                        }
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
            

			serializeKeywords: function(eml) {
				// Remove all existing keywordSets before appending
				$(eml).find('dataset').find('keywordset').remove();

				if (this.get('keywordSets').length == 0) return;

				// Create the new keywordSets nodes
				var nodes = _.map(this.get('keywordSets'), function(kwd) {
					return kwd.updateDOM();
				});

	        	this.getEMLPosition(eml, "keywordset").after(nodes);
			},

            /*
             * Remoes nodes from the EML that do not have an accompanying model 
             * (Were probably removed from the EML by the user during editing)
             */
            removeExtraNodes: function(nodes, models){
            	// Remove the extra nodes
           		var extraNodes =  nodes.length - models.length;
           		if(extraNodes > 0){
           			for(var i = models.length; i < nodes.length; i++){
           				$(nodes[i]).remove();
           			}
           		}
            },
            
            /*
             * Saves the EML document to the server using the DataONE API
             */
            save: function(attributes, options){
                
                //Validate before we try anything else
                if(!this.isValid()){
                	this.trigger("cancelSave");
                	return false;
                }
                
                // Set missing file names before saving
                if ( ! this.get("fileName") ) {
                    this.setMissingFileName();                 
                }
                
            	//Set the upload transfer as in progress
   			 	this.set("uploadStatus", "p"); 
                
                //Create the creator from the current user if none is provided
                if(!this.get("creator").length){
	           		var party = new EMLParty({ parentModel: this, type: "creator" });
	           		
	           		party.createFromUser();
	           		
	           		this.set("creator", [party]);
                }
                
                //Create the contact from the current user if none is provided
                if(!this.get("contact").length){
	           		var party = new EMLParty({ parentModel: this, type: "contact" });
	           		
	           		party.createFromUser();
	           		
	           		this.set("contact", [party]);
                }
   			 	
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
	   				this.trigger("cancelSave");
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
                        model.fetch({merge: true, sysMeta: true});
						model.trigger("successSaving", model);                        
					},
					error: function(model, response, xhr){
						console.log("error updating EML: ", response.responseText);
						model.set("uploadStatus", "e");
						model.resetID();
						
						var errorDOM       = $($.parseHTML(response.responseText)),
							errorContainer = errorDOM.filter("error"),
							msgContainer   = errorContainer.length? errorContainer.find("description") : errorDOM,
							errorMsg       = msgContainer.length? msgContainer.text() : errorDOM;
						
						model.trigger("errorSaving", errorMsg);
					}
	   			}, MetacatUI.appUserModel.createAjaxSettings());
	   			
	   			return Backbone.Model.prototype.save.call(this, attributes, saveOptions);		
            },
            
            
            /*
             * Checks if this EML model has all the required values necessary to save to the server
             */
            validate: function() {
            	if(!this.get("title").length){
            		this.trigger("required", ["title"]);
            		
            		var error = "Title is required";
            		
            		//Set the validation error message
            		this.set("validationError", error);
            		
            		return error;
            	}
            	else{
            		this.set("validationError", null);
            		return;
            	}
            },
            
            /*
             * Sends an AJAX request to fetch the system metadata for this EML object.
             * Will not trigger a sync event since it does not use Backbone.Model.fetch 
             */
            fetchSystemMetadata: function(options){

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
	           		             "distribution", "coverage", "purpose", "maintenance", "contact", "publisher", "pubplace", 
	           		             "methods", "project", "datatable", "spatialraster", "spatialvector", "storedprocedure", "view", "otherentity"];
            	
            	var position = _.indexOf(nodeOrder, nodeName.toLowerCase());
            	if(position == -1)
            		return false;
            	
            	//Go through each node in the node list and find the position where this node will be inserted after
            	for(var i=position-1; i>=0; i--){
            		if($(eml).find(nodeOrder[i]).length)
            			return $(eml).find(nodeOrder[i]).last();
            	}
            	
            	return false;
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
            addEntity: function(emlEntity, position) {
            	//Get the current list of entities
				var currentEntities = this.get("entities");
				
				if(!position)
					currentEntities.push(emlEntity);
				else
					//Add the entity model to the entity array
					currentEntities.splice(position, 0, entityModel);
				
				this.trigger("change:entities");
				
                return this;
            },
            /*
             Remove an entity from the EML 2.1.1 object
            */
            removeEntity: function(emlEntityId) {
                
            },
            
            /*
             * Find the entity model for a given DataONEObject
             */
            getEntity: function(dataONEObj){

            	var entity = _.find(this.get("entities"), function(e){
            		if(e.get("downloadID") && e.get("downloadID") == dataONEObj.get("id"))
            			return true;
            		else if( e.get("entityName") == dataONEObj.get("fileName") )
            			return true;
            	});
            	
            	if(entity)
            		return entity;
            	
            	var matchingTypes = _.filter(this.get("entities"), function(e){
            		return (e.get("formatName") == (dataONEObj.get("formatId") || dataONEObj.get("mediaType")));
            	});
            	
            	if(matchingTypes.length == 1)
            		return matchingTypes[0];
            	
            	return false;
            		
            },
            
            createUnits: function(){
            	var units = new Units();
            	units.fetch();
            	this.set("units", units);
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
            },
            
            cleanUpXML: function(xmlString){
            	xmlString.replace("<source>", "<sourced>");
            	xmlString.replace("</source>", "</sourced>");
            	
            	return xmlString;
            }
            
        });
        return EML211;
    }
    
);