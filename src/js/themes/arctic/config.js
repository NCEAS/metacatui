if( !MetacatUI.AppConfig ){
  MetacatUI.AppConfig = {};
}
// Set up App Configurations that are always used for the arctic theme.
// Deployment-specific configurations can be set in a separate file
MetacatUI.AppConfig = Object.assign({
  root: "/catalog",
  theme: "arctic",
  baseUrl: "https://arcticdata.io",
  bioportalAPIKey: "",
  repositoryName: "Arctic Data Center",
  emailContact: "support@arcticdata.io",
  nodeId: "urn:node:ARCTIC",

  //Metadata quality
  mdqSuiteIds: ["arctic.data.center.suite.1"],
  mdqSuiteLabels: ["Arctic Data Center Conformance Suite v1.0"],
  mdqFormatIds:["eml*", "https://eml*"],
  displayDatasetQualityMetric: true,

  //Portals
  hideSummaryCitationsChart: false,
  hideSummaryDownloadsChart: false,
  hideSummaryViewsChart: false,
  hideSummaryMetadataAssessment: false,
  enableFeverVisualizations: true,
  portalInfoURL: "https://arcticdata.io/data-portals/",
  portalLimit: 999,

  //Editor
  useNSFAwardAPI: true,
  defaultAccessPolicy: [{
    subject: "CN=arctic-data-admins,DC=dataone,DC=org",
    read: true,
    write: true,
    changePermission: true
  }],
  enablePublishDOI: false,
  hiddenSubjectsInAccessPolicy: ["CN=arctic-data-admins,DC=dataone,DC=org"],
  showDatasetPublicToggleForSubjects: ["CN=arctic-data-admins,DC=dataone,DC=org"],
  editorSaveErrorMsgWithDraft: "Not all of your changes could be submitted " +
    "due to a technical error. But, we sent a draft of your edits to " +
    "our support team, who will contact " +
    "you via email as soon as possible about getting your data package submitted. ",
  emlEditorRequiredFields: {
    abstract: true,
    alternateIdentifier: false,
    dataSensitivity: true,
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
  allowChangeRightsHolder: false,
  enableMeasurementTypeView: true,
  dataSensitivityInfoURL: "/sensitive-data-guidelines",
  customEMLMethods: [{
    titleOptions: ["Ethical Research Practices"],
    id: "ethicalResearchPractices",
    required: true
  }],

  //Searching
  enableSolrJoins: true,
  mapKey: "AIzaSyCYoTkUEpMAiOoWx5M61ButwgNGX8fIHUs",
  searchMapTileHue: "231",
  defaultSearchFilters: ["all", "attribute", "annotation", "creator", "dataYear", "pubYear", "id", "taxon", "spatial"],

  //Temp message
  temporaryMessage: "",
  temporaryMessageStartTime: null,
  temporaryMessageEndTime: new Date("2020-06-16T13:30:00"),
  temporaryMessageClasses: "warning",
  temporaryMessageContainer: "#Navbar",

  //MetadataView
  datasetMapFillColor: "",

  //Google Analytics
  googleAnalyticsKey: "UA-75482301-1"

}, (MetacatUI.AppConfig || {}));

MetacatUI.themeMap =
{
	'*': {
		// Templates include extension
		'templates/navbar.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/navbar.html',
		'templates/featuredData.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/featuredData.html',
		'templates/footer.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/footer.html',
		'templates/mainContent.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/mainContent.html',
		'templates/altHeader.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/altHeader.html',
		'templates/defaultHeader.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/defaultHeader.html',
		'templates/userProfileMenu.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/userProfileMenu.html',
		'templates/noResults.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/noResults.html',
		'templates/loginButtons.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/loginButtons.html',
		'templates/metadata.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/metadata.html',
		'templates/insertProgress.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/insertProgress.html',
    'templates/editorSubmitMessage.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/editorSubmitMessage.html',
		'models/Map' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/models/Map.js',
		'routers/router' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/routers/router.js'
		}
};
