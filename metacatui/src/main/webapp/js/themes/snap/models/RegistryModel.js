/*global define */
define(['jquery', 'underscore', 'backbone'], 				
	function($, _, Backbone) {
	'use strict';

	// Registry Model 
	// ------------------
	var RegistryModel = Backbone.Model.extend({
		// This model contains additional fields needed for the Registry
		defaults: {
			// include by default in the Registry form for this theme
			formFields: 
				{
					"keyword" : "Science for Nature and People (SNAP)"
				},
			// include in ALL queries for this theme, the key is not used, but must be unique
			searchFields: 
				{
					"SNAP" : "+keywords:%22Science for Nature and People (SNAP)%22"
				},
			// keyword options inserted into the Registry form for user to select from 	
			formOptions:
				{
					"workingGroup" : 
						[
						"Coastal Defenses",
						"Western Amazonia"
						]
				},
			// optional filters for specific WGs, keyword categories, etc (side bar use)
			searchOptions:
				{
					"Coastal Defenses" : 'keywords:%22Coastal%20Defenses%22',
					"Western Amazonia" : 'keywords:%22Western%20Amazonia%22'
				}
			
		}
		
	});
	return RegistryModel;
});
