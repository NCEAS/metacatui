define([
  "jquery",
  "localforage",
  "collections/ObjectFormats",
  "models/dataPackage/DataPackage",
  "models/fileTable/DataPackageFileTableAdapter",
  "models/metadata/eml211/EML211",
  "models/metadata/eml211/EMLOtherEntity",
  "models/metadata/ScienceMetadata",
  "models/resourceMap/ResourceMap",
  "models/dataPackage/DataPackageRecovery",
  "models/dataONEServices/SysMetaService",
  "views/EditorView",
  "views/CitationView",
  "views/fileTable/FileTableView",
  "views/metadata/EML211View",
  "views/metadata/EMLEntityView",
  "common/DateUtilities",
  "common/ErrorUtilities",
  "common/Utilities",
  "common/UrlUtilities",
  "common/ValueUtilities",
], (
  $,
  LocalForage,
  ObjectFormats,
  DataPackage,
  DataPackageFileTableAdapter,
  EML,
  EMLOtherEntity,
  ScienceMetadata,
  ResourceMap,
  DataPackageRecovery,
  SysMetaService,
  EditorView,
  CitationView,
  FileTableView,
  EMLView,
  EMLEntityView,
  DateUtilities,
  ErrorUtilities,
  Utilities,
  UrlUtilities,
  ValueUtilities,
) => {
  const { isAbortError } = ErrorUtilities;
  const DEFAULT_EDITOR_PACKAGE_MEMBER_LIMIT = 700;
  const INDEX_MANIFEST_ROW_LIMIT = 1000;
  const EDITOR_FILE_TABLE_ROOT_ROW_ID = "dataset:editor-root";
  // A draft re-serializes the entire EML, which blocks the main thread
  // roughly linearly in document size. Coalesce bursts of change events into
  // one trailing save, and skip documents so large that producing the draft
  // itself would freeze the tab (~1MB is already over a second blocked).
  const DRAFT_SAVE_DEBOUNCE_MS = 10000;
  const DRAFT_SAVE_MAX_EML_BYTES = 1000000;

  const CLASS_NAMES = {
    accessPolicyViewContainer: "access-policy-view-container",
    accessPolicyViewModal: "access-policy-view-modal",
    alertError: "alert-error",
    alertSuccess: "alert-success",
    alertWarning: "alert-warning",
    center: "center",
    citationContainer: "citation-container",
    clear: "clear",
    container: "container",
    collapse: "collapse",
    controls: "controls",
    dataSource: "data-source",
    editorControls: "editor-controls hidden",
    editorSaveControls: "editor-save-controls",
    error: "error",
    fileTable:
      "table table-striped table-hover download-contents table-condensed",
    icon: "icon",
    iconCaretDown: "icon icon-caret-down",
    loading: "loading",
    notification: "notification",
    pointer: "pointer",
    primarySaveButton: "btn btn-primary save",
    resizeHandle: "ui-resizable-handle ui-resizable-s",
    rendering: "rendering",
    sideNavItem: "side-nav-item",
    statusAmbiguous: "status-ambiguous",
    statusComplete: "status-complete",
    statusFailed: "status-failed",
    statusInvalidAttributes: "status-invalid-attributes",
    statusMissingAttributes: "status-missing-attributes",
    statusPending: "status-pending",
    statusUploading: "status-uploading",
    statusWarningIcon: "icon icon-circle-blank warning icon-large",
    statusDangerIcon: "icon icon-exclamation-sign danger icon-large",
    statusSuccessIcon: "icon icon-ok-circle success icon-large",
    view: "editor-view",
    viewDatasetButton: "btn btn-large btn-primary center",
  };
  const MESSAGES = {
    addFilesFailed(details) {
      return `Failed to add files to the dataset. Please try again.${details}`;
    },
    addFilesMetadataUpdateFailed(details) {
      return `The files were added, but their metadata could not be updated.${details}`;
    },
    addingFiles: "Adding files...",
    ambiguousUpload:
      "Needs verification. We could not confirm whether this file finished uploading.",
    complete: "Complete",
    dataset: "Dataset",
    dragToResize: "Drag to resize",
    editableBaselineUnavailable:
      "System metadata required to edit this dataset could not be loaded. Reload the page or try again later.",
    failedFilesNetwork:
      "The following files could not be uploaded due to a network issue. Make sure you are connected to a reliable internet connection. ",
    fileChangesStaged: "File changes are still being staged.",
    fixErrorsBeforeSubmitting(errorList) {
      return `Fix the errors flagged below before submitting: ${errorList}`;
    },
    fileTableEmpty: "No files to display yet.",
    fileTableFileColumn: "Files",
    fileTableShareColumn: "Share",
    fileTableStart: "Add files to start your dataset",
    fileTableTitle: "Files in this dataset",
    finishingFileUploads: "Finishing file uploads...",
    findingDataPackage: "Finding the data package...",
    latestVersionForward:
      "You've been forwarded to the newest version of your dataset for editing.",
    loadingEditableDataPackage: "Loading editable data package...",
    lookingForMetadata: "Looking for metadata document...",
    memberLimitBody(memberCount, limit, metadataPid, resourceMapPid) {
      let body =
        `I'm trying to edit a dataset with ${memberCount} package members, ` +
        `but the editor currently supports up to ${limit}. `;
      if (metadataPid) body += `The metadata PID is ${metadataPid}. `;
      if (resourceMapPid) body += `The resource map PID is ${resourceMapPid}. `;
      return `${body}Please help me edit this dataset.`;
    },
    memberLimitMessage(memberCount, limit) {
      return (
        `This dataset contains ${memberCount} package members, which is more than ` +
        `the ${limit} members currently supported by this editor. Editing has been disabled for this dataset.`
      );
    },
    memberLimitSubject(metadataPid) {
      return `Dataset editor member limit exceeded${
        metadataPid ? ` (PID: ${metadataPid})` : ""
      }`;
    },
    missingAttributes: "This file needs to be described. Click Describe.",
    missingAttributeInfo:
      "There is missing information about this file. Click Describe.",
    notAllSubmitted: "Not all of your changes could be submitted.",
    notAuthorized: "You are not authorized to edit this data set.",
    packageSaveInProgress: "A package save is in progress.",
    removeFileFailed(details) {
      return `Failed to remove the file from the dataset. Please try again.${details}`;
    },
    renameFileFailed(details) {
      return `Failed to rename the file in the dataset. Please try again.${details}`;
    },
    replaceFileFailed(details) {
      return `Failed to replace the file in the dataset. Please try again.${details}`;
    },
    resourceMapUnavailable:
      "Resource Map not found for existing metadata document",
    resourceMapNotEditable:
      "This dataset cannot be edited because its Resource Map contains identities or relationships that MetacatUI cannot safely interpret. No changes have been made. Please send the support details below to the support team so the Resource Map can be corrected.",
    saveStateStale:
      "This package has been updated elsewhere. Reload the latest version before saving.",
    saveStateUncertain:
      "The upload state is uncertain. Reload the package before saving again.",
    seeTechnicalDetails: "See technical details",
    sharingSettingsLoadError:
      "Sharing settings could not be loaded. Please try again.",
    startingEditor: "Starting the editor...",
    submittingChanges: "Submitting changes...",
    submittedChanges: "Your changes have been submitted.",
    uploadDidNotComplete: "The upload did not complete.",
    uploadFailed:
      "Upload failed. Save the dataset to continue without this file.",
    uploadingNow: "Uploading now. This file is being saved to the repository.",
    unsupportedEditableFormat(formatId) {
      return `The editor only supports configured editable EML documents at this time. The formatId of this document is ${formatId}.`;
    },
    viewDataset: "View your dataset",
    waitingToUpload:
      "Waiting to upload. This file will be saved before the dataset is submitted.",
    waitingForUploads(count) {
      return `Waiting for ${count} ${count === 1 ? "file" : "files"} to upload...`;
    },
    checkingAuthorization: "Checking authorization...",
    checkingLatestMetadata: "Checking for the latest metadata version...",
    checkingPermissions: "Checking permissions to edit metadata...",
    notIndexed:
      "This metadata document is being indexed. Please try again in a few minutes.",
    submittingFiles(count, total = null) {
      const hasTotal = Number.isFinite(total) && total > 0;
      const countText = hasTotal ? `${count}/${total}` : count;
      const fileCount = hasTotal ? total : count;
      return `Submitting ${countText} ${fileCount === 1 ? "file" : "files"}...`;
    },
    untitledDataset: "Untitled dataset",
  };
  /**
   * @class EML211EditorView
   * @classdesc A view of a form for creating and editing EML 2.1.1 documents
   * @classcategory Views/Metadata
   * @name EML211EditorView
   * @augments EditorView
   * @constructs
   */
  const EML211EditorView = EditorView.extend(
    /** @lends EML211EditorView.prototype */ {
      /**
       * The type of View this is
       * @type {string}
       */
      type: "EML211Editor",

      /**
       * A method that returns the initial template for the editor view
       * @param {object} attrs - An object containing the attributes to render
       * @param {string} attrs.loading - The loading message to display
       * @param {string} attrs.submitButtonText - The text to display on the
       * submit button
       * @returns {string} The HTML template for the editor view
       */
      template(attrs) {
        return `<article class="${CLASS_NAMES.view}">
          <header id="editor-header">
            <div id="breadcrumb-container"></div>
            <div id="citation-container" class="${CLASS_NAMES.citationContainer}"></div>
            <div id="data-source-container" class="${CLASS_NAMES.dataSource}"></div>
            <div id="controls-container" class="${CLASS_NAMES.controls}"></div>
            <div class="${CLASS_NAMES.accessPolicyViewContainer}"></div>
            <div class="${CLASS_NAMES.clear}"></div>
          </header>
          <section id="editor-body">
            <div id="data-package-container"></div>
            <div id="metadata-container">${attrs.loading}</div>
          </section>
          <section id="editor-footer" class="${CLASS_NAMES.editorControls}">
            <div class="${CLASS_NAMES.editorSaveControls}">
              <a class="${CLASS_NAMES.primarySaveButton}" id="save-editor">${attrs.submitButtonText}</a>
            </div>
          </section>
        </article>`;
      },

      /**
       * Returns the template for the message to display after the editor has
       * been submitted
       * @param {object} attrs - An object containing the attributes to render
       * @param {string} attrs.messageText - The message to display
       * @param {string} attrs.viewURL - The URL to view the dataset
       * @param {string} attrs.buttonText - The text to display on the button
       * @returns {string} The HTML template for the submit message
       */
      editorSubmitMessageTemplate(attrs) {
        return `<div class="${CLASS_NAMES.container}">
          <p>${attrs.messageText}</p>
          <p>
            <a class="${CLASS_NAMES.viewDatasetButton}" href="${attrs.viewURL}">
              ${attrs.buttonText}
            </a>
          </p>
        </div>`;
      },

      /**
       * The text to use in the editor submit button
       * @type {string}
       */
      submitButtonText: MetacatUI.appModel.get("editorSaveButtonText"),

      /**
       * The events this view will listen to and the associated function to
       * call. This view will inherit events from the parent class, EditorView.
       * @type {object}
       */
      events: Object.assign(EditorView.prototype.events, {
        change: "saveDraft",
        "click .message-row .addFiles": "handleFileTableStartAddFiles",
      }),

      /**
       * The identifier of the root package EML being rendered
       * @type {string}
       */
      pid: null,

      /**
       * A list of the subviews of the editor
       * @type {Backbone.Views[]}
       */
      subviews: [],

      /**
       * The file table view for package members.
       * @type {FileTableView}
       */
      fileTableView: null,

      /**
       * Whether a file table edit is still staging package metadata changes.
       * @type {boolean}
       */
      fileTableEditInProgress: false,

      /**
       * Last known eager upload progress by package member PID.
       * @type {Object<string, number>}
       */
      fileUploadProgressByPid: null,

      /**
       * Member PIDs whose content is being replaced. Used to show the row as
       * uploading immediately, before replaceFile() resolves and the eager
       * upload begins emitting progress under the new PID.
       * @type {Set<string>|null}
       */
      replacingPids: null,

      /**
       * Number of package members being submitted by the current save.
       * Includes system metadata only uploads.
       * @type {number|null}
       */
      packageSaveUploadCount: null,

      /**
       * Total package members submitted by the current save.
       * @type {number|null}
       */
      packageSaveUploadTotal: null,

      /**
       * Current package save preparation message shown on the Save button.
       * @type {string|null}
       */
      packageSavePrepMessage: null,

      /**
       * Package member PIDs that have not finished submitting in this save.
       * @type {Set<string>|null}
       */
      packageSavePendingPids: null,

      /**
       * EML entity matches for the current editor file table render.
       * @type {Map<string, EMLEntity>}
       */
      entityByMemberPid: null,

      /**
       * Whether EML entities need to be reconciled with package data members.
       * @type {boolean}
       */
      metadataEntitySyncNeeded: true,

      /**
       * Opaque identifier for the render that currently owns async callbacks.
       * @type {string|null}
       */
      renderId: null,

      /**
       * AbortController for fetch capable work owned by the active render.
       * @type {AbortController|null}
       */
      renderAbortController: null,

      /** @inheritdoc */
      initialize(options = {}) {
        // Ensure the object formats are cached for the editor's use
        Utilities.awaitObjectFormats();
        this.pid = options?.pid || null;
        this.fileTableEditInProgress = false;
        this.fileUploadProgressByPid = {};
        this.replacingPids = new Set();
        this.packageSaveUploadCount = null;
        this.packageSaveUploadTotal = null;
        this.packageSavePrepMessage = null;
        this.packageSavePendingPids = null;
        this.entityByMemberPid = null;
        this.metadataEntitySyncNeeded = true;
        this.renderId = null;
        this.renderAbortController = null;
        return this;
      },

      /** Create a new EML model for this view */
      createModel() {
        let model = null;
        // If no pid is given, create a new EML model
        if (!this.pid) model = new EML({ synced: true, isNew: true });
        // Otherwise create a generic metadata model until we find out the
        // formatId
        else model = new ScienceMetadata({ id: this.pid });

        // Once the ScienceMetadata is populated, populate the associated
        // package
        this.model = model;

        // Listen for the replace event on this model
        const view = this;
        this.listenTo(this.model, "replace", (newModel) => {
          if (view.model.get("id") === newModel.get("id")) {
            const previousModel = view.model;
            view.stopListening(previousModel);
            if (typeof previousModel.handleChange === "function") {
              previousModel.off(
                "change",
                previousModel.handleChange,
                previousModel,
              );
            }
            view.entityByMemberPid = null;
            view.metadataEntitySyncNeeded = true;
            view.model = newModel;
            view.setListeners();
          }
        });

        this.setListeners();
      },

      /** @inheritdoc */
      render() {
        const view = this;
        const { renderId, signal } = this.startRender();

        // Execute the superclass render() function, which will add some basic
        // Editor functionality
        EditorView.prototype.render.call(this);

        MetacatUI.appModel.set("headerType", "default");

        // Empty the view element first
        this.$el.empty();

        // Inert the basic template on the page
        this.$el.html(
          this.template({
            loading: MetacatUI.appView.loadingTemplate({
              msg: MESSAGES.startingEditor,
            }),
            submitButtonText: this.submitButtonText,
          }),
        );

        // If we don't have a model at this point, create one
        if (!this.model) this.createModel();

        // Before rendering the editor, we must:
        // 1. Make sure the user is signed in
        // 2. Fetch the metadata
        // 3. Use the metadata to identify and then fetch the resource map
        // 4. Make sure the user has write permission on the metadata
        // 5. Make sure the user has write permission on the resource map

        // As soon as we have all of the metadata information (STEP 2
        // complete)...
        this.stopListening(this.model, "sync");
        this.listenToOnce(this.model, "sync", async () => {
          if (!this.isCurrentRender(renderId)) return;
          // Skip the remaining steps the metadata doesn't exist.
          if (this.model.get("notFound") === true) {
            this.handleMetadataNotFound({ renderId, signal });
            return;
          }

          this.renderCitationHeader(this.model);
          this.updateLoadingText(MESSAGES.findingDataPackage);
          try {
            const dataPackage = await this.getDataPackage(this.model, {
              renderId,
              signal,
            });
            if (!this.isCurrentRender(renderId)) return;
            if (dataPackage) {
              this.renderEditorComponents();
            }
          } catch (error) {
            if (isAbortError(error) || !this.isCurrentRender(renderId)) {
              return;
            }
            this.handleDataPackageLoadError(error);
          }
        });

        // STEP 1 Check that the user is signed in
        const afterAccountChecked = () => {
          if (!this.isCurrentRender(renderId)) return;
          if (MetacatUI.appUserModel.get("loggedIn") === false) {
            // If they are not signed in, then show the sign-in view
            view.showSignIn();
          } else {
            // STEP 2 If signed in, then fetch model
            view.fetchModel({ renderId, signal });
          }
        };
        // If we've already checked the user account
        if (MetacatUI.appUserModel.get("checked")) {
          afterAccountChecked();
        }
        // If we haven't checked for authentication yet, wait until the user
        // info is loaded before we request the Metadata
        else {
          this.listenToOnce(
            MetacatUI.appUserModel,
            "change:checked",
            afterAccountChecked,
          );
        }

        // When the user mistakenly drops a file into an area in the window that
        // isn't a proper drop-target, prevent navigating away from the page.
        // Without this, the user will lose their progress in the editor.
        window.addEventListener(
          "dragover",
          (e) => {
            e.preventDefault();
          },
          false,
        );

        window.addEventListener(
          "drop",
          (e) => {
            e.preventDefault();
          },
          false,
        );

        return this;
      },

      /**
       * If the pid for the metadata doc is not in Solr, then try fetching the
       * system metadata. If sysMeta exists, then the metadata document is being
       * indexed, so notify user. Otherwise, the document doesn't exist, so show
       * a 404.
       * @param {object} [options] Lookup options owned by the active render
       * @param {string} [options.renderId] Render identifier for stale guards
       * @param {AbortSignal} [options.signal] Signal for fetch capable calls
       * @since 2.34.0
       */
      async handleMetadataNotFound(options = {}) {
        const { renderId, signal } = this.getRenderOptions(options);
        this.updateLoadingText(MESSAGES.lookingForMetadata);
        const sysMetaService = new SysMetaService();

        try {
          await sysMetaService.download(this.pid, { signal });
          if (!this.isCurrentRender(renderId)) return;
          this.showNotIndexed();
          // TODO: we can get the formatType from the sysMeta and download
          // metadata if it's EML so indexing status doesn't matter. However,
          // the editor needs to be refactored to handle this.
        } catch (error) {
          if (isAbortError(error) || !this.isCurrentRender(renderId)) {
            return;
          }
          this.showNotFound();
        }
      },

      /**
       * Show a message to the user that the metadata document is being indexed.
       * This will check the user's authorization to write to the document
       * before showing the message. If the user is not authorized, then the not
       * authorized message will be shown instead.
       * @since 2.34.0
       */
      showNotIndexed() {
        const authorization = this.model.get("isAuthorized_write");
        if (authorization === true) {
          this.showFullPageAlert(MESSAGES.notIndexed, "warning");
        } else if (authorization === false) {
          this.notAuthorized();
        } else {
          this.listenToOnce(
            this.model,
            "change:isAuthorized_write",
            this.showNotIndexed,
          );
          this.updateLoadingText(MESSAGES.checkingAuthorization);
          this.model.checkAuthority("write");
        }
      },

      /**
       * Render the editor components (data package view and metadata view), or,
       * if not authorized, render the not authorized message.
       */
      renderEditorComponents() {
        const dp = MetacatUI.rootDataPackage;
        if (!dp || typeof dp.getRootResourceMapMember !== "function") return;
        const resourceMapMember = dp.getRootResourceMapMember();
        const metadataMember = dp.getPrimaryMetadataMember();
        const resMapPermission = resourceMapMember?.isAuthorized_write;
        const metadataPermission = metadataMember?.isAuthorized_write;
        if (resMapPermission === true && metadataPermission === true) {
          // Render the Data Package table. This function will also render
          // metadata.
          this.renderDataPackage();
        } else if (resMapPermission === false || metadataPermission === false) {
          this.notAuthorized();
        }
      },

      /**
       * Fetch the metadata model.
       * @param {object} [options] Fetch options owned by the active render
       * @param {string} [options.renderId] Render identifier for stale guards
       * @param {AbortSignal} [options.signal] Signal for fetch capable calls
       */
      fetchModel(options = {}) {
        // If no ID provided to the view then it's a new document, so skip the fetch
        if (!this.pid) {
          if (options.renderId && !this.isCurrentRender(options.renderId)) {
            return;
          }
          this.model.trigger("sync");
        } else {
          // Fetch the model
          this.model.fetch({ signal: options.signal });
        }
      },

      /**
       * Start a render and cancel work owned by the previous render.
       * @returns {{renderId: string, signal: AbortSignal}} Render identity and
       * cancellation signal
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
       * Cancel fetch capable work owned by the active render.
       * @returns {void}
       * @since 0.0.0
       */
      abortRender() {
        if (!this.renderAbortController) return;
        this.renderAbortController.abort();
        this.renderAbortController = null;
      },

      /**
       * Check whether an asynchronous callback belongs to the active render.
       * @param {string} renderId Render identifier to check
       * @returns {boolean} True when the render still owns the view
       * @since 0.0.0
       */
      isCurrentRender(renderId) {
        return Boolean(renderId && renderId === this.renderId && this.model);
      },

      /**
       * Fill omitted render options from the active render.
       * @param {object} [options] Render options
       * @param {string} [options.renderId] Render identifier
       * @param {AbortSignal} [options.signal] Cancellation signal
       * @returns {{renderId: string|null, signal: AbortSignal|undefined}}
       * Resolved render options
       * @since 0.0.0
       */
      getRenderOptions(options = {}) {
        return {
          renderId: options.renderId || this.renderId,
          signal: options.signal,
        };
      },

      /** @inheritdoc */
      isAccessPolicyEditEnabled() {
        if (!MetacatUI.appModel.get("allowAccessPolicyChanges")) {
          return false;
        }

        if (!MetacatUI.appModel.get("allowAccessPolicyChangesDatasets")) {
          return false;
        }

        const limitedTo = MetacatUI.appModel.get(
          "allowAccessPolicyChangesDatasetsForSubjects",
        );
        if (Array.isArray(limitedTo) && limitedTo.length) {
          const allIds = MetacatUI.appUserModel.get("allIdentitiesAndGroups");
          return limitedTo.filter((id) => allIds.includes(id)).length > 0;
        }
        return true;
      },

      /**
       * Update the text that is shown below the spinner while the editor is
       * loading
       * @param {string} message - The message to display. If not provided, the
       * message will not be updated.
       */
      updateLoadingText(message) {
        if (!message || typeof message !== "string") return;
        const loadingPara = this.$el.find(`.${CLASS_NAMES.loading} > p`);
        if (loadingPara) {
          loadingPara.text(message);
        }
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

      /**
       * Get the data package (resource map) associated with the EML. Save it to
       * MetacatUI.rootDataPackage after required baselines load. The metadata
       * model must already be synced. This method checks write permission on
       * the loaded ResourceMap and primary metadata members.
       * @param {Model} model - The science metadata model for which to find the
       * associated data package
       * @param {object} [options] Loading options owned by the active render
       * @param {string} [options.renderId] Render identifier for stale guards
       * @param {AbortSignal} [options.signal] Signal for fetch capable calls
       * @returns {Promise<DataPackage|null>} Loaded package, or null after a
       * latest version redirect
       */
      async getDataPackage(model, options = {}) {
        const { renderId, signal } = this.getRenderOptions(options);
        const metaModel = model || this.model;
        const metaServiceUrl = await Utilities.awaitMetacatUI({
          property: "metaServiceUrl",
        });
        if (!this.isCurrentRender(renderId)) return null;

        const metaPid =
          metaModel.get("id") ||
          metaModel.get("identifier") ||
          metaModel.get("seriesId") ||
          this.pid;

        if (metaModel.isNew()) {
          if (!this.isCurrentRender(renderId)) return null;
          this.createDataPackage();
          if (!this.isCurrentRender(renderId)) return null;
          const resourceMapMember =
            MetacatUI.rootDataPackage.getRootResourceMapMember();
          const metadataMember =
            MetacatUI.rootDataPackage.getPrimaryMetadataMember();
          if (!resourceMapMember || !metadataMember) {
            throw new Error("New editor package is missing required members");
          }
          resourceMapMember.isAuthorized_write = true;
          metadataMember.isAuthorized_write = true;
          metaModel.set("isAuthorized_write", true);
          this.trigger("dataPackageFound");
          this.setListeners();
          return MetacatUI.rootDataPackage;
        }

        if (!this.isCurrentRender(renderId)) return null;
        MetacatUI.rootDataPackage = null;
        const dataPackage = new DataPackage({
          versionTrackerOptions: { metaServiceUrl },
        });
        this.listenTo(dataPackage.events, "load:progress", (progress) => {
          if (!this.isCurrentRender(renderId)) return;
          this.updateDataPackageLoadProgress(progress);
        });

        // TODO - get latest version should happen in DataONE object.
        this.updateLoadingText(MESSAGES.checkingLatestMetadata);
        const latestPid = await dataPackage
          .getVersionTracker()
          .getLatestVersion(metaPid, { signal });
        if (!this.isCurrentRender(renderId)) return null;
        if (latestPid !== metaPid) {
          metaModel.set("latestVersion", latestPid);
          this.showLatestVersion();
          return null;
        }

        try {
          this.updateLoadingText(MESSAGES.loadingEditableDataPackage);
          const maxMembers = this.getEditorPackageMemberLimit();
          const loadOptions = {
            resolverOptions: { metaServiceUrl },
            maxMembers,
            signal,
          };
          await dataPackage.loadEditablePackage(metaPid, loadOptions);
          if (!this.isCurrentRender(renderId)) return null;
        } catch (error) {
          if (isAbortError(error) || !this.isCurrentRender(renderId)) {
            return null;
          }
          if (error.code === "package_member_limit_exceeded") {
            this.showPackageMemberLimitExceeded(error);
            return null;
          }
          if (error.code === "resource_map_unavailable") {
            error.multipleRMs = dataPackage.resolutionResult?.multipleRMs;
          }
          throw error;
        }

        const resourceMapMember = dataPackage.getRootResourceMapMember();
        const metadataMember = dataPackage.getPrimaryMetadataMember();
        this.updateLoadingText(MESSAGES.checkingPermissions);
        const permissionOptions = { refresh: true, signal };
        const [resourceMapPermission, metadataPermission] = await Promise.all([
          resourceMapMember.checkWritePermission(permissionOptions),
          metadataMember.checkWritePermission(permissionOptions),
        ]);
        if (!this.isCurrentRender(renderId)) return null;

        if (resourceMapPermission && metadataPermission) {
          const record = await dataPackage
            .getUploadRecoveryStore()
            .get(metadataMember.pid)
            .catch(() => null);
          if (!this.isCurrentRender(renderId)) return null;
          if (record?.obsoletesRmPid === resourceMapMember.pid) {
            this.showInterruptedSave(metadataMember.pid);
            return null;
          }
        }

        resourceMapMember.isAuthorized_write = resourceMapPermission;
        metadataMember.isAuthorized_write = metadataPermission;
        metaModel.set("isAuthorized_write", metadataPermission);
        MetacatUI.rootDataPackage = dataPackage;
        this.attachMetadataModelToPackage(metaModel);
        this.trigger("dataPackageFound");
        if (resourceMapPermission && metadataPermission) this.setListeners();
        return dataPackage;
      },

      /**
       * Return the configured editor member limit within the manifest ceiling.
       * @returns {number} Maximum package members the editor will load
       * @since 0.0.0
       */
      getEditorPackageMemberLimit() {
        const configuredLimit = MetacatUI.appModel?.get?.(
          "maxEditorPackageMembers",
        );
        const limit = ValueUtilities.normalizePositiveInteger(
          configuredLimit,
          DEFAULT_EDITOR_PACKAGE_MEMBER_LIMIT,
        );
        return Math.min(limit, INDEX_MANIFEST_ROW_LIMIT);
      },

      /**
       * Block editing and show support details for an oversized package.
       * @param {object} [details] Member limit error or package details
       * @returns {void}
       * @since 0.0.0
       */
      showPackageMemberLimitExceeded(details) {
        const limit =
          details?.maxMembers ||
          this.getEditorPackageMemberLimit() ||
          DEFAULT_EDITOR_PACKAGE_MEMBER_LIMIT;
        const memberCount = details?.memberCount ?? 0;
        const metadataPid =
          this.model?.get?.("id") ||
          this.model?.get?.("identifier") ||
          this.model?.get?.("seriesId") ||
          this.pid;
        const resourceMapPid =
          details?.rootResourceMapPid ||
          details?.getRootResourceMapMember?.()?.pid ||
          null;
        const message = MESSAGES.memberLimitMessage(memberCount, limit);
        const subject = MESSAGES.memberLimitSubject(metadataPid);
        const body = MESSAGES.memberLimitBody(
          memberCount,
          limit,
          metadataPid,
          resourceMapPid,
        );

        this.showFullPageAlert(message, "error", body, subject);
      },

      /**
       * Route editable package loading failures to a blocking editor message.
       * @param {Error} error Loading failure
       * @returns {void}
       * @since 0.0.0
       */
      handleDataPackageLoadError(error) {
        if (error?.code === "resource_map_not_editable") {
          this.showResourceMapNotEditable(error);
          return;
        }
        if (error?.code === "resource_map_unavailable") {
          // Reconstruction is safe only after a definitive missing-map result.
          if (error.multipleRMs === true || error.reason === "missing") {
            this.showResourceMapNotFound(error);
          } else if (error.reason === "unauthorized") {
            this.notAuthorized();
          } else {
            this.loadError(error.cause?.message || error.message);
          }
          return;
        }
        if (error?.code === "editable_baseline_unavailable") {
          this.showFullPageAlert(MESSAGES.editableBaselineUnavailable, "error");
          return;
        }
        this.loadError(error?.message || String(error));
      },

      /**
       * Show a blocking message for a ResourceMap that was found but cannot be
       * safely edited. Diagnostics are rendered as text so imported RDF values
       * cannot inject markup into the editor.
       * @param {Error} error Structured ResourceMap loading error
       * @returns {void}
       * @since 0.0.0
       */
      showResourceMapNotEditable(error) {
        const resourceMapPid = error?.rootResourceMapPid || null;
        const inputId = error?.inputId || this.model?.get?.("id") || null;
        const issues = Array.isArray(error?.issues) ? error.issues : [];
        let supportDetails;
        try {
          supportDetails = JSON.stringify(
            {
              inputId,
              resourceMapPid,
              issues,
            },
            null,
            2,
          );
        } catch (_serializationError) {
          supportDetails = [
            inputId ? `Input PID: ${inputId}` : null,
            resourceMapPid ? `Resource Map PID: ${resourceMapPid}` : null,
            ...issues.map(
              (issue) =>
                `${issue?.code || "resourceMapIssue"}: ${
                  issue?.message || "No message provided"
                }`,
            ),
          ]
            .filter(Boolean)
            .join("\n");
        }

        const message = $(document.createElement("div")).append(
          $(document.createElement("p")).text(MESSAGES.resourceMapNotEditable),
          $(document.createElement("p"))
            .append($(document.createElement("strong")).text("Support details"))
            .append(":"),
          $(document.createElement("pre"))
            .attr("tabindex", "0")
            .text(supportDetails),
        );
        const subject = `Resource Map cannot be edited${
          resourceMapPid ? ` (PID: ${resourceMapPid})` : ""
        }`;
        const body = `I'm trying to edit a dataset, but MetacatUI found unsafe or ambiguous Resource Map RDF. Please help correct the Resource Map.

${supportDetails}`;

        this.showFullPageAlert(message, "error", body, subject);
      },

      /**
       * Creates a DataPackage collection for this EML211EditorView and sets it
       * on the MetacatUI global object (as `rootDataPackage`)
       */
      createDataPackage() {
        this.createRootDataPackage([this.model]);

        // Inherit the access policy of the metadata document, if the metadata
        // document is not `new`
        if (!this.model.isNew()) {
          const metadataAccPolicy = this.model.get("accessPolicy");
          const metadataMember =
            MetacatUI.rootDataPackage.getPrimaryMetadataMember();

          // If there is no access policy, it hasn't been fetched yet, so wait
          if (!metadataAccPolicy.length) {
            // If the model is of ScienceMetadata class, we need to wait for the
            // "replace" function, which happens when the model is fetched and
            // an EML211 model is created to replace it.
            if (this.model.type === "ScienceMetadata") {
              this.listenTo(this.model, "replace", () => {
                this.listenToOnce(this.model, "sysMetaUpdated", () => {
                  metadataMember?.setSystemMetadata(
                    {
                      ...(metadataMember.sysMeta?.toJSON?.() || {}),
                      accessPolicy: this.model.get("accessPolicy"),
                      rightsHolder: this.model.get("rightsHolder"),
                    },
                    { markDirty: false },
                  );
                });
              });
            }
          } else {
            metadataMember?.setSystemMetadata(
              {
                ...(metadataMember.sysMeta?.toJSON?.() || {}),
                accessPolicy: this.model.get("accessPolicy"),
              },
              { markDirty: false },
            );
          }
        }

        // Associate the science metadata with the resource map
        const rootResourceMapPid =
          MetacatUI.rootDataPackage.getRootResourceMapMember()?.pid;
        if (this.model.get && Array.isArray(this.model.get("resourceMap"))) {
          this.model.get("resourceMap").push(rootResourceMapPid);
        } else {
          this.model.set("resourceMap", rootResourceMapPid);
        }
      },

      /**
       * Creates a {@link DataPackage} collection for this Editor view, and
       * saves it as the Root Data Package of the app. This centralizes the
       * DataPackage creation so listeners and other functionality is always
       * performed
       * @param {(ScienceMetadata[]|EML211[])} models An array of metadata
       * models to add to the package
       * @param {object} [attributes] A literal object of attributes to pass to
       * the DataPackage.initialize() function
       * @since 2.17.1
       */
      createRootDataPackage(models, attributes = {}) {
        const metadataModel = models?.[0] || this.model;
        const metadataPid =
          metadataModel.get("id") ||
          metadataModel.get("identifier") ||
          metadataModel.get("seriesId");
        const resourceMapPid =
          attributes.resourceMapPid ||
          attributes.id ||
          (metadataPid
            ? `${ResourceMap.RESOURCE_MAP_PID_PREFIX}${metadataPid}`
            : ValueUtilities.makeUUID({
                prefix: ResourceMap.RESOURCE_MAP_PID_PREFIX,
              }));
        const title = metadataModel.get("title");
        const hasTitle = Array.isArray(title)
          ? Boolean(title[0])
          : Boolean(title);
        if (
          hasTitle &&
          !metadataModel.get("fileName") &&
          typeof metadataModel.setFileName === "function"
        ) {
          metadataModel.setFileName();
        }
        const creatorName = [
          MetacatUI.appUserModel?.get?.("firstName"),
          MetacatUI.appUserModel?.get?.("lastName"),
        ]
          .filter(Boolean)
          .join(" ")
          .trim();
        const resourceMap = ResourceMap.create({
          resourceMapPid,
          resolveServiceUrl: MetacatUI.appModel.get("resolveServiceUrl"),
          memberPids: [metadataPid],
          creatorName,
        });

        MetacatUI.rootDataPackage = new DataPackage({
          members: [
            {
              pid: resourceMapPid,
              formatType: "RESOURCE",
              formatId: "http://www.openarchives.org/ore/terms",
              objectModel: resourceMap,
            },
            {
              pid: metadataPid,
              formatType: "METADATA",
              formatId: metadataModel.get("formatId"),
              type: "EML",
              fileName: metadataModel.get("fileName"),
              objectModel: metadataModel,
              documents: metadataModel.get("documents") || [],
            },
          ],
          sources: ["editor"],
        });
        MetacatUI.rootDataPackage.rootResourceMapPid = resourceMapPid;
        this.attachMetadataModelToPackage(metadataModel);
      },

      /**
       * Attach the current metadata model to its package member.
       * @param {ScienceMetadata|EML211} [metadataModel] Metadata model to attach
       * @returns {DataPackageMember|null} Updated primary metadata member
       * @since 0.0.0
       */
      attachMetadataModelToPackage(metadataModel = this.model) {
        const metadataPid =
          metadataModel.get("id") ||
          metadataModel.get("identifier") ||
          metadataModel.get("seriesId");
        const member =
          MetacatUI.rootDataPackage.getMember(metadataPid) ||
          MetacatUI.rootDataPackage.getPrimaryMetadataMember();
        if (!member) return null;
        member.objectModel = metadataModel;
        member.type = "EML";
        member.formatType = "METADATA";
        const collections = metadataModel.get("collections") || [];
        if (!collections.includes(MetacatUI.rootDataPackage)) {
          metadataModel.set("collections", [
            ...collections,
            MetacatUI.rootDataPackage,
          ]);
        }
        const fileName = metadataModel.get("fileName");
        if (fileName) {
          member.fileName = fileName;
          if (member.sysMeta) member.sysMeta.fileName = fileName;
        }
        return member;
      },

      /**
       * Render the citation header from the loaded metadata model.
       * @param {Backbone.Model} model Metadata model
       * @returns {void}
       * @since 0.0.0
       */
      renderCitationHeader(model) {
        if (!model) return;

        // Tear down a previously rendered citation header before creating a new
        // one. CitationView listens to its model's "change" event, so without
        // this every render (and the two calls per render) would leak a stale
        // CitationView and accumulate them in this.subviews.
        if (this.citationView) {
          this.citationView.remove();
          this.subviews = this.subviews.filter(
            (subview) => subview !== this.citationView,
          );
        }

        const citationView = new CitationView({
          model,
          defaultTitle: MESSAGES.untitledDataset,
          createLink: false,
          createTitleLink: !model.isNew(),
        });

        this.citationView = citationView;
        this.subviews.push(citationView);
        this.$("#citation-container").html(citationView.render().$el);
      },

      /**
       * Add missing EML entities for data members documented by the metadata.
       * @param {DataPackageMember} metadataMember Primary metadata member
       * @returns {void}
       * @since 0.0.0
       */
      syncMetadataEntities(metadataMember) {
        const metadataModel = metadataMember?.objectModel;
        if (!metadataModel?.addEntity) return;

        const documentPids = metadataMember.documents || [];
        const dataMembers = documentPids
          .map((pid) => MetacatUI.rootDataPackage.getMember(pid))
          .filter(
            (dataMember) =>
              dataMember && !dataMember.removed && dataMember.isData?.(),
          );
        const entityByMemberPid = this.buildEntityByMemberPid(
          dataMembers,
          metadataModel,
        );
        const rowPositionByPid = new Map();
        const rows = this.fileTableView?.viewModel?.getRows?.();
        let defaultRowPosition = 0;
        if (rows?.each) {
          rows.each((row) => {
            if (row.get("kind") !== "data") return;
            rowPositionByPid.set(row.get("id"), defaultRowPosition);
            defaultRowPosition += 1;
          });
        }
        this.entityByMemberPid = this.entityByMemberPid || new Map();

        dataMembers.forEach((dataMember) => {
          const formatId =
            dataMember.formatId ||
            dataMember.mediaType ||
            dataMember.uploadFile?.type ||
            "application/octet-stream";
          const descriptor = {
            id: dataMember.pid,
            fileName: dataMember.fileName,
            formatId,
          };
          const existingEntity = entityByMemberPid.get(dataMember.pid);

          if (existingEntity) {
            const nextValues = {};
            if (dataMember.pid && !existingEntity.get?.("downloadID")) {
              nextValues.downloadID = dataMember.pid;
            }
            if (!existingEntity.get?.("entityName") && dataMember.fileName) {
              nextValues.entityName = dataMember.fileName;
            }
            if (
              formatId &&
              (!existingEntity.get?.("entityType") ||
                existingEntity.get?.("entityType") ===
                  "application/octet-stream")
            ) {
              nextValues.entityType = formatId;
            }
            if (!existingEntity.get?.("xmlID")) {
              nextValues.xmlID =
                metadataModel.getUniqueEntityId?.(descriptor) ||
                dataMember.getXMLSafeID?.() ||
                null;
            }
            if (Object.keys(nextValues).length) {
              existingEntity.set?.(nextValues);
            }
            dataMember.set?.("metadataEntity", existingEntity);
            this.entityByMemberPid.set(dataMember.pid, existingEntity);
            return;
          }

          const entity = new EMLOtherEntity({
            entityName: dataMember.fileName,
            entityType: formatId,
            downloadID: dataMember.pid,
            parentModel: metadataModel,
            xmlID:
              metadataModel.getUniqueEntityId?.(descriptor) ||
              dataMember.getXMLSafeID?.(),
            type: "otherEntity",
          });
          metadataModel.addEntity(
            entity,
            rowPositionByPid.has(dataMember.pid)
              ? rowPositionByPid.get(dataMember.pid)
              : defaultRowPosition,
          );
          entityByMemberPid.set(dataMember.pid, entity);
          this.entityByMemberPid.set(dataMember.pid, entity);
        });
        this.metadataEntitySyncNeeded = false;
      },

      /** Render the Data Package View and insert it into this view */
      renderDataPackage() {
        const view = this;

        if (this.fileTableView) {
          this.fileTableView.onClose();
          this.fileTableView.remove();
          this.fileTableView = null;
        }

        view.renderMetadata(this.model);

        const showShare = this.isAccessPolicyEditEnabled();
        const rows = this.getEditorFileTableRows();

        this.fileTableView = new FileTableView({
          id: MetacatUI.rootDataPackage?.rootResourceMapPid || "",
          title: MESSAGES.fileTableTitle,
          className: CLASS_NAMES.fileTable,
          rows,
          emptyMessage: MESSAGES.fileTableEmpty,
          fileColumnLabel: MESSAGES.fileTableFileColumn,
          shareColumnLabel: MESSAGES.fileTableShareColumn,
          actionsColumnLabel: "",
          showIconColumn: true,
          showTitle: false,
          showMetrics: false,
          showShare,
          showStatus: true,
          showActions: true,
        }).render();

        const $packageTableContainer = this.$("#data-package-container");
        $packageTableContainer.html(this.fileTableView.el);

        // Make the view resizable on the bottom
        const handle = $(document.createElement("div"))
          .addClass(CLASS_NAMES.resizeHandle)
          .attr("title", MESSAGES.dragToResize)
          .append(
            $(document.createElement("i")).addClass(CLASS_NAMES.iconCaretDown),
          );
        $packageTableContainer.after(handle);
        $packageTableContainer.resizable({
          handles: { s: handle },
          minHeight: 100,
          maxHeight: 900,
          resize() {
            view.emlView?.resizeTOC();
          },
        });

        const tableHeight = ($(window).height() - $("#Navbar").height()) * 0.4;
        $packageTableContainer.css("height", `${tableHeight}px`);

        const table = this.fileTableView.$el;
        this.listenTo(
          this.fileTableView,
          "action:click",
          this.handleFileTableAction,
        );
        this.listenTo(
          this.fileTableView,
          "rename:commit",
          this.handleFileTableRename,
        );
        this.listenTo(
          this.fileTableView,
          "files:drop",
          this.handleFileTableFilesDrop,
        );
        const refreshFileTableAndLayout = () => {
          this.refreshFileTable();
          if (
            table.outerHeight() > $packageTableContainer.outerHeight() &&
            table.outerHeight() < 220
          ) {
            $packageTableContainer.css(
              "height",
              table.outerHeight() + handle.outerHeight(),
            );
            if (this.emlView) this.emlView.resizeTOC();
          }
        };
        this.listenTo(
          MetacatUI.rootDataPackage.events,
          "change",
          (change = {}) => {
            if (
              change.event === "members:add" ||
              change.event === "members:remove" ||
              change.event === "member:replace" ||
              change.event === "member:rename" ||
              change.event === "member:location" ||
              change.event === "documentation:link" ||
              change.event === "documentation:unlink" ||
              change.event === "documentation:set"
            ) {
              this.metadataEntitySyncNeeded = true;
            }

            if (change.event === "metadata:changed") {
              return;
            }

            clearTimeout(this.fileTableRefreshTimeout);
            this.fileTableRefreshTimeout = setTimeout(() => {
              this.fileTableRefreshTimeout = null;
              refreshFileTableAndLayout();
            }, 0);
          },
        );

        if (this.emlView) this.emlView.resizeTOC();
        this.renderFileTableStartMessage();

        // Save the view as a subview
        this.subviews.push(this.fileTableView);
        this.toggleControls();
        this.toggleEnableControls();
        this.enrichEditorFileTableMembers({
          renderId: this.renderId,
          signal: this.renderAbortController?.signal,
        });
      },

      /**
       * Fill incomplete editor rows from system metadata after the first paint.
       * @param {object} [options] Fetch options owned by the active render
       * @since 0.0.0
       */
      async enrichEditorFileTableMembers(options = {}) {
        const { renderId, signal } = this.getRenderOptions(options);
        const { rootDataPackage: dataPackage } = MetacatUI;
        const { fileTableView } = this;
        if (!dataPackage || !fileTableView) return;
        const isCurrentTable = () =>
          !signal?.aborted &&
          this.isCurrentRender(renderId) &&
          MetacatUI.rootDataPackage === dataPackage &&
          this.fileTableView === fileTableView;

        try {
          const result = await DataPackageFileTableAdapter.enrichMembers(
            dataPackage,
            { signal },
          );
          if (!isCurrentTable()) return;
          if (result.changed) this.refreshFileTable();
        } catch (error) {
          if (isAbortError(error) || !isCurrentTable()) return;
          // eslint-disable-next-line no-console
          console.warn("Editor file details could not be loaded:", error);
        }
      },

      /**
       * Build editor rows from the active package members.
       * @returns {object[]} File table row definitions
       * @since 0.0.0
       */
      getEditorFileTableRows() {
        const resolveBaseUrl =
          MetacatUI.appModel.get("resolveServiceUrl") ||
          MetacatUI.appModel.get("objectServiceUrl") ||
          "";
        const members =
          MetacatUI.rootDataPackage?.members
            ?.getActiveMembers?.()
            ?.filter((member) => !member.isMetadata()) || [];
        const showShare = this.isAccessPolicyEditEnabled();
        this.entityByMemberPid = this.buildEntityByMemberPid(members);
        const title = this.model?.get?.("title");
        const datasetTitle = Array.isArray(title) ? title[0] : title;

        const packageId = MetacatUI.rootDataPackage?.rootResourceMapPid || "";
        return DataPackageFileTableAdapter.buildRows(
          MetacatUI.rootDataPackage,
          {
            mode: "editor",
            members,
            resolveBaseUrl,
            getMemberStatus: (member, type) =>
              this.getEditorFileTableStatus(member, type),
            showShare,
            packageId,
            preferredDatasetRootId: EDITOR_FILE_TABLE_ROOT_ROW_ID,
            packageTitle:
              datasetTitle ||
              (this.model?.isNew?.() ? MESSAGES.untitledDataset : "") ||
              this.model?.get?.("id") ||
              MESSAGES.dataset,
          },
        );
      },

      /**
       * Match data members to existing EML entities without mutating them.
       * @param {DataPackageMember[]} [members] Members to match
       * @param {EML211} [metadataModel] Metadata model containing entities
       * @returns {Map<string, EMLEntity>} Entities keyed by member PID
       * @since 0.0.0
       */
      buildEntityByMemberPid(members = [], metadataModel = this.model) {
        const entities = metadataModel?.get?.("entities");
        const matches = new Map();
        if (!entities?.each) return matches;

        const byDownloadId = new Map();
        const byXmlId = new Map();
        const byFileName = new Map();
        const byFormatName = new Map();
        const rememberUnique = (map, key, entity) => {
          if (!key) return;
          const normalized = String(key).toLowerCase();
          const existingEntity = map.get(normalized);
          if (!map.has(normalized)) {
            map.set(normalized, entity);
          } else if (existingEntity !== entity) {
            map.set(normalized, null);
          }
        };

        entities.each((entity) => {
          const dataPid = entity.getDataPid?.();
          const xmlId = entity.get?.("xmlID");
          const fileName =
            entity.get?.("physicalObjectName") || entity.get?.("entityName");
          const formatName = entity.get?.("entityType");
          if (dataPid) byDownloadId.set(dataPid, entity);
          if (xmlId) byXmlId.set(xmlId, entity);
          rememberUnique(byFileName, fileName, entity);
          rememberUnique(byFileName, fileName?.replace?.(/ /g, "_"), entity);
          rememberUnique(byFormatName, formatName, entity);
        });

        const dataMembers = members.filter((member) => member.isData?.());
        dataMembers.forEach((member) => {
          const { pid } = member;
          const xmlId =
            member.getXMLSafeID?.() ||
            (pid ? String(pid).replace(/</g, "-").replace(/:/g, "-") : "");
          const formatId =
            member.formatId ||
            member.mediaType ||
            member.uploadFile?.type ||
            "application/octet-stream";
          let entity =
            byDownloadId.get(pid) ||
            byXmlId.get(xmlId) ||
            byFileName.get(member.fileName?.toLowerCase()) ||
            byFormatName.get(formatId?.toLowerCase());

          if (!entity && dataMembers.length === 1 && entities.length === 1) {
            entity = entities.at(0);
          }
          if (!entity) return;
          if (entity.getDataPid?.() && entity.getDataPid() !== pid) return;

          matches.set(pid, entity);
        });

        return matches;
      },

      /**
       * Build the editor status shown for a package member row.
       * @param {DataPackageMember} member Package member
       * @param {string} type Member format type
       * @returns {object|null} Row status or null when no status is shown
       * @since 0.0.0
       */
      getEditorFileTableStatus(member, type) {
        const remoteState = member?.remoteState;
        const memberPid = member?.pid;
        // While a replace is being prepared the member is still UPLOADED under
        // its old PID, so show an uploading state optimistically until the eager
        // upload starts reporting progress under the new PID.
        if (memberPid && this.replacingPids?.has(memberPid)) {
          return {
            title: MESSAGES.uploadingNow,
            iconClass: CLASS_NAMES.statusWarningIcon,
            className: CLASS_NAMES.statusUploading,
            progress: 0,
          };
        }
        const hasStoredProgress =
          memberPid &&
          Object.prototype.hasOwnProperty.call(
            this.fileUploadProgressByPid || {},
            memberPid,
          );
        const isSaveProgress =
          hasStoredProgress &&
          this.packageSavePendingPids?.has?.(memberPid) === true;
        const hasProgress =
          hasStoredProgress && (remoteState !== "uploaded" || isSaveProgress);
        const progress = hasProgress
          ? this.fileUploadProgressByPid[memberPid]
          : null;
        if (
          remoteState === "pending" ||
          remoteState === "uploading" ||
          hasProgress
        ) {
          const isUploading = remoteState === "uploading" || hasProgress;
          return {
            title: isUploading
              ? MESSAGES.uploadingNow
              : MESSAGES.waitingToUpload,
            iconClass: CLASS_NAMES.statusWarningIcon,
            className: isUploading
              ? CLASS_NAMES.statusUploading
              : CLASS_NAMES.statusPending,
            progress: Number.isFinite(progress) ? progress : 0,
          };
        }
        if (remoteState === "failed") {
          const uploadError = member?.lastUploadError;
          const uploadErrorMessage = uploadError?.message;
          const title = uploadErrorMessage
            ? `Upload failed: ${uploadErrorMessage}. ` +
              "Save the dataset to continue without this file."
            : MESSAGES.uploadFailed;
          return {
            title,
            iconClass: CLASS_NAMES.statusDangerIcon,
            className: CLASS_NAMES.statusFailed,
          };
        }
        if (remoteState === "ambiguous") {
          return {
            title: MESSAGES.ambiguousUpload,
            iconClass: CLASS_NAMES.statusWarningIcon,
            className: CLASS_NAMES.statusAmbiguous,
          };
        }
        if (type !== "DATA") return null;

        const entity = this.entityByMemberPid
          ? this.entityByMemberPid.get(member.pid)
          : this.model?.getEntity?.(member);
        const attributeList = entity?.get?.("attributeList");
        const linkedAttributeList = attributeList
          ?.get?.("references")
          ?.getLinkedModel?.();
        const hasAttributes =
          attributeList?.hasNonEmptyAttributes?.() === true ||
          linkedAttributeList?.hasNonEmptyAttributes?.() === true;
        if (!entity || !hasAttributes) {
          return {
            title: MESSAGES.missingAttributes,
            iconClass: CLASS_NAMES.statusWarningIcon,
            className: CLASS_NAMES.statusMissingAttributes,
          };
        }
        if (
          entity.isValid?.() === false ||
          attributeList?.isValid?.() === false
        ) {
          return {
            title: MESSAGES.missingAttributeInfo,
            iconClass: CLASS_NAMES.statusDangerIcon,
            className: CLASS_NAMES.statusInvalidAttributes,
          };
        }
        return {
          title: MESSAGES.complete,
          iconClass: CLASS_NAMES.statusSuccessIcon,
          className: CLASS_NAMES.statusComplete,
        };
      },

      /**
       * Merge current package rows into the rendered file table.
       * @returns {void}
       * @since 0.0.0
       */
      refreshFileTable() {
        clearTimeout(this.fileTableRefreshTimeout);
        this.fileTableRefreshTimeout = null;
        if (!this.fileTableView) return;
        const rows = this.getEditorFileTableRows();
        // Merge (rather than replace) so open folders stay open: mergeRows keeps
        // each surviving row's expand/collapse state, updates only changed rows,
        // and re-imposes the incoming order. setRows would discard the row
        // models and reset every folder to its default collapsed state.
        this.fileTableView.viewModel.mergeRows(rows);
        this.renderFileTableStartMessage();
      },

      /**
       * Show the add files prompt for a new package with no data members.
       * @returns {void}
       * @since 0.0.0
       */
      renderFileTableStartMessage() {
        const tableView = this.fileTableView;
        const rows = tableView?.viewModel?.getRows?.();
        if (!tableView || !rows) return;

        tableView.$(".message-row").remove();

        if (!this.model?.isNew?.()) return;
        if (
          rows.length !== 1 ||
          rows.at(0)?.get("className") !== "root-dataset"
        ) {
          return;
        }

        const columnCount = tableView.viewModel.getColumnCount();
        const messageRow = `
          <tr class="data-package-item message-row">
            <td colspan="${columnCount}" class="center">
              <h2 class="subtle center">${MESSAGES.fileTableStart}</h2>
              <button
                type="button"
                class="addFiles btn btn-primary center"
                title="Add Files"
              >
                <i class="icon icon-large icon-plus icon-on-left"></i>
                <span>Add Files</span>
              </button>
            </td>
          </tr>
        `;
        tableView.$("tbody").append(messageRow);
      },

      /**
       * Enable or disable file table interactions.
       * @param {boolean} disabled Whether file table controls are disabled
       * @returns {void}
       * @since 0.0.0
       */
      setFileTableDisabled(disabled) {
        this.fileTableView?.setDisabled?.(disabled);
      },

      /**
       * Update one data member row without rebuilding the table.
       * @param {DataPackageMember|string} memberOrPid Member or PID to update
       * @returns {Backbone.Model|null} Updated row model, or null when absent
       * @since 0.0.0
       */
      updateFileTableMemberStatus(memberOrPid) {
        const member =
          typeof memberOrPid === "string"
            ? MetacatUI.rootDataPackage?.getMember?.(memberOrPid)
            : memberOrPid;
        // Only data members have rows (and entities to match against).
        if (!member?.pid || !member.isData?.()) return null;

        const { remoteState } = member;
        if (
          this.entityByMemberPid &&
          this.model?.getEntity &&
          remoteState !== "pending" &&
          remoteState !== "uploading"
        ) {
          const entity = this.model.getEntity(member);
          if (entity) this.entityByMemberPid.set(member.pid, entity);
          else this.entityByMemberPid.delete(member.pid);
        }

        return (
          this.fileTableView?.viewModel?.updateRow?.(member.pid, {
            status: this.getEditorFileTableStatus(
              member,
              member.getFormatType?.() || member.formatType,
            ),
          }) || null
        );
      },

      /**
       * Open a file picker for package files.
       * @param {object} [options] Picker options
       * @param {boolean} [options.multiple] Whether multiple files are allowed
       * @returns {Promise<File[]>} Selected files
       * @since 0.0.0
       */
      choosePackageFiles({ multiple = false } = {}) {
        return new Promise((resolve) => {
          const input = $(document.createElement("input"))
            .attr("type", "file")
            .css("display", "none");
          if (multiple) input.attr("multiple", "multiple");
          input.on("change", () => {
            const files = Array.from(input[0].files || []);
            input.remove();
            resolve(files);
          });
          this.$el.append(input);
          input.trigger("click");
        });
      },

      /**
       * Show a temporary alert for a failed file replacement.
       * @param {Error} error Replacement failure
       * @returns {void}
       * @since 0.0.0
       */
      showReplaceFileFailedAlert(error) {
        const details = error?.message || (error ? String(error) : "");
        const detailMessage = details
          ? ` ${Utilities.encodeHTML(details)}`
          : "";
        MetacatUI.appView.showAlert(
          MESSAGES.replaceFileFailed(detailMessage),
          CLASS_NAMES.alertError,
          this.$el,
          10000,
          { remove: true },
        );
      },

      /**
       * Show an uploading state while a replacement is prepared.
       * @param {string} rowId File table row identifier
       * @param {DataPackageMember} [member] Member being replaced
       * @returns {void}
       * @since 0.0.0
       */
      startFileReplacementPreview(rowId, member) {
        if (!rowId) return;
        const alreadyReplacing = this.replacingPids?.has(rowId);
        this.replacingPids?.add(rowId);
        if (alreadyReplacing) return;
        const currentMember =
          member || MetacatUI.rootDataPackage.getMember?.(rowId);
        const updatedRow = currentMember
          ? this.fileTableView?.viewModel?.updateRow?.(rowId, {
              status: this.getEditorFileTableStatus(
                currentMember,
                currentMember.getFormatType?.() || currentMember.formatType,
              ),
            })
          : null;
        if (!updatedRow) this.refreshFileTable();
      },

      /**
       * Clear the optimistic replacement state and refresh the table.
       * @param {string} rowId File table row identifier
       * @returns {void}
       * @since 0.0.0
       */
      finishFileReplacementPreview(rowId) {
        if (!this.replacingPids?.delete(rowId)) return;
        this.refreshFileTable();
      },

      /**
       * Build display details for one side of the replacement comparison.
       * @param {object} options Detail sources
       * @param {string} options.pid Object PID
       * @param {DataPackageMember} [options.member] Package member
       * @param {Backbone.Model} [options.rowModel] File table row
       * @param {SystemMetadata|object} [options.sysMeta] System metadata
       * @param {string} [options.label] Preferred title
       * @returns {object} Replacement comparison details
       * @since 0.0.0
       */
      getReplaceFileDetails({ pid, member, rowModel, sysMeta, label }) {
        const values = sysMeta?.toJSON?.() || sysMeta || {};
        const size = Number(values.size ?? member?.size);
        const sizeLabel =
          rowModel?.get?.("sizeLabel") ||
          (Number.isFinite(size) ? ValueUtilities.bytesToSize(size) : "");
        const modified =
          values.dateSysMetadataModified ||
          member?.dateSysMetadataModified ||
          member?.dateModified ||
          member?.modified ||
          values.dateUploaded ||
          member?.dateUploaded ||
          "";

        return {
          title:
            label ||
            rowModel?.get?.("label") ||
            member?.title ||
            member?.getFileName?.() ||
            member?.fileName ||
            values.fileName ||
            "Unavailable",
          size: sizeLabel || "Unavailable",
          modified:
            DateUtilities.toLocalTimestampWithZone(modified) || "Unavailable",
          downloadUrl:
            rowModel?.get?.("downloadUrl") ||
            UrlUtilities.getObjectDownloadUrl(pid),
        };
      },

      /**
       * Render one file details card for the replacement modal.
       * @param {string} heading Card heading
       * @param {object} details Replacement comparison details
       * @param {string} [className] Additional card class
       * @returns {jQuery} Rendered details card
       * @since 0.0.0
       */
      renderReplaceFileDetails(heading, details, className = "") {
        const section = $(document.createElement("section")).addClass(
          "replace-newest-version-details",
        );
        if (className) section.addClass(className);
        section.append(
          $(document.createElement("h5"))
            .addClass("replace-newest-version-details-heading")
            .text(heading),
        );
        const list = $(document.createElement("dl")).addClass(
          "replace-newest-version-detail-list",
        );
        [
          ["Title", details.title],
          ["Size", details.size],
          ["Date modified", details.modified],
        ].forEach(([term, value]) => {
          list.append(
            $(document.createElement("dt")).text(term),
            $(document.createElement("dd")).text(value || "Unavailable"),
          );
        });
        list.append($(document.createElement("dt")).text("Download"));
        const downloadValue = $(document.createElement("dd"));
        if (details.downloadUrl) {
          downloadValue.append(
            $(document.createElement("a"))
              .addClass("replace-newest-version-download")
              .attr({
                href: details.downloadUrl,
                target: "_blank",
                rel: "noopener noreferrer",
              })
              .text("Download file"),
          );
        } else {
          downloadValue.text("Unavailable");
        }
        list.append(downloadValue);
        section.append(list);
        return section;
      },

      /**
       * Stage a file replacement and report its outcome without throwing.
       * @param {string} rowId Existing member PID
       * @param {File} file Replacement file
       * @param {object} [options] Replacement options
       * @param {DataPackageMember} [options.member] Member being replaced
       * @param {string} [options.replacementSourcePid] Newest remote PID
       * @param {boolean} [options.showFailureAlert] Whether to show an alert
       * @returns {Promise<{ok: boolean, error: Error|undefined}>} Replacement
       * outcome
       * @since 0.0.0
       */
      async replaceFileFromFileTable(
        rowId,
        file,
        {
          member = null,
          replacementSourcePid = null,
          showFailureAlert = true,
        } = {},
      ) {
        MetacatUI.rootDataPackage.cancelEagerUpload?.(rowId);
        delete this.fileUploadProgressByPid[rowId];
        // Reflect the pending upload on the row immediately, before the async
        // replace prep (sysmeta fetch, checksum) and eager upload run.
        this.startFileReplacementPreview(rowId, member);
        try {
          if (replacementSourcePid) {
            await MetacatUI.rootDataPackage.replaceFile(rowId, file, {
              replacementSourcePid,
            });
          } else {
            await MetacatUI.rootDataPackage.replaceFile(rowId, file);
          }
          return { ok: true };
        } catch (error) {
          if (showFailureAlert) this.showReplaceFileFailedAlert(error);
          return { ok: false, error };
        } finally {
          // The member now carries a new PID (on success) or is unchanged (on
          // failure); clear the optimistic flag keyed on the old PID so the
          // eager upload's progress, or the restored state, takes over.
          this.finishFileReplacementPreview(rowId);
        }
      },

      /**
       * Ask whether a replacement should target a newer remote version.
       * @param {object} options Modal options
       * @param {string} options.rowId Selected row identifier
       * @param {DataPackageMember} options.member Selected member
       * @param {object} options.sourceDetails Selected version details
       * @param {string} options.latestPid Newest remote PID
       * @param {object} options.latestDetails Newest version details
       * @param {File} options.file Replacement file
       * @returns {Promise<boolean>} True when the newest version was replaced
       * @since 0.0.0
       */
      showReplaceNewestVersionModal({
        rowId,
        member,
        sourceDetails,
        latestPid,
        latestDetails,
        file,
      }) {
        return new Promise((resolve) => {
          let settled = false;
          const finish = (result) => {
            if (settled) return;
            settled = true;
            resolve(result);
          };
          const modal = $(document.createElement("div"))
            .addClass("modal replace-newest-version-modal")
            .attr("role", "dialog");
          const header = $(document.createElement("div"))
            .addClass("modal-header")
            .append(
              $(document.createElement("button"))
                .attr({
                  type: "button",
                  "data-dismiss": "modal",
                  "aria-hidden": "true",
                })
                .addClass("close")
                .html("&times;"),
              $(document.createElement("h4")).text(
                "Replace newest file version?",
              ),
            );
          const errorContainer = $(document.createElement("div"))
            .addClass("alert alert-error")
            .hide();
          const detailsComparison = $(document.createElement("div"))
            .addClass("replace-newest-version-comparison")
            .append(
              this.renderReplaceFileDetails(
                "Version currently in dataset",
                sourceDetails,
                "replace-newest-version-details-current",
              ),
              this.renderReplaceFileDetails(
                "Newest version",
                latestDetails,
                "replace-newest-version-details-newest",
              ),
            );
          const body = $(document.createElement("div"))
            .addClass("modal-body")
            .append(
              $(document.createElement("p"))
                .addClass("replace-newest-version-message")
                .text(
                  "The selected file has already been replaced by a newer version. Replace the newest version instead?",
                ),
              detailsComparison,
              errorContainer,
            );
          const cancelButton = $(document.createElement("a"))
            .addClass("btn")
            .attr({ href: "#", "data-dismiss": "modal" })
            .text("Cancel replacement");
          const confirmButton = $(document.createElement("a"))
            .addClass("btn btn-primary replace-newest-version-confirm")
            .attr("href", "#")
            .text("Replace newest version");
          const footer = $(document.createElement("div"))
            .addClass("modal-footer")
            .append(cancelButton, confirmButton);

          modal.append(header, body, footer);
          const closeModal = () => {
            if (typeof modal.modal === "function") {
              modal.modal("hide");
            } else {
              modal.remove();
            }
          };
          cancelButton.on("click", (clickEvent) => {
            clickEvent.preventDefault();
            finish(false);
            closeModal();
          });
          confirmButton.on("click", async (clickEvent) => {
            clickEvent.preventDefault();
            if (confirmButton.hasClass("disabled")) return;
            const buttons = modal.find(".btn, button");
            buttons.attr("disabled", "disabled").addClass("disabled");
            errorContainer.hide().text("");
            const result = await this.replaceFileFromFileTable(rowId, file, {
              member,
              replacementSourcePid: latestPid,
              showFailureAlert: false,
            });
            if (result.ok) {
              finish(true);
              closeModal();
              return;
            }
            const details =
              result.error?.message ||
              (result.error ? String(result.error) : "");
            errorContainer
              .text(
                `Failed to replace the file in the dataset. Please try again.${
                  details ? ` ${details}` : ""
                }`,
              )
              .show();
            buttons.removeAttr("disabled").removeClass("disabled");
          });
          modal.on("hidden", () => {
            finish(false);
            modal.remove();
          });
          const container = this.$el?.length ? this.$el : $("body");
          container.append(modal);
          if (typeof modal.modal === "function") {
            modal.modal().modal("show");
          }
        });
      },

      /**
       * Run the action selected for a file table row.
       * @param {Backbone.Model} rowModel File table row
       * @param {Backbone.Model} actionModel Selected row action
       * @param {Event} [event] Click event
       * @returns {Promise<boolean>} True when the action was handled
       * @since 0.0.0
       */
      async handleFileTableAction(rowModel, actionModel, event) {
        const actionId = actionModel?.get?.("id");
        const rowId = rowModel?.get?.("id");
        if (!actionId || !rowId) return false;

        event?.preventDefault?.();

        if (actionId === "describe") {
          return this.showEntityForMember(
            MetacatUI.rootDataPackage.getMember(rowId),
            rowModel,
          );
        }

        if (actionId === "add-files") {
          const files = await this.choosePackageFiles({ multiple: true });
          if (!files.length) return false;
          await this.addFilesFromFileTable(rowModel, files);
          return true;
        }

        if (actionId === "share") {
          return this.showFileTableAccessPolicy(rowModel, event);
        }

        if (actionId === "replace") {
          const [file] = await this.choosePackageFiles();
          if (!file) return false;
          const member = MetacatUI.rootDataPackage.getMember?.(rowId);
          const sourcePid = member?.remotePid || rowId;
          this.fileTableEditInProgress = true;
          this.toggleEnableControls();
          this.startFileReplacementPreview(rowId, member);
          try {
            const versionTracker =
              MetacatUI.rootDataPackage.getVersionTracker();
            const latestPid = await versionTracker.getLatestVersion(sourcePid, {
              useCache: false,
            });
            if (latestPid && latestPid !== sourcePid) {
              let latestSysMeta = null;
              try {
                latestSysMeta = await versionTracker.getSysMeta?.(latestPid, {
                  useCache: false,
                });
              } catch (_error) {
                // The modal can still ask for confirmation with partial details.
              }
              await this.showReplaceNewestVersionModal({
                rowId,
                member,
                sourceDetails: this.getReplaceFileDetails({
                  pid: sourcePid,
                  member,
                  rowModel,
                  label:
                    rowModel.get?.("label") ||
                    member?.getFileName?.() ||
                    member?.fileName ||
                    "",
                }),
                latestPid,
                latestDetails: this.getReplaceFileDetails({
                  pid: latestPid,
                  sysMeta: latestSysMeta,
                  label: latestSysMeta?.fileName || "",
                }),
                file,
              });
              return true;
            }
            await this.replaceFileFromFileTable(rowId, file, { member });
            return true;
          } catch (error) {
            this.showReplaceFileFailedAlert(error);
            return true;
          } finally {
            this.fileTableEditInProgress = false;
            this.finishFileReplacementPreview(rowId);
            this.toggleEnableControls();
          }
        }

        if (actionId === "remove") {
          this.fileTableView?.viewModel?.removeRow?.(rowId);
          try {
            await MetacatUI.rootDataPackage.removeMembers(rowId);
          } catch (e) {
            // Check if the item is still in the dataPackage
            const stillExists = MetacatUI.rootDataPackage.getMember(rowId);
            if (stillExists) {
              const details = e?.message || (e ? String(e) : "");
              const detailMessage = details
                ? ` ${Utilities.encodeHTML(details)}`
                : "";
              this.showFullPageAlert(MESSAGES.removeFileFailed(detailMessage));
            }
          } finally {
            this.refreshFileTable();
          }
          return true;
        }

        if (actionId === "download") {
          const downloadUrl = rowModel.get("downloadUrl");
          if (downloadUrl) window.open(downloadUrl, "_blank");
          return Boolean(downloadUrl);
        }

        return false;
      },

      /**
       * Add files through the empty package prompt.
       * @param {Event} [event] Click event
       * @returns {Promise<boolean>} True when files were selected and handled
       * @since 0.0.0
       */
      async handleFileTableStartAddFiles(event) {
        event?.preventDefault?.();
        const rootRow = this.fileTableView?.viewModel
          ?.getRows?.()
          ?.findWhere({ className: "root-dataset" });
        if (!rootRow) return false;

        const files = await this.choosePackageFiles({ multiple: true });
        if (!files.length) return false;
        await this.addFilesFromFileTable(rootRow, files);
        return true;
      },

      /**
       * Load and show sharing controls for a file table row.
       * @param {Backbone.Model} rowModel File table row
       * @param {Event} [event] Click event
       * @returns {Promise<boolean>} True when the request was handled
       * @since 0.0.0
       */
      async showFileTableAccessPolicy(rowModel, event) {
        if (!this.isAccessPolicyEditEnabled()) return false;

        const member = this.getFileTablePackageMember(rowModel);
        if (!member) return false;

        const loadingShown =
          EditorView.prototype.showAccessPolicyLoadingModal.call(this, event);
        if (!loadingShown) return false;
        const modalWasClosed = () => {
          const modal = this.$(
            `${this.accessPolicyViewContainer} .${CLASS_NAMES.accessPolicyViewModal}`,
          );
          return modal.length && !modal.hasClass("in") && !modal.is(":visible");
        };

        // Refresh sysmeta first so the modal shows the current remote rules.
        try {
          if (member.remotePid || member.aggregatedPid) {
            await member.fetchSysMeta({ useCache: false });
            member.isAuthorized_changePermission = await member.checkPermission(
              "changePermission",
              {
                refresh: true,
              },
            );
          } else {
            member.isAuthorized_changePermission = true;
          }
        } catch (error) {
          if (!modalWasClosed()) {
            EditorView.prototype.showAccessPolicyLoadError.call(
              this,
              MESSAGES.sharingSettingsLoadError,
            );
          }
          // eslint-disable-next-line no-console
          console.error("Error loading sharing settings: ", error);
          return true;
        }

        if (modalWasClosed()) return true;

        // The dataset/root row and the primary metadata represent the dataset
        // as a whole, so their policy must broadcast to the package
        // (setPackageAccessPolicy) rather than only the clicked member.
        const packageLevel =
          rowModel?.get?.("kind") === "dataset" ||
          member.isMetadata() ||
          member.isResourceMap();
        const accessPolicyOptions = this.buildAccessPolicyModalOptions(member, {
          packageLevel,
        });
        EditorView.prototype.showAccessPolicyModal.call(
          this,
          event,
          null,
          accessPolicyOptions,
        );
        return true;
      },

      /**
       * Build explicit policy editor options for a package member. The shared
       * AccessPolicyView consumes the policy rules, display context, and apply
       * callback directly rather than via a facade resembling a DataONEObject.
       * @param {DataPackageMember} member Package member
       * @param {object} [options] Modal options
       * @param {boolean} [options.packageLevel] Whether apply should target the
       * whole package
       * @returns {object} AccessPolicy modal options
       */
      buildAccessPolicyModalOptions(member, { packageLevel = false } = {}) {
        const sysMeta = member.sysMeta || member.remoteSysMeta;

        let type = "DataONEObject";
        if (member.isResourceMap()) type = "DataPackage";
        else if (member.isMetadata()) type = "EML";

        return {
          packageLevel,
          policy: sysMeta?.accessPolicy || [],
          policyContext: {
            fileName: member.getFileName(),
            rightsHolder: sysMeta?.rightsHolder || null,
            canChangePermission:
              member.isNew?.() === true ||
              member.isAuthorized_changePermission === true,
            targetPid: member.pid,
            type,
          },
          onApply: (policy, { propagate, rightsHolder, onProgress } = {}) => {
            if (packageLevel) {
              const options = { propagate };
              if (rightsHolder) options.rightsHolder = rightsHolder;
              if (typeof onProgress === "function") {
                options.onProgress = onProgress;
              }
              return MetacatUI.rootDataPackage.setPackageAccessPolicy(
                policy,
                options,
              );
            }
            if (rightsHolder) {
              return MetacatUI.rootDataPackage.setMemberAccessPolicy(
                member.pid,
                policy,
                { rightsHolder },
              );
            }
            return MetacatUI.rootDataPackage.setMemberAccessPolicy(
              member.pid,
              policy,
            );
          },
        };
      },

      /**
       * Resolve the package member represented by a file table row.
       * @param {Backbone.Model} rowModel File table row
       * @returns {DataPackageMember|null} Matching package member
       * @since 0.0.0
       */
      getFileTablePackageMember(rowModel) {
        const rowKind = rowModel?.get?.("kind");
        if (rowKind === "dataset") {
          return MetacatUI.rootDataPackage.getRootResourceMapMember();
        }
        return MetacatUI.rootDataPackage.getMember(rowModel?.get?.("id"));
      },

      /**
       * Add files dropped on a file table row.
       * @param {Backbone.Model} rowModel Drop target row
       * @param {FileList|File[]} files Dropped files
       * @param {Event} [event] Drop event
       * @returns {Promise<void>} Resolves after the files are handled
       * @since 0.0.0
       */
      async handleFileTableFilesDrop(rowModel, files, event) {
        event?.preventDefault?.();
        await this.addFilesFromFileTable(rowModel, Array.from(files || []));
      },

      /**
       * Yield until the browser can paint provisional file rows.
       * @returns {Promise<void>} Resolves on the next animation frame
       * @since 0.0.0
       */
      waitForNextPaint() {
        if (
          typeof window !== "undefined" &&
          typeof window.requestAnimationFrame === "function"
        ) {
          return new Promise((resolve) => {
            window.requestAnimationFrame(resolve);
          });
        }
        return Promise.resolve();
      },

      /**
       * Stage files, link them into the package, and update EML entities.
       * @param {Backbone.Model} rowModel Add target row
       * @param {File[]} files Files to add
       * @returns {Promise<DataPackageMember[]>} Members retained in the package
       * @since 0.0.0
       */
      async addFilesFromFileTable(rowModel, files) {
        if (!files.length) return [];
        this.fileTableEditInProgress = true;
        this.toggleEnableControls();
        let added = [];
        let filesLinked = false;
        try {
          const rowKind = rowModel?.get?.("kind");
          const metadataPid =
            rowKind === "metadata"
              ? rowModel.get("id")
              : MetacatUI.rootDataPackage.getPrimaryMetadataMember()?.pid;
          const atLocation =
            rowKind === "folder" ? rowModel.get("atLocation") : "";
          added = await MetacatUI.rootDataPackage.stageLocalFiles(files);
          // Staging makes provisional rows visible. Paint them before linking
          // adds them to the ResourceMap and starts eager uploads.
          this.refreshFileTable();
          this.toggleControls();
          this.toggleEnableControls();
          await this.waitForNextPaint();
          await MetacatUI.rootDataPackage.linkStagedFiles(added, {
            metadataPid,
            atLocation,
          });
          // ResourceMap membership has changed and eager uploads may have begun,
          // so later metadata errors cannot be represented as a failed add.
          filesLinked = true;
          const metadataMember = metadataPid
            ? MetacatUI.rootDataPackage.getMember(metadataPid)
            : null;
          if (metadataMember) {
            this.syncMetadataEntities(metadataMember);
            await MetacatUI.rootDataPackage.markMemberContentDirty(
              metadataMember.pid,
            );
          }
          return added;
        } catch (error) {
          const details = error?.message || (error ? String(error) : "");
          const detailMessage = details
            ? ` ${Utilities.encodeHTML(details)}`
            : "";
          if (filesLinked) {
            this.refreshFileTable();
            MetacatUI.appView.showAlert(
              MESSAGES.addFilesMetadataUpdateFailed(detailMessage),
              CLASS_NAMES.alertWarning,
              this.$el,
              10000,
              { remove: true },
            );
            return added;
          }
          MetacatUI.appView.showAlert(
            MESSAGES.addFilesFailed(detailMessage),
            CLASS_NAMES.alertError,
            this.$el,
            10000,
            { remove: true },
          );
          if (added.length) this.refreshFileTable();
          return [];
        } finally {
          this.fileTableEditInProgress = false;
          this.toggleEnableControls();
        }
      },

      /**
       * Apply a dataset title or member filename edit from the table.
       * @param {Backbone.Model} rowModel Renamed row
       * @param {string} proposedLabel Proposed title or filename
       * @returns {Promise<void>} Resolves after the rename attempt
       * @since 0.0.0
       */
      async handleFileTableRename(rowModel, proposedLabel) {
        const rowId = rowModel?.get?.("id");
        if (!rowId) return;
        if (rowModel.get("className") === "root-dataset") {
          const title = String(proposedLabel || "").trim();
          if (!title || title === MESSAGES.untitledDataset) {
            this.refreshFileTable();
            return;
          }
          this.model.set("title", [title]);
          this.renderCitationHeader(this.model);
          this.refreshFileTable();
          return;
        }
        if (rowModel.get("isContainer")) return;
        try {
          await MetacatUI.rootDataPackage.renameMemberFile(
            rowId,
            proposedLabel,
          );
        } catch (error) {
          const details = error?.message || (error ? String(error) : "");
          const detailMessage = details
            ? ` ${Utilities.encodeHTML(details)}`
            : "";
          MetacatUI.appView.showAlert(
            MESSAGES.renameFileFailed(detailMessage),
            CLASS_NAMES.alertError,
            this.$el,
            10000,
            { remove: true },
          );
        } finally {
          this.refreshFileTable();
        }
      },

      /**
       * Renders the metadata section of the EML211EditorView
       * @param {Backbone.Model} modelToRender The model to render
       */
      renderMetadata(modelToRender) {
        const { renderId } = this;
        const model = modelToRender || this.model;
        if (!model) return;

        // render metadata as the collection is updated, but only EML passed
        // from the event
        if (typeof model.get !== "function") return;
        const formatId = model.get("formatId");
        const objectFormats = MetacatUI.objectFormats || new ObjectFormats();
        const editableFormats = MetacatUI.appModel.get("editableFormats") || [];
        const isEditableFormat =
          !editableFormats.length || editableFormats.includes(formatId);
        if (!objectFormats.isEML({ formatId }) || !isEditableFormat) {
          const msg = MESSAGES.unsupportedEditableFormat(formatId);
          this.showFullPageAlert(msg, "error");
          return;
        }

        // Create an EML model
        if (model.type !== "EML") {
          // Create a new EML model from the ScienceMetadata model
          // The generic metadata model is already synced, but this typed EML
          // model is not ready until its own object fetch completes. Keeping
          // it unsynced prevents fetch population from being recorded as a
          // user content edit.
          const EMLmodel = new EML({ ...model.toJSON(), synced: false });
          this.attachMetadataModelToPackage(EMLmodel);
          model.trigger("replace", EMLmodel);

          // Fetch the EML and render it
          this.listenToOnce(EMLmodel, "sync", () => {
            if (!this.isCurrentRender(renderId)) return;
            this.renderMetadata(EMLmodel);
          });
          EMLmodel.fetch({ signal: this.renderAbortController?.signal });

          return;
        }

        const metadataMember = this.attachMetadataModelToPackage(model);
        this.syncMetadataEntities(metadataMember);
        this.refreshFileTable();

        // Create an EML211 View and render it
        const emlView = new EMLView({
          model,
          edit: true,
        });
        this.subviews.push(emlView);
        this.emlView = emlView;
        emlView.render();

        // Show the required fields for this editor
        this.renderRequiredIcons(this.getRequiredFields());
        this.listenTo(emlView, "editorInputsAdded", () => {
          this.trigger("editorInputsAdded");
        });

        this.renderCitationHeader(model);

        // Remove the rendering class from the body element
        $("body").removeClass(CLASS_NAMES.rendering);

        // Focus the folder name field once loaded but only if this is a new
        // document
        if (!this.pid) {
          $(".fileTitle").first().focus();
        }
      },

      /**
       * Set listeners on the view's model for various reasons. This function
       * centralizes all the listeners so that when/if the view's model is
       * replaced, the listeners would be reset.
       */
      setListeners() {
        const view = this;
        const { renderId } = this;
        this.stopListening(
          this.model,
          "change:uploadStatus",
          this.showControls,
        );
        this.stopListening(
          this.model,
          "change:uploadStatus",
          this.toggleControls,
        );
        this.listenTo(this.model, "change:uploadStatus", this.toggleControls);

        // Register a listener for any attribute change
        if (typeof this.model.handleChange === "function") {
          this.model.off("change", this.model.handleChange, this.model);
          this.model.on("change", this.model.handleChange, this.model);
        }

        this.stopListening(this.model, "change:errorMessage");
        this.listenTo(this.model, "change:errorMessage", () => {
          view.loadError(this.model.get("errorMessage"));
        });

        Utilities.awaitMetacatUI({ appName: "rootDataPackage" }).then(() => {
          const { rootDataPackage } = MetacatUI;
          const rootDataPackageEvents = rootDataPackage?.events;
          if (
            !this.isCurrentRender(renderId) ||
            typeof rootDataPackageEvents?.on !== "function" ||
            typeof rootDataPackageEvents?.off !== "function"
          ) {
            return;
          }
          const rootDataPackageListeners = [
            ["change", this.toggleControls],
            ["change", this.queueMetadataUploadAfterPackageChange],
            ["upload:cancelled", this.handleSaveCancel],
            [
              "upload:prepare:progress",
              this.handlePackageUploadPrepareProgress,
            ],
            ["upload:progress", this.handlePackageUploadProgress],
            ["upload:success", this.handlePackageUploadSuccess],
            [
              "eagerUpload:complete eagerUpload:error",
              this.handleEagerUploadSettled,
            ],
          ];

          rootDataPackageListeners.forEach(([event, handler]) => {
            this.stopListening(rootDataPackageEvents, event, handler);
            this.listenTo(rootDataPackageEvents, event, handler);
          });
        });

        // When the model is invalid, show the required fields
        this.stopListening(this.model, "invalid", this.showValidation);
        this.stopListening(this.model, "valid", this.showValidation);
        this.listenTo(this.model, "invalid", this.showValidation);
        this.listenTo(this.model, "valid", this.showValidation);

        // When a data package member fails to load, remove it and warn the user
        this.stopListening(
          MetacatUI.eventDispatcher,
          "fileLoadError",
          this.handleFileLoadError,
        );
        this.listenTo(
          MetacatUI.eventDispatcher,
          "fileLoadError",
          this.handleFileLoadError,
        );

        // When a data package member fails to be read, remove it and warn the
        // user
        this.stopListening(
          MetacatUI.eventDispatcher,
          "fileReadError",
          this.handleFileReadError,
        );
        this.listenTo(
          MetacatUI.eventDispatcher,
          "fileReadError",
          this.handleFileReadError,
        );

        // Set a beforeunload event only if there isn't one already
        if (!this.beforeunloadCallback) {
          // When the Window is about to be closed, show a confirmation message
          this.beforeunloadCallback = (e) => {
            if (view.canClose()) {
              view.flushDraftSave();
            } else {
              // Browsers don't support custom confirmation messages anymore, so
              // preventDefault() needs to be called or the return value has to
              // be set
              e.preventDefault();
              e.returnValue = "";
            }
          };
          window.addEventListener("beforeunload", this.beforeunloadCallback);
        }
      },

      /**
       * Queue metadata upload after a package relationship edit.
       * @returns {void}
       * @since 0.0.0
       */
      queueMetadataUploadAfterPackageChange() {
        // Mark the metadata for re-upload on package changes, but skip the set
        // when a save is in progress ("p") or it is already queued ("q").
        const status = this.model.get("uploadStatus");
        if (status !== "p" && status !== "q") {
          this.model.set("uploadStatus", "q");
        }
      },

      /**
       * Clear row progress after an eager upload settles.
       * @param {object} [event] Eager upload event payload
       * @returns {void}
       * @since 0.0.0
       */
      handleEagerUploadSettled(event = {}) {
        const settledPids = [
          ...(event.memberPids || []),
          ...(event.members || []).map((member) => member?.pid),
        ].filter(Boolean);
        settledPids.forEach((pid) => {
          delete this.fileUploadProgressByPid[pid];
        });
        this.refreshFileTable();
        this.toggleEnableControls();
      },

      /**
       * Clear completed row progress after package upload actions succeed.
       * @param {object} [event] Package upload event payload
       * @returns {void}
       * @since 0.0.0
       */
      handlePackageUploadSuccess(event = {}) {
        const actionPids = (event.actions || [])
          .map((action) => action.memberPid || action.targetPid)
          .filter(Boolean);
        if (actionPids.length) {
          actionPids.forEach((pid) => {
            delete this.fileUploadProgressByPid[pid];
            this.packageSavePendingPids?.delete(pid);
          });
          if (this.packageSavePendingPids) {
            this.packageSaveUploadCount = this.packageSavePendingPids.size;
          }
        } else {
          this.fileUploadProgressByPid = {};
        }
        this.toggleEnableControls();
      },

      /**
       * Return failed data members that replaced an existing remote PID.
       * @returns {DataPackageMember[]} Failed replacement members
       * @since 0.0.0
       */
      getFailedFileReplacements() {
        return (MetacatUI.rootDataPackage?.toArray?.() || []).filter(
          (member) =>
            member?.isData?.() &&
            member.remotePid &&
            member.pid !== member.remotePid &&
            member.remoteState === "failed",
        );
      },

      /**
       * Build the user facing label for a failed file upload.
       * @param {DataPackageMember} member Failed member
       * @returns {string} File label with an optional failure reason
       * @since 0.0.0
       */
      getFailedFileMessage(member) {
        const label = member?.fileName || member?.remotePid || member?.pid;
        const reason = member?.lastUploadError?.message;
        return reason ? `${label} - ${reason}` : label;
      },

      /**
       * Restore remote members after their replacement uploads fail.
       * @returns {Promise<string[]>} Labels for discarded replacements
       * @since 0.0.0
       */
      async discardFailedFileReplacements() {
        const discardReplacement =
          MetacatUI.rootDataPackage?.discardFileReplacement;
        if (typeof discardReplacement !== "function") return [];

        const failedReplacements = this.getFailedFileReplacements();
        const skipped = failedReplacements.map((member) =>
          this.getFailedFileMessage(member),
        );
        await failedReplacements.reduce(
          (chain, member) =>
            chain.then(() =>
              discardReplacement.call(MetacatUI.rootDataPackage, member.pid),
            ),
          Promise.resolve(),
        );
        return skipped;
      },

      /**
       * Saves all edits in the collection
       * @param {Event} e - The DOM Event that triggerd this function
       */
      async save(e) {
        const btn = e && e.target ? $(e.target) : this.$("#save-editor");

        // If the save button is disabled, then we don't want to save right now
        if (btn.is(".btn-disabled")) return;
        if (this.fileTableEditInProgress) {
          this.toggleEnableControls();
          return;
        }

        let skippedNewDataFiles = [];
        let skippedFileReplacements = [];
        try {
          const failedNewDataMembers = (
            MetacatUI.rootDataPackage.toArray?.() || []
          ).filter(
            (member) =>
              member?.isData?.() &&
              !member.remotePid &&
              member.remoteState === "failed",
          );
          skippedNewDataFiles = failedNewDataMembers.map((member) =>
            this.getFailedFileMessage(member),
          );
          const failedNewDataPids = failedNewDataMembers.map(
            (member) => member.pid,
          );
          if (failedNewDataPids.length) {
            await MetacatUI.rootDataPackage.removeMembers(failedNewDataPids);
          }
          skippedFileReplacements = await this.discardFailedFileReplacements();
        } catch (error) {
          this.saveError(error.message || String(error));
          return;
        }

        if (!this.model.isValid()) {
          this.model.trigger("invalid");
          return;
        }
        this.model.trigger("valid");

        this.showSaving();
        this.setFileTableDisabled(true);

        try {
          let metadataMember =
            MetacatUI.rootDataPackage.getPrimaryMetadataMember();
          const metadataChanged =
            MetacatUI.rootDataPackage.hasMetadataContentEdits?.() === true ||
            metadataMember?.contentDirty === true;
          if (metadataChanged) {
            if (typeof this.model.setFileName === "function") {
              this.model.setFileName();
            }
            metadataMember = this.attachMetadataModelToPackage(this.model);
            if (this.metadataEntitySyncNeeded) {
              this.syncMetadataEntities(metadataMember);
            }
            if (metadataMember && !metadataMember.contentDirty) {
              await MetacatUI.rootDataPackage.markMemberContentDirty(
                metadataMember.pid,
              );
            }
          }
          const changedMembers =
            MetacatUI.rootDataPackage.getChangedMembers?.() || [];
          this.packageSavePrepMessage = null;
          this.packageSavePendingPids = new Set();
          changedMembers.forEach((member) => {
            if (!member?.pid) return;
            this.packageSavePendingPids.add(member.pid);
            this.fileUploadProgressByPid[member.pid] = 0;
          });
          this.packageSaveUploadTotal = this.packageSavePendingPids.size;
          this.packageSaveUploadCount = this.packageSaveUploadTotal;
          if (
            changedMembers.some((member) => member?.isData?.()) &&
            this.packageSaveUploadCount > 0
          ) {
            this.refreshFileTable();
          }
          this.toggleEnableControls();
          let result = await MetacatUI.rootDataPackage.upload();
          if (result.outcome !== "success") {
            const failedMembers = MetacatUI.rootDataPackage
              .toArray()
              .filter((member) => member.remoteState === "failed");
            const failedReplacements = this.getFailedFileReplacements();
            if (
              failedReplacements.length &&
              failedMembers.every((member) =>
                failedReplacements.includes(member),
              )
            ) {
              skippedFileReplacements.push(
                ...(await this.discardFailedFileReplacements()),
              );
              result = await MetacatUI.rootDataPackage.upload();
            }
          }
          if (result.outcome === "success") {
            this.saveSuccess(result, {
              skippedFileReplacements,
              skippedNewDataFiles,
            });
          } else {
            this.saveError(this.getUploadErrorMessage(result));
          }
        } catch (error) {
          if (error?.code === "validation_failure") {
            const issueWithModelErrors = error.issues?.find(
              (issue) => issue?.errors,
            );
            if (issueWithModelErrors) {
              this.model.validationError = issueWithModelErrors.errors;
              this.model.trigger("invalid");
              this.packageSaveUploadCount = null;
              this.packageSaveUploadTotal = null;
              this.packageSavePrepMessage = null;
              this.packageSavePendingPids = null;
              this.fileUploadProgressByPid = {};
              this.setFileTableDisabled(false);
              this.hideSaving();
              this.refreshFileTable();
              this.toggleEnableControls();
              return;
            }

            const issueMessages = (error.issues || [])
              .map((issue) => issue?.message)
              .filter(Boolean);
            this.saveError(
              issueMessages.length
                ? issueMessages.join("\n")
                : error.message || String(error),
            );
            return;
          }

          this.saveError(error.message || String(error));
        }
      },

      /**
       * Build the editor message for a failed package upload.
       * @param {UploadResult} result Package upload result
       * @returns {string} User facing upload error message
       * @since 0.0.0
       */
      getUploadErrorMessage(result) {
        if (!result) return MESSAGES.uploadDidNotComplete;
        if (result.reloadRequired) {
          return MESSAGES.saveStateUncertain;
        }
        if (result.outcome === "stale_remote") {
          return MESSAGES.saveStateStale;
        }
        const details = result.getErrorMessages?.() || [];
        if (details.length) {
          return `${MESSAGES.notAllSubmitted}:\n\n${details.join("\n")}`;
        }
        return MESSAGES.notAllSubmitted;
      },

      /**
       * When the data package collection saves successfully, tell the user
       * @param {UploadResult} _result Upload result
       * @param {object} [options] Success options
       * @param {string[]} [options.skippedFileReplacements] File replacements
       * skipped so the rest of the package could save
       * @param {string[]} [options.skippedNewDataFiles] New files omitted so the
       * rest of the package could save
       */
      saveSuccess(
        _result,
        { skippedFileReplacements = [], skippedNewDataFiles = [] } = {},
      ) {
        this.packageSaveUploadCount = null;
        this.packageSaveUploadTotal = null;
        this.packageSavePrepMessage = null;
        this.packageSavePendingPids = null;
        this.setFileTableDisabled(false);
        this.hideSaving();
        const metadataPid =
          MetacatUI.rootDataPackage.getPrimaryMetadataMember()?.pid ||
          this.model.get("id");
        if (metadataPid && metadataPid !== this.model.get("id")) {
          this.model.set("id", metadataPid);
        }

        // Change the URL to the new id
        MetacatUI.uiRouter.navigate(
          `submit/${encodeURIComponent(metadataPid)}`,
          { trigger: false, replace: true },
        );

        this.fileUploadProgressByPid = {};
        this.refreshFileTable();
        this.toggleControls();
        this.toggleEnableControls();

        // Construct the save message
        const message = this.editorSubmitMessageTemplate({
          messageText: MESSAGES.submittedChanges,
          viewURL: `${MetacatUI.root}/view/${encodeURIComponent(metadataPid)}`,
          buttonText: MESSAGES.viewDataset,
        });

        MetacatUI.appView.showAlert(
          message,
          CLASS_NAMES.alertSuccess,
          this.$el,
          null,
          { remove: true },
        );

        this.showSkippedFilesWarning(
          "The dataset was saved, but these file replacements were skipped because their uploads failed:",
          skippedFileReplacements,
        );
        this.showSkippedFilesWarning(
          "The dataset was saved, but these new files were not added because their uploads failed:",
          skippedNewDataFiles,
        );

        // Rerender the CitationView
        if (this.citationView) {
          this.citationView.createTitleLink = true;
          this.citationView.render();
        }

        // Reset the state to clean. The package's saved state is reconciled by
        // the upload finalization (savedRevision sync).
        this.model.set("hasContentChanges", false);
      },

      /**
       * Show files omitted from an otherwise successful package save.
       * @param {string} introText Warning introduction
       * @param {string[]} [messages] Skipped file messages
       * @returns {void}
       * @since 0.0.0
       */
      showSkippedFilesWarning(introText, messages = []) {
        if (!messages.length) return;
        const warning = $(document.createElement("div")).append(
          $(document.createElement("p")).text(introText),
        );
        const skippedList = $(document.createElement("ul"));
        messages.forEach((message) => {
          skippedList.append($(document.createElement("li")).text(message));
        });
        warning.append(skippedList);
        MetacatUI.appView.showAlert(
          warning,
          CLASS_NAMES.alertWarning,
          this.$el,
          null,
          { remove: true },
        );
      },

      /**
       * When the data package collection fails to save, tell the user
       * @param {string} errorMsg - The error message from the failed save()
       * function
       */
      saveError(errorMsg) {
        const errorId = `error${Math.round(Math.random() * 100)}`;
        const messageContainer = $(document.createElement("div")).append(
          document.createElement("p"),
        );
        const messageParagraph = messageContainer.find("p");
        let messageClasses = CLASS_NAMES.alertError;

        const failedMembers = MetacatUI.rootDataPackage
          .toArray()
          .filter((member) => member.remoteState === "failed");

        if (
          failedMembers.length &&
          failedMembers.every((member) => member.isData())
        ) {
          // Create a list of file names for the files that failed to upload
          const failedFileList = $(document.createElement("ul"));
          failedMembers.forEach((failedMember) => {
            failedFileList.append(
              $(document.createElement("li")).text(
                this.getFailedFileMessage(failedMember),
              ),
            );
          }, this);

          // Make the error message
          const allNetworkErrors = failedMembers.every((member) => {
            const error = member.lastUploadError;
            return (
              error?.networkError === true ||
              Number(error?.status) === 0 ||
              error?.name === "TypeError"
            );
          });
          messageParagraph.text(
            allNetworkErrors
              ? MESSAGES.failedFilesNetwork
              : `${MESSAGES.notAllSubmitted} Save the dataset again to continue without these files.`,
          );
          messageParagraph.after(failedFileList);
        } else {
          if (
            this.model.get("draftSaved") &&
            MetacatUI.appModel.get("editorSaveErrorMsgWithDraft")
          ) {
            messageParagraph.text(
              MetacatUI.appModel.get("editorSaveErrorMsgWithDraft"),
            );
            messageClasses = CLASS_NAMES.alertWarning;
          } else if (MetacatUI.appModel.get("editorSaveErrorMsg")) {
            messageParagraph.text(MetacatUI.appModel.get("editorSaveErrorMsg"));
            messageClasses = CLASS_NAMES.alertError;
          } else {
            messageParagraph.text(MESSAGES.notAllSubmitted);
            messageClasses = CLASS_NAMES.alertError;
          }

          messageParagraph.after(
            $(document.createElement("p")).append(
              $(document.createElement("a"))
                .text(MESSAGES.seeTechnicalDetails)
                .attr("data-toggle", "collapse")
                .attr("data-target", `#${errorId}`)
                .addClass(CLASS_NAMES.pointer),
            ),
            $(document.createElement("div"))
              .addClass(CLASS_NAMES.collapse)
              .attr("id", errorId)
              .append($(document.createElement("pre")).text(errorMsg)),
          );
        }

        MetacatUI.appView.showAlert(
          messageContainer,
          messageClasses,
          this.$el,
          null,
          {
            emailBody: `Error message: Data Package save error: ${errorMsg}`,
            remove: true,
          },
        );

        // Reset the Saving styling
        this.packageSaveUploadCount = null;
        this.packageSaveUploadTotal = null;
        this.packageSavePrepMessage = null;
        this.packageSavePendingPids = null;
        this.fileUploadProgressByPid = {};
        this.setFileTableDisabled(false);
        this.hideSaving();
        this.refreshFileTable();
        this.toggleEnableControls();
      },

      /**
       * When there is an error loading the metadata, show an error message
       * rather than letting the spinner spin forever
       * @param {string} errorMsg - The error message to display
       * @since 2.32.1
       */
      loadError(errorMsg) {
        if (!errorMsg) return;
        const metadataContainer = this.$("#metadata-container");
        MetacatUI.appView.showAlert(
          errorMsg,
          CLASS_NAMES.alertError,
          metadataContainer,
          null,
        );
        // Hide the loading spinner & message
        this.$(`.${CLASS_NAMES.loading}`).hide();
      },

      /**
       * Find the most recently updated version of the metadata
       */
      showLatestVersion() {
        // Reset the current model
        this.pid = this.model.get("latestVersion");
        this.model = null;

        // Update the URL
        MetacatUI.uiRouter.navigate(`submit/${encodeURIComponent(this.pid)}`, {
          trigger: false,
          replace: true,
        });

        // Render the new model
        this.render();

        // Show a warning that the user was trying to edit old content
        MetacatUI.appView.showAlert(
          MESSAGES.latestVersionForward,
          CLASS_NAMES.alertWarning,
          this.$el,
          12000,
          { remove: true },
        );
      },

      /**
       * Update the Save button during package upload preparation.
       * @param {object} [progress] Upload preparation progress
       * @returns {void}
       * @since 0.0.0
       */
      handlePackageUploadPrepareProgress(progress = {}) {
        this.packageSavePrepMessage = progress.message || null;
        if (
          MetacatUI.rootDataPackage?.isEditLocked?.() ||
          this.packageSaveUploadCount !== null
        ) {
          this.disableControls(
            this.getPackageSaveMessage(),
            MESSAGES.packageSaveInProgress,
          );
          return;
        }
        this.toggleEnableControls();
      },

      /**
       * Update row and Save button progress for one upload action.
       * @param {object} [progress] Upload action progress
       * @returns {void}
       * @since 0.0.0
       */
      handlePackageUploadProgress(progress = {}) {
        this.packageSavePrepMessage = null;
        const memberPid =
          progress.action?.memberPid || progress.action?.targetPid;
        if (!memberPid) return;
        if (!this.fileUploadProgressByPid) this.fileUploadProgressByPid = {};
        const uploadSettled = [
          "succeeded",
          "failed",
          "ambiguous",
          "cancelled",
          "skipped",
        ].includes(progress.status);
        if (uploadSettled) {
          delete this.fileUploadProgressByPid[memberPid];
        } else if (progress.lengthComputable && progress.total) {
          this.fileUploadProgressByPid[memberPid] = Math.min(
            (progress.loaded / progress.total) * 100,
            99,
          );
        } else if (
          !Object.prototype.hasOwnProperty.call(
            this.fileUploadProgressByPid,
            memberPid,
          )
        ) {
          this.fileUploadProgressByPid[memberPid] = 0;
        }

        if (uploadSettled && this.packageSavePendingPids?.has(memberPid)) {
          this.packageSavePendingPids.delete(memberPid);
          this.packageSaveUploadCount = this.packageSavePendingPids.size;
        }
        // Only data members have file-table rows (the metadata and resource
        // map do not). Rebuild the table only when a data member has no row
        // yet; a missing row for the metadata/resource map is expected and
        // must not trigger a full refresh on every progress event.
        const row = this.updateFileTableMemberStatus(memberPid);
        const member = MetacatUI.rootDataPackage?.getMember?.(memberPid);
        if (!row && member?.isData?.()) this.refreshFileTable();
        this.toggleEnableControls();
      },

      /**
       * Show the entity editor
       * @param {Event} e - The DOM Event that triggerd this function
       * @returns {boolean} True when the entity editor is shown
       */
      showEntity(e) {
        if (!e || !e.target) return false;
        if (this.model.type !== "EML") return false;

        const row = $(e.target).parents(".data-package-item");
        const dataPackageMember = MetacatUI.rootDataPackage.getMember(
          row.attr("data-id"),
        );

        return this.showEntityForMember(dataPackageMember);
      },

      /**
       * Show or create the EML entity editor for a data member.
       * @param {DataPackageMember} dataPackageMember Member to describe
       * @param {Backbone.Model} [rowModel] File table row
       * @returns {boolean} True when the entity editor is shown
       * @since 0.0.0
       */
      showEntityForMember(dataPackageMember, rowModel = null) {
        if (!dataPackageMember || this.model.type !== "EML") return false;

        if (
          dataPackageMember.remoteState === "uploading" ||
          dataPackageMember.remoteState === "pending" ||
          dataPackageMember.remoteState === "failed"
        )
          return false;

        this.entityViews = this.entityViews || {};
        let entityView = this.entityViews[dataPackageMember.pid];

        // If there isn't a view yet, create one
        if (!entityView) {
          // Get the entity model for this data package item
          let entityModel =
            this.entityByMemberPid?.get(dataPackageMember.pid) ||
            this.model.getEntity(dataPackageMember);
          if (entityModel) {
            this.entityByMemberPid?.set(dataPackageMember.pid, entityModel);
          }

          // Create a new EMLOtherEntity if it doesn't exist
          if (!entityModel) {
            entityModel = new EMLOtherEntity({
              entityName: dataPackageMember.fileName,
              entityType:
                dataPackageMember.formatId || dataPackageMember.mediaType,
              parentModel: this.model,
              downloadID: dataPackageMember.pid,
              xmlID:
                this.model.getUniqueEntityId?.({
                  id: dataPackageMember.pid,
                  fileName: dataPackageMember.fileName,
                  formatId:
                    dataPackageMember.formatId || dataPackageMember.mediaType,
                }) || dataPackageMember.getXMLSafeID(),
            });

            if (!dataPackageMember.fileName) {
              // Listen to changes to required fields on the otherEntity
              // models
              this.listenTo(entityModel, "change:entityName", () => {
                if (!entityModel.isValid()) return;

                this.model.addEntity(
                  entityModel,
                  this.getDataFileTablePosition(dataPackageMember.pid),
                );
                this.entityByMemberPid?.set(dataPackageMember.pid, entityModel);
                this.showEntityForMember(dataPackageMember, rowModel);
              });
              return false;
            }
            this.model.addEntity(
              entityModel,
              this.getDataFileTablePosition(dataPackageMember.pid),
            );
            this.entityByMemberPid?.set(dataPackageMember.pid, entityModel);
            this.showEntityForMember(dataPackageMember, rowModel);
            return true;
          }

          entityView = new EMLEntityView({
            model: entityModel,
            dataPackageMember,
            edit: true,
            parentView: this,
          });

          this.entityViews[dataPackageMember.pid] = entityView;

          // Render the view
          entityView.render();
        }

        // Show the modal window editor for this entity
        if (entityView) entityView.show();
        return Boolean(entityView);
      },

      /**
       * Return a data row's position among the table's data members.
       * @param {string} pid Data member PID
       * @returns {number} Zero based data row position
       * @since 0.0.0
       */
      getDataFileTablePosition(pid) {
        const rows = this.fileTableView?.viewModel?.getRows?.();
        if (!rows) return 0;

        let position = 0;
        let found = false;
        rows.each((row) => {
          if (row.get("kind") !== "data") return;
          if (row.get("id") === pid) {
            found = true;
            return;
          }
          if (!found) position += 1;
        });
        return position;
      },

      /**
       * Show the entity editor for a model
       * @param {EMLEntity|EMLOtherEntity} model - The model to show
       * @param {boolean} [switchToAttrTab] - Set to true to automatically
       * switch to the attributes tab instead of default overview tab
       * @since 2.34.0
       */
      showEntityFromModel(model, switchToAttrTab = false) {
        const pid = model.getDataPid?.();
        const member = MetacatUI.rootDataPackage.getMember(pid);
        if (!member) return;

        this.showEntityForMember(member);
        if (switchToAttrTab) {
          setTimeout(() => {
            this.entityViews?.[member.pid]?.showAttributesTab();
          }, 100);
        }
      },

      /** Shows a message if the user is not authorized to edit this package */
      notAuthorized() {
        this.showFullPageAlert(MESSAGES.notAuthorized, "error");
      },

      /**
       * Stop editing an older package until its interrupted save is recovered.
       * @param {string} metadataPid Metadata PID with a recovery record
       */
      showInterruptedSave(metadataPid) {
        const message = `
          <p>
            This dataset has an interrupted save. Finish it before continuing
            so the editor can load the latest files.
          </p>
          <div class="repair-dataset-controls" style="margin-top:1em;">
            <button type="button" class="btn btn-primary repair-dataset">Finish interrupted save</button>
            <span class="repair-dataset-status" role="status" aria-live="polite"></span>
          </div>`;

        this.showFullPageAlert(message, "warning");
        this.$(".repair-dataset").one("click", () =>
          this.repairDataset(metadataPid),
        );
      },

      /**
       * Show a message when no resource map was found an existing metadata
       * document.
       * @param {Error} [error] Structured Resource Map loading error
       */
      showResourceMapNotFound(error = {}) {
        const multipleRMs = error.multipleRMs === true;
        // Gather useful info from the model
        const { model } = this;
        const pid =
          model.get("id") || model.get("identifier") || model.get("seriesId");
        const title = model.get("title");
        const updated = model.get("dateModified") || model.get("updateDate");
        // Unavailable or ambiguous maps may still be authoritative, so only a
        // loader-confirmed absence is safe to reconstruct.
        const canRepair =
          Boolean(pid) && error.reason === "missing" && !multipleRMs;

        // Derived information & strings for the message
        const durMs = updated ? Math.abs(new Date() - new Date(updated)) : null;

        const durMin = durMs ? durMs / (1000 * 60) : null;
        const durMinRounded = durMin ? Math.round(durMin) : null;
        const minutesNoun = durMinRounded === 1 ? "minute" : "minutes";

        const durHrs = durMs ? durMs / (1000 * 60 * 60) : null;
        const durHrsFixed = durHrs ? durHrs.toFixed(1) : null;
        const hoursNoun = Number(durHrsFixed) === 1 ? "hour" : "hours";

        const titleStr = title ? `"<strong>${title}</strong>"` : null;
        const thisDoc = titleStr
          ? `the metadata document called ${titleStr}`
          : "this metadata document";

        const durLimitHrs = 1.5; // Give time for the system to process the dataset
        const defaultAdvice = `Please check back soon, and if the problem persists, contact the support team.`;

        // Build the message
        let msg = `We couldn't find the dataset that includes ${thisDoc}. `;

        if (durHrs) {
          if (durHrs < durLimitHrs && !multipleRMs) {
            let timeSinceEdit = `This document was last updated ${durHrsFixed} ${hoursNoun} ago.`;
            if (durHrsFixed < 1) {
              timeSinceEdit = `This document was last updated ${durMinRounded} ${minutesNoun} ago.`;
            }
            msg += `This sometimes happens if the dataset was recently created or edited,
              and our system hasn't fully processed it yet. 
              ${timeSinceEdit}
              ${defaultAdvice}`;
          } else {
            msg += `Please contact our support team`;
            if (pid) {
              msg += ` and mention that you're trying to edit with the metadata document with ID <strong>${pid}</strong>`;
            }
            msg += `.`;
          }
        } else {
          msg += defaultAdvice;
        }

        // Build a subject and body for the support email
        let subject = "Resource Map not found for existing metadata document";
        if (pid) subject += ` (PID: ${pid})`;
        let body = `I'm trying to edit the metadata document ${title ? `called "${title}"` : ""}`;
        body += ` but the editor cannot locate the dataset (resource map) that includes it. `;
        if (pid) body += `The PID of the metadata document is ${pid}. `;
        if (durHrs)
          body += `It was last updated ${durHrsFixed} ${hoursNoun} ago. `;
        body += `This is preventing me from editing the metadata document. Please help me resolve this issue.`;

        // Offer explicit reconstruction opt-in only when the loader confirms
        // the resource map is missing; recovery still attempts exact replay.
        if (canRepair) {
          msg += `<div class="repair-dataset-controls" style="margin-top:1em;">
              <p>
                You can try to repair the dataset so you can continue editing.
                Files added during the interrupted save and changes to the
                dataset's file relationships may not be recovered. Check the
                file list and metadata before saving again.
              </p>
              <button type="button" class="btn btn-primary repair-dataset">Repair this dataset</button>
              <span class="repair-dataset-status" role="status" aria-live="polite"></span>
            </div>`;
        }

        this.showFullPageAlert(msg, "error", body, subject);

        // Wire the repair button with a plain DOM handler: showFullPageAlert has
        // already torn down the view's Backbone listeners, and showAlert
        // serializes the message to HTML, so handlers must attach afterward.
        if (canRepair) {
          this.$(".repair-dataset").one("click", () =>
            this.repairDataset(pid, { allowReconstruct: true }),
          );
        }
      },

      /**
       * Finish an interrupted save by replaying the durable local recovery
       * record for a metadata document, then reload the editor. The confirmed
       * missing map action explicitly opts into server reconstruction (R2).
       * @param {string} metadataPid Orphaned metadata PID to repair
       * @param {object} [recoveryOptions] Recovery strategy options
       * @returns {Promise<void>} Resolves once repair has been attempted
       */
      async repairDataset(metadataPid, recoveryOptions = {}) {
        const button = this.$(".repair-dataset");
        const controls = this.$(".repair-dataset-controls");
        const status = this.$(".repair-dataset-status");
        button.prop("disabled", true);
        controls.attr("aria-busy", "true");
        status.html(
          `<i class="icon icon-spinner icon-spin" aria-hidden="true"></i> Repairing your dataset. This may take a couple of minutes...`,
        );
        try {
          const result = await new DataPackageRecovery({
            resolveServiceUrl: MetacatUI.appModel.get("resolveServiceUrl"),
            objectServiceUrl: MetacatUI.appModel.get("objectServiceUrl"),
          }).recover(metadataPid, recoveryOptions);
          if (result?.recovered) {
            controls.removeAttr("aria-busy");
            status.text(" Repair complete. Reloading...");
            // Point the URL at the recovered PID, then reload: a fresh load
            // re-resolves the package and now finds the recovered resource map
            // (written and cached during recovery).
            MetacatUI.uiRouter.navigate(
              `submit/${encodeURIComponent(metadataPid)}`,
              { trigger: false, replace: true },
            );
            window.location.reload();
            return;
          }
          controls.removeAttr("aria-busy");
          status.text(
            " We couldn't automatically repair this dataset. Please contact the support team.",
          );
          button.prop("disabled", false);
        } catch (error) {
          controls.removeAttr("aria-busy");
          status.text(
            ` Repair failed: ${error?.message || "unknown error"}. Please contact the support team.`,
          );
          button.prop("disabled", false);
        }
      },

      /**
       * Toggle the editor footer controls (Save bar)
       */
      toggleControls() {
        if (MetacatUI.rootDataPackage?.hasUnsavedChanges?.()) {
          this.showControls();
        } else {
          this.hideControls();
        }
      },

      /**
       * Toggles whether the Save controls for the Editor are enabled or
       * disabled based on various attributes of the DataPackage and its models.
       * @since 2.17.1
       */
      toggleEnableControls() {
        if (this.fileTableEditInProgress) {
          this.setFileTableDisabled(false);
          this.disableControls(
            MESSAGES.addingFiles,
            MESSAGES.fileChangesStaged,
          );
          return;
        }
        if (
          MetacatUI.rootDataPackage?.isEditLocked?.() ||
          this.packageSaveUploadCount !== null
        ) {
          this.setFileTableDisabled(true);
          this.disableControls(
            this.getPackageSaveMessage(),
            MESSAGES.packageSaveInProgress,
          );
          return;
        }
        this.setFileTableDisabled(false);
        const pendingUploads =
          MetacatUI.rootDataPackage?.getPendingEagerUploads?.() || [];

        if (pendingUploads.length) {
          const pendingFileCount = pendingUploads.reduce(
            (count, upload) =>
              count +
              (upload.members || []).filter(
                (member) =>
                  member.remoteState === "pending" ||
                  member.remoteState === "uploading",
              ).length,
            0,
          );
          const message = pendingFileCount
            ? MESSAGES.waitingForUploads(pendingFileCount)
            : MESSAGES.finishingFileUploads;
          this.disableControls(message);
        } else {
          this.enableControls();
        }
      },

      /**
       * Return the current package save progress message.
       * @returns {string} Save preparation or upload progress message
       * @since 0.0.0
       */
      getPackageSaveMessage() {
        const count = this.packageSaveUploadCount;
        const total = this.packageSaveUploadTotal;
        if (this.packageSavePrepMessage) return this.packageSavePrepMessage;
        if (count !== null && total > 0) {
          return MESSAGES.submittingFiles(count, total);
        }
        if (count > 0) return MESSAGES.submittingFiles(count);
        return MESSAGES.submittingChanges;
      },

      /**
       * Show any errors that occurred when trying to save changes
       *
       */
      showValidation() {
        // First clear all the error messaging
        this.$(`.notification.${CLASS_NAMES.error}`).empty();
        this.$(`.${CLASS_NAMES.sideNavItem}.${CLASS_NAMES.error}`).removeClass(
          CLASS_NAMES.error,
        );
        this.$(
          `.${CLASS_NAMES.sideNavItem} .${CLASS_NAMES.icon}.${CLASS_NAMES.error}`,
        )
          .removeClass(CLASS_NAMES.error)
          .hide();
        this.$(`#metadata-container .${CLASS_NAMES.error}`).removeClass(
          CLASS_NAMES.error,
        );
        $(".alert-container:not(:has(.temporary-message))").remove();

        const errors = this.model.validationError;

        if (errors && typeof errors === "object") {
          Object.entries(errors).forEach(([category, errorMsg]) => {
            if (typeof errorMsg === "string") {
              // Handle string error messages
              this.showError(category, errorMsg);
            } else if (typeof errorMsg === "object") {
              // Handle object error messages by iterating over leaf nodes
              this.showLeafErrors(category, errorMsg);
            }
          });

          if (Object.keys(errors).length) {
            // Create a list of errors to display in the error message shown to the user
            const errorList = `<ul>${this.getErrorListItem(errors)}</ul>`;

            MetacatUI.appView.showAlert(
              MESSAGES.fixErrorsBeforeSubmitting(errorList),
              CLASS_NAMES.alertError,
              this.$el,
              null,
              {
                remove: true,
              },
            );
          }
        }
      },

      /**
       * Log an error message for a specific category
       * @param {string} category - The category of the error
       * @param {string} errorMsg - The error message to display
       * @since 2.32.1
       */
      showError(category, errorMsg) {
        const categoryEls = this.$(`[data-category='${category}']`);
        const elsWithViews = categoryEls.filter(
          function filterElementsWithViews() {
            const view = $(this).data("view");
            return view && view.showValidation && !view.isNew;
          },
        );

        if (elsWithViews.length) {
          elsWithViews.each(function showElementValidation() {
            $(this).data("view").showValidation();
          });
        } else if (categoryEls.length) {
          // Show the error message
          categoryEls
            .filter(`.${CLASS_NAMES.notification}`)
            .addClass(CLASS_NAMES.error)
            .text(errorMsg);

          // Add the error message to inputs
          categoryEls.filter("textarea, input").addClass(CLASS_NAMES.error);
        }

        // Get the link in the table of contents navigation
        let navigationLink = this.$(
          `.${CLASS_NAMES.sideNavItem}[data-category='${category}']`,
        );

        if (!navigationLink.length) {
          const section = categoryEls.parents("[data-section]");
          navigationLink = this.$(
            `.${CLASS_NAMES.sideNavItem}.${$(section).attr("data-section")}`,
          );
        }

        // Show the error icon in the table of contents
        navigationLink
          .addClass(CLASS_NAMES.error)
          .find(`.${CLASS_NAMES.icon}`)
          .addClass(CLASS_NAMES.error)
          .show();

        this.model.off(`change:${category}`, this.checkValidity, this);
        this.model.once(`change:${category}`, this.checkValidity, this);
      },

      /**
       * Recursively log the leaf errors in the error object
       * @param {string} category - The category of the error
       * @param {string} errorObj - The object containing the error messages
       * @since 2.32.1
       */
      showLeafErrors(category, errorObj) {
        Object.entries(errorObj).forEach(([subCategory, subErrorMsg]) => {
          if (typeof subErrorMsg === "string") {
            this.showError(`${category}`, subErrorMsg);
          } else if (typeof subErrorMsg === "object") {
            this.showLeafErrors(`${subCategory}`, subErrorMsg);
          }
        });
      },

      /** @inheritdoc */
      hasUnsavedChanges() {
        return MetacatUI.rootDataPackage?.hasUnsavedChanges?.() || false;
      },

      /**
       * Refuse to close while an upload is actively writing to the
       * repository. Closing mid save can commit the metadata document without
       * its resource map, leaving an orphaned EML that is hard to recover.
       * @returns {boolean} True when the editor can close
       */
      canClose() {
        if (MetacatUI.rootDataPackage?.isEditLocked?.()) return false;
        return EditorView.prototype.canClose.call(this);
      },

      /** @inheritdoc */
      onClose() {
        // Execute the parent class onClose() function
        // EditorView.prototype.onClose.call(this);

        this.renderId = null;
        this.abortRender();
        clearTimeout(this.fileTableRefreshTimeout);
        this.fileTableRefreshTimeout = null;
        this.flushDraftSave();

        // Remove the listener on the Window
        if (this.beforeunloadCallback) {
          window.removeEventListener("beforeunload", this.beforeunloadCallback);
          delete this.beforeunloadCallback;
        }

        // Remove all the other events
        this.stopListening();
        this.off(); // remove callbacks, prevent zombies
        this.model?.off?.();

        $(".Editor").removeClass("Editor");
        this.$el.empty();

        this.model = null;

        // Close each subview
        this.subviews?.forEach((subview) => {
          if (subview.onClose) subview.onClose();
        });

        this.subviews = [];

        this.undelegateEvents();
      },

      /**
       * Handle "fileLoadError" events by alerting the user and removing the row
       * from the data package table.
       * @param  {DataPackageMember} item The member passed by fileLoadError
       * event
       */
      handleFileLoadError(item) {
        let message;
        let fileName;
        this.refreshFileTable();
        if (item?.fileName) {
          fileName = item.fileName;
          message = `The file ${fileName} is already included in this dataset. The duplicate file has not been added.`;
        } else {
          message =
            "The chosen file is already included in this dataset. " +
            "The duplicate file has not been added.";
        }
        MetacatUI.appView.showAlert(message, "alert-info", this.el, 10000, {
          remove: true,
        });
      },

      /**
       * Handle "fileReadError" events by alerting the user and removing the row
       * from the data package table.
       * @param  {DataPackageMember} item The member passed by fileReadError
       * event
       */
      handleFileReadError(item) {
        let message;
        let fileName;
        this.refreshFileTable();
        if (item?.fileName) {
          fileName = item.fileName;
          message =
            `The file ${fileName} could not be read. You may not have permission to read the file,` +
            ` or the file was too large for your browser to upload. ` +
            `The file has not been added.`;
        } else {
          message =
            "The chosen file " +
            " could not be read. You may not have permission to read the file," +
            " or the file was too large for your browser to upload. " +
            "The file has not been added.";
        }
        MetacatUI.appView.showAlert(message, "alert-info", this.el, 10000, {
          remove: true,
        });
      },

      /**
       * Queue a draft save of the EML model. Editing a field fires one DOM
       * change event per blur, and each draft serializes the whole document,
       * so drafts are debounced. Documents above the size cap are not drafted
       * at all: for those, serializing freezes (or crashes) the tab, which
       * costs the user more than a missing draft.
       */
      saveDraft() {
        clearTimeout(this.draftSaveTimeout);
        const emlSize = this.model?.get?.("objectXML")?.length || 0;
        if (emlSize > DRAFT_SAVE_MAX_EML_BYTES) return;
        this.draftSaveTimeout = setTimeout(() => {
          this.draftSaveTimeout = null;
          if (this.model) this.saveDraftNow();
        }, DRAFT_SAVE_DEBOUNCE_MS);
      },

      /**
       * Run a pending draft save immediately. Used only when the editor is
       * closing, so normal field edits stay debounced.
       */
      flushDraftSave() {
        if (!this.draftSaveTimeout) return;
        clearTimeout(this.draftSaveTimeout);
        this.draftSaveTimeout = null;
        const emlSize = this.model?.get?.("objectXML")?.length || 0;
        if (emlSize <= DRAFT_SAVE_MAX_EML_BYTES && this.model) {
          this.saveDraftNow();
        }
      },

      /** Serialize and store a draft of the parent EML model immediately. */
      saveDraftNow() {
        const view = this;

        const title = this.model.get("title") || "No title";
        // Create a clone of the model that we will use for serialization. Don't
        // serialize the model that is currently being edited, since serialize
        // may make changes to the model that should not happen until the user
        // is ready to save (e.g. - create a contact if there is not one)
        const draftModel = this.model.clone();

        LocalForage.setItem(this.model.get("id"), {
          id: this.model.get("id"),
          datetime: new Date().toISOString(),
          title: Array.isArray(title) ? title[0] : title,
          draft: draftModel.serialize(),
        }).then(() => {
          view.clearOldDrafts();
        });
      },

      /**
       * Clear older drafts by iterating over the sorted list of drafts stored
       * by LocalForage and removing any beyond a hardcoded limit.
       */
      clearOldDrafts() {
        let drafts = [];

        LocalForage.iterate((value, key) => {
          // Extract each draft
          drafts.push({
            key,
            value,
          });
        })
          .then(() => {
            // Sort by datetime
            drafts = drafts
              .sort((a, b) =>
                a.value.datetime
                  .toString()
                  .localeCompare(b.value.datetime.toString()),
              )
              .reverse();
          })
          .then(() => {
            drafts?.forEach((draft, i) => {
              const age = new Date() - new Date(draft.value.datetime);
              const isOld = age / 2678400000 > 1; // ~31days

              // Delete this draft is not in the most recent 100 or if older
              // than 31 days
              const shouldDelete = i > 100 || isOld;

              if (!shouldDelete) {
                return;
              }

              LocalForage.removeItem(draft.key).then(() => {
                // Item should be removed
              });
            });
          });
      },

      /**
       * Show the AccessPolicy view in a modal dialog
       *
       * This method calls the superclass method, feeding it the identifier
       * associated with the row in the package table that was clicked. The
       * reason for this is so the AccessPolicyView can be used for single
       * objects (like in the Portal editor) or an entire Collection of objects,
       * like in the EML editor: The superclass impelements the generic behavior
       * and the subclass tweaks it.
       * @param {EventHandler} e The click event that triggered this method
       */
      showAccessPolicyModal(e) {
        if (!this.isAccessPolicyEditEnabled()) return;

        const id = $(e.target)?.parents("tr")?.data("id");
        if (!id) return;

        const model = MetacatUI.rootDataPackage.getMember(id);
        if (!model) return;

        const accessPolicyOptions = this.buildAccessPolicyModalOptions(model, {
          packageLevel: model.isMetadata() || model.isResourceMap(),
        });
        EditorView.prototype.showAccessPolicyModal.call(
          this,
          e,
          null,
          accessPolicyOptions,
        );
      },

      /**
       * Gets the EML required fields, as configured in the
       * {@link AppConfig#emlEditorRequiredFields}, and adds possible other
       * special fields that may be configured elsewhere. (e.g. the
       * {@link AppConfig#customEMLMethods})
       * @augments EditorView.getRequiredFields
       * @returns {object} An object literal of the required fields for this EML
       * editor
       */
      getRequiredFields() {
        // clone the required fields from the AppConfig
        const requiredFields = {
          ...MetacatUI.appModel.get("emlEditorRequiredFields"),
        };

        // Add required fields for Custom Methods, which are configured in a
        // different property of the AppConfig
        const customMethodOptions = MetacatUI.appModel.get("customEMLMethods");
        if (customMethodOptions) {
          customMethodOptions.forEach((options) => {
            if (options.required && !requiredFields[options.id]) {
              requiredFields[options.id] = true;
            }
          });
        }

        return requiredFields;
      },
    },
  );
  return EML211EditorView;
});
