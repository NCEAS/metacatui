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
                "click .remove"       : "handleRemove"      // Edit dropdown, remove sci{data,meta} from collection
            },
            
            /* Initialize the object - post constructor */
            initialize: function(options) {
                this.id = this.model.get("id");
                //this.id = this.generateId();
<<<<<<< HEAD
                this.listenTo(this.model, "change", this.render); // render changes to the item
=======
>>>>>>> 3a0e47db846a78fc14c1087adead2ad2a24c5d6d
                
            },
            
            /* Render the template into the DOM */
            render: function() {
                this.$el.attr("data-id", this.model.get("id"));
                this.$el.html( this.template(this.model.toJSON()) );
<<<<<<< HEAD
                this.$el.find(".dropdown-toggle").dropdown();
                
=======
                this.$el.find(".dropdown-toggle").dropdown("toggle");
                
                this.listenTo(this.model, 'change', this.render); // render changes to the item

>>>>>>> 3a0e47db846a78fc14c1087adead2ad2a24c5d6d
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
                    parentSciMetas,      // The list of science metadata (should be just 1)
                    parentSciMeta,       // The science metadata object for this row
                    parentResourceMaps,  // The id of the first resource of this row's scimeta
                    parentResourceMapId, // The id of the first resource of this row's scimeta
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
                
                console.log(event);

                // Find the correct collection to add to. Use JQuery's delegateTarget
                // attribute corresponding to the element where the event handler was attached
                if ( typeof event.delegateTarget.dataset.id !== "undefined" ) {
                    parentSciMetas = MetacatUI.rootDataPackage.where({
                        id: event.delegateTarget.dataset.id
                    });
                    
                    if ( parentSciMetas.length > 0 ) {
                        parentSciMeta = parentSciMetas[0];
                    }
                    
                    if ( parentSciMeta.get && parentSciMeta.get("resourceMap").length > 0 ) {
                        parentResourceMaps = parentSciMeta.get("resourceMap");
                        
                        if ( parentResourceMaps.length > 0 ) {
                            parentResourceMapId = parentResourceMaps[0];
                        }
                        
                    }
                    
                    // Is this the root package or a nested package?
                    if ( MetacatUI.rootDataPackage.packageModel.id === parentResourceMapId ) {
                        this.collection = MetacatUI.rootDataPackage;
                    
                    // A nested package    
                    } else {
                        this.collection = MetacatUI.rootDataPackage.where({id: parentResourceMapId})[0];
                    }
                }
                // For each file, create a DataONEObject and add it to the correct collection
                _.each(fileList, function(file) {
                    console.log("Processing " + file.name + ", size: " + file.size);
                    
                    dataONEObject = new DataONEObject({
                        type: "Data",
                        fileName: file.name,
                        size: file.size,
                        mediaType: file.type,
                        uploadFile: file
                    });
                    dataONEObject.bytesToSize();
                    this.collection.add(dataONEObject);
                }, this);
                
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
            
            /* Remove a file or folder */
            remove: function(event) {
                console.log("DataItemView.remove() called.");
                
            }
            
        });
        
        return DataItemView;
    });