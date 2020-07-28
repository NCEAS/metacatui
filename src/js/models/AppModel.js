/*global define */
define(['jquery', 'underscore', 'backbone'],
  function($, _, Backbone) {
  'use strict';

  /**
  * @class AppModel
  * @classdesc A utility model that contains top-level configuration and storage for the application
  * @name AppModel
  * @extends Backbone.Model
  * @constructor
  */
  var AppModel = Backbone.Model.extend(
    /** @lends AppModel.prototype */ {

    defaults: _.extend(
      /** @lends AppConfig.prototype */{

      //TODO: These attributes are stored in the AppModel, but shouldn't be set in the AppConfig,
      //so we need to add docs for them in a separate place
      headerType: 'default',
      searchMode: MetacatUI.mapKey ? 'map' : 'list',
      searchHistory: [],
      page: 0,
      previousPid: null,
      lastPid: null,
      anchorId: null,
      profileUsername: null,

      /**
      * The theme name to use
      * @type {string}
      * @default "default"
      */
      theme: "default",

      /**
      * The default page title.
      * @type {string}
      */
      title: MetacatUI.themeTitle || "Metacat Data Catalog",

      /**
      * The name of this repository. This is used throughout the interface in different
      * messages and page content.
      * @type {string}
      * @default "Metacat Data Catalog"
      * @since 2.11.2
      */
      repositoryName: MetacatUI.themeTitle || "Metacat Data Catalog",

      /**
      * The e-mail address that people should contact when they need help with
      * submitting datasets, resolving error messages, etc.
      * @type {string}
      * @default knb-help@nceas.ucsb.edu
      */
      emailContact: "knb-help@nceas.ucsb.edu",

      /**
      * Your Google Maps API key, which is used to diplay interactive maps on the search
      * views and static maps on dataset landing pages.
      * If a Google Maps API key is no specified, the maps will be omitted from the interface.
      * Sign up for Google Maps services at https://console.developers.google.com/
      * @type {string}
      * @example "AIzaSyCYyHnbIokUEpMx5M61ButwgNGX8fIHUs"
      * @default null
      */
      mapKey: null,

      /**
      * Your Google Analytics API key, which is used to send page view and custom events
      * to the Google Analytics service.
      * This service is optional in MetacatUI.
      * Sign up for Google Analytics services at https://analytics.google.com/analytics/web/
      * @type {string}
      * @example "UA-74622301-1"
      * @default null
      */
      googleAnalyticsKey: null,

      /**
      * The node identifier for this repository. This is set dynamically by retrieving the
      * DataONE Coordinating Node document and finding this repository in the Node list.
      * (see https://cn.dataone.org/cn/v2/node).
      * If this repository is not registered with DataONE, then set this node id by copying
      * the node id from your node info at https://your-repo-site.com/metacat/d1/mn/v2/node
      * @type {string}
      * @example "urn:node:METACAT"
      * @default null
      */
      nodeId: null,

      /**
      * Enable or disable the user profiles. If enabled, users will see a "My profile" link
      * and can view their datasets, metrics on those datasets, their groups, etc.
      * @type {boolean}
      * @default true
      */
      enableUserProfiles: true,

      /**
      * Enable or disable the user settings view. If enabled, users will see a list of
      * changeable settings - name, email, groups, portals, etc.
      * @type {boolean}
      * @default true
      */
      enableUserProfileSettings: true,

      /**
      * The maximum dataset .zip file size, in bytes, that a user can download.
      * Datasets whose total size are larger than this maximum will show a disabled
      * "Download All" button, and users will be directed to download files individually.
      * This is useful for preventing the Metacat package service from getting overloaded.
      * @type {number}
      * @default 3000000000
      */
      maxDownloadSize: 3000000000,

      /**
      * Add a message that will display during a certain time period. This is useful when
      * displaying a warning message about planned outages/maintenance, or alert users to other
      * important information.
      * If this attribute is left blank, no message will display, even if there is a start and end time specified.
      * If there are is no start or end time specified, this message will display until you remove it here.
      *
      * @type {string}
      * @default null
      * @since 2.11.4
      */
      temporaryMessage: null,

      /**
      * If there is a temporaryMessage specified, it will display after this start time.
      * Remember that Dates are in GMT time!
      * @type {Date}
      * @example new Date(1594818000000)
      * @default null
      * @since 2.11.4
      */
      temporaryMessageStartTime: null,

      /**
      * If there is a temporaryMessage specified, it will display before this end time.
      * Remember that Dates are in GMT time!
      * @type {Date}
      * @example new Date(1594818000000)
      * @default null
      * @since 2.11.4
      */
      temporaryMessageEndTime: null,

      /**
      * Additional HTML classes to give the temporary message element. Use these to style the message.
      * @type {string}
      * @default "warning"
      * @since 2.11.4
      */
      temporaryMessageClasses: "warning",

      /**
      * A jQuery selector for the element that the temporary message will be displayed in.
      * @type {string}
      * @default "#Navbar"
      * @since 2.11.4
      */
      temporaryMessageContainer: "#Navbar",

      /**
      * Show or hide the source repository logo in the search result rows
      * @type {boolean}
      * @default false
      */
      displayRepoLogosInSearchResults: false,
      /**
      * Show or hide the Download button in the search result rows
      * @type {boolean}
      * @default false
      */
      displayDownloadButtonInSearchResults: false,

      /**
      * If set to false, some parts of the app will send POST HTTP requests to the
      * Solr search index via the `/query/solr` DataONE API.
      * Set this configuration to true if using Metacat 2.10.2 or earlier
      * @type {boolean}
      */
      disableQueryPOSTs: false,

      /** If set to true, some parts of the app will use the Solr Join Query syntax
      * when sending queries to the `/query/solr` DataONE API.
      * If this is not enabled, then some parts of the UI may not work if a query has too
      * many characters or has too many boolean clauses. This impacts the "Metrics" tabs of portals/collections,
      * at least.
      * The Solr Join Query Parser as added in Solr 4.0.0-ALPHA (I believe!): https://archive.apache.org/dist/lucene/solr/4.0.0/changes/Changes.html#4.0.0-alpha.new_features
      * About the Solr Join Query Parser: https://lucene.apache.org/solr/guide/8_5/other-parsers.html#join-query-parser
      * WARNING: At some point, MetacatUI will deprecate this configuration and will REQUIRE Solr Join Queries
      * @type {boolean}
      */
      enableSolrJoins: false,

      /**
      * The search filters that will be displayed in the search views. Add or remove
      * filter names from this array to show or hide them. See "example" to see all the
      * filter options.
      * @type {string[]}
      * @default ["all", "attribute", "documents", "creator", "dataYear", "pubYear", "id", "taxon", "spatial"]
      * @example ["all", "annotation", "attribute", "dataSource", "documents", "creator", "dataYear", "pubYear", "id", "taxon", "spatial"]
      */
      defaultSearchFilters: ["all", "attribute", "documents", "creator", "dataYear", "pubYear", "id", "taxon", "spatial"],

      /**
       * Enable to show Whole Tale features
       * @type {Boolean}
       * @default false
       */
      showWholeTaleFeatures: false,
      /**
       * The WholeTale environments that are exposed on the dataset landing pages
       * @type {string[]}
       * @default ["RStudio", "Jupyter Notebook"]
       */
      taleEnvironments: ["RStudio", "Jupyter Notebook"],
      /**
      * The Whole Tale endpoint
      * @type {string}
      * @default 'https://girder.wholetale.org/api/v1/integration/dataone'
      */
      dashboardUrl: 'https://girder.wholetale.org/api/v1/integration/dataone',

      /**
       * A list of all the required fields in the EML Editor.
       * Any field set to `true` will prevent the user from saving the Editor until a value has been given
       * Any EML field not supported in this list cannot be required.
       * @type {object}
       * @property {boolean} abstract - Default: true
       * @property {boolean} alternateIdentifier - Default: false
       * @property {boolean} funding - Default: false
       * @property {boolean} generalTaxonomicCoverage - Default: false
       * @property {boolean} taxonCoverage - Default: false. If true, at least one taxonomic rank and value will be required.
       * @property {boolean} geoCoverage - Default: false. If true, at least one geographic coverage description and point/bounding box will be required.
       * @property {boolean} intellectualRights - Default: true
       * @property {boolean} keywordSets - Default: false. If true, at least one keyword will be required.
       * @property {boolean} methods - Default: false. If true, at least one method step will be required.
       * @property {boolean} samplingDescription - Default: false
       * @property {boolean} studyExtentDescription - Default: false
       * @property {boolean} temporalCoverage - Default: false. If true, at least a beginDate will be required.
       * @property {boolean} title - Default: true. EML documents always require a title. Only set this to false if you are extending MetacatUI to ensure a title another way.
       * @default {
                     abstract: true,
                     alternateIdentifier: false,
                     funding: false,
                     generalTaxonomicCoverage: false,
                     taxonCoverage: false,
                     geoCoverage: false,
                     intellectualRights: true,
                     keywordSets: false,
                     methods: false,
                     samplingDescription: false,
                     studyExtentDescription: false,
                     temporalCoverage: false,
                     title: true
                   }
        * @example
        *  {
        *    abstract: true,
        *    alternateIdentifier: false,
        *    funding: false,
        *    generalTaxonomicCoverage: false,
        *    taxonCoverage: false,
        *    geoCoverage: false,
        *    intellectualRights: true,
        *    keywordSets: false,
        *    methods: false,
        *    samplingDescription: false,
        *    studyExtentDescription: false,
        *    temporalCoverage: false,
        *    title: true
        *  }
       */
      emlEditorRequiredFields: {
        abstract: true,
        alternateIdentifier: false,
        funding: false,
        generalTaxonomicCoverage: false,
        taxonCoverage: false,
        geoCoverage: false,
        intellectualRights: true,
        keywordSets: false,
        methods: false,
        samplingDescription: false,
        studyExtentDescription: false,
        temporalCoverage: false,
        title: true
      },

      /**
      * An array of science metadata format IDs that are editable in MetacatUI.
      * Metadata documents with these format IDs will have an Edit button and will be
      * editable in the Editor Views.
      * This should only be changed if you have extended MetacatUI to edit a new format,
      * or if you want to disable editing of a specific format ID.
      * @type {string[]}
      * @default [
        "eml://ecoinformatics.org/eml-2.1.1",
        "https://eml.ecoinformatics.org/eml-2.2.0"
      ]
      * @example
      *  [
      *    "eml://ecoinformatics.org/eml-2.1.1",
      *    "https://eml.ecoinformatics.org/eml-2.2.0"
      *  ]
      * @readonly
      */
      editableFormats: [
        "eml://ecoinformatics.org/eml-2.1.1",
        "https://eml.ecoinformatics.org/eml-2.2.0"
      ],

      /**
      * The format ID the dataset editor serializes new EML as
      * @type {string}
      * @default "https://eml.ecoinformatics.org/eml-2.2.0"
      * @readonly
      * @since 2.13.0
      */
      editorSerializationFormat: "https://eml.ecoinformatics.org/eml-2.2.0",

      /**
      * The XML schema location the dataset editor will use when creating new EML. This should
      * correspond with {@link AppConfig#editorSerializationFormat}
      * @type {string}
      * @default "https://eml.ecoinformatics.org/eml-2.2.0 https://eml.ecoinformatics.org/eml-2.2.0/eml.xsd"
      * @readonly
      * @since 2.13.0
      */
      editorSchemaLocation: "https://eml.ecoinformatics.org/eml-2.2.0 https://eml.ecoinformatics.org/eml-2.2.0/eml.xsd",

      /**
      * This error message is displayed when the Editor encounters an error saving
      * @type {string}
      */
      editorSaveErrorMsg: "Not all of your changes could be submitted.",
      /**
      * This error message is displayed when the Editor encounters an error saving, and a plain-text draft is saved instead
      * @type {string}
      */
      editorSaveErrorMsgWithDraft: "Not all of your changes could be submitted, but a draft " +
        "has been saved which can be accessed by our support team. Please contact us.",

      /**
      * A list of keyword thesauri options for the user to choose from in the EML Editor.
      * A "None" option will also always display.
      * @type {object[]}
      * @property {string} label - A readable and short label for the keyword thesaurus that is displayed in the UI
      * @property {string} thesaurus - The exact keyword thesaurus name that will be saved in the EML
      * @since 2.10.0
      * @default [{
                  label: "GCMD",
                  thesaurus: "NASA Global Change Master Directory (GCMD)"
                }]
      * @example
      *  [{
      *    label: "GCMD",
      *    thesaurus: "NASA Global Change Master Directory (GCMD)"
      *  }]
      */
      emlKeywordThesauri: [{
        label: "GCMD",
        thesaurus: "NASA Global Change Master Directory (GCMD)"
      }],

      /**
      * The base URL for the repository. This only needs to be changed if the repository
      * is hosted at a different origin than the MetacatUI origin. This URL is used to contruct all
      * of the DataONE REST API URLs. If you are testing MetacatUI against a development repository
      * at an external location, this is where you would set that external repository URL.
      * @type {string}
      * @default window.location.origin || (window.location.protocol + "//" + window.location.host)
      */
      baseUrl: window.location.origin || (window.location.protocol + "//" + window.location.host),

      /**
      * The directory that metacat is installed in at the `baseUrl`. For example, if you
      * have metacat installed in the tomcat webapps directory as `metacat`, then this should be set
      * to "/metacat". Or if you renamed the metacat webapp to `catalog`, then it should be `/catalog`.
      * @type {string}
      * @default "/metacat"
      */
      context: MetacatUI.AppConfig.metacatContext || '/metacat',

      /**
      * The URL fragment for the DataONE Member Node (MN) API.
      * @type {string}
      * @default '/d1/mn/v2'
      */
      d1Service: '/d1/mn/v2',
      /**
      * The base URL of the DataONE Coordinating Node (CN). CHange this if you
      * are testing a deployment in a development environment.
      * @type {string}
      * @default "https://cn.dataone.org/"
      * @example "https://cn-stage.test.dataone.org/""
      */
      d1CNBaseUrl: "https://cn.dataone.org/",
      /**
      * The URL fragment for the DataONE Coordinating Node (CN) API.
      * @type {string}
      * @default 'cn/v2'
      */
      d1CNService: "/cn/v2",
      /**
      * The URL for the DataONE Search MetacatUI. This only needs to be changed
      * if you want to point to a development environment.
      * @type {string}
      * @default "https://search.dataone.org"
      * @readonly
      * @since 2.13.0
      */
      dataoneSearchUrl: "https://search.dataone.org",
      /**
      * The URL for the DataONE listNodes() API. This URL is contructed dynamically when the
      * AppModel is initialized. Only override this if you are an advanced user and have a reason to!
      * (see https://releases.dataone.org/online/api-documentation-v2.0/apis/CN_APIs.html#CNCore.listNodes)
      * @type {string}
      */
      nodeServiceUrl: null,
      /**
      * The URL for the DataONE View API. This URL is contructed dynamically when the
      * AppModel is initialized. Only override this if you are an advanced user and have a reason to!
      * (see https://releases.dataone.org/online/api-documentation-v2.0/apis/MN_APIs.html#module-MNView)
      * @type {string}
      */
      viewServiceUrl: null,
      /**
      * The URL for the DataONE getPackage() API. This URL is contructed dynamically when the
      * AppModel is initialized. Only override this if you are an advanced user and have a reason to!
      * (see https://releases.dataone.org/online/api-documentation-v2.0/apis/MN_APIs.html#MNPackage.getPackage)
      *
      * @type {string}
      */
      packageServiceUrl: null,
      /**
      * The URL for the Metacat Publish service. This URL is contructed dynamically when the
      * AppModel is initialized. Only override this if you are an advanced user and have a reason to!
      * @type {string}
      */
      publishServiceUrl: null,
      /**
      * The URL for the DataONE isAuthorized() API. This URL is contructed dynamically when the
      * AppModel is initialized. Only override this if you are an advanced user and have a reason to!
      * (see https://releases.dataone.org/online/api-documentation-v2.0/apis/MN_APIs.html#MNAuthorization.isAuthorized)
      * @type {string}
      */
      authServiceUrl: null,
      /**
      * The URL for the DataONE query API. This URL is contructed dynamically when the
      * AppModel is initialized. Only override this if you are an advanced user and have a reason to!
      * (see https://releases.dataone.org/online/api-documentation-v2.0/apis/MN_APIs.html#MNQuery.query)
      * @type {string}
      */
      queryServiceUrl: null,
      /**
      * The URL for the DataONE reserveIdentifier() API. This URL is contructed dynamically when the
      * AppModel is initialized. Only override this if you are an advanced user and have a reason to!
      * (see https://releases.dataone.org/online/api-documentation-v2.0/apis/CN_APIs.html#CNCore.reserveIdentifier)
      * @type {string}
      */
      reserveServiceUrl: null,
      /**
      * The URL for the DataONE system metadata API. This URL is contructed dynamically when the
      * AppModel is initialized. Only override this if you are an advanced user and have a reason to!
      * (see https://releases.dataone.org/online/api-documentation-v2.0/apis/MN_APIs.html#MNRead.getSystemMetadata
      * and https://releases.dataone.org/online/api-documentation-v2.0/apis/MN_APIs.html#MNStorage.updateSystemMetadata)
      * @type {string}
      */
      metaServiceUrl: null,
      /**
      * The URL for the DataONE system metadata API. This URL is contructed dynamically when the
      * AppModel is initialized. Only override this if you are an advanced user and have a reason to!
      * (see https://releases.dataone.org/online/api-documentation-v2.0/apis/MN_APIs.html#MNRead.getSystemMetadata
      * and https://releases.dataone.org/online/api-documentation-v2.0/apis/MN_APIs.html#MNStorage.updateSystemMetadata)
      * @type {string}
      */
      objectServiceUrl: null,
      /**
      * The URL for the DataONE Formats API. This URL is contructed dynamically when the
      * AppModel is initialized. Only override this if you are an advanced user and have a reason to!
      * (see https://releases.dataone.org/online/api-documentation-v2.0/apis/CN_APIs.html#CNCore.listFormats)
      * @type {string}
      */
      formatsServiceUrl: null,
      /**
      * The URL fragment for the DataONE Formats API. This is combined with the AppConfig#formatsServiceUrl
      * @type {string}
      * @default "/formats"
      */
      formatsUrl: "/formats",

      /**
      * If true, parts of the UI (most notably, "funding" field in the dataset editor)
      * may look up NSF Award information
      * @type {boolean}
      * @default false
      */
      useNSFAwardAPI: false,
      /**
      * The URL for the NSF Award API, which can be used by the {@link LookupModel}
      * to look up award information for the dataset editor or other views
      * @type {string}
      * @default "https://api.nsf.gov/services/v1/awards.json"
      */
      grantsUrl: "https://api.nsf.gov/services/v1/awards.json",

      /**
      * The base URL for the ORCID REST services
      * @type {string}
      * @default "https:/orcid.org"
      */
      orcidBaseUrl: "https:/orcid.org",

      /**
      * The URL for the ORCID search API, which can be used to search for information
      * about people using their ORCID, email, name, etc.
      * This URL is constructed dynamically once the {@link AppModel} is initialized.
      * @type {string}
      */
      orcidSearchUrl: null,

      /**
      * The URL for the Metacat API. The Metacat API has been deprecated and is kept here
      * for compatability with Metacat repositories that are using the old x509 certificate
      * authentication mechanism. This is deprecated since authentication is now done via
      * the DataONE Portal service using auth tokens. (Using the {@link AppConfig#tokenUrl})
      * This URL is contructed dynamically when the AppModel is initialized.
      * Only override this if you are an advanced user and have a reason to!
      * @type {string}
      */
      metacatServiceUrl: null,

      /**
      * If false, the /monitor/status (the service that returns the status of various DataONE services) will not be used.
      * @type {boolean}
      * @default true
      * @since 2.9.0
      */
      enableMonitorStatus: true,

      /**
      * The URL for the service that returns the status of various DataONE services.
      * The only supported status so far is the search index queue -- the number of
      * objects that are waiting to be indexed in the Solr search index.
      * This URL is contructed dynamically when the
      * AppModel is initialized. Only override this if you are an advanced user and have a reason to!
      * @type {string}
      * @since 2.9.0
      */
      monitorStatusUrl: "",

      /**
      * If true, users can sign in using CILogon as the identity provider.
      * ORCID is the only recommended identity provider. CILogon may be deprecated
      * in the future.
      * @type {boolean}
      * @default false
      */
      enableCILogonSignIn: false,
      /**
      * The URL for the DataONE Sign In API using CILogon as the identity provider
      * This URL is constructed dynamically once the {@link AppModel} is initialized.
      * @type {string}
      */
      signInUrl: null,
      /**
      * The URL for the DataONE Sign Out API
      * This URL is constructed dynamically once the {@link AppModel} is initialized.
      * @type {string}
      */
      signOutUrl: null,
      /**
      * The URL for the DataONE Sign In API using ORCID as the identity provider
      * This URL is constructed dynamically once the {@link AppModel} is initialized.
      * @type {string}
      */
      signInUrlOrcid: null,

      /**
      * Enable DataONE LDAP authentication. If true, users can sign in from an LDAP account that is in the DataONE CN LDAP directory.
      * This is not recommended, as DataONE is moving towards supporting only ORCID logins for users.
      * This LDAP authentication is separate from the File-based authentication for the Metacat Admin interface.
      * @type {boolean}
      * @default false
      * @since 2.11.0
      */
      enableLdapSignIn: false,
      /**
      * The URL for the DataONE Sign In API using LDAP as the identity provider
      * This URL is constructed dynamically once the {@link AppModel} is initialized.
      * @type {string}
      */
      signInUrlLdap: null,

      /**
      * The URL for the DataONE Token API using ORCID as the identity provider
      * This URL is constructed dynamically once the {@link AppModel} is initialized.
      * @type {string}
      */
      tokenUrl: null,
      /**
      * The URL for the DataONE echoCredentials() API
      * This URL is constructed dynamically once the {@link AppModel} is initialized.
      * (see https://releases.dataone.org/online/api-documentation-v2.0/apis/CN_APIs.html#CNDiagnostic.echoCredentials)
      * @type {string}
      */
      checkTokenUrl: null,
      /**
      * The URL for the DataONE Identity API
      * This URL is constructed dynamically once the {@link AppModel} is initialized.
      * (see https://releases.dataone.org/online/api-documentation-v2.0/apis/CN_APIs.html#module-CNIdentity)
      * @type {string}
      */
      accountsUrl: null,
      /**
      * The URL for the DataONE Pending Maps API
      * This URL is constructed dynamically once the {@link AppModel} is initialized.
      * (see https://releases.dataone.org/online/api-documentation-v2.0/apis/CN_APIs.html#CNIdentity.getPendingMapIdentity)
      * @type {string}
      */
      pendingMapsUrl: null,
      /**
      * The URL for the DataONE mapIdentity() API
      * This URL is constructed dynamically once the {@link AppModel} is initialized.
      * (see https://releases.dataone.org/online/api-documentation-v2.0/apis/CN_APIs.html#CNIdentity.mapIdentity)
      * @type {string}
      */
      accountsMapsUrl: null,
      /**
      * The URL for the DataONE Groups API
      * This URL is constructed dynamically once the {@link AppModel} is initialized.
      * (see https://releases.dataone.org/online/api-documentation-v2.0/apis/CN_APIs.html#CNIdentity.createGroup)
      * @type {string}
      */
      groupsUrl: null,
      /**
      * The URL for the DataONE metadata assessment service
      * @type {string}
      * @default "https://docker-ucsb-4.dataone.org:30443/quality"
      */
      mdqBaseUrl: "https://docker-ucsb-4.dataone.org:30443/quality",
      /**
      * Metadata Assessment Suite IDs for the dataset assessment reports.
      * @type {string[]}
      * @default ["FAIR.suite.1"]
      */
      mdqSuiteIds: ["FAIR.suite.1"],
      /**
      * Metadata Assessment Suite labels for the dataset assessment reports
      * @type {string[]}
      * @default ["FAIR Suite v1.0"]
      */
      mdqSuiteLabels: ["FAIR Suite v1.0"],
      /**
      * Metadata Assessment Suite IDs for the aggregated assessment charts
      * @type {string[]}
      * @default ["FAIR.suite.1"]
      */
      mdqAggregatedSuiteIds: ["FAIR.suite.1"],
      /**
      * Metadata Assessment Suite labels for the aggregated assessment charts
      * @type {string[]}
      * @default ["FAIR.suite.1"]
      */
      mdqAggregatedSuiteLabels: ["FAIR Suite v1.0"],
      /**
      * The metadata formats for which to display metadata assessment reports
      * @type {string[]}
      * @default ["eml*", "https://eml*", "*isotc211*"]
      */
      mdqFormatIds:["eml*", "https://eml*", "*isotc211*"],

      /**
      * Metrics endpoint url
      * @type {string}
      */
      metricsUrl: 'https://logproc-stage-ucsb-1.test.dataone.org/metrics',

      /**
      * DataONE Citation reporting endpoint url
      * @type {string}
      */
      dataoneCitationsUrl: 'https://logproc-stage-ucsb-1.test.dataone.org/citations',

     /**
      * Hide or show the report Citation button in the dataset landing page.
      * @type {boolean}
      * @default true
      */
      hideReportCitationButton: false,

      /**
      * Hide or show the aggregated citations chart in the StatsView.
      * These charts are only available for DataONE Plus members or Hosted Repositories.
      * (see https://dataone.org)
      * @type {boolean}
      * @default true
      * @since 2.9.0
      */
      hideSummaryCitationsChart: true,
      /**
      * Hide or show the aggregated downloads chart in the StatsView
      * These charts are only available for DataONE Plus members or Hosted Repositories.
      * (see https://dataone.org)
      * @type {boolean}
      * @default true
      * @since 2.9.0
      */
      hideSummaryDownloadsChart: true,
      /**
      * Hide or show the aggregated metadata assessment chart in the StatsView
      * These charts are only available for DataONE Plus members or Hosted Repositories.
      * (see https://dataone.org)
      * @type {boolean}
      * @default true
      * @since 2.9.0
      */
      hideSummaryMetadataAssessment: true,
      /**
      * Hide or show the aggregated views chart in the StatsView
      * These charts are only available for DataONE Plus members or Hosted Repositories.
      * (see https://dataone.org)
      * @type {boolean}
      * @default true
      * @since 2.9.0
      */
      hideSummaryViewsChart: true,

      /*
      * List of Repositories that are DataONE Plus Members.
      * DataONE Plus features are displayed only for these members.
      * @type {string[]}
      * @readonly
      * @default ["urn:node:ARCTIC", "urn:node:ESS_DIVE", "urn:node:KNB", "urn:node:mnUCSB1"]
      * @since 2.13.0
      * ------------------------------------
      * This config will not be displayed in the JSDoc documentation since it is
      * temporary and only useful for internal DataONE purposes. This functionality will be replaced
      * with the DataONE Bookkeeper service, eventually.
      */
      dataonePlusMembers: ["urn:node:ARCTIC", "urn:node:ESS_DIVE", "urn:node:KNB", "urn:node:mnUCSB1"],

      /**
      * Metrics flag for the Dataset Landing Page
      * Enable this flag to enable metrics display
      * @type {boolean}
      * @default true
      */
      displayDatasetMetrics: true,

      /**
      * If true, displays the dataset metrics tooltips on the metrics buttons.
      * Turn off all dataset metrics displays using the {@link AppConfig#displayDatasetMetrics}
      * @type {boolean}
      * @default true
      */
      displayDatasetMetricsTooltip: true,
      /**
      * If true, displays the datasets metric modal windows on the dataset landing page
      * Turn off all dataset metrics displays using the {@link AppConfig#displayDatasetMetrics}
      * @type {boolean}
      * @default true
      */
      displayMetricModals: true,
      /**
      * If true, displays the dataset citation metrics on the dataset landing page
      * Turn off all dataset metrics displays using the {@link AppConfig#displayDatasetMetrics}
      * @type {boolean}
      * @default true
      */
      displayDatasetCitationMetric: true,
      /**
      * If true, displays the dataset download metrics on the dataset landing page
      * Turn off all dataset metrics displays using the {@link AppConfig#displayDatasetMetrics}
      * @type {boolean}
      * @default true
      */
      displayDatasetDownloadMetric: true,
      /**
      * If true, displays the dataset view metrics on the dataset landing page
      * Turn off all dataset metrics displays using the {@link AppConfig#displayDatasetMetrics}
      * @type {boolean}
      * @default true
      */
      displayDatasetViewMetric: true,
      /**
      * If true, displays the "Edit" button on the dataset landing page
      * @type {boolean}
      * @default true
      */
      displayDatasetEditButton: true,
      /**
      * If true, displays the metadata assessment metrics on the dataset landing page
      * @type {boolean}
      * @default false
      */
      displayDatasetQualityMetric: false,
      /**
      * If true, displays the WholeTale "Analyze" button on the dataset landing page
      * @type {boolean}
      * @default false
      */
      displayDatasetAnalyzeButton: false,
      /**
      * If true, displays various buttons on the dataset landing page for dataset owners
      * @type {boolean}
      * @default false
      */
      displayDatasetControls: true,
      /** Hide metrics display for SolrResult models that match the given properties.
      *  Properties can be functions, which are given the SolrResult model value as a parameter.
      * Turn off all dataset metrics displays using the {@link AppConfig#displayDatasetMetrics}
      * @type {object}
      * @example
      * {
      *   formatId: "eml://ecoinformatics.org/eml-2.1.1",
      *   isPublic: true,
      *   dateUploaded: function(date){
      *     return new Date(date) < new Date('1995-12-17T03:24:00');
      *   }
      * }
      * // This example would hide metrics for any objects that are:
      * //  EML 2.1.1 OR public OR were uploaded before 12/17/1995.
      */
      hideMetricsWhen: null,

      /**
      * The zoom level to use in the Google Static Map images on the dataset landing pages.
      * The higher the zoom level, the more zoomed in the map will be. Set to 0 to show
      * the entire world in the map, and 15+ to show fine details. The highest zoom level
      * is about 20. For more information, see the Google Statis Maps API docs: https://developers.google.com/maps/documentation/maps-static/start#Zoomlevels
      * @type {number}
      * @default 6
      * @since 2.13.0
      */
      datasetMapZoomLevel: 6,

      /**
      * The bounding box path color to use in the Google Static Map images on the dataset landing pages.
      * Specify the color either as a 24-bit (example: color=0xFFFFCC) or 32-bit hexadecimal value
      * (example: color=0xFFFFCCFF), or from the set: black, brown, green, purple, yellow, blue, gray, orange, red, white.
      * For more information, see the Google Statis Maps API docs: https://developers.google.com/maps/documentation/maps-static/start#PathStyles
      * @type {string}
      * @default "0xDA4D3Aff" (red)
      * @since 2.13.0
      */
      datasetMapPathColor: "0xDA4D3Aff",

      /**
      * The bounding box fill color to use in the Google Static Map images on the dataset landing pages.
      * If you don't want to fill in the bounding boxes with a color, set this to null or undefined.
      * Specify the color either as a 24-bit (example: color=0xFFFFCC) or 32-bit hexadecimal value
      * (example: color=0xFFFFCCFF), or from the set: black, brown, green, purple, yellow, blue, gray, orange, red, white.
      * For more information, see the Google Statis Maps API docs: https://developers.google.com/maps/documentation/maps-static/start#PathStyles
      * @type {string}
      * @default "0xFFFF0033" (light yellow)
      * @since 2.13.0
      */
      datasetMapFillColor: "0xFFFF0033",

      /**
      * If true, the dataset landing pages will generate Schema.org-compliant JSONLD
      * and insert it into the page.
      * @type {boolean}
      * @default true
      */
      isJSONLDEnabled: true,

      /**
      * If true, users can see a "Publish" button in the MetadataView, which makes the metadata
      * document public and gives it a DOI identifier.
      * If false, the button will be hidden completely.
      * @type {boolean}
      * @default true
      */
      enablePublishDOI: true,

      /**
      * A list of users or groups who exclusively will be able to see and use the "Publish" button,
      * which makes the metadata document public and gives it a DOI identifier.
      * Anyone not in this list will not be able to see the Publish button.
      * `enablePublishDOI` must be set to `true` for this to take effect.
      * @type {string[]}
      */
      enablePublishDOIForSubjects: [],

      /**
      * If true, users can change the AccessPolicy for their objects.
      * @type {boolean}
      * @default true
      * @since 2.9.0
      */
      allowAccessPolicyChanges: true,

      /**
      * The default Access Policy set on new objects uploaded to the repository.
      * Each literal object here gets set directly on an AccessRule model.
      * See the AccessRule model list of default attributes for options on what to set here.
      * @see {@link AccessRule}
      * @type {object[]}
      * @since 2.9.0
      * @default [{
                  subject: "public",
                  read: true
                }]
      * @example
      * [{
      *   subject: "public",
      *   read: true
      * }]
      * // This example would assign public access to all new objects created in MetacatUI.
      */
      defaultAccessPolicy: [{
        subject: "public",
        read: true
      }],

      /**
      * The user-facing name for editing the Access Policy. This is displayed as the header of the AccessPolicyView, for example
      * @type {string}
      * @since 2.9.0
      * @default "Sharing options"
      */
      accessPolicyName: "Sharing options",

      /**
      * @type {object}
      * @property {boolean} accessRuleOptions.read  - If true, users will be able to give others read access to their DataONE objects
      * @property {boolean} accessRuleOptions.write - If true, users will be able to give others write access to their DataONE objects
      * @property {boolean} accessRuleOptions.changePermission - If true, users will be able to give others changePermission access to their DataONE objects
      * @since 2.9.0
      * @default {
                  read: true,
                  write: true,
                  changePermission: true
                }
      * @example
      * {
      *   read: true,
      *   write: true,
      *   changePermission: false
      * }
      * // This example would enable users to edit the read and write access to files,
      * // but not change ownership, in the Access Policy View.
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
      * @since 2.9.0
      * @example
      *  {
      *    read: "Can view",
      *    write: "Can edit",
      *    changePermission: "Is owner"
      *  }
      */
      accessRuleOptionNames: {
        read: "Can view",
        write: "Can edit",
        changePermission: "Is owner"
      },

      /**
      * If false, the rightsHolder of a resource will not be displayed in the AccessPolicyView.
      * @type {boolean}
      * @default true
      * @since 2.9.0
      */
      displayRightsHolderInAccessPolicy: true,

      /**
      * If false, users will not be able to change the rightsHolder of a resource in the AccessPolicyView
      * @type {boolean}
      * @default true
      * @since 2.9.0
      */
      allowChangeRightsHolder: true,

      /**
      * A list of group subjects that will be hidden in the AccessPolicy view to
      * everyone except those in the group. This is useful for preventing users from
      * removing repository administrative groups from access policies.
      * @type {string[]}
      * @since 2.9.0
      * @example ["CN=data-admin-group,DC=dataone,DC=org"]
      */
      hiddenSubjectsInAccessPolicy: [],

      /**
      * If true, the public/private toggle will be displayed in the Sharing Options for portals.
      * @type {boolean}
      * @default true
      * @since 2.9.0
      */
      showPortalPublicToggle: true,

      /**
      * The public/private toggle will be displayed in the Sharing Options for portals for only
      * the given users or groups. To display the public/private toggle for everyone,
      * set `showPortalPublicToggle` to true and keep this array empty.
      * @type {string[]}
      * @since 2.9.0
      */
      showPortalPublicToggleForSubjects: [],

      /**
      * If true, the public/private toggle will be displayed in the Sharing Options for datasets.
      * @type {boolean}
      * @default true
      * @since 2.9.0
      */
      showDatasetPublicToggle: true,

      /**
      * Set to false to hide the display of "My Portals", which shows the user's current portals
      * @type {boolean}
      * @default true
      */
      showMyPortals: true,
      /**
      * The user-facing term for portals in lower-case and in singular form.
      * e.g. "portal"
      * @type {string}
      * @default "portal"
      */
      portalTermSingular: "portal",
      /**
      * The user-facing term for portals in lower-case and in plural form.
      * e.g. "portals". This allows for portal terms with irregular plurals.
      * @type {string}
      * @default "portals"
      */
      portalTermPlural: "portals",
      /**
      * Set to false to prevent ANYONE from creating a new portal.
      * @type {boolean}
      * @default true
      */
      enableCreatePortals: true,
      /**
      * Limits only the following people or groups to create new portals.
      * @type {string[]}
      */
      limitPortalsToSubjects: [],

      /**
      * This message will display when a user tries to create a new Portal in the PortalEditor
      * when they are not associated with a whitelisted subject in the `limitPortalsToSubjects` list
      * @type {string}
      */
      portalEditNotAuthCreateMessage: "You have not been authorized to create new portals. Please contact us with any questions.",

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
      * @type {object}
      * @property {boolean} label - Default: true
      * @property {boolean} name - Default: true
      * @property {boolean} description - Default: false
      * @property {boolean} sectionTitle - Default: true
      * @property {boolean} sectionIntroduction - Default: false
      * @property {boolean} logo - Default: false
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

      /**
      * A list of portals labels that no one should be able to create portals with
      * @type {string[]}
      * @readonly
      * @since 2.11.3
      */
      portalLabelBlockList: [
        "Dataone",
        'urn:node:CN', 'CN', 'cn',
        'urn:node:CNUNM1', 'CNUNM1', 'cn-unm-1',
        'urn:node:CNUCSB1', 'CNUCSB1', 'cn-ucsb-1',
        'urn:node:CNORC1', 'CNORC1', 'cn-orc-1',
        'urn:node:KNB', 'KNB', 'KNB Data Repository',
        'urn:node:ESA', 'ESA', 'ESA Data Registry',
        'urn:node:SANPARKS', 'SANPARKS', 'SANParks Data Repository',
        'urn:node:ORNLDAAC', 'ORNLDAAC', 'ORNL DAAC',
        'urn:node:LTER', 'LTER', 'U.S. LTER Network',
        'urn:node:CDL', 'CDL', 'UC3 Merritt',
        'urn:node:PISCO', 'PISCO', 'PISCO MN',
        'urn:node:ONEShare', 'ONEShare', 'ONEShare DataONE Member Node',
        'urn:node:mnORC1', 'mnORC1', 'DataONE ORC Dedicated Replica Server',
        'urn:node:mnUNM1', 'mnUNM1', 'DataONE UNM Dedicated Replica Server',
        'urn:node:mnUCSB1', 'mnUCSB1', 'DataONE UCSB Dedicated Replica Server',
        'urn:node:TFRI', 'TFRI', 'TFRI Data Catalog',
        'urn:node:USANPN', 'USANPN', 'USA National Phenology Network',
        'urn:node:SEAD', 'SEAD', 'SEAD Virtual Archive',
        'urn:node:GOA', 'GOA', 'Gulf of Alaska Data Portal',
        'urn:node:KUBI', 'KUBI', 'University of Kansas - Biodiversity Institute',
        'urn:node:LTER_EUROPE', 'LTER_EUROPE', 'LTER Europe Member Node',
        'urn:node:DRYAD', 'DRYAD', 'Dryad Digital Repository',
        'urn:node:CLOEBIRD', 'CLOEBIRD', 'Cornell Lab of Ornithology - eBird',
        'urn:node:EDACGSTORE', 'EDACGSTORE', 'EDAC Gstore Repository',
        'urn:node:IOE', 'IOE', 'Montana IoE Data Repository',
        'urn:node:US_MPC', 'US_MPC', 'Minnesota Population Center',
        'urn:node:EDORA', 'EDORA', 'Environmental Data for the Oak Ridge Area (EDORA)',
        'urn:node:RGD', 'RGD', 'Regional and Global biogeochemical dynamics Data (RGD)',
        'urn:node:GLEON', 'GLEON', 'GLEON Data Repository',
        'urn:node:IARC', 'IARC', 'IARC Data Archive',
        'urn:node:NMEPSCOR', 'NMEPSCOR', 'NM EPSCoR Tier 4 Node',
        'urn:node:TERN', 'TERN', 'TERN Australia',
        'urn:node:NKN', 'NKN', 'Northwest Knowledge Network',
        'urn:node:USGS_SDC', 'USGS_SDC', 'USGS Science Data Catalog',
        'urn:node:NRDC', 'NRDC', 'NRDC DataONE member node',
        'urn:node:NCEI', 'NCEI', 'NOAA NCEI Environmental Data Archive',
        'urn:node:PPBIO', 'PPBIO', 'PPBio',
        'urn:node:NEON', 'NEON', 'NEON Member Node',
        'urn:node:TDAR', 'TDAR', 'The Digital Archaeological Record',
        'urn:node:ARCTIC', 'ARCTIC', 'Arctic Data Center',
        'urn:node:BCODMO', 'BCODMO', 'Biological and Chemical Oceanography Data Management Office (BCO-DMO) ',
        'urn:node:GRIIDC', 'GRIIDC', 'Gulf of Mexico Research Initiative Information and Data Cooperative (GRIIDC)',
        'urn:node:R2R', 'R2R', 'Rolling Deck to Repository (R2R)',
        'urn:node:EDI', 'EDI', 'Environmental Data Initiative',
        'urn:node:UIC', 'UIC', 'A Member Node for University of Illinois at Chicago.',
        'urn:node:RW', 'RW', 'Research Workspace',
        'urn:node:FEMC', 'FEMC', 'Forest Ecosystem Monitoring Cooperative Member Node',
        'urn:node:OTS_NDC', 'OTS_NDC', 'Organization for Tropical Studies - Neotropical Data Center',
        'urn:node:PANGAEA', 'PANGAEA', 'PANGAEA',
        'urn:node:ESS_DIVE', 'ESS_DIVE', 'ESS-DIVE: Deep Insight for Earth Science Data',
        'urn:node:CAS_CERN', 'CAS_CERN', 'Chinese Ecosystem Research Network (CERN)',
        'urn:node:FIGSHARE_CARY', 'FIGSHARE_CARY', 'Cary Institute of Ecosystem Studies (powered by Figshare)',
        'urn:node:IEDA_EARTHCHEM', 'IEDA_EARTHCHEM', 'IEDA EARTHCHEM',
        'urn:node:IEDA_USAP', 'IEDA_USAP', 'IEDA USAP',
        'urn:node:IEDA_MGDL', 'IEDA_MGDL', 'IEDA MGDL',
        'urn:node:METAGRIL', 'METAGRIL', 'metaGRIL',
        'urn:node:ARM', 'ARM', 'ARM - Atmospheric Radiation Measurement Research Facility',
        "urn:node:OPC", "OPC",
        "urn:node:TNC_DANGERMOND", "dangermond", "TNC_DANGERMOND"
      ],

      /** If true, then archived content is available in the search index.
      * Set to false if this MetacatUI is using a Metacat version before 2.10.0
      * @type {boolean}
      * @default true
      */
      archivedContentIsIndexed: true,

      /**
      * The default FilterGroups to use in the data catalog search (DataCatalogViewWithFilters)
      *   The DataCatalogViewWithFilters is only used in the EditCollectionView (when editing collections or portals), as of 2.9.0
      *   To change the default filters in the main data search view (DataCatalogView), edit the `defaultSearchFilters` attribute here.
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
              matchSubstring: false,
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
      * Semantic annotation configuration
      * Include your Bioportal api key to show ontology information for metadata annotations
      * see: http://bioportal.bioontology.org/account
      * @type {string}
      */
      bioportalAPIKey: "",
      /**
      * The Bioportal REST API URL, which is set dynamically only if a bioportalAPIKey is configured
      * @type {string}
      * @default "https://data.bioontology.org/search"
      */
      bioportalSearchUrl: "https://data.bioontology.org/search",
      /**
      * This attribute stores cache of ontology information that is looked up in Bioportal, so that duplicate REST calls don't need to be made.
      * @type {object}
      */
      bioportalLookupCache: {},
      /**
      * Set this option to true to display the annotation icon in search result rows when a dataset has an annotation
      * @type {boolean}
      */
      showAnnotationIndicator: false,

      /**
      * A list of unsupported User-Agent regular expressions for browsers that will not work well with MetacatUI.
      * A warning message will display on the page for anyone using one of these browsers.
      * @type {RegExp[]}
      * @since 2.10.0
      * @default [/(?:\b(MS)?IE\s+|\bTrident\/7\.0;.*\s+rv:)(\d+)/]
      * @example [/(?:\b(MS)?IE\s+|\bTrident\/7\.0;.*\s+rv:)(\d+)/]
      */
      unsupportedBrowsers: [/(?:\b(MS)?IE\s+|\bTrident\/7\.0;.*\s+rv:)(\d+)/],

      /**
      * The following configuration options are deprecated or experimental and should only be changed by advanced users
      */
      /**
      * The URL for the DataONE log service. This service has been replaced with the DataONE metrics service
      * (which has not been publicly released), so this configuration will be deprecated in the future.
      * This URL is constructed dynamically upon AppModel intialization.
      * @type {string}
      * @deprecated
      */
      d1LogServiceUrl: null
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
		}, MetacatUI.AppConfig),

    defaultView: "data",

    initialize: function() {

      //If no base URL is specified, then user the DataONE CN base URL
      if(!this.get("baseUrl")){
        this.set("baseUrl",   this.get("d1CNBaseUrl"));
        this.set("d1Service", this.get("d1CNService"));
      }


      //Remove a forward slash to the end of the base URL if there is one
      var baseUrl = this.get("baseUrl");
      if( baseUrl.charAt( baseUrl.length-1 ) == "/" ){
        baseUrl = baseUrl.substring(0, baseUrl.length-1);
        this.set("baseUrl", baseUrl);
      }

      //Make sure the Metacat context sttarts with a forward slash
      var context = this.get("context");
      if( context.length && context.charAt(0) != "/" ){
        context = "/" + context;
      }


      // these are pretty standard, but can be customized if needed
      this.set('viewServiceUrl',    baseUrl + context + this.get('d1Service') + '/views/metacatui/');
      this.set('publishServiceUrl', baseUrl + context + this.get('d1Service') + '/publish/');
      this.set('authServiceUrl',    baseUrl + context + this.get('d1Service') + '/isAuthorized/');
      this.set('queryServiceUrl',   baseUrl + context + this.get('d1Service') + '/query/solr/?');
      this.set('metaServiceUrl',    baseUrl + context + this.get('d1Service') + '/meta/');
      this.set('packageServiceUrl', baseUrl + context + this.get('d1Service') + '/packages/application%2Fbagit-097/');

      this.set('metacatServiceUrl', baseUrl + context + '/metacat');

      if( this.get("d1Service") && this.get("d1Service").indexOf("cn/v2") == -1 ){
        this.set('objectServiceUrl', baseUrl + context + this.get('d1Service') + '/object/');
      }

      if( this.get("enableMonitorStatus") ){
        this.set("monitorStatusUrl", baseUrl + context + this.get('d1Service') + "/monitor/status");
      }

      // Metadata quality report services
      this.set('mdqSuitesServiceUrl', this.get("mdqBaseUrl") + "/suites/");
      this.set('mdqRunsServiceUrl', this.get('mdqBaseUrl') + "/runs/");

      //DataONE CN API
      if(this.get("d1CNBaseUrl")){

        //Add a forward slash to the end of the base URL if there isn't one
        var d1CNBaseUrl = this.get("d1CNBaseUrl");
        if( d1CNBaseUrl.charAt( d1CNBaseUrl.length-1 ) == "/" ){
          d1CNBaseUrl = d1CNBaseUrl.substring(0, d1CNBaseUrl.length-1);
          this.set("d1CNBaseUrl", d1CNBaseUrl);
        }

        //Account services
        if(typeof this.get("accountsUrl") != "undefined"){
          this.set("accountsUrl", d1CNBaseUrl + this.get("d1CNService") + "/accounts/");

          if(typeof this.get("pendingMapsUrl") != "undefined")
            this.set("pendingMapsUrl", this.get("accountsUrl") + "pendingmap/");

          if(typeof this.get("accountsMapsUrl") != "undefined")
            this.set("accountsMapsUrl", this.get("accountsUrl") + "map/");

          if(typeof this.get("groupsUrl") != "undefined")
            this.set("groupsUrl", d1CNBaseUrl + this.get("d1CNService") + "/groups/");
        }

        if(typeof this.get("d1LogServiceUrl") != "undefined")
          this.set('d1LogServiceUrl', d1CNBaseUrl + this.get('d1CNService') + '/query/logsolr/?');

        this.set("nodeServiceUrl",    d1CNBaseUrl + this.get("d1CNService") + "/node/");
        this.set('resolveServiceUrl', d1CNBaseUrl + this.get('d1CNService') + '/resolve/');
        this.set("reserveServiceUrl", d1CNBaseUrl + this.get("d1CNService") + "/reserve");

        //Token URLs
        if(typeof this.get("tokenUrl") != "undefined"){
          this.set("tokenUrl", d1CNBaseUrl + "/portal/" + "token");

          this.set("checkTokenUrl", d1CNBaseUrl + this.get("d1CNService") + "/diag/subject");

          //The sign-in and out URLs - allow these to be turned off by removing them in the defaults above (hence the check for undefined)
          if(this.get("enableCILogonSignIn") || typeof this.get("signInUrl") !== "undefined")
            this.set("signInUrl", d1CNBaseUrl + "/portal/" + "startRequest?target=");
          if(typeof this.get("signInUrlOrcid") !== "undefined")
            this.set("signInUrlOrcid", d1CNBaseUrl + "/portal/" + "oauth?action=start&target=");

          if(this.get("enableLdapSignIn") && !this.get("signInUrlLdap")){
            this.set("signInUrlLdap", d1CNBaseUrl + "/portal/" + "ldap?target=");
          }


          if(this.get('orcidBaseUrl'))
            this.set('orcidSearchUrl', this.get('orcidBaseUrl') + '/v1.1/search/orcid-bio?q=');

          if((typeof this.get("signInUrl") !== "undefined") || (typeof this.get("signInUrlOrcid") !== "undefined"))
            this.set("signOutUrl", d1CNBaseUrl + "/portal/" + "logout");

        }

        // Object format list
        if ( typeof this.get("formatsUrl") != "undefined" ) {
             this.set("formatsServiceUrl",
               d1CNBaseUrl + this.get("d1CNService") + this.get("formatsUrl"));
        }

        //ORCID search
        if(typeof this.get("orcidBaseUrl") != "undefined")
          this.set('orcidSearchUrl', this.get('orcidBaseUrl') + '/search/orcid-bio?q=');

        //Annotator API
        if(typeof this.get("annotatorUrl") !== "undefined")
          this.set('annotatorUrl', d1CNBaseUrl + '/portal/annotator');
      }

      // Metadata quality report services
      this.set('mdqSuitesServiceUrl', this.get("mdqBaseUrl") + "/suites/");
      this.set('mdqRunsServiceUrl', this.get('mdqBaseUrl') + "/runs/");
      this.set('mdqScoresServiceUrl', this.get('mdqBaseUrl') + "/scores/");

      this.on("change:pid", this.changePid);

      //For backward-compatbility, set the theme and themeTitle variables using the
      // attributes set on this model, which are taken from the AppConfig
      MetacatUI.theme = this.get("theme");
      MetacatUI.themeTitle = this.get("repositoryName");

    },

    changePid: function(model, name){
      this.set("previousPid", model.previous("pid"));
    }
  });
  return AppModel;
});
