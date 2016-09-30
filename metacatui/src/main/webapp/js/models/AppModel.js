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
			title: MetacatUI.themeTitle || "Metacat Data Catalog",
			
			emailContact: "knb-help@nceas.ucsb.edu",
			
			googleAnalyticsKey: null,
			
			nodeId: null,

			searchMode: MetacatUI.mapKey ? 'map' : 'list',
			searchHistory: [],
			sortOrder: 'dateUploaded+desc',
			page: 0,
			
			previousPid: null,
			lastPid: null,
			
			anchorId: null,
			
			userProfiles: true,
			profileUsername: null,
						
			maxDownloadSize: 3000000000,
			
			baseUrl: window.location.origin || (window.location.protocol + "//" + window.location.host),
			// the most likely item to change is the Metacat deployment context
			context: '/metacat',
			d1Service: '/d1/mn/v2',
			d1CNBaseUrl: "https://cn.dataone.org/",
			d1CNService: "cn/v2",
			d1LogServiceUrl: null,
			nodeServiceUrl: null,
			viewServiceUrl: null,
			packageServiceUrl: null,
			publishServiceUrl: null,
			authServiceUrl: null,
			queryServiceUrl: null,
			metaServiceUrl: null,
			metacatBaseUrl: null,
			metacatServiceUrl: null,
			objectServiceUrl: null,
			//grantsUrl: null,
			//bioportalSearchUrl: null,
			//orcidSearchUrl: null,
			//orcidBioUrl: null,
			//tokenUrl: null,
			//annotatorUrl: null,
			accountsUrl: null,
			//pendingMapsUrl: null,
			//accountsMapsUrl: null,
			groupsUrl: null
		},
				
		defaultView: "data",
		
		initialize: function() {
			
			//If no base URL is specified, then use the DataONE CN base URL
			if(!this.get("baseUrl")){
				this.set("baseUrl",   this.get("d1CNBaseUrl"));
				this.set("d1Service", this.get("d1CNService"));
			}
			
			// these are pretty standard, but can be customized if needed
			this.set('metacatBaseUrl', this.get('baseUrl') + this.get('context'));
			this.set('viewServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/views/metacatui/');
			this.set('publishServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/publish/');
			this.set('authServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/isAuthorized/');
			this.set('queryServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/query/solr/?');
			this.set('metaServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/meta/');
			this.set('objectServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/object/');
			this.set('metacatServiceUrl', this.get('baseUrl') + this.get('context') + '/metacat');
			
			if(typeof this.get("grantsUrl") !== "undefined")
				this.set("grantsUrl", this.get("baseUrl") + "/api.nsf.gov/services/v1/awards.json");
			
			//DataONE CN API 
			if(this.get("d1CNBaseUrl")){
				
				//Account services 
				if(typeof this.get("accountsUrl") != "undefined"){
					this.set("accountsUrl", this.get("d1CNBaseUrl") + this.get("d1CNService") + "/accounts/");
					
					if(typeof this.get("pendingMapsUrl") != "undefined")
						this.set("pendingMapsUrl", this.get("accountsUrl") + "pendingmap/");
					
					if(typeof this.get("accountsMapsUrl") != "undefined")
						this.set("accountsMapsUrl", this.get("accountsUrl") + "map/");

					if(typeof this.get("groupsUrl") != "undefined")
						this.set("groupsUrl", this.get("d1CNBaseUrl") + this.get("d1CNService") + "/groups/");
				}
				
				if(typeof this.get("d1LogServiceUrl") != "undefined")
					this.set('d1LogServiceUrl', this.get('d1CNBaseUrl') + this.get('d1CNService') + '/query/logsolr/');
				
				this.set("nodeServiceUrl", this.get("d1CNBaseUrl") + this.get("d1CNService") + "/node/");
				this.set('resolveServiceUrl', this.get('d1CNBaseUrl') + this.get('d1CNService') + '/resolve/');
		
				//Settings for the DataONE API v2 only
				if(this.get("d1CNService").indexOf("v2") > -1){
					
					//Token URLs
					if(typeof this.get("tokenUrl") != "undefined"){
						this.set("tokenUrl", this.get("d1CNBaseUrl") + "/portal/token");
					}
					
					//ORCID search
					if(typeof this.get("orcidBaseUrl") != "undefined")
						this.set('orcidSearchUrl', this.get('orcidBaseUrl') + '/search/orcid-bio?q=');
				}
			}
	
			this.on("change:pid", this.changePid);
		},

		changePid: function(model, name){			
			this.set("previousPid", model.previous("pid"));
		}
	});
	return AppModel;		
});
