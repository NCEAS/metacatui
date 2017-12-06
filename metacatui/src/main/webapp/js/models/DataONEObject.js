/* global define */
define(['jquery', 'underscore', 'backbone', 'uuid', 'collections/ObjectFormats', 'md5'],
    function($, _, Backbone, uuid, ObjectFormats, md5){
  
        /* 
         A DataONEObject represents a DataONE object that has a format
         type of DATA, METADATA, or RESOURCE.  It stores the system
         metadata attributes for the object at a minimum.
         TODO: incorporate Backbone.UniqueModel
        */
        var DataONEObject = Backbone.Model.extend({
        	
        	type: "DataONEObject",
            
        	defaults: function(){
        		return{
                    // System Metadata attributes
                    serialVersion: null,
                    identifier: null,
                    formatId: null,
                    size: null,
                    checksum: null,
                    checksumAlgorithm: "MD5",
                    submitter: null,
                    rightsHolder : null,
                    accessPolicy: [],
                    replicationAllowed: null,
                    replicationPolicy: [],
                    obsoletes: null,
                    obsoletedBy: null,
                    archived: null,
                    dateUploaded: null,
                    dateSysMetadataModified: null,
                    originMemberNode: null,
                    authoritativeMemberNode: null,
                    replica: [],
                    seriesId: null, // uuid.v4(), (decide if we want to auto-set this)
                    mediaType: null,
                    fileName: null,
                    // Non-system metadata attributes:
                    datasource: null,
                    insert_count_i: null,
                    read_count_i: null,
                    changePermission: null,
                    writePermission: null,
                    readPermission: null,
                    isPublic: null,
                    dateModified: null,
                    id: "urn:uuid:" + uuid.v4(),
                    sizeStr: null,
                    type: null, // Data, Metadata, or DataPackage
                    formatType: null,
                    latestVersion: null,
                    isDocumentedBy: null,
                    documents: [],
                    resourceMap: [],
                    nodeLevel: 0, // Indicates hierarchy level in the view for indentation
                    sortOrder: null, // Metadata: 1, Data: 2, DataPackage: 3
                    synced: false, // True if the full model has been synced
                    uploadStatus: null, //c=complete, p=in progress, q=queued, e=error, no upload status=not in queue
                    uploadProgress: null,
                    percentLoaded: 0, // Percent the file is read before caclculating the md5 sum
                    uploadFile: null, // The file reference to be uploaded (JS object: File)
                    errorMessage: null,
                    numSaveAttempts: 0,
                    notFound: false, //Whether or not this object was found in the system
                    originalAttrs: [], // An array of original attributes in a DataONEObject
                    changed: false, // If any attributes have been changed, including attrs in nested objects
                    hasContentChanges: false, // If attributes outside of originalAttrs have been changed
                    sysMetaXML: null, // A cached original version of the fetched system metadata document
                    objectXML: null, // A cached version of the object fetched from the server
                    isAuthorized: null, // If the stated permission is authorized by the user
                    collections: [], //References to collections that this model is in
                    provSources: [],
                    provDerivations: [],
                    prov_generated: [],
                    prov_generatedByExecution: [],
                    prov_generatedByProgram: [],
                    prov_generatedByUser: [],
                    prov_hasDerivations: [],
                    prov_hasSources: [],
                    prov_instanceOfClass: [],
                    prov_used: [],
                    prov_usedByExecution: [],
                    prov_usedByProgram: [],
                    prov_usedByUser: [],
                    prov_wasDerivedFrom: [],
                    prov_wasExecutedByExecution: [],
                    prov_wasExecutedByUser: [],
                    prov_wasInformedBy: []
                }
        	},
        	
            initialize: function(attrs, options) {
            	if(typeof attrs == "undefined") var attrs = {};
            	if(typeof options == "undefined") var options = {};
            	
                this.on("change:size", this.bytesToSize);
                if(attrs.size)
                    this.bytesToSize();
                
                // Cache an array of original attribute names to help in handleChange()
                if(this.type == "DataONEObject")
                	this.set("originalAttrs", Object.keys(this.attributes));
                else
                	this.set("originalAttrs", Object.keys(DataONEObject.prototype.defaults()));
                
                this.on("successSaving", this.updateRelationships);
                
                this.on("sync", function(){
                	this.set("synced", true);
                });
                               
            },
            
            selectedInEditor: false, // Has this package member been selected and displayed in the provenance editor?  
            
            /*
             * Maps the lower-case sys meta node names (valid in HTML DOM) to the 
             * camel-cased sys meta node names (valid in DataONE). 
             * Used during parse() and serialize()
             */
            nodeNameMap: function(){
            	return{
	    			accesspolicy: "accessPolicy",
	    			accessrule: "accessRule",
	    			authoritativemembernode: "authoritativeMemberNode",
	    			checksumalgorithm: "checksumAlgorithm",
	    			dateuploaded: "dateUploaded",
	    			datesysmetadatamodified: "dateSysMetadataModified",
	    			formatid: "formatId",
	    			filename: "fileName",
	    			nodereference: "nodeReference",
	    			numberreplicas: "numberReplicas",
	    			obsoletedby: "obsoletedBy",
	    			originmembernode: "originMemberNode",
	    			replicamembernode: "replicaMemberNode",
	    			replicationallowed: "replicationAllowed",
	    			replicationpolicy: "replicationPolicy",
	    			replicationstatus: "replicationStatus",
	    			replicaverified: "replicaVerified",		
	    			rightsholder: "rightsHolder",
	    			serialversion: "serialVersion"
            	};
            },
            
            /* Provide the model URL on the server based on the newness of the object */
        	url: function(){
                
                // With no id, we can't do anything
        		if( !this.get("id") && !this.get("seriesid") ) return "";
        		
                // Determine if we're updating a new/existing object,
                // or just its system metadata
                if ( this.isNew() ) {
                    // This is a new upload, use MN.create()
    		        return MetacatUI.appModel.get("objectServiceUrl") + 
                        (encodeURIComponent(this.get("id")));
                                		
                } else {
                    if ( this.hasUpdates() ) {
                        if ( this.hasContentChanges ) {
                            // Exists on the server, use MN.update()
    		                return MetacatUI.appModel.get("objectServiceUrl") + 
                            (encodeURIComponent(this.get("id")));
                            
                        } else {
                            // Exists on the server, use MN.updateSystemMetadata()
    		                return MetacatUI.appModel.get("metaServiceUrl") + 
                                (encodeURIComponent(this.get("id")));
                            
                        }
                        
                    } else {
                        // Use MN.getSystemMetadata() 
        		        return MetacatUI.appModel.get("metaServiceUrl") + 
                            (encodeURIComponent(this.get("id")) || 
                             encodeURIComponent(this.get("seriesid")));        		
                    }
                    
                }
        	},
            
            /*
             * Overload Backbone.Model.fetch, so that we can set custom options for each fetch() request
             */
            fetch: function(options){
            	console.log("Fetching " + this.get("id"));
                
                if ( ! options ) var options = {};
                else var options = _.clone(options);
                
                // Default to GET /meta
                options.url = MetacatUI.appModel.get("metaServiceUrl") + encodeURIComponent(this.get("id"));
                
            	//If we are using the Solr service to retrieve info about this object, then construct a query
            	if((typeof options != "undefined") && options.solrService){
            		
            		//Get basic information 
            		var query = "";
            		//Do not search for seriesId when it is not configured in this model/app
        			if(typeof this.get("seriesid") === "undefined")
        				query += 'id:"' + encodeURIComponent(this.get("id")) + '"';
        			//If there is no seriesid set, then search for pid or sid 
        			else if(!this.get("seriesid"))
        				query += '(id:"' + encodeURIComponent(this.get("id")) + '" OR seriesId:"' + encodeURIComponent(this.get("id")) + '")';
        			//If a seriesId is specified, then search for that
        			else if(this.get("seriesid") && (this.get("id").length > 0))
        				query += '(seriesId:"' + encodeURIComponent(this.get("seriesid")) + '" AND id:"' + encodeURIComponent(this.get("id")) + '")';
        			//If only a seriesId is specified, then just search for the most recent version
        			else if(this.get("seriesid") && !this.get("id"))
        				query += 'seriesId:"' + encodeURIComponent(this.get("id")) + '" -obsoletedBy:*';
        			
        			//The fields to return
        			var fl = "formatId,formatType,documents,isDocumentedBy,id,seriesId";
        			
        			//Use the Solr query URL
	            	var solrOptions = {
	            		url: MetacatUI.appModel.get("queryServiceUrl") + 'q=' + query + "&fl=" + fl + "&wt=json",
	            		
	            	}
	            	
	            	//Merge with the options passed to this function
	            	var fetchOptions = _.extend(solrOptions, options);
            	}
            	else if(typeof options != "undefined"){
            		//Use custom options for retreiving XML
	            	//Merge with the options passed to this function
            		var fetchOptions = _.extend({
            			dataType: "text"
            		}, options);
            	}
            	else{
            		//Use custom options for retreiving XML
            		var fetchOptions = _.extend({
            			dataType: "text"
            		});
            	}
            	
            	//Add the authorization options 
            	fetchOptions = _.extend(fetchOptions, MetacatUI.appUserModel.createAjaxSettings());

            	//Call Backbone.Model.fetch to retrieve the info
                return Backbone.Model.prototype.fetch.call(this, fetchOptions);
                
            },
            
            /* 
             * This function is called by Backbone.Model.fetch.
             * It deserializes the incoming XML from the /meta REST endpoint and converts it into JSON.
             */
            parse: function(response){
                // console.log("Parsing " + this.get("id"));
            	
            	// If the response is XML
            	if( (typeof response == "string") && response.indexOf("<") == 0 ) {
            		
            		var responseDoc = $.parseHTML(response),
            			systemMetadata;
            		
            		//Save the raw XML in case it needs to be used later
                    this.set("sysMetaXML", response);
            		
            		for(var i=0; i<responseDoc.length; i++){
            			if((responseDoc[i].nodeType == 1) && (responseDoc[i].localName.indexOf("systemmetadata") > -1)){
            				systemMetadata = responseDoc[i];
            				break;
            			}
            		}
            		
            		//Parse the XML to JSON
            		var sysMetaValues = this.toJson(systemMetadata);
            		            		
            		//Convert the JSON to a camel-cased version, which matches Solr and is easier to work with in code
            		_.each(Object.keys(sysMetaValues), function(key){
            			var camelCasedKey = this.nodeNameMap()[key];
            			if(camelCasedKey){
            				sysMetaValues[camelCasedKey] = sysMetaValues[key];
            				delete sysMetaValues[key];
            			}
            		}, this);
            		
            		return sysMetaValues;
            	
                // If the response is a list of Solr docs   
            	} else if (( typeof response === "object") && (response.response && response.response.docs)){
            		if(!response.response.docs.length){
            			this.set("notFound", true);
            		}
            		            		
            	    return response.response.docs[0];                   
                }
            	else
            		// Default to returning the raw response           	
            		return response;
            },
            
            // A utility function for converting XML to JSON
            toJson: function(xml) {
            	
            	// Create the return object
            	var obj = {};

            	// do children
            	if (xml.hasChildNodes()) {
            		for(var i = 0; i < xml.childNodes.length; i++) {
            			var item = xml.childNodes.item(i);
            			
            			//If it's an empty text node, skip it
            			if((item.nodeType == 3) && (!item.nodeValue.trim()))
            				continue;
            			
            			//Get the node name
            			var nodeName = item.localName;
            			
            			//If it's a new container node, convert it to JSON and add as a new object attribute
            			if((typeof(obj[nodeName]) == "undefined") && (item.nodeType == 1)) {
            				obj[nodeName] = this.toJson(item);
            			}
            			//If it's a new text node, just store the text value and add as a new object attribute
            			else if((typeof(obj[nodeName]) == "undefined") && (item.nodeType == 3)){
            				obj = item.nodeValue == "false" ? false : item.nodeValue == "true" ? true : item.nodeValue;
            			}
            			//If this node name is already stored as an object attribute...
            			else if(typeof(obj[nodeName]) != "undefined"){	
            				//Cache what we have now
            				var old = obj[nodeName];
            				if(!Array.isArray(old))
            					old = [old];
            				
            				//Create a new object to store this node info
            				var newNode = {};
         					
            				//Add the new node info to the existing array we have now
        					if(item.nodeType == 1){
        						newNode = this.toJson(item);
        						var newArray = old.concat(newNode);
        					}
        					else if(item.nodeType == 3){
        						newNode = item.nodeValue;
        						var newArray = old.concat(newNode);
        					}
        					       					
                			//Store the attributes for this node
                			_.each(item.attributes, function(attr){
                				newNode[attr.localName] = attr.nodeValue;
                			});
        						
                			//Replace the old array with the updated one
        					obj[nodeName] = newArray; 
        					
        					//Exit
        					continue;
            			}
            			
            			//Store the attributes for this node
            			/*_.each(item.attributes, function(attr){
            				obj[nodeName][attr.localName] = attr.nodeValue;
            			});*/
            			
        			}
            		
            	}
            	return obj;
            },
            
            /* 
            Serialize the DataONE object JSON to XML
            Parameters:
            	json - the JSON object to convert to XML
            	containerNode - an HTML element to inser the resulting XML into
           */
           toXML: function(json, containerNode){   
           	           	
			if(typeof json == "string"){
				containerNode.textContent = json;
				return containerNode;
			}
			
			for(var i=0; i<Object.keys(json).length; i++){
				var key = Object.keys(json)[i],
					contents = json[key] || json[key];
			
				var node = document.createElement(key);
				           		            		
				//Skip this attribute if it is not populated
				if(!contents || (Array.isArray(contents) && !contents.length))
					continue;
				   
				//If it's a simple text node
				if(typeof contents == "string"){
					containerNode.textContent = contents;
					return containerNode;
				}
				else if(Array.isArray(contents)){
					var allNewNodes = [];
				
					for(var ii=0; ii<contents.length; ii++){ 
						allNewNodes.push(this.toXML(contents[ii], $(node).clone()[0]));						   
					}
					   
					if(allNewNodes.length)
						node = allNewNodes;
				}
				else if(typeof contents == "object"){
					$(node).append(this.toXML(contents, node));
					var attributeNames = _.without(Object.keys(json[key]), "content");
				}
				
				//Add the attributes to the node
				/*if(attributeNames && Array.isArray(attributeNames)){
					_.each(attributeNames, function(attr){
						$(node).attr(attr, json[key][attr]);
					});
				}*/
				
				$(containerNode).append(node);
			}
			
			return containerNode;
		  },
		  
            /*
            * Saves the DataONEObject System Metadata to the server
            */
            save: function(attributes, options){

                // Set missing file names before saving
                if ( ! this.get("fileName") ) {
                    this.setMissingFileName();
                }

                if ( !this.hasUpdates() ) {
                    this.set("uploadStatus", null);
                    return;
                }

                //Set the upload transfer as in progress
                this.set("uploadProgress", 2);
                this.set("uploadStatus", "p");
                
                //Create a FormData object to send data with our XHR
                var formData = new FormData();
                
                //Add the identifier to the XHR data
                formData.append("pid", this.get("id"));
            				
				//If there's been a new uploaded file, get the new checksum of the object 
                if(this.get("uploadResult")){
					var checksum = md5(this.get("uploadResult"));
					this.set("checksum", checksum);
					this.set("checksumAlgorithm", "MD5");
                }
                
                //Create the system metadata XML
                var sysMetaXML = this.serializeSysMeta();
                				
                //Send the system metadata as a Blob 
                var xmlBlob = new Blob([sysMetaXML], {type : 'application/xml'});			
                //Add the system metadata XML to the XHR data
                formData.append("sysmeta", xmlBlob, "sysmeta.xml");
				
                if ( this.isNew() ) {
                    // Create the new object (MN.create())
                    formData.append("object", this.get("uploadFile"), this.get("fileName"));
                    
                } else if(this.get("uploadResult") || this.hasContentChanges) {
                    // Update the object (MN.update())
                    //TODO: enable replacement of DATA objects
                }
                
                var model = this;

                //Put together the AJAX and Backbone.save() options
                var requestSettings = {
                    url: this.url(),
                    cache: false,
                    contentType: false,
                    dataType: "text",
                    processData: false,
                    data: formData,
                    parse: false,
                    xhr: function(){
                      var xhr = new window.XMLHttpRequest();
                      
                      //Upload progress
                      xhr.upload.addEventListener("progress", function(evt){
                        if (evt.lengthComputable) {
                          var percentComplete = evt.loaded / evt.total * 100;
                          
                          model.set("uploadProgress", percentComplete);
                        }
                      }, false);

                      return xhr;
                    },
                    success: function(model, response, xhr){
                        console.log('yay, DataONEObject has been saved');
                        
                        model.set("numSaveAttempts", 0);
                        model.set("uploadStatus", "c");
                        model.trigger("successSaving", model);
                        model.fetch({merge: true}); // Get the newest sysmeta set by the MN
                        // Reset the content changes status
                        model.set("hasContentChanges", false);
                    },
                    error: function(model, response, xhr){

                		model.set("numSaveAttempts", model.get("numSaveAttempts") + 1);
                    	var numSaveAttempts = model.get("numSaveAttempts");

                		if(numSaveAttempts < 3){
                    		
                    		//Try saving again in 10, 40, and 90 seconds
                    		setTimeout(function(){ 
                    				model.save.call(model);
                    			}, 
                    			(numSaveAttempts * numSaveAttempts) * 10000);
                    	}
                    	else{
                    		model.set("numSaveAttempts", 0);
                    	
                    		var parsedResponse = $(response.responseText).not("style, title").text();                    		
	                        model.set("errorMessage", parsedResponse);
	                        
	                        model.set("uploadStatus", "e");
	                        model.trigger("errorSaving", response.responseText);
                    	}
                    }
                };

                //Add the user settings
                requestSettings = _.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings());
                
                //Send the Save request
	            Backbone.Model.prototype.save.call(this, null, requestSettings);
            
		    },
		  
		    /*
		     * Check if the current user is authorized to perform an action on this object
		     */
		    checkAuthority: function(action){
		    	if(!action) var action = "changePermission";
			
				var authServiceUrl = MetacatUI.appModel.get('authServiceUrl');
				if(!authServiceUrl) return false;

				var model = this;

				var requestSettings = {
					url: authServiceUrl + encodeURIComponent(this.get("id")) + "?action=" + action,
					type: "GET",
					success: function(data, textStatus, xhr) {
						model.set("isAuthorized", true);
						model.trigger("change:isAuthorized");
					},
					error: function(xhr, textStatus, errorThrown) {
						model.set("isAuthorized", false);
					}
				}
				$.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));

		    },
		
		    serializeSysMeta: function(options){
	        	//Get the system metadata XML that currently exists in the system
                var sysMetaXML = this.get("sysMetaXML"), // sysmeta as string
                    xml, // sysmeta as DOM object
                    accessPolicyXML, // The generated access policy XML
                    previousSiblingNode, // A DOM node indicating any previous sibling
                    rightsHolderNode, // A DOM node for the rights holder field
                    accessPolicyNode, // A DOM node for the access policy
                    replicationPolicyNode, // A DOM node for the replication policy
                    obsoletesNode, // A DOM node for the obsoletes field
                    obsoletedByNode, // A DOM node for the obsoletedBy field
                    fileNameNode, // A DOM node for the file name
                    xmlString, // The system metadata document as a string
                    nodeNameMap, // The map of camelCase to lowercase attributes
                    extension; // the file name extension for this object
              
                if ( typeof sysMetaXML === "undefined" || sysMetaXML === null ) {
                    xml = this.createSysMeta();
                    
                } else {
                    xml = $($.parseHTML(sysMetaXML));
                }
                
	        	//Update the system metadata values
	        	xml.find("serialversion").text(this.get("serialVersion") || "0");
	        	xml.find("identifier").text((this.get("newPid") || this.get("id")));
                
	        	xml.find("formatid").text(this.get("formatId") || this.getFormatId());                                
	        	xml.find("size").text(this.get("size"));
	        	xml.find("checksum").text(this.get("checksum"));
                xml.find("checksum").attr("algorithm", this.get("checksumAlgorithm"));
	        	xml.find("submitter").text(MetacatUI.appUserModel.get("username"));
	        	xml.find("rightsholder").text(this.get("rightsHolder") || MetacatUI.appUserModel.get("username"));

	        	//Write the access policy
	        	accessPolicyXML = this.serializeAccessPolicy();
	        	
                // Get the access policy node, if it exists
                accessPolicyNode = xml.find("accesspolicy");
                
                previousSiblingNode = xml.find("rightsholder");
                // Create an access policy node if needed
                if ( (! accessPolicyNode.length) && accessPolicyXML ) {
                    accessPolicyNode = $(document.createElement("accesspolicy"));
                    previousSiblingNode.after(accessPolicyNode);
                    
                }
	        	//Replace the old access policy with the new one if it exists
                if ( accessPolicyXML ) {
    	        	accessPolicyNode.replaceWith(accessPolicyXML); 
                    
                }
	        	
                // Set the obsoletes node after replPolicy or accessPolicy, or rightsHolder
                replicationPolicyNode = xml.find("replicationpolicy");
                accessPolicyNode = xml.find("accesspolicy");
                rightsHolderNode = xml.find("rightsholder");
                
                if ( replicationPolicyNode.length ) {
                    previousSiblingNode = replicationPolicyNode;
                    
                } else if ( accessPolicyNode.length ) {
                    previousSiblingNode = accessPolicyNode;
                    
                } else {
                    previousSiblingNode = rightsHolderNode;
                    
                }

                obsoletesNode = xml.find("obsoletes");                
	        	if( this.get("obsoletes") ){
	        		if( obsoletesNode.length ) {
	        			obsoletesNode.text(this.get("obsoletes"));
	        		    
	        		} else {
                        obsoletesNode = $(document.createElement("obsoletes")).text(this.get("obsoletes"));
	        			previousSiblingNode.after(obsoletesNode);
	        		    
	        		}
                    
	        	} else {
                    if ( obsoletesNode ) {
    	        		obsoletesNode.remove();
                        
                    } 
	        	}
	        	                
                if ( obsoletesNode ) {
                    previousSiblingNode = obsoletesNode;
                    
                }
                
                obsoletedByNode = xml.find("obsoletedby");
	        	//remove the obsoletedBy node if it exists
                // TODO: Verify this is what we want to do
	        	if ( obsoletedByNode ) {
                    obsoletedByNode.remove();
                }

	        	xml.find("archived").text(this.get("archived") || "false");
	        	xml.find("dateuploaded").text(this.get("dateUploaded") || new Date().toISOString());
	        	//	xml.find("datesysmetadatamodified").text(new Date().toISOString());
	        	xml.find("originmembernode").text(this.get("originMemberNode") || MetacatUI.nodeModel.get("currentMemberNode"));
	        	xml.find("authoritativemembernode").text(this.get("authoritativeMemberNode") || MetacatUI.nodeModel.get("currentMemberNode"));

        		//Get the filename node
	        	fileNameNode = xml.find("filename");
	        	
	        	//If the filename node doesn't exist, then create one
	        	if( ! fileNameNode.length ){
	        		fileNameNode = $(document.createElement("filename"));
	        		xml.find("authoritativemembernode").after(fileNameNode);
	        	}
                
	        	//Set the object file name
                $(fileNameNode).text(this.get("fileName"));
	        	
	        	xmlString = $(document.createElement("div")).append(xml.clone()).html();
	        	
	        	//Now camel case the nodes 
	        	nodeNameMap = this.nodeNameMap();
	        	_.each(Object.keys(nodeNameMap), function(name, i){
	        		var originalXMLString = xmlString;
	        		
	        		//Camel case node names
	        		var regEx = new RegExp("<" + name, "g");
	        		xmlString = xmlString.replace(regEx, "<" + nodeNameMap[name]);
	        		var regEx = new RegExp(name + ">", "g");
	        		xmlString = xmlString.replace(regEx, nodeNameMap[name] + ">");
	        		
	        		//If node names haven't been changed, then find an attribute
	        		if(xmlString == originalXMLString){
	        			var regEx = new RegExp(" " + name + "=", "g");
	        			xmlString = xmlString.replace(regEx, " " + nodeNameMap[name] + "=");
	        		}
	        	}, this);
	        	
	        	xmlString = xmlString.replace(/systemmetadata/g, "systemMetadata");
	        	
	        	return xmlString;
	        },
	        
            /*
             * Get the object format identifier for this object
             */
            getFormatId: function() {
                
                var formatId = "application/octet-stream", // default to untyped data
                objectFormats = [],  // The list of potential format matches
                ext; // The extension of the filename for this object
                
                if ( MetacatUI.objectFormats.length > 0 ) {
                    
                    // Does the media type match the object format id?
                    objectFormats = MetacatUI.objectFormats.where({formatId: this.get("mediaType")});
                    
                    if ( objectFormats.length > 0 ) {
                        formatId = objectFormats[0].get("formatId");
                        objectFormats = [];
                        return formatId;
                        
                    }
                    
                    // Does the media type match the media type name?
                    objectFormats = MetacatUI.objectFormats.where({mediaType: {_name: this.get("mediaType")}});
                    
                    if ( objectFormats.length > 0 ) {
                        formatId = objectFormats[0].get("formatId");
                        objectFormats = [];
                        return formatId;
                        
                    }
                    
                    // Does the extension match the extension?
                    // TODO: multiple formats have the same extension - need to discern them, but how?
                    if ( typeof this.get("fileName") !== "undefined" && 
                         this.get("fileName") !== null && this.get("fileName").length > 1 ) {
                        
                        ext = this.get("fileName").substring(
                                    this.get("fileName").lastIndexOf(".") + 1, 
                                    this.get("fileName").length);
                        objectFormats = MetacatUI.objectFormats.where({extension: ext});
                    
                        if ( objectFormats.length > 0 ) {
                            formatId = objectFormats[0].get("formatId");
                            objectFormats = [];
                            return formatId;
                        
                        }
                    }
                }
                return formatId;
                
            },
            
            /*
             * Build a fresh system metadata document for this object when it is new
             * Return it as a DOM object
             */
            createSysMeta: function() {
                var sysmetaDOM, // The DOM
                    sysmetaXML = []; // The document as a string array
                    
                    sysmetaXML.push(
                        //'<?xml version="1.0" encoding="UTF-8"?>',
                        '<d1_v2.0:systemmetadata', 
                        '    xmlns:d1_v2.0="http://ns.dataone.org/service/types/v2.0"', 
                        '    xmlns:d1="http://ns.dataone.org/service/types/v1">',
                        '    <serialversion />',
                        '    <identifier />',
                        '    <formatid />',
                        '    <size />',
                        '    <checksum />',
                        '    <submitter />',
                        '    <rightsholder />',
                        '    <originmembernode />',
                        '    <authoritativemembernode />',
                        '    <filename />',
                        '</d1_v2.0:systemmetadata>'
                    );
                    
                    
                    sysmetaDOM = $($.parseHTML(sysmetaXML.join("")));
                    return sysmetaDOM;
            },
            
	        serializeAccessPolicy: function(){
	        	//Write the access policy if it exists
                var accessPolicyXML,
                    subjects = [],
                    permissions = [],
                    rulesBySubject = {}; // a lookup table of existing rules by subject ( to prevent repeats)
                
                // If the AppModel.setPublicAccess flag is true,
                // allow developer override to force public read access to new objects 
                if ( MetacatUI.appModel.get("setPublicAccess") ) {
                    var policy = this.get("accessPolicy").allow;
                    if ( typeof policy === "undefined" ) {
                        policy = {allow: [{subject: "public", permission: "read"}]};
                        this.set("accessPolicy", policy);
                    
                    }
                }    
                
                if ( typeof this.get("accessPolicy").allow === "undefined" ) {
                    return accessPolicyXML;
                    
                }
	        	accessPolicyXML = '\t<accessPolicy>\n';
                
                // Parse the AccessPolicy object
                _.each(this.get("accessPolicy"), function(accessRules, accessRuleName, accessPolicy) {
                    
                    // _.each() arguments are different for arrays vs objects. Make sure we have an array
                    accessRules = Array.isArray(accessRules) ? accessRules : [accessRules];
                    
                    // Iterate through the policy allow rules (deny rules don't apply in DataONE)
                    _.each(accessRules, function(accessRule, indexOrKey, accessRules) {
                         
                        // Process each subject in the subject list
                        subjects = Array.isArray(accessRule.subject) ? accessRule.subject : [accessRule.subject];
                        permissions = Array.isArray(accessRule.permission) ? accessRule.permission : [accessRule.permission];
                        _.each(permissions, function(perm) {
                            
                            _.each(subjects, function(subject) {
                                // Add each permission in the permissions list if the rule doesn't already exist
                                if ( ! _.contains(rulesBySubject[subject], perm) ) {
                                    accessPolicyXML += '\t\t<' + accessRuleName + '>\n';
                                    accessPolicyXML += '\t\t\t<subject>' + subject + '</subject>\n';
                                    accessPolicyXML += '\t\t\t<permission>' + perm + '</permission>\n';
                                    accessPolicyXML += '\t\t</' + accessRuleName + '>\n';
                                    if ( Array.isArray(rulesBySubject[subject]) ) {
                                        rulesBySubject[subject].push(perm);
                                    
                                    } else {
                                        rulesBySubject[subject] = [perm]; 
                                    
                                    }
                                    
                                }
                            });
                        });
                    });
	        	});
	        	accessPolicyXML += '\t</accessPolicy>';
	        	rulesBySubject = {};
                
	        	return accessPolicyXML;
	        },
	        
	        updateID: function(id){
	        	//Save the attributes so we can reset the ID later
	        	this.attributeCache = this.toJSON();
	        	
	        	//Set the old identifier
	        	var oldPid = this.get("id"),
                    selfDocuments,
                    selfDocumentedBy,
                    documentedModels,
                    documentedModel,
                    index;
				this.set("oldPid", oldPid);
                
                // Check to see if the old pid documents or is documented by itself
                selfDocuments = _.contains(this.get("documents"), oldPid);
                selfDocumentedBy = _.contains(this.get("isDocumentedBy"), oldPid);
				//Set the new identifier
				if( id ) {
					this.set("id", id);
				    
				} else {
					this.set("id", "urn:uuid:" + uuid.v4());
                }
                
                // Remove the old pid from the documents list if present
                if ( selfDocuments ) {
                    index = this.get("documents").indexOf(oldPid);
                    if ( index > -1 ) {
                        this.get("documents").splice(index, 1);
                        
                    }
                    // And add the new pid in
                    this.get("documents").push(this.get("id"));
                    
                }
                
                // Remove the old pid from the isDocumentedBy list if present
                if ( selfDocumentedBy ) {
                    index = this.get("isDocumentedBy").indexOf(oldPid);
                    if ( index > -1 ) {
                        this.get("isDocumentedBy").splice(index, 1);
                        
                    }
                    // And add the new pid in
                    this.get("isDocumentedBy").push(this.get("id"));
                    
                }
                
                // Update all models documented by this pid with the new id
                _.each(this.get("documents"), function(id) {
                    documentedModels = MetacatUI.rootDataPackage.where({id: id}),
                    documentedModel;
                    
                    if ( documentedModels.length > 0 ) {
                        documentedModel = documentedModels[0];
                    }
                    if ( typeof documentedModel !== "undefined" ) {
                        // Find the oldPid in the array
                        index = documentedModel.get("isDocumentedBy").indexOf("oldPid");
                        if ( index > -1 ) {
                            // Remove it
                            documentedModel.get("isDocumentedBy").splice(index, 1);
                        
                        }
                        // And add the new pid in
                        documentedModel.get("isDocumentedBy").push(this.get("id"));
                        
                    }
                }, this);
                
				this.trigger("change:id")
				
				//Update the obsoletes and obsoletedBy
				this.set("obsoletes", oldPid);
				this.set("obsoletedBy", null);
				
                // Update the latest version of this object
                this.set("latestVersion", this.get("id"));
				
				//Set the archived option to false
				this.set("archived", false);
	        },
	        
	        /*
	         * Reset
	         */
	        resetID: function(){
	        	if(!this.attributeCache) return false;
	        	
	        	this.set("oldPid", this.attributeCache.oldPid, {silent:true});
	        	this.set("id", this.attributeCache.id, {silent: true});
	        	this.set("obsoletes", this.attributeCache.obsoletes, {silent: true});
	        	this.set("obsoletedBy", this.attributeCache.obsoletedBy, {silent: true});
	        	this.set("archived", this.attributeCache.archived, {silent: true});
	        	this.set("latestVersion", this.attributeCache.latestVersion, {silent: true});
                
	        	//Reset the attribute cache
	        	this.attributeCache = {};
	        },
	        
	        /*
	         * Checks if this model has updates that need to be synced with the server.
	         */
	        hasUpdates: function(){
	        	if(this.isNew()) return true;
	        	
	        	//Compare the new system metadata XML to the old system metadata XML
	        	var newSysMeta = this.serializeSysMeta(),
	        		oldSysMeta = $(document.createElement("div")).append($(this.get("sysMetaXML"))).html();
	        	
                if ( oldSysMeta === "" ) return false;
                    
	        	return !(newSysMeta == oldSysMeta);
	        },
            
            /* 
               Set the changed flag on any system metadata or content attribute changes, 
               and set the hasContentChanges flag on content changes only
             */
            handleChange: function(model, options) {
            	if(!model) var model = this;

                var sysMetaAttrs = ["serialVersion", "identifier", "formatId", "size", "checksum", 
                    "checksumAlgorithm", "submitter", "rightsHolder", "accessPolicy", "replicationAllowed", 
                    "replicationPolicy", "obsoletes", "obsoletedBy", "archived", "dateUploaded", "dateSysMetadataModified", 
                    "originMemberNode", "authoritativeMemberNode", "replica", "seriesId", "mediaType", "fileName"],
                    nonSysMetaNonContentAttrs = _.difference(model.get("originalAttrs"), sysMetaAttrs),
                    allChangedAttrs = Object.keys(model.changedAttributes()),
                    changedSysMetaOrContentAttrs = [], //sysmeta or content attributes that have changed
                    changedContentAttrs = []; // attributes from sub classes like ScienceMetadata or EML211 ...
                    
                // Get a list of all changed sysmeta and content attributes 
                changedSysMetaOrContentAttrs = _.difference(allChangedAttrs, nonSysMetaNonContentAttrs);
                if ( changedSysMetaOrContentAttrs.length > 0 ) {
                    // For any sysmeta or content change, set the package dirty flag
                    if ( MetacatUI.rootDataPackage && 
                         MetacatUI.rootDataPackage.packageModel &&
                         ! MetacatUI.rootDataPackage.packageModel.get("changed") &&
                         model.get("synced") ) {
                        
                        MetacatUI.rootDataPackage.packageModel.set("changed", true);
                    }
                }
                // And get a list of all changed content attributes
                changedContentAttrs = _.difference(changedSysMetaOrContentAttrs, sysMetaAttrs);
                
                if ( changedContentAttrs.length > 0 && !this.get("hasContentChanges") && model.get("synced") ) {
                	this.set("hasContentChanges", true);
                    this.updateUploadStatus(model, options);
                }
                	
            },
	        
            /* A DataONE object is new if dateUploaded is not null and synced is true */
	        isNew: function(){
	        	//Check if there is an upload date that was retrieved from the server
	        	return ( this.get("dateUploaded") === null  && this.get("synced") );
	        },
	        
	        /*
	         * Updates the upload status attribute on this model and marks the collection as changed
	         */
	        updateUploadStatus: function(){
	        			
	        		//Add this item to the queue
	        		if((this.get("uploadStatus") == "c") || (this.get("uploadStatus") == "e") || !this.get("uploadStatus")){
	        			this.set("uploadStatus", "q");
	        			
	        			//Mark each DataPackage collection this model is in as changed
	        			_.each(this.get("collections"), function(collection){
	        				if(collection.packageModel)
	        					collection.packageModel.set("changed", true);
	        			}, this);
	        		}
	        },
	        
	        /*
	         * Updates the progress percentage when the model is getting uploaded
	         */
	        updateProgress: function(e){
	        	if(e.lengthComputable){
	                var max = e.total;
	                var current = e.loaded;

	                var Percentage = (current * 100)/max;
	                console.log(Percentage);


	                if(Percentage >= 100)
	                {
	                   // process completed  
	                }
	            }  
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
	        				return _.contains(m.get("documents"), oldId);
	        			});
	        		
	        		//Update the documents array in each model
	        		_.each(outdatedModels, function(model){
		        		var updatedDocuments = _.without(model.get("documents"), oldId);
		        		updatedDocuments.push(this.get("id"));
		        		
		        		model.set("documents", updatedDocuments);
	        		}, this);
	        		
	        	}, this);
	        },
	        
            /*
                Loads a file from the local disk  into a FileReader
                object and caches it in the DataONEObject.uploadReader
                property for later upload to the server.
             */
             loadFile: function(){
                var reader = new FileReader(),
                    model  = this;
                
                // Trigger the file added event
                MetacatUI.rootDataPackage.trigger("fileAdded", this);
                
                // Set up the reader event handlers and
                // pass the event *and* the dataONEObject to the handlers
                reader.onprogress = function(event) {
                    model.handleFileLoadProgress(event);
                }
                
                reader.onerror = function(event) {
                    model.handleFileLoadError(event);
                }
                
                reader.onload = function(event) {
                    model.handleFileLoadSuccess(event);
                }
                
                reader.onabort = function(event) {
                    model.handleFileLoadAbort(event);
                }
                
                // Now initiate the file read
                reader.readAsArrayBuffer(this.get("uploadFile"));
                
                this.set("uploadReader", reader);
	        },
	        
            /*
                Once a File object is locally loaded into an ArrayBuffer,
                determine if it already exists in the collection, and if not,
                update its properties, save it to the server, and add
                it to the DataPackage collection on success.
                
                @param event  The file load event
             */
            handleFileLoadSuccess: function(event){
               // event.target.result has the file object bytes
                
                // Make the DataONEObject for the file, add it to the collection
                var checksum = md5(event.target.result);
                var existingChecksums = 
                    MetacatUI.rootDataPackage.pluck("checksum");
                if ( _.contains(existingChecksums, checksum) ) {
                    console.log("This object already exists in the Data Package. " +
                        "Removing the DataItemView row.");
                     // Tell the view to remove the row by id
                    MetacatUI.eventDispatcher.trigger("fileLoadError", this);
                } else {
                    this.set("checksum", checksum);
                    this.set("checksumAlgorithm", "MD5");
                    
                    this.set("uploadStatus", "q"); // set status to queued
                    this.set("uploadResult", event.target.result);
                                    
                    delete event; // Let large files be garbage collected
                                    
                    this.once("successSaving", function(){ 
                        MetacatUI.rootDataPackage.add(this);
                        MetacatUI.rootDataPackage.handleAdd(this);
                    });
                    
                    //Upload the file
                    this.save();
                }
            },
            
            /* During file reading, deal with abort events */
	        handleFileLoadAbort: function(event){
                // When file reading is aborted, update the model upload status
	        	
	        },
	        
            /* During file reading, handle the user's cancel request */
            handleFileCancel: function(event) {
                // TODO: enable canceling of the file read from disk
                // Need to get a reference to the FileReader to call abort
                // 
                // this.uploadReader.abort(); ?
                
            },
	        
            /* During file reading, deal with read errors */ 
	        handleFileLoadError: function(event){
                // On error, update the model upload status
	        	
	        },
	        
	        /* During file reading, update the import progress in the model */
            handleFileLoadProgress: function(event) {
                // event is a ProgressEvent - use it to update the import progress bar
                
                if ( event.lengthComputable ) {
                    var percentLoaded = Math.round((event.loaded/event.total) * 100);
                    this.set("percentLoaded", percentLoaded);
                }
            },
	        
	        /*
	         * Finds the latest version of this object by travesing the obsolescence chain
	         */
	        findLatestVersion: function(latestVersion, possiblyNewer){
	        	// Make sure we have the /meta service configured
				if(! MetacatUI.appModel.get('metaServiceUrl')) return;	
				
				//If there is no system metadata, then retrieve it first
				if(!this.get("sysMetaXML")){
					this.once("sync", this.findLatestVersion);
					this.fetch({
						url: MetacatUI.appModel.get("metaServiceUrl") + encodeURIComponent(this.get("id")),
						dataType: "text"
					});
					return;
				}
				
				//If no pid was supplied, use this model's id
				if(!latestVersion || typeof latestVersion != "string"){
					var latestVersion = this.get("id");
					var possiblyNewer = this.get("obsoletedBy");
				}

				//If this isn't obsoleted by anything, then there is no newer version
				if(!possiblyNewer || typeof latestVersion != "string"){
					this.set("latestVersion", latestVersion);
					return;
				}

				var model = this;

				//Get the system metadata for the possibly newer version
				var requestSettings = {
					url: MetacatUI.appModel.get('metaServiceUrl') + encodeURIComponent(possiblyNewer), 
					type: "GET",
					success: function(data) {

						// the response may have an obsoletedBy element
						var obsoletedBy = $(data).find("obsoletedBy").text();

						//If there is an even newer version, then get it and rerun this function
						if(obsoletedBy)
							model.findLatestVersion(possiblyNewer, obsoletedBy);
						//If there isn't a newer version, then this is it
						else
							model.set("latestVersion", possiblyNewer);

					},
					error: function(xhr){
						//If this newer version isn't accessible, link to the latest version that is
						if(xhr.status == "401")
							model.set("latestVersion", latestVersion);
					}
				}
				
				$.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));		
	        },
	        
	        /*
	         * Will format an XML string or XML nodes by camel-casing the node names, as necessary
	         */
	        formatXML: function(xml){
	        	var nodeNameMap = this.nodeNameMap(),
	        		xmlString = "";
	        	
	        	//XML must be provided for this function
	        	if(!xml) return "";
	        	//Support XML strings
	        	else if(typeof xml == "string") 
	        		xmlString = xml;
	        	//Support DOMs
	        	else if(typeof xml == "object" && xml.nodeType){
	        		//XML comments should be formatted with start and end carets
	        		if(xml.nodeType == 8) 
	        			xmlString = "<" + xml.nodeValue + ">";
	        		//XML nodes have the entire XML string available in the outerHTML attribute
	        		else if(xml.nodeType == 1) 
	        			xmlString = xml.outerHTML;
	        		//Text node types are left as-is 
	        		else if(xml.nodeType == 3)
	        			return xml.nodeValue;
	        	}
	        	
	        	//Return empty strings if something went wrong
	        	if(!xmlString) return "";
	        	
	        	_.each(Object.keys(nodeNameMap), function(name, i){
	        		var originalXMLString = xmlString;
	        		
	        		//Camel case node names
	        		var regEx = new RegExp("<" + name + ">", "g");
	        		xmlString = xmlString.replace(regEx, "<" + nodeNameMap[name] + ">");
	        		
	        		regEx = new RegExp("<" + name + " ", "g");
	        		xmlString = xmlString.replace(regEx, "<" + nodeNameMap[name] + " ");
	        		
	        		regEx = new RegExp("</" + name + ">", "g");
	        		xmlString = xmlString.replace(regEx, "</" + nodeNameMap[name] + ">");
	        		
	        		//If node names haven't been changed, then find an attribute
	        		if(xmlString == originalXMLString){
	        			regEx = new RegExp(" " + name + "=", "g");
	        			xmlString = xmlString.replace(regEx, " " + nodeNameMap[name] + "=");
	        		}
	        		
	        	}, this);
	        	
	        	return xmlString;
	        },
		  
            /**
             * Convert number of bytes into human readable format
             *
             * @return sizeStr for the given model
             */
            bytesToSize: function(){  
                var kilobyte = 1024;
                var megabyte = kilobyte * 1024;
                var gigabyte = megabyte * 1024;
                var terabyte = gigabyte * 1024;
                var precision = 0;
            
                var bytes = this.get("size");                        
           
                if ((bytes >= 0) && (bytes < kilobyte)) {
                    this.set("sizeStr", bytes + ' B');
         
                } else if ((bytes >= kilobyte) && (bytes < megabyte)) {
                    this.set("sizeStr", (bytes / kilobyte).toFixed(precision) + ' KB');
         
                } else if ((bytes >= megabyte) && (bytes < gigabyte)) {
                    precision = 2;
                    this.set("sizeStr", (bytes / megabyte).toFixed(precision) + ' MB');
         
                } else if ((bytes >= gigabyte) && (bytes < terabyte)) {
                    precision = 2;
                    this.set("sizeStr", (bytes / gigabyte).toFixed(precision) + ' GB');
         
                } else if (bytes >= terabyte) {
                    precision = 2;
                    this.set("sizeStr", (bytes / terabyte).toFixed(precision) + ' TB');
         
                } else {
                    this.set("sizeStr", bytes + ' B');
                    
                }
            },
            
            /* Ensure we have a file name */
            setMissingFileName: function() {
                var objectFormats, filename, extension;
                
                objectFormats = MetacatUI.objectFormats.where({formatId: this.get("formatId")});
                if ( objectFormats.length > 0 ) {
                    extension = objectFormats[0].get("extension");
                }
                
                filename = (Array.isArray(this.get("title")) && this.get("title").length)? this.get("title")[0] : this.get("id");
                filename.replace(/[ :"'\/\\]/g, "-").replace(/[-]+/g, "-");
                
                if ( typeof extension !== "undefined" ) {
                    filename = filename + "." + extension;
                }
                
                this.set("fileName", filename);
                
            },
            
            getXMLSafeID: function(){
            	var id = this.get("id");
            	
            	//Replace XML id attribute invalid characters and patterns in the identifier
            	id = id.replace(/</g, "-").replace(/:/g, "-").replace(/&[a-zA-Z0-9]+;/g);
            	
            	return id;
            },
				/**** Provenance-related functions ****/
				/*
				 * Returns true if this provenance field points to a source of this data or metadata object
				 */
				isSourceField: function(field){
					if((typeof field == "undefined") || !field) return false;
					// Is the field we are checking a prov field?
					if(!_.contains(MetacatUI.appSearchModel.getProvFields(), field)) return false;

					if(field == "prov_generatedByExecution" ||
					   field == "prov_generatedByProgram"   ||
					   field == "prov_used" 		  		||
					   field == "prov_wasDerivedFrom" 		||
					   field == "prov_wasInformedBy")
						return true;
					else
						return false;
				},
				/*
				 * Returns true if this provenance field points to a derivation of this data or metadata object
				 */
				isDerivationField: function(field){
					if((typeof field == "undefined") || !field) return false;
					if(!_.contains(MetacatUI.appSearchModel.getProvFields(), field)) return false;

					if(field == "prov_usedByExecution" ||
					   field == "prov_usedByProgram"   ||
					   field == "prov_hasDerivations" ||
					   field == "prov_generated")
						return true;
					else
						return false;
				},
				//Returns a plain-english version of the general format - either image, program, metadata, PDF, annotation or data
				getType: function(){
					//The list of formatIds that are images
					var imageIds = ["image/gif",
									"image/jp2",
									"image/jpeg",
									"image/png",
									"image/svg xml",
									"image/svg+xml",
									"image/bmp"];
					//The list of formatIds that are images
					var pdfIds = ["application/pdf"];
					var annotationIds = ["http://docs.annotatorjs.org/en/v1.2.x/annotation-format.html"];

					// Type has already been set, use that.
					if(this.get("type").toLowerCase() == "metadata") return "metadata";
					
					//Determine the type via provONE
					var instanceOfClass = this.get("prov_instanceOfClass");
					if(typeof instanceOfClass !== "undefined" && instanceOfClass.length){
						var programClass = _.filter(instanceOfClass, function(className){
							return (className.indexOf("#Program") > -1);
						});
						if((typeof programClass !== "undefined") && programClass.length)
							return "program";
					}
					else{
						if(this.get("prov_generated").length || this.get("prov_used").length)
							return "program";
					}

					//Determine the type via file format
					if(this.isSoftware()) return "program";
					if(this.isData()) return "data";
					
					if(this.get("type").toLowerCase() == "metadata") return "metadata";
					if(_.contains(imageIds, this.get("formatId"))) return "image";
					if(_.contains(pdfIds, this.get("formatId")))   return "PDF";
					if(_.contains(annotationIds, this.get("formatId")))   return "annotation";

					else return "data";
				},
			/*
			 * param dataObject - a SolrResult representing the data object returned from the index
			 * returns - true if this data object is an image, false if it is other
			 */
				isImage: function(){
					//The list of formatIds that are images
					var imageIds = ["image/gif",
					                "image/jp2",
					                "image/jpeg",
					                "image/png",
					                "image/svg xml",
					                "image/svg+xml",
					                "image/bmp"];

					//Does this data object match one of these IDs?
					if(_.indexOf(imageIds, this.get('formatId')) == -1) return false;
					else return true;

				},
				isData: function() {
					var dataIds =  ["application/atom+xml",
								"application/mathematica",
								"application/msword",
								"application/netcdf",
								"application/octet-stream",
								"application/pdf",
								"application/postscript",
								"application/rdf+xml",
								"application/rtf",
								"application/vnd.google-earth.kml+xml",
								"application/vnd.ms-excel",
								"application/vnd.ms-excel.sheet.binary.macroEnabled.12",
								"application/vnd.ms-powerpoint",
								"application/vnd.openxmlformats-officedocument.presentationml.presentation",
								"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
								"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
								"application/x-bzip2",
								"application/x-fasta",
								"application/x-gzip",
								"application/x-rar-compressed",
								"application/x-tar",
								"application/xhtml+xml",
								"application/xml",
								"application/zip",
								"audio/mpeg",
								"audio/x-ms-wma",
								"audio/x-wav",
								"image/bmp",
								"image/jp2",
								"image/jpeg",
								"image/png",
								"image/svg+xml",
								"image/tiff",
								"text/anvl",
								"text/csv",
								"text/html",
								"text/n3",
								"text/plain",
								"text/tab-separated-values",
								"text/turtle",
								"text/xml",
								"video/avi",
								"video/mp4",
								"video/mpeg",
								"video/quicktime",
								"video/x-ms-wmv"];
				//Does this data object match one of these IDs?
				if(_.indexOf(dataIds, this.get('formatId')) == -1) return false;
				else return true;
			},
			isSoftware: function(){
				//The list of formatIds that are images
				var softwareIds =  ["text/x-python",
									"text/x-rsrc",
									"text/x-matlab",
									"text/x-sas",
									"application/R"];
				//Does this data object match one of these IDs?
				if(_.indexOf(softwareIds, this.get('formatId')) == -1) return false;
				else return true;
			},
			/*
			 * param dataObject - a SolrResult representing the data object returned from the index
			 * returns - true if this data object is a pdf, false if it is other
			 */
			isPDF: function(){
				//The list of formatIds that are images
				var ids = ["application/pdf"];

				//Does this data object match one of these IDs?
				if(_.indexOf(ids, this.get('formatId')) == -1) return false;
				else return true;
			},
 
		},
    {
			/* Generate a unique identifier to be used as an XML id attribute */
			generateId: function() {
				var idStr = ''; // the id to return
				var length = 30; // the length of the generated string
				var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz'.split('');

				for (var i = 0; i < length; i++) {
					idStr += chars[Math.floor(Math.random() * chars.length)];
				}
				return idStr;
			}
		});
		return DataONEObject; 
});