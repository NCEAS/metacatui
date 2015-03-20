/*global define */
define(['jquery',
		'underscore', 
		'backbone',
		'gmaps',
		'models/SolrResult',
		'text!templates/loading.html',
		'text!templates/alert.html',
		'text!templates/attribute.html',
		'text!templates/downloadButton.html',
		'text!templates/metadataIndex.html'
	 ], 				
	function($, _, Backbone, gmaps, SolrResult, LoadingTemplate, alertTemplate, AttributeTemplate, DownloadButtonTemplate, MetadataIndexTemplate) {
	'use strict';
		
	var MetadataIndexView = Backbone.View.extend({
		
		id: 'Metadata',
		
		className: "metadata-index container", 
		
		tagName: 'article',
		
		template: null,
				
		loadingTemplate: _.template(LoadingTemplate),
		
		attributeTemplate: _.template(AttributeTemplate),
		
		downloadButtonTemplate: _.template(DownloadButtonTemplate),
		
		alertTemplate: _.template(alertTemplate),
		
		metadataIndexTemplate: _.template(MetadataIndexTemplate),
		
		semanticFields: null,
										
		events: {
		},
		
		initialize: function (options) {
			this.pid = options.pid || null;
			//this.el.id = this.id + "-" + this.pid; //Give this element a specific ID in case multiple MetadataIndex views are on one page
			this.parentView = options.parentView || null;	
			
			// use these to tailor the annotation ui widget
			this.semanticFields = {
					attribute: "sem_annotation",
					attributeName: "sem_annotation",
					attributeLabel: "sem_annotation",
					attributeDescription: "sem_annotation",
					attributeUnit: "sem_annotation",
					origin: "orcid_sm",
					investigator: "orcid_sm"
			}
		},
				
		render: function(){
			if(!this.pid) return false;
			
			var view = this;
			
			this.$el.html(this.loadingTemplate());
			
			//Get all the fields from the Solr index
			var query = 'q=id:"' + encodeURIComponent(this.pid) + '"&wt=json&rows=1&start=0&fl=*';
			$.get(appModel.get('queryServiceUrl') + query, function(data, textStatus, xhr){ 

				if(data.response.numFound == 0){
					var msg = "<h4>Nothing was found for one of the following reasons:</h4>" +
							  "<ul class='indent'>" +
								  "<li>The content was removed because it was invalid or inappropriate.</li>" +
								  "<li>You do not have permission to view this content.</li>" +
								  "<li>The ID '" + view.pid  + "' does not exist.</li>" +
							  "</ul>";
					view.$el.html(view.alertTemplate({msg: msg, classes: "alert-danger"}));
				}
				else{
					view.docs = data.response.docs;
					
					_.each(data.response.docs, function(doc, i, list){
						
						var metadataEl = $(document.createElement("section")).attr("id", "metadata-index-details"),
							id = doc.id,
							creator = doc.origin,
							title = doc.title,
							pubDate = doc.pubDate,
							dateUploaded = doc.dateUploaded,
							keys = Object.keys(doc),
							docModel = new SolrResult(doc);
							
						//Extract General Info details that we want to list first
						var generalInfoKeys = ["title", "id", "abstract", "pubDate", "keywords"];
						keys = _.difference(keys, generalInfoKeys);
						$(metadataEl).append(view.formatAttributeSection(docModel, generalInfoKeys, "General"));

						//Extract Spatial details
						var spatialKeys = ["site", "southBoundCoord", "northBoundCoord", "westBoundCoord", "eastBoundCoord"];
						keys = _.difference(keys, spatialKeys);
						$(metadataEl).append(view.formatAttributeSection(docModel, spatialKeys, "Geographic Region"));
						
						//Extract Temporal Coverage details
						var temporalKeys = ["beginDate", "endDate"];
						keys = _.difference(keys, temporalKeys);
						$(metadataEl).append(view.formatAttributeSection(docModel, temporalKeys, "Temporal Coverage"));
						
						//Extract Taxonomic Coverage details
						var taxonKeys = ["order", "phylum", "family", "genus", "species", "scientificName"];
						keys = _.difference(keys, taxonKeys);
						$(metadataEl).append(view.formatAttributeSection(docModel, taxonKeys, "Taxonomic Coverage"));
						
						//Extract People details
						var peopleKeys = ["origin", "investigator", "contactOrganization", "project"];
						keys = _.difference(keys, peopleKeys);
						$(metadataEl).append(view.formatAttributeSection(docModel, peopleKeys, "People and Associated Parties"));
						
						//Extract Access Control details
						var accessKeys = ["isPublic", "submitter", "rightsHolder", "writePermission", "readPermission", "changePermission", "authoritativeMN"];
						keys = _.difference(keys, accessKeys);
						$(metadataEl).append(view.formatAttributeSection(docModel, accessKeys, "Access Control"));
						
						//Add the rest of the metadata
						$(metadataEl).append(view.formatAttributeSection(docModel, keys, "Other"));
						
						view.$el.html(view.metadataIndexTemplate({ 
							creator: creator,
							id: id,
							pubDate: pubDate,
							dateUploaded: dateUploaded,
							title: title
						}));
						
						view.$("#downloadContents").after(metadataEl);
					});
										
				}
				
				view.flagComplete();

			}, "json")
			.error(function(){
				var msg = "<h4>Sorry, no dataset was found.</h4>";
				view.$el.html(view.alertTemplate({msg: msg, classes: "alert-danger"}));
			});
						
			return this;
		},
		
		formatAttributeSection: function(doc, keys, title, className){
			if(keys.length == 0) return "";
			
			if(typeof title === "string") {
				var titleHTML = $(document.createElement("h4")).text(title);
				var titleText = title;
			}
			else if(typeof title === "undefined"){
				var titleHTML =  $(document.createElement("h4"));
				var titleText = "";
			}
			else{
				var titleHTML = title;
				var titleText = titleHTML.text();
			}
				
			var html = "",
				sectionClass = (typeof className === "undefined") ? titleText.replace(/ /g, "") : className,
				view = this,
				populated = false;
			
			_.each(keys, function(key, keyNum, list){
				if(doc.get(key)){
					html += view.formatAttribute(key, doc.get(key));
					populated = true;
				}
			});
			
			if(populated){
				var section = $(document.createElement("section"))
								  .addClass(sectionClass)
								  .append(titleHTML)
								  .append(html);
				
				return section;
			}
			else return null;
		},
		
		formatAttribute: function(attribute, value){
			var html = "",
				view = this,
				embeddedAttributes = "",
				type = "sem_annotation";
			
			// see if there is special handling for this field
			if (this.semanticFields[attribute]) {
				type = this.semanticFields[attribute];
			}
			
			//If this is a multi-valued field from Solr, the attribute value is actually multiple embedded attribute templates
			var numAttributes = (Array.isArray(value) && (value.length > 1)) ? value.length : 0;
			for(var i=0; i<numAttributes; i++){				
				embeddedAttributes += view.attributeTemplate({
					attribute: "",
					formattedAttribute: view.transformCamelCase(attribute),
					value: value[i],
					id: attribute + "_" + (i+1),
					type: type,
					resource: "#xpointer(//" + attribute + "[" + (i+1) + "])"
				});
			}
			
			html += view.attributeTemplate({
				attribute: attribute,
				formattedAttribute: view.transformCamelCase(attribute),
				value: embeddedAttributes || value,
				id: attribute,
				type: type,
				resource: "#xpointer(//" + attribute + ")"
			});
			
			return html;
		},
		
		transformCamelCase: function(string){
			var result = string.replace(/([A-Z]+)/g, " $1").replace(/([A-Z][a-z])/g, " $1");
			var finalResult = result.charAt(0).toUpperCase() + result.slice(1);
			
			return finalResult;
		},
		
		insertDataDetails: function(){
			var view = this;
			
			//Get the Package Model - it is attached with the parent Metadata View
			var pkg = this.parentView.packageModel;
			
			if(pkg.get("members").length <= 1) return;
			
			//Start some html
			var html = $(document.createElement("section"));
			
			_.each(pkg.get("members"), function(solrResult, i){
				if(solrResult.get("formatType") != "DATA") return;
				
				//Add a section for the data details, just like the other attribute sections
				var keys  = ["id", "size", "views", "pubDate", "memberNode", "formatId"];
				
				//Create a header for this data object
				
				//Determine the icon type based on format id
				var type = solrResult.getType(),
					icon = "";
				if(type == "program")
					icon = "icon-code";
				else if(type == "metadata")
					icon = "icon-file-text";
				else if (type == "image")
					icon = "icon-picture";
				else if (type == "pdf")
					icon = "icon-file pdf";
				else 
					icon = "icon-table";
				
				var icon   = $(document.createElement("i")).addClass(icon),
					title  = $(document.createElement("span")).text(solrResult.get("id")).addClass("title"),
					downloadBtn = view.downloadButtonTemplate({ href: appModel.get("objectServiceUrl") + encodeURIComponent(solrResult.get("id")), className: "btn btn-primary" }),
					anchor = $(document.createElement("a")).attr("name", encodeURIComponent(solrResult.get("id"))),
					header = $(document.createElement("h4")).append(anchor).append(icon).append(title).append(downloadBtn);
				
				//Create the section
				$(html).append(view.formatAttributeSection(solrResult, keys, header, "entityDetails").attr("data-id", solrResult.get("id")));	
			});
			
			//Glue together the header and attribute info section
			var header = $(document.createElement("h4")).text("Data Table, Image, and Other Data Details");						
			var section = $(html).prepend(header);
			
			//Insert into the DOM right after the "general" information
			this.$(".General").after(section);
		},
		
		flagComplete: function(){
			this.complete = true;
			this.trigger("complete");
		},
		
		onClose: function(){
			this.$el.html("");
		}
	});
	return MetadataIndexView;		
});
