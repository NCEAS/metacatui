/* global define */
"use strict";
define(['jquery', 'underscore', 'backbone', 'uuid'],
    function($, _, Backbone, uuid){
  
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
		            id: "urn:uuid:" + uuid.v4(),
		            formatId: null,
		            formatType: null,
		            size: null,
		            sizeStr: null,
		            checksum: null,
		            checksumAlgorithm: null,
		            submitter: null,
		            rightsHolder : null,
		            accessPolicy: [],
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
		            type: null, // Data, Metadata, or DataPackage
		            nodeLevel: 0, // Indicates hierarchy level in the view for indentation
	                sortOrder: null, // Metadata: 1, Data: 2, DataPackage: 3
	                synced: false, // True if the full model has been synced
		            uploadStatus: null, //c=complete, p=in progress, q=queued, e=error
		            uploadFile: null,
		            notFound: false, //Whether or not this object was found in the system
		            collections: [] //References to collections that this model is in
	        	}
        	},
        	
            initialize: function(attrs, options) {
                this.on("change:size", this.bytesToSize);
                
                //When the model has been retrieved the first time, listen for changes to it so we can keep track of user changes
                this.once("sync", this.listenForChanges);
            },
            
            /*
             * Maps the lower-case sys meta node names (valid in HTML DOM) to the camel-cased sys meta node names (valid in DataONE). 
             * Used during parse() and serialize()
             */
            nodeNameMap: {
    			accesspolicy: "accessPolicy",
    			accessrule: "accessRule",
    			authoritativemembernode: "authoritativeMemberNode",
    			checksumalgorithm: "checksumAlgorithm",
    			dateuploaded: "dateUploaded",
    			datesysmetadatamodified: "dateSysMetadataModified",
    			dateuploaded: "dateUploaded",
    			formatid: "formatId",
    			filename: "fileName",
    			nodereference: "nodeReference",
    			obsoletedby: "obsoletedBy",
    			originmembernode: "originMemberNode",
    			replicamembernode: "replicaMemberNode",
    			replicationallowed: "replicationAllowed",
    			replicationpolicy: "replicationPolicy",
    			replicationstatus: "replicationStatus",
    			replicaverified: "replicaVerified",		
    			rightsholder: "rightsHolder",
    			serialversion: "serialVersion"
    		},
            
        	url: function(){
        		if(!this.get("id") && !this.get("seriesid")) return "";
        		
        		return MetacatUI.appModel.get("metaServiceUrl") + 
                    (encodeURIComponent(this.get("id")) || encodeURIComponent(this.get("seriesid")));        		
        	},
        	            
            /* Updates the SystemMetadata for the object using MN.updateSystemMetadata() */
            updateSystemMetadata: function(sysmeta) {
                
                return this.id;
            },
            
            /* Validates the objects attributes on set() */
            validate: function() {
                var valid = false;
                
                return valid;
                
            },
            
            /*
             * Overload Backbone.Model.fetch, so that we can set custom options for each fetch() request
             */
            fetch: function(options){
            	console.log("Fetching " + this.get("id"));
            	
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
            	console.log("Parsing " + this.get("id"));
            	
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
            			var camelCasedKey = this.nodeNameMap[key];
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
            				obj = item.nodeValue;
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
			  
			 if(!this.hasUpdates()){
				 this.set("uploadStatus", null);
				 return;
			 }
			 
			 //Set the upload transfer as in progress
			 this.set("uploadStatus", "p");
			 
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

			//Put together the AJAX and Backbone.save() options
			var requestSettings = {
					url: this.url(),
					cache: false,
				    contentType: false,
				    dataType: "text",
				    processData: false,
					data: formData,
					parse: false,
					success: function(model, response, xhr){
						console.log('yay, DataONEObject has been saved');
						
						model.set("uploadStatus", "c");
					},
					error: function(model, response, xhr){
						console.log("error updating system metadata");
						model.set("uploadStatus", "e");
						model.trigger("errorSaving", response.responseText);
					}
			}
			
			//Add the user settings
			requestSettings = _.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings());
			
			//Send the Save request
			Backbone.Model.prototype.save.call(this, null, requestSettings);
		  },
		  
		  serializeSysMeta: function(options){
	        	//Get the system metadata XML that currently exists in the system
	        	var xml = $($.parseHTML(this.get("sysMetaXML")));
	        	
	        	//Update the system metadata values
	        	xml.find("serialversion").text(this.get("serialVersion") || "0");
	        	xml.find("identifier").text((this.get("newPid") || this.get("id")));
	        	xml.find("formatid").text(this.get("formatId"));
	        	xml.find("size").text(this.get("size"));
	        	xml.find("checksum").text(this.get("checksum"));
	        	xml.find("submitter").text(this.get("submitter") || MetacatUI.appUserModel.get("username"));
	        	xml.find("rightsholder").text(this.get("rightsHolder") || MetacatUI.appUserModel.get("username"));
	        	xml.find("archived").text(this.get("archived") || "false");
	        	xml.find("dateuploaded").text(this.get("dateUploaded") || new Date().toISOString());
	        	//	xml.find("datesysmetadatamodified").text(new Date().toISOString());
	        	xml.find("originmembernode").text(this.get("originMemberNode") || MetacatUI.nodeModel.get("currentMemberNode"));
	        	xml.find("authoritativemembernode").text(this.get("authoritativeMemberNode") || MetacatUI.nodeModel.get("currentMemberNode"));

	        	//Set the object file name
	        	if(this.get("fileName")){
	        		//Get the filename node
		        	var fileNameNode = xml.find("filename");
		        	
		        	//If the filename node doesn't exist, then create one
		        	if(!fileNameNode.length){
		        		fileNameNode = $(document.createElement("filename"));
		        		xml.find("authoritativemembernode").after(fileNameNode);
		        	}
		        	
		        	//Add the file name to the node
		        	$(fileNameNode).text(this.get("fileName"));
	        	}
	        	
	        	if(this.get("obsoletes"))
	        		xml.find("obsoletes").text(this.get("obsoletes"));
	        	else
	        		xml.find("obsoletes").remove();
	        	
	        	//If this object is obsoleted by another object
	        	if(this.get("obsoletedBy")){
	        		//Create a new obsoletedBy node if needed
	        		if(!xml.find("obsoletedby").length){
	        			xml.find("authoritativemembernode").after($(document.createElement("obsoletedby")).text(this.get("obsoletedBy")));
	        		}
	        		//Or update the existing obsoletedBy node
	        		else
	        			xml.find("obsoletedby").text(thisget("obsoletedBy"));
	        	}
	        	//If it's not obsoleted by another object, remove the node
	        	else
	        		xml.find("obsoletedby").remove();

	        	//Write the access policy
	        	var accessPolicyXML = this.serializeAccessPolicy();
	        	
	        	//Replace the old access policy with the new one
	        	xml.find("accesspolicy").replaceWith(accessPolicyXML); 
	        	        	
	        	var xmlString = $(document.createElement("div")).append(xml.clone()).html();
	        	
	        	//Now camel case the nodes 
	        	_.each(Object.keys(this.nodeNameMap), function(name, i, allNodeNames){
	        		var originalXMLString = xmlString;
	        		
	        		//Camel case node names
	        		var regEx = new RegExp("<" + name, "g");
	        		xmlString = xmlString.replace(regEx, "<" + this.nodeNameMap[name]);
	        		var regEx = new RegExp(name + ">", "g");
	        		xmlString = xmlString.replace(regEx, this.nodeNameMap[name] + ">");
	        		
	        		//If node names haven't been changed, then find an attribute
	        		if(xmlString == originalXMLString){
	        			var regEx = new RegExp(" " + name + "=", "g");
	        			xmlString = xmlString.replace(regEx, " " + this.nodeNameMap[name] + "=");
	        		}
	        	}, this);
	        	
	        	xmlString = xmlString.replace(/systemmetadata/g, "systemMetadata");
	        	
	        	console.log(xmlString);
	        	
	        	return xmlString;
	        },
	        
	        serializeAccessPolicy: function(){
	        	//Write the access policy
	        	var accessPolicyXML = '<accessPolicy>\n';        		
	        	_.each(this.get("accessPolicy"), function(policy, policyType, all){
	    			var fullPolicy = all[policyType];
	    			    			
	    			_.each(fullPolicy, function(policyPart){
	    				accessPolicyXML += '\t<' + policyType + '>\n';
	        			
	        			accessPolicyXML += '\t\t<subject>' + policyPart.subject + '</subject>\n';
	            		
	        			var permissions = Array.isArray(policyPart.permission)? policyPart.permission : [policyPart.permission];
	        			_.each(permissions, function(perm){
	        				accessPolicyXML += '\t\t<permission>' + perm + '</permission>\n';
	            		});
	        			
	        			accessPolicyXML += '\t</' + policyType + '>\n';
	    			});    			
	        	});       	
	        	accessPolicyXML += '</accessPolicy>';
	        	
	        	return accessPolicyXML;
	        },
	        
	        updateID: function(id){
	        	//Save the attributes so we can reset the ID later
	        	this.attributeCache = this.toJSON();
	        	
	        	//Set the old identifier
	        	var oldPid = this.get("id");
				this.set("oldPid", oldPid);
				
				//Set the new identifier
				if(id)
					this.set("id", id);
				else
					this.set("id", "urn:uuid:" + uuid.v4());
				
				//Update the obsoletes and obsoletedBy
				this.set("obsoletes", oldPid);
				this.set("obsoletedBy", null);
				
				//Update the collection this object is in
				
				
				//Set the archived option to false
				this.set("archived", false);
	        },
	        
	        resetID: function(){
	        	if(!this.attributeCache) return false;
	        	
	        	this.set("oldPid", this.attributeCache.oldPid);
	        	this.set("id", this.attributeCache.id);
	        	this.set("obsoletes", this.attributeCache.obsoletes);
	        	this.set("obsoletedBy", this.attributeCache.obsoletedBy);
	        	this.set("archived", this.attributeCache.archived);
	        },
	        
	        /*
	         * Checks if this model has updates that need to be synced with the server.
	         */
	        hasUpdates: function(){
	        	if(this.isNew() || !this.get("sysMetaXML")) return true;
	        	
	        	//Compare the new system metadata XML to the old system metadata XML
	        	var newSysMeta = this.serializeSysMeta(),
	        		oldSysMeta = $(document.createElement("div")).append($(this.get("sysMetaXML"))).html();
	        	
	        	return !(newSysMeta == oldSysMeta);
	        },
	        
	        isNew: function(){
	        	//Check if there is an original XML document that was retrieved from the server
	        	if(!this.get("objectXML") && this.get("synced")) return true;
	        	else return false;
	        },
	        
	        /*
	         * Listens to attributes on the model for changes that will require an update
	         */
	        listenForChanges: function(){
	        	this.on("change", function(model){
	        		if(this.changedAttributes().uploadStatus) return;
	        			
	        		if((this.get("uploadStatus") == "c") || !this.get("uploadStatus"))
	        			this.set("uploadStatus", "q");
	        	});
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
          }
        }); 
        
        return DataONEObject; 
    }
);