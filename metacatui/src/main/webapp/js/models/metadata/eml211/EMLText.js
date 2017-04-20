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
			
			if(attributes.objectDOM) this.set(this.parse(attributes.objectDOM));

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
			
			var paragraphs = [];
			
			//Get the direct children of this text element and save them as paragraphs - ignore any nested formatting elements for now
			//TODO: Support more detailed text formattin
			paragraphs = _.map($(objectDOM).find('*'), function(el) {
				if (el.children.length > 0) {
					return "";
				} else {
					return el.textContent;
				}
			})

			var modelJSON = {
				text: _.filter(paragraphs, function(p) { return p.length > 0; })
			}
			
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
            var type = this.get("type") || this.get("parentAttribute"), 
                objectDOM = this.get("objectDOM") ? this.get("objectDOM").cloneNode(true) : document.createElement(type);
			 
			//Empty the DOM
			$(objectDOM).empty();
			 
			//Format the text
			var paragraphs = this.get("text");
			_.each(paragraphs, function(p){
				 if(!p.length) p = " ";
				 
				$(objectDOM).append("<para>" + p + "</para>");
			});
			 
			// Remove empty (zero-length or whitespace-only) nodes
			$(objectDOM).find("*").filter(function() { return $.trim(this.innerHTML) === ""; } ).remove();
			
			return objectDOM;
		},
		
		trickleUpChange: function(){
			MetacatUI.rootDataPackage.packageModel.set("changed", true);
		},
		
		formatXML: function(xmlString){
			return DataONEObject.prototype.formatXML.call(this, xmlString);
		}
	});
	
	return EMLText;
});