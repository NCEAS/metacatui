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

			emailContact: "support@arcticdata.io",

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

			// set this variable to true, if the content being published is moderated by the data team.
			contentIsModerated: true,

			/*
			 * emlEditorRequiredFields is a hash map of all the required fields in the EML Editor.
			 * Any field set to true will prevent the user from saving the Editor until a value has been given
			 */
			emlEditorRequiredFields: {
				abstract: true,
				alternateIdentifier: false,
				funding: true,
				generalTaxonomicCoverage: false,
				geoCoverage: true,
				intellectualRights: true,
				keywordSets: false,
				methods: false,
				samplingDescription: false,
				studyExtentDescription: false,
				taxonCoverage: false,
				temporalCoverage: true,
				title: true
			},

			editableFormats: ["eml://ecoinformatics.org/eml-2.1.1"],

			defaultAccessPolicy: [{

				subject: "CN=arctic-data-admins,DC=dataone,DC=org",
				read: true,
				write: true,
				changePermission: true
			}],

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
			formatsServiceUrl: null,
      formatsUrl: "/formats",
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
			mdqUrl: "https://quality.nceas.ucsb.edu/quality/"

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
			this.set('queryServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/query/solr/?');
			this.set('metaServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/meta/');
			this.set('objectServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/object/');
			this.set('registryServiceUrl', this.get('baseUrl') + this.get('context') + '/cgi-bin/register-dataset.cgi');
			this.set('ldapwebServiceUrl', this.get('baseUrl') + this.get('context') + '/cgi-bin/ldapweb.cgi');
			this.set('metacatServiceUrl', this.get('baseUrl') + this.get('context') + '/metacat');

			//Set the NSF Award API proxy
			if(typeof this.get("grantsUrl") != "undefined")
				this.set("grantsUrl", "https://api.nsf.gov/services/v1/awards.json");

			//DataONE CN API
			if(this.get("d1CNBaseUrl")){

				//Account services
				if(typeof this.get("accountsUrl") != "undefined"){
					this.set("accountsUrl", this.get("d1CNBaseUrl") + this.get("d1CNService") + "/accounts/");

					if(typeof this.get("pendingMapsUrl") != "undefined")
						this.set("pendingMapsUrl", this.get("accountsUrl") + "pendingmap");

					if(typeof this.get("accountsMapsUrl") != "undefined")
						this.set("accountsMapsUrl", this.get("accountsUrl") + "map/");

					if(typeof this.get("groupsUrl") != "undefined")
						this.set("groupsUrl", this.get("d1CNBaseUrl") + this.get("d1CNService") + "/groups/");
				}

				if(typeof this.get("d1LogServiceUrl") != "undefined")
					this.set('d1LogServiceUrl', this.get('d1CNBaseUrl') + this.get('d1CNService') + '/query/logsolr/?');

				this.set("nodeServiceUrl", this.get("d1CNBaseUrl") + this.get("d1CNService") + "/node/");
				this.set('resolveServiceUrl', this.get('d1CNBaseUrl') + this.get('d1CNService') + '/resolve/');

				// Object format list
        if ( typeof this.get("formatsUrl") != "undefined" ) {
            this.set("formatsServiceUrl",
                this.get("d1CNBaseUrl") + this.get("d1CNService") + this.get("formatsUrl"));
        }

				//Authentication / portal URLs
				this.set('portalUrl', this.get('d1CNBaseUrl') + 'portal/');
				this.set('tokenUrl',  this.get('portalUrl') + 'token');

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

			//The package service for v2 DataONE API
			this.set('packageServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/packages/application%2Fbagit-097/');

			this.on("change:pid", this.changePid);
		},

		changePid: function(model, name){
			this.set("previousPid", model.previous("pid"));
		}
	});
	return AppModel;
});
