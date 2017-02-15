/* global define */
"use strict";

define(['jquery', 'underscore', 'backbone', 'rdflib', "uuid", "md5",
    'models/DataONEObject', 'models/metadata/ScienceMetadata', 'models/metadata/eml211/EML211'],
    function($, _, Backbone, rdf, uuid, md5, DataONEObject, ScienceMetadata, EML211) {
    
        /* 
         A DataPackage represents a hierarchical collection of 
         packages, metadata, and data objects, modeling an OAI-ORE RDF graph.
         TODO: incorporate Backbone.UniqueModel
        */
        var DataPackage = Backbone.Collection.extend({
                        
            // The package identifier
            id: null,
            
            // The type of the object (DataPackage, Metadata, Data)
            type: 'DataPackage',
            
            // Simple queue to enqueue file transfers. Use push() and shift()
            // to add and remove items. If this gets to large/slow, possibly
            // switch to http://code.stephenmorley.org/javascript/queues/
            transferQueue: [],
            
            // A flag ued for the package's edit status. Can be 
            // set to false to 'lock' the package
            editable: true,
            
            // The RDF graph representing this data package
            dataPackageGraph: null,
            
            //A DataONEObject representing the resource map itself
            packageModel: null,
            
            // The science data identifiers associated with this 
            // data package (from cito:documents), mapped to the science metadata
            // identifier that documents it
            // Not to be changed after initial fetch - this is to keep track of the relationships in their original state
            originalIsDocBy: {},
            
            // An array of ids that are aggregated in the resource map on the server. 
            // Taken from the original RDF XML that was fetched from the server.
            // Used for comparing the original aggregation with the aggregation of this collection.
            originalMembers: [],
                  
            // Keep the collection sorted by model "sortOrder".  The three model types
            // are ordered as:
            //  Metadata: 1
            //  Data: 2
            //  DataPackage: 3
            // See getMember(). We do this so that Metadata get rendered first, and Data are
            // rendered as DOM siblings of the Metadata rows of the DataPackage table.
            comparator: "sortOrder",
            
            // The nesting level in a data package hierarchy
            nodeLevel: 0,
            
            //Define the namespaces used in the RDF XML
            namespaces: {
    			RDF:     "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    			FOAF:    "http://xmlns.com/foaf/0.1/",
    			OWL:     "http://www.w3.org/2002/07/owl#",
    			DC:      "http://purl.org/dc/elements/1.1/",
    			ORE:     "http://www.openarchives.org/ore/terms/",
    			DCTERMS: "http://purl.org/dc/terms/",
    			CITO:    "http://purl.org/spar/cito/",
    			XSD:     "http://www.w3.org/2001/XMLSchema#"
    		},
            
            // Constructor: Initialize a new DataPackage
            initialize: function(models, options) {
                if(typeof options == "undefined")
                	var options = {};
                
                // Create an initial RDF graph 
                this.dataPackageGraph = rdf.graph();
                
                //Set the id or create a new one
                this.id = options.id || "urn:uuid:" + uuid.v4();
                
                // Create a DataONEObject to represent this resource map
                this.packageModel = new DataONEObject({
                    formatType: "RESOURCE",
                    type: "DataPackage",
                    formatId: "http://www.openarchives.org/ore/terms",
                    childPackages: {},
                    id: this.id
                });
                
                if ( typeof options.packageModel !== "undefined" ) {
                    // use the given package model
                	this.packageModel = new DataONEObject(options.packageModel);
                    
                }
                this.id = this.packageModel.id;
                
                this.on("add", this.saveReference);
                this.on("add", this.triggerComplete);
                this.on("successSaving", this.updateRelationships);
                
                return this;  
            },
            
            // Build the DataPackage URL based on the MetacatUI.appModel.objectServiceUrl 
            // and id or seriesid
            url: function() {
                              
                return MetacatUI.appModel.get("objectServiceUrl") + 
                    (encodeURIComponent(this.packageModel.get("id")) || encodeURIComponent(this.packageModel.get("seriesid")));
                
            },
            
            /* 
             * The DataPackage collection stores DataPackages and 
             * DataONEObjects, including Metadata nad Data objects.
             * Return the correct model based on the type
             */
            model: function (attrs, options) {
                  
                        //if(!attrs.formatid) return;
                                                
                switch ( attrs.formatid ) {
                
                    case "http://www.openarchives.org/ore/terms":
                        return new DataPackage(null, {packageModel: attrs}); // TODO: is this correct?
                        
                    case "eml://ecoinformatics.org/eml-2.0.0":
                        return new EML211(attrs, options);
                                                                        
                    case "eml://ecoinformatics.org/eml-2.0.1":
                        return new EML211(attrs, options);
                                                                
                    case "eml://ecoinformatics.org/eml-2.1.0":
                        return new EML211(attrs, options);
                                                                    
                    case "eml://ecoinformatics.org/eml-2.1.1":
                        return new EML211(attrs, options);
                                                                       
                    case "eml://ecoinformatics.org/eml-2.1.1":
                        return new EML211(attrs, options);
                                                                   
                    case "-//ecoinformatics.org//eml-access-2.0.0beta4//EN":
                        return new ScienceMetadata(attrs, options);
                                                                    
                    case "-//ecoinformatics.org//eml-access-2.0.0beta6//EN":
                        return new ScienceMetadata(attrs, options);
                                                                    
                    case "-//ecoinformatics.org//eml-attribute-2.0.0beta4//EN":
                        return new ScienceMetadata(attrs, options);
                                                                    
                    case "-//ecoinformatics.org//eml-attribute-2.0.0beta6//EN":
                        return new ScienceMetadata(attrs, options);
                                                                    
                    case "-//ecoinformatics.org//eml-constraint-2.0.0beta4//EN":
                        return new ScienceMetadata(attrs, options);
                                                                    
                    case "-//ecoinformatics.org//eml-constraint-2.0.0beta6//EN":
                        return new ScienceMetadata(attrs, options);
                                                                    
                    case "-//ecoinformatics.org//eml-coverage-2.0.0beta4//EN":
                        return new ScienceMetadata(attrs, options);
                                                                    
                    case "-//ecoinformatics.org//eml-coverage-2.0.0beta6//EN":
                        return new ScienceMetadata(attrs, options);
                                                                    
                    case "-//ecoinformatics.org//eml-dataset-2.0.0beta4//EN":
                        return new ScienceMetadata(attrs, options);
                                                                    
                    case "-//ecoinformatics.org//eml-dataset-2.0.0beta6//EN":
                        return new ScienceMetadata(attrs, options);
                                                                    
                    case "-//ecoinformatics.org//eml-distribution-2.0.0beta4//EN":
                        return new ScienceMetadata(attrs, options);
                                                                    
                    case "-//ecoinformatics.org//eml-distribution-2.0.0beta6//EN":
                        return new ScienceMetadata(attrs, options);
                                                                    
                    case "-//ecoinformatics.org//eml-entity-2.0.0beta4//EN":
                        return new ScienceMetadata(attrs, options);
                                                                    
                    case "-//ecoinformatics.org//eml-entity-2.0.0beta6//EN":
                        return new ScienceMetadata(attrs, options);
                                                                    
                    case "-//ecoinformatics.org//eml-literature-2.0.0beta4//EN":
                        return new ScienceMetadata(attrs, options);
                                                                    
                    case "-//ecoinformatics.org//eml-literature-2.0.0beta6//EN":
                        return new ScienceMetadata(attrs, options);
                                                                    
                    case "-//ecoinformatics.org//eml-party-2.0.0beta4//EN":
                        return new ScienceMetadata(attrs, options);
                                                                    
                    case "-//ecoinformatics.org//eml-party-2.0.0beta6//EN":
                        return new ScienceMetadata(attrs, options);
                                                                    
                    case "-//ecoinformatics.org//eml-physical-2.0.0beta4//EN":
                        return new ScienceMetadata(attrs, options);
                                                                    
                    case "-//ecoinformatics.org//eml-physical-2.0.0beta6//EN":
                        return new ScienceMetadata(attrs, options);
                                                                    
                    case "-//ecoinformatics.org//eml-project-2.0.0beta4//EN":
                        return new ScienceMetadata(attrs, options);
                                                                    
                    case "-//ecoinformatics.org//eml-project-2.0.0beta6//EN":
                        return new ScienceMetadata(attrs, options);
                                                                    
                    case "-//ecoinformatics.org//eml-protocol-2.0.0beta4//EN":
                        return new ScienceMetadata(attrs, options);
                                                                    
                    case "-//ecoinformatics.org//eml-protocol-2.0.0beta6//EN":
                        return new ScienceMetadata(attrs, options);
                                                                    
                    case "-//ecoinformatics.org//eml-resource-2.0.0beta4//EN":
                        return new ScienceMetadata(attrs, options);
                                                                    
                    case "-//ecoinformatics.org//eml-resource-2.0.0beta6//EN":
                        return new ScienceMetadata(attrs, options);
                                                                    
                    case "-//ecoinformatics.org//eml-software-2.0.0beta4//EN":
                        return new ScienceMetadata(attrs, options);
                                                                    
                    case "-//ecoinformatics.org//eml-software-2.0.0beta6//EN":
                        return new ScienceMetadata(attrs, options);
                                                                    
                    case "FGDC-STD-001-1998":
                        return new ScienceMetadata(attrs, options);
                                                                    
                    case "FGDC-STD-001.1-1999":
                        return new ScienceMetadata(attrs, options);
                                                                    
                    case "FGDC-STD-001.2-1999":
                        return new ScienceMetadata(attrs, options);
                                                                    
                    case "INCITS-453-2009":
                        return new ScienceMetadata(attrs, options);
                                                                    
                    case "ddi:codebook:2_5":
                        return new ScienceMetadata(attrs, options);
                                                                    
                    case "http://datacite.org/schema/kernel-3.0":
                        return new ScienceMetadata(attrs, options);
                                                                    
                    case "http://datacite.org/schema/kernel-3.1":
                        return new ScienceMetadata(attrs, options);
                                                                    
                    case "http://datadryad.org/profile/v3.1":
                        return new ScienceMetadata(attrs, options);
                                                                    
                    case "http://digir.net/schema/conceptual/darwin/2003/1.0/darwin2.xsd":
                        return new ScienceMetadata(attrs, options);
                                                                    
                    case "http://ns.dataone.org/metadata/schema/onedcx/v1.0":
                        return new ScienceMetadata(attrs, options);
                                                                    
                    case "http://purl.org/dryad/terms/":
                        return new ScienceMetadata(attrs, options);
                                                                    
                    case "http://purl.org/ornl/schema/mercury/terms/v1.0":
                        return new ScienceMetadata(attrs, options);
                                                                    
                    case "http://rs.tdwg.org/dwc/xsd/simpledarwincore/":
                        return new ScienceMetadata(attrs, options);
                                                                    
                    case "http://www.cuahsi.org/waterML/1.0/":
                        return new ScienceMetadata(attrs, options);
                                                                    
                    case "http://www.cuahsi.org/waterML/1.1/":
                        return new ScienceMetadata(attrs, options);
                                                                    
                    case "http://www.esri.com/metadata/esriprof80.dtd":
                        return new ScienceMetadata(attrs, options);
                                                                    
                    case "http://www.icpsr.umich.edu/DDI":
                        return new ScienceMetadata(attrs, options);
                                                                    
                    case "http://www.isotc211.org/2005/gmd":
                        return new ScienceMetadata(attrs, options);
                                                                    
                    case "http://www.isotc211.org/2005/gmd-noaa":
                        return new ScienceMetadata(attrs, options);
                                                                    
                    case "http://www.loc.gov/METS/":
                        return new ScienceMetadata(attrs, options);
                                                                    
                    case "http://www.unidata.ucar.edu/namespaces/netcdf/ncml-2.2":
                        return new ScienceMetadata(attrs, options);
                                                                        
                    default:
                        return new DataONEObject(attrs, options);
                                                
                }
            },
            
            /*
             *  Overload fetch calls for a DataPackage
             */
            fetch: function(options) {
                console.log("DataPackage: fetch() called.");
                
                //Fetch the system metadata for this resource map 
                this.packageModel.fetch();
                
                //Set some custom fetch options
                var fetchOptions = _.extend({dataType: "text"}, options);
                
                //Add the authorization options 
                fetchOptions = _.extend(fetchOptions, MetacatUI.appUserModel.createAjaxSettings());
                
                //Fetch the resource map RDF XML
                return Backbone.Collection.prototype.fetch.call(this, fetchOptions);
            },
            
            /* 
             * Deserialize a Package from OAI-ORE RDF XML
             */
            parse: function(response, options) {
                console.log("DataPackage: parse() called.")
                
                //Save the raw XML in case it needs to be used later
                this.objectXML = response;
                
                var RDF =     rdf.Namespace(this.namespaces.RDF),
                    FOAF =    rdf.Namespace(this.namespaces.FOAF),
                    OWL =     rdf.Namespace(this.namespaces.OWL),
                    DC =      rdf.Namespace(this.namespaces.DC),
                    ORE =     rdf.Namespace(this.namespaces.ORE),
                    DCTERMS = rdf.Namespace(this.namespaces.DCTERMS),
                    CITO =    rdf.Namespace(this.namespaces.CITO),
                    XSD =     rdf.Namespace(this.namespaces.XSD);
                    
                var memberStatements = [],
                    memberURIParts,
                    memberPIDStr,
                    memberPID,
                    memberPIDs = [],
                    memberModel,
                    documentsStatements,
                    scimetaID, // documentor
                    scidataID, // documentee
                    models = []; // the models returned by parse()
                    
                try {
                    rdf.parse(response, this.dataPackageGraph, this.url(), 'application/rdf+xml');          
                    
                  	// List the package members
                    memberStatements = this.dataPackageGraph.statementsMatching(
                          undefined, ORE("aggregates"), undefined, undefined);               
                    
                    // Get system metadata for each member to eval the formatId
                    _.each(memberStatements, function(memberStatement){
                        memberURIParts = memberStatement.object.value.split("/");
                        memberPIDStr = _.last(memberURIParts);
                        memberPID = decodeURIComponent(memberPIDStr);   
                                               
                        if ( memberPID )
                            memberPIDs.push(memberPID);
                        
                        //TODO: Test passing merge:true when adding a model and this if statement may not be necessary
                        //Create a DataONEObject model to represent this collection member and add to the collection
                        if(!_.contains(this.pluck("id"), memberPID)){
                        	 
                        	 memberModel = this.add(new DataONEObject({
                        		id: memberPID,
                        		resourceMap: [this.packageModel.get("id")]
                        	}), { silent: true });
                        	 
                        }
                        //If the model already exists, add this resource map ID to it's list of resource maps
                        else{
                        	memberModel = this.get(memberPID);
                        	var rMaps = memberModel.get("resourceMap");
                        	if(rMaps && Array.isArray(rMaps) && !_.contains(rMaps, this.packageModel.get("id"))) rMaps.push(this.packageModel.get("id"));
	                      	else if(rMaps && !Array.isArray(rMaps)) rMaps = [rMaps, this.packageModel.get("id")];
	                      	else rMaps = [this.packageModel.get("id")];
                        }
                                              
                    }, this);    
                    
                    //Save the list of original ids
                    this.originalMembers = memberPIDs; 
                    
                    // Get the isDocumentedBy relationships
                    documentsStatements = this.dataPackageGraph.statementsMatching(
                        undefined, CITO("documents"), undefined, undefined);
                                            
                    _.each(documentsStatements, function(documentsStatement) {
                    
                          // Extract and URI-decode the metadata pid
                          scimetaID = decodeURIComponent(
                                _.last(documentsStatement.subject.value.split("/")));
                          
                          // Extract and URI-decode the data pid
                          scidataID = decodeURIComponent(
                              _.last(documentsStatement.object.value.split("/")));
                          
                          // Store the isDocumentedBy relationship
                          if(typeof this.originalIsDocBy[scidataID] == "undefined")
                               this.originalIsDocBy[scidataID] = [scimetaID];
                          else if(Array.isArray(this.originalIsDocBy[scidataID]) && !_.contains(this.originalIsDocBy[scidataID], scimetaID))
                        	  this.originalIsDocBy[scidataID].push(scimetaID);
                          else
                        	  this.originalIsDocBy[scidataID] = _.uniq([this.originalIsDocBy[scidataID], scimetaID]);
                    
                          //Find the model in this collection for this data object
                          var dataObj = this.get(scidataID);
                          
                          if(dataObj){
	                          //Get the isDocumentedBy field
	                       	  var isDocBy = dataObj.get("isDocumentedBy");
	                      	  if(isDocBy && Array.isArray(isDocBy) && !_.contains(isDocBy, scimetaID)) isDocBy.push(scimetaID);
	                      	  else if(isDocBy && !Array.isArray(isDocBy)) isDocBy = [isDocBy, scimetaID];
	                      	  else isDocBy = [scimetaID];
	                      	  
	                      	  //Set the isDocumentedBy field
	                      	  dataObj.set("isDocumentedBy", isDocBy);
                          }
                    }, this);  
                    
                    //Retrieve the model for each member 
                    _.each(memberPIDs, function(pid){
                    	
                    	memberModel = this.get(pid);
                        
                    	var collection = this;
                        
                    	memberModel.fetch();
                    	memberModel.once("sync",
                        	function(oldModel){
                        		
                    			//Get the right model type based on the model values
                        		var newModel = collection.getMember(oldModel);
                        		              
                                //If the model type has changed, then mark the model as unsynced, since there may be custom fetch() options for the new model
                                if(oldModel.type != newModel.type){
                                	newModel.set("synced", false);
                                	
                                	newModel.fetch();
                                	newModel.once("sync", function(fetchedModel){
                                			fetchedModel.set("synced", true);
                                			collection.add(fetchedModel, { merge: true });
                                			
                                			//Trigger a replace event so other parts of the app know when a model has been replaced with a different type
                                			oldModel.trigger("replace", newModel);
                                		});
                                }
                                else{
                                	newModel.set("synced", true);
                                	collection.add(newModel, { replace: true });  
                                }
                        	});
                    	
                    }, this);
                                     
                } catch (error) {
                    console.log(error);
                    
                }
                                
                return models;                
            },
            
            /*
             * Use the DataONEObject parseSysMeta() function
             */
            parseSysMeta: function(){
            	return DataONEObject.parseSysMeta.call(this, arguments[0]);
            },
            
            /*
    		 * Overwrite the Backbone.Collection.sync() function to set custom options
    		 */
    		save: function(options){
    			if(!options) var options = {};
    			
    			//Get the system metadata first if we haven't retrieved it yet
    			if(!this.packageModel.get("sysMetaXML")){
    				var collection = this;
    				this.packageModel.fetch({
    					success: function(){
    						collection.save(options);
    					}
    				});
    				return;
    			}
    			
    			//If we want to update the system metadata only, 
    			// then update via the DataONEObject model and exit
    			if(options.sysMetaOnly){
    				this.packageModel.save(null, options);
    				return;
    			}
    			
    			//First save all the models of the collection, if needed
    			var modelsInProgress = [];
    			this.forEach(function(model){
    				//If this model is in progress or in the queue
    				if(model.get("uploadStatus") == "p")
    					modelsInProgress.push(model);
    				else if(model.get("uploadStatus") == "q"){
    					model.save();  				
    					modelsInProgress.push(model);
    					this.listenToOnce(model, "sync", this.save);
    				}
    			}, this);

    			//If there are still models in progress of uploading, then exit. (We will return when they are synced to upload the resource map)
    			if(modelsInProgress.length) return;
    			
    			//Do we need to update this resource map?
    			if(!this.needsUpdate()) return;
    			
    			var requestType;
    			
				//Set a new id and keep our old id
    			if(this.packageModel.isNew()){					
					requestType = "POST";
    			}
    			else{
    				//Update the identifier for this object
					this.packageModel.updateID();
    				requestType = "PUT";
    			}
    			
    			//Create a FormData object to send data with the XHR
    			var formData = new FormData();

    			//Add the identifier to the XHR data
    			if(this.packageModel.isNew()){
    				formData.append("pid", this.packageModel.get("id"));
    			}
    			else{
					//Add the ids to the form data
					formData.append("newPid", this.packageModel.get("id"));
					formData.append("pid", this.packageModel.get("oldPid"));
    			}
    			
    			try {
					//Create the resource map XML
					var mapXML = this.serialize();
    			}
    			catch (serializationException) {
    				console.log(serializationException);
    				    				
    				//If serialization failed, revert back to our old id
    				this.packageModel.resetID();
    				
    				this.trigger("errorSaving");

    				return;
    			}
    			
				var mapBlob = new Blob([mapXML], {type : 'application/xml'});
				formData.append("object", mapBlob);
				
				//Get the size of the new resource map
				this.packageModel.set("size", mapBlob.size);
				
				//Get the new checksum of the resource map
				var checksum = md5(mapXML);
				this.packageModel.set("checksum", checksum);
				this.packageModel.set("checksumAlgorithm", "MD5");
				
    			//Create the system metadata
    			var sysMetaXML = this.packageModel.serializeSysMeta();
    			
    			//Send the system metadata 
    			var xmlBlob = new Blob([sysMetaXML], {type : 'application/xml'});
    			formData.append("sysmeta", xmlBlob, "sysmeta");   						
				
				console.log("new package id: " + this.packageModel.get("id"));
				console.log(mapXML);
				
				var collection = this;
				var requestSettings = {
						url: MetacatUI.appModel.get("objectServiceUrl"),
						type: requestType,
						cache: false,
						contentType: false,
						processData: false,
						data: formData,
						success: function(response){
							console.log("yay, map is saved");
							
							//Update the object XML
							collection.objectXML = mapXML;
							collection.packageModel.set("sysMetaXML", collection.packageModel.serializeSysMeta());
							collection.trigger("successSaving");
						},
						error: function(data){
							console.log("error udpating object");
							
							//Reset the id back to its original state
							collection.packageModel.resetID();
							
							collection.trigger("error", data.responseText);
						}
				}
				$.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));
    		},
            
            /*
             * When a data package member updates, we evaluate it for its formatid,
             * and update it appropriately if it is not a data object only
             */
            getMember: function(context, args) {
                var memberModel = {};
                
                switch ( context.get("formatId") ) {
                    
                    case "http://www.openarchives.org/ore/terms":
                        context.attributes.id = context.id;
                        context.attributes.type = "DataPackage";
                        context.attributes.childPackages = {};
                        memberModel = new DataPackage(null, {packageModel: context.attributes});
                        this.packageModel.get("childPackages")[memberModel.packageModel.id] = memberModel;
                        break;
                        
                    case "eml://ecoinformatics.org/eml-2.0.0":
                        context.set({type: "Metadata", sortOrder: 1});
                        memberModel = new EML211(context.attributes);
                        break;
                        
                    case "eml://ecoinformatics.org/eml-2.0.1":
                        context.set({type: "Metadata", sortOrder: 1});
                        memberModel = new EML211(context.attributes);
                        break;
                    
                    case "eml://ecoinformatics.org/eml-2.1.0":
                        context.set({type: "Metadata", sortOrder: 1});
                        memberModel = new EML211(context.attributes);
                        break;
                    
                    case "eml://ecoinformatics.org/eml-2.1.1":
                        context.set({type: "Metadata", sortOrder: 1});
                        memberModel = new EML211(context.attributes);
                        break;
                        
                    case "-//ecoinformatics.org//eml-access-2.0.0beta4//EN" :
                        context.set({type: "Metadata", sortOrder: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "-//ecoinformatics.org//eml-access-2.0.0beta6//EN" :
                        context.set({type: "Metadata", sortOrder: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "-//ecoinformatics.org//eml-attribute-2.0.0beta4//EN" :
                        context.set({type: "Metadata", sortOrder: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "-//ecoinformatics.org//eml-attribute-2.0.0beta6//EN" :
                        context.set({type: "Metadata", sortOrder: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "-//ecoinformatics.org//eml-constraint-2.0.0beta4//EN" :
                        context.set({type: "Metadata", sortOrder: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "-//ecoinformatics.org//eml-constraint-2.0.0beta6//EN" :
                        context.set({type: "Metadata", sortOrder: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "-//ecoinformatics.org//eml-coverage-2.0.0beta4//EN" :
                        context.set({type: "Metadata", sortOrder: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "-//ecoinformatics.org//eml-coverage-2.0.0beta6//EN" :
                        context.set({type: "Metadata", sortOrder: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "-//ecoinformatics.org//eml-dataset-2.0.0beta4//EN" :
                        context.set({type: "Metadata", sortOrder: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "-//ecoinformatics.org//eml-dataset-2.0.0beta6//EN" :
                        context.set({type: "Metadata", sortOrder: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "-//ecoinformatics.org//eml-distribution-2.0.0beta4//EN" :
                        context.set({type: "Metadata", sortOrder: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "-//ecoinformatics.org//eml-distribution-2.0.0beta6//EN" :
                        context.set({type: "Metadata", sortOrder: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "-//ecoinformatics.org//eml-entity-2.0.0beta4//EN" :
                        context.set({type: "Metadata", sortOrder: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "-//ecoinformatics.org//eml-entity-2.0.0beta6//EN" :
                        context.set({type: "Metadata", sortOrder: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "-//ecoinformatics.org//eml-literature-2.0.0beta4//EN" :
                        context.set({type: "Metadata", sortOrder: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "-//ecoinformatics.org//eml-literature-2.0.0beta6//EN" :
                        context.set({type: "Metadata", sortOrder: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "-//ecoinformatics.org//eml-party-2.0.0beta4//EN" :
                        context.set({type: "Metadata", sortOrder: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "-//ecoinformatics.org//eml-party-2.0.0beta6//EN" :
                        context.set({type: "Metadata", sortOrder: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "-//ecoinformatics.org//eml-physical-2.0.0beta4//EN" :
                        context.set({type: "Metadata", sortOrder: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "-//ecoinformatics.org//eml-physical-2.0.0beta6//EN" :
                        context.set({type: "Metadata", sortOrder: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "-//ecoinformatics.org//eml-project-2.0.0beta4//EN" :
                        context.set({type: "Metadata", sortOrder: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "-//ecoinformatics.org//eml-project-2.0.0beta6//EN" :
                        context.set({type: "Metadata", sortOrder: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "-//ecoinformatics.org//eml-protocol-2.0.0beta4//EN" :
                        context.set({type: "Metadata", sortOrder: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "-//ecoinformatics.org//eml-protocol-2.0.0beta6//EN" :
                        context.set({type: "Metadata", sortOrder: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "-//ecoinformatics.org//eml-resource-2.0.0beta4//EN" :
                        context.set({type: "Metadata", sortOrder: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "-//ecoinformatics.org//eml-resource-2.0.0beta6//EN" :
                        context.set({type: "Metadata", sortOrder: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "-//ecoinformatics.org//eml-software-2.0.0beta4//EN" :
                        context.set({type: "Metadata", sortOrder: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "-//ecoinformatics.org//eml-software-2.0.0beta6//EN" :
                        context.set({type: "Metadata", sortOrder: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "FGDC-STD-001-1998" :
                        context.set({type: "Metadata", sortOrder: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "FGDC-STD-001.1-1999" :
                        context.set({type: "Metadata", sortOrder: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "FGDC-STD-001.2-1999" :
                        context.set({type: "Metadata", sortOrder: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "INCITS-453-2009" :
                        context.set({type: "Metadata", sortOrder: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "ddi:codebook:2_5" :
                        context.set({type: "Metadata", sortOrder: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "http://datacite.org/schema/kernel-3.0" :
                        context.set({type: "Metadata", sortOrder: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "http://datacite.org/schema/kernel-3.1" :
                        context.set({type: "Metadata", sortOrder: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "http://datadryad.org/profile/v3.1" :
                        context.set({type: "Metadata", sortOrder: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "http://digir.net/schema/conceptual/darwin/2003/1.0/darwin2.xsd" :
                        context.set({type: "Metadata", sortOrder: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "http://ns.dataone.org/metadata/schema/onedcx/v1.0" :
                        context.set({type: "Metadata", sortOrder: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "http://purl.org/dryad/terms/" :
                        context.set({type: "Metadata", sortOrder: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "http://purl.org/ornl/schema/mercury/terms/v1.0" :
                        context.set({type: "Metadata", sortOrder: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "http://rs.tdwg.org/dwc/xsd/simpledarwincore/" :
                        context.set({type: "Metadata", sortOrder: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "http://www.cuahsi.org/waterML/1.0/" :
                        context.set({type: "Metadata", sortOrder: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "http://www.cuahsi.org/waterML/1.1/" :
                        context.set({type: "Metadata", sortOrder: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "http://www.esri.com/metadata/esriprof80.dtd" :
                        context.set({type: "Metadata", sortOrder: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "http://www.icpsr.umich.edu/DDI" :
                        context.set({type: "Metadata", sortOrder: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "http://www.isotc211.org/2005/gmd" :
                        context.set({type: "Metadata", sortOrder: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "http://www.isotc211.org/2005/gmd-noaa" :
                        context.set({type: "Metadata", sortOrder: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "http://www.loc.gov/METS/" :
                        context.set({type: "Metadata", sortOrder: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                    
                    case "http://www.unidata.ucar.edu/namespaces/netcdf/ncml-2.2" :
                        context.set({type: "Metadata", sortOrder: 1});
                        memberModel = new ScienceMetadata(context.attributes);
                        break;
                        
                    default:
                        // For other data formats, keep just the DataONEObject sysmeta
                        context.set({type: "Data", sortOrder: 2});
                        memberModel = context;
                                                
                }
                
                if ( ! memberModel.packageModel ) {
                    // We have a model
                    memberModel.set("nodeLevel", this.packageModel.get("nodeLevel")); // same level for all members 
                    
                } else {
                    // We have a nested collection
                    memberModel.packageModel.set("nodeLevel", this.packageModel.get("nodeLevel") + 1);
                }
                
                return memberModel;
                
            },
            
            triggerComplete: function(model){
            	//Check if the collection is done being retrieved
                var notSynced = this.reject(function(m){
                	return (m.get("synced") || m.get("id") == model.get("id"));
                });
                
                //If there are any models that are not synced yet, the collection is not complete
                if( notSynced.length > 0 )
                    return;
                
                //If the number of models in this collection does not equal the number of objects referenced in the RDF XML, the collection is not complete
                if(this.originalMembers.length > this.length)
                	return;
                    
                this.sort();
                this.trigger("complete", this);  
                
                console.log("DataPackage is complete. All " + this.length + " models have been synced and added.");
            },
            
            /* 
             * Serialize the DataPackage to OAI-ORE RDF XML
             */
            serialize: function() {
            	//Create an RDF serializer
            	var serializer = rdf.Serializer(),
                    cnResolveUrl,
                    idNode,
                    idStatement,
                    oldPidVariations,
                    aggregationNode,
                    aggByStatements,
                    modifiedDate,
                    idsFromModel;
                
                    serializer.store = this.dataPackageGraph;
                
            	
            	//Define the namespaces
                var ORE  = rdf.Namespace(this.namespaces.ORE),
                	CITO = rdf.Namespace(this.namespaces.CITO),
                    DC = rdf.Namespace(this.namespaces.DC),
                    DCTERMS = rdf.Namespace(this.namespaces.DCTERMS),
                    FOAF = rdf.Namespace(this.namespaces.FOAF),
                    RDF = rdf.Namespace(this.namespaces.RDF),
                    XSD = rdf.Namespace(this.namespaces.XSD);
            	            
            	//Get the pid of this package - depends on whether we are updating or creating a resource map
                var pid = this.packageModel.get("id"),
                	oldPid = this.packageModel.get("oldPid"),
                	updating = oldPid ? true : false;
                
                //Update the pids in the RDF graph only if we are updating the resource map with a new pid
                if( updating ) {
                	
                	//Find the identifier statement in the resource map
    				idNode =  rdf.lit(oldPid);
    				idStatement = this.dataPackageGraph.statementsMatching(undefined, undefined, idNode);
    				
    				//Get the CN Resolve Service base URL from the resource map (mostly important in dev environments where it will not always be cn.dataone.org)
    				cnResolveUrl = this.dataPackageGraph.cnResolveUrl || 
    					idStatement[0].subject.value.substring(0, idStatement[0].subject.value.indexOf(oldPid)) ||
    					idStatement[0].subject.value.substring(0, idStatement[0].subject.value.indexOf(encodeURIComponent(oldPid)));
    				this.dataPackageGraph.cnResolveUrl = cnResolveUrl;
    				
    				//Create variations of the resource map ID using the resolve URL so we can always find it in the RDF graph
    	            oldPidVariations = [oldPid, encodeURIComponent(oldPid), cnResolveUrl+ encodeURIComponent(oldPid)];
    				
                	//Get all the isAggregatedBy statements
    	            aggregationNode =  rdf.sym(cnResolveUrl + encodeURIComponent(oldPid) + "#aggregation");
    	            aggByStatements = this.dataPackageGraph.statementsMatching(undefined, ORE("isAggregatedBy"));
    	            
    	            //Using the isAggregatedBy statements, find all the DataONE object ids in the RDF graph
    	            var idsFromXML = [];
    	            _.each(aggByStatements, function(statement){
    	            	
    	            	//Check if the resource map ID is the old existing id, so we don't collect ids that are not about this resource map
    	            	if(_.find(oldPidVariations, function(oldPidV){ return (oldPidV + "#aggregation" == statement.object.value) })){
    	            		var statementID = statement.subject.value;	            		
    	            		idsFromXML.push(statementID);
    	            		
    	            		//Add variations of the ID so we make sure we account for all the ways they exist in the RDF XML
    	            		if(statementID.indexOf(cnResolveUrl) > -1) 
    	            			idsFromXML.push(statementID.substring(statementID.lastIndexOf("/") + 1));
    		            	else 
    		            		idsFromXML.push(cnResolveUrl + encodeURIComponent(statementID));
    	            	}
    	            	
    	            }, this);	
    	            
    	            //Get all the ids from this model
                	idsFromModel = _.invoke(this.models, "get", "id");
    	            
    		        //Find the difference between the model IDs and the XML IDs to get a list of added members
    	            var addedIds  = _.without(_.difference(idsFromModel, idsFromXML), oldPidVariations);	            	            
    	            //Create variations of all these ids too
    	            var allMemberIds = idsFromModel;
    	            _.each(idsFromModel, function(id){
    	            	allMemberIds.push(cnResolveUrl + encodeURIComponent(id));
    	           	});
    	            
                	//Remove any other isAggregatedBy statements that are not listed as members of this model
    	            for(var i=0; i<aggByStatements.length; i++){
    	            	var statement = aggByStatements[i];
    	            
    	            	if(!_.contains(allMemberIds, statement.subject.value))
    	            		this.removeFromAggregation(statement.subject.value);
    	            	else if(_.find(oldPidVariations, function(oldPidV){ return (oldPidV + "#aggregation" == statement.object.value) }))
    	            		statement.object.value = cnResolveUrl+ encodeURIComponent(pid) + "#aggregation";          
    	            }
    	            
                	//Change all the statements in the RDF where the aggregation is the subject, to reflect the new resource map ID
    	            var aggregationSubjStatements = this.dataPackageGraph.statementsMatching(aggregationNode);
    	            _.each(aggregationSubjStatements, function(statement){
    	            	statement.subject.value = cnResolveUrl + encodeURIComponent(pid) + "#aggregation";
    	            });
    	            
                	//Change all the statements in the RDF where the aggregation is the object, to reflect the new resource map ID
    	            var aggregationObjStatements = this.dataPackageGraph.statementsMatching(undefined, undefined, aggregationNode);
    	            _.each(aggregationObjStatements, function(statement){
    	            	statement.object.value = cnResolveUrl+ encodeURIComponent(pid) + "#aggregation";
    	            });

    				//Change all the resource map subject nodes in the RDF graph
    				var rMapNode =  rdf.sym(cnResolveUrl + encodeURIComponent(oldPid));
    			    var rMapStatements = this.dataPackageGraph.statementsMatching(rMapNode);
    			    _.each(rMapStatements, function(statement){
    			    	statement.subject.value = cnResolveUrl + encodeURIComponent(pid);
    			    });
    			    
    			    //Change the idDescribedBy statement
    			    var isDescribedByStatements = this.dataPackageGraph.statementsMatching(undefined, ORE("isDescribedBy"), rdf.sym(cnResolveUrl + encodeURIComponent(oldPid)));
    			    if(isDescribedByStatements[0])
    			    	isDescribedByStatements[0].object.value = cnResolveUrl + encodeURIComponent(pid);;
    			    			    
                	//Add nodes for new package members
                	_.each(addedIds, function(id){
                		this.addToAggregation(id);
                	}, this);
    			    
    			    //Change all the resource map identifier literal node in the RDF graph
    				if(idStatement[0]) idStatement[0].object.value = pid;
    				
                } else {
                    // Create the OAI-ORE graph from scratch
                    cnResolveUrl = MetacatUI.appModel.get("resolveServiceUrl") || "https://cn.dataone.org/cn/v2/resolve/";
                    this.dataPackageGraph.cnResolveUrl = cnResolveUrl;
                    rMapNode = rdf.sym(cnResolveUrl + encodeURIComponent(this.packageModel.id));
                    aggregationNode = rdf.sym(cnResolveUrl + encodeURIComponent(this.packageModel.id) + "#aggregation");
                    modifiedDate = rdf.lit(new Date().toISOString(), "", XSD("dateTime"));
                    
                    // Describe the resource map
                    // With a Creator
                    var creatorNode = rdf.blankNode();
                    var creatorName = rdf.lit(MetacatUI.appUserModel.get("firstName") + 
                        " " + 
                        MetacatUI.appUserModel.get("lastName"),
                        "", 
                        XSD("string"));
                    this.dataPackageGraph.add(creatorNode, FOAF("name"), creatorName);
                    this.dataPackageGraph.add(creatorNode, RDF("type"), DCTERMS("Agent"));
                    this.dataPackageGraph.add(rMapNode, DC("creator"), creatorNode);

                    // Set the modified date
                    this.dataPackageGraph.add(rMapNode, DCTERMS("modified"), modifiedDate);
                    
                    this.dataPackageGraph.add(rMapNode, RDF("type"), ORE("ResourceMap"));
                    this.dataPackageGraph.add(rMapNode, ORE("describes"), aggregationNode);
                    var idLiteral = rdf.lit(this.packageModel.id, "", XSD("string"));
                    this.dataPackageGraph.add(rMapNode, DCTERMS("identifier"), idLiteral);
                    
                    // Describe the aggregation
                    this.dataPackageGraph.add(aggregationNode, ORE("isDescribedBy"), rMapNode);
                    
                    // Aggregate each package member
                    idsFromModel = this.pluck("id");
                    _.each(idsFromModel, function(id) {
                        this.addToAggregation(id);
                        
                    }, this);
                }
                
                var xmlString = serializer.statementsToXML(this.dataPackageGraph.statements);
                        	
            	return xmlString;
            },
            
            //Adds a new object to the resource map RDF graph
            addToAggregation: function(id){
            	if(id.indexOf(this.dataPackageGraph.cnResolveUrl) < 0) 
            		var fullID = this.dataPackageGraph.cnResolveUrl + encodeURIComponent(id);
            	else{
            		var fullID = id;
            		id = id.substring(this.dataPackageGraph.cnResolveUrl.lastIndexOf("/") + 1);
            	}
            	
            	//Initialize the namespaces
            	var ORE     = rdf.Namespace(this.namespaces.ORE),
            		DCTERMS = rdf.Namespace(this.namespaces.DCTERMS),
            		XSD     = rdf.Namespace(this.namespaces.XSD),
            		CITO    = rdf.Namespace(this.namespaces.CITO);
            	
            	//Create a node for this object, the identifier, the resource map, and the aggregation
            	var objectNode = rdf.sym(fullID),
            		mapNode    = rdf.sym(this.dataPackageGraph.cnResolveUrl + encodeURIComponent(this.packageModel.get("id"))),
            		aggNode    = rdf.sym(this.dataPackageGraph.cnResolveUrl + encodeURIComponent(this.packageModel.get("id")) + "#aggregation"),
            		idNode     = rdf.literal(id, undefined, XSD("string"));
            	
            	//Add the statement: this object isAggregatedBy the resource map aggregation
    			this.dataPackageGraph.add(objectNode, ORE("isAggregatedBy"), aggNode);
    			//Add the statement: The resource map aggregation aggregates this object
    			this.dataPackageGraph.add(aggNode, ORE("aggregates"), objectNode);
    			//Add the statement: This object has the identifier {id}
    			this.dataPackageGraph.add(objectNode, DCTERMS("identifier"), idNode);
    			
    			//Find the metadata doc that describes this object
    			var model   = _.find(this.models, function(m){ return m.get("id") == id }),
    				isDocBy = model.get("isDocumentedBy"),
    				documents = model.get("documents");
    			
                // Deal with Solr indexing bug where metadata-only packages must "document" themselves
                if ( isDocBy.length === 0 && documents.length === 0 ) {
                    documents.push(model.get("id"));
                    
                }
                
    			//If this object is documented by any metadata...
    			if(isDocBy && isDocBy.length){
    				//Get the ids of all the metadata objects in this package
    				var	metadataInPackage = _.compact(_.map(this.get("members"), function(m){ if(m.get("formatType") == "METADATA") return m.get("id"); }));
    				//Find the metadata IDs that are in this package that also documents this data object 
    				var metadataIds = Array.isArray(isDocBy)? _.intersection(metadataInPackage, isDocBy) : _.intersection(metadataInPackage, [isDocBy]);
    				
    				//For each metadata that documents this object, add a CITO:isDocumentedBy and CITO:documents statement
    				_.each(metadataIds, function(metaId){
    					//Create the named nodes and statements
    					var dataNode         = rdf.sym(this.dataPackageGraph.cnResolveUrl + encodeURIComponent(id)),
    						metadataNode     = rdf.sym(this.dataPackageGraph.cnResolveUrl + encodeURIComponent(metaId)),
    						isDocByStatement = rdf.st(dataNode, CITO("isDocumentedBy"), metadataNode),
    						documentsStatement = rdf.st(metadataNode, CITO("documents"), dataNode);
    					//Add the statements
    					this.dataPackageGraph.addStatement(isDocByStatement);
    					this.dataPackageGraph.addStatement(documentsStatement);
    				}, this);
    			}
    			
    			//If this object documents a data object
    			if(documents && documents.length){
    				//Create a literal node for it
    				var metadataNode = rdf.sym(this.dataPackageGraph.cnResolveUrl + encodeURIComponent(id));
    				
    				_.each(documents, function(dataID){
    					//Create a named node for the data object
    					var dataNode = rdf.sym(this.dataPackageGraph.cnResolveUrl + encodeURIComponent(dataID)),
    					//Create a statement: This metadata documents this data
    						documentsStatement = rdf.st(metadataNode, CITO("documents"), dataNode),
    					//Create a statement: This data is documented by this metadata
    						isDocByStatement = rdf.st(dataNode, CITO("isDocumentedBy"), metadataNode);
    					
    					//Add the statements
    					this.dataPackageGraph.addStatement(isDocByStatement);
    					this.dataPackageGraph.addStatement(documentsStatement);
    				}, this);
    			}
            },
            
            /*
             * Removes an object from the aggregation in the RDF graph
             */
            removeFromAggregation: function(id){
            	if(id.indexOf(this.dataPackageGraph.cnResolveUrl) == -1) id = this.dataPackageGraph.cnResolveUrl + encodeURIComponent(id);
            	
            	//Create a literal node for the removed object
            	var removedObjNode = rdf.sym(id),
            	//Get the statements from the RDF where the removed object is the subject or object
            		statements = _.union(this.dataPackageGraph.statementsMatching(undefined, undefined, removedObjNode),
            						this.dataPackageGraph.statementsMatching(removedObjNode));
            	
            	//Remove all the statements mentioning this object
    			this.dataPackageGraph.removeStatements(statements);
            },
            
            /*
             * Checks if this resource map has had any changes that requires an update
             */
            needsUpdate: function(){
            	//Check for changes to the list of aggregated members
            	var ids = this.pluck("id");
            	if(this.originalMembers.length != ids.length || _.intersection(this.originalMembers, ids).length != ids.length)
            		return true;

            	//Check for changes to the isDocumentedBy relationships
            	var isDifferent = false,
            		i = 0;
            	
            	//Keep going until we find a difference
            	while(!isDifferent && i<this.length){
            		//Get the original isDocBy relationships from the resource map, and the new isDocBy relationships from the models
            		var isDocBy = this.models[i].get("isDocumentedBy"),
            			id = this.models[i].get("id"),
            			origIsDocBy = this.originalIsDocBy[id];
            		
            		//Make sure they are both formatted as arrays for these checks
            		isDocBy = _.compact(Array.isArray(isDocBy)? isDocBy : [isDocBy]);
            		origIsDocBy = _.compact(Array.isArray(origIsDocBy)? origIsDocBy : [origIsDocBy]);
            		
            		//Remove the id of this object so metadata can not be "isDocumentedBy" itself
            		isDocBy = _.without(isDocBy, id);
            		
            		//Simply check if they are the same
            		if(origIsDocBy === isDocBy){
            			i++; 
            			continue;
            		}
            		//Are the number of relationships different?
            		else if(isDocBy.length != origIsDocBy.length)
            			isDifferent = true;
            		//Are the arrays the same?
            		else if(_.intersection(isDocBy, origIsDocBy).length != origIsDocBy.length)
            			isDifferent = true;

            		i++;
            	}
            	
            	return isDifferent;
            },
            
            /*
             * Returns an array of the models that are in the queue or in progress of uploading
             */
            getQueue: function(){
            	return this.filter(function(m){ return m.get("uploadStatus") == "q" || m.get("uploadStatus") == "p" });
            },
            
            /*
             * Update the relationships in this resource map when its been udpated
             */
            updateRelationships: function(){
            	//Get the old id
            	var oldId = this.packageModel.get("oldPid");
            	
            	if(!oldId) return;
            	
            	//Update the resource map list
            	this.each(function(m){
            		var updateRMaps = _.without(m.get("resourceMap"), oldId);
            		updateRMaps.push(this.packageModel.get("id"));
            		
            		m.set("resourceMap", updateRMaps);
            	}, this);
            },
            
            saveReference: function(model){
            	//Save a reference to this collection in the model
            	var currentCollections = model.get("collections");
            	if(currentCollections.length > 0){
            		currentCollections.push(this);
                	model.set("collections", _.uniq(currentCollections));
            	}
            	else
            		model.set("collections", [this]);
            }
            
        });
        return DataPackage;
    }
);