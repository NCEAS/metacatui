/* global define */
define(['underscore', 
        'jquery', 
        'backbone',
        'collections/DataPackage',
        'models/metadata/eml211/EML211',
        'models/metadata/ScienceMetadata',
        'views/metadata/EML211View',
        'views/DataPackageView',
        'text!templates/editor.html'], 
        function(_, $, Backbone, DataPackage, EML, ScienceMetadata, EMLView, DataPackageView, EditorTemplate){
    
    var EditorView = Backbone.View.extend({
                
        el: "#Content",
        
        /* The initial editor layout */
        template: _.template(EditorTemplate),
        
        /* Events that apply to the entire editor */
        events: {
            "change input"    : "showControls",
            "change select"   : "showControls",
            "change textarea" : "showControls"
        },
        
        defaults: {
            /* The identifier of the root package id being rendered */
            id: null,
            
        },
        
        /* A list of the subviews of the editor */
        subviews: [],
        
        /* The data package view */
        dataPackageView: null,
        
        /* Initialize a new EditorView - called post constructor */
        initialize: function(options) {
            
            // If options.id isn't present, generate and render a new package id and metadata id
            if ( typeof options === "undefined" || !options.pid ) {
                console.log("EditorView: Creating a new data package.");
                
            } else {
                this.pid = options.pid;
                console.log("Loading existing package from id " + options.pid);
                
                //TODO: This should create a DataPackage collection 
                this.createModel();

            }

            return this;
        },
        
        //Create a new EML model for this view        
        createModel: function(){
        	var model = new ScienceMetadata({ id: this.pid, type: "Metadata" });
            
            // Once the ScienceMetadata is populated, populate the associated package
            this.model = model;

        },
        
        /* Render the view */
        render: function() {

            MetacatUI.appModel.set('headerType', 'default');
            $("body").addClass("Editor");
        	//Get the basic template on the page
        	this.$el.append(this.template());
        	
        	if(!this.model) this.createModel();
        	
            //Wait until the user info is loaded before we request the Metadata
        	if(MetacatUI.appUserModel.get("loggedIn")) {
              this.model.fetch();

        	} else {        	
	            this.listenToOnce(MetacatUI.appUserModel, "change:checked", function(){
	            	this.model.fetch();
	            });
        	}

            //When the basic Solr metadata are retrieved, get the associated package
            this.listenToOnce(this.model, "sync", this.getDataPackage);
                        
            return this;
        },
        
        /* Get the data package associated with the EML */
        getDataPackage: function(scimetaModel) {
            console.log("EditorView.getDataPackage() called.");
            var resourceMapIds = scimetaModel.get("resourceMap");
            
            if ( resourceMapIds === "undefined" || resourceMapIds === null || resourceMapIds.length <= 0 ) {
                console.log("Resource map ids could not be found for " + scimetaModel.id);
                
                // TODO: Create a fresh package (hmm - shoulda been there)
                
            } else {
                
                // Set the root data package for the collection
                MetacatUI.rootDataPackage = new DataPackage(null, {id: resourceMapIds[0]});
                // As the root collection is updated with models, render the UI
                this.listenTo(MetacatUI.rootDataPackage, "change", this.renderMember);

                // Render the package table framework
                this.dataPackageView = new DataPackageView({edit: true});
                var $packageTableContainer = this.$("#data-package-container");
                $packageTableContainer.append(this.dataPackageView.render().el);
                this.subviews.push(this.dataPackageView);
            

                MetacatUI.rootDataPackage.fetch();
                                
            }
            
            
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
            
            var emlView, dataPackageView;

            // render metadata as the collection is updated, but only EML passed from the event
            if ( typeof model.get === "undefined" || 
                        model.get("formatid") !== "eml://ecoinformatics.org/eml-2.1.1" ) {
                console.log("Not EML. TODO: Render generic ScienceMetadata.");
                return;
                
            } else {
            	console.log("Rendering EML Model ", model);
        	
            	//Create an EML211 View and render it
            	emlView = new EMLView({ 
            		model: model,
            		edit: true
            		});
            	this.subviews.push(emlView);
            	emlView.render();
                // this.renderDataPackageItem(model, collection, options);
                this.off("change", this.renderMember, model); // avoid double renderings      	
                
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
                    collection: MetacatUI.rootDataPackage,
                    edit: true});
                this.subviews.push(this.dataPackageView);
                dataPackageView.render();
                
            }
        },
        
	    showControls: function(){
	    	this.$(".editor-controls").slideDown();
	    },
	    
	    hideControls: function(){
	    	this.$(".editor-controls").slideUp();
	    },
                
        /* Close the view and its sub views */
        onClose: function() {
            this.off();    // remove callbacks, prevent zombies         
			
            $(".Editor").removeClass("Editor");
            
            this.model = null;
            this.pid = null;
            
            // Close each subview
            _.each(this.subviews, function(i, subview) {
				if(subview.onClose)
					subview.onClose();
            });
            
            this.subviews = [];
			window.onbeforeunload = null;
            
        }
                
    });
    return EditorView;
});
