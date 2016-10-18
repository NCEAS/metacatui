﻿/* global define */
define(['underscore', 
        'jquery', 
        'backbone',
        'collections/DataPackage',
        'models/metadata/eml211/EML211',
        'views/metadata/EML211View',
        'text!templates/editor.html'], 
        function(_, $, Backbone, DataPackage, EML, EMLView, EditorTemplate){
    
    var EditorView = Backbone.View.extend({
        
        el: '#Content',
        
        /* The initial editor layout */
        template: _.template(EditorTemplate),
        
        /* Events that apply to the entire editor */
        events: {
            
        },
        
        /* The identifier of the root package id being rendered */
        id: null,
        
        /* A list of the subviews of the editor */
        subviews: [],
        
        /* Constructor - initialize a new EditorView */
        initialize: function(options) {
            
            // If options.id isn't present, generate and render a new package id and metadata id
            if ( typeof options === "undefined" || !options.id ) {
                console.log("EditorView: Creating a new data package.");
                
            } else {
                this.id = options.id;
                console.log("Loading existing package from id " + options.id);
                
                //TODO: This should create a DataPackage collection 
                //Create a new EML model for this view
                var model = new EML({ id: this.id }); 
                this.model = model;               
            }            
            return this;
        },
        
        /* Render the view */
        render: function() {
        	//Get the basic template on the page
        	this.$el.append(this.template());
        	
            //Wait until the user info is loaded before we request the Metadata
            this.listenToOnce(MetacatUI.appUserModel, "change:checked", function(){
            	this.model.fetch();
            });
            
            //When the metadata is retrieved, render it
            this.listenToOnce(this.model, "sync", this.renderMetadata);
                        
            return this;
        },
        
        renderMetadata: function(emlModel){
        	console.log("Rendering EML Model ", emlModel);
        	
        	//Create an EML211 View and render it
        	var emlView = new EMLView({ model: this.model });
        	this.subviews.push(emlView);
        	emlView.render();
        	
        },
        
        /* Close the view and its sub views */
        close: function() {
            this.remove(); // remove for the DOM, stop listening           
            this.off();    // remove callbacks, prevent zombies         
            
            // Close each subview
            _.each(this.subviews, function(i, subview) {
				subview.close();
                
            });
            
            this.subviews = [];
			window.onbeforeunload = null;
            
        }
    });
    return EditorView;
});