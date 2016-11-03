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
		
		/*
		 * Takes the text object from a metadata model and returns it as HTML formatted with paragraph elements
		 */
		formatParagraphs: function(text, edit){
			//Get the abstract text
	    	var paragraphs = [],
	    		formattedText = "";
	    	
	    	//Get the text from the content attribute is it exists
	    	if(text && text.content) text = text.content;

	    	//Put the abstract in an array format to seperate out paragraphs
	    	if(typeof text.para.content == "string")
	    		paragraphs.push(text.para.content);
	    	else if(typeof text == "string")
	    		paragraphs.push(text.content || text);
	    	else if(Array.isArray(text.para)){
	    		paragraphs = _.pluck(text.para, "content");
	    	}
	    	
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
			var paragraphs = htmlText.trim().split("\n"),
				modelAttr = {};
			
			_.each(paragraphs, function(p){
				modelAttr.para = { content: p };
			});
			
			return modelAttr;
		},
		
	    /*
	     * When a text element is changed, update the attribute in the model
	     */
	    updateText: function(e){
	    	var textEl = e.target;
	    	
	    	//Get the new abstract text
	    	var newAttr = this.unformatParagraphs($(textEl).val());
	    	
	    	//Update the model
	    	this.model.set($(textEl).attr("data-category"), newAttr);
	    }
	});

	return ScienceMetadataView;
});