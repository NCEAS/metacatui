﻿/* global define */
define(['underscore', 'jquery', 'backbone', 'models/DataONEObject', 
        'models/metadata/eml211/EMLOtherEntity', 'text!templates/dataItem.html'], 
    function(_, $, Backbone, DataONEObject, EMLOtherEntity, DataItemTemplate){
        
        /* 
            A DataItemView represents a single data item in a data package as a single row of 
            a nested table.  An item may represent a metadata object (as a folder), or a data
            object described by the metadata (as a file).  Every metadata DataItemView has a
            resource map associated with it that describes the relationships between the 
            aggregated metadata and data objects.
        */
        var DataItemView = Backbone.View.extend({
           
            tagName: "tr",
            
            className: "data-package-item",
            
            id: null,
            
            /* The HTML template for a data item */
            template: _.template(DataItemTemplate),
            
            /* Events this view listens to */
            events: {
                "focusout .name"       : "updateName",
                "click    .name"       : "emptyName",
                /* "click .rename"     : "rename", */
                "click .duplicate"     : "duplicate",         // Edit dropdown, duplicate scimeta/rdf
                "click .addFolder"     : "handleAddFolder",   // Edit dropdown, add nested scimeta/rdf
                "click .addFiles"      : "handleAddFiles",    // Edit dropdown, open file picker dialog
                "change .file-upload"  : "addFiles",          // Adds the files into the collection
                "dragover"             : "showDropzone",      // Drag & drop, show the dropzone for this row
                "dragend"              : "hideDropzone",      // Drag & drop, hide the dropzone for this row
                "dragleave"            : "hideDropzone",      // Drag & drop, hide the dropzone for this row
                "drop"                 : "addFiles",          // Drag & drop, adds the files into the collection
                "click .removeFiles"   : "handleRemove",      // Edit dropdown, remove sci{data,meta} from collection
                "click .cancel"        : "handleCancel",      // Cancel a file load
                "change: percentLoaded": "updateLoadProgress", // Update the file read progress bar
                "mouseover .remove"    : "previewRemove",
                "mouseout  .remove"    : "previewRemove"
            },
            
            /* Initialize the object - post constructor */
            initialize: function(options) {
                this.id = this.model.get("id");
                
            },
            
            /* Render the template into the DOM */
            render: function(model) {
            	//Prevent duplicate listeners
            	this.stopListening();
            	
                // Set the data-id for identifying events to model ids
                this.$el.attr("data-id", this.model.get("id"));
                
                //Destroy the old tooltip
                this.$(".status .icon, .status .progress").tooltip("hide").tooltip("destroy");
                
                var attributes = this.model.toJSON();
                
                //Format the title
                if(Array.isArray(attributes.title))
                	attributes.title  = attributes.title[0];
                
                //Get the number of attributes for this item
                attributes.numAttributes = 0;
                var parentEML = MetacatUI.rootDataPackage.where({
                    	id: this.model.get("isDocumentedBy")[0]
                	});
                if(parentEML.type == "EML"){
                	var entity = parentEML.getEntity(this.model);
                	if(entity)
                		attributes.numAttributes = entity.get("attributeList").length;
                }
                
                this.$el.html( this.template(attributes) );
                this.$el.find(".dropdown-toggle").dropdown();

                //Add the title data-attribute attribute to the name cell
                if(this.model.get("type") == "Metadata"){
                	this.$el.find(".name").attr("data-attribute", "title");
                	this.$el.addClass("folder");
                }
                else{
                	this.$el.addClass("data");
                }
                
                //Check if the data package is in progress of being uploaded
                this.toggleSaving();
                
                //Create tooltips based on the upload status
                if(this.model.get("uploadStatus") == "e" && this.model.get("errorMessage")){
                	var errorMsg = this.model.get("errorMessage");
                	
                	this.$(".icon.error").tooltip({
                		placement: "top",
                		trigger: "hover",
                		html: true,
                		title: "<div class='status-tooltip error'><h6>Error saving:</h6><div>" + errorMsg + "</div></div>",
                		container: "body"
                	});
                	this.$el.removeClass("loading");
                }
                else if(this.model.get("uploadStatus") == "q"){
                	this.$(".status .progress").tooltip({
                		placement: "top",
                		trigger: "hover",
                		html: true,
                		title: "<div class='status-tooltip'>Starting Upload</div>",
                		container: "body"
                	});
                	this.$el.removeClass("loading");
                }
                else if (( !this.model.get("uploadStatus") || this.model.get("uploadStatus") == "c" ) && attributes.numAttributes == 0){
            		this.$(".status .icon").tooltip({
                		placement: "top",
                		trigger: "hover",
                		html: true,
                		title: "<div class='status-tooltip'>This file needs to be described - Click 'Describe'</div>",
                		container: "body"
                	});
            		
            		this.$el.removeClass("loading");
            	}
                else if(this.model.get("uploadStatus") == "c"){

            		this.$(".status .icon").tooltip({
                		placement: "top",
                		trigger: "hover",
                		html: true,
                		title: "<div class='status-tooltip'>Upload complete</div>",
                		container: "body"
                	});

                	this.$el.removeClass("loading");
                }
                else if(this.model.get("uploadStatus") == "l"){
                	this.$(".status .icon").tooltip({
                		placement: "top",
                		trigger: "hover",
                		html: true,
                		title: "<div class='status-tooltip'>Reading file...</div>",
                		container: "body"
                	});
                	
                	this.$el.addClass("loading");
                }
                else if(this.model.get("uploadStatus") == "p"){
                	var model = this.model;
                	
                	this.$(".status .progress").tooltip({
                		placement: "top",
                		trigger: "hover",
                		html: true,
                		title: function(){
                			if(model.get("numSaveAttempts") > 0){
                				return "<div class='status-tooltip'>Something went wrong during upload. <br/> Trying again... (attempt " + model.get("numSaveAttempts") + " of 3)</div>";
                			}
                			else if(model.get("uploadProgress")){
                				var percentDone = model.get("uploadProgress").toString();
                				if(percentDone.indexOf(".") > -1)               				
                					percentDone = percentDone.substring(0, percentDone.indexOf("."));
                			}
                			else
                				var percentDone = "0";
                			
                			return "<div class='status-tooltip'>Uploading: " + percentDone + "%</div>";
                		},
                		container: "body"
                	});
                	                	
                	this.$el.addClass("loading");
                }
                else{
                	this.$el.removeClass("loading");
                }
                	
                //Listen to changes to the upload progress of this object
                this.listenTo(this.model, "change:uploadProgress", this.showUploadProgress);
                
                //Listen to changes to the upload status of the entire package
                this.listenTo(MetacatUI.rootDataPackage.packageModel, "change:uploadStatus", this.toggleSaving);
                
                //listen for changes to rerender the view
                this.listenTo(this.model, "change:fileName change:title change:id change:formatType " + 
                		"change:formatId change:type change:resourceMap change:documents change:isDocumentedBy " +
                		"change:size change:nodeLevel change:uploadStatus", this.render); // render changes to the item

                var view = this;
                this.listenTo(this.model, "replace", function(newModel){
                	view.model = newModel;
                	view.render();
                });
                
                this.$el.data({ 
                	view: this,
                	model: this.model
                	});
                
                return this;
            },
            
            /* Close the view and remove it from the DOM */
            onClose: function(){
                console.log('DataItemView: onClose()');
                this.remove(); // remove for the DOM, stop listening           
                this.off();    // remove callbacks, prevent zombies         
                                
            },
            
            /* 
              Generate a unique id for each data item in the table
              TODO: This could be replaced with the DataONE identifier
            */
            generateId: function() {
                var idStr = ''; // the id to return
                var length = 30; // the length of the generated string
                var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz'.split('');
                
                for (var i = 0; i < length; i++) {
                    idStr += chars[Math.floor(Math.random() * chars.length)];
                }
                
                return idStr;
            },
            
            /* Update the folder name based on the scimeta title */
            updateName: function(e) {
                var enteredText = $(e.target).text().trim();
            	
                // Set the title if this item is metadata or set the file name
                // if its not
            	if(this.model.get("type") == "Metadata") {
            		var title = this.model.get("title");
            		
                    // Get the current title which is either an array of titles
                    // or a single string. When it's an array of strings, we
                    // use the first as the canonical title
                    var currentTitle = Array.isArray(title) ? title[0] : title;

                    // Don't set the title if it hasn't changed or is empty
                    if (enteredText !== "" && 
                        currentTitle !== enteredText &&
                        enteredText !== "Untitled dataset: Add a descriptive title for your dataset") {
                        // Set the new title, upgrading any title attributes
                        // that aren't Arrays into Arrays
                        if ((Array.isArray(title) && title.length < 2) || typeof title == "string") {
                            this.model.set("title", [ enteredText ]);
                        } else {
                            title[0] = enteredText;
                        }
                    }
                } else {
                    this.model.set("fileName", enteredText);
                }
            },
                                    
            /* rename a file or folder TODO: decide if we need this */ 
            rename: function(event) {
                console.log("DataItemView.rename() called.");
                
            },
            
            /* Duplicate a file or folder */
            duplicate: function(event) {
                console.log("DataItemView.duplicate() called.");
                
            },
            
            /* Add a sub folder */
            addFolder: function(event) {
                console.log("DataItemView.addFolder() called.");
                
            },
            
            /* 
                Handle the add file event, showing the file picker dialog 
                Multiple files are allowed using the shift and or option/alt key
            */
            handleAddFiles: function(event) {
                console.log("DataItemView.handleAddFiles() called.");
                
                event.stopPropagation();
                var fileUploadElement = this.$el.find(".file-upload");
                
                if ( fileUploadElement ) {
                    fileUploadElement.click();
                }
                event.preventDefault();
                
            },
            
            /* 
                With a file list from the file picker or drag and drop,
                add the files to the collection 
            */
            addFiles: function(event) {
                console.log("DataItemView.addFiles() called.");
                
                var fileList,            // The list of chosen files
                    parentDataPackage,   // The id of the first resource of this row's scimeta
                    dataONEObject,       // The dataONEObject to represent this file
                    self = this;         // A reference to this view

                event.stopPropagation();
                event.preventDefault();
                // handle drag and drop files
                if ( typeof event.originalEvent.dataTransfer !== "undefined" ) {
                    fileList = event.originalEvent.dataTransfer.files;
                    
                // handle file picker files    
                } else {
                    if ( event.target ) {
                        fileList = event.target.files;
                    }
                    
                }
                this.$el.removeClass("droppable");
                
                // Find the correct collection to add to. Use JQuery's delegateTarget
                // attribute corresponding to the element where the event handler was attached
                if ( typeof event.delegateTarget.dataset.id !== "undefined" ) {
                    this.parentSciMeta = this.getParentScienceMetadata(event);
                    this.collection = this.getParentDataPackage(event);
                    
                    // Read each file, and make a DataONEObject
                    _.each(fileList, function(file) {
                        console.log("Processing " + file.name + ", size: " + file.size);
                        
                        dataONEObject = new DataONEObject({
                            synced: true,
                            type: "Data",
                            fileName: file.name,
                            size: file.size,
                            mediaType: file.type,
                            uploadFile: file,
                            uploadStatus: "l",
                            isDocumentedBy: [this.parentSciMeta.id],
                            resourceMap: [this.collection.packageModel.id]
                        });
                        
                        dataONEObject.loadFile();
                                                
                    }, this);
                    
                }
                
            },
                        
            /* During file reading, update the progress bar */
            updateLoadProgress: function(event) {
                console.log(event);
                
                // TODO: Update the progress bar
                
            },
            
            /* Show the drop zone for this row in the table */
            showDropzone: function() {
                if ( this.model.get("type") !== "Metadata" ) return; 
                this.$el.addClass("droppable");
                
            },
            
            /* Hide the drop zone for this row in the table */
            hideDropzone: function(event) {
                if ( this.model.get("type") !== "Metadata" ) return; 
                this.$el.removeClass("droppable");
                
            },
            
            /* Handle remove events for this row in the data package table */
            handleRemove: function(event) {
                var eventId,         // The id of the row of this event
                    removalIds = [], // The list of target ids to remove
                    dataONEObject,   // The model represented by this row
                    documents;       // The list of ids documented by this row (if meta)
                
                event.stopPropagation();
                event.preventDefault();
                
                // Get the row id, add it to the remove list
                if ( typeof event.delegateTarget.dataset.id !== "undefined" ) {
                    eventId = event.delegateTarget.dataset.id;
                    removalIds.push(eventId);
                }

                this.parentSciMeta = this.getParentScienceMetadata(event);
                
                if(!this.parentSciMeta){
                	this.$(".status .icon, .status .progress").tooltip("hide").tooltip("destroy");
                	
                	// Remove the row
                    this.remove();
                    return;
                }

                this.collection = this.getParentDataPackage(event);
                                
                // Get the corresponding model
                if ( typeof eventId !== "undefined" ) {
                    dataONEObject = this.collection.get(eventId);
                }
                
                // Is it nested science metadata?
                if ( dataONEObject && dataONEObject.get("type") == "Metadata" ) {
                    
                    // We also remove the data documented by these metadata
                    documents = dataONEObject.get("documents");
                    
                    if ( documents.length > 0 ) {
                        _.each(documents, removalIds.push());
                    }
                }
                //Data objects may need to be removed from the EML model entities list
                else if(dataONEObject && this.parentSciMeta.type == "EML"){
                	
                	var matchingEntity = this.parentSciMeta.getEntity(dataONEObject);
                	
                	if(matchingEntity)
                		this.parentSciMeta.removeEntity(matchingEntity);
                		
                }
                
                // Remove the id from the documents array in the science metadata
                _.each(removalIds, function(id) {
                    var documents = this.parentSciMeta.get("documents");
                    var index = documents.indexOf(id);
                    if ( index > -1 ) {
                        this.parentSciMeta.get("documents").splice(index, 1);
                        
                    }
                }, this);
                
                // Remove each object from the collection
                this.collection.remove(removalIds);
                
                this.$(".status .icon, .status .progress").tooltip("hide").tooltip("destroy");
                
                // Remove the row
                this.remove();
                
                MetacatUI.rootDataPackage.packageModel.set("changed", true);
                
            },
            
            /* 
             * Return the parent science metadata model associated with the
             * data or metadata row of the UI event
             */
            getParentScienceMetadata: function(event) {
                var parentMetadata,  // The parent metadata array in the collection
                    eventModels,     // The models associated with the event's table row
                    eventModel,      // The model associated with the event's table row
                    parentSciMeta;   // The parent science metadata for the event model
                
                if ( typeof event.delegateTarget.dataset.id !== "undefined" ) {
                    eventModels = MetacatUI.rootDataPackage.where({
                        id: event.delegateTarget.dataset.id
                    });
                    
                    if ( eventModels.length > 0 ) {
                        eventModel = eventModels[0];
                        
                    } else {
                        console.log("The model of the event isn't in the root package.");
                        console.log("TODO: Check in nested packages.");
                        return;
                    }
                    
                    // Is this a Data or Metadata model?
                    if ( eventModel.get && eventModel.get("type") === "Metadata" ) {
                        return eventModel;
                        
                    } else {
                        // It's data, get the parent scimeta
                        parentMetadata = MetacatUI.rootDataPackage.where({
                            id: eventModel.get("isDocumentedBy")[0]
                        });
                        
                        if ( parentMetadata.length > 0 ) {
                            parentSciMeta = parentMetadata[0];
                            return parentSciMeta;
                            
                        } else {
                        	//If there is only one metadata model in the root data package, then use that metadata model
                        	var metadataModels = MetacatUI.rootDataPackage.where({
                                type: "Metadata"
                            });
                        	
                        	if(metadataModels.length == 1)
                        		return metadataModels[0];
                        	
                            console.log("The model of the event has no isDocumentedBy value.");
                            console.log("TODO: When parsing packages, ensure documents/isDocumentedBy values are present.");
                            
                        }
                    }
                }
            },
            
            /* 
             * Return the parent data package collection associated with the
             * data or metadata row of the UI event
             */
            getParentDataPackage: function(event) {
                var parentSciMeta,
                    parenResourceMaps,
                    parentResourceMapId;
                
                if ( typeof event.delegateTarget.dataset.id !== "undefined" ) {

                    parentSciMeta = this.getParentScienceMetadata(event);

                    if ( parentSciMeta.get && parentSciMeta.get("resourceMap").length > 0 ) {
                        parentResourceMaps = parentSciMeta.get("resourceMap");
                        
                        if ( ! MetacatUI.rootDataPackage.packageModel.get("latestVersion") ) {
                            // Decide how to handle this by calling model.findLatestVersion()
                            // and listen for the result, setting getParentDataPackage() as the callback?
                            console.log("In dataItemView.getParentDataPackage(), latestVersion is not set.");
                               
                        } else {
                            parentResourceMapId = MetacatUI.rootDataPackage.packageModel.get("latestVersion");
                            
                        }
                        
                    } else {
                        console.log("There is no resource map associated with the science metadata.");
                        
                    }
                    
                    // Is this the root package or a nested package?
                    if ( MetacatUI.rootDataPackage.packageModel.id === parentResourceMapId ) {
                        return MetacatUI.rootDataPackage;
                    
                    // A nested package    
                    } else {
                        return MetacatUI.rootDataPackage.where({id: parentResourceMapId})[0];
                        
                    }
                }
            },
            
            /*
             * Style this table row to indicate it will be removed
             */
            previewRemove: function(){
            	this.$el.toggleClass("remove-preview");
            },
            
            emptyName: function(e){
            	if(this.$(".name .required-icon").length)
            		this.$(".name").children().empty();
            },
            
            showValidation: function(attr, errorMsg){
				
            	//Find the element that is required
            	var requiredEl = this.$("[data-category='" + attr + "']").addClass("error");
				
            	//When it is updated, remove the error styling
				this.listenToOnce(this.model, "change:" + attr, this.hideRequired);
            },
            
            hideRequired: function(){

            	//Remove the error styling
				this.$(".error").removeClass("error");
            },
            
            /*
             * Show the data item as saving
             */
            showSaving: function(){
            	this.$("button").prop("disabled", true);
            	
            	if(this.model.get("type") != "Metadata")
            		this.$(".controls").prepend($(document.createElement("div")).addClass("disable-layer"));
            	
            	this.$(".name > div").prop("contenteditable", false);
            },
            
            hideSaving: function(){
            	this.$("button").prop("disabled", false);
            	this.$(".disable-layer").remove();
            	this.$(".name > div").prop("contenteditable", true);
            	this.$el.removeClass("error-saving");
            },
            
            toggleSaving: function(){
            	if(this.model.get("uploadStatus") == "p" || 
            			this.model.get("uploadStatus") == "l" ||
            			( this.model.get("uploadStatus") == "e" && this.model.get("type") != "Metadata") ||
            			MetacatUI.rootDataPackage.packageModel.get("uploadStatus") == "p")
            		this.showSaving();
            	else
            		this.hideSaving();
            	
            	if(this.model.get("uploadStatus") == "e")
            		this.$el.addClass("error-saving");
            },
            
            showUploadProgress: function(){
            	
            	if(this.model.get("numSaveAttempts") > 0){
            		this.$(".progress .bar").css("width", "100%");
            	}
            	else{
                	this.$(".progress .bar").css("width", this.model.get("uploadProgress") + "%");
            	}
            }
        });
        
        return DataItemView;
    });