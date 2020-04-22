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

      emailContact: "support@dataone.org",

      googleAnalyticsKey: null,

      nodeId: "urn:node:CN",

      searchMode: MetacatUI.mapKey ? 'map' : 'list',
      searchHistory: [],
      sortOrder: 'dateUploaded+desc',
      page: 0,

      pid: null,
      previousPid: null,

      anchorId: null,

      enableUserProfiles: true,
      enableUserProfileSettings: true,
      profileUsername: null,

      maxDownloadSize: 3000000000,

      // set this variable to true, if the content being published is moderated by the data team.
      contentIsModerated: false,

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

      baseUrl: window.location.origin || (window.location.protocol + "//" + window.location.host),
      // the most likely item to change is the Metacat deployment context
      context: '',
      d1Service: "/cn/v2",
      d1CNBaseUrl:  "https://cn.dataone.org",
      d1CNService: "/cn/v2",
      viewServiceUrl: null,
      packageServiceUrl: null,
      //publishServiceUrl: null,
      authServiceUrl: null,
      queryServiceUrl: null,
      reserveServiceUrl: null,

      /**
      * If false, the /monitor/status (the service that returns the status of various DataONE services) will not be used.
      * @type {boolean}
      */
      enableMonitorStatus: false,

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
      disableQueryPOSTs: true,

      defaultSearchFilters: ["all", "attribute", "annotation", "documents", "creator", "dataYear", "pubYear",
                             "id", "taxon", "spatial", "dataSource"],

      metaServiceUrl: null,
      metacatBaseUrl: null,
      metacatServiceUrl: null,
      //objectServiceUrl: null,
      resolveServiceUrl: null,
      d1LogServiceUrl: null,
      nodeServiceUrl: null,
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
      // Metadata quality report services
      mdqBaseUrl: "https://docker-ucsb-4.dataone.org:30443/quality",
      // suidIds and suiteLables must be specified as a list, even if only one suite is available.
      mdqSuiteIds: ["FAIR.suite.1"],
      mdqSuiteLabels: ["FAIR Suite v1.0"],
      // Quality suites for aggregated quality scores (i.e. metrics tab) 
      mdqAggregatedSuiteIds: ["FAIR.suite.1"],
      mdqAggregatedSuiteLabels: ["FAIR Suite v1.0"],
      mdqFormatIds:["eml*", "https://eml*", "*isotc211*"],

      // Metrics endpoint url
      metricsUrl: 'https://logproc-stage-ucsb-1.test.dataone.org/metrics',

      // Metrics Falgs for the /profile view (summary view)
      hideSummaryCitationsChart: false,
      hideSummaryDownloadsChart: false,
      hideSummaryMetadataAssessment: true,
      hideSummaryViewsChart: false,

      // Controls for Repository Portal Objects 
      // this serves the /profile/{nodeId} end point
      // This is a temporary configuration. To be replaced with book keeper logic
      // Note: the following controls only enable/disable metrics for dataonePlusMembers
      dataonePlusMembers: ["urn:node:ARCTIC", "urn:node:ESS_DIVE", "urn:node:KNB"],
      hideRepositoryMetadataAssessments: true,
      hideRepositoryCitationsChart: false,
      hideRepositoryDownloadsChart: false,
      hideRepositoryViewsChart: false,

      // Metrics flags for the Dataset Landing Page
      // Enable these flags to enable metrics display
      displayDatasetMetrics: true,

      // Controlling individual functionality
      // Only works if the parent flags displayDatasetMetrics is enabled
      displayDatasetMetricsTooltip: true,
      displayDatasetCitationMetric: true,
      displayDatasetDownloadMetric: true,
      displayDatasetViewMetric: true,
      displayDatasetEditButton: false,
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
      hideMetricsWhen: {
      },

      isJSONLDEnabled: true,

      // If true, then archived content is available in the search index.
      // Set to false if this MetacatUI is using a Metacat version before 2.10.0
      archivedContentIsIndexed: true,

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
      allowAccessPolicyChanges: false,

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
      * Set to false to hide the display of "My Portals", which shows the user's current portals
      * @type {boolean}
      */
      showMyPortals: false,
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
      limitPortalsToSubjects: [],

      /**
      * A list of unsupported User-Agent regular expressions for browsers that will not work well with MetacatUI.
      * A warning message will display on the page for anyone using one of these browsers.
      * @type {RegExp[]}
      */
      unsupportedBrowsers: [/(?:\b(MS)?IE\s+|\bTrident\/7\.0;.*\s+rv:)(\d+)/]

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
      //annotatorUrl: null,
    },

    defaultView: "data",

    initialize: function() {

      if(!this.get("baseUrl")){
        this.set("baseUrl",   this.get("d1CNBaseUrl"));
        this.set("d1Service", this.get("d1CNService"));
      }

      this.set('metacatBaseUrl', this.get('baseUrl') + this.get('context'));
      this.set('authServiceUrl',    this.get('baseUrl')  + this.get('d1Service') + '/isAuthorized/');
      this.set('queryServiceUrl',   this.get('baseUrl')  + this.get('d1Service') + '/query/solr/?');
      this.set('metaServiceUrl',    this.get('baseUrl')  + this.get('d1Service') + '/meta/');
      //this.set('objectServiceUrl',    this.get('baseUrl')  + this.get('d1Service') + '/object/');
      this.set('resolveServiceUrl', this.get('d1CNBaseUrl')  + this.get('d1Service') + '/resolve/');
      this.set('nodeServiceUrl',    this.get('baseUrl')  + this.get('d1Service') + '/node');
      this.set("reserveServiceUrl", this.get("d1CNBaseUrl") + this.get("d1CNService") + "/reserve");

      //This URL construction needs to be changed since, if enabled, because it is a MN API
      if( this.get("enableMonitorStatus") ){
        this.set("monitorStatusUrl", this.get('baseUrl') + this.get('context') + this.get('d1Service') + "/monitor/status");
      }

      // Metadata quality report services
     this.set('mdqSuitesServiceUrl', this.get("mdqBaseUrl") + "/suites/");
     this.set('mdqRunsServiceUrl', this.get('mdqBaseUrl') + "/runs/");
     this.set('mdqScoresServiceUrl', this.get('mdqBaseUrl') + "/scores/");

      //The logs index
      if(typeof this.get("d1LogServiceUrl") !== "undefined"){
        this.set('d1LogServiceUrl',   this.get('baseUrl') + this.get('d1Service') + '/query/logsolr/?');
      }

      //The account management links
      if(typeof this.get("accountsUrl") != "undefined"){
        this.set("groupsUrl",       this.get("baseUrl") + this.get("d1Service") + "/groups/");
        this.set("accountsUrl",     this.get("baseUrl")  + this.get("d1Service") + "/accounts/");

        this.set("pendingMapsUrl",    this.get("accountsUrl") + "pendingmap/");
        this.set("accountsMapsUrl",    this.get("accountsUrl") + "map/");
      }

      //The view service for member node installations of metacatui
      this.set('viewServiceUrl',    this.get('baseUrl') + this.get('d1CNService') + '/views/metacatui/');

      //Authentication / portal URLs
      this.set('portalUrl', this.get('d1CNBaseUrl') + '/portal/');
      this.set('tokenUrl',  this.get('portalUrl') + 'token');

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

      //The package service for v2 DataONE API
      this.set('packageServiceUrl', this.get('baseUrl') + this.get('d1Service') + '/packages/application%2Fbagit-097/');

      //Only use these settings in production
      if(this.get("baseUrl").indexOf("search.dataone.org") > -1)
        this.set("googleAnalyticsKey", "UA-15017327-17");

      //Deprecated -- this is the old bioportal search URL used by the AnnotatorView
      /*
      if((typeof this.get("bioportalAPIKey") == "string") && this.get("bioportalAPIKey").length)
        this.set("bioportalSearchUrl", "?ontologies=ECSO&apikey=" + this.get("bioportalAPIKey") + "&pagesize=1000&suggest=true&q=")
      */

      this.on("change:pid", this.changePid);

    },

    changePid: function(model, name){
      this.set("previousPid", model.previous("pid"));
    }

  });
  return AppModel;
});
