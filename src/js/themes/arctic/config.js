
// Set up App Configurations that are always used for the arctic theme.
// Deployment-specific configurations can be set in a separate file
MetacatUI.AppConfig = Object.assign({
  root: "/catalog",
  theme: "arctic",
  baseUrl: "https://arcticdata.io",
  bioportalAPIKey: "",
  repositoryName: "Arctic Data Center",
  emailContact: "support@arcticdata.io",

  //Metadata quality
  mdqSuiteIds: ["arctic.data.center.suite.1"],
  mdqSuiteLabels: ["Arctic Data Center Conformance Suite v1.0"],
  mdqFormatIds:["eml*", "https://eml*"],
  displayDatasetQualityMetric: true,

  //Portals
  hideSummaryCitationsChart: false,
  hideSummaryDownloadsChart: false,
  hideSummaryViewsChart: false,
  portalInfoURL: "https://arcticdata.io/data-portals/",

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
  editorSaveErrorMsgWithDraft: "Not all of your changes could be submitted " +
    "due to a technical error. But, we sent a draft of your edits to " +
    "our support team, who will contact " +
    "you via email as soon as possible about getting your data package submitted. ",
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
  allowChangeRightsHolder: false,

  //Searching
  enableSolrJoins: true,
  mapKey: "AIzaSyCYoTkUEpMAiOoWx5M61ButwgNGX8fIHUs",
  defaultSearchFilters: ["all", "attribute", "annotation", "creator", "dataYear", "pubYear", "id", "taxon", "spatial"],

  //Temp message
  temporaryMessage: "The Arctic Data Center will be unavailable between 11 p.m. PT on Monday, June 15 and 6:30 a.m. PT on Tuesday, June 16 due to upgrades. We apologize for the inconvenience.",
  temporaryMessageStartTime: null,
  temporaryMessageEndTime: new Date("2020-06-16T13:30:00"),
  temporaryMessageClasses: "warning",
  temporaryMessageContainer: "#Navbar",

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

MetacatUI.customMapModelOptions = {
	tileHue: "231"
}

MetacatUI.customAppConfig = function(){
	//Gmaps key: AIzaSyCYoTkUEpMAiOoWx5M61ButwgNGX8fIHUs

	if(MetacatUI.appModel.get("baseUrl").indexOf("arcticdata.io") > -1 &&
	   MetacatUI.appModel.get("baseUrl").indexOf("test") == -1 &&
	   MetacatUI.appModel.get("baseUrl").indexOf("demo") == -1){

		MetacatUI.appModel.set("nodeId", "urn:node:ARCTIC");
		MetacatUI.appModel.set("googleAnalyticsKey", "UA-75482301-1");

	}
}
