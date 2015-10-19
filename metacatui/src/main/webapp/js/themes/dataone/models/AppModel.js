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
			pid: null,
			previousPid: null,
			anchorId: null,
			profileUsername: null,
			page: 0,
			metcatVersion: "2.5.0", 
			baseUrl: "https://cn-sandbox-2.test.dataone.org",
			// the most likely item to change is the Metacat deployment context
			context: '',
			d1Service: "/cn/v2",
			d1CNBaseUrl:  "https://cn-sandbox-2.test.dataone.org",
			d1CNService: "/cn/v2",
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
			resolveServiceUrl: null,			
			d1LogServiceUrl: null,
			nodeServiceUrl: null,
			// NOTE: include your bioportal apikey for suggested classes
			// see: http://bioportal.bioontology.org/account
			bioportalSearchUrl: "https://data.bioontology.org/search?ontologies=ECSO,PROV-ONE,ENVO,CHEBI,DATA-CITE,DC-TERMS,OWL-TIME&apikey=24e4775e-54e0-11e0-9d7b-005056aa3316&pagesize=1000&suggest=true&q=",
			//bioportalSearchUrl: null, // use this to deactivate the annotator view
			orcidBaseUrl: "https://sandbox.orcid.org",
			orcidSearchUrl: null,
			signInUrl: null,
			signInUrlOrcid: null,
			signInUrlLdap: null,
			tokenUrl: null,
			annotatorUrl: null,
			accountsUrl: null,
			groupsUrl: null,
			prov: false
		},
		
		defaultView: "data",
		
		initialize: function() {
			
			if(!this.get("baseUrl")){
				this.set("baseUrl",   this.get("d1CNBaseUrl"));
				this.set("d1Service", this.get("d1CNService"));
			}
			
			//this.set('publishServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/publish/');
			this.set('authServiceUrl',    this.get('baseUrl')  + this.get('d1Service') + '/isAuthorized/');
			this.set('queryServiceUrl',   this.get('baseUrl')  + this.get('d1Service') + '/query/solr/?');
			this.set('metaServiceUrl',    this.get('baseUrl')  + this.get('d1Service') + '/meta/');
			this.set('resolveServiceUrl', this.get('baseUrl')  + this.get('d1Service') + '/resolve/');
			this.set('nodeServiceUrl',    this.get('baseUrl')  + this.get('d1Service') + '/node');
			this.set("accountsUrl", 	  this.get("baseUrl")  + this.get("d1Service") + "/accounts/");
			this.set("groupsUrl", 		  this.get("baseUrl") + this.get("d1Service") + "/groups/");
			this.set('d1LogServiceUrl',   this.get('baseUrl') + this.get('d1Service') + '/query/logsolr');
			this.set("pendingMapsUrl",    this.get("accountsUrl") + "pendingmap/");
			
			//Settings for the DataONE API v2 only
			if(this.get("d1CNService").indexOf("v2") > -1){
				this.set("prov", true);
				this.set('viewServiceUrl',    this.get('baseUrl') + this.get('d1CNService') + '/views/metacatui/');
				
				//Authentication / portal URLs
				this.set('portalUrl',      this.get('d1CNBaseUrl') + '/portal/');
				this.set('tokenUrl',       this.get('portalUrl') + 'token');
				//this.set('annotatorUrl', this.get('d1CNBaseUrl') + '/portal/annotator');				
				this.set("signOutUrl",     this.get('portalUrl') + "logout");
				this.set("signInUrl",      this.get('portalUrl') + "startRequest?target=");
				this.set("signInUrlOrcid", this.get('portalUrl') + "oauth?action=start&target=");
				this.set("signInUrlLdap",  this.get('portalUrl') + "ldap?target=");	
				
				//Orcids are used with DataONE v2 only
				if(this.get('orcidBaseUrl'))
					this.set('orcidSearchUrl', this.get('orcidBaseUrl') + '/v1.1/search/orcid-bio?q=');
			}
			
			//Settings for older versions of metacat
			if((this.get("metcatVersion") < "2.5.0") && (this.get("d1Service").indexOf("mn/v1") > -1)){
				var queryServiceUrl = this.get("queryServiceUrl");
				if(queryServiceUrl.substring(queryServiceUrl.length-1) == "?")
					queryServiceUrl = queryServiceUrl.substring(0, queryServiceUrl.length-1);
				
				this.set("queryServiceUrl", queryServiceUrl);
				this.set('packageServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/package/');
			}
			//Whenever the Metacat version is at least 2.5.0 and we are querying a MN
			else if((this.get("metcatVersion") >= "2.5.0") && (this.get("d1Service").toLowerCase().indexOf("mn/") > -1)){
				this.set('packageServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/packages/application%2Fbagit-097/');
			}
			
			this.on("change:pid", this.changePid);
		},
		
		changePid: function(model, name){			
			this.set("previousPid", model.previous("pid"));
		}
		
	});
	return AppModel;		
});
