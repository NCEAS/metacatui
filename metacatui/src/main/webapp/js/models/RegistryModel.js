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
			formOptions:
				{
					"wg" : 
						[
						"SNAP: Coastal Defenses",
						"SNAP: Western Amazonia"
						]
				},
			searchFields: 
				{
					"keyword" : "Default",
					"originator" : "*"
				}
		}
		
	});
	return RegistryModel;
});
