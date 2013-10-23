/*global define */
define(['jquery', 'underscore', 'backbone'], 				
	function($, _, Backbone) {
	'use strict';

	// Registry Model 
	// ------------------
	var RegistryModel = Backbone.Model.extend({
		// This model contains additional fields needed for the Registry
		defaults: {
			formFields: 
				{
					"keyword" : "SNAP"
				},
			// TODO: include in all queries for the given theme	
			searchFields: 
				{
					"keywords" : "SNAP",
					"origin" : "*"
				},
			formOptions:
				{
					"wg" : 
						[
						"Coastal Defenses",
						"Western Amazonia"
						]
				},
			// TODO: potential for driving optional filters for specific WGs
			// searchLabel: solr criteria	
			searchOptions:
				{
					"Coastal Defenses" : '+origin:Coastal%20Defenses',
					"Western Amazonia" : '+origin:Western%20Amazonia'

				}
			
		}
		
	});
	return RegistryModel;
});
