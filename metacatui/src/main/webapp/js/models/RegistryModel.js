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
					"keyword" : "Default"
				},
			// TODO: include in all queries for the given theme	
			searchFields: 
				{
					"keyword" : "*",
					"originator" : "*"
				}
			formOptions:
				{
					"wg" : 
						[
						"SNAP: Coastal Defenses",
						"SNAP: Western Amazonia"
						]
				},
			// TODO: potential for driving optional filters for specific WGs	
			searchOptions:
				{
					"origin" : "SNAP: Coastal Defenses",
					"origin" : "SNAP: Western Amazonia"
				}
			
		}
		
	});
	return RegistryModel;
});
