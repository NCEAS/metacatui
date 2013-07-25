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
			username: null,
			fullName: null,
			searchTerm: '',
			pid: null,
			baseUrl: window.location.origin,
			// the most likely item to change is the Metacat deployment context
			context: '/knb',
			d1Service: '/d1/mn/v1',
			viewServiceUrl: null,
			packageServiceUrl: null,
			queryServiceUrl: null,
			registryServiceUrl: null,
			metacatServiceUrl: null


		},
		
		initialize: function() {
			// these are pretty standard, but can be customized if needed
			this.set('viewServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/views/metacatui/');
			this.set('packageServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/package/');
			this.set('queryServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/query/solr/');
			this.set('registryServiceUrl', this.get('baseUrl') + this.get('context') + '/cgi-bin/register-dataset.cgi');
			this.set('metacatServiceUrl', this.get('baseUrl') + this.get('context') + '/metacat');
		}
	
		
	});
	return AppModel;		
});
