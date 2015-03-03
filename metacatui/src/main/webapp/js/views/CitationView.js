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
			this.metadata   = options.metadata	 || null;
			
			//If the model is a Package, then get the metadata doc in this package
			if(this.model.type == "Package") 
				this.metadata = this.model.getMetadata();
			//If the model is a metadata doc and there was no other metadata specified, then use the model
			else if((this.model.get("formatType") == "METADATA") && !this.metadata) 
				this.metadata = this.model;			
		},
				
		tagName : "cite",
		
		className : "citation",
		
		events: {
			
		},
		
		/*
		 * Creates a citation
		 */
		render: function(){
			
			if(!this.model && !this.metadata) return this;
			
			//Create the citation from the metadata doc if we have one
			else if(this.metadata){
				var authors 	 = this.metadata.get("origin"),
					pubDate 	 = this.metadata.get("pubDate"),
					dateUploaded = this.metadata.get("dateUploaded"),
					title 		 = this.metadata.get("title"),
					id 			 = this.metadata.get("id");
			
				//Format the author text
				var count=0,
					authorText = "";
				_.each(authors, function(author) {
		             count++;
		             if (count > 1) authorText += ", ";
		                
		             if (count > 1 && count == authors.length) authorText += "and ";
		                
		             authorText += author
		                
		             if (count == authors.length) authorText += ". ";
		        });
			}
			//If there is no metadata doc, then this is probably a data doc without science metadata. 
			//So create the citation from the index values
			else{
				var author 	 	 = this.model.get("rightsHolder"),
					dateUploaded = this.model.get("dateUploaded"),
					id 			 = this.model.get("id");
				
				//Format the author text
				var authorText = author.substring(3, author.indexOf(",O=")) + ". ";				
			}		
   
	        //The author
			var authorEl = $(document.createElement("span")).addClass("author").text(authorText);
	        
	        //The publication date
			var pubDateText = "";
			if(typeof pubDate !== "undefined") { 
				var pubDateFormatted = moment(pubDate).format('YYYY');
	            if(!isNaN(pubDateFormatted)) pubDateText += pubDateFormatted;
	        }
	        if(dateUploaded && (isNaN(pubDateFormatted) || !pubDate)){
	        	var dateUploadedFormatted = moment(dateUploaded).format('YYYY');
	            if(!isNaN(dateUploadedFormatted)) pubDateText += dateUploadedFormatted;
	        }
			var pubDateEl = $(document.createElement("span")).addClass("pubdate").text("(" + pubDateText + "): ");
	        
	        //The title will be clickable for citations with science metadata
	        if(typeof title !== "undefined"){
				var titleEl = $(document.createElement("a")).addClass("title view-link").attr("href", "#view/" + encodeURIComponent(id)).attr("pid", id).text(title + ". ");
	        	this.$el.append(authorEl).append(pubDateEl).append(titleEl);
	        }
	        //The author and pubDate will be clickable for citations without science metadata
	        else{
				var linkEl = $(document.createElement("a")).attr("href", appModel.get("objectServiceUrl") + id).append(authorEl).append(pubDateEl);
	        	this.$el.append(linkEl);
	        }
	        
	        //The ID
	        var idEl = $(document.createElement("span")).addClass("id").text(id + ".");
	        this.$el.append(idEl);
	            
	        return this;         
		}
	});
	
	return CitationView;
});