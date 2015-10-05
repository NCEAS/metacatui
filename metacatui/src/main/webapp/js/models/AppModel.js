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
			metcatVersion: "2.5.0", 
			baseUrl: window.location.origin,
			// the most likely item to change is the Metacat deployment context
			context: '/metacat',
			d1Service: '/d1/mn/v2',
			d1CNBaseUrl: "https://cn.dataone.org/",
			d1CNService: "cn/v1",
			nodeServiceUrl: null,
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
			bioportalSearchUrl: null,
			orcidSearchUrl: null,
			orcidBioUrl: null,
			tokenUrl: null,
			annotatorUrl: null,
			accountsUrl: null,
			groupsUrl: null,
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
			this.set('queryServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/query/solr/?');
			this.set('metaServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/meta/');
			this.set('objectServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/object/');
			this.set('registryServiceUrl', this.get('baseUrl') + this.get('context') + '/cgi-bin/register-dataset.cgi');
			this.set('ldapwebServiceUrl', this.get('baseUrl') + this.get('context') + '/cgi-bin/ldapweb.cgi');
			this.set('metacatServiceUrl', this.get('baseUrl') + this.get('context') + '/metacat');
			
			if(this.get("d1Service").indexOf("v2") > -1){
				this.set('packageServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/packages/application%2Fbagit-097/');
			}
			
			if(this.get("d1CNBaseUrl")){
				this.set("nodeServiceUrl", this.get("d1CNBaseUrl") + this.get("d1CNService") + "/node/");
				this.set("accountsUrl", this.get("d1CNBaseUrl") + this.get("d1CNService") + "/accounts/");
				this.set("pendingMapsUrl", this.get("accountsUrl") + "pendingmap/");
				this.set("groupsUrl", this.get("d1CNBaseUrl") + this.get("d1CNService") + "/groups/");
				this.set('resolveServiceUrl', this.get('d1CNBaseUrl') + this.get('d1CNService') + '/resolve/');
		
				//Settings for the DataONE API v2 only
				if(this.get("d1CNService").indexOf("v2") > -1){
					this.set("tokenUrl", this.get("d1CNBaseUrl") + "/portal/token");
					this.set('orcidSearchUrl', this.get('orcidBaseUrl') + '/search/orcid-bio?q=');
					this.set("prov", true);
				}
			}
			
			//Settings for older versions of metacat
			if((this.get("metcatVersion") < "2.5.0") && (this.get("d1Service").indexOf("mn/") > -1)){
				var queryServiceUrl = this.get("queryServiceUrl");
				if(queryServiceUrl.substring(queryServiceUrl.length-1) == "?")
					queryServiceUrl = queryServiceUrl.substring(0, queryServiceUrl.length-1);
				
				this.set("queryServiceUrl", queryServiceUrl);
			}
			
			this.on("change:pid", this.changePid);
		},

		changePid: function(model, name){			
			this.set("previousPid", model.previous("pid"));
		}
	});
	return AppModel;		
});
