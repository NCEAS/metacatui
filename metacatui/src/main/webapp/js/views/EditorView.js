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
                
                //Create a new data package
                MetacatUI.rootDataPackage = new DataPackage();
                this.renderMetadata(this.model);                
            } else {
                
                // Set the root data package for the collection
                MetacatUI.rootDataPackage = new DataPackage(null, {id: resourceMapIds[0]});
                // As the root collection is updated with models, render the UI
                this.listenTo(MetacatUI.rootDataPackage, "update", this.renderMember);

                MetacatUI.rootDataPackage.fetch();
                                
            }
            
            
        },
        
        /* Calls the appropriate render method depending on the model type */
        renderMember: function(model, collection, options) {
            
            // Render metadata or package information, based on the packageModel property       
            if ( typeof model.packageModel === "undefined" ) {
                this.renderMetadata(model, collection, options);
            } else {
                this.renderDataPackage(model, collection, options);                
            }
            
        },
        
        /* Renders the metadata section of the EditorView */
        renderMetadata: function(model, collection, options){
            
            // render metadata as the collection is updated, but only EML passed from the event
            if ( typeof model.get === "undefined" || 
                        model.get("formatId") !== "eml://ecoinformatics.org/eml-2.1.1" ) {
                this.listenToOnce(model, "change", this.renderMember);
                return;
                
            } else {
            	console.log("Rendering EML Model ", model);
            	
            	//Create an EML model
            	var emlModel = new EML(model.toJSON());
            	
            	//Create an EML211 View and render it
            	var emlView = new EMLView({ 
            		model: emlModel,
            		edit: true
            		});
            	this.subviews.push(emlView);
            	emlView.render();
            	
            	// avoid double renderings
                this.off("change", this.renderMember, model);      	
                
            }
        },
        
        /* Renders the data package section of the EditorView */
        renderDataPackage: function(model, collection, options) {
            
            // render data packages passed in from the update event
            if ( typeof model.packageModel === "undefined" ) {
                return;
                
            }
            
            if ( typeof model.packageModel.get === "undefined" ||
                        model.packageModel.get("formatid") === "undefined" || 
                        model.packageModel.get("formatid") !== "http://www.openarchives.org/ore/terms" ) {
                this.listenToOnce(model, "change", this.renderMember);
                return;
                
            } else {
            	console.log("Rendering Data Package Model ", model);
                var dataPackageView = new DataPackageView({
                    collection: dataPackage,
                    edit: true});
                this.subviews.push(dataPackageView);
                dataPackageView.render();
                this.off("change", this.renderMember, model); // avoid double renderings      	
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
