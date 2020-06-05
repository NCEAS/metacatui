if( !MetacatUI.AppConfig ){
  MetacatUI.AppConfig = {};
}
// Set up App Configurations that are always used for the arctic theme.
// Deployment-specific configurations can be set in a separate file
MetacatUI.AppConfig = Object.assign({
  title: "DataONE Data Catalog",
  theme: "dataone",
  repositoryName: "DataONE Data Catalog",
  emailContact: "support@dataone.org",
  nodeId: "urn:node:CN",
  d1Service: "/cn/v2",
  metacatContext: "",
  temporaryMessageContainer: "#Navbar",
  displayRepoLogosInSearchResults: true,
  contentIsModerated: false,
  enableMonitorStatus: false,
  disableQueryPOSTs: true,
  enableSolrJoins: true,
  enableCILogonSignIn: true,
  hideSummaryCitationsChart: false,
  hideSummaryDownloadsChart: false,
  hideSummaryMetadataAssessment: false,
  hideSummaryViewsChart: false,
  displayDatasetEditButton: false,
  displayDatasetControls: false,
  enablePublishDOI: false,
  showMyPortals: false,
  enableCreatePortals: false
}, MetacatUI.AppConfig);

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
		//'models/AppModel' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/models/AppModel.js',
		'routers/router' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/routers/router.js'
		}
};

MetacatUI.customAppConfig = function(){

}
