/*global define */
define(['jquery', 'underscore', 'backbone'], 				
	function($, _, Backbone) {
	'use strict';

	// Annotation Model
	// ------------------
	var Annotation = Backbone.Model.extend({
		defaults: {
			
		},
		
		initialize: function(options){
			
		},
		
		bioportalGetConcepts: function(uri) {
			var model = this;
			appLookupModel.bioportalGetConcepts(uri, function(concepts){
				model.set("concept", concepts[0]);
			});						
		},
		
		orcidGetConcepts: function(uri) {
			var model = this;
			appLookupModel.orcidGetConcepts(uri, function(concepts){
				model.set("concept", concepts[0]);
			});
		}
	
	
	});
	
	return Annotation;
});