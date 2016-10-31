/*global define */
define(['jquery',
        'jqueryui',
		'underscore', 
		'backbone'
		], 				
	function($, $ui, _, Backbone) {
	'use strict';

	
	var ScienceMetadataView = Backbone.View.extend({
		
		type: "ScienceMetadata",
		
		initialize: function(){
			
		},
		
		render: function(){
			
		},
		
		formatParagraphs: function(xmlText, edit){
			//Get the abstract text
	    	var paragraphs = [],
	    		formattedText = "";
	    	
	    	//Put the abstract in an array format to seperate out paragraphs
	    	if(typeof xmlText.para == "string")
	    		paragraphs.push(xmlText.para);
	    	else if(typeof xmlText == "string")
	    		paragraphs.push(xmlText);
	    	else if(Array.isArray(xmlText.para))
	    		paragraphs = xmlText.para;
	    	
	    	//For each paragraph, insert a new line
	    	_.each(paragraphs, function(p){	    		
	    		if(edit)
	    			formattedText += p + "\n";
	    		else
	    			formattedText += "<p>" + p + "</p>";
	    	});
	    	
	    	return formattedText;
		},
		
		unformatParagraphs: function(htmlText){
			var paragraphs = htmlText.split("\n"),
				xmlText = "";
			
			_.each(paragraphs, function(p){
				xmlText += "<para>" + p + "</para>";
			});
			
			return xmlText;
		},
		
	    /*
	     * When a text element is changed, update the attribute in the model
	     */
	    updateText: function(e){
	    	var textEl = e.target;
	    	
	    	//Get the new abstract text
	    	var newText = this.unformatParagraphs($(textEl).val());
	    	
	    	//Update the model
	    	this.model.set($(textEl).attr("data-category"), newText);
	    }
	});

	return ScienceMetadataView;
});