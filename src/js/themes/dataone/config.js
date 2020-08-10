
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
  defaultAccessPolicy: [{
    subject: "CN=DataONE-Support,DC=dataone,DC=org",
    read: true,
    write: true,
    changePermission: true
  },
  {
    subject: "public",
    read: true
  }],
  hiddenSubjectsInAccessPolicy: ["CN=DataONE-Support,DC=dataone,DC=org"],

  //Portals
  hideSummaryCitationsChart: false,
  hideSummaryDownloadsChart: false,
  hideSummaryMetadataAssessment: false,
  hideSummaryViewsChart: false,
  enableCreatePortals: true,
  enableBookkeeperServices: true,
  dataonePlusPreviewMode: true,
  portalLimit: 5,
  portalInfoURL: "https://dataone.org/plus",
  portalDefaults: {
    sections: [
      { label: "About",
        title: "About our project"
      }
    ],
    newPortalActiveSectionLabel: "About",
    sectionImageIdentifiers: ["urn:uuid:2cf173b9-4d95-4832-b1c0-bcc6b467343a", "urn:uuid:5669b72e-1124-4afa-9b44-3ebd61801753", "urn:uuid:4514ef43-a0a3-4d21-a428-ba38ae706bad", "urn:uuid:241afa07-82a0-4522-abf5-e7614fc8dfb6", "urn:uuid:dbd8645e-9200-431e-8e46-350984730cc2"],
    primaryColor: "#16acc0",
    primaryColorTransparent: "rgba(22, 172, 192, .7)",
    secondaryColor: "#18556e",
    secondaryColorTransparent: "rgba(24, 85, 110, .7)",
    accentColor: "#EED268",
    accentColorTransparent: "rgba(238, 210, 104, .7)"
  },
  activeAlternateRepositoryId: "urn:node:mnUCSB1",
  defaultAlternateRepositoryId: "urn:node:mnUCSB1",
  alternateRepositories: [{
      name: "DataONE UCSB Dedicated Replica Server",
      identifier: "urn:node:mnUCSB1",
      baseURL: "https://mn-ucsb-1.dataone.org/knb/d1/mn"
   },
   {
       name: "NSF Arctic Data Center Repository",
       identifier: "urn:node:ARCTIC",
       baseURL: "https://arcticdata.io/metacat/d1/mn"
    },
    {
        name: "KNB",
        identifier: "urn:node:KNB",
        baseURL: "https://knb.ecoinformatics.org/knb/d1/mn"
     }],
  dataonePlusPreviewPortals: [{
    seriesId: "urn:uuid:a9fccce6-80f7-4937-b3dc-3cf76280d4f7",
    datasource: "urn:node:KNB",
    label: "SASAP"
  },
  {
    seriesId: "urn:uuid:d6d8fc1f-a4d9-4c44-8305-a8c0c35f387e",
    datasource: "urn:node:ARCTIC",
    label: "toolik"
  },
  {
    seriesId: "urn:uuid:8cdb22c6-cb33-4553-93ca-acb6f5d53ee4",
    datasource: "urn:node:ARCTIC",
    label: "dbo"
  },
  {
    seriesId: "urn:uuid:06a249da-f9c8-4946-8be4-ac80883bbd22",
    datasource: "urn:node:KNB",
    label: "ecoblender"
  }],

  //Dataset landing pages
  displayDatasetEditButton: false,
  displayDatasetControls: false,
  displayDatasetQualityMetric: true
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
