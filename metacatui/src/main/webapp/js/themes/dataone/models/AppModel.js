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

			emailContact: "",

			googleAnalyticsKey: null,

			nodeId: "urn:node:CN",

			searchMode: mapKey ? 'map' : 'list',
			searchHistory: [],
			sortOrder: 'dateUploaded+desc',
			page: 0,

			pid: null,
			previousPid: null,

			anchorId: null,

			userProfiles: true,
			profileUsername: null,

			useJsonp: true,

			maxDownloadSize: 3000000000,

			metcatVersion: "2.8.0",
			baseUrl: window.location.origin || (window.location.protocol + "//" + window.location.host),
			// the most likely item to change is the Metacat deployment context
			context: '',
			d1Service: "/cn/v2",
			d1CNBaseUrl:  "https://cn.dataone.org",
			d1CNService: "/cn/v2",
			viewServiceUrl: null,
			packageServiceUrl: null,
			publishServiceUrl: null,
			authServiceUrl: null,
			queryServiceUrl: null,
			metaServiceUrl: null,
			registryServiceUrl: null,
			ldapwebServiceUrl: null,
			metacatBaseUrl: null,
			metacatServiceUrl: null,
			objectServiceUrl: null,
			resolveServiceUrl: null,
			d1LogServiceUrl: null,
			nodeServiceUrl: null,
			// NOTE: include your bioportal apikey for suggested classes
			// see: http://bioportal.bioontology.org/account
			bioportalAPIKey: "24e4775e-54e0-11e0-9d7b-005056aa3316",
			bioportalSearchUrl: null, // use this to deactivate the annotator view
			bioportalBatchUrl: "https://data.bioontology.org/batch",
			annotatorUrl: null,
			//orcidBaseUrl: "https://sandbox.orcid.org",
			//orcidSearchUrl: null,
			accountsUrl: null,
			pendingMapsUrl: null,
			accountMapsUrl: null,
			groupsUrl: null,
			signInUrl: null,
			signOutUrl: null,
			signInUrlOrcid: null,
			//signInUrlLdap: null,
			tokenUrl: null,
			checkTokenUrl: null,
		    prov: true,
			useSeriesId: true,
			mdqUrl: null

		},

		defaultView: "data",

		initialize: function() {

			if(!this.get("baseUrl")){
				this.set("baseUrl",   this.get("d1CNBaseUrl"));
				this.set("d1Service", this.get("d1CNService"));
			}

			//this.set('publishServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/publish/');
			this.set('metacatBaseUrl', this.get('baseUrl') + this.get('context'));
			this.set('authServiceUrl',    this.get('baseUrl')  + this.get('d1Service') + '/isAuthorized/');
			this.set('queryServiceUrl',   this.get('baseUrl')  + this.get('d1Service') + '/query/solr/');
			this.set('metaServiceUrl',    this.get('baseUrl')  + this.get('d1Service') + '/meta/');
			this.set('objectServiceUrl',    this.get('baseUrl')  + this.get('d1Service') + '/object/');
			this.set('resolveServiceUrl', this.get('d1CNBaseUrl')  + this.get('d1Service') + '/resolve/');
			this.set('nodeServiceUrl',    this.get('baseUrl')  + this.get('d1Service') + '/node');

			//The logs index
			if(typeof this.get("d1LogServiceUrl") !== "undefined"){
				this.set('d1LogServiceUrl',   this.get('baseUrl') + this.get('d1Service') + '/query/logsolr/?');
			}

			//The account management links
			if(typeof this.get("accountsUrl") != "undefined"){
				this.set("groupsUrl", 		  this.get("baseUrl") + this.get("d1Service") + "/groups/");
				this.set("accountsUrl", 	  this.get("baseUrl")  + this.get("d1Service") + "/accounts/");

				this.set("pendingMapsUrl",    this.get("accountsUrl") + "pendingmap/");
				this.set("accountsMapsUrl",    this.get("accountsUrl") + "map/");
			}

			//Add a ? character to the end of the Solr queries when we are appending JSONP parameters (which use ?'s)
			if(this.get("useJsonp"))
				this.set("queryServiceUrl", this.get("queryServiceUrl") + "?");			

			//Settings for the DataONE API v2 only
			if(this.get("d1CNService").indexOf("v2") > -1){
				//Turn provenance feature on
				if(typeof this.get("prov") != "undefined")
					this.set("prov", true);

				//Use the seriesId feature with the v2 API
				if(typeof this.get("useSeriesId") != "undefined")
					this.set("useSeriesId", true);

				//The view service for member node installations of metacatui
				this.set('viewServiceUrl',    this.get('baseUrl') + this.get('d1CNService') + '/views/metacatui/');

				//Authentication / portal URLs
				this.set('portalUrl', this.get('d1CNBaseUrl') + '/portal/');
				this.set('tokenUrl',  this.get('portalUrl') + 'token');
				this.set("checkTokenUrl", this.get("d1CNBaseUrl") + this.get("d1CNService") + "/diag/subject");

				//Annotator API
				if(typeof this.get("annotatorUrl") !== "undefined")
					this.set('annotatorUrl', this.get('d1CNBaseUrl') + '/portal/annotator');

				//The sign-in and out URLs - allow these to be turned off by removing them in the defaults above (hence the check for undefined)
				if(typeof this.get("signInUrl") !== "undefined"){
					this.set("signInUrl", this.get('portalUrl') + "startRequest?target=");
					this.set("signOutUrl", this.get('portalUrl') + "logout");
				}
				if(typeof this.get("signInUrlOrcid") !== "undefined")
					this.set("signInUrlOrcid", this.get('portalUrl') + "oauth?action=start&target=");
				if(typeof this.get("signInUrlLdap") !== "undefined")
					this.set("signInUrlLdap", this.get('portalUrl') + "ldap?target=");
				if(this.get('orcidBaseUrl'))
					this.set('orcidSearchUrl', this.get('orcidBaseUrl') + '/v1.1/search/orcid-bio?q=');
			}
			else{
				//Turn the provenance features off
				if(typeof this.get("prov") != "undefined")
					this.set("prov", false);
				//Turn the seriesId feature off
				if(typeof this.get("useSeriesId") != "undefined")
					this.set("useSeriesId", false);
			}

			//Settings for older versions of metacat
			if((this.get("metcatVersion") < "2.5.0") && (this.get("d1Service").indexOf("mn/v1") > -1)){
				//The package service API is different
				this.set('packageServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/package/');

				//Turn the provenance features off
				if(typeof this.get("prov") != "undefined")
					this.set("prov", false);
				//Turn the seriesId feature off
				if(typeof this.get("useSeriesId") != "undefined")
					this.set("useSeriesId", false);
			}
			//Whenever the Metacat version is at least 2.5.0 and we are querying a MN
			else if((this.get("metcatVersion") >= "2.5.0") && (this.get("d1Service").toLowerCase().indexOf("mn/") > -1)){
				//The package service for v2 DataONE API
				this.set('packageServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/packages/application%2Fbagit-097/');

				if(typeof this.get("useSeriesId") != "undefined")
					this.set("useSeriesId", true);
			}

			//Only use these settings in production
			if(this.get("d1CNBaseUrl").indexOf("cn.dataone.org") > -1)
				this.set("googleAnalyticsKey", "UA-15017327-17");

			//Set up the bioportal search URL
			if((typeof this.get("bioportalAPIKey") == "string") && this.get("bioportalAPIKey").length)
				this.set("bioportalSearchUrl", "https://data.bioontology.org/search?ontologies=ECSO&apikey=" + this.get("bioportalAPIKey") + "&pagesize=1000&suggest=true&q=")

			this.on("change:pid", this.changePid);
		},

		changePid: function(model, name){
			this.set("previousPid", model.previous("pid"));
		}

	});
	return AppModel;
});
