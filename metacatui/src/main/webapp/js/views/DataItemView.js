/* global define */
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
            
            id: null,
            
            /* The HTML template for a data item */
            template: _.template(DataItemTemplate),
            
            /* Events this view listens to */
            events: {
                "focusout .name"      : "updateName",
                /* "click .rename"    : "rename", */
                "click .duplicate"    : "duplicate",        // Edit dropdown, duplicate scimeta/rdf
                "click .addFolder"    : "handleAddFolder",  // Edit dropdown, add nested scimeta/rdf
                "click .addFiles"     : "handleAddFiles",   // Edit dropdown, open file picker dialog
                "change .file-upload" : "addFiles",         // Adds the files into the collection
                "dragover"            : "showDropzone",     // Drag & drop, show the dropzone for this row
                "dragend"             : "hideDropzone",     // Drag & drop, hide the dropzone for this row
                "dragleave"           : "hideDropzone",     // Drag & drop, hide the dropzone for this row
                "drop"                : "addFiles",         // Drag & drop, adds the files into the collection
                "click .removeFiles"  : "handleRemove"      // Edit dropdown, remove sci{data,meta} from collection
            },
            
            /* Initialize the object - post constructor */
            initialize: function(options) {
                this.id = this.model.get("id");
                
            },
            
            /* Render the template into the DOM */
            render: function() {
            	//Reset all the listeners
            	this.stopListening();
            	
                this.$el.attr("data-id", this.model.get("id"));
                this.$el.html( this.template(this.model.toJSON()) );
                this.$el.find(".dropdown-toggle").dropdown();
                
                //listen for changes to rerender the view
                this.listenTo(this.model, 'change', this.render); // render changes to the item

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
            updateName: function(e){
            	if(this.model.get("type") == "Metadata")
            		this.model.set("title", $(e.target).text().trim());
            	else
            		this.model.set("fileName", $(e.target).text().trim());
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
                    dataONEObject;       // The dataONEObject to represent this file
                
                event.stopPropagation();
                // handle drag and drop files
                if ( typeof event.originalEvent.dataTransfer !== "undefined" ) {
                    fileList = event.originalEvent.dataTransfer.files;
                    
                // handle file picker files    
                } else {
                    if ( event.target ) {
                        fileList = event.target.files;
                    }
                    
                }
                event.preventDefault();
                this.$el.removeClass("droppable");
                
                // Find the correct collection to add to. Use JQuery's delegateTarget
                // attribute corresponding to the element where the event handler was attached
                if ( typeof event.delegateTarget.dataset.id !== "undefined" ) {
                    this.parentSciMeta = this.getParentScienceMetadata(event);
                    this.collection = this.getParentDataPackage(event);
                    
                    // For each file, create a DataONEObject and add it to the correct collection
                    _.each(fileList, function(file) {
                        // console.log("Processing " + file.name + ", size: " + file.size);
                        
                        dataONEObject = new DataONEObject({
                            type: "Data",
                            fileName: file.name,
                            size: file.size,
                            mediaType: file.type,
                            uploadFile: file,
                            isDocumentedBy: [this.parentSciMeta.id],
                            resourceMap: [this.collection.packageModel.id]
                        });
                        this.parentSciMeta.get("documents").push(dataONEObject.id);
                        dataONEObject.bytesToSize();
                        this.collection.add(dataONEObject);
                        dataONEObject.set("uploadStatus", "q");
                    }, this);
                }
                
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
                this.$el.find(".dropdown-menu").dropdown("toggle"); // close the menu
                
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
                event.preventDefault();
                
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
                    if ( eventModel.get("type") === "Metadata" ) {
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
                        
                    }
                    
                    // Is this the root package or a nested package?
                    if ( MetacatUI.rootDataPackage.packageModel.id === parentResourceMapId ) {
                        return MetacatUI.rootDataPackage;
                    
                    // A nested package    
                    } else {
                        return MetacatUI.rootDataPackage.where({id: parentResourceMapId})[0];
                        
                    }
                }
            }
        });
        
        return DataItemView;
    });