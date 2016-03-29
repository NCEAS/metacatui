/*global define */
define(['jquery', 'underscore', 'backbone'], 				
	function($, _, Backbone) {
	'use strict';

	// Lookup Model
	// ------------------
	var LookupModel = Backbone.Model.extend({
		// This model contains functions for looking up values from services
		defaults: {
			concepts: {}
		},
		
		initialize: function() {
			
		    // Autocomplete widget extension to provide description tooltips.
		    $.widget( "app.hoverAutocomplete", $.ui.autocomplete, {
		        
		        // Set the content attribute as the "item.desc" value.
		        // This becomes the tooltip content.
		        _renderItem: function( ul, item ) {
		        	// if we have a label, use it for the title
		        	var title = item.value;
		        	if (item.label) {
		        		title = item.label;
		        	}
		        	// if we have a description, use it for the content
		        	var content = item.value;
		        	if (item.desc) {
		        		content = item.desc;
		        		if (item.desc != item.value) {
			        		content += " (" + item.value + ")";
		        		}
		        	}
		        	var element = this._super( ul, item )
	                .attr( "data-title", title )
	                .attr( "data-content", content );
		        	element.popover(
		        			{
		        				placement: "right",
		        				trigger: "hover",
		        				container: 'body'
		        				
		        			});
		            return element;
		        }
		    });
			
		},
		
		bioportalSearch: function(request, response, localValues, allValues) {
			
			// make sure we have something to lookup
			if (!appModel.get('bioportalSearchUrl')) {
				response(localValues);
				return;
			}
			
			var query = appModel.get('bioportalSearchUrl') + request.term;
			var availableTags = [];
			$.get(query, function(data, textStatus, xhr) {
			
				_.each(data.collection, function(obj) {
					var choice = {};
					choice.label = obj['prefLabel'];
					choice.filterLabel = obj['prefLabel'];
					choice.value = obj['@id'];
					if (obj['definition']) {
						choice.desc = obj['definition'][0];
					}
					
					// mark items that we know we have matches for
					if (allValues) {
						var matchingChoice = _.findWhere(allValues, {value: choice.value});
						if (matchingChoice) {
							choice.label = "*" + choice.label;
							
							// remove it from the local value - why have two?
							if (localValues) {
								localValues = _.reject(localValues, function(obj) {
									return obj.value == matchingChoice.value;
								});
							}
						}
					}
					
					availableTags.push(choice);

				});
				
				// combine the lists if called that way
				if (localValues) {
					availableTags = localValues.concat(availableTags);
				}
				
				response(availableTags);
				
			});
		},
		
		bioportalGetConcepts: function(uri, callback) {
			
			var concepts = this.get('concepts')[uri];
			
			if (concepts) {
				callback(concepts);
				return;
			} else {
				concepts = [];
			}

			// make sure we have something to lookup
			if (!appModel.get('bioportalSearchUrl')) {
				return;
			}
			
			var query = appModel.get('bioportalSearchUrl') + encodeURIComponent(uri);
			var availableTags = [];
			var model = this;
			$.get(query, function(data, textStatus, xhr) {
			
				_.each(data.collection, function(obj) {
					var concept = {};
					concept.label = obj['prefLabel'];
					concept.value = obj['@id'];
					if (obj['definition']) {
						concept.desc = obj['definition'][0];
					}
					
					concepts.push(concept);

				});
				model.get('concepts')[uri] = concepts;

				callback(concepts);
			});
		},
		
		orcidGetConcepts: function(uri, callback) {
			
			var people = this.get('concepts')[uri];
			
			if (people) {
				callback(people);
				return;
			} else {
				people = [];
			}
			
			// make sure we have something to lookup
			if (!appModel.get('bioportalSearchUrl')) {
				return;
			}
			
			var query = appModel.get('orcidBaseUrl')  + uri.substring(uri.lastIndexOf("/"));
			var model = this;
			$.get(query, function(data, status, xhr) {
				// get the orcid info
				var profile = $(data).find("orcid-profile");

				_.each(profile, function(obj) {
					var choice = {};
					choice.label = $(obj).find("orcid-bio > personal-details > given-names").text() + " " + $(obj).find("orcid-bio > personal-details > family-name").text();
					choice.value = $(obj).find("orcid-identifier > uri").text();
					choice.desc = $(obj).find("orcid-bio > personal-details").text();
					people.push(choice);
				});
				
				model.get('concepts')[uri] = people;
				
				// callback with answers
				callback(people);
			})
		},
		
		/*
		 * Supplies search results for ORCiDs to autocomplete UI elements
		 */
		orcidSearch: function(request, response, more, ignore) {
			
			// make sure we have something to lookup
			if (!appModel.get('bioportalSearchUrl')) {
				response(more);
				return;
			}
			
			var people = [];
			
			if(!ignore) var ignore = [];
			
			var query = appModel.get('orcidSearchUrl') + request.term;
			$.get(query, function(data, status, xhr) {
				// get the orcid info
				var profile = $(data).find("orcid-profile");

				_.each(profile, function(obj) {
					var choice = {};
					choice.value = $(obj).find("orcid-identifier > uri").text();

					if(_.contains(ignore, choice.value.toLowerCase())) return;
					
					choice.label = $(obj).find("orcid-bio > personal-details > given-names").text() + " " + $(obj).find("orcid-bio > personal-details > family-name").text();
					choice.desc = $(obj).find("orcid-bio > personal-details").text();
					people.push(choice);
				});
				
				// add more if called that way
				if (more) {
					people = more.concat(people);
				}
				
				// callback with answers
				response(people);
			});
		},
		
		/*
		 * Gets the bio of a person given an ORCID
		 * Updates the given user model with the bio info from ORCID
		 */
		orcidGetBio: function(options){
			if(!options || !options.userModel) return;
			
			var orcid     = options.userModel.get("username"),
				onSuccess = options.success || function(){},
				onError   = options.error   || function(){};
			
			$.ajax({
				url: appModel.get("orcidSearchUrl") + orcid,
				type: "GET",
				//accepts: "application/orcid+json",
				success: function(data, textStatus, xhr){					
					// get the orcid info
					var orcidNode = $(data).find("path:contains(" + orcid + ")"),
						profile = orcidNode.length? $(orcidNode).parents("orcid-profile") : [];
						
					if(!profile.length) return;

					var fullName = $(profile).find("orcid-bio > personal-details > given-names").text() + " " + $(profile).find("orcid-bio > personal-details > family-name").text();
					options.userModel.set("fullName", fullName);
					
					onSuccess(data, textStatus, xhr);
				},
				error: function(xhr, textStatus, error){
					onError(xhr, textStatus, error);
				}
			});
		}
	
		
	});
	return LookupModel;		
});
