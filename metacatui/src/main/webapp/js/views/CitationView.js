define(['jquery', 'underscore', 'backbone', 'models/SolrResult'],
	function($, _, Backbone, SolrResult) {
	'use strict';


	var CitationView = Backbone.View.extend({

		initialize: function(options){
			if((options === undefined) || (!options)) var options = {};

			this.pid   		= options.pid	 	 || null;
			this.attributes = options.attributes || null;
			this.className += options.className  || "";
			this.model 		= options.model 	 || null;
			this.metadata   = options.metadata	 || null;
			this.createLink = (options.createLink == false) ? false : true;

			//If no model was passed, continue on
			if(!this.model && !this.metadata)
				return;
			//If a metadata doc was passed but no data or package model, then save the metadata as our model, too
			else if(!this.model && this.metadata) this.model = this.metadata;
			//If the model is a Package, then get the metadata doc in this package
			else if(this.model.type == "Package")
				this.metadata = this.model.getMetadata();
			//If the model is a metadata doc and there was no other metadata specified, then use the model
			else if((this.model.get("formatType") == "METADATA") && !this.metadata)
				this.metadata = this.model;
		},

		tagName : "cite",

		className : "citation",

		/*
		 * Creates a citation
		 */
		render: function(){

			//If there is no model provided but there is a pid
			if(!this.model && !this.metadata && this.pid){
				//Create a model
				this.metadata = new SolrResult({id: this.pid});
				this.model = this.metadata;

				//Retrieve the citation info for this model and render once we have it
				var view = this;
				this.model.on("change", function(){ view.render.call(view); });
				this.model.getCitationInfo();
				return;
			}
			else if(this.metadata && this.metadata.get("archived")){
				this.$el.append('<span class="danger">This content has been archived. </span>');

				//The ID
				var idEl = this.createIDElement();
				this.$el.append(idEl);

				return this;
			}
			//Create the citation from the metadata doc if we have one
			else if(this.metadata){

				var authors 	 = this.metadata.get("origin"),
					pubDate 	 = this.metadata.get("pubDate"),
					dateUploaded = this.metadata.get("dateUploaded"),
					title 		 = this.metadata.get("title"),
					datasource	 = this.metadata.get("datasource");

				//Format the author text
				var count=0,
					  authorText = "";

				_.each(authors, function(author) {
		             count++;

		             if(count == 6){
		            	 authorText += ", et al. ";
		            	 return;
		             }
		             else if(count > 6) return;

		             if(count > 1 && authors.length > 2) authorText += ",";

		             if (count > 1 && count == authors.length) authorText += " and";

		             if(authors.length > 1) authorText += " ";

		             authorText += author

		             if (count == authors.length) authorText += ". ";
		        });
			}
			//If there is no metadata doc, then this is probably a data doc without science metadata.
			//So create the citation from the index values
			else{
				var authorText   = this.model.get("rightsHolder") || this.model.get("submitter") || "",
					  dateUploaded = this.model.get("dateUploaded"),
					  datasource	 = this.model.get("datasource");

				//Format the author text
				if( authorText.indexOf(",O=") > -1 ){
					authorText = authorText.substring(3, authorText.indexOf(",O=")) + ". ";
				}
				else{
					authorText += ". ";
				}
			}

	        //The author
			var authorEl = $(document.createElement("span")).addClass("author").text(authorText);

	        //The publication date
			var pubDateText = "";
			if((typeof pubDate !== "undefined") && pubDate) {
				var pubDateFormatted = new Date(pubDate).getUTCFullYear();
	            if(!isNaN(pubDateFormatted)) pubDateText += pubDateFormatted;
	        }
	        if(dateUploaded && (isNaN(pubDateFormatted) || !pubDate)){
	        	var dateUploadedFormatted = new Date(dateUploaded).getFullYear();
	            if(!isNaN(dateUploadedFormatted)) pubDateText += dateUploadedFormatted;
	        }
			var pubDateEl = $(document.createElement("span")).addClass("pubdate").text(pubDateText + ". ");

			//The publisher (source member node)
			var publisherText = "";
			if(typeof datasource !== "undefined"){
				var memberNode = nodeModel.getMember(datasource);

				if(memberNode)
					publisherText = memberNode.name + ". ";
				else
					publisherText = datasource + ". ";
			}
			var publisherEl = $(document.createElement("span")).text(publisherText);

	        //The ID
			var idEl = this.createIDElement();

			//Create a link
			var idForLink = this.metadata? this.metadata.get("id") : this.model.get("id");

	        if(this.createLink){
	        	var linkEl = $(document.createElement("a"))
											     .addClass("route-to-metadata")
													 .attr("data-id", idForLink)
													 .attr("href", "#view/" + idForLink);
					}
	        else{
	        	var linkEl = document.createElement("span");
					}

	        if((typeof title !== "undefined") && title){
	        	var titleEl = $(document.createElement("span"))
													  .addClass("title")
														.attr("data-id", idForLink)
														.text(title + ". ");
					}
	        else{
	        	var titleEl = document.createElement("span");
					}

			//Put together all the citation parts
	        $(linkEl).append(authorEl, pubDateEl, titleEl, publisherEl, idEl);
	        this.$el.append(linkEl);

	        return this;
		},

		createIDElement: function(){

			var model    = this.metadata || this.model,
          id 			 = model.get("id"),
          seriesId = model.get("seriesId"),
          datasource = model.get("datasource");

			var idEl = $(document.createElement("span")).addClass("id");
			if(seriesId){
				//Create a link for the identifier if it is a DOI
				if( model.isDOI(seriesId) && !this.createLink ){
					var doiURL  = (seriesId.indexOf("doi:") == 0)? "https://doi.org/" + seriesId.substring(4) : seriesId,
							doiLink = $(document.createElement("a"))
													.attr("href", doiURL)
													.text(seriesId);

          // Begin PANGAEA-specific override 1 (this is temporary)
					// If this is a PENGAEA dataset with a seriesId, then don't show the pid.
				  if (typeof datasource !== "undefined" && datasource === "urn:node:PANGAEA") {
            idEl.append(doiLink, $(document.createElement("span")).text(". "));
          }
          // End PANGAEA-specific override 1
          else{
					  idEl.append(doiLink, $(document.createElement("span")).text(", version: "));
          }
				}
				else{
					// Begin PANGAEA-specific override 2 (this is temporary)
					// If this is a PENGAEA dataset with a seriesId, then don't show the pid.
				  if (typeof datasource !== "undefined" && datasource === "urn:node:PANGAEA") {
					  idEl.html($(document.createElement("span")).text(seriesId + ". "));
					}
					// End PANGAEA-specific override 2
					else{
						idEl.html($(document.createElement("span")).text(seriesId + ", version: "));
					}
				}
			}

      // Begin PANGAEA-specific override 3 (this is temporary)
			// If this is a PENGAEA dataset with a seriesId, then don't show the pid. Return now.
      if(typeof datasource !== "undefined" && datasource === "urn:node:PANGAEA" && seriesId){
        return idEl;
      }
      // End PANGAEA-specific override 3
			else if( id.indexOf("doi:") == 0 && !this.createLink ){
				var doiURL  = (id.indexOf("doi:") == 0)? "https://doi.org/" + id.substring(4) : id,
						doiLink = $(document.createElement("a"))
												.attr("href", doiURL)
												.text(id);

				idEl.append(doiLink, $(document.createElement("span")).text(". "));
			}
			else{
				idEl.append($(document.createElement("span")).text(id + ". "));
			}

			return idEl;
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
