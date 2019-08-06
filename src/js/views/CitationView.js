define(['jquery', 'underscore', 'backbone', 'models/SolrResult'],
	function($, _, Backbone, SolrResult) {
	'use strict';


	var CitationView = Backbone.View.extend({

		type: "Citation",

		initialize: function(options){
			if((options === undefined) || (!options)) var options = {};

			this.id   		= options.id	 	 || null;
			this.attributes = options.attributes || null;
			this.className += options.className  || "";
			this.model 		= options.model 	 || null;
			this.metadata   = options.metadata	 || null;
			this.title      = options.title      || null;
			this.createLink = (options.createLink == false) ? false : true;
			this.createTitleLink = (options.createLink == false) ? false : true;

			//If a metadata doc was passed but no data or package model, then save the metadata as our model, too
			if(!this.model && this.metadata) this.model = this.metadata;
			//If the model is a Package, then get the metadata doc in this package
			else if(this.model && this.model.type == "Package")
				this.metadata = this.model.getMetadata();
			//If the model is a metadata doc and there was no other metadata specified, then use the model
			else if(this.model && (this.model.get("formatType") == "METADATA") && !this.metadata)
				this.metadata = this.model;
		},

		tagName : "cite",

		className : "citation",

		/*
		 * Creates a citation
		 */
		render: function(){

			if (!this.model && !this.metadata && !this.id)
				return this;
			else if(!this.model && !this.metadata && this.id){
				//Create a model
 				this.metadata = new SolrResult({id: this.id});
 				this.model = this.metadata;

 				//Retrieve the citation info for this model and render once we have it
 				var view = this;
 				this.model.on("change", function(){ view.render.call(view); });
 				this.model.getCitationInfo();
 				return;
			}
			// If the model is retreived from the Metrics Service
			// and of type CitationModel, simply set the fields as
			//  retrieved from the response
			else if(this.model.type == "CitationModel") {
				var authorText = this.model.get("origin") || "",
					datasource = this.model.get("journal"),
					dateUploaded = this.model.get("year_of_publishing"),
					sourceUrl = this.model.get("source_url"),
					sourceId = this.model.get("source_id"),
					title = this.model.get("title"),
					journal =this.model.get("publisher"),
					volume =this.model.get("volume"),
					page =this.model.get("page");

				// Format the Author textarea				else if (this.model.type == "CitationModel") {
				if (authorText.length > 0) {
                	var authors = authorText.split(", "),
						count = 0,
						authorText = "";

					_.each(authors, function (author) {
						count++;

						if(count == 6){
							authorText += ", et al. ";
							return;
						}
						else if(count > 6)
							return;

						if(count > 1){
							if(authors.length > 2) authorText += ",";

							if (count == authors.length) authorText += " and";

							if (authors.length > 1) authorText += " ";
						}

						authorText += author;

						if (count == authors.length) authorText += ". ";
					});

				}
			}
 			else if(this.metadata && this.metadata.get("archived") && !MetacatUI.appModel.get("archivedContentIsIndexed")){
 				this.$el.append('<span class="danger">This content has been archived. </span>');

 				//The ID
				var idEl = this.createIDElement();
 				this.$el.append(idEl);

 				return this;
 			}
			//Create the citation from the metadata doc if we have one
			else if (this.metadata) {

				//If this object is in progress of saving, don't RErender this view.
				if(this.metadata.get("uploadStatus") == "p" && this.$el.children().length)
					return;

				//Clear the element
				this.$el.html("");

				var pubDate = this.metadata.get("pubDate"),
					dateUploaded = this.metadata.get("dateUploaded"),
					title = Array.isArray(this.metadata.get("title")) ? (this.metadata.get("title")[0] || this.title || "") : this.metadata.get("title") || this.title || "",
					datasource = this.metadata.get("datasource");

				//Format the author text
				if(this.metadata.type == "EML"){
					var authors = this.metadata.get("creator"),
						count = 0,
						authorText = "";

					_.each(authors, function (author) {
						count++;

						if(count == 6){
	 		            	authorText += ", et al. ";
	 		            	return;
	 		            }
	 		            else if(count > 6)
	 		            	return;

	 		            //Get the individual's name, or position name, or organization name, in that order
						var name = author.get("individualName") ?
									_.flatten([author.get("individualName").givenName, author.get("individualName").surName]).join(" ") :
									author.get("positionName") || author.get("organizationName");

						if(count > 1){
		 		            if(authors.length > 2) authorText += ",";

							if (count == authors.length) authorText += " and";

							if (authors.length > 1) authorText += " ";
						}

						authorText += name;

						if (count == authors.length) authorText += ". ";
					});
				}
				else{
					var authors = this.metadata.get("origin"),
						count = 0,
						authorText = "";

					_.each(authors, function (author) {
						count++;

						if(count == 6){
	 		            	authorText += ", et al. ";
	 		            	return;
	 		            }
	 		            else if(count > 6)
	 		            	return;

						if(count > 1){
		 		            if(authors.length > 2) authorText += ",";

							if (count == authors.length) authorText += " and";

							if (authors.length > 1) authorText += " ";
						}

						authorText += author;

						if (count == authors.length) authorText += ". ";
					});
				}
			}
			//If there is no metadata doc, then this is probably a data doc without science metadata.
			//So create the citation from the index values
			else {

				var authorText = this.model.get("rightsHolder") || this.model.get("submitter") || "",
					dateUploaded = this.model.get("dateUploaded"),
					datasource = this.model.get("datasource");
			}

			//The author
			var authorEl = $(document.createElement("span")).addClass("author").text(authorText);

			//The publication date
			var pubDateText = "";
			if ((typeof pubDate !== "undefined") && pubDate) {
				var pubDateFormatted = new Date(pubDate).getUTCFullYear();
				if (!isNaN(pubDateFormatted)) pubDateText += pubDateFormatted;
			}
			if (dateUploaded && (isNaN(pubDateFormatted) || !pubDate)) {
				var dateUploadedFormatted = dateUploaded;
				if (!isNaN(dateUploadedFormatted)) pubDateText += dateUploadedFormatted;
			}
			var pubDateEl = $(document.createElement("span")).addClass("pubdate")

			// Only set text if we have a non-zero-length pubDate string
			if (pubDateText.length > 0) {
				pubDateEl.text(pubDateText + ". ");
			}

			//The publisher (source member node)
			var publisherText = "";
			if (typeof datasource !== "undefined" && datasource) {
				var memberNode = MetacatUI.nodeModel.getMember(datasource);

				if(memberNode)
  					publisherText = memberNode.name + ". ";
  				else
  					publisherText = datasource + ". ";
			}
			else{
				var memberNode = MetacatUI.nodeModel.getMember(MetacatUI.nodeModel.get("currentMemberNode"));

				if(memberNode)
  					publisherText = memberNode.name + ". ";
			}

			var publisherEl = $(document.createElement("span")).addClass('publisher');

			// Only set text if we have a non-zero-length publisherText string
			if (publisherText) {
				publisherEl.text(publisherText);
			}

			if(this.model.type == "CitationModel") {
				var idEl = $(document.createElement("span")).addClass("id");
				idEl.append(sourceUrl, $(document.createElement("span")).text(". "));
			}
			else {
				//The ID
				var idEl = this.createIDElement();
			}
			var model = this.metadata || this.model,
				id = model.get("id"),
				seriesId = model.get("seriesId");

			if ((typeof title !== "undefined") && title){
				if(title.trim().charAt(title.length-1) != ".")
					title = title.trim() + ". ";
				else
					title = title.trim() + " ";

				if(this.model.type == "CitationModel") {
					var titleEl = $(document.createElement("span"))
												.addClass("title")
												.attr("data-id", sourceId)
												.text(title);
				}
				else {
					var titleEl = $(document.createElement("span"))
												.addClass("title")
												.attr("data-id", this.metadata.get("id"))
												.text(title);
				}

			}
			else
				var titleEl = document.createElement("span");

			//Create a link and put all the citation parts together
			if (this.createLink){
				if(this.model.type == "CitationModel") {

					// Creating a volume element to display in Citations Modal Window
					if(volume === "NULL") {
						var volumeText = "";
					}
					else {
						var volumeText = "Vol. " + volume + ". ";
					}
					var volumeEl = $(document.createElement("span")).addClass("publisher").text(volumeText);

					// Creating a 'pages' element to display in Citations Modal Window
					if(page === "NULL") {
						var pageText = "";
					}
					else {
						var pageText = "pp. " + page + ". ";
					}
					var pageEl = $(document.createElement("span")).addClass("publisher").text(pageText);

					var linkEl = $(document.createElement("a"))
									.addClass("metrics-route-to-metadata")
									.attr("data-id", id)
									.attr("href", sourceUrl)
									.attr("target", "_blank")
									.append(authorEl, pubDateEl, titleEl, publisherEl, volumeEl, pageEl, idEl);
				}
				else {
					var linkEl = $(document.createElement("a"))
									.addClass("route-to-metadata")
									.attr("data-id", id)
									.attr("href", MetacatUI.root + "/view/" + (seriesId || id))
									.append(authorEl, pubDateEl, titleEl, publisherEl, idEl);
				}

				this.$el.append(linkEl);
			}
			else if(this.createTitleLink){
				var linkEl = $(document.createElement("a"))
								.addClass("route-to-metadata")
								.attr("data-id", seriesId)
								.attr("href", MetacatUI.root + "/view/" + (seriesId || id))
								.append(titleEl);
				this.$el.append(authorEl, pubDateEl, linkEl, publisherEl, idEl);
			}
			else{
				this.$el.append(authorEl, pubDateEl, titleEl, publisherEl, idEl);
			}

			this.setUpListeners();

			return this;
		},

		createIDElement: function(){

			var model 		 = this.metadata || this.model,
				id 			 = model.get("id"),
				seriesId     = model.get("seriesId"),
				datasource   = model.get("datasource");

			var idEl = $(document.createElement("span")).addClass("id");
			if(seriesId){
				//Create a link for the identifier if it is a DOI
				if( model.isDOI(seriesId) && !this.createLink ){
					var doiURL  = this.createDoiUrl(seriesId),
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
			else if( model.isDOI(id) && !this.createLink ){
				var doiURL  = this.createDoiUrl(id),
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

		createDoiUrl: function(doi){

			if( doi.indexOf("http") == 0 ){
				return doi;
			}
			else if( doi.indexOf("doi:") == 0){
				return "https://doi.org/" + doi.substring(4);
			}
			else{
				return "https://doi.org/" + doi;
			}

		},

		setUpListeners: function(){
			if (!this.metadata) return;

			this.stopListening();

			//If anything in the model changes, rerender this citation
			this.listenTo(this.metadata, "change:origin change:creator change:pubDate change:dateUploaded change:title change:seriesId change:id change:datasource", this.render);

			//If this model is an EML211 model, then listen differently
			if(this.metadata.type == "EML"){
				var creators = this.metadata.get("creator");

				//Listen to the names
				for(var i=0; i<creators.length; i++){
					this.listenTo(creators[i], "change:individualName change:organizationName change:positionName", this.render);
				}

			}
		},

		routeToMetadata: function(e){
			var id = this.model.get("id");

			//If the user clicked on a download button or any element with the class 'stop-route', we don't want to navigate to the metadata
			if ($(e.target).hasClass('stop-route') || (typeof id === "undefined") || !id)
				return;

			MetacatUI.uiRouter.navigate('view/'+id, {trigger: true});
		}
	});

	return CitationView;
});
