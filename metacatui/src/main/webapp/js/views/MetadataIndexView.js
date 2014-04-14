/*global define */
define(['jquery',
		'underscore', 
		'backbone',
		'gmaps',
		'text!templates/loading.html',
		'text!templates/alert.html',
		'text!templates/attribute.html',
		'text!templates/metadataIndex.html'
	 ], 				
	function($, _, Backbone, gmaps, LoadingTemplate, alertTemplate, AttributeTemplate, MetadataIndexTemplate) {
	'use strict';
		
	var MetadataIndexView = Backbone.View.extend({
		
		id: 'MetadataIndex',
		
		className: "metadata-index", 
		
		tagName: 'article',
		
		template: null,
				
		loadingTemplate: _.template(LoadingTemplate),
		
		attributeTemplate: _.template(AttributeTemplate),
		
		alertTemplate: _.template(alertTemplate),
		
		metadataIndexTemplate: _.template(MetadataIndexTemplate),
										
		events: {
		},
		
		initialize: function (options) {
			this.pid = options.pid || null;
			this.el.id = this.id + "-" + this.pid; //Give this element a specific ID in case multiple MetadataIndex views are on one page
			this.parentView = options.parentView || null;
		},
				
		render: function(){
			if(!this.pid) return false;
			
			var view = this;
			
			this.$el.html(this.loadingTemplate());
			
			//Get all the fields from the Solr index
			var query = 'q=id:"' + this.pid + '"&wt=json&rows=1&start=0&fl=*';
			$.get(appModel.get('queryServiceUrl') + query, function(data, textStatus, xhr){ 

				if(data.response.numFound == 0){
					var msg = "<h4>That ID does not exist.</h4>";
					view.$el.html(view.alertTemplate({msg: msg, classes: "alert-danger"}));
				}
				else{
					view.docs = data.response.docs;
					
					_.each(data.response.docs, function(doc, i, list){
												
						var metadataHTML = "",
							id = doc.id,
							creator = doc.origin,
							title = doc.title,
							pubDate = doc.pubDate,
							dateUploaded = doc.dateUploaded,
							keys = Object.keys(doc);
							
						//Extract General Info details that we want to list first
						var generalInfoKeys = ["title", "id", "abstract", "pubDate", "keywords"];
						keys = _.difference(keys, generalInfoKeys);
						metadataHTML += view.formatAttributeSection(doc, generalInfoKeys, "General");
						
						//Extract Spatial details
						var spatialKeys = ["site", "southBoundCoord", "northBoundCoord", "westBoundCoord", "eastBoundCoord"];
						keys = _.difference(keys, spatialKeys);
						metadataHTML += view.formatAttributeSection(doc, spatialKeys, "Geographic Region");
						
						//Extract Temporal Coverage details
						var temporalKeys = ["beginDate", "endDate"];
						keys = _.difference(keys, temporalKeys);
						metadataHTML += view.formatAttributeSection(doc, temporalKeys, "Temporal Coverage");
						
						//Extract Taxonomic Coverage details
						var taxonKeys = ["order", "phylum", "family", "genus", "species", "scientificName"];
						keys = _.difference(keys, taxonKeys);
						metadataHTML += view.formatAttributeSection(doc, taxonKeys, "Taxonomic Coverage");
						
						//Extract People details
						var peopleKeys = ["origin", "investigator", "contactOrganization", "project"];
						keys = _.difference(keys, peopleKeys);
						metadataHTML += view.formatAttributeSection(doc, peopleKeys, "People and Associated Parties");
						
						//Extract Access Control details
						var accessKeys = ["isPublic", "submitter", "rightsHolder", "writePermission", "readPermission", "changePermission", "authoritativeMN"];
						keys = _.difference(keys, accessKeys);
						metadataHTML += view.formatAttributeSection(doc, accessKeys, "Access Control");
						
						//Add the rest of the metadata
						metadataHTML += view.formatAttributeSection(doc, keys, "Other");
						
						view.$el.html(view.metadataIndexTemplate({ 
							metadata: metadataHTML,
							creator: creator,
							id: id,
							pubDate: pubDate,
							dateUploaded: dateUploaded,
							title: title
						}));

						if(view.parentView){
							view.parentView.insertResourceMapContents(view.pid);
							if(gmaps && doc.northBoundCoord) view.parentView.insertSpatialCoverageMap([doc.northBoundCoord, doc.southBoundCoord, doc.eastBoundCoord, doc.westBoundCoord]);	
						}
						
					});
										
				}

			}, "json")
			.error(function(){
				var msg = "<h4>Sorry, no dataset was found.</h4>";
				view.$el.html(view.alertTemplate({msg: msg, classes: "alert-danger"}));
			});
						
			return this;
		},
		
		formatAttributeSection: function(doc, keys, title){
			if(keys.length == 0) return "";
			
			var html = "",
				titleHTML = (title === undefined) ? "" : "<h4>" + title + "</h4>",
				view = this,
				populated = false;
			
			_.each(keys, function(key, keyNum, list){
				if(doc[key]){
					html += view.formatAttribute(key, doc[key]);
					populated = true;
				}
			});
			
			if(populated) html = "<section>" + titleHTML + html + "</section>";
						
			return html;
		},
		
		formatAttribute: function(attribute, value){
			var html = "",
				view = this,
				embeddedAttributes = "";
			
			//If this is a multi-valued field from Solr, so the attribute value is actually multiple embedded attribute templates
			var numAttributes = (Array.isArray(value) && (value.length > 1)) ? value.length : 0;
			for(var i=0; i<numAttributes; i++){
				embeddedAttributes += view.attributeTemplate({
					attribute: "",
					value: value[i]
				});
			}
			
			html += view.attributeTemplate({
				attribute: attribute,
				value: embeddedAttributes || value
			});

			
			return html;
		},
		
		onClose: function(){
			this.$el.html("");
		}
	});
	return MetadataIndexView;		
});
