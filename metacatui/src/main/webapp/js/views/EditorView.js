/* global define */
define(['underscore',
        'jquery',
        'backbone',
        'collections/DataPackage',
        'models/metadata/eml211/EML211',
        'models/metadata/eml211/EMLOtherEntity',
        'models/metadata/ScienceMetadata',
        'views/CitationView',
        'views/DataPackageView',
        'views/metadata/EML211View',
        'views/metadata/EMLEntityView',
        'views/SignInView',
        'text!templates/editor.html',
        'collections/ObjectFormats',
        'text!templates/editorSubmitMessage.html'],
        function(_, $, Backbone,
        		DataPackage, EML, EMLOtherEntity, ScienceMetadata,
        		CitationView, DataPackageView, EMLView, EMLEntityView, SignInView,
        		EditorTemplate, ObjectFormats, EditorSubmitMessageTemplate){

    var EditorView = Backbone.View.extend({

        el: "#Content",

        /* The initial editor layout */
        template: _.template(EditorTemplate),
        editorSubmitMessageTemplate: _.template(EditorSubmitMessageTemplate),

        /* Events that apply to the entire editor */
        events: {
        	"click #save-editor"             : "save",
        	"click .data-package-item .edit" : "showEntity"
        },

        /* The identifier of the root package EML being rendered */
        pid: null,

        /* A list of the subviews of the editor */
        subviews: [],

        /* The data package view */
        dataPackageView: null,

        /* Initialize a new EditorView - called post constructor */
        initialize: function(options) {

            // Ensure the object formats are cached for the editor's use
            if ( typeof MetacatUI.objectFormats === "undefined" ) {
                MetacatUI.objectFormats = new ObjectFormats();
                MetacatUI.objectFormats.fetch();

            }
            return this;
        },

        //Create a new EML model for this view
        createModel: function(){
        	//If no pid is given, create a new EML model
        	if(!this.pid)
        		var model = new EML({'synced' : true});
        	//Otherwise create a generic metadata model until we find out the formatId
        	else
        		var model = new ScienceMetadata({ id: this.pid });

            // Once the ScienceMetadata is populated, populate the associated package
            this.model = model;

            //Listen for the replace event on this model
            var view = this;
            this.listenTo(this.model, "replace", function(newModel){
            	if(view.model.get("id") == newModel.get("id")){
            		view.model = newModel;
            		view.setListeners();
            	}
            });

            this.setListeners();
        },

        /* Render the view */
        render: function() {

            MetacatUI.appModel.set('headerType', 'default');

        	//Style the body as an Editor
            $("body").addClass("Editor rendering");
            this.$el.empty();

        	//Inert the basic template on the page
        	this.$el.html(this.template({
        		loading: MetacatUI.appView.loadingTemplate({ msg: "Loading editor..."})
        	}));

        	//If we don't have a model at this point, create one
        	if(!this.model) this.createModel();

	        //When the basic Solr metadata are retrieved, get the associated package
	        this.listenToOnce(this.model, "sync", this.getDataPackage);

	        //If no object is found with this ID, then tell the user
	        this.listenToOnce(this.model, "change:notFound", this.showNotFound);

        	//If we checked for authentication already
        	if(MetacatUI.appUserModel.get("checked"))
        		this.fetchModel();
        	//If we haven't checked for authentication yet,
        	//wait until the user info is loaded before we request the Metadata
        	else
	            this.listenToOnce(MetacatUI.appUserModel, "change:checked", this.fetchModel);

        	//When the user tries to navigate away, confirm with the user
        	var view = this;
        	window.onbeforeunload = function(){ view.confirmClose() };

          // When the user mistakenly drops a file into an area in the window
          // that isn't a proper drop-target, prevent navigating away from the
          // page. Without this, the user will lose their progress in the
          // editor.
          window.addEventListener("dragover", function(e) {
            e = e || event;
            e.preventDefault();
          }, false);

          window.addEventListener("drop", function(e) {
            e = e || event;
            e.preventDefault();
          }, false);

            return this;
        },

        fetchModel: function(){
        	//If we checked for authentication and the user is not logged in
        	if(!MetacatUI.appUserModel.get("loggedIn"))
        		this.showSignIn();
            //If the user is logged in, fetch the Metadata
        	else{
        		//If the user hasn't provided an id, then don't check the authority and mark as synced already
	        	if(!this.pid){
	        		this.model.set("isAuthorized", true);
	    			this.model.trigger("sync");
	        	}
	    		else {
	    			//Get the data package when we find out the user is authorized to edit it
	    	        this.listenToOnce(this.model, "change:isAuthorized", this.getDataPackage);
	    	        //Let a user know when they are not authorized to edit this data set
	    	        this.listenToOnce(this.model, "change:isAuthorized", this.notAuthorized);

	    	        //Fetch the model
	    			this.model.fetch();

	    			//Check the authority of this user
	    			this.model.checkAuthority();
	    		}
        	}
        },

        /* Get the data package associated with the EML */
        getDataPackage: function(scimetaModel) {
            console.log("EditorView.getDataPackage() called.");

            if(!this.model.get("synced") || !this.model.get("isAuthorized")) return;

            if(!scimetaModel)
            	var scimetaModel = this.model;

            //Check if this package is obsoleted
            if(this.model.get("obsoletedBy")){
            	this.showLatestVersion();
            	return;
            }

            var resourceMapIds = scimetaModel.get("resourceMap");

            if ( typeof resourceMapIds === "undefined" || resourceMapIds === null || resourceMapIds.length <= 0 ) {
                console.log("Resource map ids could not be found for " + scimetaModel.id);

                // Create a new Data packages
                MetacatUI.rootDataPackage = new DataPackage([this.model]);
                MetacatUI.rootDataPackage.packageModel.set("synced", true);

                // Associate the science metadata with the resource map
                if ( this.model.get && Array.isArray(this.model.get("resourceMap")) ) {
                    this.model.get("resourceMap").push(MetacatUI.rootDataPackage.packageModel.id);

                } else {
                    this.model.set("resourceMap", MetacatUI.rootDataPackage.packageModel.id);

                }

                // Set the sysMetaXML for the packageModel
                MetacatUI.rootDataPackage.packageModel.set("sysMetaXML",
                    MetacatUI.rootDataPackage.packageModel.serializeSysMeta());

                // Set the listeners
                this.setListeners();
                
                //Render the data package
                this.renderDataPackage();

                //Render the metadata
                this.renderMetadata();

            } else {
                // Create a new data package with this id
                MetacatUI.rootDataPackage = new DataPackage([this.model], {id: resourceMapIds[0]});

                // If there is more than one resource map, we need to make sure we fetch the most recent one
                if ( resourceMapIds.length > 1 ) {

            		//Now, find the latest version
            		this.listenToOnce(MetacatUI.rootDataPackage.packageModel, "change:latestVersion", function(model) {
                        //Create a new data package for the latest version package
            			MetacatUI.rootDataPackage = new DataPackage([this.model], { id: model.get("latestVersion") });

                         //Fetch the data package
                         MetacatUI.rootDataPackage.fetch();

                         //Render the Data Package table
                         this.renderDataPackage();
                     });

                     MetacatUI.rootDataPackage.packageModel.findLatestVersion();

                    return;

                }

                //Fetch the data package
                MetacatUI.rootDataPackage.fetch();

                //Render the Data Package table
                this.renderDataPackage();
            }

        },

        renderChildren: function(model, options) {
            console.log("EditorView.renderChildren() called.");
            console.log(model);
            console.log(options);

        },

        renderDataPackage: function(){
        	var view = this;

        	// As the root collection is updated with models, render the UI
            this.listenTo(MetacatUI.rootDataPackage, "add", function(model){

            	if(!model.get("synced") && model.get('id'))
            		this.listenTo(model, "sync", view.renderMember);
            	else if(model.get("synced"))
            		view.renderMember(model);

            	//Listen for changes on this member
                model.on("change:fileName", model.updateUploadStatus);
            });

        	//Render the Data Package view
            this.dataPackageView = new DataPackageView({
            	edit: true,
            	dataPackage: MetacatUI.rootDataPackage
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
	            	handles: { "s" : handle },
	            	minHeight: 100,
	            	maxHeight: 900,
	            	resize: function(){
	            		view.emlView.resizeTOC();
	            	}
            	});
            
            var tableHeight = ($(window).height() - $("#Navbar").height()) * .75;          
            $packageTableContainer.css("height", tableHeight + "px");

            var table = this.dataPackageView.$el;
            this.listenTo(this.dataPackageView, "addOne", function(){
            	if(table.outerHeight() > $packageTableContainer.outerHeight() && table.outerHeight() < 220){
                    $packageTableContainer.css("height", table.outerHeight() + handle.outerHeight());
                    if(this.emlView)
                    	this.emlView.resizeTOC();
            	}
            });

            if(this.emlView)
            	this.emlView.resizeTOC();

            //Save the view as a subview
            this.subviews.push(this.dataPackageView);

            this.listenTo(MetacatUI.rootDataPackage.packageModel, "change:childPackages", this.renderChildren);
        },

        /* Calls the appropriate render method depending on the model type */
        renderMember: function(model, collection, options) {

            // Render metadata or package information, based on the type

            if ( typeof model.attributes === "undefined") {
                return;

            } else {
                switch ( model.get("type")) {
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

        /* Renders the metadata section of the EditorView */
        renderMetadata: function(model, collection, options){

        	if(!model && this.model) var model = this.model;
        	if(!model) return;

            var emlView, dataPackageView;

            // render metadata as the collection is updated, but only EML passed from the event
            if ( typeof model.get === "undefined" ||
                        model.get("formatId") !== "eml://ecoinformatics.org/eml-2.1.1" ) {
                console.log("Not EML. TODO: Render generic ScienceMetadata.");
                return;

            } else {
            	console.log("Rendering EML Model ", model.get("id"));

            	//Create an EML model
                if(model.type != "EML"){
                	//Create a new EML model from the ScienceMetadata model
                	var EMLmodel = new EML(model.toJSON());
                	//Replace the old ScienceMetadata model in the collection
                	MetacatUI.rootDataPackage.remove(model);
                	MetacatUI.rootDataPackage.add(EMLmodel, { silent: true });
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
                // this.renderDataPackageItem(model, collection, options);
               // this.off("change", this.renderMember, model); // avoid double renderings


                // Create a citation view and render it
                var citationView = new CitationView({
                            model: model,
                            title: "Untitled dataset",
                            createLink: false });

                this.subviews.push(citationView);
                $("#citation-container").html(citationView.render().$el);

                //Remove the rendering class from the body element
                $("body").removeClass("rendering");
            }

            // Focus the folder name field once loaded but only if this is a new
            // document
            if (!this.pid) {
                $("#data-package-table-body td.name").focus();
            }

        },

        /* Renders the data package section of the EditorView */
        renderDataPackageItem: function(model, collection, options) {

            var hasPackageSubView =
                _.find(this.subviews, function(subview) {
                    return subview.id === "data-package-table";
                }, model);

            // Only create the package table if it hasn't been created
            if ( ! hasPackageSubView ) {
                this.dataPackageView = new DataPackageView({
                    dataPackage: MetacatUI.rootDataPackage,
                    edit: true
                    });
                this.subviews.push(this.dataPackageView);
                dataPackageView.render();

            }
        },

        /*
         * Set listeners on the view's model for various reasons.
         * This function centralizes all the listeners so that when/if the view's model is replaced, the listeners would be reset.
         */
        setListeners: function() {

            this.listenTo(this.model, "change:uploadStatus", this.showControls);

            // Register a listener for any attribute change
            this.model.on("change", this.model.handleChange, this.model);

            // If any attributes have changed (including nested objects), show the controls
            if ( typeof MetacatUI.rootDataPackage.packageModel !== "undefined" ) {
                this.stopListening(MetacatUI.rootDataPackage.packageModel, "change:changed");
                this.listenTo(MetacatUI.rootDataPackage.packageModel, "change:changed", this.toggleControls);
                this.listenTo(MetacatUI.rootDataPackage.packageModel, "change:changed", function(event) {
                    if (MetacatUI.rootDataPackage.packageModel.get("changed") ) {
                        this.model.set("uploadStatus", "q"); // Clears the error status
                    }
                });

            }

            // If the Data Package failed saving, display an error message
            this.listenTo(MetacatUI.rootDataPackage, "errorSaving", this.saveError);

        	// Listen for when the package has been successfully saved
        	this.listenTo(MetacatUI.rootDataPackage, "successSaving", this.saveSuccess);

        	//When the Data Package cancels saving, hide the saving styling
        	this.listenTo(MetacatUI.rootDataPackage, "cancelSave", this.hideSaving);
        	this.listenTo(MetacatUI.rootDataPackage, "cancelSave", this.handleSaveCancel);

        	//When the model is invalid, show the required fields
        	this.listenTo(this.model, "invalid", this.showValidation);
        	this.listenTo(this.model, "valid",   this.showValidation);
            
            // When a data package member fails to load, remove it and warn the user
            this.listenTo(MetacatUI.eventDispatcher, "fileLoadError", this.handleFileLoadError);
        },

        /*
         * Saves all edits in the collection
         */
        save: function(e){
        	var btn = (e && e.target)? $(e.target) : this.$("#save-editor");

        	//If the save button is disabled, then we don't want to save right now
        	if(btn.is(".btn-disabled")) return;

	       	this.showSaving();
	       	
        	//Save the package!
        	MetacatUI.rootDataPackage.save();
        },

        /*
         * When the data package collection saves successfully, tell the user
         */
        saveSuccess: function(savedObject){

        	//We only want to perform these actions after the package saves
        	if(savedObject.type != "DataPackage") return;

        	//Change the URL to the new id
        	MetacatUI.uiRouter.navigate("#submit/" + this.model.get("id"), { trigger: false, replace: true });

            this.toggleControls();

            // TODO : Remove conditions if you want to review datasets for every theme
            // Review message for "arctic" theme.
            if (MetacatUI.appModel.get("contentIsModerated")) {
                var message = this.editorSubmitMessageTemplate({
                    	themeTitle: MetacatUI.themeTitle
                	}),
                	timeout = null;
                
            }
            else {
                var message = $(document.createElement("div")).append(
                		$(document.createElement("span")).text("Your changes have been submitted. "),
                		$(document.createElement("a")).attr("href", "#view/" + this.model.get("id")).text("View your dataset.")),
                	timeout = 4000;
            }
            
        	
            MetacatUI.appView.showAlert(message, "alert-success", this.$el, timeout, {remove: true});
            
            //Rerender the CitationView
            var citationView = _.where(this.subviews, { type: "Citation" });
            if(citationView.length){
	            citationView[0].createTitleLink = true;
	            citationView[0].render();
            }
            
            // Reset the state to clean
            MetacatUI.rootDataPackage.packageModel.set("changed", false);
            this.model.set("hasContentChanges", false);

            this.setListeners();
        },

        /*
         * When the data package collection fails to save, tell the user
         */
        saveError: function(errorMsg){
        	var errorId = "error" + Math.round(Math.random()*100),
        		message = $(document.createElement("div")).append("<p>Not all of your changes could be submitted.</p>");

        	message.append($(document.createElement("a"))
        						.text("See details")
        						.attr("data-toggle", "collapse")
        						.attr("data-target", "#" + errorId)
        						.addClass("pointer"),
        					$(document.createElement("div"))
        						.addClass("collapse")
        						.attr("id", errorId)
        						.append($(document.createElement("pre")).text(errorMsg)));

        	MetacatUI.appView.showAlert(message, "alert-error", this.$el, null, {
        		emailBody: "Error message: Data Package save error: " + errorMsg,
        		remove: true
        		});
        	
        	//Reset the Saving styling
        	this.hideSaving();
        },

        /*
         * Called when there is no object found with this ID
         */
        showNotFound: function(){
			//If we haven't checked the logged-in status of the user yet, wait a bit until we show a 404 msg, in case this content is their private content
			if(!MetacatUI.appUserModel.get("checked")){
				this.listenToOnce(MetacatUI.appUserModel, "change:checked", this.showNotFound);
				return;
			}
			//If the user is not logged in
			else if(!MetacatUI.appUserModel.get("loggedIn")){
				this.showSignIn();
				return;
			}

			if(!this.model.get("notFound")) return;

			var msg = "<h4>Nothing was found for one of the following reasons:</h4>" +
			  "<ul class='indent'>" +
			  	  "<li>The ID '" + this.pid  + "' does not exist.</li>" +
				  '<li>This may be private content. (Are you <a href="#signin">signed in?</a>)</li>' +
				  "<li>The content was removed because it was invalid.</li>" +
			  "</ul>";
			this.hideLoading();
			MetacatUI.appView.showAlert(msg, "alert-error", this.$("#editor-body"), null, {remove: true});

		},

		showLatestVersion: function(){
			var view = this;

			//When the latest version is found,
			this.listenToOnce(this.model, "change:latestVersion", function(){
				//Make sure it has a newer version, and if so,
				if(view.model.get("latestVersion") != view.model.get("id")){
					//Get the obsoleted id
					var oldID = view.model.get("id");

					//Reset the current model
					view.pid = view.model.get("latestVersion");
					view.model = null;

					//Update the URL
					MetacatUI.uiRouter.navigate("#submit/" + view.pid, { trigger: false, replace: true });

					//Render the new model
					view.render();

					//Show a warning that the user was trying to edit old content
					MetacatUI.appView.showAlert("You've been forwarded to the newest version of your dataset for editing.",
							"alert-warning", this.$el, 12000, { remove: true });
				}
				else
					view.getDataPackage();
			});

			//Find the latest version of this metadata object
			this.model.findLatestVersion();
		},

		/*
		 * Show the entity editor
		 */
		showEntity: function(e){
        	if(!e || !e.target)
        		return;

        	//For EML metadata docs
        	if(this.model.type == "EML"){
	        	//Get the Entity View
	        	var entityView = $(e.target).data("entityView"),
	        		clickedEl = $(e.target),
	        		row = clickedEl.parents(".data-package-item"),
	        		dataONEObject = row.data("model");
	        	
	        	if(dataONEObject.get("uploadStatus") == "p" || dataONEObject.get("uploadStatus") == "l" || dataONEObject.get("uploadStatus") == "e")
	        		return;

	        	//If there isn't a view yet, create one
	        	if(!entityView){

	        		//Get the entity model for this data package item
	        		var entityModel = this.model.getEntity(row.data("model"));

	        		//Create a new EMLOtherEntity if it doesn't exist
	        		if(!entityModel){
	        			entityModel = new EMLOtherEntity({
	        				entityName : dataONEObject.get("fileName"),
	        				entityType : dataONEObject.get("formatId") || dataONEObject.get("mediaType"),
	        				parentModel: this.model,
	        				xmlID: dataONEObject.getXMLSafeID()
	        			});

	        			if(!dataONEObject.get("fileName")){
		        			//Listen to changes to required fields on the otherEntity models
		        			this.listenTo(entityModel, "change:entityName", function(){
		        				if(!entityModel.isValid()) return;

		        				//Get the position this entity will be in
		        				var position = $(".data-package-item.data").index(row);

		        				this.model.addEntity(entityModel, position);
		        			});
	        			}
	        			else{
	        				//Get the position this entity will be in
	        				var position = $(".data-package-item.data").index(row);

	        				this.model.addEntity(entityModel, position);
	        			}
	        		}

	        		//Create a new view for the entity based on the model type
	        		if(entityModel.type == "EMLOtherEntity"){
		        		entityView = new EMLEntityView({
		        			model: entityModel,
		        			DataONEObject: dataONEObject,
		        			edit: true
		        		});
	        		}
	        		else{
	        			entityView = new EMLEntityView({
		        			model: entityModel,
		        			DataONEObject: dataONEObject,
		        			edit: true
		        		});
	        		}

	        		//Attach the view to the edit button so we can access it again
	        		clickedEl.data("entityView", entityView);

	        		//Render the view
	        		entityView.render();
	        	}

	        	//Show the modal window editor for this entity
	        	if(entityView)
	        		entityView.show();
        	}

		},

		showSignIn: function(){
    		var container = $(document.createElement("div")).addClass("container center");
    		this.$el.html(container);
    		var signInButtons = new SignInView().render().el;
    		$(container).append('<h1>Sign in to submit data</h1>', signInButtons);
		},

		/*
		 * Shows a message if the user is not authorized to edit this package
		 */
		notAuthorized: function(){
			if(this.model.get("isAuthorized") || this.model.get("notFound")) return;

			this.$("#editor-body").empty();
			MetacatUI.appView.showAlert("You are not authorized to edit this data set.",
					"alert-error", "#editor-body");

			//Stop listening to any further events
			this.stopListening();
			this.model.off();
		},

        /*
         * Cancel all edits in the editor
         */
        cancel: function(){
        	this.render();
        },

        handleSaveCancel: function(){
        	if(this.model.get("uploadStatus") == "e"){
        		this.saveError("There was a caught exception during your submission, so the submission was cancelled.");
        	}
        },

        /* Show the editor footer controls (Save bar) */
	    showControls: function(){
	    	this.$(".editor-controls").removeClass("hidden").slideDown();
	    },

        /* Hide the editor footer controls (Save bar) */
	    hideControls: function(){
        	this.hideSaving();

	    	this.$(".editor-controls").slideUp();
	    },
	    
	    showSaving: function(){

        	//Change the style of the save button
        	this.$("#save-editor")
        		.html('<i class="icon icon-spinner icon-spin"></i> Submitting ...')
        		.addClass("btn-disabled");

	    	this.$("input, textarea, select, button").prop("disabled", true);	    	
	    	
	    },

	    hideSaving: function(){
	    	this.$("input, textarea, select, button").prop("disabled", false);

        	//When the package is saved, revert the Save button back to normal
        	this.$("#save-editor").html("Submit dataset").removeClass("btn-disabled");	    
	    
	    },

        /* Toggle the editor footer controls (Save bar) */
        toggleControls: function() {
            if ( MetacatUI.rootDataPackage &&
                 MetacatUI.rootDataPackage.packageModel &&
                 MetacatUI.rootDataPackage.packageModel.get("changed") ) {
                this.showControls();

            } else {
                this.hideControls();

            }
        },

	    showLoading: function(container, message){
	    	if(typeof container == "undefined" || !container)
	    		var container = this.$el;

	    	$(container).html(MetacatUI.appView.loadingTemplate({ msg: message }));
	    },

	    hideLoading: function(container){
	    	if(typeof container == "undefined" || !container)
	    		var container = this.$el;

	    	$(container).find(".loading").remove();
	    },

		showValidation: function(){
			
			//First clear all the error messaging
			this.$(".notification.error").empty();
			this.$(".side-nav-item .icon").hide();
			this.$(".error").removeClass("error");
			$(".alert-container").remove();
			
			
			var errors = this.model.validationError;
			
			_.each(errors, function(errorMsg, category){
				
				var categoryEls = this.$("[data-category='" + category + "']"),
					dataItemRow = categoryEls.parents(".data-package-item");

				//If this field is in a DataItemView, then delegate to that view
				if(dataItemRow.length && dataItemRow.data("view")){
					dataItemRow.data("view").showValidation(category, errorMsg);
					return;
				}
				else{
					var elsWithViews = _.filter(categoryEls, function(el){
							return ( $(el).data("view") && 
									$(el).data("view").showValidation &&
									!$(el).data("view").isNew );
						});
					
					if(elsWithViews.length){
						_.each(elsWithViews, function(el){
							$(el).data("view").showValidation();
						});
					}
					else{
						//Show the error message
						categoryEls.filter(".notification").addClass("error").text(errorMsg);
						
						//Add the error message to inputs
						categoryEls.filter("textarea, input").addClass("error");
					}
				}
				
				//Get the link in the table of contents navigation
				var navigationLink = this.$(".side-nav-item[data-category='" + category + "']");
				
				if(!navigationLink.length){
					var section = categoryEls.parents("[data-section]");
					navigationLink = this.$(".side-nav-item." + $(section).attr("data-section"));
				}
				
				//Show the error icon in the table of contents				
				navigationLink.addClass("error")
					.find(".icon")
					.addClass("error")
					.show();
				
				this.model.off("change:"  + category, this.model.checkValidity);
				this.model.once("change:" + category, this.model.checkValidity);
				
			}, this);
			
			if(errors){
				MetacatUI.appView.showAlert("Fix the errors flagged below before submitting.", 
						"alert-error", 
						this.$el, 
						null, 
						{
	        				remove: true
						});
			}

		},
		
		checkValidity: function(){
			if(this.model.isValid())
				this.model.trigger("valid");
		},

	    /*
	     * Alerts the user that changes will not be saved if s/he navigates away from this view.
	     */
		confirmClose: function(){
			//If the user isn't logged in, we can leave this page
			if(!MetacatUI.appUserModel.get("loggedIn")) return true;

			//If the form hasn't been edited, we can close this view without confirmation
			if(!MetacatUI.rootDataPackage.getQueue().length) return true;

			var isLeaving = confirm("Do you want to leave this page? All information you've entered will be lost.");
			return isLeaving;
		},

        /* Close the view and its sub views */
        onClose: function() {
            this.off();    // remove callbacks, prevent zombies
            this.model.off();

            $(".Editor").removeClass("Editor");
            this.$el.empty();

            this.model = null;

            // Close each subview
            _.each(this.subviews, function(subview) {
				if(subview.onClose)
					subview.onClose();
            });

            this.subviews = [];
			window.onbeforeunload = null;

        },

        /*
            Handle to "fileLoadError" events by alerting the users
            and removing the row from the data package table.
            
            @param item The model item passed by the fileLoadError event
         */
         handleFileLoadError: function(item) {
            var message;
            var fileName;
            /* Remove the data package table row */
            this.dataPackageView.removeOne(item);
            /* Then inform the user */
            if ( item && item.get && 
                (item.get("fileName") !== "undefined" || item.get("fileName") !== null) ) { 
                fileName = item.get("fileName");
                message = "The file " + fileName + 
                    " is already listed in the package. The duplicate file has not been added.";
            } else {
                message = "The chosen file is already listed in the package. " +
                    "The duplicate file has not been added.";
            }
            MetacatUI.appView.showAlert(message, "alert-info", "body", 5000, {remove: true});
         }
    });
    return EditorView;
});
