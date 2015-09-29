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
			baseUrl: "https://cn-sandbox-2.test.dataone.org", //window.location.origin,
			// the most likely item to change is the Metacat deployment context
			context: '',
			d1Service: null,
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
			bioportalSearchUrl: "https://data.bioontology.org/search?ontologies=D1-CARBON-FLUX,PROV-ONE,ENVO,CHEBI,DATA-CITE,DC-TERMS,OWL-TIME&apikey=24e4775e-54e0-11e0-9d7b-005056aa3316&pagesize=1000&suggest=true&q=",
			//bioportalSearchUrl: null, // use this to deactivate the annotator view
			orcidBaseUrl: "https://pub.orcid.org",
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
			
			//For IE
			if (!window.location.origin) {
				var baseUrl = window.location.protocol + "//" + window.location.host;
				
				this.set('baseUrl', baseUrl);
				//this.set('d1CNBaseUrl', baseUrl);
			}
			
			//this.set('publishServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/publish/');
			this.set('authServiceUrl', this.get('d1CNBaseUrl')  + this.get('d1CNService') + '/isAuthorized/');
			this.set('queryServiceUrl', this.get('d1CNBaseUrl') + this.get('d1CNService') + '/query/solr/?');
			this.set('metaServiceUrl', this.get('d1CNBaseUrl')  + this.get('d1CNService') + '/meta/');
			this.set('resolveServiceUrl', this.get('d1CNBaseUrl')  + this.get('d1CNService') + '/resolve/');
			this.set('nodeServiceUrl', this.get('d1CNBaseUrl')  + this.get('d1CNService') + '/node');
			this.set("accountsUrl", this.get("d1CNBaseUrl")  + this.get("d1CNService") + "/accounts/");
			this.set("pendingMapsUrl", this.get("accountsUrl") + "pendingmap/");
			this.set("groupsUrl", this.get("d1CNBaseUrl") + this.get("d1CNService") + "/groups/");
			this.set('d1LogServiceUrl', this.get('d1CNBaseUrl') + this.get('d1CNService') + '/query/logsolr');
			
			//Settings for the DataONE API v2 only
			if(this.get("d1CNService").indexOf("v2") > -1){
				this.set("prov", true);
				this.set('viewServiceUrl', this.get('d1CNBaseUrl') + this.get('d1CNService') + '/views/metacatui/');
				this.set('tokenUrl', this.get('d1CNBaseUrl') + '/portal/token');
				
				this.set('packageServiceUrl', this.get('d1CNBaseUrl') + this.get('d1CNService') + '/packages/application%2Fbagit-097/');
				// use portal to  retrieve token and annotate metadata
				//this.set('annotatorUrl', this.get('d1CNBaseUrl') + '/portal/annotator');				
				this.set("signOutUrl", this.get('d1CNBaseUrl') + "/portal/logout");
				this.set("signInUrl", this.get('d1CNBaseUrl') + "/portal/startRequest?target=");
				this.set("signInUrlOrcid", this.get('d1CNBaseUrl') + "/portal/oauth?action=start&target=");
				this.set("signInUrlLdap", this.get('d1CNBaseUrl') + "/portal/ldap?target=");	
				
				if(this.get('orcidBaseUrl'))
					this.set('orcidSearchUrl', this.get('orcidBaseUrl') + '/v1.1/search/orcid-bio?q=');
			}
			
			this.on("change:pid", this.changePid);

		},
		
		changePid: function(model, name){			
			this.set("previousPid", model.previous("pid"));
		}
		
	});
	return AppModel;		
});
