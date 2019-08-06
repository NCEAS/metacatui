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

      //These error messages are displayed when the Editor encounters an error saving
      editorSaveErrorMsg: "Not all of your changes could be submitted.",
      editorSaveErrorMsgWithDraft: "Not all of your changes could be submitted, but a draft " +
        "has been saved which can be accessed by our support team. Please contact us.",

			defaultAccessPolicy: [{
        subject: "public",
        read: true
      }],

			baseUrl: window.location.origin || (window.location.protocol + "//" + window.location.host),
			allowAccessPolicyChanges: true,
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

      //If set to false, some parts of the app will send POST HTTP requests to the
      // Solr search index via the `/query/solr` DataONE API.
      // Set this configuration to true if using Metacat 2.10.2 or earlier
      disableQueryPOSTs: false,

      defaultSearchFilters: ["all", "attribute", "documents", "creator", "dataYear", "pubYear", "id", "taxon", "spatial"],

      metaServiceUrl: null,
			metacatBaseUrl: null,
			metacatServiceUrl: null,
			objectServiceUrl: null,
      formatsServiceUrl: null,
      formatsUrl: "/formats",
			//grantsUrl: null,
			//bioportalSearchUrl: null,
			//orcidSearchUrl: null,
			//orcidBioUrl: null,
			//signInUrl: null,
			signOutUrl: null,
			signInUrlOrcid: null,
			signInUrlLdap: null,
			tokenUrl: null,
			checkTokenUrl: null,
			//annotatorUrl: null,
			accountsUrl: null,
			pendingMapsUrl: null,
			accountsMapsUrl: null,
			groupsUrl: null,
			portalUrl: null,
			mdqUrl: null,

			// Metrics endpoint url
			metricsUrl: 'https://logproc-stage-ucsb-1.test.dataone.org/metrics',

			// Metrics flags for the Dataset Landing Page
			// Enable these flags to enable metrics display
			displayDatasetMetrics: true,

			// Controlling individual functionality
			// Only works if the parent flags displayDatasetMetrics is enabled
			displayDatasetMetricsTooltip: true,
			displayDatasetCitationMetric: true,
			displayDatasetDownloadMetric: true,
			displayDatasetViewMetric: true,
			displayDatasetEditButton: true,
			displayDatasetQualityMetric: false,
			displayDatasetAnalyzeButton: false,
			displayMetricModals: true,
			displayDatasetControls: true,
      /* Hide metrics display for SolrResult models that match the given properties.
      *  Properties can be functions, which are given the SolrResult model value as a parameter.
      * Example:
      * {
      *    formatId: "eml://ecoinformatics.org/eml-2.1.1",
      *    isPublic: true,
      *    dateUploaded: function(date){
      *      return new Date(date) < new Date('1995-12-17T03:24:00');
      *    }
      * }
      * This example would hide metrics for any objects that are:
      *   EML 2.1.1 OR public OR were uploaded before 12/17/1995.
      */
      hideMetricsWhen: null,

			isJSONLDEnabled: true,

			// A lookup map of project names to project seriesIds
			projectsMap: {},

			// If true, then archived content is available in the search index.
			// Set to false if this MetacatUI is using a Metacat version before 2.10.0
			archivedContentIsIndexed: true
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
			this.set('metacatServiceUrl', this.get('baseUrl') + this.get('context') + '/metacat');

			if(typeof this.get("grantsUrl") !== "undefined")
				this.set("grantsUrl", "https://api.nsf.gov/services/v1/awards.json");

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
					this.set('d1LogServiceUrl', this.get('d1CNBaseUrl') + this.get('d1CNService') + '/query/logsolr/?');

				this.set("nodeServiceUrl", this.get("d1CNBaseUrl") + this.get("d1CNService") + "/node/");
				this.set('resolveServiceUrl', this.get('d1CNBaseUrl') + this.get('d1CNService') + '/resolve/');

				//Token URLs
				if(typeof this.get("tokenUrl") != "undefined"){
					this.set("portalUrl", this.get("d1CNBaseUrl") + "portal/");
					this.set("tokenUrl",  this.get("portalUrl") + "token");

					this.set("checkTokenUrl", this.get("d1CNBaseUrl") + this.get("d1CNService") + "/diag/subject");

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

				}

				// Object format list
        if ( typeof this.get("formatsUrl") != "undefined" ) {
             this.set("formatsServiceUrl",
             this.get("d1CNBaseUrl") + this.get("d1CNService") + this.get("formatsUrl"));
        }

				//ORCID search
				if(typeof this.get("orcidBaseUrl") != "undefined")
					this.set('orcidSearchUrl', this.get('orcidBaseUrl') + '/search/orcid-bio?q=');

				//Turn the seriesId feature on
				if(typeof this.get("useSeriesId") != "undefined")
					this.set("useSeriesId", true);
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
