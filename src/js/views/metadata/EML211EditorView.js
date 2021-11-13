/* global define */
define(['underscore',
  'jquery',
  'backbone',
  'localforage',
  'collections/DataPackage',
  'models/metadata/eml211/EML211',
  'models/metadata/eml211/EMLOtherEntity',
  'models/metadata/ScienceMetadata',
  'views/EditorView',
  'views/CitationView',
  'views/DataPackageView',
  'views/metadata/EML211View',
  'views/metadata/EMLEntityView',
  'views/SignInView',
  'text!templates/editor.html',
  'collections/ObjectFormats',
  'text!templates/editorSubmitMessage.html'],
  function (_, $, Backbone, LocalForage,
    DataPackage, EML, EMLOtherEntity, ScienceMetadata,
    EditorView, CitationView, DataPackageView, EMLView, EMLEntityView, SignInView,
    EditorTemplate, ObjectFormats, EditorSubmitMessageTemplate) {

    /**
    * @class EML211EditorView
    * @classdesc A view of a form for creating and editing EML 2.1.1 documents
    * @classcategory Views/Metadata
    * @name EML211EditorView
    * @extends EditorView
    * @constructs
    */
    var EML211EditorView = EditorView.extend(
      /** @lends EML211EditorView.prototype */{

        type: "EML211Editor",

        /* The initial editor layout */
        template: _.template(EditorTemplate),
        editorSubmitMessageTemplate: _.template(EditorSubmitMessageTemplate),

        /**
        * The text to use in the editor submit button
        * @type {string}
        */
        submitButtonText: MetacatUI.appModel.get("editorSaveButtonText"),

        /**
        * The events this view will listen to and the associated function to call.
        * This view will inherit events from the parent class, EditorView.
        * @type {Object}
        */
        events: _.extend(EditorView.prototype.events, {
          "change": "saveDraft",
          "click .data-package-item .edit": "showEntity"
        }),

        /**
        The identifier of the root package EML being rendered
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

        /**
        * Initialize a new EML211EditorView - called post constructor
        */
        initialize: function (options) {

          // Ensure the object formats are cached for the editor's use
          if (typeof MetacatUI.objectFormats === "undefined") {
            MetacatUI.objectFormats = new ObjectFormats();
            MetacatUI.objectFormats.fetch();

          }
          return this;
        },

        /**
        * Create a new EML model for this view
        */
        createModel: function () {

          //If no pid is given, create a new EML model
          if (!this.pid)
            var model = new EML({ 'synced': true });
          //Otherwise create a generic metadata model until we find out the formatId
          else
            var model = new ScienceMetadata({ id: this.pid });

          // Once the ScienceMetadata is populated, populate the associated package
          this.model = model;

          //Listen for the replace event on this model
          var view = this;
          this.listenTo(this.model, "replace", function (newModel) {
            if (view.model.get("id") == newModel.get("id")) {
              view.model = newModel;
              view.setListeners();
            }
          });

          this.setListeners();
        },

        /**
        * Render the view
        */
        render: function () {

          var view = this;

          //Execute the superclass render() function, which will add some basic Editor functionality
          EditorView.prototype.render.call(this);

          MetacatUI.appModel.set('headerType', 'default');

          //Empty the view element first
          this.$el.empty();

          //Inert the basic template on the page
          this.$el.html(this.template({
            loading: MetacatUI.appView.loadingTemplate({ msg: "Starting the editor..." }),
            submitButtonText: this.submitButtonText
          }));

          //If we don't have a model at this point, create one
          if (!this.model) this.createModel();

          // Before rendering the editor, we must:
          // 1. Make sure the user is signed in
          // 2. Fetch the metadata
          // 3. Use the metadata to identify and then fetch the resource map
          // 4. Make sure the user has write permission on the metadata
          // 5. Make sure the user has write permission on the resource map

          // As soon as we have all of the metadata information (STEP 2 complete)...
          this.listenToOnce(this.model, "sync", function () {

            // Skip the remaining steps the metadata doesn't exist.
            if (this.model.get("notFound") == true) {
              this.showNotFound();
              return
            }

            // STEP 3
            // Listen for a trigger from the getDataPackage function that indicates
            // The data package (resource map) has been retrieved.
            this.listenToOnce(this, "dataPackageFound", function () {

              var resourceMap = MetacatUI.rootDataPackage.packageModel;

              // STEP 5
              // Once we have the resource map, then check that the user is authorized to edit this package.
              this.listenToOnce(resourceMap, "change:isAuthorized_write", function (model, authorization) {
                // Render if authorized (will show not authorized if not)
                this.renderEditorComponents();
              });
              // No need to check authorization for a new resource map
              if (resourceMap.isNew()) {
                resourceMap.set("isAuthorized_write", true);
              } else {
                resourceMap.checkAuthority("write");
                this.updateLoadingText("Loading metadata...");
              }

            });

            this.getDataPackage();

            // STEP 4
            // Check the authority of this user to edit the metadata
            this.listenToOnce(this.model, "change:isAuthorized_write", function (model, authorization) {
              // Render if authorized (will show not authorized if not)
              this.renderEditorComponents();
            });
            // If the model is new, no need to check for authorization.
            if (this.model.isNew()) {
              this.model.set("isAuthorized_write", true);
            } else {
              this.model.checkAuthority("write");
              this.updateLoadingText("Checking authorization...");
            }
          });

          // STEP 1
          // Check that the user is signed in
          var afterAccountChecked = function () {
            if (MetacatUI.appUserModel.get("loggedIn") == false) {
              // If they are not signed in, then show the sign-in view
              view.showSignIn();
            } else {
              // STEP 2
              // If signed in, then fetch model
              view.fetchModel();
            }
          }
          // If we've already checked the user account
          if (MetacatUI.appUserModel.get("checked")) {
            afterAccountChecked();
          }
          // If we haven't checked for authentication yet,
          // wait until the user info is loaded before we request the Metadata
          else {
            this.listenToOnce(MetacatUI.appUserModel, "change:checked", function () {
              afterAccountChecked();
            });
          }

          // When the user mistakenly drops a file into an area in the window
          // that isn't a proper drop-target, prevent navigating away from the
          // page. Without this, the user will lose their progress in the
          // editor.
          window.addEventListener("dragover", function (e) {
            e = e || event;
            e.preventDefault();
          }, false);

          window.addEventListener("drop", function (e) {
            e = e || event;
            e.preventDefault();
          }, false);

          return this;
        },

        /**
         * Render the editor components (data package view and metadata view),
         * or, if not authorized, render the not authorized message.
         */
        renderEditorComponents: function () {

          if (!MetacatUI.rootDataPackage.packageModel) {
            return
          }
          var resMapPermission = MetacatUI.rootDataPackage.packageModel.get("isAuthorized_write"),
            metadataPermission = this.model.get("isAuthorized_write");

          if (resMapPermission === true && metadataPermission === true) {
            var view = this;
            // Render the Data Package table.
            // This function will also render metadata.
            view.renderDataPackage();
          } else if (resMapPermission === false || metadataPermission === false) {
            this.notAuthorized();
          }

        },

        /**
        * Fetch the metadata model
        */
        fetchModel: function () {

          //If the user hasn't provided an id, then don't check the authority and mark as synced already
          if (!this.pid) {
            this.model.trigger("sync");
          }
          else {
            //Fetch the model
            this.model.fetch();
          }
        },

        /**
        * @inheritdoc
        */
        isAccessPolicyEditEnabled: function(){

          if( !MetacatUI.appModel.get("allowAccessPolicyChanges") ){
            return false;
          }

          if( !MetacatUI.appModel.get("allowAccessPolicyChangesDatasets") ){
            return false;
          }

          let limitedTo = MetacatUI.appModel.get("allowAccessPolicyChangesDatasetsForSubjects");
          if( Array.isArray(limitedTo) && limitedTo.length ){

            return _.intersection(limitedTo, MetacatUI.appUserModel.get("allIdentitiesAndGroups")).length > 0;

          }
          else{
            return true;
          }

        },

        /**
         * Update the text that is shown below the spinner while the editor is loading
         *
         * @param {string} message - The message to display
         */
        updateLoadingText: function (message) {
          try {
            if (!message || typeof message != "string") {
              console.log("Was not able to update the loading message, left it as-is. A message must be provided to the updateLoadingText function");
              return
            }
            var loadingPara = this.$el.find(".loading > p");
            if (loadingPara) {
              loadingPara.text(message)
            }
          } catch (error) {
            console.log("Was not able to update the loading message, left it as-is. Error details: " + error);
          }
        },

        /**
        * Get the data package (resource map) associated with the EML. Save it to MetacatUI.rootDataPackage.
        * The metadata model must already be synced, and the user must be authorized to edit the EML before this function
        * can run.
        * @param {Model} scimetaModel - The science metadata model for which to find the associated data package
        */
        getDataPackage: function (scimetaModel) {

          if (!scimetaModel)
            var scimetaModel = this.model;

          // Check if this package is obsoleted
          if (this.model.get("obsoletedBy")) {
            this.showLatestVersion();
            return;
          }

          var resourceMapIds = scimetaModel.get("resourceMap");

          // Case 1: No resource map PID found in the metadata
          if (typeof resourceMapIds === "undefined" || resourceMapIds === null || resourceMapIds.length <= 0) {

            // 1A: Check if the rootDataPackage contains the metadata document the user is trying to edit.
            // Ensure the resource map is not new. If it's a previously unsaved map, then getLatestVersion
            // will result in a 404.
            if (
              MetacatUI.rootDataPackage &&
              MetacatUI.rootDataPackage.pluck &&
              !MetacatUI.rootDataPackage.packageModel.isNew() &&
              _.contains(MetacatUI.rootDataPackage.pluck("id"), this.model.get("id"))
            ) {

              // Remove the cached system metadata XML so we retrieve it again
              MetacatUI.rootDataPackage.packageModel.set("sysMetaXML", null);
              this.getLatestResourceMap();

            }

            // 1B. If the root data package does not contain the metadata the user is trying to edit,
            // then create a new data package.
            else {

              console.log("Resource map ids could not be found for " + scimetaModel.id + ", creating a new resource map.");

              // Create a new DataPackage collection for this view
              this.createDataPackage();
              this.trigger("dataPackageFound");
              // Set the listeners
              this.setListeners();
            }

            // Case 2: A resource map PID was found in the metadata
          } else {

            // Create a new data package with this id
            this.createRootDataPackage([this.model], { id: resourceMapIds[0] });

            //Handle the add of the metadata model
            MetacatUI.rootDataPackage.saveReference(this.model);

            // 2A. If there is more than one resource map, we need to make sure we fetch the most recent one
            if (resourceMapIds.length > 1) {
              this.getLatestResourceMap();

              // 2B. Just one resource map found
            } else {

              this.listenToOnce(MetacatUI.rootDataPackage, "sync", function () {
                this.trigger("dataPackageFound");
              })
              // Fetch the data package
              MetacatUI.rootDataPackage.fetch();
            }

          }

        },


        /**
         * Get the latest version of the resource map model stored in MetacatUI.rootDataPackage.packageModel.
         * When the newest resource map is synced, the "dataPackageFound" event will be triggered.
         */
        getLatestResourceMap: function () {

          try {

            if (!MetacatUI.rootDataPackage || !MetacatUI.rootDataPackage.packageModel) {
              console.log("Could not get the latest verion of the resource map because no resource map is saved.");
              return
            }
            // Make sure we have the latest version of the resource map before we allow editing
            this.listenToOnce(MetacatUI.rootDataPackage.packageModel, "latestVersionFound", function (model) {
              //Create a new data package for the latest version package
              this.createRootDataPackage([this.model], { id: model.get("latestVersion") });
              //Handle the add of the metadata model
              MetacatUI.rootDataPackage.saveReference(this.model);
              this.listenToOnce(MetacatUI.rootDataPackage, "sync", function () {
                this.trigger("dataPackageFound");
              })
              // Fetch the data package
              MetacatUI.rootDataPackage.fetch();
            });

            //Find the latest version of the resource map
            MetacatUI.rootDataPackage.packageModel.findLatestVersion();
          } catch (error) {
            console.log("Error attempting to find the latest version of the resource map. Error details: " + error);
          }
        },

        /**
        * Creates a DataPackage collection for this EML211EditorView and sets it on the MetacatUI
        * global object (as `rootDataPackage`)
        */
        createDataPackage: function () {
          // Create a new Data packages
          this.createRootDataPackage([this.model], { packageModelAttrs: { synced: true }})

          try{
            //Inherit the access policy of the metadata document, if the metadata document is not `new`
            if(!this.model.isNew()){
              let metadataAccPolicy = this.model.get("accessPolicy");
              let accPolicy = MetacatUI.rootDataPackage.packageModel.get("accessPolicy")

              //If there is no access policy, it hasn't been fetched yet, so wait
              if( !metadataAccPolicy.length ){
                //If the model is of ScienceMetadata class, we need to wait for the "replace" function,
                // which happens when the model is fetched and an EML211 model is created to replace it.
                if( this.model.type == "ScienceMetadata" ){
                   this.listenTo(this.model, "replace", function(){
                     this.listenToOnce(this.model, "sysMetaUpdated", function(){
                       accPolicy.copyAccessPolicy(this.model.get("accessPolicy"))
                       MetacatUI.rootDataPackage.packageModel.set("rightsHolder", this.model.get("rightsHolder"));
                     });
                   });
                }
              }
              else{
                accPolicy.copyAccessPolicy(this.model.get("accessPolicy"))
              }
            }
          }
          catch(e){
            console.error("Could not copy the access policy from the metadata to the resource map: ", e);
          }

          //Handle the add of the metadata model
          MetacatUI.rootDataPackage.handleAdd(this.model);

          // Associate the science metadata with the resource map
          if (this.model.get && Array.isArray(this.model.get("resourceMap"))) {
            this.model.get("resourceMap").push(MetacatUI.rootDataPackage.packageModel.id);

          } else {
            this.model.set("resourceMap", MetacatUI.rootDataPackage.packageModel.id);

          }

          // Set the sysMetaXML for the packageModel
          MetacatUI.rootDataPackage.packageModel.set("sysMetaXML",
            MetacatUI.rootDataPackage.packageModel.serializeSysMeta());
        },

        /**
        * Creates a {@link DataPackage} collection for this Editor view, and saves it as the Root Data Package of the app.
        * This centralizes the DataPackage creation so listeners and other functionality is always performed
        * @param {[DataONEObject[]|ScienceMetadata[]|EML211[]]} models - An array of models to add to the collection
        * @param {object} [attributes] A literal object of attributes to pass to the DataPackage.initialize() function
        * @since 2.17.1
        */
        createRootDataPackage: function(models, attributes){
          MetacatUI.rootDataPackage = new DataPackage(models, attributes);

          this.listenTo(MetacatUI.rootDataPackage.packageModel, "change:numLoadingFiles", this.toggleEnableControls);
        },

        renderChildren: function (model, options) {


        },

        /**
         * Render the Data Package View and insert it into this view
         */
        renderDataPackage: function () {

          var view = this;

          if(MetacatUI.rootDataPackage.packageModel.isNew()){
            view.renderMember(this.model);
          };

          // As the root collection is updated with models, render the UI
          this.listenTo(MetacatUI.rootDataPackage, "add", function (model) {

            if (!model.get("synced") && model.get('id'))
              this.listenTo(model, "sync", view.renderMember);
            else if (model.get("synced"))
              view.renderMember(model);

            //Listen for changes on this member
            model.on("change:fileName", model.addToUploadQueue);
          });

          //Render the Data Package view
          this.dataPackageView = new DataPackageView({
            edit: true,
            dataPackage: MetacatUI.rootDataPackage,
            parentEditorView: this
          });

          //Render the view
          var $packageTableContainer = this.$("#data-package-container");
          $packageTableContainer.html(this.dataPackageView.render().el);

          //Make the view resizable on the bottom
          var handle = $(document.createElement("div"))
            .addClass("ui-resizable-handle ui-resizable-s")
            .attr("title", "Drag to resize")
            .append($(document.createElement("i")).addClass("icon icon-caret-down"));
          $packageTableContainer.after(handle);
          $packageTableContainer.resizable({
            handles: { "s": handle },
            minHeight: 100,
            maxHeight: 900,
            resize: function () {
              view.emlView.resizeTOC();
            }
          });

          var tableHeight = ($(window).height() - $("#Navbar").height()) * .40;
          $packageTableContainer.css("height", tableHeight + "px");

          var table = this.dataPackageView.$el;
          this.listenTo(this.dataPackageView, "addOne", function () {
            if (table.outerHeight() > $packageTableContainer.outerHeight() && table.outerHeight() < 220) {
              $packageTableContainer.css("height", table.outerHeight() + handle.outerHeight());
              if (this.emlView)
                this.emlView.resizeTOC();
            }
          });

          if (this.emlView)
            this.emlView.resizeTOC();

          //Save the view as a subview
          this.subviews.push(this.dataPackageView);

          this.listenTo(MetacatUI.rootDataPackage.packageModel, "change:childPackages", this.renderChildren);
        },


        /**
         * Calls the appropriate render method depending on the model type
         */
        renderMember: function (model, collection, options) {

          // Render metadata or package information, based on the type
          if (typeof model.attributes === "undefined") {
            return;

          } else {
            switch (model.get("type")) {
              case "DataPackage":
                // Do recursive rendering here for sub packages
                break;

              case "Metadata":

                // this.renderDataPackageItem(model, collection, options);
                this.renderMetadata(model, collection, options);
                break;

              case "Data":
                //this.renderDataPackageItem(model, collection, options);
                break;

              default:
                console.log("model.type is not set correctly");

            }
          }
        },


        /**
         * Renders the metadata section of the EML211EditorView
         */
        renderMetadata: function (model, collection, options) {

          if (!model && this.model) var model = this.model;
          if (!model) return;

          var emlView, dataPackageView;

          // render metadata as the collection is updated, but only EML passed from the event
          if (typeof model.get === "undefined" ||
            !(
              model.get("formatId") === "eml://ecoinformatics.org/eml-2.1.1" ||
              model.get("formatId") === "https://eml.ecoinformatics.org/eml-2.2.0"
            )) {
            console.log("Not EML. TODO: Render generic ScienceMetadata.");
            return;

          }

          //Create an EML model
          if (model.type != "EML") {
              //Create a new EML model from the ScienceMetadata model
              var EMLmodel = new EML(model.toJSON());
              //Replace the old ScienceMetadata model in the collection
              MetacatUI.rootDataPackage.remove(model);
              MetacatUI.rootDataPackage.add(EMLmodel, { silent: true });
              MetacatUI.rootDataPackage.handleAdd(EMLmodel);
              model.trigger("replace", EMLmodel);

              //Fetch the EML and render it
              this.listenToOnce(EMLmodel, "sync", this.renderMetadata);
              EMLmodel.fetch();

              return;
            }

          //Create an EML211 View and render it
          emlView = new EMLView({
            model: model,
            edit: true
          });
          this.subviews.push(emlView);
          this.emlView = emlView;
          emlView.render();

          //Show the required fields for this editor
          this.renderRequiredIcons(MetacatUI.appModel.get("emlEditorRequiredFields"));
          this.listenTo(emlView, "editorInputsAdded", function(){
            this.trigger("editorInputsAdded")
          });

          // Create a citation view and render it
          var citationView = new CitationView({
            model: model,
            title: "Untitled dataset"
          });

          if (model.isNew()) {
            citationView.createLink = false;
            citationView.createTitleLink = false;
          }
          else {
            citationView.createLink = false;
            citationView.createTitleLink = true;
          }

          this.subviews.push(citationView);
          $("#citation-container").html(citationView.render().$el);

          //Remove the rendering class from the body element
          $("body").removeClass("rendering");

          // Focus the folder name field once loaded but only if this is a new
          // document
          if (!this.pid) {
            $("#data-package-table-body td.name").focus();
          }

        },


        /**
         * Renders the data package section of the EML211EditorView
         */
        renderDataPackageItem: function (model, collection, options) {

          var hasPackageSubView =
            _.find(this.subviews, function (subview) {
              return subview.id === "data-package-table";
            }, model);

          // Only create the package table if it hasn't been created
          if (!hasPackageSubView) {
            this.dataPackageView = new DataPackageView({
              dataPackage: MetacatUI.rootDataPackage,
              edit: true,
              parentEditorView: this
            });
            this.subviews.push(this.dataPackageView);
            dataPackageView.render();

          }
        },

        /**
         * Set listeners on the view's model for various reasons.
         * This function centralizes all the listeners so that when/if the view's model is replaced, the listeners would be reset.
         */
        setListeners: function () {

          this.listenTo(this.model, "change:uploadStatus", this.showControls);

          // Register a listener for any attribute change
          this.model.on("change", this.model.handleChange, this.model);

          // Register a listener to save drafts on change
          this.model.on("change", this.model.saveDraft, this.model);

          // If any attributes have changed (including nested objects), show the controls
          if (typeof MetacatUI.rootDataPackage.packageModel !== "undefined") {
            this.stopListening(MetacatUI.rootDataPackage.packageModel, "change:changed");
            this.listenTo(MetacatUI.rootDataPackage.packageModel, "change:changed", this.toggleControls);
            this.listenTo(MetacatUI.rootDataPackage.packageModel, "change:changed", function (event) {
              if (MetacatUI.rootDataPackage.packageModel.get("changed")) {
                // Put this metadata model in the queue when the package has been changed
                // Don't put it in the queue if it's in the process of saving already
                if (this.model.get("uploadStatus") != "p")
                  this.model.set("uploadStatus", "q");
              }
            });

          }

          if (MetacatUI.rootDataPackage && DataPackage.prototype.isPrototypeOf(MetacatUI.rootDataPackage)) {
            // If the Data Package failed saving, display an error message
            this.listenTo(MetacatUI.rootDataPackage, "errorSaving", this.saveError);

            // Listen for when the package has been successfully saved
            this.listenTo(MetacatUI.rootDataPackage, "successSaving", this.saveSuccess);

            //When the Data Package cancels saving, hide the saving styling
            this.listenTo(MetacatUI.rootDataPackage, "cancelSave", this.hideSaving);
            this.listenTo(MetacatUI.rootDataPackage, "cancelSave", this.handleSaveCancel);
          }

          //When the model is invalid, show the required fields
          this.listenTo(this.model, "invalid", this.showValidation);
          this.listenTo(this.model, "valid", this.showValidation);

          // When a data package member fails to load, remove it and warn the user
          this.listenTo(MetacatUI.eventDispatcher, "fileLoadError", this.handleFileLoadError);

          // When a data package member fails to be read, remove it and warn the user
          this.listenTo(MetacatUI.eventDispatcher, "fileReadError", this.handleFileReadError);

          //Set a beforeunload event only if there isn't one already
          if (!this.beforeunloadCallback) {
            var view = this;
            //When the Window is about to be closed, show a confirmation message
            this.beforeunloadCallback = function (e) {
              if (!view.canClose()) {
                //Browsers don't support custom confirmation messages anymore,
                // so preventDefault() needs to be called or the return value has to be set
                e.preventDefault();
                e.returnValue = "";
              }
              return;
            }
            window.addEventListener("beforeunload", this.beforeunloadCallback);
          }

        },

        /**
         * Saves all edits in the collection
         * @param {Event} e - The DOM Event that triggerd this function
         */
        save: function (e) {
          var btn = (e && e.target) ? $(e.target) : this.$("#save-editor");

          //If the save button is disabled, then we don't want to save right now
          if (btn.is(".btn-disabled")) return;

          this.showSaving();

          //Save the package!
          MetacatUI.rootDataPackage.save();
        },

        /**
         * When the data package collection saves successfully, tell the user
         * @param {DataPackage|DataONEObject} savedObject - The model or collection that was just saved
         */
        saveSuccess: function (savedObject) {

          //We only want to perform these actions after the package saves
          if (savedObject.type != "DataPackage") return;

          //Change the URL to the new id
          MetacatUI.uiRouter.navigate("submit/" + encodeURIComponent(this.model.get("id")), { trigger: false, replace: true });

          this.toggleControls();

          // Construct the save message
          var message = this.editorSubmitMessageTemplate({
            messageText: "Your changes have been submitted.",
            viewURL: MetacatUI.root + "/view/" + encodeURIComponent(this.model.get("id")),
            buttonText: "View your dataset"
          });

          MetacatUI.appView.showAlert(message, "alert-success", this.$el, null, { remove: true });

          //Rerender the CitationView
          var citationView = _.where(this.subviews, { type: "Citation" });
          if (citationView.length) {
            citationView[0].createTitleLink = true;
            citationView[0].render();
          }

          // Reset the state to clean
          MetacatUI.rootDataPackage.packageModel.set("changed", false);
          this.model.set("hasContentChanges", false);

          this.setListeners();
        },

        /**
         * When the data package collection fails to save, tell the user
         * @param {string} errorMsg - The error message from the failed save() function
         */
        saveError: function (errorMsg) {

          var errorId = "error" + Math.round(Math.random() * 100),
            messageContainer = $(document.createElement("div")).append(document.createElement("p")),
            messageParagraph = messageContainer.find("p"),
            messageClasses = "alert-error";

          //Get all the models that have an error
          var failedModels = MetacatUI.rootDataPackage.where({ uploadStatus: "e" });

          //If every failed model is a DataONEObject data file that failed
          // because of a slow network, construct a specific error message that
          // is more informative than the usual message
          if (failedModels.length &&
            _.every(failedModels, function (m) {
              return m.get("type") == "Data" &&
                m.get("errorMessage").indexOf("network issue") > -1
            })) {

            //Create a list of file names for the files that failed to upload
            var failedFileList = $(document.createElement("ul"));

            _.each(failedModels, function (failedModel) {

              failedFileList.append($(document.createElement("li")).text(failedModel.get("fileName")));

            }, this);

            //Make the error message
            messageParagraph.text("The following files could not be uploaded due to a network issue. Make sure you are connected to a reliable internet connection. ");
            messageParagraph.after(failedFileList);
          }
          //If one of the failed models is this package's metadata model or the
          // resource map model and it failed to upload due to a network issue,
          // show a more specific error message
          else if (_.find(failedModels, function (m) {
            var errorMsg = m.get("errorMessage") || "";
            return (m == this.model && errorMsg.indexOf("network issue") > -1)
          }, this) ||
            (MetacatUI.rootDataPackage.packageModel.get("uploadStatus") == "e" &&
              MetacatUI.rootDataPackage.packageModel.get("errorMessage").indexOf("network issue") > -1)) {

            messageParagraph.text("Your changes could not be submitted due to a network issue. Make sure you are connected to a reliable internet connection. ");

          }
          else {

            if (this.model.get("draftSaved") && MetacatUI.appModel.get("editorSaveErrorMsgWithDraft")) {
              messageParagraph.text(MetacatUI.appModel.get("editorSaveErrorMsgWithDraft"));
              messageClasses = "alert-warning"
            }
            else if (MetacatUI.appModel.get("editorSaveErrorMsg")) {
              messageParagraph.text(MetacatUI.appModel.get("editorSaveErrorMsg"));
              messageClasses = "alert-error";
            }
            else {
              messageParagraph.text("Not all of your changes could be submitted.");
              messageClasses = "alert-error";
            }

            messageParagraph.after($(document.createElement("p")).append($(document.createElement("a"))
              .text("See technical details")
              .attr("data-toggle", "collapse")
              .attr("data-target", "#" + errorId)
              .addClass("pointer")),
              $(document.createElement("div"))
                .addClass("collapse")
                .attr("id", errorId)
                .append($(document.createElement("pre")).text(errorMsg)));
          }

          MetacatUI.appView.showAlert(messageContainer, messageClasses, this.$el, null, {
            emailBody: "Error message: Data Package save error: " + errorMsg,
            remove: true
          });

          //Reset the Saving styling
          this.hideSaving();
        },


        /**
         * Find the most recently updated version of the metadata
         */
        showLatestVersion: function () {
          var view = this;

          //When the latest version is found,
          this.listenToOnce(this.model, "change:latestVersion", function () {
            //Make sure it has a newer version, and if so,
            if (view.model.get("latestVersion") != view.model.get("id")) {
              //Get the obsoleted id
              var oldID = view.model.get("id");

              //Reset the current model
              view.pid = view.model.get("latestVersion");
              view.model = null;

              //Update the URL
              MetacatUI.uiRouter.navigate("submit/" + encodeURIComponent(view.pid), { trigger: false, replace: true });

              //Render the new model
              view.render();

              //Show a warning that the user was trying to edit old content
              MetacatUI.appView.showAlert("You've been forwarded to the newest version of your dataset for editing.",
                "alert-warning", this.$el, 12000, { remove: true });
            }
            else {
              view.getDataPackage();
            }

          });

          //Find the latest version of this metadata object
          this.model.findLatestVersion();
        },

        /**
         * Show the entity editor
         * @param {Event} e - The DOM Event that triggerd this function
         */
        showEntity: function (e) {
          if (!e || !e.target)
            return;

          //For EML metadata docs
          if (this.model.type == "EML") {
            //Get the Entity View
            var row = $(e.target).parents(".data-package-item"),
              entityView = row.data("entityView"),
              dataONEObject = row.data("model");

            if (dataONEObject.get("uploadStatus") == "p" || dataONEObject.get("uploadStatus") == "l" || dataONEObject.get("uploadStatus") == "e")
              return;

            //If there isn't a view yet, create one
            if (!entityView) {

              //Get the entity model for this data package item
              var entityModel = this.model.getEntity(row.data("model"));

              //Create a new EMLOtherEntity if it doesn't exist
              if (!entityModel) {
                entityModel = new EMLOtherEntity({
                  entityName: dataONEObject.get("fileName"),
                  entityType: dataONEObject.get("formatId") || dataONEObject.get("mediaType"),
                  parentModel: this.model,
                  xmlID: dataONEObject.getXMLSafeID()
                });

                if (!dataONEObject.get("fileName")) {
                  //Listen to changes to required fields on the otherEntity models
                  this.listenTo(entityModel, "change:entityName", function () {
                    if (!entityModel.isValid()) return;

                    //Get the position this entity will be in
                    var position = $(".data-package-item.data").index(row);

                    this.model.addEntity(entityModel, position);
                  });
                }
                else {
                  //Get the position this entity will be in
                  var position = $(".data-package-item.data").index(row);

                  this.model.addEntity(entityModel, position);
                }
              }
              else {
                entityView = new EMLEntityView({
                  model: entityModel,
                  DataONEObject: dataONEObject,
                  edit: true
                });
              }

              //Attach the view to the edit button so we can access it again
              row.data("entityView", entityView);

              //Render the view
              entityView.render();
            }

            //Show the modal window editor for this entity
            if (entityView)
              entityView.show();
          }

        },

        /**
         * Shows a message if the user is not authorized to edit this package
         */
        notAuthorized: function () {

          // Don't show the not authorized message if the user is authorized to edit the EML and the resource map
          if (MetacatUI.rootDataPackage && MetacatUI.rootDataPackage.packageModel) {
            if (
              MetacatUI.rootDataPackage.packageModel.get("isAuthorized_changePermission") &&
              this.model.get("isAuthorized")
            ) {
              return
            }
          } else {
            if (this.model.get("isAuthorized")) {
              return
            }
          }

          this.$("#editor-body").empty();
          MetacatUI.appView.showAlert("You are not authorized to edit this data set.",
            "alert-error", "#editor-body");

          //Stop listening to any further events
          this.stopListening();
          this.model.off();
        },


        /**
         * Toggle the editor footer controls (Save bar)
         */
        toggleControls: function () {
          if (MetacatUI.rootDataPackage &&
            MetacatUI.rootDataPackage.packageModel &&
            MetacatUI.rootDataPackage.packageModel.get("changed")) {
            this.showControls();

          } else {
            this.hideControls();

          }
        },

        /**
        * Toggles whether the Save controls for the Editor are enabled or disabled based on various attributes of the DataPackage and its models.
        * @since 2.17.1
        */
        toggleEnableControls: function(){

          if( MetacatUI.rootDataPackage.packageModel.get("isLoadingFiles") ){
            let noun = MetacatUI.rootDataPackage.packageModel.get("numLoadingFiles") > 1? " files" : " file";
            this.disableControls("Waiting for " + MetacatUI.rootDataPackage.packageModel.get("numLoadingFiles") + noun + " to upload...");
          }
          else{
            this.enableControls();
          }

        },

        /**
         * Show any errors that occured when trying to save changes
         */
        showValidation: function () {

          //First clear all the error messaging
          this.$(".notification.error").empty();
          this.$(".side-nav-item .icon").hide();
          this.$("#metadata-container .error").removeClass("error");
          $(".alert-container:not(:has(.temporary-message))").remove();


          var errors = this.model.validationError;

          _.each(errors, function (errorMsg, category) {

            var categoryEls = this.$("[data-category='" + category + "']"),
              dataItemRow = categoryEls.parents(".data-package-item");

            //If this field is in a DataItemView, then delegate to that view
            if (dataItemRow.length && dataItemRow.data("view")) {
              dataItemRow.data("view").showValidation(category, errorMsg);
              return;
            }
            else {
              var elsWithViews = _.filter(categoryEls, function (el) {
                return ($(el).data("view") &&
                  $(el).data("view").showValidation &&
                  !$(el).data("view").isNew);
              });

              if (elsWithViews.length) {
                _.each(elsWithViews, function (el) {
                  $(el).data("view").showValidation();
                });
              }
              else {
                //Show the error message
                categoryEls.filter(".notification").addClass("error").text(errorMsg);

                //Add the error message to inputs
                categoryEls.filter("textarea, input").addClass("error");
              }
            }

            //Get the link in the table of contents navigation
            var navigationLink = this.$(".side-nav-item[data-category='" + category + "']");

            if (!navigationLink.length) {
              var section = categoryEls.parents("[data-section]");
              navigationLink = this.$(".side-nav-item." + $(section).attr("data-section"));
            }

            //Show the error icon in the table of contents
            navigationLink.addClass("error")
              .find(".icon")
              .addClass("error")
              .show();

            this.model.off("change:" + category, this.model.checkValidity);
            this.model.once("change:" + category, this.model.checkValidity);

          }, this);

          if (errors) {
            MetacatUI.appView.showAlert("Fix the errors flagged below before submitting.",
              "alert-error",
              this.$el,
              null,
              {
                remove: true
              });
          }

        },

        /**
        * @inheritdoc
        */
        hasUnsavedChanges: function () {
          //If the form hasn't been edited, we can close this view without confirmation
          if (typeof MetacatUI.rootDataPackage.getQueue != "function" || MetacatUI.rootDataPackage.getQueue().length)
            return true;
          else
            return false;
        },

        /**
        *  @inheritdoc
        */
        onClose: function () {

          //Execute the parent class onClose() function
          //EditorView.prototype.onClose.call(this);

          //Remove the listener on the Window
          if (this.beforeunloadCallback) {
            window.removeEventListener("beforeunload", this.beforeunloadCallback);
            delete this.beforeunloadCallback;
          }

          //Stop listening to the "add" event so that new package members aren't rendered.
          //Check first if the DataPackage has been intialized. An easy check is to see is
          // the 'models' attribute is undefined. If the DataPackage collection has been intialized,
          // then it would be an empty array.
          if (typeof MetacatUI.rootDataPackage.models !== "undefined") {
            this.stopListening(MetacatUI.rootDataPackage, "add");
          }

          //Remove all the other events
          this.off();    // remove callbacks, prevent zombies
          this.model.off();

          $(".Editor").removeClass("Editor");
          this.$el.empty();

          this.model = null;

          // Close each subview
          _.each(this.subviews, function (subview) {
            if (subview.onClose)
              subview.onClose();
          });

          this.subviews = [];

          this.undelegateEvents();

        },

        /**
         *  Handle "fileLoadError" events by alerting the user
         * and removing the row from the data package table.
         * @param  {DataONEObject} item The model item passed by the fileLoadError event
         */
        handleFileLoadError: function (item) {
          var message;
          var fileName;
          /* Remove the data package table row */
          this.dataPackageView.removeOne(item);
          /* Then inform the user */
          if (item && item.get &&
            (item.get("fileName") !== "undefined" || item.get("fileName") !== null)) {
            fileName = item.get("fileName");
            message = "The file " + fileName +
              " is already included in this dataset. The duplicate file has not been added.";
          } else {
            message = "The chosen file is already included in this dataset. " +
              "The duplicate file has not been added.";
          }
          MetacatUI.appView.showAlert(message, "alert-info", this.el, 10000, { remove: true });
        },

        /**
         * Handle "fileReadError" events by alerting the user
         * and removing the row from the data package table.
         * @param  {DataONEObject} item The model item passed by the fileReadError event
         */
        handleFileReadError: function (item) {
          var message;
          var fileName;
          /* Remove the data package table row */
          this.dataPackageView.removeOne(item);
          /* Then inform the user */
          if (item && item.get &&
            (item.get("fileName") !== "undefined" || item.get("fileName") !== null)) {
            fileName = item.get("fileName");
            message = "The file " + fileName +
              " could not be read. You may not have permission to read the file," +
              " or the file was too large for your browser to upload. " +
              "The file has not been added.";
          } else {
            message = "The chosen file " +
              " could not be read. You may not have permission to read the file," +
              " or the file was too large for your browser to upload. " +
              "The file has not been added.";
          }
          MetacatUI.appView.showAlert(message, "alert-info", this.el, 10000, { remove: true });
        },

        /**
         * Save a draft of the parent EML model
         */
        saveDraft: function () {
          var view = this;

          try {
            var title = this.model.get("title") || "No title";
            // Create a clone of the model that we will use for serialization.
            // Don't serialize the model that is currently being edited,
            // since serialize may make changes to the model that should not
            // happen until the user is ready to save
            // (e.g. - create a contact if there is not one)
            var draftModel = this.model.clone();

            LocalForage.setItem(this.model.get("id"), {
              id: this.model.get("id"),
              datetime: (new Date()).toISOString(),
              title: Array.isArray(title) ? title[0] : title,
              draft: draftModel.serialize()
            }).then(function () {
              view.clearOldDrafts();
            });
          } catch (ex) {
            console.log("Error saving draft:", ex);
          }
        },

        /**
         * Clear older drafts by iterating over the sorted list of drafts
         * stored by LocalForage and removing any beyond a hardcoded limit.
         */
        clearOldDrafts: function () {
          var drafts = [];

          try {
            LocalForage.iterate(function (value, key, iterationNumber) {
              // Extract each draft
              drafts.push({
                key: key,
                value: value
              });
            }).then(function () {
              // Sort by datetime
              drafts = _.sortBy(drafts, function (draft) {
                return draft.value.datetime.toString();
              }).reverse();
            }).then(function () {
              _.each(drafts, function (draft, i) {
                var age = (new Date()) - new Date(draft.value.datetime);
                var isOld = (age / 2678400000) > 1; // ~31days

                // Delete this draft is not in the most recent 100 or
                // if older than 31 days
                var shouldDelete = i > 100 || isOld;

                if (!shouldDelete) {
                  return;
                }

                LocalForage.removeItem(draft.key).then(function () {
                  // Item should be removed
                });
              });
            });
          }
          catch (ex) {
            console.log("Failed to clear old drafts: ", ex);
          }
        },

        /**
         * Show the AccessPolicy view in a modal dialog
         *
         * This method calls the superclass method, feeding it the identifier
         * associated with the row in the package table that was clicked. The
         * reason for this is so the AccessPolicyView can be used for single
         * objects (like in the Portal editor) or an entire Collection of
         * objects, like in the EML editor: The superclass impelements the
         * generic behavior and the subclass tweaks it.
         *
         * @param {EventHandler} e: The click event
         */
        showAccessPolicyModal: function(e) {
          var id = null;

          try {
            id = $(e.target).parents("tr").data("id");
          } catch (e) {
            console.log("Error determining the identifier to show an AccessPolicyView for:", e);
          }

          var model = MetacatUI.rootDataPackage.find(function(model) {
            return model.get("id") === id;
          });

          EditorView.prototype.showAccessPolicyModal.call(this, e, model);
        }
      });
    return EML211EditorView;
  });
