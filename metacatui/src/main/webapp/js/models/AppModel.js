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
			// the most likely item to change is the Metacat deployment context
			context: '/knb',
			d1Service: '/d1/mn/v1',
			viewServiceUrl: null,
			packageServiceUrl: null,
			registryServiceUrl: null

		},
		
		initialize: function() {
			// these are pretty standard, but can be customized
			this.set('viewServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/views/metacatui/');
			this.set('.packageServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/package/');
			this.set('.registryServiceUrl', this.get('baseUrl') + this.get('context') + '/cgi-bin/register-dataset.cgi');
		}
	
		
	});
	return AppModel;		
});
