
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

  //Submissions
  contentIsModerated: false,
  displayDatasetEditButton: false,
  displayDatasetControls: false,
  enablePublishDOI: false,

  //Portals
  hideSummaryCitationsChart: false,
  hideSummaryDownloadsChart: false,
  hideSummaryMetadataAssessment: false,
  hideSummaryViewsChart: false,
  showMyPortals: false,
  enableCreatePortals: false
}, (MetacatUI.AppConfig || {}));

MetacatUI.themeMap =
{
	'*': {
		// example overrides are provided here
		'templates/navbar.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/navbar.html',
		'templates/footer.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/footer.html',
		'templates/about.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/about.html',
		'templates/dataSource.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/dataSource.html',
		'templates/login.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/login.html',
		'templates/noResults.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/noResults.html',
		'routers/router' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/routers/router.js'
		}
};

MetacatUI.customAppConfig = function(){

}
