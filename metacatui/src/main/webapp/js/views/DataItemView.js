﻿/* global define */
define(['underscore', 'jquery', 'backbone', 'models/DataONEObject', 'text!templates/dataItem.html'], 
    function(_, $, Backbone, DataONEObject, DataItemTemplate){
        
        /* 
            A DataITemView represents a single data item in a data package as a single row of 
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
                "mouseover .remove"    : "showRemove",
                "mouseout  .remove"    : "hideRemove"
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
                
                var attributes = this.model.toJSON();
                
                //Format the title
                if(Array.isArray(attributes.title))
                	attributes.title  = attributes.title[0];
                
                this.$el.html( this.template(attributes) );
                this.$el.find(".dropdown-toggle").dropdown();
                
                //listen for changes to rerender the view
                this.listenTo(this.model, "change:fileName change:title change:id change:formatType " + 
                		"change:formatId change:type change:resourceMap change:documents change:isDocumentedBy " +
                		"change:size change:nodeLevel", this.render); // render changes to the item

                var view = this;
                this.listenTo(this.model, "replace", function(newModel){
                	view.model = newModel;
                	view.render();
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
                        
                        var reader = new FileReader();
                        dataONEObject = new DataONEObject({
                            synced: true,
                            type: "Data",
                            fileName: file.name,
                            size: file.size,
                            mediaType: file.type,
                            uploadFile: file,
                            uploadReader: reader,
                            isDocumentedBy: [this.parentSciMeta.id],
                            resourceMap: [this.collection.packageModel.id]
                        });
                        
                        // Append to or create a new documents list
                        if ( typeof this.parentSciMeta.get("documents") === "undefined" ) {
                            this.parentSciMeta.set("documents", [dataONEObject.id]);
                            
                        } else {
                            this.parentSciMeta.get("documents").push(dataONEObject.id);
                            
                        }
                        this.parentSciMeta.set("uploadStatus", "q");
                        dataONEObject.bytesToSize();
                        this.collection.add(dataONEObject);
                        
                        // Set up the reader event handlers and
                        // pass the event *and* the dataONEObject to the handlers
                        reader.onprogress = function(event) {
                            self.handleLoadProgress(event, dataONEObject);
                        }
                        
                        reader.onerror = function(event) {
                            self.handleLoadError(event, dataONEObject);
                        }
                        
                        reader.onload = function(event) {
                            self.handleLoadSuccess(event, dataONEObject);
                        }
                        
                        reader.onabort = function(event) {
                            self.handleLoadAbort(event, dataONEObject);
                        }
                        
                        // Now initiate the file read
                        reader.readAsArrayBuffer(file);
                        
                    }, this);
                    
                    MetacatUI.rootDataPackage.packageModel.set("changed", true);
                }
                
            },
            
            /* During file reading, handle the user's cancel request */
            handleCancel: function(event) {
                // TODO: enable canceling of the file read from disk
                // Need to get a reference to the FileReader to call abort
                // 
                // dataONEObject.uploadReader.abort(); ?
                
            },
            
            /* During file reading, deal with abort events */
            handleLoadAbort: function(event, dataONEObject) {
                // When file reading is aborted, update the model upload status
                
            },
            
            /* During file reading, deal with read errors */ 
            handleLoadError: function(event, dataONEObject) {
                // On error, update the model upload status
            },
            
            /* During file reading, update the import progress in the model */
            handleLoadProgress: function(event, dataONEObject) {
                // event is a ProgressEvent - use it to update the import progress bar
                
                if ( event.lengthComputable ) {
                    var percentLoaded = Math.round((event.loaded/event.total) * 100);
                    dataONEObject.set("percentLoaded", percentLoaded);
                }
            },
            
            /* During file reading, update the progress bar */
            updateLoadProgress: function(event) {
                console.log(event);
                
                // TODO: Update the progress bar
                
            },
            
            /* During file reading, handle a successful read */
            handleLoadSuccess: function(event, dataONEObject) {
                // event.target.result has the file object bytes
                
                // Make the DataONEObject for the file, add it to the collection
                var checksum = md5(event.target.result);
                dataONEObject.set("checksum", checksum);
                dataONEObject.set("checksumAlgorithm", "MD5");
                dataONEObject.set("uploadStatus", "q"); // set status to queued
                delete event; // Let large files be garbage collected
                
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
                console.log("DataItemView.remove() called.");
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
                        
                        if ( parentResourceMaps.length > 0 ) {
                            parentResourceMapId = parentResourceMaps[0];
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
             * STyle this table row to indicate it will be removed
             */
            showRemove: function(){
            	this.$el.addClass("remove-highlight");
            },
            
            /*
             * Remove the styling on this table row that indicates it will be removed
             */
            hideRemove: function(){
            	this.$el.removeClass("remove-highlight");
            }
        });
        
        return DataItemView;
    });