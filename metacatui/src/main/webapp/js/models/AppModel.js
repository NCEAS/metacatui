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
			title: window.themeTitle || "Metacat Data Catalog",
			searchMode: mapKey ? 'map' : 'list',
			searchHistory: [],
			sortOrder: 'dateUploaded+desc',
			previousPid: null,
			lastPid: null,
			anchorId: null,
			profileUsername: null,
			page: 0,
			profileQuery: null,
			baseUrl: window.location.origin,
			// the most likely item to change is the Metacat deployment context
			context: '/metacat',
			d1Service: '/d1/mn/v1',
			d1CNBaseUrl: "https://cn.dataone.org/",
			d1CNService: "cn/v1",
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
			bioportalServiceUrl: null,
			orcidServiceUrl: null,
			tokenUrl: null,
			annotatorUrl: null,
			accountsUrl: null,
			pendingMapsUrl: null,
			prov: false
		},
				
		defaultView: "data",
		
		initialize: function() {
			
			//For IE
			if (!window.location.origin) {
				var baseUrl = window.location.protocol + "//" + window.location.host;
				
				this.set('baseUrl', baseUrl);
			}
			
			// these are pretty standard, but can be customized if needed
			this.set('viewServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/views/metacatui/');
			this.set('packageServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/package/');
			this.set('publishServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/publish/');
			this.set('authServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/isAuthorized/');
			this.set('queryServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/query/solr/');
			this.set('metaServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/meta/');
			this.set('objectServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/object/');
			this.set('registryServiceUrl', this.get('baseUrl') + this.get('context') + '/cgi-bin/register-dataset.cgi');
			this.set('ldapwebServiceUrl', this.get('baseUrl') + this.get('context') + '/cgi-bin/ldapweb.cgi');
			this.set('metacatServiceUrl', this.get('baseUrl') + this.get('context') + '/metacat');
			this.set('nodeServiceUrl', this.get("d1CNBaseUrl") + this.get('d1CNService') + '/node');
			this.set("accountsUrl", this.get("d1CNBaseUrl") + this.get("d1CNService") + "/accounts/");
		
			//Settings for the DataONE API v2 only
			if(this.get("d1CNService").indexOf("v2") > -1){
				this.set("tokenUrl", this.get("d1CNBaseUrl") + "/portal/token");
				this.set('viewServiceUrl', this.get('d1CNBaseUrl') + this.get('d1CNService') + '/views/metacatui/');
				//this.set('packageServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/package/');
				this.set("prov", true);
				this.set('resolveServiceUrl', this.get('d1CNBaseUrl') + this.get('d1CNService') + '/resolve/');
				this.set("pendingMapsUrl", this.get("accountsUrl") + "pendingmap");
			}
			
			this.on("change:pid", this.changePid);
		},
		
		
		
		changePid: function(model, name){			
			this.set("previousPid", model.previous("pid"));
		}
	});
	return AppModel;		
});
