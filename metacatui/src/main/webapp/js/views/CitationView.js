define(['jquery', 'underscore', 'backbone'], 				
	function($, _, Backbone) {
	'use strict';

	
	var CitationView = Backbone.View.extend({
		
		initialize: function(options){
			if((options === undefined) || (!options)) var options = {};
			
			this.id   		= options.id	 	 || null;
			this.attributes = options.attributes || null;
			this.className += options.className  || "";
			this.model 		= options.model 	 || null;
		},
				
		tagName : "div",
		
		className : "citation",
		
		events: {
			
		},
		
		/*
		 * Creates a citation
		 */
		render: function(){
			var metadata = this.model;
			
			//If the model is a Package, then get the metadata doc in this package
			if(this.model.type == "Package") metadata = this.model.getMetadata();
			
			if(!metadata) return this;
				
			var authors 	 = metadata.get("origin"),
				pubDate 	 = metadata.get("pubDate"),
				dateUploaded = metadata.get("dateUploaded"),
				title 		 = metadata.get("title"),
				id 			 = metadata.get("id");
				
			var authorEl = $(document.createElement("span")).addClass("author"),
				pubDateEl = $(document.createElement("span")).addClass("pubdate"),
				titleEl = $(document.createElement("a")).addClass("title view-link").attr("href", "#view/" + encodeURIComponent(id)).attr("pid", id),
				idEl = $(document.createElement("span")).addClass("id");
				
			var authorText = "",
				pubDateText = "";			
				
			//Format the author text
			var count=0; 
			_.each(authors, function(author) {
	             count++;
	             if (count > 1) authorText += ", ";
	                
	             if (count > 1 && count == authors.length) authorText += "and ";
	                
	             authorText += author
	                
	             if (count == authors.length) authorText += ". ";
	        });
				
			//Format the publication date text
			if(pubDate) { 
				var pubDateFormatted = moment(pubDate).format('YYYY');
	            if(!isNaN(pubDateFormatted)) pubDateText += pubDateFormatted + '. ';
	        }
	        if(dateUploaded && isNaN(pubDateFormatted)){
	        	var dateUploadedFormatted = moment(dateUploaded).format('YYYY');
	            if(!isNaN(dateUploadedFormatted)) pubDateText += dateUploadedFormatted + '. ';
	        } 
	             
	        //Insert the text into their elements
	        $(authorEl).text(authorText);
	        $(pubDateEl).text(pubDateText); 
	        $(titleEl).text(title);     
	        $(idEl).text("ID: " + id); 
	             
	        //Add all the elements to the container
	        $(this.el).append(authorEl).append(pubDateEl).append(titleEl).append(idEl);
	            
	        return this;         
		}
	});
	
	return CitationView;
});