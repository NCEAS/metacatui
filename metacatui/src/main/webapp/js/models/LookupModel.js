/*global define */
define(['jquery', 'underscore', 'backbone'], 				
	function($, _, Backbone) {
	'use strict';

	// Lookup Model
	// ------------------
	var LookupModel = Backbone.Model.extend({
		// This model contains functions for looking up values from services
		defaults: {

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
			if (!appModel.get('bioportalServiceUrl')) {
				response(localValues);
				return;
			}
			
			var query = appModel.get('bioportalServiceUrl') + request.term;
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
			
			var concepts = [];

			// make sure we have something to lookup
			if (!appModel.get('bioportalServiceUrl')) {
				return;
			}
			
			var query = appModel.get('bioportalServiceUrl') + encodeURIComponent(uri);
			var availableTags = [];
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
				
				callback(concepts);
			});
		},
		
		orcidSearch: function(request, response, more) {
			
				// make sure we have something to lookup
				if (!appModel.get('orcidServiceUrl')) {
					response(more);
					return;
				}
				
				var people = [];
				var query = appModel.get('orcidServiceUrl') + request.term;
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
					
					// add more if called that way
					if (more) {
						people = more.concat(people);
					}
					
					// callback with answers
					response(people);
				})
			}
	
		
	});
	return LookupModel;		
});
