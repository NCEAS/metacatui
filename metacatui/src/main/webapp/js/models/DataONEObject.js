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
            
        	defaults: {
	            type: null,
	            serialversion: null,
	            id: "urn:uuid:" + uuid.v4(),
	            formatid: null,
	            formattype: null,
	            size: null,
	            sizeStr: null,
	            checksum: null,
	            checksumalgorithm: null,
	            submitter: null,
	            rightsholder : null,
	            accesspolicy: [],
	            replicationpolicy: [],
	            obsoletes: null,
	            obsoletedby: null,
	            archived: null,
	            dateuploaded: null,
	            datesysmetadatamodified: null,
	            originmembernode: null,
	            authoritativemembernode: null,
	            replica: [],
	            seriesid: null, // uuid.v4(), (decide if we want to auto-set this)
	            mediatype: null,
	            filename: null,
	            nodelevel: null,
	            upload_status: null,
	            upload_file: null
        	},
        	
            initialize: function(attrs, options) {
                console.log("DataONEObject.initialize() called.");
                this.on("change:size", this.bytesToSize);
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
	            		url: MetacatUI.appModel.get("queryServiceUrl") + 'q=' + query + "&fl=" + fl + "&wt=json"
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
            	// If the response is XML
            	if( (typeof response == "string") && response.indexOf("<") == 0 ) {
            		return this.toJson($.parseHTML(response)[1]);
            	
                // Otherwise we have an object already    
            	} else if ( typeof response === "object") {
            	    return response;
                    
                }
                
                // Default to returning the Solr results            	
            	return response.response.docs[0];
            },
            
            /*
             Serializes the DataONEObject into a SystemMetadata document.
            */
            toXML: function() {
                var sysmeta = "";
                
                return sysmeta;
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
            			_.each(item.attributes, function(attr){
            				obj[nodeName][attr.localName] = attr.nodeValue;
            			});
            			
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
				if(attributeNames && Array.isArray(attributeNames)){
					_.each(attributeNames, function(attr){
						$(node).attr(attr, json[key][attr]);
					});
				}
				
				$(containerNode).append(node);
			}
			
			return containerNode;
		  }          
        }); 
        
        return DataONEObject; 
    }
);