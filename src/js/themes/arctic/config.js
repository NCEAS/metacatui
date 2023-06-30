if (!MetacatUI.AppConfig) {
  MetacatUI.AppConfig = {};
}
// Set up App Configurations that are always used for the arctic theme.
// Deployment-specific configurations can be set in a separate file
MetacatUI.AppConfig = Object.assign(
  {
    root: "/catalog",
    theme: "arctic",
    baseUrl: "https://arcticdata.io",
    bioportalAPIKey: "",
    repositoryName: "Arctic Data Center",
    emailContact: "support@arcticdata.io",
    nodeId: "urn:node:ARCTIC",

    //Metadata quality
    mdqSuiteIds: ["arctic.data.center.suite.1", "FAIR-suite-0.3.1"],
    mdqSuiteLabels: [
      "Arctic Data Center Conformance Suite v1.0",
      "FAIR Suite v0.3.1",
    ],
    mdqFormatIds: ["eml*", "https://eml*"],
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
    defaultAccessPolicy: [
      {
        subject: "CN=arctic-data-admins,DC=dataone,DC=org",
        read: true,
        write: true,
        changePermission: true,
      },
    ],
    enablePublishDOI: false,
    hiddenSubjectsInAccessPolicy: ["CN=arctic-data-admins,DC=dataone,DC=org"],
    showDatasetPublicToggleForSubjects: [
      "CN=arctic-data-admins,DC=dataone,DC=org",
    ],
    editorSaveErrorMsgWithDraft:
      "Not all of your changes could be submitted " +
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
      methods: true,
      samplingDescription: false,
      studyExtentDescription: false,
      taxonCoverage: false,
      temporalCoverage: true,
      title: true,
      contact: true,
    },
    emlEditorRequiredFields_EMLParty: {
      contact: ["email"],
    },
    allowChangeRightsHolder: false,
    enableMeasurementTypeView: true,
    dataSensitivityInfoURL: "/sensitive-data-guidelines",
    customEMLMethods: [
      {
        titleOptions: ["Ethical Research Practices"],
        id: "ethicalResearchPractices",
        required: true,
      },
    ],

    //Searching
    enableSolrJoins: true,
    mapKey: "AIzaSyCYoTkUEpMAiOoWx5M61ButwgNGX8fIHUs",
    searchMapTileHue: "231",
    defaultSearchFilters: [
      "all",
      "attribute",
      "annotation",
      "creator",
      "dataYear",
      "pubYear",
      "id",
      "taxon",
      "spatial",
      "isPrivate",
    ],

    // CesiumMap
    enableCesium: true,
    useDeprecatedDataCatalogView: false,
    catalogSearchMapOptions: {
      clickFeatureAction: "zoom",
      homePosition: {
        height: 6582600,
        longitude: 11.918396,
        latitude: 89.699918,
        heading: 360,
        pitch: -90,
        roll: 0,
      },
      layers: [
        {
          type: "CesiumGeohash",
          visible: true,
          colorPalette: {
            paletteType: "continuous",
            property: "count",
            colors: [
              {
                value: 0,
                color: "#FFFFFF00",
              },
              {
                value: 1,
                color: "#f5b9424d",
              },
              {
                value: "max",
                color: "#f5a142",
              },
            ],
          },
        },
        {
          type: "OpenStreetMapImageryProvider",
          label: "Open Street Map",
          visible: true,
        },
        {
          type: "IonImageryProvider",
          label: "Bing Maps",
          cesiumOptions: {
            ionAssetId: 3,
          },
          visible: false,
        },
      ],
    },
    defaultFilterGroups: [
      {
        label: "",
        filters: [
          {
            fields: ["attribute"],
            label: "Data attribute",
            placeholder: "density, length, etc.",
            icon: "table",
            description: "Measurement type, e.g. density, temperature, species",
          },
          {
            fields: ["sem_annotation"],
            label: "Annotation",
            placeholder: "Search for class...",
            icon: "tag",
            description: "Semantic annotations",
          },
          {
            fields: ["originText"],
            label: "Creator",
            placeholder: "Name",
            icon: "user",
            description: "The name of the creator or originator of a dataset",
          },
          {
            filterType: "DateFilter",
            fields: ["datePublished", "dateUploaded"],
            label: "Publish year",
            rangeMin: 1800,
            icon: "calendar",
            description:
              "Only show results that were published within the year range",
          },
          {
            filterType: "DateFilter",
            fields: ["beginDate"],
            label: "Year of data coverage",
            rangeMin: 1800,
            icon: "calendar",
            description:
              "Only show results with data collected within the year range",
          },
          {
            fields: ["identifier", "documents", "resourceMap", "seriesId"],
            label: "Identifier",
            placeholder: "DOI or ID",
            icon: "bullseye",
            description:
              "Find datasets if you have all or part of its DOI or ID",
            operator: "OR",
            fieldsOperator: "OR",
          },
          {
            fields: [
              "kingdom",
              "phylum",
              "class",
              "order",
              "family",
              "genus",
              "species",
            ],
            label: "Taxon",
            placeholder: "Class, family, etc.",
            icon: "sitemap",
            description: "Find data about any taxonomic rank",
            matchSubstring: true,
            fieldsOperator: "OR",
          },
          {
            fields: ["siteText"],
            label: "Location",
            placeholder: "Geographic region",
            icon: "globe",
            description:
              "The geographic region or study site, as described by the submitter",
          },
          {
            fields: ["isPublic"],
            label: "Access",
            icon: "lock",
            description:
              "Check this to only show private datasets. You need to be loggied in to view private datasets.",
            filterType: "ToggleFilter",
            placeholder: "Private datasets only",
            falseLabel: null,
            trueValue: "true",
            trueLabel: "Private datasets only",
            matchSubstring: false,
            exclude: true,
          },
        ],
      },
    ],

    //Temp message
    temporaryMessage: "",
    temporaryMessageStartTime: null,
    temporaryMessageEndTime: new Date("2020-06-16T13:30:00"),
    temporaryMessageClasses: "warning",
    temporaryMessageContainer: "#Navbar",

    //MetadataView
    datasetMapFillColor: "",

    //Google Analytics
    googleAnalyticsKey: "G-12EKQM14SH",
  },
  MetacatUI.AppConfig || {}
);

MetacatUI.themeMap = {
  "*": {
    // Templates include extension
    "templates/navbar.html":
      MetacatUI.root +
      "/js/themes/" +
      MetacatUI.theme +
      "/templates/navbar.html",
    "templates/featuredData.html":
      MetacatUI.root +
      "/js/themes/" +
      MetacatUI.theme +
      "/templates/featuredData.html",
    "templates/footer.html":
      MetacatUI.root +
      "/js/themes/" +
      MetacatUI.theme +
      "/templates/footer.html",
    "templates/mainContent.html":
      MetacatUI.root +
      "/js/themes/" +
      MetacatUI.theme +
      "/templates/mainContent.html",
    "templates/altHeader.html":
      MetacatUI.root +
      "/js/themes/" +
      MetacatUI.theme +
      "/templates/altHeader.html",
    "templates/defaultHeader.html":
      MetacatUI.root +
      "/js/themes/" +
      MetacatUI.theme +
      "/templates/defaultHeader.html",
    "templates/userProfileMenu.html":
      MetacatUI.root +
      "/js/themes/" +
      MetacatUI.theme +
      "/templates/userProfileMenu.html",
    "templates/noResults.html":
      MetacatUI.root +
      "/js/themes/" +
      MetacatUI.theme +
      "/templates/noResults.html",
    "templates/loginButtons.html":
      MetacatUI.root +
      "/js/themes/" +
      MetacatUI.theme +
      "/templates/loginButtons.html",
    "templates/metadata.html":
      MetacatUI.root +
      "/js/themes/" +
      MetacatUI.theme +
      "/templates/metadata.html",
    "templates/insertProgress.html":
      MetacatUI.root +
      "/js/themes/" +
      MetacatUI.theme +
      "/templates/insertProgress.html",
    "templates/editorSubmitMessage.html":
      MetacatUI.root +
      "/js/themes/" +
      MetacatUI.theme +
      "/templates/editorSubmitMessage.html",
    "models/Map":
      MetacatUI.root + "/js/themes/" + MetacatUI.theme + "/models/Map.js",
    "routers/router":
      MetacatUI.root + "/js/themes/" + MetacatUI.theme + "/routers/router.js",
  },
};
