define(['jquery', 'underscore', 'backbone', 'moment'], 				
	function($, _, Backbone, moment) {
	'use strict';

	
	var CitationView = Backbone.View.extend({
		
		initialize: function(options){
			if((options === undefined) || (!options)) var options = {};
			
			this.id   		= options.id	 	 || null;
			this.attributes = options.attributes || null;
			this.className += options.className  || "";
			this.model 		= options.model 	 || null;
			this.metadata   = options.metadata	 || null;
			this.createLink = (options.createLink == false) ? false : true;
			
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
			//"click .route-to-metadata" : "routeToMetadata"
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
					seriesId     = appModel.get("useSeriesId")? this.metadata.get("seriesId") : null,
					datasource	 = this.metadata.get("datasource");
			
				//Format the author text
				var count=0,
					authorText = "";
				_.each(authors, function(author) {
		             count++;
		             if (count > 1 && authors.length > 2) authorText += ",";
		     		                
		             if (count > 1 && count == authors.length) authorText += " and";
		     
		             if(authors.length > 1) authorText += " ";

		             authorText += author
		                
		             if (count == authors.length) authorText += ". ";
		        });
			}
			//If there is no metadata doc, then this is probably a data doc without science metadata. 
			//So create the citation from the index values
			else{
				var author 	 	 = this.model.get("rightsHolder") || this.model.get("submitter") || "",
					dateUploaded = this.model.get("dateUploaded"),
					id 			 = this.model.get("id"),
					datasource	 = this.model.get("datasource");
				
				//Format the author text
				var authorText = author? author.substring(3, author.indexOf(",O=")) + ". " : "";
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
			var pubDateEl = $(document.createElement("span")).addClass("pubdate").text(pubDateText + ". ");
			
			//The publisher (source member node)
			var publisherText = "";
			if(typeof datasource !== "undefined"){ 
				var memberNode = _.find(nodeModel.get("members"), function(member){
					return (member.identifier == datasource);
				});
				if(typeof memberNode !== "undefined") 
					publisherText = memberNode.name + ". "; 
				else
					publisherText = datasource + ". "; 
			}	
			var publisherEl = $(document.createElement("span")).text(publisherText);
			
	        //The ID
			var idEl = $(document.createElement("span")).addClass("id");
			if(seriesId){
				$(idEl).text(seriesId + ", version: " + id + ". ");
			}
			else{
		        $(idEl).text("" + id + ". ");				
			}
			
			//Create a link
	        if(this.createLink)
	        	var linkEl = $(document.createElement("a")).addClass("route-to-metadata").attr("data-id", id).attr("href", "#view/" + id);
	        else
	        	var linkEl = document.createElement("span");
			
	        if((typeof title !== "undefined") && title)
	        	var titleEl = $(document.createElement("span")).addClass("title").attr("data-id", id).text(title + ". ");
	        else
	        	var titleEl = document.createElement("span");

			//Put together all the citation parts
	        $(linkEl).append(authorEl, pubDateEl, titleEl, publisherEl, idEl);
	        this.$el.append(linkEl);
	            
	        return this;         
		},
		
		routeToMetadata: function(e){
			var id = this.model.get("id");
			
			//If the user clicked on a download button or any element with the class 'stop-route', we don't want to navigate to the metadata
			if ($(e.target).hasClass('stop-route') || (typeof id === "undefined") || !id)
				return;
			
			uiRouter.navigate('view/'+id, {trigger: true});
		}
	});
	
	return CitationView;
});