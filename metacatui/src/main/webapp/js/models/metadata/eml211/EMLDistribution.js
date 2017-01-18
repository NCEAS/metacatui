/* global define */
define(['jquery', 'underscore', 'backbone', 'models/DataONEObject'], 
    function($, _, Backbone, DataONEObject) {

	var EMLDistribution = Backbone.Model.extend({
		
		defaults: {
			objectXML: null,
			objectDOM: null,
			mediumName: null,
			mediumVolume: null,
			mediumFormat: null,
			mediumNote: null,
			onlineDescription: null
		},
		
		initialize: function(attributes){
			if(attributes.objectDOM) this.parse(attributes.objectDOM);

		},

		/*
         * Maps the lower-case EML node names (valid in HTML DOM) to the camel-cased EML node names (valid in EML). 
         * Used during parse() and serialize()
         */
		nodeNameMap: function(){
			return{
				"authsystem" : "authSystem",
				"mediumformat" : "mediumFormat",
				"mediumname" : "mediumName",
				"mediumnote" : "mediumNote",
				"mediumvolume" : "mediumVolume",
				"onlinedescription" : "onlineDescription"
			}
		},
		
		parse: function(objectDOM){
			if(!objectDOM)
				var xml = this.get("objectDOM");
			
			var offline = $(xml).find("offline"),
				online = $(xml).find("online");
			
			if(offline.length){
				if($(offline).children("mediumname").length) this.parseNode($(offline).children("mediumname"));
				if($(offline).children("mediumvolume").length) this.parseNode($(offline).children("mediumvolume"));
				if($(offline).children("mediumformat").length) this.parseNode($(offline).children("mediumformat"));
				if($(offline).children("mediumnote").length) this.parseNode($(offline).children("mediumnote"));
			}
			
			if(online.length){
				if($(online).children("onlinedescription").length) this.parseNode($(online).children("onlinedescription"));
			}
		},
		
		parseNode: function(node){
			if(!node || (Array.isArray(node) && !node.length))
				return;
			
			this.set($(node)[0].localName, $(node).text());
		},
		
		serialize: function(){
			var objectDOM = this.updateDOM(),
				xmlString = objectDOM.outerHTML;
		
			//Camel-case the XML
	    	xmlString = this.formatXML(xmlString);
    	
	    	return xmlString;
		},
		
		/*
		 * Makes a copy of the original XML DOM and updates it with the new values from the model.
		 */
		updateDOM: function(){
			 var objectDOM = this.get("objectDOM").cloneNode(true);
			 
			 return objectDOM;
		},
		
		formatXML: function(xmlString){
			return DataONEObject.prototype.formatXML.call(this, xmlString);
		}
	});
	
	return EMLDistribution;
});