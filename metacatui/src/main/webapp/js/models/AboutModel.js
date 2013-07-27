/*global define */
define(['jquery', 'underscore', 'backbone'], 				
	function($, _, Backbone) {
	'use strict';

	// Application Model
	// ------------------
	var AboutModel = Backbone.Model.extend({
		// This model contains all of the attributes for the Application
		
		initialize: function() {
		}
		
	});
	return AboutModel;		
});
