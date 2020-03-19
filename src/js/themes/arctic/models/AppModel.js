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

      enableUserProfiles: true,
      enableUserProfileSettings: true,
      profileUsername: null,

      maxDownloadSize: 3000000000,

      /**
       * Flag which, when true shows Whole Tale features in the UI
       * @type {Boolean}
       */
      showWholeTaleFeatures: false,
      /**
       * The environments that are exposed to DataONE users
       * @type {Array}
       */
      taleEnvironments: ["RStudio", "Jupyter Notebook"],
      /**
      * The Whole Tale endpoint that handles users
      * @type {String}
      */
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
      editorSaveErrorMsgWithDraft: "Not all of your changes could be submitted " +
        "due to a technical error. But, we sent a draft of your edits to " +
        "our support team, who will contact " +
        "you via email as soon as possible about getting your data package submitted. ",

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
      reserveServiceUrl: null,

      /**
      * If false, the /monitor/status (the service that returns the status of various DataONE services) will not be used.
      * @type {boolean}
      */
      enableMonitorStatus: true,

      /**
      * The URL for the service that returns the status of various DataONE services.
      * The only supported status so far is the search index queue -- the number of
      *   objects that are waiting to be indexed in the Solr search index
      * @type {string}
      * @readonly
      */
      monitorStatusUrl: "",

      //If set to false, some parts of the app will send POST HTTP requests to the
      // Solr search index via the `/query/solr` DataONE API.
      // Set this configuration to true if using Metacat 2.10.2 or earlier
      disableQueryPOSTs: false,

      defaultSearchFilters: ["all", "attribute", "annotation", "creator", "dataYear", "pubYear", "id", "taxon", "spatial"],

      metaServiceUrl: null,
      metacatBaseUrl: null,
      metacatServiceUrl: null,
      objectServiceUrl: null,
      formatsServiceUrl: null,
      formatsUrl: "/formats",
      resolveServiceUrl: null,
      orcidBaseUrl: "https:/orcid.org",
      //orcidSearchUrl: null,
      //orcidBioUrl: null,
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

      mdqBaseUrl: "https://docker-ucsb-4.dataone.org:30443/quality",
      // suidIds and suiteLables must be specified as a list, even if only one suite is available.
      mdqSuiteIds: ["arctic.data.center.suite.1"],
      mdqSuiteLabels: ["Arctic Data Center Conformance Suite v1.0"],
      // Quality suites for aggregated quality scores (i.e. metrics tab) 
      mdqAggregatedSuiteIds: ["FAIR.suite.1"],
      mdqAggregatedSuiteLabels: ["FAIR Suite v1.0"],
      mdqFormatIds:["eml*", "https://eml*"],
      
      // Metrics endpoint url
      metricsUrl: 'https://logproc-stage-ucsb-1.test.dataone.org/metrics',

      // Metrics Falgs for the /profile view (summary view)
      hideSummaryCitationsChart: false,
      hideSummaryDownloadsChart: false,
      hideSummaryMetadataAssessment: false,
      hideSummaryViewsChart: false,

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
      displayDatasetQualityMetric: true,
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

      /**
      * Semantic annotation configuration
      * Include your Bioportal api key to show ontology information for metadata annotations
      * see: http://bioportal.bioontology.org/account
      * @type {string}
      */
      bioportalAPIKey: "",
      /**
      * The Bioportal REST API URL, which is set dynamically only if a bioportalAPIKey is configured
      * @readonly
      * @type {string}
      */
      bioportalSearchUrl: "https://data.bioontology.org/search",
      /**
      * This attribute stores cache of ontology information that is looked up in Bioportal, so that duplicate REST calls don't need to be made.
      * @readonly
      * @type {object}
      */
      bioportalLookupCache: {},
      /**
      * Set this option to true to display the annotation icon in search result rows when a dataset has an annotation
      * @type {boolean}
      */
      showAnnotationIndicator: false,

      /**
      * If true, users can change the AccessPolicy for their objects.
      * @type {boolean}
      */
      allowAccessPolicyChanges: true,

      /**
      * The default Access Policy set on new objects uploaded to the repository.
      * Each literal object here gets set directly on an AccessRule model.
      * See the AccessRule model list of default attributes for options on what to set here.
      * @see {@link AccessRule}
      * @type {object}
      */
      defaultAccessPolicy: [{
        subject: "CN=arctic-data-admins,DC=dataone,DC=org",
        read: true,
        write: true,
        changePermission: true
      }],

      /**
      * The user-facing name for editing the Access Policy. This is displayed as the header of the AccessPolicyView, for example
      * @type {string}
      */
      accessPolicyName: "Sharing options",

      /**
      * @type {object}
      * @property {boolean} accessRuleOptions.read  - If true, users will be able to give others read access to their DataONE objects
      * @property {boolean} accessRuleOptions.write - If true, users will be able to give others write access to their DataONE objects
      * @property {boolean} accessRuleOptions.changePermission - If true, users will be able to give others changePermission access to their DataONE objects
      */
      accessRuleOptions: {
        read: true,
        write: true,
        changePermission: true
      },

      /**
      * @type {object}
      * @property {boolean} accessRuleOptionNames.read  - The user-facing name of the "read" access in Access Rules
      * @property {boolean} accessRuleOptionNames.write - The user-facing name of the "write" access in Access Rules
      * @property {boolean} accessRuleOptionNames.changePermission - The user-facing name of the "changePermission" access in Access Rules
      */
      accessRuleOptionNames: {
        read: "Can view",
        write: "Can edit",
        changePermission: "Is owner"
      },

      /**
      * If false, the rightsHolder of a resource will not be displayed in the AccessPolicyView.
      * @type {boolean}
      */
      displayRightsHolderInAccessPolicy: true,

      /**
      * If false, users will not be able to change the rightsHolder of a resource in the AccessPolicyView
      * @type {boolean}
      */
      allowChangeRightsHolder: true,

      /**
      * A list of group subjects that will be hidden in the AccessPolicy view to
      * everyone except those in the group. This is useful for preventing users from
      * removing repository administrative groups from access policies.
      * @type {string[]}
      */
      hiddenSubjectsInAccessPolicy: ["CN=arctic-data-admins,DC=dataone,DC=org"],

      /**
      * If true, the public/private toggle will be displayed in the Sharing Options for portals.
      * @type {boolean}
      */
      showPortalPublicToggle: true,

      /**
      * The public/private toggle will be displayed in the Sharing Options for portals for only
      * the given users or groups. To display the public/private toggle for everyone,
      * set `showPortalPublicToggle` to true and keep this array empty.
      * @type {string[]}
      */
      showPortalPublicToggleForSubjects: [],

      /**
      * If true, the public/private toggle will be displayed in the Sharing Options for datasets.
      * @type {boolean}
      */
      showDatasetPublicToggle: true,

      /**
      * Set to false to hide the display of "My Portals", which shows the user's current portals
      * @type {boolean}
      */
      showMyPortals: true,
      /**
      * The user-facing term for portals in lower-case and in singular form.
      * e.g. "portal"
      * @type {string}
      */
      portalTermSingular: "portal",
      /**
      * The user-facing term for portals in lower-case and in plural form.
      * e.g. "portals". This allows for portal terms with irregular plurals.
      * @type {string}
      */
      portalTermPlural: "portals",
      /**
      * Set to false to prevent ANYONE from creating a new portal.
      * @type {boolean}
      */
      enableCreatePortals: true,
      /**
      * Limits only the following people or groups to create new portals.
      * @type {string[]}
      */
      limitPortalsToSubjects: ["CN=arctic-data-admins,DC=dataone,DC=org"],

      /**
      * This message will display when a user tries to create a new Portal in the PortalEditor
      * when they are not associated with a whitelisted subject in the `limitPortalsToSubjects` list
      * @type {string}
      */
      portalEditNotAuthCreateMessage: "Creating new portals is a feature currently only available to a select group of Beta testers. You should still be able to access your existing portals. Please contact us with any questions at the email address below.",

      /**
      * This message will display when a user tries to access the Portal Editor for a portal
      * for which they do not have write permission.
      * @type {string}
      */
      portalEditNotAuthEditMessage: "The portal owner has not granted you permission to edit this portal. Please contact the owner to be given edit permission.",

      /**
      * This message will display when a user tries to create a new portal when they have exceeded their DataONE portal quota
      * @type {string}
      */
      portalEditNoQuotaMessage: "You have already reached the maximum number of portals for your membership level.",

      /**
      * This message will display when there is any non-specific error during the save process of the PortalEditor.
      * @type {string}
      */
      portalEditSaveErrorMsg: "Something went wrong while attempting to save your changes.",

      /**
      * The list of fields that should be required in the portal editor.
      * Set individual properties to `true` to require them in the portal editor.
      * @type {Object}
      */
      portalEditorRequiredFields: {
        label: true,
        name: true,
        description: false,
        sectionTitle: true,
        sectionIntroduction: false,
        logo: false,
        //The following fields are not yet supported as required fields in the portal editor
        //TODO: Add support for requiring the below fields
        sectionImage: false,
        acknowledgments: false,
        acknowledgmentsLogos: false,
        awards: false,
        associatedParties: false
      },

      // If true, then archived content is available in the search index.
      // Set to false if this MetacatUI is using a Metacat version before 2.10.0
      archivedContentIsIndexed: true,

      /**
      * The default FilterGroups to use in the data catalog search (DataCatalogViewWithFilters)
      * This is an array of literal objects that will be converted into FilterGroup models
      * @type {object[]}
      */
      defaultFilterGroups: [
        {
          label: "Search for: ",
          filters: [
            {
              fields: ["attribute"],
              label: "Data attribute",
              placeholder: "density, length, etc.",
              icon: "table",
              description: "Measurement type, e.g. density, temperature, species"
            },
            {
              filterType: "ToggleFilter",
              fields: ["documents"],
              label: "Show only results with data",
              trueLabel: null,
              falseLabel: null,
              trueValue: "*",
              icon: "table",
              description: "Checking this option will only return packages that include data files. Leaving this unchecked may return packages that only include metadata."
            },
            {
              fields: ["originText"],
              label: "Creator",
              placeholder: "Name",
              icon: "user",
              description: "The name of the creator or originator of a dataset"
            },
            {
              filterType: "DateFilter",
              fields: ["datePublished", "dateUploaded"],
              label: "Publish Year",
              rangeMin: 1800,
              icon: "calendar",
              description: "Only show results that were published within the year range"
            },
            {
              filterType: "DateFilter",
              fields: ["beginDate"],
              label: "Year of data coverage",
              rangeMin: 1800,
              icon: "calendar",
              description: "Only show results with data collected within the year range"
            },
            {
              fields: ["id", "identifier", "documents", "resourceMap", "seriesId"],
              label: "Identifier",
              placeholder: "DOI or ID",
              icon: "bullseye",
              description: "Find datasets if you have all or part of its DOI or ID"
            },
            {
              fields: ["kingdom", "phylum", "class", "order", "family", "genus", "species"],
              label: "Taxon",
              placeholder: "Class, family, etc.",
              icon: "sitemap",
              description: "Find data about any taxonomic rank"
            },
            {
              fields: ["siteText"],
              label: "Location",
              placeholder: "Geographic region",
              icon: "globe",
              description: "The geographic region or study site, as described by the submitter"
            }
          ]
        }
      ],

      /**
      * The following configuration options are deprecated or experimental and should only be changed by advanced users
      */
      /**
      * This Bioportal REST API URL is used by the experimental and unsupported AnnotatorView to get multiple ontology class info at once.
      * @deprecated
      */
      //bioportalBatchUrl: "https://data.bioontology.org/batch",
      /**
      * This DataONE API Annotator URL is used by the experimental and unsupported AnnotatorView to save an annotation
      * @deprecated
      */
      //annotatorUrl: null
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

      if( this.get("enableMonitorStatus") ){
        this.set("monitorStatusUrl", this.get('baseUrl') + this.get('context') + this.get('d1Service') + "/monitor/status");
      }

      // Metadata quality report services
      this.set('mdqSuitesServiceUrl', this.get("mdqBaseUrl") + "/suites/");
      this.set('mdqRunsServiceUrl', this.get('mdqBaseUrl') + "/runs/");
      this.set('mdqScoresServiceUrl', this.get('mdqBaseUrl') + "/scores/");

      //Set the NSF Award API proxy
      if(typeof this.get("grantsUrl") != "undefined")
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
        this.set("reserveServiceUrl", this.get("d1CNBaseUrl") + this.get("d1CNService") + "/reserve");

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
