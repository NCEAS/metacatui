define([
  "jquery",
  "jqueryui",
  "underscore",
  "backbone",
  "gmaps",
  "fancybox",
  "clipboard",
  "collections/DataPackage",
  "models/DataONEObject",
  "models/PackageModel",
  "models/SolrResult",
  "models/metadata/ScienceMetadata",
  "models/MetricsModel",
  "common/Utilities",
  "views/DataPackageView",
  "views/DownloadButtonView",
  "views/ProvChartView",
  "views/MetadataIndexView",
  "views/CitationHeaderView",
  "views/citations/CitationModalView",
  "views/AnnotationView",
  "views/MarkdownView",
  "views/ViewObjectButtonView",
  "views/CanonicalDatasetHandlerView",
  "text!templates/metadata/metadata.html",
  "text!templates/dataSource.html",
  "text!templates/publishDOI.html",
  "text!templates/newerVersion.html",
  "text!templates/loading.html",
  "text!templates/metadataControls.html",
  "text!templates/alert.html",
  "text!templates/editMetadata.html",
  "text!templates/dataDisplay.html",
  "text!templates/map.html",
  "text!templates/metaTagsHighwirePress.html",
  "views/MetricView",
], (
  $,
  $ui,
  _,
  Backbone,
  gmaps,
  _fancybox,
  Clipboard,
  DataPackage,
  DataONEObject,
  Package,
  SolrResult,
  ScienceMetadata,
  MetricsModel,
  Utilities,
  DataPackageView,
  DownloadButtonView,
  ProvChart,
  MetadataIndex,
  CitationHeaderView,
  CitationModalView,
  AnnotationView,
  MarkdownView,
  ViewObjectButtonView,
  CanonicalDatasetHandlerView,
  MetadataTemplate,
  DataSourceTemplate,
  PublishDoiTemplate,
  VersionTemplate,
  LoadingTemplate,
  ControlsTemplate,
  AlertTemplate,
  EditMetadataTemplate,
  DataDisplayTemplate,
  MapTemplate,
  metaTagsHighwirePressTemplate,
  MetricView,
) => {
  "use strict";

  /**
   * @class MetadataView
   * @classdesc A human-readable view of a science metadata file
   * @classcategory Views
   * @augments Backbone.View
   * @class
   * @screenshot views/MetadataView.png
   */
  const MetadataView = Backbone.View.extend(
    /** @lends MetadataView.prototype */ {
      subviews: [],

      pid: null,
      seriesId: null,
      saveProvPending: false,

      model: new SolrResult(),
      packageModels: [],
      entities: [],
      dataPackage: null,
      dataPackageSynced: false,
      el: "#Content",
      metadataContainer: "#metadata-container",
      citationContainer: "#citation-container",
      tableContainer: "#table-container",
      controlsContainer: "#metadata-controls-container",
      metricsContainer: "#metrics-controls-container",
      editorControlsContainer: "#editor-controls-container",
      breadcrumbContainer: "#breadcrumb-container",
      parentLinkContainer: "#parent-link-container",
      dataSourceContainer: "#data-source-container",
      articleContainer: "#article-container",

      type: "Metadata",

      // Templates
      template: _.template(MetadataTemplate),
      alertTemplate: _.template(AlertTemplate),
      doiTemplate: _.template(PublishDoiTemplate),
      versionTemplate: _.template(VersionTemplate),
      loadingTemplate: _.template(LoadingTemplate),
      controlsTemplate: _.template(ControlsTemplate),
      dataSourceTemplate: _.template(DataSourceTemplate),
      editMetadataTemplate: _.template(EditMetadataTemplate),
      dataDisplayTemplate: _.template(DataDisplayTemplate),
      mapTemplate: _.template(MapTemplate),
      metaTagsHighwirePressTemplate: _.template(metaTagsHighwirePressTemplate),

      objectIds: [],

      /**
       * Text to display in the help tooltip for the alternative identifier
       * field, if the field is present.
       * @type {string}
       * @since 2.26.0
       */
      alternativeIdentifierHelpText: `
         An identifier used to reference this dataset in the past or in another
         system. This could be a link to the original dataset or an old
         identifier that was replaced. The referenced dataset may be the same
         or different from the one you are currently viewing, and its
         accessibility may vary. It may provide additional context about the
         history and evolution of the dataset.
        `,

      /** @inheritdoc */
      events: {
        "click #publish": "publish",
        "mouseover .highlight-node": "highlightNode",
        "mouseout  .highlight-node": "highlightNode",
        "click     .preview": "previewData",
        "click     #save-metadata-prov": "saveProv",
      },

      /**
       * Initialize the MetadataView
       * @param {object} options Object containing the view's options
       * @param {string} [options.pid] The identifier of the metadata object to
       * render
       * @param {string} [options.el] The jQuery selector for the element in
       * which to render the view
       */
      initialize(options = {}) {
        this.pid =
          options.pid || options.id || MetacatUI.appModel.get("pid") || null;

        this.dataPackage = null;

        if (typeof options.el !== "undefined") this.setElement(options.el);
      },

      /** @inheritdoc */
      render() {
        if (this.isRendering) {
          // If we re-render before the first render is complete the view breaks
          this.stopListening(this, "renderComplete", this.render);
          this.listenToOnce(this, "renderComplete", this.render);
          return this;
        }
        this.isRendering = true;
        this.stopListening();

        MetacatUI.appModel.set("headerType", "default");
        //  this.showLoading("Loading...");

        // Reset various properties of this view first
        this.classMap = [];
        this.subviews = [];
        this.model.set(this.model.defaults);
        this.packageModels = [];

        // get the pid to render
        if (!this.pid) this.pid = MetacatUI.appModel.get("pid");

        this.listenTo(MetacatUI.appUserModel, "change:loggedIn", this.render);

        // Listen to when the metadata has been rendered
        this.listenToOnce(this, "metadataLoaded", () => {
          this.createAnnotationViews();
          this.insertMarkdownViews();
          // Modifies the view to indicate that this is a dataset is essentially
          // a duplicate of another dataset, if applicable
          this.canonicalDatasetHandler = new CanonicalDatasetHandlerView({
            metadataView: this,
          }).render();
        });

        // Listen to when the package table has been rendered
        this.once("dataPackageRendered", () => {
          const packageTableContainer = this.$("#data-package-container");
          $(packageTableContainer).children(".loading").remove();

          // Scroll to the element on the page that is in the hash fragment (if
          // there is one)
          this.scrollToFragment();
        });

        this.getModel();

        return this;
      },

      /**
       * Retrieve the resource map given its PID, and when it's fetched, check
       * for write permissions, then check for private members in the package
       * table view, if there is one.
       * @param {string} pid - The PID of the resource map
       */
      getDataPackage(pid) {
        // Create a DataONEObject model to use in the DataPackage collection.
        const dataOneObject = new ScienceMetadata({ id: this.model.get("id") });

        const view = this;

        // Create a new data package with this id
        this.dataPackage = new DataPackage([dataOneObject], { id: pid });

        this.dataPackage.mergeModels([this.model]);

        // If there is no resource map
        if (!pid) {
          // mark the data package as synced, since there are no other models to
          // fetch
          this.dataPackageSynced = true;
          this.trigger("changed:dataPackageSynced");
          this.checkWritePermissions();
          return;
        }

        this.listenToOnce(this.dataPackage, "complete", () => {
          this.dataPackageSynced = true;
          this.trigger("changed:dataPackageSynced");
          const dataPackageView = _.findWhere(this.subviews, {
            type: "DataPackage",
          });
          if (dataPackageView) {
            dataPackageView.dataPackageCollection = this.dataPackage;
            dataPackageView.checkForPrivateMembers();
          }
        });

        this.listenToOnce(this.dataPackage, "fetchFailed", () => {
          view.dataPackageSynced = false;

          // stop listening to the fetch complete
          view.stopListening(view.dataPackage, "complete");

          // Remove the loading elements
          view.$(view.tableContainer).find(".loading").remove();

          // Show an error message
          MetacatUI.appView.showAlert(
            "Error retrieving files for this data package.",
            "alert-error",
            view.$(view.tableContainer),
          );
        });

        if (
          this.dataPackage.packageModel &&
          this.dataPackage.packageModel.get("synced") === true
        ) {
          this.checkWritePermissions();
        } else {
          this.listenToOnce(this.dataPackage.packageModel, "sync", () => {
            this.checkWritePermissions();
          });
        }
        // Fetch the data package. DataPackage.parse() triggers 'complete'
        this.dataPackage.fetch({
          fetchModels: false,
        });
      },

      /*
       * Retrieves information from the index about this object, given the id
       * (passed from the URL) When the object info is retrieved from the index,
       * we set up models depending on the type of object this is
       */
      getModel(id) {
        const pid = id || this.pid;
        const sid = this.seriesId || null;

        // Get the package ID
        this.model.set({ id: pid, seriesId: sid });
        const { model } = this;

        this.listenToOnce(model, "sync", () => {
          if (
            this.model.get("formatType") === "METADATA" ||
            !this.model.get("formatType")
          ) {
            this.model = model;
            this.renderMetadata();
          } else if (this.model.get("formatType") === "DATA") {
            // Get the metadata pids that document this data object
            const isDocBy = this.model.get("isDocumentedBy");

            // If there is only one metadata pid that documents this data
            // object, then get that metadata model for this view.
            if (isDocBy && isDocBy.length === 1) {
              this.navigateWithFragment(_.first(isDocBy), this.pid);

              return;
            }
            // If more than one metadata doc documents this data object, it is
            // most likely multiple versions of the same metadata. So we need to
            // find the latest version.
            if (isDocBy && isDocBy.length > 1) {
              const view = this;

              // eslint-disable-next-line import/no-dynamic-require
              require(["collections/Filters", "collections/SolrResults"], (
                Filters,
                SolrResults,
              ) => {
                // Create a search for the metadata docs that document this data
                // object
                const searchFilters = new Filters([
                  {
                    values: isDocBy,
                    fields: ["id", "seriesId"],
                    operator: "OR",
                    fieldsOperator: "OR",
                    matchSubstring: false,
                  },
                ]);
                // Create a list of search results
                const searchResults = new SolrResults([], {
                  rows: isDocBy.length,
                  query: searchFilters.getQuery(),
                  fields: "obsoletes,obsoletedBy,id",
                });

                // When the search results are returned, process those results
                view.listenToOnce(searchResults, "sync", () => {
                  // Keep track of the latest version of the metadata doc(s)
                  const latestVersions = [];

                  // Iterate over each search result and find the latest version
                  // of each metadata version chain
                  searchResults.each((searchResult) => {
                    // If this metadata isn't obsoleted by another object, it is
                    // the latest version
                    if (!searchResult.get("obsoletedBy")) {
                      latestVersions.push(searchResult.get("id"));
                    }
                    // If it is obsoleted by another object but that newer
                    // object does not document this data, then this is the
                    // latest version
                    else if (
                      !_.contains(isDocBy, searchResult.get("obsoletedBy"))
                    ) {
                      latestVersions.push(searchResult.get("id"));
                    }
                  }, view);

                  // If at least one latest version was found (should always be
                  // the case),
                  if (latestVersions.length) {
                    // Set that metadata pid as this view's pid and get that
                    // metadata model. TODO: Support navigation to multiple
                    // metadata docs. This should be a rare occurence, but it is
                    // possible that more than one metadata version chain
                    // documents a data object, and we need to show the user
                    // that the data is involved in multiple datasets.
                    view.navigateWithFragment(latestVersions[0], view.pid);
                  }
                  // If a latest version wasn't found, which should never
                  // happen, but just in case, default to the last metadata pid
                  // in the isDocumentedBy field (most liekly to be the most
                  // recent since it was indexed last).
                  else {
                    view.navigateWithFragment(_.last(isDocBy), view.pid);
                  }
                });

                // Send the query to the Solr search service
                searchResults.query();
              });

              return;
            }
            this.noMetadata(this.model);
          } else if (this.model.get("formatType") === "RESOURCE") {
            const packageModel = new Package({ id: this.model.get("id") });
            packageModel.on(
              "complete",
              () => {
                const metadata = packageModel.getMetadata();

                if (!metadata) {
                  this.noMetadata(packageModel);
                } else {
                  this.model = metadata;
                  this.pid = this.model.get("id");
                  this.renderMetadata();
                  if (this.model.get("resourceMap"))
                    this.getPackageDetails(this.model.get("resourceMap"));
                }
              },
              this,
            );
            packageModel.getMembers();
            return;
          }

          // Get the package information
          this.getPackageDetails(model.get("resourceMap"));
        });

        // Listen to 404 and 401 errors when we get the metadata object
        this.stopListening(model, "404");
        this.listenToOnce(model, "404", this.showNotFound);
        this.stopListening(model, "401");
        this.listenToOnce(model, "401", this.showIsPrivate);

        // Fetch the model
        model.getInfo();
      },

      /**
       * Render the main components of the metadata view. Insert HTML from the
       * view service or fallback to rendering from the index. Insert
       * breadcrumbs, citation, data source logo, metadata controls, and
       * metadata metrics.
       */
      renderMetadata() {
        const pid = this.model.get("id");

        this.hideLoading();
        // Load the template which holds the basic structure of the view
        this.$el.html(this.template());
        this.$(this.tableContainer).html(
          this.loadingTemplate({
            msg: "Retrieving data set details...",
          }),
        );

        // Insert the breadcrumbs
        this.insertBreadcrumbs();
        // Insert the citation
        this.insertCitation();
        // Insert the data source logo
        this.insertDataSource();
        // is this the latest version? (includes DOI link when needed)
        this.showLatestVersion();

        // Insert various metadata controls in the page
        this.insertControls();

        // If we're displaying the metrics well then display copy citation and
        // edit button inside the well
        if (MetacatUI.appModel.get("displayDatasetMetrics")) {
          // Insert Metrics Stats into the dataset landing pages
          this.insertMetricsControls();
        }

        // Show loading icon in metadata section
        this.$(this.metadataContainer).html(
          this.loadingTemplate({ msg: "Retrieving metadata ..." }),
        );

        // Check for a view service in this MetacatUI.appModel
        const viewServiceUrl = MetacatUI.appModel.get("viewServiceUrl");
        if (viewServiceUrl) {
          const endpoint = viewServiceUrl + encodeURIComponent(pid);
          const viewRef = this;
          const loadSettings = {
            url: endpoint,
            success(response, status, _xhr) {
              try {
                // If the user has navigated away from the MetadataView, then
                // don't render anything further
                if (MetacatUI.appView.currentView !== viewRef) return;

                // Our fallback is to show the metadata details from the Solr
                // index
                if (
                  status === "error" ||
                  !response ||
                  typeof response !== "string"
                )
                  viewRef.renderMetadataFromIndex();
                else {
                  // Check for a response that is a 200 OK status, but is an
                  // error msg
                  if (
                    response.length < 250 &&
                    response.indexOf("Error transforming document") > -1 &&
                    viewRef.model.get("indexed")
                  ) {
                    viewRef.renderMetadataFromIndex();
                    return;
                  }
                  // Mark this as a metadata doc with no stylesheet, or one that
                  // is at least different than usual EML and FGDC
                  if (response.indexOf('id="Metadata"') === -1) {
                    viewRef.$el.addClass("container no-stylesheet");

                    if (viewRef.model.get("indexed")) {
                      viewRef.renderMetadataFromIndex();
                      return;
                    }
                  }

                  // Now show the response from the view service
                  viewRef.$(viewRef.metadataContainer).html(response);

                  _.each($(response).find(".entitydetails"), (entityEl) => {
                    const entityId = $(entityEl).data("id");
                    viewRef.storeEntityPIDs(entityEl, entityId);
                  });

                  // If there is no info from the index and there is no metadata
                  // doc rendered either, then display a message
                  if (
                    viewRef.$el.is(".no-stylesheet") &&
                    viewRef.model.get("archived") &&
                    !viewRef.model.get("indexed")
                  )
                    viewRef.$(viewRef.metadataContainer).prepend(
                      viewRef.alertTemplate({
                        msg: "There is limited metadata about this dataset since it has been archived.",
                      }),
                    );

                  viewRef.alterMarkup();

                  // Add a map of the spatial coverage
                  if (gmaps) viewRef.insertSpatialCoverageMap();

                  // Injects Clipboard objects into DOM elements returned from
                  // the View Service
                  viewRef.insertCopiables();

                  viewRef.trigger("metadataLoaded");
                  viewRef.isRendering = false;
                  viewRef.trigger("renderComplete");
                }
              } catch (e) {
                MetacatUI.analytics?.trackException(
                  `Error rendering metadata from the view service. Fellback to index, ${e}, Response: ${response}`,
                  pid,
                  false,
                );
                viewRef.renderMetadataFromIndex();
              }
            },
            error(_xhr, _textStatus, _errorThrown) {
              viewRef.renderMetadataFromIndex();
            },
          };

          $.ajax(
            _.extend(loadSettings, MetacatUI.appUserModel.createAjaxSettings()),
          );
        } else this.renderMetadataFromIndex();

        // Insert the Linked Data into the header of the page.
        if (MetacatUI.appModel.get("isJSONLDEnabled")) {
          const json = this.generateJSONLD();
          this.insertJSONLD(json);
        }

        this.insertCitationMetaTags();
      },

      /**
       * If there is no view service available, then display the metadata fields
       * from the index
       */
      renderMetadataFromIndex() {
        const metadataFromIndex = new MetadataIndex({
          pid: this.pid,
          parentView: this,
        });
        this.subviews.push(metadataFromIndex);

        // Add the metadata HTML
        this.$(this.metadataContainer).html(metadataFromIndex.render().el);

        const view = this;

        this.listenTo(metadataFromIndex, "complete", () => {
          // Add the package contents
          view.insertPackageDetails();

          // Add a map of the spatial coverage
          if (gmaps) view.insertSpatialCoverageMap();
        });
      },

      /** @deprecated */
      removeCitation() {
        let citation = "";
        let citationEl = null;

        // Find the citation element
        if (this.$(".citation").length > 0) {
          // Get the text for the citation
          citation = this.$(".citation").text();

          // Save this element in the view
          citationEl = this.$(".citation");
        }
        // Older versions of Metacat (v2.4.3 and older) will not have the
        // citation class in the XSLT. Find the citation another way
        else {
          // Find the DOM element with the citation
          const wells = this.$(".well");

          // Find the div.well with the citation. If we never find it, we don't
          // insert the list of contents
          _.each(wells, (well) => {
            if (
              (!citationEl &&
                $(well).find("#viewMetadataCitationLink").length > 0) ||
              $(well).children(".row-fluid > .span10 > a")
            ) {
              // Save this element in the view
              citationEl = well;

              // Mark this in the DOM for CSS styling
              $(well).addClass("citation");

              // Save the text of the citation
              citation = $(well).text();
            }
          });

          // Remove the unnecessary classes that are used in older versions of
          // Metacat (2.4.3 and older)
          const citationText = $(citationEl).find(".span10");
          $(citationText).removeClass("span10").addClass("span12");
        }

        // Set the document title to the citation
        MetacatUI.appModel.set("title", citation);

        citationEl.remove();
      },

      /**
       * Add breadcrumbs to the page to show the user where they are in the app
       */
      insertBreadcrumbs() {
        const breadcrumbs = $(document.createElement("ol"))
          .addClass("breadcrumb")
          .append(
            $(document.createElement("li"))
              .addClass("home")
              .append(
                $(document.createElement("a"))
                  .attr("href", MetacatUI.root || "/")
                  .addClass("home")
                  .text("Home"),
              ),
          )
          .append(
            $(document.createElement("li"))
              .addClass("search")
              .append(
                $(document.createElement("a"))
                  .attr(
                    "href",
                    `${MetacatUI.root}/data${
                      MetacatUI.appModel.get("page") > 0
                        ? `/page/${
                            parseInt(MetacatUI.appModel.get("page"), 10) + 1
                          }`
                        : ""
                    }`,
                  )
                  .addClass("search")
                  .text("Search"),
              ),
          )
          .append(
            $(document.createElement("li")).append(
              $(document.createElement("a"))
                .attr(
                  "href",
                  `${MetacatUI.root}/view/${encodeURIComponent(this.pid)}`,
                )
                .addClass("inactive")
                .text("Metadata"),
            ),
          );

        if (MetacatUI.uiRouter.lastRoute() === "data") {
          $(breadcrumbs).prepend(
            $(document.createElement("a"))
              .attr(
                "href",
                `${MetacatUI.root}/data/page/${
                  MetacatUI.appModel.get("page") > 0
                    ? parseInt(MetacatUI.appModel.get("page"), 10) + 1
                    : ""
                }`,
              )
              .attr("title", "Back")
              .addClass("back")
              .text(" Back to search")
              .prepend(
                $(document.createElement("i")).addClass("icon-angle-left"),
              ),
          );
          $(breadcrumbs).find("a.search").addClass("inactive");
        }

        this.$(this.breadcrumbContainer).html(breadcrumbs);
      },

      /**
       * When the metadata object doesn't exist, display a message to the user
       */
      showNotFound() {
        // If the model was found, exit this function
        if (!this.model.get("notFound")) {
          return;
        }

        // Check if a query string was in the URL and if so, try removing it in
        // the identifier
        if (this.model.get("id").match(/\?\S+=\S+/g) && !this.findTries) {
          const newID = this.model.get("id").replace(/\?\S+=\S+/g, "");
          this.onClose();
          this.model.set("id", newID);
          this.pid = newID;
          this.findTries = 1;
          this.render();
          return;
        }
        // Construct a message that shows this object doesn't exist
        const msg =
          `<h4>Nothing was found.</h4>` +
          `<p id='metadata-view-not-found-message'>The dataset identifier '${Utilities.encodeHTML(
            this.model.get("id"),
          )}' ` +
          `does not exist or it may have been removed. <a>Search for ` +
          `datasets that mention ${Utilities.encodeHTML(
            this.model.get("id"),
          )}</a></p>`;

        // Remove the loading message
        this.hideLoading();

        // Show the not found error message
        this.showError(msg);

        // Add the pid to the link href. Add via JS so it is Attribute-encoded
        // to prevent XSS attacks
        this.$("#metadata-view-not-found-message a").attr(
          "href",
          `${MetacatUI.root}/data/query=${encodeURIComponent(
            this.model.get("id"),
          )}`,
        );
      },

      /** When the metadata object is private, display a message to the user */
      showIsPrivate() {
        // If we haven't checked the logged-in status of the user yet, wait a
        // bit until we show a 401 msg, in case this content is their private
        // content
        if (!MetacatUI.appUserModel.get("checked")) {
          this.stopListening(
            MetacatUI.appUserModel,
            "change:checked",
            this.showIsPrivate,
          );
          this.listenToOnce(
            MetacatUI.appUserModel,
            "change:checked",
            this.showIsPrivate,
          );
          return;
        }
        this.isRendering = false;
        this.trigger("renderComplete");

        let msg = "";

        // If the user is logged in, the message will display that this dataset
        // is private.
        if (MetacatUI.appUserModel.get("loggedIn")) {
          msg =
            '<span class="icon-stack private tooltip-this" data-toggle="tooltip"' +
            'data-placement="top" data-container="#metadata-controls-container"' +
            'title="" data-original-title="This is a private dataset.">' +
            '<i class="icon icon-circle icon-stack-base private"></i>' +
            '<i class="icon icon-lock icon-stack-top"></i>' +
            "</span> This is a private dataset.";
        }
        // If the user isn't logged in, display a log in link.
        else {
          msg =
            `<span class="icon-stack private tooltip-this" data-toggle="tooltip"` +
            `data-placement="top" data-container="#metadata-controls-container"` +
            `title="" data-original-title="This is a private dataset.">` +
            `<i class="icon icon-circle icon-stack-base private"></i>` +
            `<i class="icon icon-lock icon-stack-top"></i>` +
            `</span> This is a private dataset. If you believe you have permission ` +
            `to access this dataset, then <a href="${MetacatUI.root}/signin">sign in</a>.`;
        }

        // Remove the loading message
        this.hideLoading();

        // Show the not found error message
        this.showError(msg);
      },

      /**
       * Retrieves and processes the details of the specified data packages.
       * @param {string[]} packageIDs - An array of package IDs to retrieve
       * details for. If the array is empty or not provided, it processes the
       * current metadata document as a standalone package.
       */
      getPackageDetails(packageIDs) {
        const view = this;
        let completePackages = 0;

        // This isn't a package, but just a lonely metadata doc...
        if (!packageIDs || !packageIDs.length) {
          const thisPackage = new Package({ id: null, members: [this.model] });
          thisPackage.flagComplete();
          this.packageModels = [thisPackage];
          this.insertPackageDetails(thisPackage, {
            disablePackageDownloads: true,
          });
        } else {
          _.each(
            packageIDs,
            (thisPackageID, _i) => {
              // Create a model representing the data package
              const thisPackage = new Package({ id: thisPackageID });

              // Listen for any parent packages
              this.listenToOnce(
                thisPackage,
                "change:parentPackageMetadata",
                this.insertParentLink,
              );

              // When the package info is fully retrieved
              view.listenToOnce(thisPackage, "complete", () => {
                // When all packages are fully retrieved
                completePackages += 1;
                if (completePackages >= packageIDs.length) {
                  const latestPackages = _.filter(
                    view.packageModels,
                    (m) => !_.contains(packageIDs, m.get("obsoletedBy")),
                  );

                  // Set those packages as the most recent package
                  view.packageModels = latestPackages;

                  view.insertPackageDetails(latestPackages);
                }
              });

              // Save the package in the view
              view.packageModels.push(thisPackage);

              // Make sure we get archived content, too
              thisPackage.set("getArchivedMembers", true);

              // Get the members
              thisPackage.getMembers({ getParentMetadata: true });
            },
            this,
          );
        }
      },

      /** Make minor modifications to the HTML returned from the view service */
      alterMarkup() {
        // Find the taxonomic range and give it a class for styling - for older
        // versions of Metacat only (v2.4.3 and older)
        if (!this.$(".taxonomicCoverage").length)
          this.$('h4:contains("Taxonomic Range")')
            .parent()
            .addClass("taxonomicCoverage");

        // Remove ecogrid links and replace them with workable links
        this.replaceEcoGridLinks();

        // Find the tab links for attribute names
        this.$(".attributeListTable tr a").on("shown", (e) => {
          // When the attribute link is clicked on, highlight the tab as active
          $(e.target)
            .parents(".attributeListTable")
            .find(".active")
            .removeClass("active");
          $(e.target).parents("tr").first().addClass("active");
        });

        // Mark the first row in each attribute list table as active since the
        // first attribute is displayed at first
        this.$(".attributeListTable tr:first-child()").addClass("active");

        // Add explanation text to the alternate identifier
        this.renderAltIdentifierHelpText();
      },

      /**
       * Inserts an info icon next to the alternate identifier field, if it
       * exists. The icon will display a tooltip with the help text for the
       * field.
       * @returns {jQuery|null} The jQuery object for the icon element.
       * @since 2.26.0
       */
      renderAltIdentifierHelpText() {
        // Find the HTML element that contains the alternate identifier.
        const altIdentifierLabel = this.$(
          ".control-label:contains('Alternate Identifier')",
        );

        // It may not exist for all datasets.
        if (!altIdentifierLabel.length) return null;

        const text = this.alternativeIdentifierHelpText;

        if (!text) return null;

        // Create the tooltip
        const icon = $(document.createElement("i"))
          .addClass("tooltip-this icon icon-info-sign")
          .css("margin-left", "4px");

        // Activate the jQuery tooltip plugin
        icon.tooltip({
          title: text,
          placement: "top",
          container: "body",
        });

        // Add the icon to the label.
        altIdentifierLabel.append(icon);

        return icon;
      },

      /**
       * Inserts a table with all the data package member information and sends
       * the call to display annotations
       * @param {Array} packageModels - An array of Package models
       * @param {object} options - An object with options for rendering the
       * package table
       * @returns {MetadataView|null} Returns this view object
       */
      insertPackageDetails(packageModels, options = {}) {
        // Don't insert the package details twice
        const view = this;
        const tableEls = this.$(view.tableContainer).children().not(".loading");
        if (tableEls.length > 0) return view;

        // wait for the metadata to load
        const metadataEls = this.$(view.metadataContainer).children();
        if (!metadataEls.length || metadataEls.first().is(".loading")) {
          this.once("metadataLoaded", () => {
            view.insertPackageDetails(this.packageModels, options);
          });
          return view;
        }

        const packages = packageModels || this.packageModels;

        // Get the entity names from this page/metadata
        this.getEntityNames(packages);

        _.each(
          packages,
          function showDetails(packageModel) {
            // If the package model is not complete, don't do anything
            if (!packageModel.complete) return;

            // Insert a package table for each package in viewRef dataset
            const nestedPckgs = packageModel.getNestedPackages();
            let nestedPckgsToDisplay = [];

            // If this metadata is not archived, filter out archived packages
            if (!this.model.get("archived")) {
              nestedPckgsToDisplay = _.reject(nestedPckgs, (pkg) =>
                pkg.get("archived"),
              );
            } else {
              // Display all packages is this metadata is archived
              nestedPckgsToDisplay = nestedPckgs;
            }

            if (nestedPckgsToDisplay.length > 0) {
              if (
                !(
                  !this.model.get("archived") &&
                  packageModel.get("archived") === true
                )
              ) {
                const title = packageModel.get("id")
                  ? `<span class="subtle">Package: ${packageModel.get(
                      "id",
                    )}</span>`
                  : "";
                const tableOptions = { ...options, nested: true, title };
                this.insertPackageTable(packageModel, tableOptions);
              }
            } else if (
              // If this metadata is not archived, then don't display archived
              // packages
              !(
                !this.model.get("archived") &&
                packageModel.get("archived") === true
              )
            ) {
              const title = packageModel.get("id")
                ? `<span class="subtle">Package: ${packageModel.get(
                    "id",
                  )}</span>`
                : "";
              const tableOptions = {
                ...options,
                title: `Files in this dataset ${title}`,
              };
              this.insertPackageTable(packageModel, tableOptions);
            }

            // Remove the extra download button returned from the XSLT since the
            // package table will have all the download links
            $("#downloadPackage").remove();
          },
          this,
        );

        // If this metadata doc is not in a package, but is just a lonely
        // metadata doc...
        if (!packages.length) {
          const packageModel = new Package({
            members: [this.model],
          });
          packageModel.complete = true;
          const tableOptions = {
            ...options,
            title: "Files in this dataset",
            disablePackageDownloads: true,
          };
          this.insertPackageTable(packageModel, tableOptions);
        }

        // Insert the data details sections
        this.insertDataDetails();

        // Get data package, if there is one, before checking write permissions
        if (packages.length) {
          this.getDataPackage(packages[0].get("id"));
        } else {
          // Otherwise go ahead and check write permissions on metadata only
          this.checkWritePermissions();
        }

        try {
          // Get the most recent package to display the provenance graphs
          if (packages.length) {
            // Find the most recent Package model and fetch it
            let mostRecentPackage = _.find(
              packages,
              (p) => !p.get("obsoletedBy"),
            );

            // If all of the packages are obsoleted, then use the last package
            // in the array, which is most likely the most recent.

            // @todo Use the DataONE version API to find the most recent
            // package in the version chain
            if (!mostRecentPackage) {
              mostRecentPackage = packages[packages.length - 1];
            }

            // Get the data package only if it is not the same as the previously
            // fetched package
            if (mostRecentPackage.get("id") !== packages[0].get("id"))
              this.getDataPackage(mostRecentPackage.get("id"));
          }
        } catch (e) {
          MetacatUI.analytics?.trackException(
            "Could not get the data package and could not display provenance graphs.",
            view.pid,
            false,
          );
        }

        // Initialize tooltips in the package table(s)
        this.$(".tooltip-this").tooltip();

        return this;
      },

      /**
       * Inserts a package table into the view.
       * @param {object} packageModel - The package model.
       * @param {object} options - The options for the package table.
       * @param {string} options.title - The title of the package table.
       * @param {boolean} options.disablePackageDownloads - Whether to disable
       * package downloads.
       * @param {boolean} options.nested - Whether the package table is nested.
       */
      insertPackageTable(packageModel, options) {
        const view = this;
        if (!this.dataPackage || !this.dataPackageSynced) {
          this.listenToOnce(this, "changed:dataPackageSynced", () => {
            view.insertPackageTable(packageModel, options);
          });
          return;
        }

        // Merge already fetched SolrResults into the dataPackage
        if (
          typeof packageModel !== "undefined" &&
          typeof packageModel.get("members") !== "undefined"
        ) {
          this.dataPackage.mergeModels(packageModel.get("members"));
        }

        let title = "";
        let disablePackageDownloads = false;
        let nested = false;

        if (options) {
          title = options.title || "";
          disablePackageDownloads = options.disablePackageDownloads || false;
          nested =
            typeof options.nested === "undefined" ? false : options.nested;
        }

        //* * Draw the package table **//
        const tableView = new DataPackageView({
          edit: false,
          dataPackage: this.dataPackage,
          currentlyViewing: this.pid,
          dataEntities: this.entities,
          disablePackageDownloads,
          parentView: this,
          title,
          packageTitle: this.model.get("title"),
          nested,
          metricsModel: this.metricsModel,
        });

        // Get the package table container
        const tablesContainer = this.$(this.tableContainer);

        // After the first table, start collapsing them
        const numTables = $(tablesContainer).find(
          "table.download-contents",
        ).length;

        let tableContainer = tablesContainer;
        if (numTables === 1) {
          tableContainer = $(document.createElement("div")).attr(
            "id",
            `additional-tables-for-${this.cid}`,
          );
          tableContainer.hide();
          $(tablesContainer).append(tableContainer);
        } else if (numTables > 1) {
          tableContainer = this.$(`#additional-tables-for-${this.cid}`);
        }

        // Insert the package table HTML
        $(tableContainer).empty();
        $(tableContainer).append(tableView.render().el);

        // Add Package Download create an instance of DownloadButtonView to
        // handle package downloads
        this.downloadButtonView = new DownloadButtonView({
          model: packageModel,
          view: "actionsView",
        });

        // render
        this.downloadButtonView.render();

        // add the downloadButtonView el to the span
        $(this.tableContainer)
          .find(".file-header .file-actions .downloadAction")
          .html(this.downloadButtonView.el);

        $(this.tableContainer).find(".loading").remove();

        $(tableContainer).find(".tooltip-this").tooltip();

        this.subviews.push(tableView);

        // Trigger a custom event in this view that indicates the package table
        // has been rendered
        this.trigger("dataPackageRendered");
      },

      /**
       * Inserts parent package links into the view for nested packages.
       * @param {PackageModel} packageModel - The package model containing the
       * parent package metadata.
       */
      insertParentLink(packageModel) {
        const parentPackageMetadata = packageModel.get("parentPackageMetadata");
        const view = this;

        _.each(parentPackageMetadata, (m, _i) => {
          const title = m.get("title");
          const icon = $(document.createElement("i")).addClass(
            "icon icon-on-left icon-level-up",
          );
          const link = $(document.createElement("a"))
            .attr(
              "href",
              `${MetacatUI.root}/view/${encodeURIComponent(m.get("id"))}`,
            )
            .addClass("parent-link")
            .text(`Parent dataset: ${title}`)
            .prepend(icon);

          view.$(view.parentLinkContainer).append(link);
        });
      },

      /**
       * Shows a map with the bounding coordinates of the spatial coverage of
       * the dataset.
       * @param {Array} [customCoordinates] - An array of custom coordinates to
       * use for the map in the order of [north, south, east, west].
       * @returns {boolean} Returns false if the map could not be inserted.
       */
      insertSpatialCoverageMap(customCoordinates) {
        let geoCoverEls = this.$(".geographicCoverage");
        let parseText = false;
        let directions = ["north", "south", "east", "west"];
        let [n, s, e, w] = customCoordinates || [];

        // Find the geographic region container. Older versions of Metacat
        // (v2.4.3 and less) will not have it classified so look for the header
        // text
        if (!geoCoverEls.length) {
          // For EML
          let title = this.$('h4:contains("Geographic Region")');

          // For FGDC
          if (title.length === 0) {
            title = this.$('label:contains("Bounding Coordinates")');
          }

          geoCoverEls = $(title).parent();
          parseText = true;
          directions = ["North", "South", "East", "West"];
        }

        for (let i = 0; i < geoCoverEls.length; i += 1) {
          const georegion = geoCoverEls[i];

          if (!customCoordinates?.length) {
            const coordinates = [];

            _.each(directions, (direction) => {
              // Parse text for older versions of Metacat (v2.4.3 and earlier)
              let coordinate = "";
              if (parseText) {
                const labelEl = $(georegion).find(
                  `label:contains("${direction}")`,
                );
                if (labelEl.length) {
                  coordinate = $(labelEl).next().html();
                  if (
                    typeof coordinate !== "undefined" &&
                    coordinate.indexOf("&nbsp;") > -1
                  )
                    coordinate = coordinate.substring(
                      0,
                      coordinate.indexOf("&nbsp;"),
                    );
                }
              } else {
                coordinate = $(georegion)
                  .find(`.${direction}BoundingCoordinate`)
                  .attr("data-value");
              }

              // Save our coordinate value
              coordinates.push(coordinate);
            });

            // Extract the coordinates
            [n, s, e, w] = coordinates;
          }

          // Create Google Map LatLng objects out of our coordinates
          const latLngSW = new gmaps.LatLng(s, w);
          const latLngNE = new gmaps.LatLng(n, e);
          const latLngNW = new gmaps.LatLng(n, w);
          const latLngSE = new gmaps.LatLng(s, e);

          // Get the centertroid location of this data item
          const bounds = new gmaps.LatLngBounds(latLngSW, latLngNE);
          const latLngCEN = bounds.getCenter();

          // If there isn't a center point found, don't draw the map.
          if (typeof latLngCEN === "undefined") {
            return false;
          }

          // Get the map path color
          let pathColor = MetacatUI.appModel.get("datasetMapPathColor");
          if (pathColor) {
            pathColor = `color:${pathColor}|`;
          } else {
            pathColor = "";
          }

          // Get the map path fill color
          let fillColor = MetacatUI.appModel.get("datasetMapFillColor");
          if (fillColor) {
            fillColor = `fillcolor:${fillColor}|`;
          } else {
            fillColor = "";
          }

          // Create a google map image
          const mapHTML =
            `<img class='georegion-map' ` +
            `src='https://maps.googleapis.com/maps/api/staticmap?` +
            `center=${latLngCEN.lat()},${latLngCEN.lng()}&size=800x350` +
            `&maptype=terrain` +
            `&markers=size:mid|color:0xDA4D3Aff|${latLngCEN.lat()},${latLngCEN.lng()}&path=${fillColor}${pathColor}weight:3|${latLngSW.lat()},${latLngSW.lng()}|${latLngNW.lat()},${latLngNW.lng()}|${latLngNE.lat()},${latLngNE.lng()}|${latLngSE.lat()},${latLngSE.lng()}|${latLngSW.lat()},${latLngSW.lng()}&visible=${latLngSW.lat()},${latLngSW.lng()}|${latLngNW.lat()},${latLngNW.lng()}|${latLngNE.lat()},${latLngNE.lng()}|${latLngSE.lat()},${latLngSE.lng()}|${latLngSW.lat()},${latLngSW.lng()}&sensor=false` +
            `&key=${MetacatUI.mapKey}'/>`;

          // Find the spot in the DOM to insert our map image
          let insertAfter = georegion;
          if (parseText) {
            insertAfter = $(georegion)
              .find('label:contains("West")')
              .parent()
              .parent().length
              ? $(georegion).find('label:contains("West")').parent().parent()
              : georegion;
          }

          // Get the URL to the interactive Google Maps instance
          const url = this.getGoogleMapsUrl(latLngCEN, bounds);

          // Insert the map image
          $(insertAfter).append(
            this.mapTemplate({
              map: mapHTML,
              url,
            }),
          );

          $(".fancybox-media").fancybox({
            openEffect: "elastic",
            closeEffect: "elastic",
            helpers: {
              media: {},
            },
          });
        }

        return true;
      },

      /**
       * Returns a URL to a Google Maps instance that is centered on the given
       * coordinates and zoomed to the appropriate level to display the given
       * bounding box.
       * @param {LatLng} latLngCEN - The center point of the map.
       * @param {LatLngBounds} bounds - The bounding box to display.
       * @returns {string} The URL to the Google Maps instance.
       * @since 2.27.0
       */
      getGoogleMapsUrl(latLngCEN, bounds) {
        // Use the window width and height as a proxy for the map dimensions
        const mapDim = {
          height: $(window).height(),
          width: $(window).width(),
        };
        const z = this.getBoundsZoomLevel(bounds, mapDim);
        const mapLat = latLngCEN.lat();
        const mapLng = latLngCEN.lng();

        return `https://maps.google.com/?ll=${mapLat},${mapLng}&z=${z}`;
      },

      /**
       * Returns the zoom level that will display the given bounding box at the
       * given dimensions.
       * @param {LatLngBounds} bounds - The bounding box to display.
       * @param {object} mapDim - The dimensions of the map.
       * @param {number} mapDim.height - The height of the map.
       * @param {number} mapDim.width - The width of the map.
       * @returns {number} The zoom level.
       * @since 2.27.0
       */
      getBoundsZoomLevel(bounds, mapDim) {
        const WORLD_DIM = { height: 256, width: 256 };
        const ZOOM_MAX = 15;
        // 21 is actual max, but any closer and the map is too zoomed in to be
        // useful

        /**
         * Converts a latitude to radians.
         * @param {number} lat - The latitude to convert.
         * @returns {number} The latitude in radians.
         */
        function latRad(lat) {
          const sin = Math.sin((lat * Math.PI) / 180);
          const radX2 = Math.log((1 + sin) / (1 - sin)) / 2;
          return Math.max(Math.min(radX2, Math.PI), -Math.PI) / 2;
        }

        /**
         * Returns the zoom level that will display the given bounding box at
         * the given dimensions.
         * @param {number} mapPx - The dimensions of the map.
         * @param {number} worldPx - The dimensions of the world.
         * @param {number} fraction - The fraction of the world to display.
         * @returns {number} The zoom level.
         */
        function zoom(mapPx, worldPx, fraction) {
          return Math.floor(Math.log(mapPx / worldPx / fraction) / Math.LN2);
        }

        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();

        const latFraction = (latRad(ne.lat()) - latRad(sw.lat())) / Math.PI;

        const lngDiff = ne.lng() - sw.lng();
        const lngFraction = (lngDiff < 0 ? lngDiff + 360 : lngDiff) / 360;

        const latZoom = zoom(mapDim.height, WORLD_DIM.height, latFraction);
        const lngZoom = zoom(mapDim.width, WORLD_DIM.width, lngFraction);

        return Math.min(latZoom, lngZoom, ZOOM_MAX);
      },

      /** Insert the citation header into the view */
      insertCitation() {
        if (!this.model) return;
        // Create a citation header element from the model attributes
        const header = new CitationHeaderView({ model: this.model });
        this.$(this.citationContainer).html(header.render().el);
      },

      /** Show a logo for the repository that hosts this metadata */
      insertDataSource() {
        if (
          !this.model ||
          !MetacatUI.nodeModel ||
          !MetacatUI.nodeModel.get("members").length ||
          !this.$(this.dataSourceContainer).length
        )
          return;

        const dataSource = MetacatUI.nodeModel.getMember(this.model);
        let replicaMNs = MetacatUI.nodeModel.getMembers(
          this.model.get("replicaMN"),
        );

        // Filter out the data source from the replica nodes
        if (Array.isArray(replicaMNs) && replicaMNs.length) {
          replicaMNs = _.without(replicaMNs, dataSource);
        }

        if (dataSource && dataSource.logo) {
          this.$("img.data-source").remove();

          // Construct a URL to the profile of this repository
          const profileURL =
            dataSource.identifier === MetacatUI.appModel.get("nodeId")
              ? `${MetacatUI.root}/profile`
              : `${MetacatUI.appModel.get("dataoneSearchUrl")}/portals/${
                  dataSource.shortIdentifier
                }`;

          // Insert the data source template
          this.$(this.dataSourceContainer)
            .html(
              this.dataSourceTemplate({
                node: dataSource,
                profileURL,
              }),
            )
            .addClass("has-data-source");

          this.$(this.citationContainer).addClass("has-data-source");
          this.$(".tooltip-this").tooltip();

          $(".popover-this.data-source.logo")
            .popover({
              trigger: "manual",
              html: true,
              title: `From the ${dataSource.name} repository`,
              content() {
                let content = `<p>${dataSource.description}</p>`;

                if (replicaMNs.length) {
                  content += `<h5>Exact copies hosted by ${replicaMNs.length} repositories: </h5><ul class="unstyled">`;

                  _.each(replicaMNs, (node) => {
                    content += `<li><a href="${MetacatUI.appModel.get(
                      "dataoneSearchUrl",
                    )}/portals/${node.shortIdentifier}" class="pointer">${
                      node.name
                    }</a></li>`;
                  });

                  content += "</ul>";
                }

                return content;
              },
              animation: false,
            })
            .on("mouseenter", () => {
              const el = this;
              $(this).popover("show");
              $(".popover").on("mouseleave", () => {
                $(el).popover("hide");
              });
            })
            .on("mouseleave", () => {
              const el = this;
              setTimeout(() => {
                if (!$(".popover:hover").length) {
                  $(el).popover("hide");
                }
              }, 300);
            });
        }
      },

      /**
       * Check whether the user has write permissions on the resource map and
       * the EML. Once the permission checks have finished, continue with the
       * functions that depend on them.
       */
      checkWritePermissions() {
        const view = this;
        const authorization = [];
        const resourceMap = this.dataPackage
          ? this.dataPackage.packageModel
          : null;
        const modelsToCheck = [this.model, resourceMap];

        modelsToCheck.forEach((model, index) => {
          // If there is no resource map or no EML, then the user does not need
          // permission to edit it.
          if (!model || model.get("notFound") === true) {
            authorization[index] = true;
            // If we already checked, and the user is authorized, record that
            // information in the authorzation array.
          } else if (model.get("isAuthorized_write") === true) {
            authorization[index] = true;
            // If we already checked, and the user is not authorized, record
            // that information in the authorzation array.
          } else if (model.get("isAuthorized_write") === false) {
            authorization[index] = false;
            // If we haven't checked for authorization yet, do that now. Return
            // to this function once we've finished checking.
          } else {
            view.stopListening(model, "change:isAuthorized_write");
            view.listenToOnce(model, "change:isAuthorized_write", () => {
              view.checkWritePermissions();
            });
            view.stopListening(model, "change:notFound");
            view.listenToOnce(model, "change:notFound", () => {
              view.checkWritePermissions();
            });
            model.checkAuthority("write");
          }
        });

        // Check that all the models were tested for authorization

        // Every value in the auth array must be true for the user to have full
        // permissions
        const allTrue = _.every(authorization, (test) => test);
        // When we have completed checking each of the models that we need to
        // check for permissions, every value in the authorization array should
        // be "true" or "false", and the array should have the same length as
        // the modelsToCheck array.
        const allBoolean = _.every(
          authorization,
          (test) => typeof test === "boolean",
        );
        const allChecked =
          allBoolean && authorization.length === modelsToCheck.length;

        // Check for and render prov diagrams now that we know whether or not
        // the user has editor permissions (There is a different version of the
        // chart for users who can edit the resource map and users who cannot)
        if (allChecked) {
          this.checkForProv();
        } else {
          return;
        }
        // Only render the editor controls if we have completed the checks AND
        // the user has full editor permissions
        if (allTrue) {
          this.insertEditorControls();
        }
      },

      /*
       * Inserts control elements onto the page for the user to interact with
       * the dataset - edit, publish, etc. Editor permissions should already
       * have been checked before running this function.
       */
      insertEditorControls() {
        const view = this;
        const resourceMap = this.dataPackage
          ? this.dataPackage.packageModel
          : null;
        const modelsToCheck = [this.model, resourceMap];
        const authorized = _.every(modelsToCheck, (model) =>
          // If there is no EML or no resource map, the user doesn't need
          // permission to edit it.
          !model || model.get("notFound") === true
            ? true
            : model.get("isAuthorized_write") === true,
        );

        // Only run this function when the user has full editor permissions
        // (i.e. write permission on the EML, and write permission on the
        // resource map if there is one.)
        if (!authorized) {
          return;
        }

        if (
          (this.model.get("obsoletedBy") &&
            this.model.get("obsoletedBy").length > 0) ||
          this.model.get("archived")
        ) {
          return;
        }

        // Save the element that will contain the owner control buttons
        const container = this.$(this.editorControlsContainer);
        // Do not insert the editor controls twice
        container.empty();

        // The PID for the EML model
        const pid = this.model.get("id") || this.pid;

        // Insert an Edit button if the Edit button is enabled
        if (MetacatUI.appModel.get("displayDatasetEditButton")) {
          // Check that this is an editable metadata format
          if (
            _.contains(
              MetacatUI.appModel.get("editableFormats"),
              this.model.get("formatId"),
            )
          ) {
            // Insert the Edit Metadata template
            container.append(
              this.editMetadataTemplate({
                identifier: pid,
                supported: true,
              }),
            );
          }
          // If this format is not editable, insert an unspported Edit Metadata
          // template
          else {
            container.append(
              this.editMetadataTemplate({
                supported: false,
              }),
            );
          }
        }

        // Determine if this metadata can be published. The Publish feature has
        // to be enabled in the app. The model cannot already have a DOI
        let canBePublished =
          MetacatUI.appModel.get("enablePublishDOI") && !view.model.isDOI();

        // If publishing is enabled, check if only certain users and groups can
        // publish metadata
        if (canBePublished) {
          // Get the list of authorized publishers from the AppModel
          const authorizedPublishers = MetacatUI.appModel.get(
            "enablePublishDOIForSubjects",
          );
          // If the logged-in user is one of the subjects in the list or is in a
          // group that is in the list, then this metadata can be published.
          // Otherwise, it cannot.
          if (
            Array.isArray(authorizedPublishers) &&
            authorizedPublishers.length
          ) {
            if (
              MetacatUI.appUserModel.hasIdentityOverlap(authorizedPublishers)
            ) {
              canBePublished = true;
            } else {
              canBePublished = false;
            }
          }
        }

        // If this metadata can be published, then insert the Publish button
        // template
        if (canBePublished) {
          // Insert a Publish button template
          container.append(
            view.doiTemplate({
              isAuthorized: true,
              identifier: pid,
            }),
          );
        }
      },

      /*
       * Injects Clipboard objects onto DOM elements returned from the Metacat
       * View Service. This code depends on the implementation of the Metacat
       * View Service in that it depends on elements with the class "copy" being
       * contained in the HTML returned from the View Service.
       *
       * To add more copiable buttons (or other elements) to a View Service
       * XSLT, you should be able to just add something like:
       *
       *   <button class="btn copy" data-clipboard-text="your-text-to-copy">
       *      Copy </button>
       *
       * to your XSLT and this should pick it up automatically.
       */
      insertCopiables() {
        const copiables = $("#Metadata .copy");

        _.each(copiables, (copiable) => {
          const clipboard = new Clipboard(copiable);

          clipboard.on("success", (e) => {
            const el = $(e.trigger);

            $(el).html(
              $(document.createElement("span")).addClass(
                "icon icon-ok success",
              ),
            );

            // Use setTimeout instead of jQuery's built-in Events system because
            // it didn't look flexible enough to allow me update innerHTML in a
            // chain
            setTimeout(() => {
              $(el).html("Copy");
            }, 500);
          });
        });
      },

      /*
       * Inserts elements users can use to interact with this dataset:
       * - A "Copy Citation" button to copy the citation text
       */
      insertControls() {
        // Convert the support mdq formatId list to a version that JS regex
        // likes (with special characters double
        RegExp.escape = (s) => s.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\\\$&");
        const mdqFormatIds = MetacatUI.appModel.get("mdqFormatIds");

        // Check of the current formatId is supported by the current metadata
        // quality suite. If not, the 'Assessment Report' button will not be
        // displacyed in the metadata controls panel.
        const thisFormatId = this.model.get("formatId");
        let formatFound = false;
        if (mdqFormatIds !== null) {
          for (let ifmt = 0; ifmt < mdqFormatIds.length; ifmt += 1) {
            const currentFormatId = RegExp.escape(mdqFormatIds[ifmt]);
            const re = new RegExp(currentFormatId);
            formatFound = re.test(thisFormatId);
            if (formatFound) {
              break;
            }
          }
        }

        // Get template
        const controlsContainer = this.controlsTemplate({
          citationTarget: this.citationContainer,
          url: window.location,
          displayQualtyReport:
            MetacatUI.appModel.get("mdqBaseUrl") &&
            formatFound &&
            MetacatUI.appModel.get("displayDatasetQualityMetric"),
          showWholetale: MetacatUI.appModel.get("showWholeTaleFeatures"),
          model: this.model.toJSON(),
        });

        $(this.controlsContainer).html(controlsContainer);

        // Insert the info icons
        this.renderInfoIcons();

        if (MetacatUI.appModel.get("showWholeTaleFeatures")) {
          this.createWholeTaleButton();
        }

        // Show the citation modal with the ability to copy the citation text
        // when the "Copy Citation" button is clicked
        const citeButton = this.el.querySelector("#cite-this-dataset-btn");
        this.citationModal = new CitationModalView({
          model: this.model,
          createLink: true,
        });
        this.subviews.push(this.citationModal);
        this.citationModal.render();
        if (citeButton) {
          citeButton.removeEventListener("click", this.citationModal);
          citeButton.addEventListener(
            "click",
            () => {
              this.citationModal.show();
            },
            false,
          );
        }
      },

      /**
       * Add the info icons to the metadata controls panel. Shows if the dataset
       * is private or archived.
       * @since 0.0.0
       */
      renderInfoIcons() {
        const isPrivate = !this.model.get("isPublic");
        const isArchived = this.model.get("archived");
        if (!isPrivate && !isArchived) return;

        if (isPrivate) {
          this.addInfoIcon(
            "private",
            "icon-lock",
            "private",
            "This is a private dataset.",
          );
        }
        if (isArchived) {
          this.addInfoIcon(
            "archived",
            "icon-trash",
            "danger",
            "This dataset has been archived.",
          );
        }
      },

      /**
       * Add an info icon to the metadata controls panel.
       * @param {string} iconType - The type of icon to add.
       * @param {string} iconClass - The class
       * @param {string} baseClass - The base class
       * @param {string} titleText - The text to display when the icon is hovered
       * over.
       * @returns {HTMLElement} The icon element that was added to the view.
       * @since 0.0.0
       */
      addInfoIcon(iconType, iconClass, baseClass, titleText) {
        const iconHTML = `<span class="${iconType} icons">
            <span class="icon-stack ${iconType} tooltip-this"
                  data-toggle="tooltip"
                  data-placement="top"
                  data-container="#metadata-controls-container"
                  title="${titleText}">
              <i class="icon icon-circle icon-stack-base ${baseClass}"></i>
              <i class="icon ${iconClass} icon-stack-top"></i>
            </span>
          </span>`;

        // Convert the string into DOM element so we can return it
        const range = document.createRange();
        const newIconFragment = range.createContextualFragment(iconHTML);
        const newIcon = newIconFragment.firstChild;

        const iconContainerClass = "info-icons";
        let iconContainer = this.el.querySelector(`.${iconContainerClass}`);
        if (!iconContainer) {
          iconContainer = $(document.createElement("span")).addClass(
            iconContainerClass,
          );
          this.$(".metrics-container").prepend(iconContainer);
        }

        iconContainer.append(newIcon);

        return newIcon;
      },

      /**
       *Creates a button which the user can click to launch the package in Whole
       *Tale
       */
      createWholeTaleButton() {
        const self = this;
        MetacatUI.appModel.get("taleEnvironments").forEach((environment) => {
          const queryParams = `?uri=${
            window.location.href
          }&title=${encodeURIComponent(
            self.model.get("title"),
          )}&environment=${environment}&api=${MetacatUI.appModel.get(
            "d1CNBaseUrl",
          )}${MetacatUI.appModel.get("d1CNService")}`;
          const composeUrl =
            MetacatUI.appModel.get("dashboardUrl") + queryParams;
          const anchor = $("<a>");
          anchor
            .attr("href", composeUrl)
            .append($("<span>").attr("class", "tab").append(environment));
          anchor.attr("target", "_blank");
          $(".analyze.dropdown-menu").append($("<li>").append(anchor));
        });
      },

      /** Insert the Metric Stats */
      insertMetricsControls() {
        // Exit if metrics shouldn't be shown for this dataset
        if (this.model.hideMetrics()) {
          return;
        }

        const pidList = [];
        pidList.push(this.pid);
        const metricsModel = new MetricsModel({
          pid_list: pidList,
          type: "dataset",
        });
        metricsModel.fetch();
        this.metricsModel = metricsModel;

        // Retreive the model from the server for the given PID TODO: Create a
        // Metric Request Object

        if (MetacatUI.appModel.get("displayDatasetMetrics")) {
          const buttonToolbar = this.$(".metrics-container");

          if (MetacatUI.appModel.get("displayDatasetDownloadMetric")) {
            const dwnldsMetricView = new MetricView({
              metricName: "Downloads",
              model: metricsModel,
              pid: this.pid,
            });
            buttonToolbar.append(dwnldsMetricView.render().el);
            this.subviews.push(dwnldsMetricView);
          }

          if (MetacatUI.appModel.get("displayDatasetCitationMetric")) {
            const citationsMetricView = new MetricView({
              metricName: "Citations",
              model: metricsModel,
              pid: this.pid,
            });
            buttonToolbar.append(citationsMetricView.render().el);
            this.subviews.push(citationsMetricView);

            // Check if the registerCitation=true query string is set
            if (window.location.search) {
              if (
                window.location.search.indexOf("registerCitation=true") > -1
              ) {
                // Open the modal for the citations
                citationsMetricView.showMetricModal();

                // Show the register citation form
                if (citationsMetricView.modalView) {
                  citationsMetricView.modalView.on(
                    "renderComplete",
                    citationsMetricView.modalView.showCitationForm,
                  );
                }
              }
            }
          }

          if (MetacatUI.appModel.get("displayDatasetViewMetric")) {
            const viewsMetricView = new MetricView({
              metricName: "Views",
              model: metricsModel,
              pid: this.pid,
            });
            buttonToolbar.append(viewsMetricView.render().el);
            this.subviews.push(viewsMetricView);
          }
        }
      },

      /**
       * Check if the DataPackage provenance parsing has completed. If it has,
       * draw provenance charts. If it hasn't start the parseProv function. The
       * view must have the DataPackage collection set as view.dataPackage for
       * this function to run.
       */
      checkForProv() {
        if (!this.dataPackage) {
          return;
        }
        // Render the provenance trace using the redrawProvCharts function
        // instead of the drawProvCharts function just in case the prov charts
        // have already been inserted. Redraw will make sure they are removed
        // before being re-inserted.
        if (this.dataPackage.provenanceFlag === "complete") {
          this.redrawProvCharts(this.dataPackage);
        } else {
          this.listenToOnce(this.dataPackage, "queryComplete", () => {
            this.redrawProvCharts(this.dataPackage);
          });
          // parseProv triggers "queryComplete"
          this.dataPackage.parseProv();
        }
      },

      /**
       * Renders ProvChartViews on the page to display provenance on a package
       * level and on an individual object level. This function looks at four
       * sources for the provenance - the package sources, the package
       * derivations, member sources, and member derivations
       * @param {DataPackage} collection - The DataPackage collection to render
       * provenance for
       */
      drawProvCharts(collection) {
        const dataPackage = collection || this.dataPackage;
        const view = this;
        // Set a listener to re-draw the prov charts when needed
        this.stopListening(dataPackage, "redrawProvCharts");
        this.listenToOnce(
          dataPackage,
          "redrawProvCharts",
          this.redrawProvCharts,
        );

        // Provenance has to be retrieved from the Package Model
        // (getProvTrace()) before the charts can be drawn
        if (dataPackage.provenanceFlag !== "complete") return;

        // If the user is authorized to edit the provenance for this package
        // then turn on editing, so that edit icons are displayed.
        let editModeOn =
          this.dataPackage.packageModel.get("isAuthorized_write");

        // If this content is archived, then turn edit mode off
        if (this.model.get("archived")) {
          editModeOn = false;
        }

        // If none of the models in this package have the formatId attributes,
        // we should fetch the DataPackage since it likely has only had a
        // shallow fetch so far
        const formats = _.compact(dataPackage.pluck("formatId"));

        // If the number of formatIds is less than the number of models in this
        // collection, then we need to get them.
        if (formats.length < dataPackage.length) {
          let modelsToMerge = [];

          // Get the PackageModel associated with this view
          if (this.packageModels.length) {
            // Get the PackageModel for this DataPackage
            const packageModel = _.find(
              this.packageModels,
              (model) => model.get("id") === dataPackage.id,
            );

            // Merge the SolrResult models into the DataONEObject models
            if (packageModel && packageModel.get("members").length) {
              modelsToMerge = packageModel.get("members");
            }
          }

          // If there is at least one model to merge into this data package, do
          // so
          if (modelsToMerge.length) {
            dataPackage.mergeModels(modelsToMerge);
          }
          // If there are no models to merge in, get them from the index
          else {
            // Listen to the DataPackage fetch to complete and re-execute this
            // function
            this.listenToOnce(dataPackage, "complete", () => {
              this.drawProvCharts(dataPackage);
            });

            // Create a query that searches for all the members of this
            // DataPackage in Solr
            dataPackage.solrResults.currentquery = `${dataPackage.filterModel.getQuery()}%20AND%20-formatType:METADATA`;
            dataPackage.solrResults.fields = "id,seriesId,formatId,fileName";
            dataPackage.solrResults.rows = dataPackage.length;
            dataPackage.solrResults.sort = null;
            dataPackage.solrResults.start = 0;
            dataPackage.solrResults.facet = [];
            dataPackage.solrResults.stats = null;

            // Fetch the data package with the "fromIndex" option
            dataPackage.fetch({ fromIndex: true });

            // Exit this function since it will be executed again when the fetch
            // is complete
            return;
          }
        }
        // Draw two flow charts to represent the sources and derivations at a
        // package level
        const packageSources = dataPackage.sourcePackages;
        const packageDerivations = dataPackage.derivationPackages;

        if (Object.keys(packageSources).length) {
          const sourceProvChart = new ProvChart({
            sources: packageSources,
            context: dataPackage,
            contextEl: this.$(this.articleContainer),
            dataPackage,
            parentView: view,
          });
          this.subviews.push(sourceProvChart);
          this.$(this.articleContainer).before(sourceProvChart.render().el);
        }
        if (Object.keys(packageDerivations).length) {
          const derivationProvChart = new ProvChart({
            derivations: packageDerivations,
            context: dataPackage,
            contextEl: this.$(this.articleContainer),
            dataPackage,
            parentView: view,
          });
          this.subviews.push(derivationProvChart);
          this.$(this.articleContainer).after(derivationProvChart.render().el);
        }

        if (
          dataPackage.sources.length ||
          dataPackage.derivations.length ||
          editModeOn
        ) {
          // Draw the provenance charts for each member of this package at an
          // object level
          _.each(dataPackage.toArray(), (member, _i) => {
            // Don't draw prov charts for metadata objects.
            if (
              member.get("type").toLowerCase() === "metadata" ||
              member.get("formatType").toLowerCase() === "metadata"
            ) {
              return;
            }
            const entityDetailsSection =
              view.findEntityDetailsContainer(member);

            if (!entityDetailsSection) {
              return;
            }

            // Retrieve the sources and derivations for this member
            const memberSources = member.get("provSources") || [];
            const memberDerivations = member.get("provDerivations") || [];

            // Make the source chart for this member. If edit is on, then either
            // a 'blank' sources ProvChart will be displayed if there are no
            // sources for this member, or edit icons will be displayed with
            // prov icons.
            if (memberSources.length || editModeOn) {
              const memberSourcesProvChart = new ProvChart({
                sources: memberSources,
                context: member,
                contextEl: entityDetailsSection,
                dataPackage,
                parentView: view,
                editModeOn,
                editorType: "sources",
              });
              view.subviews.push(memberSourcesProvChart);
              $(entityDetailsSection).before(
                memberSourcesProvChart.render().el,
              );
              view.$(view.articleContainer).addClass("gutters");
            }

            // Make the derivation chart for this member If edit is on, then
            // either a 'blank' derivations ProvChart will be displayed if
            // there, are no derivations for this member or edit icons will be
            // displayed with prov icons.
            if (memberDerivations.length || editModeOn) {
              const memberDerivationsProvChart = new ProvChart({
                derivations: memberDerivations,
                context: member,
                contextEl: entityDetailsSection,
                dataPackage,
                parentView: view,
                editModeOn,
                editorType: "derivations",
              });
              view.subviews.push(memberDerivationsProvChart);
              $(entityDetailsSection).after(
                memberDerivationsProvChart.render().el,
              );
              view.$(view.articleContainer).addClass("gutters");
            }
          });
        }

        // Make all of the prov chart nodes look different based on id
        if (this.$(".prov-chart").length > 10000) {
          const allNodes = this.$(".prov-chart .node");
          let ids = [];
          let i = 1;

          $(allNodes).each(() => {
            ids.push($(this).attr("data-id"));
          });
          ids = _.uniq(ids);

          _.each(ids, (id) => {
            const matchingNodes = view
              .$(`.prov-chart .node[data-id='${id}']`)
              .not(".editorNode");
            // var matchingEntityDetails = view.findEntityDetailsContainer(id);

            // Don't use the unique class on images since they will look a lot
            // different anyway by their image
            if (!$(matchingNodes).first().hasClass("image")) {
              const className = `uniqueNode${i}`;

              // Add the unique class and up the iterator
              if (matchingNodes.prop("tagName") !== "polygon")
                $(matchingNodes).addClass(className);
              else
                $(matchingNodes).attr(
                  "class",
                  `${$(matchingNodes).attr("class")} ${className}`,
                );

              /*  if(matchingEntityDetails)
                    $(matchingEntityDetails).addClass(className); */

              // Save this id->class mapping in this view
              view.classMap.push({
                id,
                className,
              });
              i += 1;
            }
          });
        }
      },

      /**
       * Step through all prov charts and re-render each one that has been
       * marked for re-rendering.
       */
      redrawProvCharts() {
        const view = this;

        // Check if prov edits are active and turn on the prov save bar if so.
        // Alternatively, turn off save bar if there are no prov edits, which
        // could occur if a user undoes a previous which could result in an
        // empty edit list.
        if (this.dataPackage.provEditsPending()) {
          this.showEditorControls();
        } else {
          this.hideEditorControls();

          this.dataPackage.toArray().forEach((item) => {
            // eslint-disable-next-line no-param-reassign
            item.selectedInEditor = false;
          });
        }
        _.each(this.subviews, (thisView, _i) => {
          // Check if this is a ProvChartView
          if (
            thisView.className &&
            thisView.className.indexOf("prov-chart") !== -1
          ) {
            // Check if this ProvChartView is marked for re-rendering Erase the
            // current ProvChartView
            thisView.onClose();
          }
        });

        // Remove prov charts from the array of subviews.
        this.subviews = _.filter(
          this.subviews,
          (item) =>
            item.className && item.className.indexOf("prov-chart") === -1,
        );

        view.drawProvCharts(this.dataPackage);
      },

      /**
       * When the data package collection saves successfully, tell the user
       * @param {DataPackage} savedObject - The object that was saved
       */
      saveSuccess(savedObject) {
        // We only want to perform these actions after the package saves
        if (savedObject.type !== "DataPackage") return;

        // Change the URL to the new id
        MetacatUI.uiRouter.navigate(
          `view/${this.dataPackage.packageModel.get("id")}`,
          { trigger: false, replace: true },
        );

        const message = $(document.createElement("div")).append(
          $(document.createElement("span")).text(
            "Your changes have been saved. ",
          ),
        );

        MetacatUI.appView.showAlert(message, "alert-success", "body", 4000, {
          remove: false,
        });

        // Reset the state to clean
        this.dataPackage.packageModel.set("changed", false);

        // If provenance relationships were updated, then reset the edit list
        // now.
        if (this.dataPackage.provEdits.length) this.dataPackage.provEdits = [];

        this.saveProvPending = false;
        this.hideSaving();
        this.stopListening(this.dataPackage, "errorSaving", this.saveError);

        // Turn off "save" footer
        this.hideEditorControls();

        // Update the metadata table header with the new resource map id. First
        // find the DataPackageView for the top level package, and then
        // re-render it with the update resmap id.
        const view = this;
        const metadataId = this.packageModels[0].getMetadata().get("id");
        _.each(this.subviews, (thisView, _i) => {
          // Check if this is a ProvChartView
          if (thisView.type && thisView.type.indexOf("DataPackage") !== -1) {
            if (thisView.currentlyViewing === metadataId) {
              const packageId = view.dataPackage.packageModel.get("id");
              const title = packageId
                ? `<span class="subtle">Package: ${packageId}</span>`
                : "";

              // eslint-disable-next-line no-param-reassign
              thisView.title = `Files in this dataset ${title}`;
              thisView.render();
            }
          }
        });
      },

      /**
       * When the data package collection fails to save, tell the user
       * @param {string} errorMsg - The error message to display
       */
      saveError(errorMsg) {
        const errorId = `error${Math.round(Math.random() * 100)}`;
        const message = $(document.createElement("div")).append(
          "<p>Your changes could not be saved.</p>",
        );

        message.append(
          $(document.createElement("a"))
            .text("See details")
            .attr("data-toggle", "collapse")
            .attr("data-target", `#${errorId}`)
            .addClass("pointer"),
          $(document.createElement("div"))
            .addClass("collapse")
            .attr("id", errorId)
            .append($(document.createElement("pre")).text(errorMsg)),
        );

        MetacatUI.appView.showAlert(message, "alert-error", "body", null, {
          emailBody: `Error message: Data Package save error: ${errorMsg}`,
          remove: true,
        });

        this.saveProvPending = false;
        this.hideSaving();
        this.stopListening(this.dataPackage, "successSaving", this.saveSuccess);

        // Turn off "save" footer
        this.hideEditorControls();
      },

      /**
       * If provenance relationships have been modified by the provenance editor
       * (in ProvChartView), then update the ORE Resource Map and save it to the
       * server.
       */
      saveProv() {
        // Only call this function once per save operation.
        if (this.saveProvPending) return;

        if (this.dataPackage.provEditsPending()) {
          this.saveProvPending = true;
          // If the Data Package failed saving, display an error message
          this.listenToOnce(this.dataPackage, "errorSaving", this.saveError);
          // Listen for when the package has been successfully saved
          this.listenToOnce(
            this.dataPackage,
            "successSaving",
            this.saveSuccess,
          );
          this.showSaving();
          this.dataPackage.saveProv();
        } else {
          // TODO: should a dialog be displayed saying that no prov edits were
          // made?
        }
      },

      /** Inactivate the save button during the save process */
      showSaving() {
        this.$("#save-metadata-prov")
          .html('<i class="icon icon-spinner icon-spin"></i> Saving...')
          .addClass("btn-disabled");

        this.$("input, textarea, select, button").prop("disabled", true);
      },

      /** Activate the save button after the save process */
      hideSaving() {
        this.$("input, textarea, select, button").prop("disabled", false);

        // When prov is saved, revert the Save button back to normal
        this.$("#save-metadata-prov").html("Save").removeClass("btn-disabled");
      },

      /** Show the editor controls */
      showEditorControls() {
        this.$("#editor-footer").slideDown();
      },

      /** Hide the editor controls */
      hideEditorControls() {
        this.$("#editor-footer").slideUp();
      },

      /**
       * Get the names of the entities in this package
       * @param {Array} packageModels - An array of models in this package
       */
      getEntityNames(packageModels) {
        const viewRef = this;

        _.each(packageModels, (packageModel) => {
          // Don't get entity names for larger packages - users must put the
          // names in the system metadata
          if (packageModel.get("members").length > 100) return;

          // If this package has a different metadata doc than the one we are
          // currently viewing
          const metadataModel = packageModel.getMetadata();
          if (!metadataModel) return;

          if (metadataModel.get("id") !== viewRef.pid) {
            const requestSettings = {
              url:
                MetacatUI.appModel.get("viewServiceUrl") +
                encodeURIComponent(metadataModel.get("id")),
              success(parsedMetadata, _response, _xhr) {
                _.each(packageModel.get("members"), (solrResult, _i) => {
                  let entityName = "";

                  if (solrResult.get("formatType") === "METADATA")
                    entityName = solrResult.get("title");

                  const container = viewRef.findEntityDetailsContainer(
                    solrResult,
                    parsedMetadata,
                  );
                  if (container) entityName = viewRef.getEntityName(container);

                  // Set the entity name
                  if (entityName) {
                    solrResult.set("fileName", entityName);
                    // Update the UI with the new name
                    viewRef
                      .$(
                        `.entity-name-placeholder[data-id='${solrResult.get(
                          "id",
                        )}']`,
                      )
                      .text(entityName);
                  }
                });
              },
            };

            $.ajax(
              _.extend(
                requestSettings,
                MetacatUI.appUserModel.createAjaxSettings(),
              ),
            );

            return;
          }

          _.each(packageModel.get("members"), (solrResult, _i) => {
            let entityName = "";

            if (solrResult.get("fileName"))
              entityName = solrResult.get("fileName");
            else if (solrResult.get("formatType") === "METADATA")
              entityName = solrResult.get("title");
            else if (solrResult.get("formatType") === "RESOURCE") return;
            else {
              const container = viewRef.findEntityDetailsContainer(solrResult);

              if (container && container.length > 0)
                entityName = viewRef.getEntityName(container);
              else entityName = null;
            }

            // Set the entityName, even if it's null
            solrResult.set("fileName", entityName);
          });
        });
      },

      /**
       * Get the name of the entity in the given container element
       * @param {Element} containerEl - The DOM element that contains the entity
       * name
       * @returns {string} - The name of the entity
       */
      getEntityName(containerEl) {
        if (!containerEl) return false;

        let entityName = $(containerEl)
          .find(".entityName")
          .attr("data-entity-name");
        if (typeof entityName === "undefined" || !entityName) {
          entityName = $(containerEl)
            .find(".control-label:contains('Entity Name') + .controls-well")
            .text();
          if (typeof entityName === "undefined" || !entityName)
            entityName = null;
        }

        return entityName;
      },

      /**
       * Checks if the metadata has entity details sections
       * @returns {boolean} - True if the metadata has entity details sections
       */
      hasEntityDetails() {
        return this.$(".entitydetails").length > 0;
      },

      /**
       * Finds the element in the rendered metadata that describes the given
       * data entity.
       * @param {(DataONEObject|SolrResult|string)} model - Either a model that
       * represents the data object or the identifier of the data object
       * @param {Element} [containerEl] - The DOM element to exclusivly search
       * inside.
       * @returns {Element|null} - The DOM element that describes the given data
       * entity or null if it cannot be found.
       */
      findEntityDetailsContainer(model, containerEl) {
        const el = containerEl || this.el;

        // Get the id and file name for this data object
        let id = "";
        let fileName = "";

        // If a model is given, get the id and file name from the object
        if (
          model &&
          (model instanceof DataONEObject || model instanceof SolrResult)
        ) {
          id = model.get("id");
          fileName = model.get("fileName");
        }
        // If a string is given instead, it must be the id of the data object
        else if (typeof model === "string") {
          id = model;
        }
        // Otherwise, there isn't enough info to find the element, so exit
        else {
          return null;
        }

        // If we already found it earlier, return it now
        let container = this.$(
          `.entitydetails[data-id='${id}'], ` +
            `.entitydetails[data-id='${DataONEObject.prototype.getXMLSafeID(
              id,
            )}']`,
        );
        if (container.length) {
          // Store the PID on this element for moreInfo icons
          this.storeEntityPIDs(container, id);

          return container;
        }

        // Are we looking for the main object that this MetadataView is
        // displaying?
        if (id === this.pid) {
          if (this.$("#Metadata").length > 0) return this.$("#Metadata");
          return this.el;
        }

        // Metacat 2.4.2 and up will have the Online Distribution Link marked
        let link = this.$(`.entitydetails a[data-pid='${id}']`);

        // Otherwise, try looking for an anchor with the id matching this
        // object's id
        if (!link.length)
          link = $(el).find(`a#${id.replace(/[^A-Za-z0-9]/g, "\\$&")}`);

        // Get metadata index view
        let metadataFromIndex = _.findWhere(this.subviews, {
          type: "MetadataIndex",
        });
        if (typeof metadataFromIndex === "undefined") metadataFromIndex = null;

        // Otherwise, find the Online Distribution Link the hard way
        if (link.length < 1 && !metadataFromIndex)
          link = $(el).find(
            `.control-label:contains('Online Distribution Info') + .controls-well > a[href*='${id.replace(
              /[^A-Za-z0-9]/g,
              "\\$&",
            )}']`,
          );

        if (link.length > 0) {
          // Get the container element
          container = $(link).parents(".entitydetails");

          if (container.length < 1) {
            // backup - find the parent of this link that is a direct child of
            // the form element
            const firstLevelContainer = _.intersection(
              $(link).parents("form").children(),
              $(link).parents(),
            );
            // Find the controls-well inside of that first level container,
            // which is the well that contains info about this data object
            if (firstLevelContainer.length > 0)
              container = $(firstLevelContainer).children(".controls-well");

            if (container.length < 1 && firstLevelContainer.length > 0)
              container = firstLevelContainer;

            $(container).addClass("entitydetails");
          }

          // Add the id so we can easily find it later
          container.attr("data-id", id);

          // Store the PID on this element for moreInfo icons
          this.storeEntityPIDs(container, id);

          return container;
        }

        // ----Find by file name rather than id-----
        if (!fileName) {
          // Get the name of the object first
          for (let i = 0; i < this.packageModels.length; i += 1) {
            const packageModel = _.findWhere(
              this.packageModels[i].get("members"),
              {
                id,
              },
            );
            if (packageModel) {
              fileName = packageModel.get("fileName");
              break;
            }
          }
        }

        if (fileName) {
          const possibleLocations = [
            `.entitydetails [data-object-name='${fileName}']`,
            `.entitydetails .control-label:contains('Object Name') + .controls-well:contains('${fileName}')`,
            `.entitydetails .control-label:contains('Entity Name') + .controls-well:contains('${fileName}')`,
          ];

          // Search through each possible location in the DOM where the file
          // name might be
          for (let i = 0; i < possibleLocations.length; i += 1) {
            // Get the elements in this view that match the possible location
            const matches = this.$(possibleLocations[i]);

            // If exactly one match is found
            if (matches.length === 1) {
              // Get the entity details parent element
              container = $(matches).parents(".entitydetails").first();
              // Set the object ID on the element for easier locating later
              container.attr("data-id", id);
              if (container.length) break;
            }
          }

          if (container.length) {
            // Store the PID on this element for moreInfo icons
            this.storeEntityPIDs(container, id);

            return container;
          }
        }

        // --- The last option:---- If this package has only one item, we can
        // assume the only entity details are about that item
        const members = this.packageModels[0].get("members");
        const dataMembers = _.filter(
          members,
          (m) => m.get("formatType") === "DATA",
        );
        if (dataMembers.length === 1) {
          if (this.$(".entitydetails").length === 1) {
            this.$(".entitydetails").attr("data-id", id);
            // Store the PID on this element for moreInfo icons
            this.storeEntityPIDs(this.$(".entitydetails"), id);

            return this.$(".entitydetails");
          }
        }

        return false;
      },

      /*
       * Inserts new image elements into the DOM via the image template. Use for
       * displaying images that are part of this metadata's resource map.
       */
      insertDataDetails() {
        // If there is a metadataIndex subview, render from there.
        const metadataFromIndex = _.findWhere(this.subviews, {
          type: "MetadataIndex",
        });
        if (typeof metadataFromIndex !== "undefined") {
          _.each(this.packageModels, (packageModel) => {
            metadataFromIndex.insertDataDetails(packageModel);
          });
          return;
        }

        const viewRef = this;

        this.packageModels.forEach((packageModel) => {
          const images = [];
          const packageMembers = packageModel.get("members");

          // Don't do this for large packages
          if (packageMembers.length > 150) return;

          //= === Loop over each visual object and create a dataDisplay template
          // for it to attach to the DOM ====
          _.each(packageMembers, (solrResult, _i) => {
            // Don't display any info about nested packages
            if (solrResult.type === "Package") return;

            const objID = solrResult.get("id");

            if (objID === viewRef.pid) return;

            // Is this a visual object (image)?
            const type =
              solrResult.type === "SolrResult"
                ? solrResult.getType()
                : "Data set";
            if (type === "image") images.push(solrResult);

            // Find the part of the HTML Metadata view that describes this data
            // object
            const anchor = $(document.createElement("a")).attr(
              "id",
              objID.replace(/[^A-Za-z0-9]/g, "-"),
            );
            const container = viewRef.findEntityDetailsContainer(objID);

            // Insert the data display HTML and the anchor tag to mark this spot
            // on the page
            if (container) {
              // Only show data displays for images hosted on the same origin
              if (type === "image") {
                // Create the data display HTML
                const dataDisplay = $.parseHTML(
                  viewRef
                    .dataDisplayTemplate({
                      type,
                      src: solrResult.get("url"),
                      objID,
                    })
                    .trim(),
                );

                // Insert into the page
                if ($(container).children("label").length > 0)
                  $(container).children("label").first().after(dataDisplay);
                else $(container).prepend(dataDisplay);

                // If this image is private, we need to load it via an XHR
                // request
                if (!solrResult.get("isPublic")) {
                  // Create an XHR
                  const xhr = new XMLHttpRequest();
                  xhr.withCredentials = true;

                  xhr.onload = () => {
                    if (xhr.response)
                      $(dataDisplay)
                        .find("img")
                        .attr("src", window.URL.createObjectURL(xhr.response));
                  };

                  // Open and send the request with the user's auth token
                  xhr.open("GET", solrResult.get("url"));
                  xhr.responseType = "blob";
                  xhr.setRequestHeader(
                    "Authorization",
                    `Bearer ${MetacatUI.appUserModel.get("token")}`,
                  );
                  xhr.send();
                }
              }

              $(container).prepend(anchor);
            }

            this.renderDataInteractionButtons(solrResult, container);
          });

          //= === Initialize the fancybox images ===== We will be checking every
          // half-second if all the HTML has been loaded into the DOM - once
          // they are all loaded, we can initialize the lightbox functionality.
          const numImages = images.length;
          // The shared lightbox options for both images
          const lightboxOptions = {
            prevEffect: "elastic",
            nextEffect: "elastic",
            closeEffect: "elastic",
            openEffect: "elastic",
            aspectRatio: true,
            closeClick: true,
            afterLoad() {
              // Create a custom HTML caption based on data stored in the DOM
              // element
              viewRef.title = `${viewRef.title} <a href='${viewRef.href}' class='btn' target='_blank'>Download</a> `;
            },
            helpers: {
              title: {
                type: "outside",
              },
            },
          };

          if (numImages > 0) {
            let numImgChecks = 0; // Keep track of how many interval checks we have so we don't wait forever for images to load
            const lightboxImgSelector =
              "a[class^='fancybox'][data-fancybox-type='image']";

            // Add additional options for images
            const imgLightboxOptions = lightboxOptions;
            imgLightboxOptions.type = "image";
            imgLightboxOptions.perload = 1;

            const initializeImgLightboxes = () => {
              numImgChecks += 1;

              // Initialize what images have loaded so far after 5 seconds
              if (numImgChecks === 10) {
                $(lightboxImgSelector).fancybox(imgLightboxOptions);
              }
              // When 15 seconds have passed, stop checking so we don't blow up
              // the browser
              else if (numImgChecks > 30) {
                $(lightboxImgSelector).fancybox(imgLightboxOptions);
                window.clearInterval(viewRef.imgIntervalID);
                return;
              }

              // Are all of our images loaded yet?
              if (viewRef.$(lightboxImgSelector).length < numImages) return;

              // Initialize our lightboxes
              $(lightboxImgSelector).fancybox(imgLightboxOptions);

              // We're done - clear the interval
              window.clearInterval(viewRef.imgIntervalID);
            };

            viewRef.imgIntervalID = window.setInterval(
              initializeImgLightboxes,
              500,
            );
          }
        });
      },

      /**
       * Insert the buttons to download and view the data object
       * @param {SolrResult} solrResult - The SolrResult model for the object
       * @param {Element} container - The DOM element that contains the object's
       * metadata
       * @since 0.0.0
       */
      renderDataInteractionButtons(solrResult, container) {
        if (!solrResult || !container) return;
        const buttonsContainer = document.createElement("div");
        buttonsContainer.classList.add(
          "control-group",
          "data-interaction-buttons",
        );
        const nameLabel = $(container).find("label:contains('Entity Name')");
        // Create a button to download the data object
        const downloadButton = new DownloadButtonView({
          model: solrResult,
        });
        downloadButton.render();
        const viewButton = new ViewObjectButtonView({
          model: solrResult,
          modalContainer: this.$el,
        });
        viewButton.render();

        $(buttonsContainer).append(downloadButton.el, viewButton.el);
        if (nameLabel.length) {
          $(nameLabel).parent().after(buttonsContainer);
        } else {
          $(container).prepend(buttonsContainer);
        }
      },

      /** Remove ecogrid links and replace them with workable links */
      replaceEcoGridLinks() {
        // Find the element in the DOM housing the ecogrid link
        $("a:contains('ecogrid://')").each((i, thisLink) => {
          // Get the link text
          const linkText = $(thisLink).text();

          // Clean up the link text
          const withoutPrefix = linkText.substring(
            linkText.indexOf("ecogrid://") + 10,
          );
          const pid = withoutPrefix.substring(withoutPrefix.indexOf("/") + 1);
          const baseUrl =
            MetacatUI.appModel.get("resolveServiceUrl") ||
            MetacatUI.appModel.get("objectServiceUrl");

          $(thisLink)
            .attr("href", baseUrl + encodeURIComponent(pid))
            .text(pid);
        });
      },

      /**
       * Publish the data package with a DOI
       * @param {Event} event - The click event
       */
      publish(event) {
        // target may not actually prevent click events, so double check
        const disabled = $(event.target).closest("a").attr("disabled");
        if (disabled) {
          return;
        }
        const publishServiceUrl = MetacatUI.appModel.get("publishServiceUrl");
        const pid = $(event.target).closest("a").attr("pid");
        // eslint-disable-next-line no-restricted-globals, no-alert
        const ret = confirm(
          `Are you sure you want to publish ${pid} with a DOI?`,
        ); // TODO: We should use a custom modal here instead of the browser's confirm dialog

        if (ret) {
          // show the loading icon
          const message = "Publishing package...this may take a few moments";
          this.showLoading(message);

          let identifier = null;
          const viewRef = this;
          const requestSettings = {
            url: publishServiceUrl + pid,
            type: "PUT",
            xhrFields: {
              withCredentials: true,
            },
            success(data, _textStatus, _xhr) {
              // the response should have new identifier in it
              identifier = $(data).find("d1\\:identifier, identifier").text();

              if (identifier) {
                viewRef.hideLoading();
                const msg = `Published data package '${identifier}'. If you are not redirected soon, you can view your <a href='${
                  MetacatUI.root
                }/view/${encodeURIComponent(
                  identifier,
                )}'>published data package here</a>`;
                viewRef.$el.find(".container").prepend(
                  viewRef.alertTemplate({
                    msg,
                    classes: "alert-success",
                  }),
                );

                // navigate to the new view after a few seconds
                setTimeout(() => {
                  // avoid a double fade out/in
                  viewRef.$el.html("");
                  viewRef.showLoading();
                  MetacatUI.uiRouter.navigate(`view/${identifier}`, {
                    trigger: true,
                  });
                }, 3000);
              }
            },
            error(xhr, _textStatus, _errorThrown) {
              // show the error message, but stay on the same page
              const msg = `Publish failed: ${$(xhr.responseText)
                .find("description")
                .text()}`;

              viewRef.hideLoading();
              viewRef.showError(msg);
            },
          };

          $.ajax(
            _.extend(
              requestSettings,
              MetacatUI.appUserModel.createAjaxSettings(),
            ),
          );
        }
      },

      /**
       * When the given ID from the URL is a resource map that has no metadata,
       * render metadata from the index instead.
       * @param {SolrResult} solrResultModel - The SolrResult model for the
       * resource map
       */
      noMetadata(solrResultModel) {
        this.hideLoading();
        this.$el.html(this.template());

        this.pid =
          solrResultModel.get("resourceMap") || solrResultModel.get("id");

        // Insert breadcrumbs
        this.insertBreadcrumbs();

        this.insertDataSource();

        // Insert a table of contents
        this.insertPackageTable(solrResultModel);

        this.renderMetadataFromIndex();

        // Insert a message that this data is not described by metadata
        MetacatUI.appView.showAlert(
          "Additional information about this data is limited since metadata was not provided by the creator.",
          "alert-warning",
          this.$(this.metadataContainer),
        );
      },

      /** Lokup the latest version of the PID and display a link to it */
      showLatestVersion() {
        // If this metadata doc is not obsoleted by a new version, then exit the
        // function
        if (!this.model.get("obsoletedBy")) {
          return;
        }

        const view = this;

        // When the latest version is found,
        this.listenTo(this.model, "change:newestVersion", () => {
          // Make sure it has a newer version, and if so,
          if (view.model.get("newestVersion") !== view.model.get("id")) {
            // Put a link to the newest version in the content
            view.$(".newer-version").replaceWith(
              view.versionTemplate({
                pid: view.model.get("newestVersion"),
              }),
            );
          } else {
            view.$(".newer-version").remove();
          }
        });

        // Insert the newest version template with a loading message
        this.$el.prepend(
          this.versionTemplate({
            loading: true,
          }),
        );

        // Find the latest version of this metadata object
        this.model.findLatestVersion();
      },

      /**
       * Indicate that the metadata is being loaded
       * @param {string} message - The message to display while loading
       */
      showLoading(message) {
        this.hideLoading();

        MetacatUI.appView.scrollToTop();

        const loading = this.loadingTemplate({ msg: message });
        if (!loading) return;

        this.$loading = $($.parseHTML(loading));
        this.$detached = this.$el.children().detach();

        this.$el.html(loading);
      },

      /** Hide the loading message */
      hideLoading() {
        if (this.$loading) this.$loading.remove();
        if (this.$detached) this.$el.html(this.$detached);
      },

      /**
       * Show an error message to the user
       * @param {string} msg - The error message to display
       */
      showError(msg) {
        // Remove any existing error messages
        this.$el.children(".alert-container").remove();

        this.$el.prepend(
          this.alertTemplate({
            msg,
            classes: "alert-error",
            containerClasses: "page",
            includeEmail: true,
          }),
        );
      },

      /**
       * When the "Metadata" button in the table is clicked while we are on the
       * Metadata view, we want to scroll to the anchor tag of this data object
       * within the page instead of navigating to the metadata page again, which
       * refreshes the page and re-renders (more loading time)
       * @param {Event} e - The click event
       * @returns {boolean} - Returns false if the click event should not be
       * followed
       */
      previewData(e) {
        // Don't go anywhere yet...
        e.preventDefault();

        // Get the target and id of the click
        let link = $(e.target);
        if (!$(link).hasClass("preview")) link = $(link).parents("a.preview");

        if (!link?.length) return false;

        const id = $(link).attr("data-id");

        // This will make the app defualt to the child view previewData function
        if (!id) return false;

        // If we are on the Metadata view, update the  URL and scroll to the
        // anchor
        window.location.hash = encodeURIComponent(id);
        MetacatUI.appView.scrollTo(this.findEntityDetailsContainer(id));

        return true;
      },

      /**
       * Try to scroll to the section on a page describing the identifier in the
       * fragment/hash portion of the current page.
       *
       * This function depends on there being an `id` dataset attribute on an
       * element on the page set to an XML-safe version of the value in the
       * fragment/hash. Used to provide direct links to sub-resources on a page.
       */
      scrollToFragment() {
        const { hash } = window.location;

        if (!hash || hash.length <= 1) {
          return;
        }

        // Get the id from the URL hash and decode it
        const idFragment = decodeURIComponent(hash.substring(1));

        // Find the corresponding entity details section for this id
        const entityDetailsEl = this.findEntityDetailsContainer(idFragment);

        if (entityDetailsEl || entityDetailsEl.length) {
          MetacatUI.appView.scrollTo(entityDetailsEl);
        }
      },

      /**
       * Navigate to a new /view URL with a fragment
       *
       * Used in getModel() when the pid originally passed into MetadataView is
       * not a metadata PID but is, instead, a data PID. getModel() does the
       * work of finding an appropriate metadata PID for the data PID and this
       * method handles re-routing to the correct URL.
       * @param {string} metadataPid - The new metadata PID
       * @param {string} dataPid - Optional. A data PID that's part of the
       *   package metadataPid exists within.
       */
      navigateWithFragment(metadataPid, dataPid) {
        let nextRoute = `view/${encodeURIComponent(metadataPid)}`;

        if (typeof dataPid === "string" && dataPid.length > 0) {
          nextRoute += `#${encodeURIComponent(dataPid)}`;
        }

        MetacatUI.uiRouter.navigate(nextRoute, { trigger: true });
      },

      /**
       * Close any active popovers when the user clicks outside of them
       * @param {Event} e - The click event
       */
      closePopovers(e) {
        // If this is a popover element or an element that has a popover, don't
        // close anything. Check with the .classList attribute to account for
        // SVG elements
        const svg = $(e.target).parents("svg");

        if (
          _.contains(e.target.classList, "popover-this") ||
          $(e.target).parents(".popover-this").length > 0 ||
          $(e.target).parents(".popover").length > 0 ||
          _.contains(e.target.classList, "popover") ||
          (svg.length && _.contains(svg[0].classList, "popover-this"))
        )
          return;

        // Close all active popovers
        this.$(".popover-this.active").popover("hide");
      },

      /**
       * When the user clicks on a node in the provenance chart, highlight the
       * node and its metadata section
       * @param {Event} e - The click event
       */
      highlightNode(e) {
        // Find the id
        let id = $(e.target).attr("data-id");

        if (typeof id === "undefined" || !id)
          id = $(e.target).parents("[data-id]").attr("data-id");

        // If there is no id, return
        if (typeof id === "undefined") return;

        // Highlight its node
        $(`.prov-chart .node[data-id='${id}']`).toggleClass("active");

        // Highlight its metadata section
        if (MetacatUI.appModel.get("pid") === id)
          this.$("#Metadata").toggleClass("active");
        else {
          const entityDetails = this.findEntityDetailsContainer(id);
          if (entityDetails) entityDetails.toggleClass("active");
        }
      },

      /** Actions to perform when the view is closed */
      onClose() {
        this.stopListening();

        _.each(this.subviews, (subview) => {
          if (subview.onClose) subview.onClose();
        });

        this.packageModels = [];
        this.model.set(this.model.defaults);
        this.pid = null;
        this.dataPackage = null;
        this.seriesId = null;
        this.$detached = null;
        this.$loading = null;

        // Put the document title back to the default
        MetacatUI.appModel.resetTitle();

        // Remove view-specific classes
        this.$el.removeClass("container no-stylesheet");

        this.$el.empty();
      },

      /**
       * Generate a string appropriate to go into the author/creator portion of
       * a dataset citation from the value stored in the underlying model's
       * origin field.
       * @returns {string} - A string of author names, formatted for citation
       */
      getAuthorText() {
        const authors = this.model.get("origin");
        let count = 0;
        let authorText = "";

        _.each(authors, (author) => {
          count += 1;

          if (count === 6) {
            authorText += ", et al. ";
            return;
          }
          if (count > 6) {
            return;
          }

          if (count > 1) {
            if (authors.length > 2) {
              authorText += ",";
            }

            if (count === authors.length) {
              authorText += " and";
            }

            if (authors.length > 1) {
              authorText += " ";
            }
          }

          authorText += author;
        });

        return authorText;
      },

      /**
       * Generate a string appropriate to be used in the publisher portion of a
       * dataset citation. This method falls back to the node ID when the proper
       * node name cannot be fetched from the app's NodeModel instance.
       * @returns {string} - A string of the publisher name, formatted for
       * citation
       */
      getPublisherText() {
        const datasource = this.model.get("datasource");
        const memberNode = MetacatUI.nodeModel.getMember(datasource);

        if (memberNode) {
          return memberNode.name;
        }
        return datasource;
      },

      /**
       * Generate a string appropriate to be used as the publication date in a
       * dataset citation.
       * @returns {string} - A string of the publication date, formatted for
       * citation
       */
      getDatePublishedText() {
        // Dataset/datePublished Prefer pubDate, fall back to dateUploaded so we
        // have something to show
        if (this.model.get("pubDate") !== "") {
          return this.model.get("pubDate");
        }
        return this.model.get("dateUploaded");
      },

      /**
       * Generate Schema.org-compliant JSONLD for the model bound to the view
       *  into the head tag of the page by `insertJSONLD`.
       *
       * Note: `insertJSONLD` should be called to do the actual inserting into
       * the DOM.
       * @returns {object} - JSON-LD object for the model bound to the view
       */
      generateJSONLD() {
        const { model } = this;

        // First: Create a minimal Schema.org Dataset with just the fields we
        // know will come back from Solr (System Metadata fields). Add the rest
        // in conditional on whether they are present.
        const elJSON = {
          "@context": {
            "@vocab": "https://schema.org/",
          },
          "@type": "Dataset",
          "@id": `https://dataone.org/datasets/${encodeURIComponent(
            model.get("id"),
          )}`,
          datePublished: this.getDatePublishedText(),
          dateModified: model.get("dateModified"),
          publisher: {
            "@type": "Organization",
            name: this.getPublisherText(),
          },
          identifier: this.generateSchemaOrgIdentifier(model.get("id")),
          version: model.get("version"),
          url: `https://dataone.org/datasets/${encodeURIComponent(
            model.get("id"),
          )}`,
          schemaVersion: model.get("formatId"),
          isAccessibleForFree: true,
        };

        // Attempt to add in a sameAs property of we have high confidence the
        // identifier is a DOI
        if (this.model.isDOI(model.get("id"))) {
          const doi = this.getCanonicalDOIIRI(model.get("id"));

          if (doi) {
            elJSON.sameAs = doi;
          }
        }

        // Second: Add in optional fields

        // Name
        if (model.get("title")) {
          elJSON.name = model.get("title");
        }

        // Creator
        if (model.get("origin")) {
          elJSON.creator = model.get("origin").map((creator) => ({
            "@type": "Person",
            name: creator,
          }));
        }

        // Dataset/spatialCoverage
        if (
          model.get("northBoundCoord") &&
          model.get("eastBoundCoord") &&
          model.get("southBoundCoord") &&
          model.get("westBoundCoord")
        ) {
          const spatialCoverage = {
            "@type": "Place",
            additionalProperty: [
              {
                "@type": "PropertyValue",
                additionalType:
                  "http://dbpedia.org/resource/Coordinate_reference_system",
                name: "Coordinate Reference System",
                value: "http://www.opengis.net/def/crs/OGC/1.3/CRS84",
              },
            ],
            geo: this.generateSchemaOrgGeo(
              model.get("northBoundCoord"),
              model.get("eastBoundCoord"),
              model.get("southBoundCoord"),
              model.get("westBoundCoord"),
            ),
            subjectOf: {
              "@type": "CreativeWork",
              fileFormat: "application/vnd.geo+json",
              text: this.generateGeoJSONString(
                model.get("northBoundCoord"),
                model.get("eastBoundCoord"),
                model.get("southBoundCoord"),
                model.get("westBoundCoord"),
              ),
            },
          };

          elJSON.spatialCoverage = spatialCoverage;
        }

        // Dataset/temporalCoverage
        if (model.get("beginDate") && !model.get("endDate")) {
          elJSON.temporalCoverage = model.get("beginDate");
        } else if (model.get("beginDate") && model.get("endDate")) {
          elJSON.temporalCoverage = `${model.get("beginDate")}/${model.get("endDate")}`;
        }

        // Dataset/variableMeasured
        if (model.get("attributeName")) {
          elJSON.variableMeasured = model.get("attributeName");
        }

        // Dataset/description
        if (model.get("abstract")) {
          elJSON.description = model.get("abstract");
        } else {
          const datasetsUrl = `https://dataone.org/datasets/${encodeURIComponent(
            model.get("id"),
          )}`;
          elJSON.description = `No description is available. Visit ${datasetsUrl} for complete metadata about this dataset.`;
        }

        // Dataset/keywords
        if (model.get("keywords")) {
          elJSON.keywords = model.get("keywords").join(", ");
        }

        return elJSON;
      },

      /**
       * Insert Schema.org-compliant JSONLD for the model bound to the view into
       * the head tag of the page (at the end).
       * @param {object} json - JSON-LD to insert into the page
       *
       * Some notes:
       *
       * - Checks if the JSONLD already exists from the previous data view
       * - If not create a new script tag and append otherwise replace the text
       *   for the script
       */
      insertJSONLD(json) {
        if (!document.getElementById("jsonld")) {
          const el = document.createElement("script");
          el.type = "application/ld+json";
          el.id = "jsonld";
          el.text = JSON.stringify(json);
          document.querySelector("head").appendChild(el);
        } else {
          const script = document.getElementById("jsonld");
          script.text = JSON.stringify(json);
        }
      },

      /**
       * Generate a Schema.org/identifier from the model's id
       *
       * Tries to use the PropertyValue pattern when the identifier is a DOI and
       * falls back to a Text value otherwise
       * @param {string} identifier - The raw identifier
       * @returns {object} - A Schema.org/PropertyValue object or a string
       */
      generateSchemaOrgIdentifier(identifier) {
        if (!this.model.isDOI()) {
          return identifier;
        }

        const doi = this.getCanonicalDOIIRI(identifier);

        if (!doi) {
          return identifier;
        }

        return {
          "@type": "PropertyValue",
          propertyID: "https://registry.identifiers.org/registry/doi",
          value: doi.replace("https://doi.org/", "doi:"),
          url: doi,
        };
      },

      /**
       * Generate a Schema.org/Place/geo from bounding coordinates
       *
       * Either generates a GeoCoordinates (when the north and east coords are
       * the same) or a GeoShape otherwise.
       * @param {number} north - North bounding coordinate
       * @param {number} east - East bounding coordinate
       * @param {number} south - South bounding coordinate
       * @param {number} west - West bounding coordinate
       * @returns {object} - A Schema.org/Place/geo object
       */
      generateSchemaOrgGeo(north, east, south, west) {
        if (north === south) {
          return {
            "@type": "GeoCoordinates",
            latitude: north,
            longitude: west,
          };
        }
        return {
          "@type": "GeoShape",
          box: `${west}, ${south} ${east}, ${north}`,
        };
      },

      /**
       * Creates a (hopefully) valid geoJSON string from the a set of bounding
       * coordinates from the Solr index (north, east, south, west).
       *
       * This function produces either a GeoJSON Point or Polygon depending on
       * whether the north and south bounding coordinates are the same.
       *
       * Part of the reason for factoring this out, in addition to code
       * organization issues, is that the GeoJSON spec requires us to modify the
       * raw result from Solr when the coverage crosses -180W which is common
       * for datasets that cross the Pacific Ocean. In this case, We need to
       * convert the east bounding coordinate from degrees west to degrees east.
       *
       * e.g., if the east bounding coordinate is 120 W and west bounding
       * coordinate is 140 E, geoJSON requires we specify 140 E as 220
       * @param {number} north - North bounding coordinate
       * @param {number} east - East bounding coordinate
       * @param {number} south - South bounding coordinate
       * @param {number} west - West bounding coordinate
       * @returns {string} - A stringified GeoJSON object
       */
      generateGeoJSONString(north, east, south, west) {
        if (north === south) {
          return this.generateGeoJSONPoint(north, east);
        }
        return this.generateGeoJSONPolygon(north, east, south, west);
      },

      /**
       * Generate a GeoJSON Point object
       * @param {number} north - North bounding coordinate
       * @param {number} east - East bounding coordinate
       * @returns {string} - A stringified GeoJSON Point object
       * @example
       * {
       *  "type": "Point",
       *  "coordinates": [
       *      -105.01621,
       *      39.57422
       * ]}
       */
      generateGeoJSONPoint(north, east) {
        const preamble = '{"type":"Point","coordinates":';
        const inner = `[${east},${north}]`;
        const postamble = "}";

        return preamble + inner + postamble;
      },

      /**
       * Generate a GeoJSON Polygon object from
       * @param {number} north - North bounding coordinate
       * @param {number} east - East bounding coordinate
       * @param {number} south - South bounding coordinate
       * @param {number} west - West bounding coordinate
       * @returns {string} - A stringified GeoJSON Polygon object
       * @example
       * {
       *   "type": "Polygon",
       *   "coordinates": [[
       *     [ 100, 0 ],
       *     [ 101, 0 ],
       *     [ 101, 1 ],
       *     [ 100, 1 ],
       *     [ 100, 0 ]
       * ]}
       */
      generateGeoJSONPolygon(north, east, south, west) {
        const preamble =
          '{"type":"Feature","properties":{},"geometry":{"type":"Polygon","coordinates":[[';

        // Handle the case when the polygon wraps across the 180W/180E boundary
        const fixedEast = east < west ? 360 - east : east;

        const inner =
          `[${west},${south}],` +
          `[${fixedEast},${south}],` +
          `[${fixedEast},${north}],` +
          `[${west},${north}],` +
          `[${west},${south}]`;

        const postamble = "]]}}";

        return preamble + inner + postamble;
      },

      /**
       * Create a canonical IRI for a DOI given a random DataONE identifier.
       * Useful for describing resources identified by DOIs in linked open data
       * contexts or possibly also useful for comparing two DOIs for equality.
       * Note: Really could be generalized to more identifier schemes.
       * @param {string} identifier The identifier to (possibly) create the IRI
       * for.
       * @returns {string|null} Returns null when matching the identifier to a
       * DOI regex fails or a string when the match is successful
       */
      getCanonicalDOIIRI(identifier) {
        return MetacatUI.appModel.DOItoURL(identifier) || null;
      },

      /**
       * Insert citation information as meta tags into the head of the page
       *
       * Currently supports Highwire Press style tags (citation_) which is
       * supposedly what Google (Scholar), Mendeley, and Zotero support.
       */
      insertCitationMetaTags() {
        // Generate template data to use for all templates
        const title = this.model.get("title");
        const authors = this.model.get("origin");
        const publisher = this.getPublisherText();
        const date = new Date(this.getDatePublishedText())
          .getUTCFullYear()
          .toString();
        const isDOI = this.model.isDOI(this.model.get("id"));
        const id = this.model.get("id");
        const abstract = this.model.get("abstract");

        // Generate HTML strings from each template
        const hwpt = this.metaTagsHighwirePressTemplate({
          title,
          authors,
          publisher,
          date,
          isDOI,
          id,
          abstract,
        });

        // Clear any that are already in the document.
        $("meta[name='citation_title']").remove();
        $("meta[name='citation_authors']").remove();
        $("meta[name='citation_author']").remove();
        $("meta[name='citation_publisher']").remove();
        $("meta[name='citation_date']").remove();
        $("meta[name='citation_doi']").remove();
        $("meta[name='citation_abstract']").remove();

        // Insert
        document.head.insertAdjacentHTML("beforeend", hwpt);

        // Update Zotero
        // https://www.zotero.org/support/dev/exposing_metadata#force_zotero_to_refresh_metadata
        document.dispatchEvent(
          new Event("ZoteroItemUpdated", {
            bubbles: true,
            cancelable: true,
          }),
        );
      },

      /** Insert the interactive annoation views */
      createAnnotationViews() {
        const viewRef = this;
        _.each($(".annotation"), (annoEl) => {
          const newView = new AnnotationView({
            el: annoEl,
          }).render();
          viewRef.subviews.push(newView);
        });
      },

      /** Insert the markdown views */
      insertMarkdownViews() {
        const viewRef = this;

        _.each($(".markdown"), (markdownEl) => {
          const newView = new MarkdownView({
            markdown: $(markdownEl).text().trim(),
            el: $(markdownEl).parent(),
          });

          viewRef.subviews.push(newView);

          // Clear out old content before rendering
          $(markdownEl).remove();

          newView.render();
        });
      },

      /**
       * Store PIDs for each entity as an array on the view (this.entities)
       * @param {HTMLElement} entityEl - An element that contains the entity PID
       * as a data-id attribute. Used if the entity PID is not provided.
       * @param {string} entityId - The identifier for the entity.
       */
      storeEntityPIDs(entityEl, entityId) {
        let entityPID = entityId;
        // Get the entity ID if it is null or undefined
        if (entityPID === null) entityPID = $(entityEl).data("id");

        // Perform clean up with the entity ID
        if (entityPID && typeof entityPID === "string") {
          // Check and replace urn-uuid- with urn:uuid: if the string starts
          // with urn-uuid-
          if (entityPID.startsWith("urn-uuid-")) {
            entityPID = entityPID.replace("urn-uuid-", "urn:uuid:");
          }

          // Check and replace doi-10. with doi:10. if the string starts with
          // doi-10.
          if (entityPID.startsWith("doi-10.")) {
            entityPID = entityPID.replace("doi-10.", "doi:10.");
          }
        }

        if (!this.entities.includes(entityPID)) {
          this.entities.push(entityPID);
        }
      },
    },
  );

  return MetadataView;
});
