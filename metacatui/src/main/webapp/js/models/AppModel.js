/*global define */
define(['jquery', 'underscore', 'backbone'], 				
	function($, _, Backbone) {
	'use strict';

	// Application Model
	// ------------------
	var AppModel = Backbone.Model.extend({
		// This model contains all of the attributes for the Application
		defaults: {
			headerType: 'default',
			pid: null,
			baseUrl: window.location.origin,
			serviceUrl: '/knb/d1/mn/v1',
			viewService: '/views/metacatui/',
			packageService: '/package/'
		}
		
	});
	return AppModel;		
});
