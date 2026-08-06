define([
  "jquery",
  "jqueryui",
  "underscore",
  "backbone",
  "models/dataPackage/DataPackage",
  "models/SolrResult",
  "models/CitationModel",
  "models/dataONEServices/PublishService",
  "models/dataPackage/DataPackageRecovery",
  "models/dataPackage/UploadRecoveryStore",
  "common/QueryService",
  "common/ErrorUtilities",
  "common/Utilities",
  "common/ValueUtilities",
  "common/UrlUtilities",
  "models/fileTable/DataPackageFileTableAdapter",
  "models/fileTable/FileTableMetrics",
  "views/fileTable/FileTableView",
  "views/CitationHeaderView",
  "views/CanonicalDatasetHandlerView",
  "views/metadataView/DatasetControlsView",
  "views/VersionNavigationView",
  "views/MetadataDocumentView",
  "text!templates/metadata/metadata.html",
  "text!templates/dataSource.html",
  "text!templates/newerVersion.html",
  "text!templates/loading.html",
  "text!templates/alert.html",
  "text!templates/metaTagsHighwirePress.html",
], (
  $,
  $ui,
  _,
  Backbone,
  DataPackage,
  SolrResult,
  CitationModel,
  PublishService,
  DataPackageRecovery,
  UploadRecoveryStore,
  QueryService,
  ErrorUtilities,
  Utilities,
  ValueUtilities,
  UrlUtilities,
  DataPackageFileTableAdapter,
  FileTableMetrics,
  FileTableView,
  CitationHeaderView,
  CanonicalDatasetHandlerView,
  ControlsView,
  VersionNavigationView,
  MetadataDocumentView,
  MetadataTemplate,
  DataSourceTemplate,
  VersionTemplate,
  LoadingTemplate,
  AlertTemplate,
  metaTagsHighwirePressTemplate,
) => {
  "use strict";

  const { isAbortError } = ErrorUtilities;

  const CLASS_NAMES = {
    alertError: "alert-error",
    alert: "alert",
    alertContainer: "alert-container",
    alertInfo: "alert-info",
    alertSuccess: "alert-success",
    alertWarning: "alert-warning",
    archived: "archived",
    btnDisabled: "btn-disabled",
    collapse: "collapse",
    container: "container",
    dataSource: "data-source",
    datasetInfoIconsContainer: "dataset-info-icons-container",
    fileListingNoteAction: "file-listing-note-action",
    fileListingNoteStatus: "file-listing-note-status",
    fileTableContainer: "file-table-container",
    hasDataSource: "has-data-source",
    hasMoreBelow: "has-more-below",
    danger: "danger",
    icon: "icon",
    iconCircle: "icon icon-circle icon-stack-base",
    iconCircleBase: "icon icon-circle icon-stack-base",
    iconLevelUp: "icon icon-on-left icon-level-up",
    iconLock: "icon-lock",
    iconLockTop: "icon icon-lock icon-stack-top",
    iconStackBase: "icon-stack",
    iconStack: "icon-stack private tooltip-this",
    iconStackTop: "icon-stack-top",
    tooltipThis: "tooltip-this",
    iconTrash: "icon-trash",
    loading: "loading",
    noStylesheet: "no-stylesheet",
    parentLink: "parent-link",
    pointer: "pointer",
    private: "private",
    saveSpinner: "icon icon-spinner icon-spin",
    VERSION_NAVIGATION_CONTAINER: "top-info",
  };

  const FILE_LISTING_STATES = {
    ambiguous: "ambiguousListing",
    limited: "limitedListing",
    permissionUnavailable: "permissionUnavailable",
    recoverable: "recoverableLimitedListing",
    serverUnavailable: "serverUnavailable",
  };

  const FINISH_INTERRUPTED_SAVE_ACTION = "finish-interrupted-save";

  const MESSAGES = {
    archivedDataset: "This dataset has been archived.",
    back: "Back",
    backToSearch: " Back to search",
    chooseOneToView: " Choose one to view:",
    choosePackageToViewFiles: " Choose a package to view its files:",
    errorRenderingMetadataView(error) {
      return `Error rendering metadata view. ${error?.message || String(error)}`;
    },
    fileCount(count) {
      return `${count} ${count === 1 ? "file" : "files"}`;
    },
    filesAndFoldersColumn: "Files and Folders",
    fileListingNotices: {
      [FILE_LISTING_STATES.ambiguous]:
        "More than one file listing is associated with this dataset. Only the metadata document is shown.",
      [FILE_LISTING_STATES.limited]:
        "A full file listing is not available for this dataset.",
      [FILE_LISTING_STATES.permissionUnavailable]:
        "Permission is required to view the file list for this dataset. Log-in with an account that has access to see the complete file listing.",
      // Public-facing note for an incomplete listing without implying the dataset is broken.
      [FILE_LISTING_STATES.recoverable]:
        "Additional files may appear once processing is complete.",
      [FILE_LISTING_STATES.serverUnavailable]:
        "Some package details could not be loaded. The file list below may be incomplete.",
    },
    fileListingRecoveryFailed(message) {
      return ` We couldn't finish the interrupted save${
        message ? `: ${message}` : ""
      }. Please contact the support team.`;
    },
    fileListingRecoveryFinished: " Save finished. Reloading...",
    fileListingRecoveryNotFinished:
      " We couldn't finish the interrupted save. Please contact the support team.",
    fileListingRecoveryRunning:
      " Finishing interrupted save. This may take a moment...",
    finishInterruptedSave: "Finish interrupted save",
    filesInDatasetTitle(fileCountLabel) {
      return `${fileCountLabel} in this dataset`;
    },
    indexing:
      "This metadata document is being indexed. Please try again in a few minutes.",
    limitedMetadata:
      "Limited information is available for this dataset because it was not described with metadata.",
    loading: "Loading...",
    loadingDatasetDetails: "Loading dataset details...",
    metadataBreadcrumb: "Metadata",
    multipleDocumentingDatasetsHtml(dataPid, items) {
      return (
        `<h4>This data file is described by more than one dataset.</h4>` +
        `<p>The file '${Utilities.encodeHTML(dataPid)}' belongs to multiple ` +
        `datasets.${items ? MESSAGES.chooseOneToView : ""}</p>${
          items ? `<ul>${items}</ul>` : ""
        }`
      );
    },
    multipleResourceMapsHtml(items) {
      return (
        `<h4>This dataset could not be resolved to a single data package.</h4>` +
        `<p>The metadata is linked to more than one data package and we ` +
        `could not determine which is current.${
          items ? MESSAGES.choosePackageToViewFiles : ""
        }</p>${items ? `<ul>${items}</ul>` : ""}`
      );
    },
    noChangesToSave: "There are no changes to save.",
    noFilesToDisplay: "No files to display yet.",
    notFoundHtml(id) {
      return (
        `<h4>Nothing was found.</h4>` +
        `<p id='metadata-view-not-found-message'>The dataset identifier '${Utilities.encodeHTML(
          id,
        )}' does not exist or it may have been removed. <a>Search for ` +
        `datasets that mention ${Utilities.encodeHTML(id)}</a></p>`
      );
    },
    packageSubtitle(packageId) {
      return packageId ? `Package: ${packageId}` : "";
    },
    parentDataset(label) {
      return `Parent dataset: ${label}`;
    },
    privateDataset: "This is a private dataset.",
    privateDatasetHtml(signInUrl, loggedIn) {
      const signInText = loggedIn
        ? ""
        : ` If you believe you have permission to access this dataset, then <a href="${signInUrl}">sign in</a>.`;
      return (
        `<span class="${CLASS_NAMES.iconStack}" data-toggle="tooltip"` +
        ` data-placement="top" data-container="#metadata-controls-container"` +
        ` title="" data-original-title="${MESSAGES.privateDataset}.">` +
        `<i class="${CLASS_NAMES.iconCircle} ${CLASS_NAMES.private}"></i>` +
        `<i class="${CLASS_NAMES.iconLockTop}"></i>` +
        `</span> ${MESSAGES.privateDataset}${signInText}`
      );
    },
    publishCancelled: "User cancelled publish action",
    publishConfirmation(pid) {
      return `Are you sure you want to publish ${pid} with a DOI?`;
    },
    publishFailed(message) {
      return message.startsWith("Publish failed")
        ? message
        : `Publish failed: ${message}`;
    },
    publishingPackage: "Publishing package...this may take a few moments",
    publishSuccess(newId, newUrl) {
      return `Published data package '${newId}'. If you are not redirected soon,
      you can view your <a href='${newUrl}'>published data package here</a>`;
    },
    publishPending(newId, newUrl) {
      return `Published as <a href="${newUrl}">${newId}</a>. The file list is still being processed and may not be available yet. Please check back later.`;
    },
    resourceMapProvChangesNotSaved:
      "ResourceMap provenance changes were not saved.",
    retrievingDatasetDetails: "Retrieving dataset details...",
    retrievingMetadata: "Retrieving metadata ...",
    save: "Save",
    savedChanges: "Your changes have been saved. ",
    savingHtml: `<i class="${CLASS_NAMES.saveSpinner}"></i> Saving...`,
    search: "Search",
    seeDetails: "See details",
    home: "Home",
    unsavedChangesError: "Your changes could not be saved.",
  };

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

      dataPackage: null,
      activeAlert: null,
      renderId: null,
      el: "#Content",
      metadataContainerSelector: "#metadata-container",
      citationContainer: "#citation-container",
      tableContainer: "#table-container",
      breadcrumbContainer: "#breadcrumb-container",
      parentLinkContainer: "#parent-link-container",
      dataSourceContainer: "#data-source-container",
      articleContainer: "#article-container",

      type: "Metadata",

      // Templates
      template: _.template(MetadataTemplate),
      alertTemplate: _.template(AlertTemplate),
      versionTemplate: _.template(VersionTemplate),
      loadingTemplate: _.template(LoadingTemplate),
      dataSourceTemplate: _.template(DataSourceTemplate),
      metaTagsHighwirePressTemplate: _.template(metaTagsHighwirePressTemplate),

      /** @inheritdoc */
      events: {
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
      async render(options = {}) {
        const { renderId, signal: renderSignal } = this.startRender();
        if (options && Object.prototype.hasOwnProperty.call(options, "pid")) {
          this.pid = options.pid;
        }
        if (
          options &&
          Object.prototype.hasOwnProperty.call(options, "seriesId")
        ) {
          this.seriesId = options.seriesId || null;
        }
        this.stopListening();
        this.closeMetadataView();
        this.closeFileTableView();

        MetacatUI.appModel.set("headerType", "default");
        this.showLoading(MESSAGES.loading);

        // Reset per-render state.
        this.subviews = [];
        this.fileTableMetricsByPid = null;
        this.fileTableMetricsLoading = false;
        this.fileTableDownloadStates = new Map();
        this.packageDownloadAllAllowed = false;
        this.saveProvPending = false;

        this.dataPackage = null;
        this.resourceMap = null;
        this.resourceMapEditBlockers = [];
        this.metadata = null;

        // Login changes re-render the view so permissions and private content
        // refresh. The render controller cancels fetch-capable work; stale
        // renderId guards cover legacy async work that cannot be cancelled.
        this.listenTo(MetacatUI.appUserModel, "change:loggedIn", this.render);

        const dataPackage = new DataPackage();
        this.dataPackage = dataPackage;
        this.listenTo(dataPackage.events, "load:progress", (progress) => {
          if (!this.isCurrentRender(renderId)) return;
          this.updateDataPackageLoadProgress(progress);
        });
        // Show the provenance save footer only when the resource map is
        // editable. Provenance editability follows resource map write access
        // (set by checkProvenanceWritePermission), not metadata write access.
        this.canEditProvenance = false;
        this.listenTo(dataPackage.events, "provenance:changed", () => {
          if (this.canEditProvenance) this.showEditorControls();
        });

        // 1. Resolve the input PID to its package context.
        let result;
        try {
          result = await dataPackage.resolveFromPid(this.pid, {
            signal: renderSignal,
          });
        } catch (error) {
          if (isAbortError(error) || !this.isCurrentRender(renderId)) {
            return this;
          }
          // Resolution itself failed (e.g. network). Treat as a primary-object
          // retrieval error rather than a missing package.
          this.onModelError(error?.status, error?.message || String(error));
          return this;
        }
        if (!this.isCurrentRender(renderId)) return this;

        // 2. Primary-object failures replace the whole page and take precedence
        // over any package handling.
        if (result.notFound) {
          const routeSectionMatch =
            typeof this.pid === "string" && this.pid.match(/\?section=[^?]*$/);
          if (routeSectionMatch && routeSectionMatch.index > 0) {
            this.pid = this.pid.slice(0, routeSectionMatch.index);
            try {
              result = await dataPackage.resolveFromPid(this.pid, {
                signal: renderSignal,
              });
            } catch (error) {
              if (isAbortError(error) || !this.isCurrentRender(renderId)) {
                return this;
              }
              this.onModelError(error?.status, error?.message || String(error));
              return this;
            }
            if (!this.isCurrentRender(renderId)) return this;
          }
        }
        if (result.notFound) {
          this.showNotFound();
          return this;
        }
        const resolvedMetadata = dataPackage.getPrimaryMetadataMember();
        const unauthorizedPackage =
          result.unauthorized === true && result.success !== true;
        if (result.isPrivate || (unauthorizedPackage && !resolvedMetadata)) {
          this.showIsPrivate();
          return this;
        }
        if (result.error) {
          this.onModelError(result.error.status, result.error.message);
          return this;
        }
        if (result.isIndexing && result.isMetadata) {
          this.showIndexing();
          return this;
        }

        // 3. A data PID routes to the metadata that documents it (preserving
        // the data PID in the URL fragment), or to a limited view.
        if (result.isData) {
          return this.handleDataInput(result, {
            renderId,
            signal: renderSignal,
          });
        }

        this.metadata =
          resolvedMetadata || dataPackage.getPrimaryMetadataMember();
        if (this.metadata) {
          this.prepareCitationModel();
          this.renderMetadataShell({
            metadataMessage: MESSAGES.loadingDatasetDetails,
          });
        }

        // 4. Load the package members from the resolved resource map, keeping
        // any failure scoped so it does not block metadata that can render.
        this.resourceMap = dataPackage.getRootResourceMapMember();
        let packageError = null;
        if (!this.resourceMap && unauthorizedPackage) {
          packageError = {
            ok: false,
            reason: "unauthorized",
            details: {
              inputId: dataPackage.inputId,
              rootResourceMapPid: dataPackage.rootResourceMapPid || null,
            },
          };
        }
        if (this.resourceMap) {
          let useIndexFallback = false;
          try {
            const rmResult = await dataPackage.getManifestFromResourceMap({
              merge: true,
              signal: renderSignal,
            });
            if (!this.isCurrentRender(renderId)) return this;
            if (rmResult && rmResult.ok === false) {
              packageError = rmResult;
              useIndexFallback = rmResult.reason !== "unauthorized";
            } else {
              await dataPackage.getManifestFromIndex({
                merge: true,
                onlyExisting: true,
                signal: renderSignal,
              });
              if (!this.isCurrentRender(renderId)) return this;
            }
          } catch (error) {
            if (isAbortError(error) || !this.isCurrentRender(renderId)) {
              return this;
            }
            if (error?.code === "resource_map_not_editable") {
              this.resourceMapEditBlockers = [...(error.issues || [])];
              useIndexFallback = true;
            }
            packageError = {
              ok: false,
              reason: "error",
              httpStatus: error?.status ?? null,
              error,
            };
          }
          if (useIndexFallback) {
            try {
              await dataPackage.getManifestFromIndex({
                merge: true,
                signal: renderSignal,
              });
              if (!this.isCurrentRender(renderId)) return this;
            } catch (error) {
              if (isAbortError(error) || !this.isCurrentRender(renderId)) {
                return this;
              }
              console.warn(
                "Could not load package member details from the index:",
                error,
              );
            }
          }
        }
        this.metadata = dataPackage.getPrimaryMetadataMember();
        if (result.isResourceMap && this.metadata?.pid) {
          this.pid = this.metadata.pid;
          MetacatUI.uiRouter.navigate(
            `view/${encodeURIComponent(this.metadata.pid)}`,
            {
              trigger: false,
              replace: true,
            },
          );
        }

        // 5. No identifiable metadata: render a limited, no-metadata view
        // rather than rendering data or a resource map as science metadata.
        if (!this.metadata) {
          if (result.multipleRMs) {
            // Could not resolve a single package and there is no metadata to
            // keep on screen, so show the ambiguity as the page.
            this.showMultipleResourceMaps(result, { scoped: false });
            return this;
          }
          if (result.isIndexing) {
            this.showIndexing();
            return this;
          }
          if (this.resourceMap || result.isResourceMap) {
            this.renderNoMetadata({
              id: this.resourceMap?.pid || result.resolvedPid,
              renderId,
              signal: renderSignal,
            });
            return this;
          }
          this.renderNoMetadata({
            id: result.resolvedPid || this.pid,
            renderId,
            signal: renderSignal,
          });
          return this;
        }

        // 6. Metadata is available. Render it first so package-detail problems
        // stay scoped to the file/package area.
        this.prepareCitationModel();

        await this.checkWritePermissions({ renderId, signal: renderSignal });
        if (!this.isCurrentRender(renderId)) return this;
        await this.checkProvenanceWritePermission({
          renderId,
          signal: renderSignal,
        });
        if (!this.isCurrentRender(renderId)) return this;

        // The viewer loads members without editable state. Initialize it before
        // allowing provenance edits.
        if (this.canEditProvenance) {
          dataPackage.initializeLoadedMembersForEditing();
        }

        await this.renderMetadata({ renderId, signal: renderSignal });
        if (!this.isCurrentRender(renderId)) return this;

        // 7. Package details: keep the file table available even when the full
        // listing is incomplete. The metadata row still gives users a useful
        // download action while a quiet table note explains the limitation.
        const fileListingState = await this.resolveFileListingState(
          result,
          packageError,
          { renderId, signal: renderSignal },
        );
        if (!this.isCurrentRender(renderId)) return this;
        await this.insertPackageTable(this.metadata, {
          renderId,
          signal: renderSignal,
          fileListingState,
        });

        // Need template rendered before we can insert breadcrumbs (i.e. not
        // showing loading message)
        try {
          this.insertBreadcrumbs();
        } catch (error) {
          // Not fatal if breadcrumbs don't render, but log the error for
          // debugging
          console.error("Error inserting breadcrumbs:", error);
        }

        // Show a link to the parent dataset when this package is nested inside
        // another. Non-blocking: it queries for the parent metadata.
        this.insertParentLink({ renderId, signal: renderSignal }).catch(
          (error) => {
            if (isAbortError(error) || !this.isCurrentRender(renderId)) {
              return;
            }
            console.error("Error inserting parent link:", error);
          },
        );

        return this;
      },

      /**
       * Check whether table specific async work still targets this package.
       * @param {DataPackage} dataPackage DataPackage captured before an await
       * @returns {boolean} True when the package is still active
       * @since 0.0.0
       */
      isCurrentDataPackage(dataPackage) {
        return dataPackage === this.dataPackage;
      },

      /**
       * Start a render and cancel work from the previous render
       * @returns {{renderId:string, signal:AbortSignal}} Render identity
       * @since 0.0.0
       */
      startRender() {
        this.abortRender();
        this.renderId = ValueUtilities.makeUUID({ prefix: "render-" });
        this.renderAbortController = new AbortController();
        return {
          renderId: this.renderId,
          signal: this.renderAbortController.signal,
        };
      },

      /**
       * Check whether asynchronous work belongs to the active render
       * @param {string} renderId Render identifier
       * @returns {boolean} Whether the render is active
       * @since 0.0.0
       */
      isCurrentRender(renderId) {
        return Boolean(renderId && renderId === this.renderId && this.el);
      },

      /**
       * Fill in the active render identifier for child work
       * @param {object} [options] Render options
       * @param {string} [options.renderId] Render identifier
       * @param {AbortSignal} [options.signal] Cancellation signal
       * @returns {object} Render options
       * @since 0.0.0
       */
      getRenderOptions(options = {}) {
        return {
          renderId: options.renderId || this.renderId,
          signal: options.signal,
        };
      },

      /**
       * Cancel the active render and its scheduled index refresh
       * @returns {void}
       * @since 0.0.0
       */
      abortRender() {
        if (this.fileTableIndexRefreshTimer) {
          clearTimeout(this.fileTableIndexRefreshTimer);
          this.fileTableIndexRefreshTimer = null;
        }
        if (!this.renderAbortController) return;
        this.renderAbortController.abort();
        this.renderAbortController = null;
      },

      /**
       * Handle an input PID that resolves to a data object: route to the
       * metadata that documents it, preserving the data PID in the URL
       * fragment, or fall back when the documenting metadata is ambiguous or
       * absent.
       * @param {object} result Resolution result from resolveFromPid
       * @param {object} [options] Render options
       * @returns {Promise<MetadataView>} This view
       * @since 0.0.0
       */
      async handleDataInput(result, options = {}) {
        const renderOptions = this.getRenderOptions(options);
        const { renderId, signal } = renderOptions;
        const dataPid = this.pid;

        // Multiple independent metadata version chains document this data
        // object: do not pick one arbitrarily, let the user choose.
        if (result.multipleRMs) {
          this.showMultipleDocumentingDatasets(result);
          return this;
        }

        // Routing needs authoritative ResourceMap relationships, not optional index enrichment.
        const { dataPackage } = this;
        try {
          await dataPackage.getManifest({ index: false, signal });
        } catch (error) {
          if (isAbortError(error) || !this.isCurrentRender(renderId)) {
            return this;
          }
          this.onModelError(error?.status, error?.message || String(error));
          return this;
        }
        if (!this.isCurrentRender(renderId)) return this;

        const metadata = dataPackage.getPrimaryMetadataMember();
        if (metadata?.pid) {
          // Navigate to the documenting metadata, keeping the data PID in the
          // fragment so the page can scroll to / highlight it.
          this.onClose();
          this.navigateWithFragment(metadata.pid, dataPid);
          return this;
        }

        // Data object with no documenting metadata: limited view using the
        // resource map when present, otherwise the data PID itself.
        this.resourceMap = dataPackage.getRootResourceMapMember();
        const noMetadataOptions = { id: this.resourceMap?.pid || dataPid };
        if (renderId) noMetadataOptions.renderId = renderId;
        if (signal) noMetadataOptions.signal = signal;
        this.renderNoMetadata(noMetadataOptions);
        return this;
      },

      /**
       * Render a limited view for a package that has no identifiable science
       * metadata (a data PID with no documenting metadata, or a resource map
       * with no metadata member). Shows the package files that can be displayed
       * and explains that descriptive metadata is unavailable. Never renders
       * the data object or resource map XML as science metadata.
       * @param {object} [options] Options
       * @param {string} [options.id] Resource map or object PID to anchor the
       * limited view on
       * @param {string} [options.renderId] Active render identifier
       * @param {AbortSignal} [options.signal] Active render signal
       * @returns {MetadataView} This view
       * @since 0.0.0
       */
      renderNoMetadata({ id, renderId, signal } = {}) {
        if (renderId && !this.isCurrentRender(renderId)) return this;
        const { dataPackage } = this;
        if (!dataPackage) return this;

        this.hideLoading();
        this.$el.html(this.template());

        // Represent the package members (files) we do have. When the package
        // has no members yet, fall back to the input object as a single row.
        const fallback = id ? dataPackage.getMember(id) : null;
        Promise.resolve(
          this.insertPackageTable(fallback || null, { renderId, signal }),
        ).catch((error) => {
          if (
            isAbortError(error) ||
            (renderId && !this.isCurrentRender(renderId))
          ) {
            return;
          }
          console.error("Error inserting package table:", error);
        });

        try {
          this.insertBreadcrumbs();
        } catch (error) {
          console.error("Error inserting breadcrumbs:", error);
        }

        // Explain, where the metadata would appear, that it is unavailable.
        const container =
          this.el.querySelector(this.metadataContainerSelector) || this.el;
        this.showViewAlert(
          MESSAGES.limitedMetadata,
          CLASS_NAMES.alertWarning,
          container,
        );

        this.isRendering = false;
        this.trigger("renderComplete");
        return this;
      },

      /**
       * Handle metadata that is linked to multiple resource maps that the
       * resolver could not narrow to one current package. Lists each candidate
       * with its /view/ route rather than choosing one.
       * @param {object} result Resolution result from resolveFromPid
       * @param {object} [options] Options
       * @param {boolean} [options.scoped] When true, metadata is already on
       * screen and the warning stays in the file/package area; when false the
       * warning replaces the page
       * @returns {void}
       * @since 0.0.0
       */
      showMultipleResourceMaps(result, { scoped = true } = {}) {
        const candidates = result?.candidateResourceMapPids || [];
        const items = candidates
          .map(
            (pid) =>
              `<li><a href="${MetacatUI.root}/view/${encodeURIComponent(
                pid,
              )}">${Utilities.encodeHTML(pid)}</a></li>`,
          )
          .join("");
        const msg = MESSAGES.multipleResourceMapsHtml(items);

        this.stopPackageLoading();
        if (scoped) {
          // Keep the rendered metadata; show the failure in the file area only.
          this.$(this.tableContainer)
            .empty()
            .append(
              $(
                `<div class="${CLASS_NAMES.alert} ${CLASS_NAMES.alertWarning}"></div>`,
              ).html(msg),
            );
        } else {
          this.hideLoading();
          this.showError(msg, { classes: CLASS_NAMES.alertWarning });
        }
      },

      /**
       * Handle a data PID documented by more than one independent metadata
       * version chain. Lists each candidate dataset (preserving the data PID in
       * the fragment) rather than selecting one arbitrarily.
       * @param {object} result Resolution result from resolveFromPid
       * @returns {void}
       * @since 0.0.0
       */
      showMultipleDocumentingDatasets(result) {
        const dataPid = this.pid;
        const candidates = result?.candidateMetadataPids || [];
        const items = candidates
          .map(
            (pid) =>
              `<li><a href="${MetacatUI.root}/view/${encodeURIComponent(
                pid,
              )}#${encodeURIComponent(dataPid)}">${Utilities.encodeHTML(
                pid,
              )}</a></li>`,
          )
          .join("");
        const msg = MESSAGES.multipleDocumentingDatasetsHtml(dataPid, items);

        this.hideLoading();
        this.showError(msg, { classes: CLASS_NAMES.alertWarning });
      },

      /**
       * Choose the quiet file listing note for the table header.
       * @param {object} result Resolution result from DataPackageLoader
       * @param {object|null} packageError Resource map / manifest load error
       * @param {object} [options] Render options
       * @returns {Promise<string|null>} File listing state, or null
       * @since 0.0.0
       */
      async resolveFileListingState(
        result = {},
        packageError = null,
        options = {},
      ) {
        if (packageError) {
          return packageError.reason === "unauthorized"
            ? FILE_LISTING_STATES.permissionUnavailable
            : FILE_LISTING_STATES.serverUnavailable;
        }
        if (
          this.canWrite === true &&
          !result?.multipleRMs &&
          (await this.hasRecoverablePackageRecord(options))
        ) {
          return FILE_LISTING_STATES.recoverable;
        }
        if (this.resourceMap) return null;
        if (result?.multipleRMs) return FILE_LISTING_STATES.ambiguous;
        return FILE_LISTING_STATES.limited;
      },

      /**
       * Check whether this viewer has a local interrupted save record.
       * @param {object} [options] Render options
       * @returns {Promise<boolean>} Whether recovery is available
       * @since 0.0.0
       */
      async hasRecoverablePackageRecord(options = {}) {
        const metadataPid = this.metadata?.pid || this.pid;
        if (!metadataPid) return false;

        const { renderId, signal } = this.getRenderOptions(options);
        if (signal?.aborted) return false;

        try {
          const record = await new UploadRecoveryStore().get(metadataPid);
          if (
            signal?.aborted ||
            (renderId && !this.isCurrentRender(renderId))
          ) {
            return false;
          }
          const loadedResourceMapPid = this.resourceMap?.pid;
          return Boolean(
            record &&
              (!loadedResourceMapPid ||
                record.obsoletesRmPid === loadedResourceMapPid),
          );
        } catch (_error) {
          return false;
        }
      },

      /**
       * Build the FileTableView notice attributes for a listing state.
       * @param {string|null} state File listing state
       * @returns {object|null} File table notice attributes
       * @since 0.0.0
       */
      getFileListingNotice(state) {
        const message = MESSAGES.fileListingNotices[state];
        if (!message) return null;

        const notice = { noticeMessage: message };
        if (state === FILE_LISTING_STATES.recoverable) {
          notice.noticeActionId = FINISH_INTERRUPTED_SAVE_ACTION;
          notice.noticeActionLabel = MESSAGES.finishInterruptedSave;
          notice.noticeActionClassName = "btn btn-primary";
        }
        return notice;
      },

      /**
       * Handle a table level file listing action.
       * @param {string} actionId Action id
       * @returns {void}
       * @since 0.0.0
       */
      handleFileTableNoticeAction(actionId) {
        if (actionId !== FINISH_INTERRUPTED_SAVE_ACTION) return;
        const pid = this.metadata?.pid || this.pid;
        if (pid) this.repairDataset(pid);
      },

      /**
       * Finish an interrupted save by replaying its durable local recovery
       * record, then reload so the recovered package resolves.
       * @param {string} metadataPid Metadata PID with an interrupted save
       * @returns {Promise<void>} Resolves once recovery has been attempted
       * @since 0.0.0
       */
      async repairDataset(metadataPid) {
        const { renderId } = this;
        const button = this.$(`.${CLASS_NAMES.fileListingNoteAction}`);
        const status = this.$(`.${CLASS_NAMES.fileListingNoteStatus}`);
        button.prop("disabled", true);
        status.text(MESSAGES.fileListingRecoveryRunning);
        try {
          const result = await new DataPackageRecovery({
            resolveServiceUrl: MetacatUI.appModel.get("resolveServiceUrl"),
            objectServiceUrl: MetacatUI.appModel.get("objectServiceUrl"),
          }).recover(metadataPid);
          if (!this.isCurrentRender(renderId)) return;
          if (result?.recovered) {
            status.text(MESSAGES.fileListingRecoveryFinished);
            window.location.reload();
            return;
          }
          status.text(MESSAGES.fileListingRecoveryNotFinished);
          button.prop("disabled", false);
        } catch (error) {
          if (!this.isCurrentRender(renderId)) return;
          status.text(
            MESSAGES.fileListingRecoveryFailed(
              error?.message || "unknown error",
            ),
          );
          button.prop("disabled", false);
        }
      },

      /**
       * Remove the loading indicator from the file and package area
       * @returns {void}
       * @since 0.0.0
       */
      stopPackageLoading() {
        this.$(this.tableContainer).find(`.${CLASS_NAMES.loading}`).remove();
        this.$("#data-package-container")
          .children(`.${CLASS_NAMES.loading}`)
          .remove();
      },

      /**
       * Determine whether provenance may be edited. Provenance editing requires
       * write access to the resource map and a resource map that is not
       * archived; it must not be inferred from metadata write permission.
       * @param {object} [options] Render options
       * @returns {Promise<boolean>} Whether provenance editing is allowed
       * @since 0.0.0
       */
      async checkProvenanceWritePermission(options = {}) {
        const renderOptions = this.getRenderOptions(options);
        const { renderId, signal } = renderOptions;
        const rmArchived = this.resourceMap?.archived === true;
        const { dataPackage } = this;
        if (!dataPackage) return false;

        const editBlockers = [
          ...(this.resourceMapEditBlockers || []),
          ...(dataPackage.getResourceMapModel()?.getEditBlockers() || []),
        ];
        if (editBlockers.length) {
          this.canEditProvenance = false;
          return false;
        }
        let canWriteRM = false;
        try {
          canWriteRM = await dataPackage.checkResourceMapWritePermission({
            refresh: true,
            signal,
          });
        } catch (error) {
          if (isAbortError(error) || !this.isCurrentRender(renderId)) {
            return false;
          }
          console.error("Error checking resource map write permission:", error);
        }
        if (!this.isCurrentRender(renderId)) return false;
        this.canEditProvenance = canWriteRM === true && !rmArchived;
        return this.canEditProvenance;
      },

      /**
       * When there is an error retrieving the metadata from Solr, check the
       * status code. If it's a 404, check if the object exists in the system
       * and is just indexing. If it's a 401, show a message that this dataset
       * is private. For other errors, show a generic error message with the
       * status code and message if they exist.
       * @param {string|number} status The status code of the error
       * @param {string} message The error message
       * @since 0.0.0
       */
      onModelError(status, message) {
        // coerce status to a string for easier comparison
        const strStatus = String(status);
        if (strStatus === "404") {
          this.showIndexingOrNotFound();
        } else if (strStatus === "401") {
          this.showIsPrivate();
        } else {
          let msg = "<h4>Error retrieving metadata.</h4>";
          if (message) {
            msg += `<p>The following error occurred: ${Utilities.encodeHTML(
              message,
            )}</p>`;
          }
          if (status) {
            msg += `<p>Error code: ${Utilities.encodeHTML(strStatus)}</p>`;
          }
          this.hideLoading();
          this.showError(msg);
        }
      },

      /**
       * Prepare the citation/header model from the current metadata member.
       * @returns {void}
       * @since 0.0.0
       */
      prepareCitationModel() {
        if (!this.metadata) return;
        this.metadataSolrResult = new SolrResult({
          ...this.metadata.toJSON(),
          id: this.metadata.pid,
        });
        this.citationModel = new CitationModel();
        this.citationModel.setSourceModel(this.metadataSolrResult);
      },

      /**
       * Refresh the header from the active package metadata
       * @param {DataPackage} [dataPackage] Package to read
       * @param {object} [options] Render options
       * @returns {boolean} Whether the header was refreshed
       * @since 0.0.0
       */
      refreshMetadataHeaderFromPackage(
        dataPackage = this.dataPackage,
        options = {},
      ) {
        const renderOptions = this.getRenderOptions(options);
        const { renderId } = renderOptions;
        if (
          !dataPackage ||
          !this.isCurrentRender(renderId) ||
          !this.isCurrentDataPackage(dataPackage)
        ) {
          return false;
        }

        const metadata = dataPackage.getPrimaryMetadataMember();
        if (!metadata?.pid) return false;
        if (this.metadata?.pid && metadata.pid !== this.metadata.pid) {
          return false;
        }

        this.metadata = metadata;
        const attrs = { ...metadata.toJSON(), id: metadata.pid };
        if (this.metadataSolrResult) {
          this.metadataSolrResult.set(attrs, { silent: true });
        } else {
          this.metadataSolrResult = new SolrResult(attrs);
        }

        const needsCitation = !this.citationModel;
        if (needsCitation) {
          this.citationModel = new CitationModel();
        }
        this.citationModel.setSourceModel(this.metadataSolrResult);
        if (needsCitation) this.insertCitation();

        if (this.controls?.viewModel) {
          this.controls.viewModel.set(
            {
              metadataModel: this.metadataSolrResult,
              hasWritePermission: this.canWrite === true,
            },
            { silent: true },
          );
          this.controls.render();
          this.citationModal = this.controls.citationModal;
          this.metricsModel = this.controls.viewModel.get("metricsModel");
        }

        MetacatUI.appView.schemaOrg.setSchema(
          "Dataset",
          this.metadataSolrResult,
        );
        this.insertCitationMetaTags?.();
        return true;
      },

      /**
       * Check whether the metadata header lacks indexed display fields
       * @param {DataPackage} [dataPackage] Package to inspect
       * @returns {boolean} Whether index metadata is needed
       * @since 0.0.0
       */
      metadataHeaderNeedsIndexRefresh(dataPackage = this.dataPackage) {
        if (!dataPackage) return false;
        const metadata =
          dataPackage.getPrimaryMetadataMember() || this.metadata;
        if (!metadata?.pid) return false;
        const title = Array.isArray(metadata.title)
          ? metadata.title[0]
          : metadata.title;
        const formatId = metadata.getFormatId?.() || metadata.formatId;
        return !title || !formatId;
      },

      /**
       * Refresh a missing metadata title from the index
       * @param {DataPackage} dataPackage Package to update
       * @param {object} [options] Render options
       * @returns {Promise<boolean>} Whether the header was refreshed
       * @since 0.0.0
       */
      async refreshMetadataTitleFromIndex(dataPackage, options = {}) {
        if (!dataPackage) return false;
        const metadata =
          dataPackage.getPrimaryMetadataMember() || this.metadata;
        if (!metadata?.pid) return false;
        const currentTitle = Array.isArray(metadata.title)
          ? metadata.title[0]
          : metadata.title;
        if (currentTitle) return false;

        const { signal } = this.getRenderOptions(options);
        const response = await QueryService.queryWithFetch({
          q: QueryService.getQueryPart("id", metadata.pid),
          fields: ["id", "title", "fileName", "formatId", "formatType"],
          rows: 1,
          archived: true,
          usePost: true,
          signal,
        });
        const [doc] = QueryService.parseResponse(response);
        const title = Array.isArray(doc?.title) ? doc.title[0] : doc?.title;
        if (!title) return false;

        dataPackage.members.add(
          { pid: doc.id || metadata.pid, ...doc },
          { merge: true, onlyExisting: true, sources: ["index"] },
        );
        return this.refreshMetadataHeaderFromPackage(dataPackage, options);
      },

      /**
       * Check whether the package still needs index enrichment
       * @param {DataPackage} [dataPackage] Package to inspect
       * @returns {boolean} Whether index data is still needed
       * @since 0.0.0
       */
      packageNeedsIndexRefresh(dataPackage = this.dataPackage) {
        if (!dataPackage) return false;
        if (this.metadataHeaderNeedsIndexRefresh(dataPackage)) return true;

        return dataPackage.toArray().some((member) => {
          if (!member?.pid || member.isResourceMap?.()) return false;
          if (member.sysMetaMissing === true) return false;
          const title = Array.isArray(member.title)
            ? member.title[0]
            : member.title;
          return member.isPlaceholder?.() && !member.getFileName?.() && !title;
        });
      },

      /**
       * Render the page shell before the full metadata body is available.
       * @param {object} [options] Shell options
       * @param {string} [options.metadataMessage] Metadata loading message
       * @returns {void}
       * @since 0.0.0
       */
      renderMetadataShell({
        metadataMessage = MESSAGES.retrievingMetadata,
      } = {}) {
        this.hideLoading();
        // Load the template which holds the basic structure of the view
        this.$el.html(this.template());
        this.$(this.tableContainer).html(
          this.loadingTemplate({
            msg: MESSAGES.retrievingDatasetDetails,
          }),
        );

        this.metadataContainer = this.el.querySelector(
          this.metadataContainerSelector,
        );

        // Show loading icon in metadata section
        this.metadataContainer.innerHTML = this.loadingTemplate({
          msg: metadataMessage,
        });
        this.insertCitation();
      },

      /**
       * Render the main components of the metadata view. Insert HTML from the
       * view service or fallback to rendering from the index. Insert
       * breadcrumbs, citation, data source logo, metadata controls, and
       * metadata metrics.
       * @param {object} [options] Render options
       */
      async renderMetadata(options = {}) {
        const renderOptions = this.getRenderOptions(options);
        const { renderId, signal } = renderOptions;
        if (
          !this.metadataContainer ||
          !this.el.contains(this.metadataContainer)
        ) {
          this.renderMetadataShell();
        } else {
          this.$(this.tableContainer).html(
            this.loadingTemplate({
              msg: MESSAGES.retrievingDatasetDetails,
            }),
          );
          this.metadataContainer.innerHTML = this.loadingTemplate({
            msg: MESSAGES.retrievingMetadata,
          });
        }

        // displayState carries resolved, plain values (never unbound methods)
        // so downstream views can read these directly. isAuthorized is read via
        // the Backbone getter when available; isPublic is resolved below.
        const displayState = {
          isPublic: null,
          isAuthorized:
            typeof this.metadata?.get === "function"
              ? this.metadata.get("isAuthorized") ??
                this.metadata.get("isAuthorized_read")
              : null,
        };

        const metadataView = new MetadataDocumentView({
          pid: this.metadata?.pid || this.pid,
          dataPackage: this.dataPackage,
          editModeOn: this.canEditProvenance === true,
          signal,
          indexResults: this.metadata
            ? [{ ...this.metadata.toJSON(), id: this.metadata.pid }]
            : null,
          displayState,
        });

        // isPublic may require a system-metadata fetch (DataPackageMember.
        // isPublic() is async), so resolve it without blocking the metadata
        // render. MetadataDocumentView holds displayState by reference, so the
        // resolved boolean is visible once it arrives.
        this.getDataMemberIsPublic(this.metadata)
          .then((isPublic) => {
            if (this.isCurrentRender(renderId)) {
              displayState.isPublic = isPublic;
            }
          })
          .catch(() => {
            /* leave isPublic unresolved (null) on error */
          });

        // Don't block the entire page render on the view service.
        metadataView
          .render()
          .then((view) => {
            if (!this.isCurrentRender(renderId)) {
              view.onClose?.();
              view.remove();
              return this;
            }
            this.metadataContainer.innerHTML = "";
            this.metadataContainer.appendChild(view.el);
            return this.modifyMetadataView(renderOptions, view);
          })
          .catch((error) => {
            metadataView.onClose?.();
            metadataView.remove();
            if (isAbortError(error) || !this.isCurrentRender(renderId)) {
              return;
            }
            console.error("Error rendering metadata view:", error);
            // Show error:
            this.metadataContainer.innerHTML = this.alertTemplate({
              classes: CLASS_NAMES.alertError,
              msg: MESSAGES.errorRenderingMetadataView(error),
            });
          });
      },

      /**
       * Attach the rendered metadata document and finish the landing page
       * @param {object} renderOptions Active render options
       * @param {MetadataDocumentView} metadataView Rendered document view
       * @returns {Promise<MetadataView>} This view
       * @since 0.0.0
       */
      async modifyMetadataView(renderOptions, metadataView) {
        const { renderId } = renderOptions;
        if (!this.isCurrentRender(renderId)) {
          metadataView.onClose?.();
          metadataView.remove();
          return this;
        }
        this.closeMetadataView();
        this.metadataView = metadataView;
        this.subviews.push(metadataView);
        metadataView.checkForProv?.();
        if (this.fileTableView) {
          await this.mergeCurrentFileTableRows(
            this.dataPackage,
            this.fileTableView,
            renderOptions,
          );
          if (
            !this.isCurrentRender(renderId) ||
            this.metadataView !== metadataView
          ) {
            return this;
          }
        }

        // Insert the citation
        this.insertCitation();
        // Insert the data source logo
        this.insertDataSource();
        // is this the latest version? (includes DOI link when needed)
        this.showVersionNavigation(renderOptions).catch((error) => {
          if (isAbortError(error) || !this.isCurrentRender(renderId)) {
            return;
          }
          console.error("Error rendering version navigation:", error);
        });
        // Insert the icons (private, duplicate, archived)
        try {
          await this.renderInfoIcons(renderOptions);
        } catch (error) {
          console.warn("Error rendering info icons:", error);
          // Not fatal if icons don't render, but log the error for debugging
        }
        if (
          !this.isCurrentRender(renderId) ||
          this.metadataView !== metadataView
        ) {
          return this;
        }

        // Insert the metadata controls (edit, cite, etc)
        this.renderControls();
        // Modifies the view to indicate that this is a dataset is essentially
        // a duplicate of another dataset, if applicable
        if (this.canonicalDatasetHandler) {
          this.canonicalDatasetHandler.onClose();
          this.canonicalDatasetHandler.remove();
        }
        this.canonicalDatasetHandler = new CanonicalDatasetHandlerView({
          metadataView: this,
        }).render();
        this.subviews.push(this.canonicalDatasetHandler);

        this.isRendering = false;
        this.trigger("renderComplete");

        // Insert the Linked Data into the header of the page.
        MetacatUI.appView.schemaOrg.setSchema(
          "Dataset",
          this.metadataSolrResult,
        );
        this.insertCitationMetaTags();

        // The metadata body exists now, so fragment links to entity sections can
        // resolve on the initial page load.
        this.scrollToFragment();
        return this;
      },

      /**
       * Render controls for the current metadata object
       * @returns {void}
       * @since 0.0.0
       */
      renderControls() {
        if (!this.metadataSolrResult) return;
        this.controls = new ControlsView({
          pid: this.pid,
          metadataModel: this.metadataSolrResult,
          publishMethod: () => this.publish.call(this),
          hasWritePermission: this.canWrite === true,
          el: this.$("#metadata-controls-container"),
        }).render();
        this.subviews.push(this.controls);
        // Components created by the header buttons view and used by other subviews
        this.citationModal = this.controls.citationModal;
        this.metricsModel = this.controls.viewModel.get("metricsModel");
        if (this.fileTableView) this.loadFileTableMetrics();
      },

      /**
       * Add breadcrumbs to the page to show the user where they are in the app
       */
      insertBreadcrumbs() {
        const container = this.el.querySelector(this.breadcrumbContainer);
        if (!container) return;
        const breadcrumbs = $(document.createElement("ol"))
          .addClass("breadcrumb")
          .append(
            $(document.createElement("li"))
              .addClass("home")
              .append(
                $(document.createElement("a"))
                  .attr("href", MetacatUI.root || "/")
                  .addClass("home")
                  .text(MESSAGES.home),
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
                  .text(MESSAGES.search),
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
                .text(MESSAGES.metadataBreadcrumb),
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
              .attr("title", MESSAGES.back)
              .addClass("back")
              .text(MESSAGES.backToSearch)
              .prepend(
                $(document.createElement("i")).addClass("icon-angle-left"),
              ),
          );
          $(breadcrumbs).find("a.search").addClass("inactive");
        }

        container.appendChild(breadcrumbs[0]);
      },

      /**
       * When the metadata object doesn't exist, display a message to the user
       */
      showNotFound() {
        this.hideLoading();
        const id = this.pid || this.dataPackage?.inputId || "";
        // Construct a message that shows this object doesn't exist
        const msg = MESSAGES.notFoundHtml(id);

        // Remove the loading message
        this.hideLoading();

        // Show the not found error message
        this.showError(msg);

        // Add the pid to the link href. Add via JS so it is Attribute-encoded
        // to prevent XSS attacks
        this.$("#metadata-view-not-found-message a").attr(
          "href",
          `${MetacatUI.root}/data/query=${encodeURIComponent(id)}`,
        );
      },

      /**
       * Render the authoritative resolver state when Solr returns a 404.
       * @since 0.0.0
       */
      async showIndexingOrNotFound() {
        const result = this.dataPackage?.resolutionResult || {};

        if (result.isPrivate || result.unauthorized) {
          this.showIsPrivate();
          return;
        }

        if (result.isIndexing) {
          this.showIndexing();
          return;
        }

        this.showNotFound();
      },

      /**
       * Show that the object exists but is not indexed yet
       * @returns {void}
       * @since 0.0.0
       */
      showIndexing() {
        this.hideLoading();
        this.showError(MESSAGES.indexing, {
          classes: CLASS_NAMES.alertWarning,
        });
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

        const msg = MESSAGES.privateDatasetHtml(
          `${MetacatUI.root}/signin`,
          MetacatUI.appUserModel.get("loggedIn"),
        );

        // Remove the loading message
        this.hideLoading();

        // Show the not found error message
        this.showError(msg);
      },
      /**
       * Convert the current data package members to generic file table rows.
       * @param {object|null} fallbackMember Member to display when the package
       * has no rows yet
       * @returns {object[]} File table rows
       * @since 0.0.0
       */
      getFileTableRows(fallbackMember = null) {
        const { dataPackage } = this;
        if (!dataPackage) return [];

        const members = dataPackage.toArray();
        const tableMembers = members.length
          ? members
          : [fallbackMember].filter(Boolean);
        const resolveBaseUrl =
          MetacatUI.appModel.get("resolveServiceUrl") ||
          MetacatUI.appModel.get("objectServiceUrl") ||
          "";
        const packageId = dataPackage.rootResourceMapPid || "";
        const metadataMember = dataPackage.getPrimaryMetadataMember();
        const packageTitle = metadataMember?.title || "";
        const packageServiceUrl =
          MetacatUI.appModel.get("packageServiceUrl") || "";
        const packageDownloadUrl =
          this.packageDownloadAllAllowed === true &&
          packageId &&
          packageServiceUrl
            ? packageServiceUrl + encodeURIComponent(packageId)
            : "";
        const metricsByPid = this.fileTableMetricsByPid || null;

        const rows = DataPackageFileTableAdapter.buildRows(dataPackage, {
          mode: "viewer",
          resolveBaseUrl,
          members: tableMembers,
          packageId,
          packageTitle,
          packageDownloadUrl,
          formatName: this.getFriendlyFormatName,
          showMetrics: Boolean(this.metricsModel),
          getRowMetric: metricsByPid
            ? FileTableMetrics.getRowMetric(metricsByPid)
            : null,
        });
        rows.forEach((row) => {
          const downloadState = this.fileTableDownloadStates?.get(row.id);
          const downloadAction = row.actions?.find(
            (action) => action.id === "download",
          );
          if (downloadState && downloadAction) {
            Object.assign(downloadAction, downloadState);
          }
        });
        return rows;
      },

      /**
       * Resolve a human readable format name from the DataONE object format
       * list, used for the file table's Type column.
       * @param {string} formatId DataONE format identifier
       * @returns {string} Friendly format name, or "" when unknown
       * @since 0.0.0
       */
      getFriendlyFormatName(formatId) {
        if (!formatId) return "";
        const formatName =
          MetacatUI.objectFormats?.getFriendlyFormat?.(formatId);
        return formatName && formatName !== formatId ? formatName : "";
      },

      /**
       * Inserts the refactored file table into the metadata view.
       * @param {object|null} fallbackMember Optional member to render when the
       * data package has not been populated
       * @param {object} options File table options
       * @returns {MetadataView} This view
       */
      async insertPackageTable(fallbackMember = null, options = {}) {
        const renderOptions = this.getRenderOptions(options);
        const { renderId } = renderOptions;
        const { dataPackage } = this;
        if (!dataPackage) return this;

        this.packageDownloadAllAllowed = false;
        const rows = this.getFileTableRows(fallbackMember);
        if (renderId && !this.isCurrentRender(renderId)) return this;
        const packageId = dataPackage.rootResourceMapPid || "";
        const notice = this.getFileListingNotice(options.fileListingState);
        const fileCount = rows.filter(
          (row) =>
            row.kind !== "dataset" &&
            row.kind !== "folder" &&
            row.kind !== "resource-map",
        ).length;
        const fileCountLabel = MESSAGES.fileCount(fileCount);
        const title =
          options.title || MESSAGES.filesInDatasetTitle(fileCountLabel);
        const subtitle = MESSAGES.packageSubtitle(packageId);

        this.closeFileTableView();

        this.fileTableView = new FileTableView({
          id: packageId || this.pid || "",
          title,
          subtitle,
          fileColumnLabel: MESSAGES.filesAndFoldersColumn,
          rows,
          emptyMessage: MESSAGES.noFilesToDisplay,
          showMetrics: Boolean(this.metricsModel),
          showActions: true,
          showFilteringControl: Boolean(
            MetacatUI.appModel.get("dataPackageFiltering"),
          ),
          showSortingControl: Boolean(
            MetacatUI.appModel.get("dataPackageSorting"),
          ),
          ...(notice || {}),
        });
        this.listenTo(
          this.fileTableView,
          "action:click",
          this.handleFileTableAction,
        );
        this.listenTo(
          this.fileTableView,
          "notice:action",
          this.handleFileTableNoticeAction,
        );
        this.subviews.push(this.fileTableView);

        // Wrap the table in a scrolling container so the sticky header has a
        // scroll ancestor and long packages scroll within a bounded height.
        const fileTableContainer = $(
          `<div class="${CLASS_NAMES.fileTableContainer}"></div>`,
        ).append(this.fileTableView.render().el);
        this.$(this.tableContainer).empty().append(fileTableContainer);
        this.setupFileTableScrollIndicators(fileTableContainer[0]);
        // The file table manages its own tooltips (Fomantic popups), so no
        // Bootstrap tooltip initialization is needed here.

        const packageTableContainer = this.$("#data-package-container");
        $(packageTableContainer).children(`.${CLASS_NAMES.loading}`).remove();

        // Friendly Type labels need the object-format list; fill them in once
        // it is loaded. Per-file metrics fill in their column when they arrive.
        this.ensureFriendlyFormatLabels(renderOptions);
        this.confirmPackageDownloadAll(
          dataPackage,
          this.fileTableView,
          renderOptions,
        );
        this.loadNestedPackageTitles(renderOptions);
        this.enrichFileTableMemberDetails(renderOptions);
        this.loadFileTableMetrics();

        return this;
      },

      /**
       * Observe a file table scroll container and update its overflow cue
       * @param {HTMLElement} container Scroll container
       * @returns {void}
       * @since 0.0.0
       */
      setupFileTableScrollIndicators(container) {
        this.teardownFileTableScrollIndicators();
        if (!container) return;

        this.fileTableScrollContainer = container;
        this.fileTableScrollHandler = () => {
          this.scheduleFileTableScrollIndicatorUpdate();
        };
        container.addEventListener("scroll", this.fileTableScrollHandler, {
          passive: true,
        });

        if (typeof ResizeObserver === "function") {
          this.fileTableResizeObserver = new ResizeObserver(() => {
            this.scheduleFileTableScrollIndicatorUpdate();
          });
          this.fileTableResizeObserver.observe(container);
          if (this.fileTableView?.el) {
            this.fileTableResizeObserver.observe(this.fileTableView.el);
          }
        }

        this.updateFileTableScrollIndicators();
      },

      /**
       * Schedule one overflow cue update for the file table
       * @returns {void}
       * @since 0.0.0
       */
      scheduleFileTableScrollIndicatorUpdate() {
        if (!this.fileTableScrollContainer) return;
        if (this.fileTableScrollIndicatorFrame) return;

        if (typeof requestAnimationFrame !== "function") {
          this.updateFileTableScrollIndicators();
          return;
        }

        this.fileTableScrollIndicatorFrame = requestAnimationFrame(() => {
          this.fileTableScrollIndicatorFrame = null;
          this.updateFileTableScrollIndicators();
        });
      },

      /**
       * Update whether the file table has more content below
       * @returns {boolean} Whether more rows are below the viewport
       * @since 0.0.0
       */
      updateFileTableScrollIndicators() {
        const container = this.fileTableScrollContainer;
        if (!container) return false;

        const hasMoreBelow =
          container.scrollTop + container.clientHeight <
          container.scrollHeight - 1;
        container.classList.toggle(CLASS_NAMES.hasMoreBelow, hasMoreBelow);
        return hasMoreBelow;
      },

      /**
       * Remove file table scroll and resize observers
       * @returns {void}
       * @since 0.0.0
       */
      teardownFileTableScrollIndicators() {
        if (
          this.fileTableScrollIndicatorFrame &&
          typeof cancelAnimationFrame === "function"
        ) {
          cancelAnimationFrame(this.fileTableScrollIndicatorFrame);
        }
        this.fileTableScrollIndicatorFrame = null;

        if (this.fileTableResizeObserver) {
          this.fileTableResizeObserver.disconnect();
        }
        this.fileTableResizeObserver = null;

        if (this.fileTableScrollContainer && this.fileTableScrollHandler) {
          this.fileTableScrollContainer.removeEventListener(
            "scroll",
            this.fileTableScrollHandler,
          );
        }
        this.fileTableScrollContainer = null;
        this.fileTableScrollHandler = null;
      },

      /**
       * Enable whole package download when the package is safe to download
       * @param {DataPackage} dataPackage Package to inspect
       * @param {FileTableView} fileTableView Active file table
       * @param {object} [options] Render options
       * @returns {boolean} Whether whole package download was enabled
       * @since 0.0.0
       */
      confirmPackageDownloadAll(dataPackage, fileTableView, options = {}) {
        if (!dataPackage) return false;
        if (!this.isCurrentFileTable(dataPackage, fileTableView, options)) {
          return false;
        }
        const packageId = dataPackage.rootResourceMapPid || "";
        const packageServiceUrl =
          MetacatUI.appModel.get("packageServiceUrl") || "";
        if (!packageId || !packageServiceUrl) {
          return false;
        }
        const maxDownloadSize = Number(
          MetacatUI.appModel.get("maxDownloadSize"),
        );
        if (Number.isFinite(maxDownloadSize) && maxDownloadSize > 0) {
          try {
            const totalSize = dataPackage.getTotalSize();
            if (!Number.isFinite(totalSize) || totalSize > maxDownloadSize) {
              return false;
            }
          } catch {
            return false;
          }
        }

        if (dataPackage.hasPrivateMembers()) return false;
        this.packageDownloadAllAllowed = true;
        fileTableView.viewModel.mergeRows(this.getFileTableRows());
        this.scheduleFileTableScrollIndicatorUpdate();
        return true;
      },

      /**
       * Check whether asynchronous work belongs to the active file table
       * @param {DataPackage} dataPackage Captured package
       * @param {FileTableView} fileTableView Captured file table
       * @param {object} [options] Render options
       * @returns {boolean} Whether the file table is current
       * @since 0.0.0
       */
      isCurrentFileTable(dataPackage, fileTableView, options = {}) {
        const { renderId, signal } = this.getRenderOptions(options);
        return (
          !signal?.aborted &&
          this.isCurrentRender(renderId) &&
          this.isCurrentDataPackage(dataPackage) &&
          fileTableView === this.fileTableView
        );
      },

      /**
       * Replace rows in the active file table
       * @param {DataPackage} dataPackage Captured package
       * @param {FileTableView} fileTableView Captured file table
       * @param {object} [options] Render options
       * @returns {Promise<boolean>} Whether rows were merged
       * @since 0.0.0
       */
      async mergeCurrentFileTableRows(
        dataPackage,
        fileTableView,
        options = {},
      ) {
        if (!this.isCurrentFileTable(dataPackage, fileTableView, options)) {
          return false;
        }
        const rows = this.getFileTableRows();
        if (!this.isCurrentFileTable(dataPackage, fileTableView, options)) {
          return false;
        }
        fileTableView.viewModel.mergeRows(rows);
        this.scheduleFileTableScrollIndicatorUpdate();
        return true;
      },

      /**
       * Load missing System Metadata used by file table rows
       * @param {object} [options] Render options
       * @returns {Promise<void>} Resolves after enrichment
       * @since 0.0.0
       */
      async enrichFileTableMemberDetails(options = {}) {
        const renderOptions = this.getRenderOptions(options);
        const { signal } = renderOptions;
        const { dataPackage, fileTableView } = this;
        try {
          const result = await DataPackageFileTableAdapter.enrichMembers(
            dataPackage,
            { signal },
          );
          if (
            !this.isCurrentFileTable(dataPackage, fileTableView, renderOptions)
          ) {
            return;
          }
          this.refreshMetadataHeaderFromPackage(dataPackage, renderOptions);
          if (result.changed) {
            await this.mergeCurrentFileTableRows(
              dataPackage,
              fileTableView,
              renderOptions,
            );
          }
          if (
            result.unresolvedPlaceholderPids.length ||
            this.packageNeedsIndexRefresh(dataPackage)
          ) {
            this.scheduleFileTableIndexRefresh(
              dataPackage,
              fileTableView,
              renderOptions,
            );
          }
        } catch (error) {
          if (
            isAbortError(error) ||
            !this.isCurrentFileTable(dataPackage, fileTableView, renderOptions)
          ) {
            return;
          }
          console.warn("File table member details could not be loaded:", error);
        }
      },

      /**
       * Poll the index for package details that are still processing
       * @param {DataPackage} dataPackage Captured package
       * @param {FileTableView} fileTableView Captured file table
       * @param {object} [options] Render options
       * @returns {void}
       * @since 0.0.0
       */
      scheduleFileTableIndexRefresh(dataPackage, fileTableView, options = {}) {
        const renderOptions = this.getRenderOptions(options);
        const { signal } = renderOptions;
        if (this.fileTableIndexRefreshTimer) {
          clearTimeout(this.fileTableIndexRefreshTimer);
        }
        if (!this.packageNeedsIndexRefresh(dataPackage)) {
          this.fileTableIndexRefreshTimer = null;
          return;
        }

        const delays = [2000, 3000, 5000, 8000, 13000, 21000];
        let attempt = 0;
        const tick = async () => {
          this.fileTableIndexRefreshTimer = null;
          if (
            !this.isCurrentFileTable(dataPackage, fileTableView, renderOptions)
          ) {
            return;
          }
          try {
            await this.refreshMetadataTitleFromIndex(
              dataPackage,
              renderOptions,
            );
            await dataPackage.getManifestFromIndex({
              merge: true,
              onlyExisting: true,
              signal,
            });
            this.refreshMetadataHeaderFromPackage(dataPackage, renderOptions);
            await this.mergeCurrentFileTableRows(
              dataPackage,
              fileTableView,
              renderOptions,
            );
          } catch (error) {
            if (
              isAbortError(error) ||
              !this.isCurrentFileTable(
                dataPackage,
                fileTableView,
                renderOptions,
              )
            ) {
              return;
            }
            console.warn(
              "File table index refresh could not be loaded:",
              error,
            );
          }
          if (!this.packageNeedsIndexRefresh(dataPackage)) return;
          if (attempt >= delays.length) return;
          this.fileTableIndexRefreshTimer = setTimeout(tick, delays[attempt]);
          attempt += 1;
        };

        this.fileTableIndexRefreshTimer = setTimeout(tick, delays[attempt]);
        attempt += 1;
      },

      /**
       * Load dataset titles for nested resource maps from their metadata docs.
       * @param {object} [options] Render options
       * @returns {Promise<void>}
       * @since 0.0.0
       */
      async loadNestedPackageTitles(options = {}) {
        const renderOptions = this.getRenderOptions(options);
        const { signal } = renderOptions;
        const { dataPackage, fileTableView } = this;
        const isCurrentTable = () =>
          this.isCurrentFileTable(dataPackage, fileTableView, renderOptions);

        try {
          const changed = await dataPackage.loadNestedPackageTitles({ signal });
          if (changed && isCurrentTable()) {
            await this.mergeCurrentFileTableRows(
              dataPackage,
              fileTableView,
              renderOptions,
            );
          }
        } catch (error) {
          if (isAbortError(error) || !isCurrentTable()) return;
          console.warn("Nested package titles could not be loaded:", error);
        }
      },

      /**
       * Ensure the DataONE object format list is loaded so the file table's
       * Type column can show friendly format names, then rerender the rows.
       * @param {object} [options] Render options
       * @returns {Promise<void>}
       * @since 0.0.0
       */
      async ensureFriendlyFormatLabels(options = {}) {
        const renderOptions = this.getRenderOptions(options);
        const { signal } = renderOptions;
        const { dataPackage, fileTableView } = this;
        const isCurrentTable = () =>
          this.isCurrentFileTable(dataPackage, fileTableView, renderOptions);
        try {
          await Utilities.awaitObjectFormats();
        } catch (error) {
          if (isAbortError(error)) return;
          console.warn("Object formats could not be loaded:", error);
          return;
        }
        if (signal?.aborted) return;
        if (!isCurrentTable()) return;
        if (fileTableView) {
          await this.mergeCurrentFileTableRows(
            dataPackage,
            fileTableView,
            renderOptions,
          );
        }
      },

      /**
       * Fetch per PID metrics for the file table in a single grouped request
       * and merge the values into existing rows. Best effort: failures leave
       * metric cells empty.
       * @returns {Promise<void>}
       * @since 0.0.0
       */
      async loadFileTableMetrics() {
        if (this.fileTableMetricsByPid || this.fileTableMetricsLoading) return;

        const { dataPackage, fileTableView, metricsModel } = this;
        if (!metricsModel) return;
        if (typeof fileTableView?.viewModel?.set === "function") {
          fileTableView.viewModel.set("showMetrics", true);
        }
        this.fileTableMetricsLoading = true;
        const isCurrentMetrics = () =>
          this.isCurrentDataPackage(dataPackage) &&
          fileTableView === this.fileTableView &&
          metricsModel === this.metricsModel;

        const updateTableMetrics = async () => {
          if (!isCurrentMetrics()) {
            this.fileTableMetricsLoading = false;
            return;
          }
          this.stopListening(metricsModel, "error");
          this.fileTableMetricsByPid = FileTableMetrics.parse(
            metricsModel.toJSON(),
          );
          if (this.fileTableMetricsByPid.size && this.fileTableView) {
            const rows = this.getFileTableRows();
            if (!isCurrentMetrics()) {
              this.fileTableMetricsLoading = false;
              return;
            }
            fileTableView.viewModel.mergeRows(rows);
          }
          this.fileTableMetricsLoading = false;
        };

        if (metricsModel.get("synced")) {
          await updateTableMetrics();
          return;
        }

        this.listenToOnce(metricsModel, "sync", updateTableMetrics);
        this.listenToOnce(metricsModel, "error", (_model, error) => {
          if (!isCurrentMetrics()) {
            this.fileTableMetricsLoading = false;
            return;
          }
          this.stopListening(metricsModel, "sync");
          this.fileTableMetricsLoading = false;
          console.warn("File table metrics could not be loaded:", error);
        });

        if (!metricsModel.get("fetching")) {
          metricsModel.fetch();
        }
      },

      /**
       * Handle an action emitted by the generic file table.
       * @param {FileItemViewModel} rowModel File table row model
       * @param {FileItemActionViewModel} actionModel Action view model
       * @param {Event} event Click event
       * @returns {boolean|Promise<boolean>} Whether the action was handled
       * @since 0.0.0
       */
      handleFileTableAction(rowModel, actionModel, event) {
        const actionId = actionModel?.get?.("id");

        if (actionId === "preview") {
          return this.previewFileTableRow(rowModel, event);
        }
        if (actionId === "open-dataset") {
          const id = rowModel?.get?.("id");
          if (!id) return false;
          event?.preventDefault?.();
          window.open(
            `${MetacatUI.root}/view/${encodeURIComponent(id)}`,
            "_blank",
          );
          return true;
        }
        if (actionId === "download") {
          return this.downloadFileTableRow(rowModel, actionModel, event);
        }
        return false;
      },

      /**
       * Scroll to the rendered entity section for a file table preview click.
       * @param {FileItemViewModel} rowModel File table row model
       * @param {Event} event Click event
       * @returns {boolean} True when a row was handled
       * @since 0.0.0
       */
      previewFileTableRow(rowModel, event) {
        const id = rowModel?.get?.("id");
        if (!id) return false;

        event?.preventDefault?.();
        window.location.hash = encodeURIComponent(id);
        const entityDetails = this.findEntityDetailsContainer(id);
        if (entityDetails) MetacatUI.appView.scrollTo(entityDetails);
        return true;
      },

      /**
       * Download the package member represented by a file table row.
       * @param {FileItemViewModel} rowModel File table row model
       * @param {FileItemActionViewModel} actionModel Download action model
       * @param {Event} event Click event
       * @returns {Promise<boolean>} Whether the row could be downloaded
       * @since 0.0.0
       */
      async downloadFileTableRow(rowModel, actionModel, event) {
        const id = rowModel?.get?.("id");
        if (!id) return false;

        event?.preventDefault?.();
        const actionState = actionModel.toJSON();
        if (rowModel.get("kind") === "dataset" && rowModel.get("downloadUrl")) {
          window.open(rowModel.get("downloadUrl"), "_blank");
          return true;
        }

        const { dataPackage, fileTableView } = this;
        if (!dataPackage) return false;

        const downloadStates =
          this.fileTableDownloadStates ||
          (this.fileTableDownloadStates = new Map());
        if (downloadStates.has(id)) return false;
        const downloadState = {
          isDisabled: true,
          label: "Downloading...",
          title: `Downloading ${rowModel.getDisplayLabel()}`,
          ariaLabel: `Downloading ${rowModel.getDisplayLabel()}`,
          iconClass: "icon icon-spinner icon-spin",
        };
        downloadStates.set(id, downloadState);
        actionModel.set(downloadState);

        try {
          const member = dataPackage.getMember(id);
          const downloadUrl = rowModel.get("downloadUrl");
          const downloadModel = this.createDataDetailsModel(member);
          if (downloadModel && !downloadModel.get("url") && downloadUrl) {
            downloadModel.set("url", downloadUrl);
          }
          if (typeof downloadModel?.downloadWithCredentials === "function") {
            await downloadModel.downloadWithCredentials();
            return true;
          }

          if (!downloadUrl) return false;
          window.open(downloadUrl, "_blank");
        } finally {
          if (downloadStates.get(id) === downloadState) {
            downloadStates.delete(id);
          }
          actionModel.set(actionState);
          if (
            this.dataPackage === dataPackage &&
            this.fileTableView === fileTableView &&
            fileTableView?.viewModel
          ) {
            fileTableView.viewModel.mergeRows(this.getFileTableRows());
            this.scheduleFileTableScrollIndicatorUpdate();
          }
        }
        return true;
      },

      /**
       * Insert a link to the parent dataset(s) when this package is nested
       * inside another package. The parents are the latest metadata documents
       * aggregated by the resource map(s) that aggregate this package's resource
       * map.
       * @param {object} [options] Render options
       * @returns {Promise<void>}
       */
      async insertParentLink(options = {}) {
        const renderOptions = this.getRenderOptions(options);
        const { renderId, signal } = renderOptions;
        const container = this.el?.querySelector(this.parentLinkContainer);
        if (!container) return;
        container.innerHTML = "";

        const { dataPackage } = this;
        if (!dataPackage) return;
        const rmMember = dataPackage.getRootResourceMapMember();
        const parentResourceMapPids = await this.getParentResourceMapPids(
          rmMember,
          { signal },
        );
        if (!this.isCurrentRender(renderId)) return;
        if (!parentResourceMapPids.length) return;

        const parents = await this.fetchParentPackageMetadata(
          parentResourceMapPids,
          { signal },
        );
        if (!this.isCurrentRender(renderId)) return;
        const selfMetadataPid = this.metadata?.pid;

        parents.forEach((parent) => {
          if (!parent.id || parent.id === selfMetadataPid) return;
          const icon = $(document.createElement("i")).addClass(
            CLASS_NAMES.iconLevelUp,
          );
          const link = $(document.createElement("a"))
            .attr(
              "href",
              `${MetacatUI.root}/view/${encodeURIComponent(parent.id)}`,
            )
            .addClass(CLASS_NAMES.parentLink)
            .text(MESSAGES.parentDataset(parent.title || parent.id))
            .prepend(icon);

          $(container).append(link);
        });
      },

      /**
       * Resolve the resource map PIDs that aggregate this package's resource map
       * (its parents). Prefers the resolved member's `resourceMap` index field
       * and falls back to querying the resource map object directly.
       * @param {DataPackageMember} rmMember Root resource map member
       * @param {object} [options] Options
       * @param {AbortSignal} [options.signal] Active render signal
       * @returns {Promise<string[]>} Parent resource map PIDs, excluding this
       * package's own resource map
       * @since 0.0.0
       */
      async getParentResourceMapPids(rmMember, options = {}) {
        const { signal } = options;
        const selfPid = rmMember?.pid || this.dataPackage?.rootResourceMapPid;
        if (!selfPid) return [];

        // Fast path: the resolved member may already carry the resource map's
        // `resourceMap` index field (the parents that aggregate it).
        const fromMember = this.normalizeResourceMapList(
          rmMember?.resourceMap,
          selfPid,
        );
        if (fromMember.length) return fromMember;

        // Fall back to querying the resource map object's own `resourceMap`
        // field, which lists the parent resource maps that aggregate it.
        try {
          const response = await QueryService.queryWithFetch({
            q: QueryService.getQueryPart("id", selfPid),
            fields: ["resourceMap"],
            rows: 1,
            signal,
          });
          const docs = QueryService.parseResponse(response) || [];
          return this.normalizeResourceMapList(docs[0]?.resourceMap, selfPid);
        } catch (error) {
          if (isAbortError(error)) return [];
          console.error("Error querying for parent resource maps:", error);
          return [];
        }
      },

      /**
       * Normalize a resourceMap relationship value to an array of PIDs,
       * excluding the package's own resource map PID.
       * @param {string|string[]} raw The raw resourceMap value
       * @param {string} selfPid The package's own resource map PID to exclude
       * @returns {string[]} Parent resource map PIDs
       * @since 0.0.0
       */
      normalizeResourceMapList(raw, selfPid) {
        let list = [];
        if (Array.isArray(raw)) list = raw;
        else if (raw) list = [raw];
        return list.filter((pid) => pid && pid !== selfPid);
      },

      /**
       * Query for the latest metadata documents in the given parent resource
       * maps.
       * @param {string[]} parentResourceMapPids Parent resource map PIDs
       * @param {object} [options] Options
       * @param {AbortSignal} [options.signal] Active render signal
       * @returns {Promise<object[]>} Latest parent metadata index docs
       * @since 0.0.0
       */
      async fetchParentPackageMetadata(parentResourceMapPids, options = {}) {
        const { signal } = options;
        const metadataQuery = QueryService.getQueryPart(
          "formatType",
          "METADATA",
        );
        const rmQuery = parentResourceMapPids
          .map((pid) => QueryService.getQueryPart("resourceMap", pid))
          .join(" OR ");

        const response = await QueryService.queryWithFetch({
          q: `${metadataQuery} AND (${rmQuery})`,
          fields: ["id", "title", "obsoletedBy", "resourceMap"],
          rows: 100,
          archived: true,
          usePost: true,
          signal,
        });
        const docs = QueryService.parseResponse(response) || [];

        // Only show the latest metadata in each version chain (i.e. not
        // obsoleted by another document already in the result set).
        const ids = new Set(docs.map((doc) => doc.id));
        return docs.filter(
          (doc) => !doc.obsoletedBy || !ids.has(doc.obsoletedBy),
        );
      },

      /** Insert the citation header into the view */
      insertCitation() {
        if (!this.citationModel) return;
        // Create a citation header element from the model attributes
        const header = new CitationHeaderView({ model: this.citationModel });
        this.$(this.citationContainer).html(header.render().el);
      },

      /** Show a logo for the repository that hosts this metadata */
      insertDataSource() {
        if (
          !this.metadata ||
          !MetacatUI.nodeModel ||
          !MetacatUI.nodeModel.get("members").length ||
          !this.$(this.dataSourceContainer).length
        ) {
          return;
        }

        // const dataSource =
        // MetacatUI.nodeModel.getMember(metadata.datasource);
        const dataSource = MetacatUI.nodeModel.getMember(
          this.metadata.datasource,
        );
        let replicaMNs = MetacatUI.nodeModel.getMembers(
          this.metadata.replicaMN,
        );

        // Filter out the data source from the replica nodes
        if (Array.isArray(replicaMNs) && replicaMNs.length) {
          replicaMNs = _.without(replicaMNs, dataSource);
        }

        if (dataSource && dataSource.logo) {
          this.$(`img.${CLASS_NAMES.dataSource}`).remove();

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
            .addClass(CLASS_NAMES.hasDataSource);

          this.$(this.citationContainer).addClass(CLASS_NAMES.hasDataSource);
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
       * @param {object} [options] Render options
       * @returns {Promise<boolean>} A promise that resolves to true if the user
       * has write permissions, false otherwise.
       */
      async checkWritePermissions(options = {}) {
        const renderOptions = this.getRenderOptions(options);
        const { renderId, signal } = renderOptions;
        const { dataPackage } = this;
        const canWrite = await dataPackage.checkWritePermissions({
          refresh: true,
          signal,
        });
        if (!this.isCurrentRender(renderId)) return false;
        this.canWrite = canWrite;

        this.controls?.viewModel.set("hasWritePermission", this.canWrite);
        return this.canWrite;
      },

      /**
       * Add the info icons to the metadata controls panel. Shows if the dataset
       * is private or archived.
       * @param {object} [options] Render options
       * @returns {Promise<void>} Resolves when public state has been checked
       * @since 2.32.0
       */
      async renderInfoIcons(options = {}) {
        const { renderId } = this.getRenderOptions(options);
        const { metadata } = this;
        const isPublic = await this.getDataMemberIsPublic(metadata);
        if (!this.isCurrentRender(renderId) || this.metadata !== metadata)
          return;
        const isPrivate = isPublic === false;
        const isArchived = metadata?.archived === true;

        if (isPrivate) {
          this.addInfoIcon(
            CLASS_NAMES.private,
            CLASS_NAMES.iconLock,
            CLASS_NAMES.private,
            MESSAGES.privateDataset,
          );
        }
        if (isArchived) {
          this.addInfoIcon(
            CLASS_NAMES.archived,
            CLASS_NAMES.iconTrash,
            CLASS_NAMES.danger,
            MESSAGES.archivedDataset,
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
       * @since 2.32.0
       */
      addInfoIcon(iconType, iconClass, baseClass, titleText) {
        const iconHTML = `<span class="${iconType} ${CLASS_NAMES.icon}">
            <span class="${CLASS_NAMES.iconStackBase} ${iconType} ${CLASS_NAMES.tooltipThis}"
                  data-toggle="tooltip"
                  data-placement="top"
                  data-container="#metadata-controls-container"
                  title="${titleText}">
              <i class="${CLASS_NAMES.iconCircleBase} ${baseClass}"></i>
              <i class="${CLASS_NAMES.icon} ${iconClass} ${CLASS_NAMES.iconStackTop}"></i>
            </span>
          </span>`;

        // Convert the string into DOM element so we can return it
        const range = document.createRange();
        const newIconFragment = range.createContextualFragment(iconHTML);
        const newIcon = newIconFragment.firstChild;

        let iconContainer = this.el.querySelector(
          `${this.citationContainer} .${CLASS_NAMES.datasetInfoIconsContainer}`,
        );
        if (!iconContainer) {
          const title = this.el.querySelector(
            `${this.citationContainer} .title`,
          );
          if (!title) return newIcon;
          iconContainer = document.createElement("span");
          iconContainer.classList.add(CLASS_NAMES.datasetInfoIconsContainer);
          title.append(iconContainer);
        }

        iconContainer.append(newIcon);

        return newIcon;
      },

      /** When the data package collection saves successfully, tell the user */
      saveSuccess() {
        // The saved resource map has a new PID; reflect it in the package
        // state, the URL, and the displayed package identifier.
        const packageId = this.dataPackage.getRootResourceMapMember()?.pid;
        if (packageId) {
          this.dataPackage.rootResourceMapPid = packageId;
          this.resourceMap = this.dataPackage.getRootResourceMapMember();
        }
        MetacatUI.uiRouter.navigate(`view/${packageId}`, {
          trigger: false,
          replace: true,
        });

        const message = $(document.createElement("div")).append(
          $(document.createElement("span")).text(MESSAGES.savedChanges),
        );

        this.showViewAlert(message, CLASS_NAMES.alertSuccess, "body", 4000, {
          remove: true,
        });

        // Clear pending provenance edits. The package's saved state is
        // reconciled by the upload finalization (savedRevision sync).
        this.saveProvPending = false;
        this.hideSaving();

        // Turn off "save" footer
        this.hideEditorControls();

        // Rerender the file table so it reflects the new resource map PID.
        this.insertPackageTable();
      },

      /**
       * When the data package collection fails to save, tell the user
       * @param {string} errorMsg The error message to display
       */
      saveError(errorMsg) {
        const errorId = `error${Math.round(Math.random() * 100)}`;
        const message = $(document.createElement("div")).append(
          `<p>${MESSAGES.unsavedChangesError}</p>`,
        );

        message.append(
          $(document.createElement("a"))
            .text(MESSAGES.seeDetails)
            .attr("data-toggle", "collapse")
            .attr("data-target", `#${errorId}`)
            .addClass(CLASS_NAMES.pointer),
          $(document.createElement("div"))
            .addClass(CLASS_NAMES.collapse)
            .attr("id", errorId)
            .append($(document.createElement("pre")).text(errorMsg)),
        );

        this.showViewAlert(message, CLASS_NAMES.alertError, "body", null, {
          emailBody: `Error message: Data Package save error: ${errorMsg}`,
          remove: true,
        });

        this.saveProvPending = false;
        this.hideSaving();

        // Turn off "save" footer
        this.hideEditorControls();
      },

      /**
       * If provenance relationships have been modified by the provenance editor
       * (in ProvChartView), then update the ORE Resource Map and save it to the
       * server.
       */
      async saveProv() {
        // Only call this function once per save operation.
        if (this.saveProvPending) return;

        const { dataPackage, renderId } = this;
        if (dataPackage.getResourceMapModel()?.hasUnsavedChanges()) {
          this.saveProvPending = true;
          this.showSaving();
          try {
            const result = await dataPackage.upload({
              resourceMapOnly: true,
            });
            if (
              !this.isCurrentRender(renderId) ||
              this.dataPackage !== dataPackage
            ) {
              return;
            }
            if (result.outcome === "success") {
              this.saveSuccess(result);
            } else {
              const details = result.getErrorMessages?.() || [];
              console.warn(
                "ResourceMap provenance changes were not saved:",
                details,
                result,
              );
              this.saveError(
                details.length
                  ? details.join("\n")
                  : MESSAGES.resourceMapProvChangesNotSaved,
              );
            }
          } catch (error) {
            if (
              !this.isCurrentRender(renderId) ||
              this.dataPackage !== dataPackage
            ) {
              return;
            }
            const issueMessages =
              error?.code === "validation_failure"
                ? (error.issues || [])
                    .map((issue) => issue?.message)
                    .filter(Boolean)
                : [];
            this.saveError(
              issueMessages.length
                ? issueMessages.join("\n")
                : error.message || String(error),
            );
          }
        } else {
          this.showViewAlert(
            MESSAGES.noChangesToSave,
            CLASS_NAMES.alertInfo,
            "body",
            4000,
            { remove: true },
          );
        }
      },

      /** Inactivate the save button during the save process */
      showSaving() {
        this.$("#save-metadata-prov")
          .html(MESSAGES.savingHtml)
          .addClass(CLASS_NAMES.btnDisabled);

        this.$("input, textarea, select, button").prop("disabled", true);
      },

      /** Activate the save button after the save process */
      hideSaving() {
        this.$("input, textarea, select, button").prop("disabled", false);

        // When prov is saved, revert the Save button back to normal
        this.$("#save-metadata-prov")
          .html(MESSAGES.save)
          .removeClass(CLASS_NAMES.btnDisabled);
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
       * Finds the element in the rendered metadata that describes the given
       * data entity.
       * @param {string|object} model Data member identifier or model
       * @param {Element|jQuery} [containerEl] Container to search within
       * @returns {jQuery|boolean} The entity section or false if it cannot be
       * found
       * @since 0.0.0
       */
      findEntityDetailsContainer(model, containerEl) {
        return (
          this.metadataView?.findEntityDetailsContainer?.(model, containerEl) ||
          false
        );
      },

      /**
       * Get the public read flag for a data member.
       * @param {DataPackageMember} member Package member
       * @returns {boolean|null} Public read state
       * @since 0.0.0
       */
      async getDataMemberIsPublic(member) {
        if (!member) return null;

        if (Object.prototype.hasOwnProperty.call(member, "isPublic")) {
          if (typeof member.isPublic === "boolean") return member.isPublic;
          if (member.isPublic === "true") return true;
          if (member.isPublic === "false") return false;
        }
        if (typeof member.isPublic === "function") {
          return member.isPublic();
        }
        return null;
      },

      /**
       * Adapt a package member for legacy data detail and download views.
       * @param {DataPackageMember} member Package member
       * @returns {object|null} Backbone style data model
       * @since 0.0.0
       */
      createDataDetailsModel(member) {
        if (!member) return null;

        const memberData = member.toJSON();
        const model = new SolrResult({
          ...memberData,
          id: member.pid,
        });
        const url = member.url || member.viewServiceEntity?.objectUrl;
        if (url) model.set("url", url);
        return model;
      },

      /**
       * Publish the current package after user confirmation.
       * @returns {Promise<string>} Published package identifier
       * @throws {Error} When publishing is cancelled or fails
       */
      async publish() {
        // TODO: Replace the browser confirm dialog with a custom modal.
        const confirmationMessage = MESSAGES.publishConfirmation(this.pid);
        // eslint-disable-next-line no-alert
        if (!window.confirm(confirmationMessage)) {
          return Promise.reject(new Error(MESSAGES.publishCancelled));
        }
        this.showLoading(MESSAGES.publishingPackage);

        try {
          const { pid: newId, resourceMapPending } =
            await this.dataPackage.publish();
          const newUrl = UrlUtilities.getViewLink(newId);
          this.hideLoading();

          // just get the view/id part of the URL
          const routerUrl = newUrl.substring(newUrl.indexOf("/view/"));
          if (resourceMapPending) {
            MetacatUI.appView.showAlert(
              MESSAGES.publishPending(newId, newUrl),
              CLASS_NAMES.alertWarning,
              "body",
              15000,
              { remove: true },
            );
          } else {
            const msg = MESSAGES.publishSuccess(newId, newUrl);
            this.$el.prepend(
              this.alertTemplate({
                msg,
                classes: CLASS_NAMES.alertSuccess,
              }),
            );
          }

          setTimeout(() => {
            this.$el.html("");
            this.showLoading();
            MetacatUI.uiRouter.navigate(routerUrl, { trigger: true });
          }, 3000);

          return newId;
        } catch (error) {
          this.hideLoading();
          const message =
            error instanceof Error ? error.message : String(error);
          const formattedMessage = MESSAGES.publishFailed(message);
          this.showError(formattedMessage, { remove: true });
          throw new Error(formattedMessage);
        }
      },

      /**
       * Show an alert at the top of the metadata if there is a newer version of
       * this metadata available
       * @param {string} pid - The PID of the latest version. If null or
       * undefined, the alert will be removed.
       */
      showLatestVersion(pid) {
        // if there is already an alert, remove it.
        if (this.newVersionAlert) this.newVersionAlert.remove();
        const { dataPackage } = this;
        if (!dataPackage) return;
        const metadataPid = dataPackage.getPrimaryMetadataMember()?.pid;
        if (!pid || pid === this.pid || pid === metadataPid) return;
        // insert the template
        const versionAlertHtml = this.versionTemplate({ pid });
        const template = document.createElement("div");
        template.innerHTML = versionAlertHtml;
        this.newVersionAlert = template.firstChild;
        this.el.prepend(this.newVersionAlert);
      },

      /**
       * Show the previous/next version navigation buttons
       * @param {object} [options] Render options
       * @since 2.36.0
       */
      async showVersionNavigation(options = {}) {
        const renderOptions = this.getRenderOptions(options);
        const { renderId, signal } = renderOptions;
        const { dataPackage } = this;
        if (!dataPackage) return;
        const metadataPid = dataPackage.getPrimaryMetadataMember()?.pid;
        if (this.versionNavigation) {
          this.subviews = this.subviews.filter(
            (view) => view !== this.versionNavigation,
          );
          this.versionNavigation.remove();
        }
        const versionNavigation = new VersionNavigationView({
          pid: metadataPid,
          documentType: "dataset",
          signal,
        });
        this.versionNavigation = versionNavigation;
        this.subviews.push(versionNavigation);
        await versionNavigation.render();
        if (!this.isCurrentRender(renderId)) {
          this.subviews = this.subviews.filter(
            (view) => view !== versionNavigation,
          );
          versionNavigation.remove();
          return;
        }
        const container = this.el.querySelector(
          `.${CLASS_NAMES.VERSION_NAVIGATION_CONTAINER}`,
        );
        if (container) container.appendChild(versionNavigation.el);

        // If not on newest version, show the alert about newest version available
        let latestVersion = null;
        try {
          latestVersion = await dataPackage.getLatestVersionPid({ signal });
        } catch (error) {
          if (isAbortError(error) || !this.isCurrentRender(renderId)) {
            return;
          }
          console.error("Error checking latest dataset version:", error);
        }
        if (!this.isCurrentRender(renderId)) return;
        this.showLatestVersion(latestVersion);
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

      /**
       * Update the visible loading message, if one is currently rendered.
       * @param {string} message Loading message
       * @returns {void}
       * @since 0.0.0
       */
      updateLoadingText(message) {
        if (!message || typeof message !== "string") return;
        const loadingPara = this.$el
          .find(`.${CLASS_NAMES.loading} > p`)
          .first();
        if (loadingPara.length) loadingPara.text(message);
      },

      /**
       * Update the loading message for a typed DataPackage load phase.
       * @param {object} [progress] DataPackage load progress payload
       * @returns {void}
       * @since 0.0.0
       */
      updateDataPackageLoadProgress(progress = {}) {
        const message = DataPackage.LoadProgressMessages[progress.phase];
        if (message) this.updateLoadingText(message);
      },

      /** Hide the loading message */
      hideLoading() {
        if (this.$loading) this.$loading.remove();
        if (this.$detached) this.$el.html(this.$detached);
      },

      /**
       * Show an app alert owned by MetadataView and keep a handle so it can be
       * removed when this view is replaced.
       * @param {...*} args Arguments forwarded to AppView.showAlert()
       * @returns {Element[]|Element|null} The alert element returned by
       * AppView.showAlert()
       * @since 0.0.0
       */
      showViewAlert(...args) {
        this.removeViewAlert();
        this.activeAlert = MetacatUI.appView.showAlert(...args);
        return this.activeAlert;
      },

      /**
       * Remove the current app alert owned by MetadataView, if any.
       * @returns {void}
       * @since 0.0.0
       */
      removeViewAlert() {
        if (!this.activeAlert) return;
        $(this.activeAlert).remove();
        this.activeAlert = null;
      },

      /**
       * Show an error message to the user
       * @param {string} msg - The error message to display
       * @param {object} [options] - Additional options to pass to the alert
       * template.
       */
      showError(msg, options = {}) {
        // Remove any existing error messages
        this.$el.children(`.${CLASS_NAMES.alertContainer}`).remove();

        this.$el.prepend(
          this.alertTemplate({
            msg,
            classes: CLASS_NAMES.alertError,
            containerClasses: "page",
            includeEmail: true,
            ...options,
          }),
        );
      },

      /**
       * Delegate in-page data previews to the rendered metadata document.
       * @param {Event} event Preview link click
       * @returns {boolean} Whether the member could be previewed
       */
      previewData(event) {
        if (this.metadataView?.previewData) {
          return this.metadataView.previewData(event);
        }
        event.preventDefault();
        return false;
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

        if (entityDetailsEl && entityDetailsEl.length) {
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
       * Close and remove the rendered metadata child view.
       * @returns {void}
       * @since 0.0.0
       */
      closeMetadataView() {
        if (!this.metadataView) return;
        this.metadataView.onClose?.();
        this.metadataView.remove?.();
        this.subviews = (this.subviews || []).filter(
          (subview) => subview !== this.metadataView,
        );
        this.metadataView = null;
      },

      /**
       * Close and remove the package file table child view.
       * @returns {void}
       * @since 0.0.0
       */
      closeFileTableView() {
        this.teardownFileTableScrollIndicators();
        if (!this.fileTableView) return;
        const { fileTableView } = this;
        this.stopListening(fileTableView);
        this.subviews = (this.subviews || []).filter(
          (subview) => subview !== fileTableView,
        );
        if (typeof fileTableView.onClose === "function") {
          fileTableView.onClose();
        } else {
          fileTableView.remove?.();
        }
        this.fileTableView = null;
      },

      /** Actions to perform when the view is closed */
      onClose() {
        this.renderId = null;
        this.abortRender();
        this.stopListening();
        $("meta[name^='citation_']").remove();

        this.removeViewAlert();
        this.closeMetadataView();
        this.closeFileTableView();

        _.each(this.subviews, (subview) => {
          if (subview.onClose) subview.onClose();
        });
        this.subviews = [];
        this.pid = null;
        this.dataPackage = null;
        this.seriesId = null;
        this.$detached = null;
        this.$loading = null;

        // Put the document title back to the default
        MetacatUI.appModel.resetTitle();

        // Remove view-specific classes
        this.$el.removeClass(
          `${CLASS_NAMES.container} ${CLASS_NAMES.noStylesheet}`,
        );

        this.$el.empty();
      },

      /**
       * Insert citation information as meta tags into the head of the page
       *
       * Currently supports Highwire Press style tags (citation_) which is
       * supposedly what Google (Scholar), Mendeley, and Zotero support.
       */
      insertCitationMetaTags() {
        const metadata = this.dataPackage.getPrimaryMetadataMember() || {};
        const id = metadata.pid || metadata.id || this.pid;
        const title = metadata.title || "";
        const authors = metadata.origin || [];
        const publisher = metadata.publisher || metadata.datasource || "";
        const dateValue = metadata.pubDate || metadata.dateUploaded || "";
        const date = dateValue ? new Date(dateValue).getUTCFullYear() : "";
        const isDOI =
          typeof MetacatUI?.appModel?.isDOI === "function" &&
          MetacatUI.appModel.isDOI(id);
        const abstract = metadata.abstract || "";

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
        $("meta[name^='citation_']").remove();

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
    },
  );

  return MetadataView;
});
