/*global define */
define(['jquery', 'underscore', 'backbone'], 				
	function($, _, Backbone) {
	'use strict';
	
	// Access Rule Model 
	// ------------------
	var AccessRule = Backbone.Model.extend({
		
		defaults: {
			subject: null,
			read: null,
			write: null,
			changePermission: null
		},
		
		initialize: function(){
			
		},
		
		parse: function(){
			
		},
		
		serialize: function(){
			
		}
		
	});
	
	return AccessRule;
	
});