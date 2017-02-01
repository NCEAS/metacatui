/* global define */
define(['underscore', 
        'jquery', 
        'backbone',
        'collections/DataPackage',
        'models/metadata/eml211/EML211',
        'models/metadata/ScienceMetadata',
        'views/metadata/EML211View',
        'views/DataPackageView',
        'views/SignInView',
        'views/CitationView',
        'text!templates/editor.html',
        'collections/ObjectFormats'], 
        function(_, $, Backbone, DataPackage, EML, ScienceMetadata, EMLView, DataPackageView, SignInView, CitationView,
        		EditorTemplate, ObjectFormats){
    
    var EditorView = Backbone.View.extend({
                
        el: "#Content",
        
        /* The initial editor layout */
        template: _.template(EditorTemplate),
        
        /* Events that apply to the entire editor */
        events: {
        	"click .cancel"      : "cancel",
        	"click #save-editor" : "save"
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
            
            //Reset the listeners
            //this.stopListening();
            
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
	        	
            //If the user is logged in, fetch the Metadata
        	if(MetacatUI.appUserModel.get("loggedIn")) {
        		if(!this.pid) 
        			this.model.trigger("sync");
        		else 
        			this.model.fetch();
    		}
        	//If we checked for authentication and the user is not logged in
        	else if(MetacatUI.appUserModel.get("checked")){
        		this.showSignIn();
        	}
        	//If we haven't checked for authentication yet
        	else {   
        		//Wait until the user info is loaded before we request the Metadata
	            this.listenToOnce(MetacatUI.appUserModel, "change:checked", function(){
	            	if(!MetacatUI.appUserModel.get("loggedIn")){
	            		this.showSignIn();
	            		return;
	            	}
	            		
	            	if(!this.pid) 
	        			this.model.trigger("sync");
	        		else 
	        			this.model.fetch();
	            });
    		}
        	
        	//When the user tries to navigate away, confirm with the user
        	var view = this;
        	window.onbeforeunload = function(){ view.confirmClose() };
                        
            return this;
        },
        
        /* Get the data package associated with the EML */
        getDataPackage: function(scimetaModel) {
            console.log("EditorView.getDataPackage() called.");
            
            if(!scimetaModel)
            	var scimetaModel = this.model;
            
            //Check if this package is obsoleted
            if(this.model.get("obsoletedBy")){
            	this.showLatestVersion();
            	return;
            }
            
            var resourceMapIds = scimetaModel.get("resourceMap");
            
            if ( resourceMapIds === "undefined" || resourceMapIds === null || resourceMapIds.length <= 0 ) {
                console.log("Resource map ids could not be found for " + scimetaModel.id);
                
                // Create a new Data packages
                MetacatUI.rootDataPackage = new DataPackage([this.model]);
                
                //Render the data package
                this.renderDataPackage();

                //Render the metadata
                this.renderMetadata();
                
            } else {
                
                // Create a new data package with this id
                MetacatUI.rootDataPackage = new DataPackage([this.model], { id: resourceMapIds[0] });
                
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
            	this.listenTo(model, "change:uploadStatus", view.showControls);

            });
                       
        	//Render the Data Package view
            this.dataPackageView = new DataPackageView({
            	edit: true,
            	dataPackage: MetacatUI.rootDataPackage
            	});
            
            //Render the view
            var $packageTableContainer = this.$("#data-package-container");
            $packageTableContainer.html(this.dataPackageView.render().el);
            
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
            	               
            	//Style the body as an Editor
                $("body").addClass("Editor");
            	
            	//Create an EML model
                if(model.type != "EML")
                	model = new EML(model.toJSON());
        	
            	//Create an EML211 View and render it
            	emlView = new EMLView({ 
            		model: model,
            		edit: true
            		});
            	this.subviews.push(emlView);
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
        setListeners: function(){
            this.listenTo(this.model, "change:uploadStatus", this.showControls);
            
            //If the Data Package failed saving, display an error message
            this.listenTo(MetacatUI.rootDataPackage, "errorSaving", this.saveError);
        	
        	//Listen for when the package has been successfully saved
        	this.listenTo(MetacatUI.rootDataPackage, "successSaving", this.saveSuccess);
        },
        
        /*
         * Saves all edits in the collection
         */
        save: function(e){
        	var btn = (e && e.target)? $(e.target) : this.$("#save-editor");
        	
        	//If the save button is disabled, then we don't want to save right now
        	if(btn.is(".btn-disabled")) return;
        	
        	//Change the style of the save button
        	btn.html('<i class="icon icon-spinner icon-spin"></i> Saving...').addClass("btn-disabled");
        	
        	//Save the package!
        	MetacatUI.rootDataPackage.save();
        },
        
        /*
         * When the data package collection saves successfully, tell the user
         */
        saveSuccess: function(){
        	//When the package is saved, revert the Save button back to normal
        	this.$("#save-editor").html("Save").removeClass("btn-disabled");
    		this.hideControls();
    		
        	MetacatUI.appView.showAlert("Your changes have been saved", "alert-success", this.$el, 4000);
        	
        	//Change the URL to the new id
        	MetacatUI.uiRouter.navigate("#share/" + this.model.get("id"), { trigger: false, replace: true });
        },
        
        /*
         * When the data package collection fails to save, tell the user
         */
        saveError: function(errorMsg){
        	var errorId = "error" + Math.round(Math.random()*100),
        		message = $(document.createElement("div")).append("<p>Not all of your changes could be saved.</p>");
        	
        	message.append($(document.createElement("a"))
        						.text("See details")
        						.attr("data-toggle", "collapse")
        						.attr("data-target", "#" + errorId)
        						.addClass("pointer"),
        					$(document.createElement("div"))
        						.addClass("collapse")
        						.attr("id", errorId)
        						.append($(document.createElement("pre")).text(errorMsg)));

        	MetacatUI.appView.showAlert(message, "alert-error", this.$el, null, { emailBody: "Error message: Data Package save error: " + errorMsg });
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
			MetacatUI.appView.showAlert(msg, "alert-error", this.$el);
			
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
					MetacatUI.uiRouter.navigate("#share/" + view.pid, { trigger: false, replace: true });
					
					//Render the new model
					view.render();
					
					//Show a warning that the user was trying to edit old content
					MetacatUI.appView.showAlert("You've been forwarded to the newest version of your dataset for editing.", 
							"alert-warning", this.$el, 12000);
				}
				else
					view.getDataPackage();
			});
			
			//Find the latest version of this metadata object
			this.model.findLatestVersion();
		},
		
		showSignIn: function(){
    		var container = $(document.createElement("div")).addClass("container center");
    		this.$el.html(container);
    		var signInButtons = new SignInView().render().el;
    		$(container).append('<h1>Sign in to submit data</h1>', signInButtons);
		},
        
        /*
         * Cancel all edits in the editor
         */
        cancel: function(){
        	this.render();
        },
        
	    showControls: function(model){
	    	if(model.get("uploadStatus") == "q")
	    		this.$(".editor-controls").slideDown();
	    },
	    
	    hideControls: function(){
	    	this.$(".editor-controls").slideUp();
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
            this.model.stopListening();
			
            $(".Editor").removeClass("Editor");
            
            this.model = null;
            this.pid = null;
            
            // Close each subview
            _.each(this.subviews, function(subview) {
				if(subview.onClose)
					subview.onClose();
            });
            
            this.subviews = [];
			window.onbeforeunload = null;
            
        }
                
    });
    return EditorView;
});
