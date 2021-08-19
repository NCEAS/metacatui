if( !MetacatUI.AppConfig ){
  MetacatUI.AppConfig = {};
}
// Set up App Configurations that are always used for the arctic theme.
// Deployment-specific configurations can be set in a separate file
MetacatUI.AppConfig = Object.assign({
  root: "/",
  theme: "knb",
  title: "KNB",
  baseUrl: "https://knb.ecoinformatics.org",
  metacatContext: "knb",
  mapKey: "AIzaSyCFcgRnv0TwBEdAnTsG5rBbD6Hprrv_Yic",
  googleAnalyticsKey: "UA-1588494-14",
  repositoryName: "KNB",
  nodeId: "urn:node:KNB",
  enableLdapSignIn: true,

  //Editor
  emlEditorRequiredFields: {
    abstract: true,
    alternateIdentifier: false,
    funding: false,
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
  defaultAccessPolicy: [{
    subject: "CN=knb-data-admins,DC=dataone,DC=org",
    read: true,
    write: true,
    changePermission: true
    },
    {
      subject: "public",
      read: true
    }],
  hiddenSubjectsInAccessPolicy: ["CN=knb-data-admins,DC=dataone,DC=org"],
  showDatasetPublicToggleForSubjects: ["CN=knb-data-admins,DC=dataone,DC=org"],
  allowChangeRightsHolder: false,

  //Searching
  disableQueryPOSTs: false,
  enableSolrJoins: true,
  displayRepoLogosInSearchResults: true,

  //Temp message
  temporaryMessage: "",
  temporaryMessageClasses: "warning auto-height-member",
  temporaryMessageContainer: "#HeaderContainer",
  temporaryMessageEndTime: new Date("2020-06-16T13:30:00"),

  //Metadata assessments
  displayDatasetQualityMetric: true,
  mdqSuiteIds: ["knb.suite.1"],
  mdqSuiteLabels: ["KNB Metadata Completeness Suite v1.0"],
  mdqFormatIds:["eml*", "https://eml*"],

  //Portals
  hideSummaryCitationsChart: false,
  hideSummaryDownloadsChart: false,
  hideSummaryViewsChart: false,
  hideSummaryMetadataAssessment: false,
  limitPortalsToSubjects: ["CN=knb-data-admins,DC=dataone,DC=org"],
  portalEditNotAuthCreateMessage: "Creating new portals is a feature currently only available to a select group of Beta testers. You should still be able to access your existing portals. Please contact us with any questions at the email address below."
}, MetacatUI.AppConfig);

MetacatUI.themeMap =
{
    '*': {
        // Template overrides are provided here

        // Resources (js) omit extension in keys
        'views/BaseTextView' : MetacatUI.root + '/js/views/TextView.js',
        'views/TextView' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/views/TextView.js',
        'routers/BaseRouter' : MetacatUI.root + '/js/routers/router.js',
        'routers/router' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/routers/router.js',

        // Templates include extension
        'templates/app.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/app.html',
        'templates/jsonld.txt' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/jsonld.txt',
        'templates/navbar.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/navbar.html',
        'templates/featuredData.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/featuredData.html',
        'templates/footer.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/footer.html',
        'templates/mainContent.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/mainContent.html',
        'templates/altHeader.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/altHeader.html',
        'templates/defaultHeader.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/defaultHeader.html',
        'templates/about.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/about.html',
        'templates/preservation.html' : MetacatUI.root + '/js/themes/' + MetacatUI.theme + '/templates/preservation.html'
    }
};
