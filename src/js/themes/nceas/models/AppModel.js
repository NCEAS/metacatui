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
			searchMode: 'map',
			sortOrder: 'dateUploaded+desc',
			previousPid: null,
			lastPid: null,
			anchorId: null,
			profileUsername: null,
			page: 0,
			profileQuery: null,

			// set this variable to true, if the content being published is moderated by the data team.
			contentIsModerated: false,

      // Flag which, when true shows Whole Tale features in the UI
      showWholeTaleFeatures: false,
      taleEnvironments: ["RStudio", "Jupyter Notebook"],
      dashboardUrl: 'https://girder.wholetale.org/api/v1/integration/dataone',

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

				subject: "CN=knb-data-admins,DC=dataone,DC=org",
				read: true,
				write: true,
				changePermission: true
			},
			{
				subject: "public",
				read: true
			}],

			baseUrl: "https://knb.ecoinformatics.org",
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
			ldapwebServiceUrl: null,
			metacatServiceUrl: null,
			objectServiceUrl: null,
			formatsServiceUrl: null,
            formatsUrl: "/formats",
            bioportalSearchUrl: null,
			orcidSearchUrl: null,
			signInUrl: null,
			signOutUrl: null,
			signInUrlOrcid: null,
			signInUrlLdap: null,
			tokenUrl: null,
			//annotatorUrl: null,
			accountsUrl: null,
			isJSONLDEnabled: true,
			showAnnotationIndicator: false
		},

		defaultView: "submit",

		initialize: function() {

			// these are pretty standard, but can be customized if needed
			this.set('viewServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/views/metacatui/');
			this.set('packageServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/package/');
			this.set('publishServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/publish/');
			this.set('authServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/isAuthorized/');
			this.set('queryServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/query/solr/');
			this.set('metaServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/meta/');
			this.set('objectServiceUrl', this.get('baseUrl') + this.get('context') + this.get('d1Service') + '/object/');
			this.set('metacatServiceUrl', this.get('baseUrl') + this.get('context') + '/metacat');
			this.set("accountsUrl", this.get("d1CNBaseUrl") + this.get("d1CNService") + "/accounts/");

			// Object format list
      if ( typeof this.get("formatsUrl") != "undefined" ) {
          this.set("formatsServiceUrl",
              this.get("d1CNBaseUrl") + this.get("d1CNService") + this.get("formatsUrl"));
      }

			//Token URLs
			if(typeof this.get("tokenUrl") != "undefined"){
				this.set("portalUrl", this.get("d1CNBaseUrl") + "portal/");
				this.set("tokenUrl",  this.get("portalUrl") + "token");

				//The sign-in and out URLs - allow these to be turned off by removing them in the defaults above (hence the check for undefined)
				if(typeof this.get("signInUrl") !== "undefined")
					this.set("signInUrl", this.get('portalUrl') + "startRequest?target=");
				if(typeof this.get("signInUrlOrcid") !== "undefined")
					this.set("signInUrlOrcid", this.get('portalUrl') + "oauth?action=start&target=");
				if(typeof this.get("signInUrlLdap") !== "undefined")
					this.set("signInUrlLdap", this.get('portalUrl') + "ldap?target=");
				if(this.get('orcidBaseUrl'))
					this.set('orcidSearchUrl', this.get('orcidBaseUrl') + '/v1.1/search/orcid-bio?q=');

				if((typeof this.get("signInUrl") !== "undefined") || (typeof this.get("signInUrlOrcid") !== "undefined"))
					this.set("signOutUrl", this.get('portalUrl') + "logout");

				if(typeof this.get("d1LogServiceUrl") != "undefined")
					this.set('d1LogServiceUrl', this.get('d1CNBaseUrl') + this.get('d1CNService') + '/query/logsolr/?');

			}

			this.on("change:pid", this.changePid);
		},

		changePid: function(model, name){
			this.set("previousPid", model.previous("pid"));
		}
	});
	return AppModel;
});
