/* global define */
define(['jquery', 'underscore', 'backbone', 'models/DataONEObject'], 
    function($, _, Backbone, DataONEObject) {

	var EMLText = Backbone.Model.extend({
		
		type: "EMLText",
		
		defaults: {
			objectXML: null,
			objectDOM: null,
			parentModel: null,
			text: [] //The text content
		},
		
		initialize: function(attributes){
			var attributes = attributes || {}
			
			if(attributes.objectDOM) 
				this.set(this.parse(attributes.objectDOM));

			if(attributes.text) {
				if (_.isArray(attributes.text)) {
					this.text = attributes.text
				} else {
					this.text = [attributes.text]
				}
			}

			this.on("change:text", this.trickleUpChange);
		},

		/*
         * Maps the lower-case EML node names (valid in HTML DOM) to the camel-cased EML node names (valid in EML). 
         * Used during parse() and serialize()
         */
		nodeNameMap: function(){
			return{

			}
		},
		
		parse: function(objectDOM){
			if(!objectDOM)
				var objectDOM = this.get("objectDOM").cloneNode(true);
			
			//Start a list of paragraphs
			var paragraphs = [];
			
			//Get all the contained nodes of this text element
			var allNodes = $(objectDOM).find('*');
			
			// Save all the contained nodes as paragraphs
			// ignore any nested formatting elements for now
			//TODO: Support more detailed text formatting
			if( allNodes.length ){
				
				_.each(allNodes, function(node) {
					if( node.textContent )
						paragraphs.push(node.textContent);
				});
				
			}
			else if( objectDOM.textContent ){
				paragraphs[0] = objectDOM.textContent;
			}
			
			return {
				text: paragraphs
			}
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
            var type = this.get("type") || this.get("parentAttribute") || 'text', 
                objectDOM = this.get("objectDOM") ? this.get("objectDOM").cloneNode(true) : document.createElement(type);
			 
			//Empty the DOM
			$(objectDOM).empty();
			 
			//Format the text
			var paragraphs = this.get("text");
			_.each(paragraphs, function(p){
				
				//If this paragraph text is a string, add a <para> node with that text
				if( typeof p == "string" && p.trim().length )
					$(objectDOM).append("<para>" + p + "</para>");
				 
			});
			 			
			return objectDOM;
		},
		
		trickleUpChange: function(){
			MetacatUI.rootDataPackage.packageModel.set("changed", true);
		},
		
		formatXML: function(xmlString){
			return DataONEObject.prototype.formatXML.call(this, xmlString);
		},

		isEmpty: function() {
			for (var i = 0; i < this.get('text').length; i++) {
				if (this.get('text')[i].length > 0) return false;
			}
			
			return true;
		},

		toString: function() {
			var value = [];

			if (_.isArray(this.get('text'))) {
				value = this.get('text');
			}

			return value.join('\n\n');
		}
	});
	
	return EMLText;
});