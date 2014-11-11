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
		        
		        // Set the title attribute as the "item.desc" value.
		        // This becomes the tooltip content.
		        _renderItem: function( ul, item ) {
		        	var element = this._super( ul, item )
	                .attr( "data-title", item.value )
	                .attr( "data-content", item.desc );
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
		
		bioportalSearch: function(request, response) {
			
			var query = appModel.get('bioportalServiceUrl') + request.term;
			var availableTags = [];
			$.get(query, function(data, textStatus, xhr) {
			
				_.each(data.collection, function(obj) {
					var choice = {};
					choice.label = obj['prefLabel'];
					choice.value = obj['@id'];
					choice.desc = obj['definition']
					availableTags.push(choice);
				});
				
				response(availableTags);
				
			});
		},
		
		orcidSearch: function(request, response, more) {
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
