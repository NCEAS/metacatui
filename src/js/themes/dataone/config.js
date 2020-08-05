
// Set up App Configurations that are always used for the arctic theme.
// Deployment-specific configurations can be set in a separate file
MetacatUI.AppConfig = Object.assign({
  root: "/",
  title: "DataONE Data Catalog",
  theme: "dataone",
  baseUrl: "https://search.dataone.org",
  mapKey: "AIzaSyDuQ9r_7EeSfspKYs2SET7sv4c8FysLIk4",
  repositoryName: "DataONE Data Catalog",
  emailContact: "support@dataone.org",
  nodeId: "urn:node:CN",
  d1Service: "/cn/v2",
  metacatContext: "",
  enableMonitorStatus: false,
  enableCILogonSignIn: true,

  //Temp message
  temporaryMessageContainer: "#Navbar",

  //Searching
  displayRepoLogosInSearchResults: true,
  disableQueryPOSTs: true,
  enableSolrJoins: true,
  defaultSearchFilters: ["all", "attribute", "annotation", "documents", "dataSource", "creator", "dataYear", "pubYear", "id", "taxon", "spatial"],
  bioportalAPIKey: "",

  //Submissions
  contentIsModerated: false,
  displayDatasetEditButton: false,
  displayDatasetControls: false,
  enablePublishDOI: false,
  allowChangeRightsHolder: false,

  //Portals
  hideSummaryCitationsChart: false,
  hideSummaryDownloadsChart: false,
  hideSummaryMetadataAssessment: false,
  hideSummaryViewsChart: false,
  enableCreatePortals: true,
  enableBookkeeperServices: true,
  portalInfoURL: "https://dataone.org/plus",
  portalDefaultColors: {
    primaryColor: "#16acc0",
    primaryColorTransparent: "rgba(22, 172, 192, .7)",
    secondaryColor: "#18556e",
    secondaryColorTransparent: "rgba(24, 85, 110, .7)",
    accentColor: "#EED268",
    accentColorTransparent: "rgba(238, 210, 104, .7)"
  },

  //Dataset landing pages
  displayDatasetEditButton: false,
  displayDatasetControls: false,
  displayDatasetQualityMetric: false
}, (MetacatUI.AppConfig || {}));

MetacatUI.themeMap =
{
	'*': {
    // Routers
    "routers/BaseRouter" : MetacatUI.root + "/js/routers/router.js",
    "routers/router" : MetacatUI.root + "/js/themes/" + MetacatUI.theme + "/routers/router.js",
		// example overrides are provided here
		'templates/appHead.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/appHead.html',
    'templates/app.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/app.html',
		'templates/navbar.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/components/d1website/navbar.html',
		'templates/footer.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/components/d1website/footer.html',
		'templates/about.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/about.html',
		'templates/login.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/login.html',
		'templates/noResults.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/noResults.html',
		'routers/router' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/routers/router.js'
		}
};

MetacatUI.customAppConfig = function(){

}
