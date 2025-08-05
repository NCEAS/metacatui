define([
  "jquery",
  "backbone",
  "localforage",
  "collections/DataPackage",
  "models/metadata/eml211/EML211",
  "models/metadata/eml211/EMLOtherEntity",
  "models/metadata/ScienceMetadata",
  "models/sysmeta/VersionTracker",
  "models/resourceMap/ResourceMapResolver",
  "models/sysmeta/SysMeta",
  "views/EditorView",
  "views/CitationView",
  "views/DataPackageView",
  "views/metadata/EML211View",
  "views/metadata/EMLEntityView",
  "collections/ObjectFormats",
], (
  $,
  Backbone,
  LocalForage,
  DataPackage,
  EML,
  EMLOtherEntity,
  ScienceMetadata,
  VersionTracker,
  ResourceMapResolver,
  SysMeta,
  EditorView,
  CitationView,
  DataPackageView,
  EMLView,
  EMLEntityView,
  ObjectFormats,
) => {
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
        return `<article class="editor-view">
          <header id="editor-header">
            <div id="breadcrumb-container"></div>
            <div id="citation-container" class="citation-container"></div>
            <div id="data-source-container" class="data-source"></div>
            <div id="controls-container" class="controls"></div>
            <div class="access-policy-view-container"></div>
            <div class="clear"></div>
          </header>
          <section id="editor-body">
            <div id="data-package-container"></div>
            <div id="metadata-container">${attrs.loading}</div>
          </section>
          <section id="editor-footer" class="editor-controls hidden">
            <div class="editor-save-controls">
              <a class="btn btn-primary save" id="save-editor">${attrs.submitButtonText}</a>
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
        return `<div class="container">
          <p>${attrs.messageText}</p>
          <p>
            <a class="btn btn-large btn-primary center" href="${attrs.viewURL}">
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
        "click .data-package-item .edit": "showEntity",
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
       * The data package view
       * @type {DataPackageView}
       */
      dataPackageView: null,

      /** @inheritdoc */
      initialize(options = {}) {
        // Ensure the object formats are cached for the editor's use
        if (typeof MetacatUI.objectFormats === "undefined") {
          MetacatUI.objectFormats = new ObjectFormats();
          MetacatUI.objectFormats.fetch();
        }
        this.pid = options?.pid || null;
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
            view.model = newModel;
            view.setListeners();
          }
        });

        this.setListeners();
      },

      /** @inheritdoc */
      render() {
        const view = this;

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
              msg: "Starting the editor...",
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
        this.listenToOnce(this.model, "sync", () => {
          // Skip the remaining steps the metadata doesn't exist.
          if (this.model.get("notFound") === true) {
            this.handleMetadataNotFound();
            return;
          }

          // STEP 3 Listen for a trigger from the getDataPackage function that
          // indicates The data package (resource map) has been retrieved.
          this.stopListening(this, "dataPackageFound");
          this.listenToOnce(this, "dataPackageFound", () => {
            const resourceMap = MetacatUI.rootDataPackage.packageModel;

            // STEP 5 Once we have the resource map, then check that the user is
            // authorized to edit this package.
            this.listenToOnce(
              resourceMap,
              "change:isAuthorized_write",
              this.renderEditorComponents,
            );
            // No need to check authorization for a new resource map
            if (resourceMap.isNew()) {
              resourceMap.set("isAuthorized_write", true);
            } else {
              resourceMap.checkAuthority("write");
              this.updateLoadingText(
                "Checking permissions to edit metadata...",
              );
            }
          });

          this.getDataPackage();

          // STEP 4 Check the authority of this user to edit the metadata
          this.listenToOnce(
            this.model,
            "change:isAuthorized_write",
            this.renderEditorComponents,
          );
          // If the model is new, no need to check for authorization.
          if (this.model.isNew()) {
            this.model.set("isAuthorized_write", true);
          } else {
            this.model.checkAuthority("write");
            this.updateLoadingText("Checking authorization...");
          }
        });

        // STEP 1 Check that the user is signed in
        const afterAccountChecked = () => {
          if (MetacatUI.appUserModel.get("loggedIn") === false) {
            // If they are not signed in, then show the sign-in view
            view.showSignIn();
          } else {
            // STEP 2 If signed in, then fetch model
            view.fetchModel();
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
       * @since 2.34.0
       */
      async handleMetadataNotFound() {
        this.updateLoadingText("Looking for metadata document...");
        const token = await MetacatUI.appUserModel.getTokenPromise();
        const sysMeta = new SysMeta({ identifier: this.pid });
        sysMeta
          .fetch(token)
          .then(() => {
            this.showNotIndexed();
            // TODO: we can get the formatType from the sysMeta and download
            // metadata if it's EML so indexing status doesn't matter. However,
            // the editor needs to be refactored to handle this.
          })
          .catch(() => {
            this.showNotFound();
          });
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
          this.showFullPageAlert(
            "This metadata document is being indexed. Please try again in a few minutes.",
            "warning",
          );
        } else if (authorization === false) {
          this.notAuthorized();
        } else {
          this.listenToOnce(
            this.model,
            "change:isAuthorized_write",
            this.showNotIndexed,
          );
          this.updateLoadingText("Checking authorization...");
          this.model.checkAuthority("write");
        }
      },

      /**
       * Render the editor components (data package view and metadata view), or,
       * if not authorized, render the not authorized message.
       */
      renderEditorComponents() {
        const resMapPermission =
          MetacatUI.rootDataPackage?.packageModel?.get("isAuthorized_write");
        const metadataPermission = this.model.get("isAuthorized_write");
        if (resMapPermission === true && metadataPermission === true) {
          const view = this;
          // Render the Data Package table. This function will also render
          // metadata.
          view.renderDataPackage();
        } else if (resMapPermission === false || metadataPermission === false) {
          this.notAuthorized();
        }
      },

      /** Fetch the metadata model */
      fetchModel() {
        // If no ID provided to the view then it's a new document, so skip the fetch
        if (!this.pid) {
          this.model.trigger("sync");
        } else {
          // Fetch the model
          this.model.fetch();
        }
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
        const loadingPara = this.$el.find(".loading > p");
        if (loadingPara) {
          loadingPara.text(message);
        }
      },

      /**
       * Get the data package (resource map) associated with the EML. Save it to
       * MetacatUI.rootDataPackage. The metadata model must already be synced,
       * and the user must be authorized to edit the EML before this function
       * can run.
       * @param {Model} model - The science metadata model for which to find the
       * associated data package
       */
      async getDataPackage(model) {
        const metaModel = model || this.model;
        const versionTracker = VersionTracker.get(); // One tracker per metaservice url
        const metaPid =
          metaModel.get("id") ||
          metaModel.get("identifier") ||
          metaModel.get("seriesId") ||
          this.pid;

        MetacatUI.rootDataPackage.packageModel?.set("sysMetaXML", null);

        if (metaModel.isNew()) {
          this.createDataPackage();
          this.trigger("dataPackageFound");
          this.setListeners();
          return;
        }

        // TODO - get latest version should happen in DataONE object.
        const latestPid = await versionTracker.getLatestVersion(metaPid);
        if (latestPid !== metaPid) {
          // MetacatUI.rootDataPackage.packageModel.set("sysMetaXML", null);
          metaModel.set("latestVersion", latestPid);
          this.showLatestVersion();
          return;
        }

        const resolver = ResourceMapResolver.get();
        const result = await resolver.resolve(metaPid);

        // Because we're checking metadata doc write permission asynchronously,
        // we need to make sure that we don't show the "no resource map" message
        // or continue with the editor if the user doesn't have write permission
        if (this.model.get("isAuthorized_write") === false) return;

        if (!result.success) {
          this.showResourceMapNotFound(result.multipleRMs);
          resolver.trackMissingResourceMap(metaPid);
          return;
        }
        // Create a new data package with this id
        this.createRootDataPackage([this.model], { id: result.rm });

        // Handle the add of the metadata model
        MetacatUI.rootDataPackage.saveReference(this.model);

        this.stopListening(MetacatUI.rootDataPackage, "sync");
        this.listenToOnce(MetacatUI.rootDataPackage, "sync", () => {
          this.trigger("dataPackageFound");
        });
        // Fetch the data package
        MetacatUI.rootDataPackage.fetch();
      },

      /**
       * Creates a DataPackage collection for this EML211EditorView and sets it
       * on the MetacatUI global object (as `rootDataPackage`)
       */
      createDataPackage() {
        // Create a new Data packages
        this.createRootDataPackage([this.model], {
          packageModelAttrs: { synced: true },
        });

        // Inherit the access policy of the metadata document, if the metadata
        // document is not `new`
        if (!this.model.isNew()) {
          const metadataAccPolicy = this.model.get("accessPolicy");
          const accPolicy =
            MetacatUI.rootDataPackage.packageModel.get("accessPolicy");

          // If there is no access policy, it hasn't been fetched yet, so wait
          if (!metadataAccPolicy.length) {
            // If the model is of ScienceMetadata class, we need to wait for the
            // "replace" function, which happens when the model is fetched and
            // an EML211 model is created to replace it.
            if (this.model.type === "ScienceMetadata") {
              this.listenTo(this.model, "replace", () => {
                this.listenToOnce(this.model, "sysMetaUpdated", () => {
                  accPolicy.copyAccessPolicy(this.model.get("accessPolicy"));
                  MetacatUI.rootDataPackage.packageModel.set(
                    "rightsHolder",
                    this.model.get("rightsHolder"),
                  );
                });
              });
            }
          } else {
            accPolicy.copyAccessPolicy(this.model.get("accessPolicy"));
          }
        }

        // Handle the add of the metadata model
        MetacatUI.rootDataPackage.handleAdd(this.model);

        // Associate the science metadata with the resource map
        if (this.model.get && Array.isArray(this.model.get("resourceMap"))) {
          this.model
            .get("resourceMap")
            .push(MetacatUI.rootDataPackage.packageModel.id);
        } else {
          this.model.set(
            "resourceMap",
            MetacatUI.rootDataPackage.packageModel.id,
          );
        }

        // Set the sysMetaXML for the packageModel
        MetacatUI.rootDataPackage.packageModel.set(
          "sysMetaXML",
          MetacatUI.rootDataPackage.packageModel.serializeSysMeta(),
        );
      },

      /**
       * Creates a {@link DataPackage} collection for this Editor view, and
       * saves it as the Root Data Package of the app. This centralizes the
       * DataPackage creation so listeners and other functionality is always
       * performed
       * @param {(DataONEObject[]|ScienceMetadata[]|EML211[])} models - An array
       * of models to add to the collection
       * @param {object} [attributes] A literal object of attributes to pass to
       * the DataPackage.initialize() function
       * @since 2.17.1
       */
      createRootDataPackage(models, attributes) {
        MetacatUI.rootDataPackage = new DataPackage(models, attributes);

        this.listenTo(
          MetacatUI.rootDataPackage.packageModel,
          "change:numLoadingFiles",
          this.toggleEnableControls,
        );
        this.stopListening(
          MetacatUI.rootDataPackage.packageModel,
          "change:numLoadingFileMetadata",
        );
        this.listenTo(
          MetacatUI.rootDataPackage.packageModel,
          "change:numLoadingFileMetadata",
          this.toggleEnableControls,
        );
      },

      /** Render the Data Package View and insert it into this view */
      renderDataPackage() {
        const view = this;

        if (this.dataPackageView) {
          // If the data package view already exists, remove it
          this.dataPackageView.onClose();
          this.dataPackageView.remove();
          this.dataPackageView = null;
        }

        if (MetacatUI.rootDataPackage.packageModel.isNew()) {
          view.renderMember(this.model);
        }

        // As the root collection is updated with models, render the UI
        this.stopListening(MetacatUI.rootDataPackage, "add");
        this.listenTo(MetacatUI.rootDataPackage, "add", (model) => {
          if (!model.get("synced") && model.get("id"))
            this.listenTo(model, "sync", view.renderMember);
          else if (model.get("synced")) view.renderMember(model);

          // Listen for changes on this member
          model.on("change:fileName", model.addToUploadQueue);
        });

        // Render the Data Package view
        this.dataPackageView = new DataPackageView({
          edit: true,
          dataPackage: MetacatUI.rootDataPackage,
          parentEditorView: this,
        }).render();

        // Render the view
        const $packageTableContainer = this.$("#data-package-container");
        $packageTableContainer.html(this.dataPackageView.el);

        // Make the view resizable on the bottom
        const handle = $(document.createElement("div"))
          .addClass("ui-resizable-handle ui-resizable-s")
          .attr("title", "Drag to resize")
          .append(
            $(document.createElement("i")).addClass("icon icon-caret-down"),
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

        const table = this.dataPackageView.$el;
        this.stopListening(this.dataPackageView, "addOne");
        this.listenTo(this.dataPackageView, "addOne", () => {
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
        });

        if (this.emlView) this.emlView.resizeTOC();

        // Save the view as a subview
        this.subviews.push(this.dataPackageView);
      },

      /**
       * Calls the appropriate render method depending on the model type
       * @param {Backbone.Model} model The model to render
       */
      renderMember(model) {
        // Render metadata or package information, based on the type
        if (typeof model.attributes === "undefined") return;

        switch (model.get("type")) {
          case "DataPackage":
            // Do recursive rendering here for sub packages
            break;

          case "Metadata":
            this.renderMetadata(model);
            break;

          case "Data":
            // TODO: this.renderDataPackageItem?
            break;

          default:
            break;
        }
      },

      /**
       * Renders the metadata section of the EML211EditorView
       * @param {Backbone.Model} modelToRender - The model to render
       */
      renderMetadata(modelToRender) {
        const model = modelToRender || this.model;
        if (!model) return;

        // render metadata as the collection is updated, but only EML passed
        // from the event
        const formatId = model.get("formatId");
        if (
          typeof model.get === "undefined" ||
          !(
            formatId === "eml://ecoinformatics.org/eml-2.1.1" ||
            formatId === "https://eml.ecoinformatics.org/eml-2.2.0"
          )
        ) {
          // TODO: Render generic ScienceMetadata
          const msg = `The editor only supports EML 2.1.1 and EML 2.2.0 documents at this time. The formatId of this document is ${formatId}.`;
          this.showFullPageAlert(msg, "error");
          return;
        }

        // Create an EML model
        if (model.type !== "EML") {
          // Create a new EML model from the ScienceMetadata model
          const EMLmodel = new EML(model.toJSON());
          // Replace the old ScienceMetadata model in the collection
          MetacatUI.rootDataPackage.remove(model);
          MetacatUI.rootDataPackage.add(EMLmodel, { silent: true });
          MetacatUI.rootDataPackage.handleAdd(EMLmodel);
          model.trigger("replace", EMLmodel);

          // Fetch the EML and render it
          this.listenToOnce(EMLmodel, "sync", this.renderMetadata);
          EMLmodel.fetch();

          return;
        }

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

        // Create a citation view and render it
        const citationView = new CitationView({
          model,
          defaultTitle: "Untitled dataset",
          createLink: false,
          createTitleLink: !model.isNew(),
        });

        this.subviews.push(citationView);
        $("#citation-container").html(citationView.render().$el);

        // Remove the rendering class from the body element
        $("body").removeClass("rendering");

        // Focus the folder name field once loaded but only if this is a new
        // document
        if (!this.pid) {
          $("#data-package-table-body td.name").focus();
        }
      },

      /**
       * Renders the data package section of the EML211EditorView
       * @param {Backbone.Model} model - The model to render
       */
      renderDataPackageItem(model) {
        const hasPackageSubView = this.subviews.find(
          (subview) => subview.id === "data-package-table",
          model,
        );

        // Only create the package table if it hasn't been created
        if (!hasPackageSubView) {
          this.dataPackageView = new DataPackageView({
            dataPackage: MetacatUI.rootDataPackage,
            edit: true,
            parentEditorView: this,
          });
          this.subviews.push(this.dataPackageView);
          this.dataPackageView.render();
        }
      },

      /**
       * Set listeners on the view's model for various reasons. This function
       * centralizes all the listeners so that when/if the view's model is
       * replaced, the listeners would be reset.
       */
      setListeners() {
        const view = this;
        this.listenTo(this.model, "change:uploadStatus", this.showControls);

        // Register a listener for any attribute change
        this.model.on("change", this.model.handleChange, this.model);

        // Register a listener to save drafts on change
        this.model.on("change", this.model.saveDraft, this.model);

        this.stopListening(this.model, "change:errorMessage");
        this.listenTo(this.model, "change:errorMessage", () => {
          view.loadError(this.model.get("errorMessage"));
        });

        // If any attributes have changed (including nested objects), show the
        // controls
        if (typeof MetacatUI.rootDataPackage.packageModel !== "undefined") {
          this.stopListening(
            MetacatUI.rootDataPackage.packageModel,
            "change:changed",
          );
          this.listenTo(
            MetacatUI.rootDataPackage.packageModel,
            "change:changed",
            this.toggleControls,
          );
          this.listenTo(
            MetacatUI.rootDataPackage.packageModel,
            "change:changed",
            () => {
              if (MetacatUI.rootDataPackage.packageModel.get("changed")) {
                // Put this metadata model in the queue when the package has
                // been changed Don't put it in the queue if it's in the process
                // of saving already
                if (this.model.get("uploadStatus") !== "p")
                  this.model.set("uploadStatus", "q");
              }
            },
          );
        }

        if (
          MetacatUI.rootDataPackage &&
          MetacatUI.rootDataPackage instanceof DataPackage
        ) {
          // If the Data Package failed saving, display an error message
          this.listenTo(
            MetacatUI.rootDataPackage,
            "errorSaving",
            this.saveError,
          );

          // Listen for when the package has been successfully saved
          this.listenTo(
            MetacatUI.rootDataPackage,
            "successSaving",
            this.saveSuccess,
          );

          // When the Data Package cancels saving, hide the saving styling
          this.listenTo(
            MetacatUI.rootDataPackage,
            "cancelSave",
            this.hideSaving,
          );
          this.listenTo(
            MetacatUI.rootDataPackage,
            "cancelSave",
            this.handleSaveCancel,
          );
        }

        // When the model is invalid, show the required fields
        this.listenTo(this.model, "invalid", this.showValidation);
        this.listenTo(this.model, "valid", this.showValidation);

        // When a data package member fails to load, remove it and warn the user
        this.listenTo(
          MetacatUI.eventDispatcher,
          "fileLoadError",
          this.handleFileLoadError,
        );

        // When a data package member fails to be read, remove it and warn the
        // user
        this.listenTo(
          MetacatUI.eventDispatcher,
          "fileReadError",
          this.handleFileReadError,
        );

        // Set a beforeunload event only if there isn't one already
        if (!this.beforeunloadCallback) {
          // When the Window is about to be closed, show a confirmation message
          this.beforeunloadCallback = (e) => {
            if (!view.canClose()) {
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
       * Saves all edits in the collection
       * @param {Event} e - The DOM Event that triggerd this function
       */
      save(e) {
        const btn = e && e.target ? $(e.target) : this.$("#save-editor");

        // If the save button is disabled, then we don't want to save right now
        if (btn.is(".btn-disabled")) return;

        this.showSaving();

        // Save the package!
        MetacatUI.rootDataPackage.save();
      },

      /**
       * When the data package collection saves successfully, tell the user
       * @param {DataPackage|DataONEObject} savedObject - The model or
       * collection that was just saved
       */
      saveSuccess(savedObject) {
        // We only want to perform these actions after the package saves
        if (savedObject.type !== "DataPackage") return;

        // Change the URL to the new id
        MetacatUI.uiRouter.navigate(
          `submit/${encodeURIComponent(this.model.get("id"))}`,
          { trigger: false, replace: true },
        );

        this.toggleControls();

        // Construct the save message
        const message = this.editorSubmitMessageTemplate({
          messageText: "Your changes have been submitted.",
          viewURL: `${MetacatUI.root}/view/${encodeURIComponent(
            this.model.get("id"),
          )}`,
          buttonText: "View your dataset",
        });

        MetacatUI.appView.showAlert(message, "alert-success", this.$el, null, {
          remove: true,
        });

        // Rerender the CitationView
        const citationView = this.subviews.filter(
          (subview) => subview.type === "Citation",
        );
        if (citationView.length) {
          citationView[0].createTitleLink = true;
          citationView[0].render();
        }

        // Reset the state to clean
        MetacatUI.rootDataPackage.packageModel.set("changed", false);
        this.model.set("hasContentChanges", false);

        // Save the resMap:metadataPid relationship so that user can return to
        // editing before the res map & metadata doc is indexed (resource map
        // resolver can later find the resMap by metadataPid from local storage)
        const newPid = this.model.get("id");
        const resourceMapId = MetacatUI.rootDataPackage.packageModel.get("id");
        if (resourceMapId && newPid) {
          const resMapResolver = ResourceMapResolver.get();
          resMapResolver.addToStorage(newPid, resourceMapId);
        }

        this.setListeners();
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
        let messageClasses = "alert-error";

        // Get all the models that have an error
        const failedModels = MetacatUI.rootDataPackage.where({
          uploadStatus: "e",
        });

        // If every failed model is a DataONEObject data file that failed
        // because of a slow network, construct a specific error message that is
        // more informative than the usual message
        if (
          failedModels.length &&
          failedModels.every(
            (m) =>
              m.get("type") === "Data" &&
              m.get("errorMessage").indexOf("network issue") > -1,
          )
        ) {
          // Create a list of file names for the files that failed to upload
          const failedFileList = $(document.createElement("ul"));
          failedModels?.forEach((failedModel) => {
            failedFileList.append(
              $(document.createElement("li")).text(failedModel.get("fileName")),
            );
          }, this);

          // Make the error message
          messageParagraph.text(
            "The following files could not be uploaded due to a network issue. Make sure you are connected to a reliable internet connection. ",
          );
          messageParagraph.after(failedFileList);
        }
        // If one of the failed models is this package's metadata model or the
        // resource map model and it failed to upload due to a network issue,
        // show a more specific error message
        else if (
          failedModels.find((m) => {
            const msg = m.get("errorMessage") || "";
            return m === this.model && msg.indexOf("network issue") > -1;
          }, this) ||
          (MetacatUI.rootDataPackage.packageModel.get("uploadStatus") === "e" &&
            MetacatUI.rootDataPackage.packageModel
              .get("errorMessage")
              .indexOf("network issue") > -1)
        ) {
          messageParagraph.text(
            "Your changes could not be submitted due to a network issue. Make sure you are connected to a reliable internet connection. ",
          );
        } else {
          if (
            this.model.get("draftSaved") &&
            MetacatUI.appModel.get("editorSaveErrorMsgWithDraft")
          ) {
            messageParagraph.text(
              MetacatUI.appModel.get("editorSaveErrorMsgWithDraft"),
            );
            messageClasses = "alert-warning";
          } else if (MetacatUI.appModel.get("editorSaveErrorMsg")) {
            messageParagraph.text(MetacatUI.appModel.get("editorSaveErrorMsg"));
            messageClasses = "alert-error";
          } else {
            messageParagraph.text(
              "Not all of your changes could be submitted.",
            );
            messageClasses = "alert-error";
          }

          messageParagraph.after(
            $(document.createElement("p")).append(
              $(document.createElement("a"))
                .text("See technical details")
                .attr("data-toggle", "collapse")
                .attr("data-target", `#${errorId}`)
                .addClass("pointer"),
            ),
            $(document.createElement("div"))
              .addClass("collapse")
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
        this.hideSaving();
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
          "alert-error",
          metadataContainer,
          null,
        );
        // Hide the loading spinner & message
        this.$(".loading").hide();
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
          "You've been forwarded to the newest version of your dataset for editing.",
          "alert-warning",
          this.$el,
          12000,
          { remove: true },
        );
      },

      /**
       * Show the entity editor
       * @param {Event} e - The DOM Event that triggerd this function
       */
      showEntity(e) {
        if (!e || !e.target) return;
        if (this.model.type !== "EML") return;

        // Get the Entity View
        const row = $(e.target).parents(".data-package-item");
        let entityView = row.data("entityView");
        const dataONEObject = row.data("model");

        if (
          dataONEObject.get("uploadStatus") === "p" ||
          dataONEObject.get("uploadStatus") === "l" ||
          dataONEObject.get("uploadStatus") === "e"
        )
          return;

        // If there isn't a view yet, create one
        if (!entityView) {
          // Get the entity model for this data package item
          let entityModel = this.model.getEntity(row.data("model"));

          // Create a new EMLOtherEntity if it doesn't exist
          if (!entityModel) {
            entityModel = new EMLOtherEntity({
              entityName: dataONEObject.get("fileName"),
              entityType:
                dataONEObject.get("formatId") || dataONEObject.get("mediaType"),
              parentModel: this.model,
              xmlID: dataONEObject.getXMLSafeID(),
            });

            if (!dataONEObject.get("fileName")) {
              // Listen to changes to required fields on the otherEntity
              // models
              this.listenTo(entityModel, "change:entityName", () => {
                if (!entityModel.isValid()) return;

                // Get the position this entity will be in
                const position = $(".data-package-item.data").index(row);

                this.model.addEntity(entityModel, position);

                this.showEntity(e);
              });
              return;
            }
            // Get the position this entity will be in
            const position = $(".data-package-item.data").index(row);
            this.model.addEntity(entityModel, position);
            this.showEntity(e);
            return;
          }

          entityView = new EMLEntityView({
            model: entityModel,
            DataONEObject: dataONEObject,
            edit: true,
            parentView: this,
          });

          // Attach the view to the edit button so we can access it again
          row.data("entityView", entityView);

          // Render the view
          entityView.render();
        }

        // Show the modal window editor for this entity
        if (entityView) entityView.show();
      },

      /**
       * Show the entity editor for a model
       * @param {EMLEntity|EMLOtherEntity} model - The model to show
       * @param {boolean} [switchToAttrTab] - Set to true to automatically
       * switch to the attributes tab instead of default overview tab
       * @since 2.34.0
       */
      showEntityFromModel(model, switchToAttrTab = false) {
        const pid = model.get("dataONEObject").get("id");
        const rows = this.$(".data-package-item");
        const row = rows.filter((i, el) => {
          const rowModel = $(el).data("model");
          const rowId = $(el).data("id");
          return rowId === pid || rowModel === model;
        });
        if (row.length) {
          // Get button to mock a click event which calls showEntity(e)
          const button = row.find("button.edit");
          if (button?.length) {
            button.click();
            if (switchToAttrTab) {
              setTimeout(() => {
                row.data("entityView")?.showAttributesTab();
              }, 100);
            }
          }
        }
      },

      /** Shows a message if the user is not authorized to edit this package */
      notAuthorized() {
        // Don't show the not authorized message if the user is authorized to
        // edit the EML and the resource map
        if (
          MetacatUI.rootDataPackage &&
          MetacatUI.rootDataPackage.packageModel
        ) {
          if (
            MetacatUI.rootDataPackage.packageModel.get(
              "isAuthorized_changePermission",
            ) &&
            this.model.get("isAuthorized")
          ) {
            return;
          }
        } else if (this.model.get("isAuthorized")) {
          return;
        }

        this.showFullPageAlert(
          "You are not authorized to edit this data set.",
          "error",
        );
      },

      /**
       * Show a message when no resource map was found an existing metadata
       * document.
       * @param {boolean} [multipleRMs] - If true, the message will always
       * indicate to contact support.
       */
      showResourceMapNotFound(multipleRMs = false) {
        // Gather useful info from the model
        const model = this.model || MetacatUI.rootDataPackage.packageModel;
        const pid =
          model.get("id") || model.get("identifier") || model.get("seriesId");
        const title = model.get("title");
        const updated = model.get("dateModified") || model.get("updateDate");

        // Derived information & strings for the message
        const durMs = updated ? Math.abs(new Date() - new Date(updated)) : null;

        const durMin = durMs ? durMs / (1000 * 60) : null;
        const durMinFixed = durMin ? durMin.toFixed(1) : null;
        const minutesNoun =
          durMinFixed === 1 && durMinFixed ? "minutes" : "minute";

        const durHrs = durMs ? durMs / (1000 * 60 * 60) : null;
        const durHrsFixed = durHrs ? durHrs.toFixed(1) : null;
        const hoursNoun = durHrsFixed === 1 && durHrsFixed ? "hours" : "hour";

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
              timeSinceEdit = `This document was last updated ${durMinFixed} ${minutesNoun} ago.`;
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

        this.showFullPageAlert(msg, "error", body, subject);
      },

      /**
       * Toggle the editor footer controls (Save bar)
       */
      toggleControls() {
        if (
          MetacatUI.rootDataPackage &&
          MetacatUI.rootDataPackage.packageModel &&
          MetacatUI.rootDataPackage.packageModel.get("changed")
        ) {
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
        const { packageModel } = MetacatUI.rootDataPackage;
        const numLoadingMetadata = packageModel.get("numLoadingFileMetadata");
        const numLoadingFiles = packageModel.get("numLoadingFiles");
        const isLoadingMetadata = numLoadingMetadata > 0;
        const isLoadingFiles = packageModel.get("isLoadingFiles");

        if (isLoadingFiles) {
          const noun = numLoadingFiles > 1 ? "files" : "file";
          const message = `Waiting for ${numLoadingFiles} ${noun} to upload...`;
          this.disableControls(message);
        } else if (isLoadingMetadata) {
          const noun = numLoadingMetadata > 1 ? "files" : "file";
          const message = `Waiting for metadata from ${numLoadingMetadata} ${noun} to load...`;
          this.disableControls(message, "File metadata is loading.");
        } else {
          this.enableControls();
        }
      },

      /**
       * Show any errors that occurred when trying to save changes
       *
       */
      showValidation() {
        // First clear all the error messaging
        this.$(".notification.error").empty();
        this.$(".side-nav-item .icon").hide();
        this.$("#metadata-container .error").removeClass("error");
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
              `Fix the errors flagged below before submitting: ${errorList}`,
              "alert-error",
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
        const dataItemRow = categoryEls.parents(".data-package-item");

        // If this field is in a DataItemView, then delegate to that view
        if (dataItemRow.length && dataItemRow.data("view")) {
          dataItemRow.data("view").showValidation(category, errorMsg);
          return;
        }
        const elsWithViews = categoryEls.filter(
          (el) =>
            $(el).data("view") &&
            $(el).data("view").showValidation &&
            !$(el).data("view").isNew,
        );

        if (elsWithViews.length) {
          elsWithViews.forEach((el) => {
            $(el).data("view").showValidation();
          });
        } else if (categoryEls.length) {
          // Show the error message
          categoryEls.filter(".notification").addClass("error").text(errorMsg);

          // Add the error message to inputs
          categoryEls.filter("textarea, input").addClass("error");
        }

        // Get the link in the table of contents navigation
        let navigationLink = this.$(
          `.side-nav-item[data-category='${category}']`,
        );

        if (!navigationLink.length) {
          const section = categoryEls.parents("[data-section]");
          navigationLink = this.$(
            `.side-nav-item.${$(section).attr("data-section")}`,
          );
        }

        // Show the error icon in the table of contents
        navigationLink.addClass("error").find(".icon").addClass("error").show();

        this.model.off(`change:${category}`, this.model.checkValidity);
        this.model.once(`change:${category}`, this.model.checkValidity);
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
        // If the form hasn't been edited, we can close this view without
        // confirmation
        if (
          typeof MetacatUI.rootDataPackage.getQueue !== "function" ||
          MetacatUI.rootDataPackage.getQueue().length
        )
          return true;
        return false;
      },

      /** @inheritdoc */
      onClose() {
        // Execute the parent class onClose() function
        // EditorView.prototype.onClose.call(this);

        // Remove the listener on the Window
        if (this.beforeunloadCallback) {
          window.removeEventListener("beforeunload", this.beforeunloadCallback);
          delete this.beforeunloadCallback;
        }

        // Stop listening to the "add" event so that new package members aren't
        // rendered. Check first if the DataPackage has been intialized. An easy
        // check is to see is the 'models' attribute is undefined. If the
        // DataPackage collection has been intialized, then it would be an empty
        // array.
        if (typeof MetacatUI.rootDataPackage.models !== "undefined") {
          this.stopListening(MetacatUI.rootDataPackage, "add");
        }

        // Remove all the other events
        this.off(); // remove callbacks, prevent zombies
        this.model.off();

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
       * @param  {DataONEObject} item The model item passed by the fileLoadError
       * event
       */
      handleFileLoadError(item) {
        let message;
        let fileName;
        /* Remove the data package table row */
        this.dataPackageView.removeOne(item);
        /* Then inform the user */
        if (
          item &&
          item.get &&
          (item.get("fileName") !== "undefined" ||
            item.get("fileName") !== null)
        ) {
          fileName = item.get("fileName");
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
       * @param  {DataONEObject} item The model item passed by the fileReadError
       * event
       */
      handleFileReadError(item) {
        let message;
        let fileName;
        /* Remove the data package table row */
        this.dataPackageView.removeOne(item);
        /* Then inform the user */
        if (
          item &&
          item.get &&
          (item.get("fileName") !== "undefined" ||
            item.get("fileName") !== null)
        ) {
          fileName = item.get("fileName");
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

      /** Save a draft of the parent EML model */
      saveDraft() {
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
        const id = $(e.target)?.parents("tr")?.data("id");
        if (!id) return;

        const model = MetacatUI.rootDataPackage.find((m) => m.get("id") === id);

        EditorView.prototype.showAccessPolicyModal.call(this, e, model);
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
