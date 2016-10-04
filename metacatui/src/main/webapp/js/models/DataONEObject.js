/* global define */
"use strict";
define(['jquery', 'underscore', 'backbone', 'models/UserModel'],
    function($, _, Backbone, UserModel){
  
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
	            id: null,
	            formatid: null,
	            formatType: null,
	            size: null,
	            checksum: null,
	            checksumAlgorithm: null,
	            submitter: null,
	            rightsholder : null,
	            accesspolicy: [],
	            replicationpolicy: [],
	            obsoletes: null,
	            obsoletedBy: null,
	            archived: null,
	            dateUploaded: null,
	            datesysmetadatamodified: null,
	            originmembernode: null,
	            authoritativemembernode: null,
	            replica: [],
	            seriesId: null,
	            mediaType: null,
	            fileName: null,
	            nodeLevel: null,
	            uploadStatus: null,
	            uploadFile: null
        	},
        	
            initialize: function(options) {
                console.log("DataONEObject.initialize() called.");
                
            },
            
        	url: function(){
        		if(!this.get("id") || !this.get("seriesId")) return "";
        		
        		return MetacatUI.appModel.get("metaServiceUrl") + (this.get("id") || this.get("seriesId"));        		
        	},
        	
            /* Returns the serialized SystemMetadata for the object */
            getSystemMetadata: function() {
                var sysmeta = "";
                
                return sysmeta;
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
             * A proxy to Backbone.model.fetch, so that we can set custom options for each fetch() request
             */
            _fetch: function(options){
            	//If we are using the Solr service to retrieve info about this object, then construct a query
            	if((typeof options != "undefined") && options.solrService){
            		
            		//Get basic information 
            		var query = "";
            		//Do not search for seriesId when it is not configured in this model/app
        			if(typeof this.get("seriesId") === "undefined")
        				query += 'id:"' + encodeURIComponent(this.get("id")) + '"';
        			//If there is no seriesId set, then search for pid or sid 
        			else if(!this.get("seriesId"))
        				query += '(id:"' + encodeURIComponent(this.get("id")) + '" OR seriesId:"' + encodeURIComponent(this.get("id")) + '")';
        			//If a seriesId is specified, then search for that
        			else if(this.get("seriesId") && (this.get("id").length > 0))
        				query += '(seriesId:"' + encodeURIComponent(this.get("seriesId")) + '" AND id:"' + encodeURIComponent(this.get("id")) + '")';
        			//If only a seriesId is specified, then just search for the most recent version
        			else if(this.get("seriesId") && !this.get("id"))
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
            	this.fetch(fetchOptions);
            },
            
            /* 
             * This function is called by Backbone.Model.fetch.
             * It deserializes the incoming XML from the /meta REST endpoint and converts it into JSON.
           */

            parse: function(response){
            	//If the response is XML
            	if((typeof response == "string") && response.indexOf("<") == 0)
            		return this.xmlToJson($.parseHTML(response)[1]);
            	
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