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
			searchMode: 'map',
			username: null,
			fullName: null,
			sortOrder: 'dateUploaded+desc',
			pid: null,
			anchorId: null,
			page: null,
			baseUrl: window.location.origin,
			// the most likely item to change is the Metacat deployment context
			context: '',
			d1Service: 'cn/v1',
			viewServiceUrl: null,
			packageServiceUrl: null,
			publishServiceUrl: null,
			authServiceUrl: null,
			queryServiceUrl: null,
			metaServiceUrl: null,
			registryServiceUrl: null,
			ldapwebServiceUrl: null,
			metacatServiceUrl: null,
			objectServiceUrl: null,
			d1LogServiceUrl: null
		},
		
		initialize: function() {
			
			//For IE
			if (!window.location.origin) {
				var baseUrl = window.location.protocol + "//" + window.location.host;
				
				this.set('baseUrl', baseUrl);
			}
			
			this.set('baseUrl', 'https://cn-stage.test.dataone.org');
			
			// these are pretty standard, but can be customized if needed
			//this.set('viewServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/views/metacatui/');
			//this.set('packageServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/package/');
			//this.set('publishServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/publish/');
			this.set('authServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/isAuthorized/');
			this.set('queryServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/query/solr/?');
			this.set('metaServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/meta/');
			this.set('objectServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/object/');
			//this.set('registryServiceUrl', this.get('baseUrl') + this.get('context') + '/cgi-bin/register-dataset.cgi');
			//this.set('ldapwebServiceUrl', this.get('baseUrl') + this.get('context') + '/cgi-bin/ldapweb.cgi');
			//this.set('metacatServiceUrl', this.get('baseUrl') + this.get('context') + '/metacat');
			
			//this.set('d1LogServiceUrl', this.get('baseUrl') + this.get('d1Service') + 'logsolr');
			this.set('d1LogServiceUrl', 'https://cn.dataone.org/solr/d1-cn-log/select/?');
			
		}
	
		
	});
	return AppModel;		
});
