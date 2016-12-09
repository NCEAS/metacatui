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

			emailContact: "support@arcticdata.io",

			googleAnalyticsKey: null,

			nodeId: null,

			searchMode: mapKey ? 'map' : 'list',
			searchHistory: [],
			sortOrder: 'dateUploaded+desc',
			page: 0,

			previousPid: null,
			lastPid: null,

			anchorId: null,

			userProfiles: true,
			profileUsername: null,

			useJsonp: true,

			maxDownloadSize: 3000000000,

			metacatVersion: "2.8.0",
			baseUrl: window.location.origin || (window.location.protocol + "//" + window.location.host),
			// the most likely item to change is the Metacat deployment context
			context: '/metacat',
			d1Service: '/d1/mn/v2',
			d1CNBaseUrl: "https://cn-stage-2.test.dataone.org/",
			d1CNService: "cn/v2",
			//d1LogServiceUrl: null,
			nodeServiceUrl: null,
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
			//bioportalSearchUrl: null,
			orcidBaseUrl: "https:/orcid.org",
			//orcidSearchUrl: null,
			//orcidBioUrl: null,
			//annotatorUrl: null,
			grantsUrl: null,
			accountsUrl: null,
			pendingMapsUrl: null,
			accountMapsUrl: null,
			groupsUrl: null,
			//signInUrl: null,
			signOutUrl: null,
			signInUrlOrcid: null,
			//signInUrlLdap: null,
			tokenUrl: null,
			checkTokenUrl: null,
			prov: true,
			useSeriesId: true,
			mdqUrl: (window.location.origin || (window.location.protocol + "//" + window.location.host)) + "/quality/"

		},

		defaultView: "data",

		initialize: function() {

			//If no base URL is specified, then user the DataONE CN base URL
			if(!this.get("baseUrl")){
				this.set("baseUrl",   this.get("d1CNBaseUrl"));
				this.set("d1Service", this.get("d1CNService"));
			}

			// these are pretty standard, but can be customized if needed
			this.set('metacatBaseUrl', this.get('baseUrl') + this.get('context'));
			this.set('viewServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/views/metacatui/');
			this.set('publishServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/publish/');
			this.set('authServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/isAuthorized/');
			this.set('queryServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/query/solr/');
			this.set('metaServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/meta/');
			this.set('objectServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/object/');
			this.set('registryServiceUrl', this.get('baseUrl') + this.get('context') + '/cgi-bin/register-dataset.cgi');
			this.set('ldapwebServiceUrl', this.get('baseUrl') + this.get('context') + '/cgi-bin/ldapweb.cgi');
			this.set('metacatServiceUrl', this.get('baseUrl') + this.get('context') + '/metacat');

			//Add a ? character to the end of the Solr queries when we are appending JSONP parameters (which use ?'s)
			if(this.get("useJsonp"))
				this.set("queryServiceUrl", this.get("queryServiceUrl") + "?");

			//Set the NSF Award API proxy
			if(typeof this.get("grantsUrl") != "undefined")
				this.set("grantsUrl", this.get("baseUrl") + "/api.nsf.gov/services/v1/awards.json");

			//DataONE CN API
			if(this.get("d1CNBaseUrl")){

				this.set("resolveServiceUrl", this.get("d1CNBaseUrl") + this.get("d1CNService") + "/resolve/");
				
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

				if(this.get("useJsonp") && (typeof this.get("d1LogServiceUrl") != "undefined"))
					this.set('d1LogServiceUrl', this.get("d1LogServiceUrl") + "?");

				this.set("nodeServiceUrl", this.get("d1CNBaseUrl") + this.get("d1CNService") + "/node/");
				this.set('resolveServiceUrl', this.get('d1CNBaseUrl') + this.get('d1CNService') + '/resolve/');

				//Settings for the DataONE API v2 only
				if(this.get("d1CNService").indexOf("v2") > -1){

					//Authentication / portal URLs
					this.set('portalUrl', this.get('d1CNBaseUrl') + 'portal/');
					this.set('tokenUrl',  this.get('portalUrl') + 'token');
					this.set("checkTokenUrl", this.get("d1CNBaseUrl") + this.get("d1CNService") + "/diag/subject");

					//Annotator API
					if(typeof this.get("annotatorUrl") !== "undefined")
						this.set('annotatorUrl', this.get('d1CNBaseUrl') + 'portal/annotator');

					//The sign-in and out URLs - allow these to be turned off by removing them in the defaults above (hence the check for undefined)
					if(typeof this.get("signInUrl") !== "undefined"){
						this.set("signInUrl", this.get('portalUrl') + "startRequest?target=");
					}
					if(typeof this.get("signInUrlOrcid") !== "undefined")
						this.set("signInUrlOrcid", this.get('portalUrl') + "oauth?action=start&target=");
					if(typeof this.get("signInUrlLdap") !== "undefined")
						this.set("signInUrlLdap", this.get('portalUrl') + "ldap?target=");
					if(this.get('orcidBaseUrl'))
						this.set('orcidSearchUrl', this.get('orcidBaseUrl') + '/v1.1/search/orcid-bio?q=');
					if((typeof this.get("signInUrl") !== "undefined") || (typeof this.get("signInUrlOrcid") !== "undefined"))
						this.set("signOutUrl", this.get('portalUrl') + "logout");
				}
				else{
					//Turn the provenance features off
					if(typeof this.get("prov") != "undefined")
						this.set("prov", false);
					//Turn the seriesId feature off
					if(typeof this.get("useSeriesId") != "undefined")
						this.set("useSeriesId", false);
				}
			}

			//Settings for older versions of metacat, using DataONE API v1
			if((this.get("metacatVersion") < "2.5.0") && (this.get("d1Service").toLowerCase().indexOf("mn/v1") > -1)){
				//The package service API is different
				this.set('packageServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/package/');
			}
			//Whenever the Metacat version is at least 2.5.0 and we are querying a MN
			else if((this.get("metacatVersion") >= "2.5.0") && (this.get("d1Service").toLowerCase().indexOf("mn/") > -1)){
				//The package service for v2 DataONE API
				this.set('packageServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/packages/application%2Fbagit-097/');

				if(typeof this.get("useSeriesId") != "undefined")
					this.set("useSeriesId", true);
			}

			this.on("change:pid", this.changePid);
		},

		changePid: function(model, name){
			this.set("previousPid", model.previous("pid"));
		}
	});
	return AppModel;
});
