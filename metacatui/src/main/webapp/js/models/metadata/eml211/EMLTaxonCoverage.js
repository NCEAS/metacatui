/* global define */
define(['jquery', 'underscore', 'backbone', 'models/DataONEObject'], 
    function($, _, Backbone, DataONEObject) {

	var EMLTaxonCoverage = Backbone.Model.extend({
		
		defaults: {
			objectXML: null,
			objectDOM: null,
			parentAttribute: null,
			parentModel: null
		
		},
		
		initialize: function(attributes){
			if(attributes.objectDOM) 
				this.set(this.parse(attributes.objectDOM));

			//TODO: Add specific attributes to listen to
			//this.on("change", this.trickleUpChange);
		},
		
		/*
         * Maps the lower-case EML node names (valid in HTML DOM) to the camel-cased EML node names (valid in EML). 
         * Used during parse() and serialize()
         */
        nodeNameMap: function(){
        	return {
            	"generaltaxonomiccoverage" : "generalTaxonomicCoverage",
            	"taxonomicclassification" : "taxonomicClassification",
            	"taxonrankname" : "taxonRankName",
            	"taxonrankvalue" : "taxonRankValue",
            	"taxonomiccoverage" : "taxonomicCoverage"
            }
        },
		
		parse: function(objectDOM){
			if(!objectDOM)
				var xml = this.get("objectDOM");
			
			var modelJSON = {};
			
			return modelJSON;
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
		
		trickleUpChange: function(){
			this.get("parentModel").trigger("change", null, {changed: [this.get("parentAttribute")] });
		},
		
		formatXML: function(xmlString){
			return DataONEObject.prototype.formatXML.call(this, xmlString);
		}
	});
	
	return EMLTaxonCoverage;
});