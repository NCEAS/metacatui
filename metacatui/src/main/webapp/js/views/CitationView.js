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
			
			//If a metadata doc was passed but no data or package model, then save the metadata as our model, too
			if(!this.model && this.metadata) this.model = this.metadata;			
			//If the model is a Package, then get the metadata doc in this package				
			else if(this.model.type == "Package") 
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
					id 			 = this.metadata.get("id"),
					datasource	 = this.metadata.get("datasource");
			
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
					id 			 = this.model.get("id"),
					datasource	 = this.model.get("datasource");
				
				//Format the author text
				var authorText = author.substring(3, author.indexOf(",O=")) + ". ";				
			}		
   
	        //The author
			var authorEl = $(document.createElement("span")).addClass("author").text(authorText);
	        
	        //The publication date
			var pubDateText = "";
			if((typeof pubDate !== "undefined") && pubDate) { 
				var pubDateFormatted = moment(pubDate).format('YYYY');
	            if(!isNaN(pubDateFormatted)) pubDateText += pubDateFormatted;
	        }
	        if(dateUploaded && (isNaN(pubDateFormatted) || !pubDate)){
	        	var dateUploadedFormatted = moment(dateUploaded).format('YYYY');
	            if(!isNaN(dateUploadedFormatted)) pubDateText += dateUploadedFormatted;
	        }
			var pubDateEl = $(document.createElement("span")).addClass("pubdate").text("(" + pubDateText + "): ");
			
			//The publisher (source member node)
			var publisherText = "";
			if(typeof datasource !== "undefined"){ 
				var memberNode = _.find(nodeModel.get("members"), function(member){
					return (member.identifier == datasource);
				});
				if(typeof memberNode !== "undefined") publisherText = memberNode.name + ". "; 
			}	
			var publisherEl = $(document.createElement("span")).text(publisherText);
			
	        //The ID
	        var idEl = $(document.createElement("span")).addClass("id").text("ID: " + id + ".");
			
			//Create a link
			var linkEl = $(document.createElement("a"));
			
	        //The title will be clickable for citations with science metadata
	        if((typeof title !== "undefined") && title){
				$(linkEl).addClass("title view-link").attr("href", "#view/" + encodeURIComponent(id)).attr("pid", id).text(title + ". ");

				//Put together all the citation parts
				this.$el.append(authorEl, pubDateEl, linkEl, publisherEl, idEl);
	        }
	        //The entire citation will be clickable for citations without a title/science metadata
	        else{
	        	$(linkEl).attr("href", appModel.get("objectServiceUrl") + id).append(authorEl, pubDateEl, publisherEl, idEl);
	        	this.$el.append(linkEl);
	        }
	            
	        return this;         
		}
	});
	
	return CitationView;
});