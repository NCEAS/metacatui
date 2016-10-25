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
            		return this.xmlToJson($.parseHTML(response)[1]);
            	
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
            xmlToJson: function(xml) {
            	
            	// Create the return object
            	var obj = {};
            	
            /*	if (xml.nodeType == 1) { // element
            		// do attributes
            		if (xml.attributes.length > 0) {
            		obj["@attributes"] = {};
            			for (var j = 0; j < xml.attributes.length; j++) {
            				var attribute = xml.attributes.item(j);
            				obj["@attributes"][attribute.localName] = attribute.nodeValue;
            			}
            		}
            	} else if (xml.nodeType == 3) { // text
            		obj = xml.nodeValue;
            	}
*/

            	// do children
            	if (xml.hasChildNodes()) {
            		for(var i = 0; i < xml.childNodes.length; i++) {
            			var item = xml.childNodes.item(i);
            			
            			if((item.nodeType == 3) && (!item.nodeValue.trim()))
            				continue;
            			
            			var nodeName = item.localName;
            			if((typeof(obj[nodeName]) == "undefined") && (item.nodeType == 1)) {
            				obj[nodeName] = this.xmlToJson(item);
            			}
            			else if((typeof(obj[nodeName]) == "undefined") && (item.nodeType == 3)){
            				obj = item.nodeValue;
            			}
            			else if(typeof(obj[nodeName]) != "undefined"){	
            				var old = obj[nodeName];
            				
            				if(!Array.isArray(old))
            					old = [old];
         					
        					if(item.nodeType == 1)
        						var newArray = old.concat(this.xmlToJson(item));
        					else if(item.nodeType == 3)
        						var newArray = old.concat(item.nodeValue);
        						
        					obj[nodeName] = newArray;          				
            			}
        			}
            		
            	}
            	return obj;
            }
            
                    
        }); 
        
        return DataONEObject; 
    }
);