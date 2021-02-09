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
  * @classcategory Models
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
      * If true, this MetacatUI instance is pointing to a CN rather than a MN.
      * This attribute is set during the AppModel initialization, based on the other configured attributes.
      * @readonly
      * @type {boolean}
      */
      isCN: false,

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
      * If true, the temporary message will include a "Need help? Email us at..." email link
      * at the end of the message. The email address will be set to {@link AppConfig#emailContact}
      * @type {boolean}
      * @default true
      * @since 2.13.3
      */
      temporaryMessageIncludeEmail: true,

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
      * The text of the Save button in the dataset editor.
      * @type {string}
      * @default "Save dataset"
      * @since 2.13.3
      */
      editorSaveButtonText: "Save dataset",

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
      * @default "https://cn.dataone.org"
      * @example "https://cn-stage.test.dataone.org"
      */
      d1CNBaseUrl: "https://cn.dataone.org",
      /**
      * The URL fragment for the DataONE Coordinating Node (CN) API.
      * @type {string}
      * @default '/cn/v2'
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
      * If true, users will see a page with sign-in troubleshooting tips
      * @type {boolean}
      * @default true
      * @since 2.13.3
      */
      showSignInHelp: true,
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
      * @default ["FAIR-suite-0.3.1"]
      */
      mdqSuiteIds: ["FAIR-suite-0.3.1"],
      /**
      * Metadata Assessment Suite labels for the dataset assessment reports
      * @type {string[]}
      * @default ["FAIR Suite v0.3.1"]
      */
      mdqSuiteLabels: ["FAIR Suite v0.3.1"],
      /**
      * Metadata Assessment Suite IDs for the aggregated assessment charts
      * @type {string[]}
      * @default ["FAIR-suite-0.3.1"]
      */
      mdqAggregatedSuiteIds: ["FAIR-suite-0.3.1"],
      /**
      * Metadata Assessment Suite labels for the aggregated assessment charts
      * @type {string[]}
      * @default ["FAIR Suite v0.3.1"]
      */
      mdqAggregatedSuiteLabels: ["FAIR Suite v0.3.1"],
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
      * Forwards collection Query to Metrics Service if enabled
      * @type {boolean}
      * @default true
      */
      metricsForwardCollectionQuery: true,

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
      * If true, displays the citation registration tool on the dataset landing page
      * @type {boolean}
      * @default true
      * @since 2.14.1
      */
      displayRegisterCitationTool: true,
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
      * The hue/color of the tiles drawn on the map when searching for data.
      * This should be a three-digit hue degree between 0 and 360. (Try https://hslpicker.com)
      * This is set on the {@link Map} model when it is initialized.
      * @type {string}
      * @default "192" (blue)
      * @since 2.13.3
      */
      searchMapTileHue: "192",

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
      * A URL of a webpage for people to learn more about portals. If no URL is provided,
      * links to more info about portals will be omitted.
      * @since 2.14.0
      * @type {string}
      * @example "https://dataone.org/plus"
      * @default null
      */
      portalInfoURL: null,
      /**
      * Set to false to prevent ANYONE from creating a new portal.
      * @type {boolean}
      * @default true
      */
      enableCreatePortals: true,
      /**
      * Limits only the following people or groups to create new portals. If this is left as an empty array,
      * then any logged-in user can create a portal.
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
        "urn:node:CA_OPC", "CA_OPC", "OPC",
        "urn:node:TNC_DANGERMOND", "dangermond", "TNC_DANGERMOND", "dangermondpreserve"
      ],

      /**
      * Limit users to a certain number of portals. This limit will be ignored if {@link AppConfig#enableBookkeeperServices}
      * is set to true, because the limit will be enforced by Bookkeeper Quotas instead.
      * @type {number}
      * @default 100
      * @since 2.14.0
      */
      portalLimit: 100,

      /**
      * The default values to use in portals. Default sections are applied when a portal is new.
      * Default images are used in new freeform pages in the portal builder.
      * The default colors are used when colors haven't been saved to the portal document.
      * Colors can be hex codes, rgb codes, or any other form supported by browsers in CSS
      * @type {object}
      * @property {object[]} sections The default sections for a new portal. Each object within the section array can have a title property and a label property
      * @property {string} label The name of the section that will appear in the tab
      * @property {string} title A longer title for the section that will appear in the section header
      * @property {string} newPortalActiveSectionLabel When a user start the portal builder for a brand new portal, the label for the section that the builder should start on. Can be set to "Data", "Metrics", "Settings", or one of the labels from the default sections described above.
      * @property {string[]} sectionImageIdentifiers A list of image pids to use as default images for new markdown sections
      * @property {string} primaryColor The color that is used most frequently in the portal view
      * @property {string} secondaryColor The color that is used second-most frequently in the portal view
      * @property {string} accentColor The color that is rarely used in portal views as an accent color
      * @property {string} primaryColorTransparent An rgba() version of the primaryColor that is semi-transparent
      * @property {string} secondaryColorTransparent An rgba() version of the secondaryColor that is semi-transparent
      * @property {string} accentColorTransparent An rgba() version of the accentColor that is semi-transparent
      * @example {
      *   sections: [
      *     { label: "About",
      *       title: "About our project"
      *     },
      *     { label: "Publications",
      *       title: "Selected publications by our lab group"
      *     }
      *   ],
      *   newPortalActiveSectionLabel: "About",
      *   sectionImageIdentifiers: ["urn:uuid:d2f31a83-debf-4d78-bef7-6abe20962581", "urn:uuid:6ad37acd-d0ac-4142-9f42-e5f05ff55564", "urn:uuid:0b6be09f-2e6f-4e7b-a83c-2823495f9608", "urn:uuid:5b4e0347-07ed-4580-b039-6c4df57ed801", "urn:uuid:0cf62da9-a099-440e-9c1e-595a55c0d60d"],
      *   primaryColor: "#16acc0",
      *   primaryColorTransparent: "rgba(22, 172, 192, .7)",
      *   secondaryColor: "#EED268",
      *   secondaryColorTransparent: "rgba(238, 210, 104, .7)",
      *   accentColor: "#0f5058",
      *   accentColorTransparent: "rgba(15, 80, 88, .7)"
      *  }
      * @since 2.14.0
      */
      portalDefaults: {
      },

      /**
      * Enable or disable the use of Fluid Earth Viewer visualizations in portals.
      * This config option is marked as `private` since this is an experimental feature.
      * @type {boolean}
      * @private
      * @since 2.13.4
      */
      enableFeverVisualizations: false,
      /**
      * The relative path to the location where the Fluid Earth Viewer (FEVer) is deployed. This should be
      * deployed at the same origin as MetacatUI, since your web server configuration and many browsers
      * may block iframes from different origins.
      * This config option is marked as `private` since this is an experimental feature.
      * @type {string}
      * @private
      * @since 2.13.4
      */
      feverPath: "/fever",
      /**
      * The full URL to the location where the Fluid Earth Viewer (FEVer) is deployed.
      * This URL is constructed during {@link AppModel#initialize} using the {@link AppConfig#baseUrl}
      * and {@link AppConfig#feverPath}.
      * This config option is marked as `private` since this is an experimental feature.
      * @type {string}
      * @readonly
      * @private
      * @since 2.13.4
      */
      feverUrl: "",

      /** If true, then archived content is available in the search index.
      * Set to false if this MetacatUI is using a Metacat version before 2.10.0
      * @type {boolean}
      * @default true
      */
      archivedContentIsIndexed: true,

      /**
       * The metadata fields to hide when a user is creating a collection
       * definition using the query builder displayed in the portal builder on
       * the data page, or anywhere else the EditCollectionView is displayed.
       * Strings listed here should exactly match the 'name' for
       * each field provided by the DataONE search index API (i.e. should match
       * the Solr field).
       * @example ["sem_annotated_by", "mediaType"]
       * @type {string[]}
       */
      collectionQueryExcludeFields: [
        "sem_annotated_by", "sem_annotates", "sem_comment", "pubDate",
        "namedLocation", "contactOrganization", "investigator", "originator",
        "originatorText", "serviceInput",
        "authorGivenName", "authorSurName", "topic", "webUrl", "_root_",
        "collectionQuery", "geohash_1", "geohash_2", "geohash_3", "geohash_4",
        "geohash_5", "geohash_6", "geohash_7", "geohash_8", "geohash_9", "label",
        "LTERSite", "_version_", "checksumAlgorithm", "keywords",
        "parameterText", "project", "topicText", "dataUrl", "fileID",
        "isDocumentedBy", "logo", "obsoletes", "origin", "funding", "formatType",
        "obsoletedBy", "presentationCat", "mediaType", "mediaTypeProperty",
        "relatedOrganizations", "noBoundingBox", "decade", "hasPart", "sensorText",
        "sourceText", "termText", "titlestr", "site", "id", "updateDate",
        "edition", "gcmdKeyword", "isSpatial", "keyConcept", "ogcUrl", "parameter",
        "sensor", "source", "term", "investigatorText", "sku", "_text_",
        // Fields that have been made into a special combination field
        "beginDate", "endDate",
        // Provenance fields (keep only "prov_hasSources" and "prov_hasDerivations"),
        // since they are the only ones indexed on metadata objects
        "prov_wasGeneratedBy", "prov_generated", "prov_generatedByExecution",
        "prov_generatedByProgram", "prov_generatedByUser", "prov_instanceOfClass",
        "prov_used", "prov_usedByExecution", "prov_usedByProgram", "prov_usedByUser",
        "prov_wasDerivedFrom", "prov_wasExecutedByExecution", "prov_wasExecutedByUser",
        "prov_wasInformedBy"
      ],

      /**
       * A special field is one that does not exist in the query service index (i.e.
       * Solr). It can be a combination of fields that are presented to the user as a
       * single field, but which are added to the model as multiple fields. It can also be
       * a duplicate of a field that does exist, but presented with a different label (and
       * even with different {@link operatorOptions operator options} or
       * {@link valueSelectUImap value input} if needed).
       *
       * @typedef {Object} SpecialField
       * @property {string} name - A unique ID to represent this field. It must not match
       * the name of any other query fields.
       * @property {string[]} fields - The list of real query fields that this abstracted
       * field should represent. The query fields listed must exactly match the names of
       * the query fields that are retrieved from the query service.
       * @property {string} label - A user-facing label to display.
       * @property {string} description - A description for this field.
       * @property {string} category - The name of the category under which to place this
       * field. It must match one of the category names for an existing query field set in
       * {@link QueryField#categoriesMap}.
       * @property {string[]} [values] - An optional list of filter values. If set, this
       * is used to determine whether a pre-existing query rule should be displayed as one
       * of these special fields, or as a field from the query API. Setting values means
       * that the values set on the query rule model must exactly match the values set.
       *
       * @since 2.15.0
       */

      /**
       * A list of additional fields which are not retrieved from the query API (i.e. are
       * not Solr fields), but which should be added to the list of options the user can
       * select from when building a query in the EditCollectionView. This can be used to
       * add abstracted fields which are a combination of multiple query fields, or to add
       * a duplicate field that has a different label.
       *
       * @type {SpecialField[]}
       *
       * @since 2.15.0
       */
      collectionQuerySpecialFields: [
        {
          name: "documents-special-field",
          fields: ["documents"],
          label: "Contains Data Files",
          description: "Limit results to packages that include data files. Without" +
            " this rule, results may include packages with metadata but no data.",
          category: "General",
          values: ["*"]
        },
        {
          name: "year-data-collection",
          fields: ["beginDate", "endDate"],
          label: "Year of Data Collection",
          description: "The temporal range of content described by the metadata",
          category: "Dates"
        }
      ],

      /**
       * The names of the query fields that use an object identifier as a value. Filter
       * models that use one of these fields are handled specially when building query
       * strings - they are OR'ed at the end of queries. They are also given an "OR"
       * operator and fieldsOperator attribute when parsed.
       * @type {string[]}
       * 
       * @since 2.15.0
       */
      queryIdentifierFields: ["id", "identifier", "seriesId", "isPartOf"],

      /**
       * The isPartOf filter is added to all new portals built in the Portal
       * Builder automatically. It is required for dataset owners to include
       * their dataset in a specific portal collection. By default, this filter
       * is hidden. Set to false to make this filter visible.
       * @type {boolean}
       */
      hideIsPartOfFilter: true,

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
              fields: ["identifier", "documents", "resourceMap", "seriesId"],
              label: "Identifier",
              placeholder: "DOI or ID",
              icon: "bullseye",
              description: "Find datasets if you have all or part of its DOI or ID",
              operator: "OR",
              fieldsOperator: "OR"
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
      * A list of alternate repositories to use for fetching and saving DataONEObjects.
      * In the AppConfig, this is an array of {@link NodeModel#members} attributes, in JSON form.
      * These are the same attributes retireved from the Node Info document, via the d1/mn/v2/node API.
      * The only required attributes are name, identifier, and baseURL.
      * @type {object[]}
      * @example [{
      *    name: "Metacat MN",
      *    identifier: "urn:node:METACAT",
      *    baseURL: "https://my-metacat.org/metacat/d1/mn"
      *  }]
      *
      * @since 2.14.0
      */
      alternateRepositories: [],

      /**
      * The node identifier of the alternate repository that is used for fetching and saving DataONEObjects.
      * this attribute is dynamically set by MetacatUI to keep track of the currently active alt repo.
      * To specify a repository that should be active by default, set {@link AppConfig#defaultAlternateRepositoryId}
      * @type {string}
      * @example "urn:node:METACAT"
      * @since 2.14.0
      * @readonly
      */
      activeAlternateRepositoryId: null,

      /**
      * The node identifier of the alternate repository that should be used for fetching and saving DataONEObjects.
      * Since there can be multiple alternate repositories configured, this attribute can be used to specify which
      * one is actively in use.
      * @type {string}
      * @example "urn:node:METACAT"
      * @since 2.14.0
      */
      defaultAlternateRepositoryId: null,

      /**
      * Enable or disable the DataONE Bookkeeper services. If enabled, Portal Views will use the DataONE Plus
      * paid features for active subscriptions. If disabled, the Portal Views will assume
      * all portals are in inactive/free, and will only render free features.
      * @type {boolean}
      * @since 2.14.0
      */
      enableBookkeeperServices: false,
      /**
      * The base URL for the DataONE Bookkeeper services, which manage the DataONE membership plans, such as
      * Hosted Repositories and Plus.
      * See https://github.com/DataONEorg/bookkeeper for more info on this service.
      * @type {string}
      * @since 2.14.0
      */
      bookkeeperBaseUrl: "https://api.test.dataone.org:30443/bookkeeper/v1",
      /**
      * The URL for the DataONE Bookkeeper Quota API, e.g. listQuotas(), getQuota(), createQuota(), etc.
      * This full URL is contructed using {@link AppModel#bookkeeperBaseUrl} when the AppModel is initialized.
      * @readonly
      * @type {string}
      * @since 2.14.0
      */
      bookkeeperQuotasUrl: null,
      /**
      * The URL for the DataONE Bookkeeper Usages API, e.g. listUsages(), getUsage(), createUsage(), etc.
      * This full URL is contructed using {@link AppModel#bookkeeperBaseUrl} when the AppModel is initialized.
      * @readonly
      * @type {string}
      * @since 2.14.0
      */
      bookkeeperUsagesUrl: null,
      /**
      * The URL for the DataONE Bookkeeper Subscriptions API, e.g. listSubscriptions(), fetchSubscription(), createSubscription(), etc.
      * This full URL is contructed using {@link AppModel#bookkeeperBaseUrl} when the AppModel is initialized.
      * @readonly
      * @type {string}
      * @since 2.14.0
      */
      bookkeeperSubscriptionsUrl: null,
      /**
      * The URL for the DataONE Bookkeeper Customers API, e.g. listCustomers(), getCustomer(), createCustomer(), etc.
      * This full URL is contructed using {@link AppModel#bookkeeperBaseUrl} when the AppModel is initialized.
      * @readonly
      * @type {string}
      * @since 2.14.0
      */
      bookkeeperCustomersUrl: null,

      /**
      * The name of the DataONE Plus membership plan, which is used in messaging throughout the UI.
      * This is only used if the enableBookkeeperServices setting is set to true.
      * @type {string}
      * @default "DataONE Plus"
      */
      dataonePlusName: "DataONE Plus",

      //These two DataONE Plus Preview attributes are for a special DataONE Plus tag of MetacatUI
      // and won't be released in an offical MetacatUI version, since they will be replaced by bookkeeper
      dataonePlusPreviewMode: false,
      dataonePlusPreviewPortals: [],
      /*
      * List of Repositories that are DataONE Hosted Repos.
      * DataONE Hosted Repo features are displayed only for these members.
      * @type {string[]}
      * @readonly
      * @since 2.13.0
      * ------------------------------------
      * This config will not be displayed in the JSDoc documentation since it is
      * temporary and only useful for internal DataONE purposes. This functionality will be replaced
      * with the DataONE Bookkeeper service, eventually.
      */
      dataoneHostedRepos: ["urn:node:KNB", "urn:node:ARCTIC", "urn:node:CA_OPC", "urn:node:TNC_DANGERMOND", "urn:node:ESS_DIVE"],

      /**
      * The length of random portal label generated during preview/trial mode of DataONE Plus
      * @readonly
      * @type {number}
      * @default 7
      * @since 2.14.0
      */
      randomLabelNumericLength: 7,

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

      //Set the DataONE MN API URLs
      this.set( this.getDataONEMNAPIs() );

      //Determine if this instance of MetacatUI is pointing to a CN, rather than a MN
      this.set("isCN", (this.get("d1Service").indexOf("cn/v2") > 0));

      this.set('metacatServiceUrl', this.get('baseUrl') + this.get('context') + '/metacat');

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

      //Construct the DataONE Bookkeeper service API URLs
      if( this.get("enableBookkeeperServices") ){
        this.set("bookkeeperSubscriptionsUrl", this.get("bookkeeperBaseUrl")  + "/subscriptions");
        this.set("bookkeeperCustomersUrl",     this.get("bookkeeperBaseUrl")  + "/customers");
        this.set("bookkeeperQuotasUrl",        this.get("bookkeeperBaseUrl")  + "/quotas");
        this.set("bookkeeperUsagesUrl",        this.get("bookkeeperBaseUrl")  + "/usages");
      }

      //Construct the Fluid Earth Fever URL
      if( this.get("enableFeverVisualizations") && this.get("feverPath") && !this.get("feverUrl") ){
        this.set("feverUrl", this.get("baseUrl") + this.get("feverPath"));
      }

      this.on("change:pid", this.changePid);

      //For backward-compatbility, set the theme and themeTitle variables using the
      // attributes set on this model, which are taken from the AppConfig
      MetacatUI.theme = this.get("theme");
      MetacatUI.themeTitle = this.get("repositoryName");

      //Set up the alternative repositories
      _.map(this.get("alternateRepositories"), function(repo){
        repo = _.extend(repo, this.getDataONEMNAPIs(repo.baseURL));
      }, this);

    },

    /**
    * Constructs the DataONE API URLs for the given baseUrl
    * @param {string} [baseUrl] - The baseUrl to use in the URLs. If not specified, it uses the AppModel attributes.
    * @returns {object}
    */
    getDataONEMNAPIs: function(baseUrl){

      var urls = {};

      //Get the baseUrl from this model if one isn't given
      if( typeof baseUrl == "undefined" ){
        var baseUrl = this.get("baseUrl");
      }

      //Remove a forward slash to the end of the base URL if there is one
      if( baseUrl.charAt( baseUrl.length-1 ) == "/" ){
        baseUrl = baseUrl.substring(0, baseUrl.length-1);
      }

      //If the baseUrl doesn't have the full DataONE MN API structure, then construct it
      if( baseUrl.indexOf("/d1/mn") == -1 ){

        //Get the Dataone API fragment, which is either "/d1/mn/v2" or "/cn/v2"
        var d1Service = this.get('d1Service');
        if( typeof d1Service != "string" || !d1Service.length ){
          d1Service = "/d1/mn/v2";
        }
        else if( d1Service.charAt(0) != "/" ){
          d1Service = "/" + d1Service;
        }

        //Get the Metacat context, and make sure it starts with a forward slash
        var context = this.get("context");
        if( typeof context != "string" || !context.length ){
          context = "";
        }
        else if( context.charAt(0) != "/" ){
          context = "/" + context;
        }

        //Construct the base URL
        baseUrl = baseUrl + context + d1Service;
      }
      //Otherwise, just make sure the API version is appended to the base URL
      else if( baseUrl.substring( baseUrl.length-3 ) != "/v2" ){
        d1Service = "/d1/mn";
        baseUrl = baseUrl + "/v2";
      }

      // these are pretty standard, but can be customized if needed
      urls.viewServiceUrl    = baseUrl + '/views/metacatui/';
      urls.publishServiceUrl = baseUrl + '/publish/';
      urls.authServiceUrl    = baseUrl + '/isAuthorized/';
      urls.queryServiceUrl   = baseUrl + '/query/solr/?';
      urls.metaServiceUrl    = baseUrl + '/meta/';
      urls.packageServiceUrl = baseUrl + '/packages/application%2Fbagit-097/';

      if( d1Service.indexOf("mn") > 0 ){
        urls.objectServiceUrl = baseUrl + '/object/';
      }

      if( this.get("enableMonitorStatus") ){
        urls.monitorStatusUrl = baseUrl + "/monitor/status";
      }

      return urls;

    },

    changePid: function(model, name){
      this.set("previousPid", model.previous("pid"));
    },

    /**
    * Gets the currently-active alternative repository that is configured in this AppModel.
    * @returns {object}
    */
    getActiveAltRepo: function(){
      //Get the alternative repositories to use for uploading objects
      var altRepos = this.get("alternateRepositories"),
          activeAltRepo;

      //Get the active alt repo
      if( altRepos.length && this.get("activeAlternateRepositoryId") ){
        activeAltRepo = _.findWhere(altRepos, {identifier: this.get("activeAlternateRepositoryId") });

        return activeAltRepo || null;
      }
      else{
        return null;
      }
    },

    /**
    * Gets the default alternate repository and sets it as the active alternate repository.
    * If a default alt repo ({@link AppConfig#defaultAlternateRepositoryId}) isn't configured,
    * the first alt repo in the {@link AppConfig#alternateRepositories} list is used.
    * @fires AppModel#change:activeAlternateRepositoryId
    */
    setActiveAltRepo: function(){
      //Get the alternative repositories to use for uploading objects
      var altRepos = this.get("alternateRepositories"),
          defaultAltRepo;

      if( !altRepos.length ){
        return;
      }

      //If a default alt repo is configured, set that as the active alt repo
      if( this.get("defaultAlternateRepositoryId") ){
        defaultAltRepo = _.findWhere(altRepos, {identifier: this.get("defaultAlternateRepositoryId") });
        if( defaultAltRepo ){
          this.set("activeAlternateRepositoryId", defaultAltRepo.identifier);
        }
      }

      //Otherwise, use the first alt repo in the list
      if( !defaultAltRepo ){
        this.set("activeAlternateRepositoryId", altRepos[0].identifier);
      }
    }
  });
  return AppModel;
});
