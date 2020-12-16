/* global define */
define(['underscore', 'jquery', 'backbone', 'models/DataONEObject',
        'models/metadata/eml211/EML211', 'models/metadata/eml211/EMLOtherEntity',
        'text!templates/dataItem.html'],
    function(_, $, Backbone, DataONEObject, EML, EMLOtherEntity, DataItemTemplate){

        /**
        * @class DataItemView
        * @classdesc    A DataItemView represents a single data item in a data package as a single row of
            a nested table.  An item may represent a metadata object (as a folder), or a data
            object described by the metadata (as a file).  Every metadata DataItemView has a
            resource map associated with it that describes the relationships between the
            aggregated metadata and data objects.
        * @classcategory Views
        * @constructor
        */
        var DataItemView = Backbone.View.extend(
          /** @lends DataItemView.prototype */{

            tagName: "tr",

            className: "data-package-item",

            id: null,

            /* The HTML template for a data item */
            template: _.template(DataItemTemplate),

            /* Events this view listens to */
            events: {
                "focusout .name"       : "updateName",
                "click    .name"       : "emptyName",
                "click .duplicate"     : "duplicate",         // Edit dropdown, duplicate scimeta/rdf
                "click .addFolder"     : "handleAddFolder",   // Edit dropdown, add nested scimeta/rdf
                "click .addFiles"      : "handleAddFiles",    // Edit dropdown, open file picker dialog
                "change .file-upload"  : "addFiles",          // Adds the files into the collection
                "change .file-replace" : "replaceFile",       // Replace a file in the collection
                "dragover"             : "showDropzone",      // Drag & drop, show the dropzone for this row
                "dragend"              : "hideDropzone",      // Drag & drop, hide the dropzone for this row
                "dragleave"            : "hideDropzone",      // Drag & drop, hide the dropzone for this row
                "drop"                 : "addFiles",          // Drag & drop, adds the files into the collection
                "click .replaceFile"   : "handleReplace",     // Replace dropdown, data in collection
                "click .removeFiles"   : "handleRemove",      // Edit dropdown, remove sci{data,meta} from collection
                "click .cancel"        : "handleCancel",      // Cancel a file load
                "change: percentLoaded": "updateLoadProgress", // Update the file read progress bar
                "mouseover .remove"    : "previewRemove",
                "mouseout  .remove"    : "previewRemove",
                "change .public"       : "changeAccessPolicy"
            },

            /* Initialize the object - post constructor */
            initialize: function(options) {
            	if(typeof options == "undefined") var options = {};

                this.model = options.model || new DataONEObject();
                this.id = this.model.get("id");
                this.canReplace = false; // Default. Updated in render()
            },

            /* Render the template into the DOM */
            render: function(model) {

            	//Prevent duplicate listeners
            	this.stopListening();

              // Set the data-id for identifying events to model ids
              this.$el.attr("data-id", this.model.get("id"));
              this.$el.attr("data-category", "entities-" + this.model.get("id"));

                //Destroy the old tooltip
                this.$(".status .icon, .status .progress").tooltip("hide").tooltip("destroy");

                var attributes = this.model.toJSON();

                //Format the title
                if(Array.isArray(attributes.title))
                	attributes.title  = attributes.title[0];

                //Set some defaults
                attributes.numAttributes = 0;
                attributes.entityIsValid = true;
                attributes.hasInvalidAttribute = false;

                // Restrict item replacement depending on access
                //
                // Note: .canReplace is set here (at render) instead of at init
                // because render will get called a few times during page load
                // as the app updates what it knows about the object
                this.canReplace = this.model.get("accessPolicy") &&
                    this.model.get("accessPolicy").isAuthorized("write");
                attributes.canReplace = this.canReplace; // Copy to template

                //Get the number of attributes for this item
                if(this.model.type != "EML"){

	                //Get the parent EML model
                	if( this.parentEML ){
                		var parentEML = this.parentEML;
                	}
                	else{
                		var parentEML = MetacatUI.rootDataPackage.where({
	                    	id: Array.isArray(this.model.get("isDocumentedBy")) ?
	                    			this.model.get("isDocumentedBy")[0] : null
	                	});
                	}

	                if( Array.isArray(parentEML) )
	                	parentEML = parentEML[0];

	                //If we found a parent EML model
	                if(parentEML && parentEML.type == "EML"){

	                	this.parentEML = parentEML;

	                	//Find the EMLEntity model for this data item
	                	var entity = this.model.get("metadataEntity") || parentEML.getEntity(this.model);

	                	//If we found an EMLEntity model
	                	if(entity){

	                		this.entity = entity;

	                		//Get the file name from the metadata if it is not in the model
	                		if( !this.model.get("fileName") ){

	                			var fileName = "";

	                			if( entity.get("physicalObjectName") )
	                				fileName = entity.get("physicalObjectName");
	                			else if( entity.get("entityName") )
	                				fileName = entity.get("entityName");

	                			if( fileName )
	                				attributes.fileName = fileName;
	                				this.model.set("fileName", fileName);
	                		}

	                		//Get the number of attributes for this entity
	                		attributes.numAttributes = entity.get("attributeList").length;
	                		//Determine if the entity model is valid
	                		attributes.entityIsValid = entity.isValid();

                      //Listen to changes to certain attributes of this EMLEntity model
                      // to re-render this view
                      this.stopListening(entity);
                      this.listenTo(entity, "change:entityType, change:entityName", this.render);

	                		//Check if there are any invalid attribute models
	                		//Also listen to each attribute model
                			_.each( entity.get("attributeList"), function(attr){

                				var isValid = attr.isValid();

                				//Mark that this entity has at least one invalid attribute
	                			if( !attributes.hasInvalidAttribute && !isValid )
	                				attributes.hasInvalidAttribute = true;

	                			this.stopListening(attr);

	                			//Listen to when the validation status changes and rerender
	                			if(isValid)
	                				this.listenTo( attr, "invalid", this.render);
	                			else
	                				this.listenTo( attr, "valid",   this.render);


	                		}, this);

	                		//If there are no attributes now, rerender when one is added
	                		this.listenTo(entity, "change:attributeList", this.render);

	                	}
	                	else{
	                		//Rerender when an entity is added
	                		this.listenTo(this.model, "change:entities", this.render);
	                	}
	                }
	                else{
	                	//When the package is complete, rerender
	                	this.listenTo(MetacatUI.rootDataPackage, "add:EML", this.render);
	                }
                }

                this.$el.html( this.template(attributes) );

                //Initialize dropdowns
                this.$el.find(".dropdown-toggle").dropdown();

                //Get the AccessPolicy for this object
                var accessPolicy = this.model.get("accessPolicy"),
                    publicPrivateToggle = this.$(".publicprivatetoggle"),
                    checkbox = this.$(".publicprivatetoggle input"),
                    shareButtonContainer = this.$(".sharing > div"),
                    shareButton = this.$(".sharing button");

                //Check the public/private toggle if this object is private
                if( accessPolicy && accessPolicy.isPublic() ){
                  checkbox.prop("checked", true);
                }

                if(this.model.get("type") == "Metadata"){
                  //Add the title data-attribute attribute to the name cell
                	this.$el.find(".name").attr("data-attribute", "title");
                	this.$el.addClass("folder");
                }
                else{
                    this.$el.addClass("data");
                }

                // Set up tooltips for the public private toggle and share
                // button
                var publicPrivateToggleTitle,
                    sharebuttonTitle;

                  // If the user is not authorized to change the permissions of
                  // this object, then disable the checkbox
                  if (!accessPolicy.isAuthorized("changePermission")) {
                    publicPrivateToggle.addClass("disabled");
                    checkbox.prop("disabled", true);
                    shareButton.addClass("disabled");

                    publicPrivateToggleTitle = "You are not authorized to edit the privacy of this item.";
                    sharebuttonTitle = "You are not authorized to share this item."
                  } else {
                    publicPrivateToggleTitle = "Toggle whether this item is publicly viewable",
                    sharebuttonTitle = "Share this item with others";
                  }

                  publicPrivateToggle.tooltip({
                    title: publicPrivateToggleTitle,
                    placement: "top",
                    container: this.el,
                    trigger: "hover",
                    delay: { show: 400 }
                  });

                  shareButtonContainer.tooltip({
                    title: sharebuttonTitle,
                    placement: "top",
                    container: this.el,
                    trigger: "hover",
                    delay: { show: 400 }
                  });

                // Add tooltip to a disabled Replace link
                $(this.$el).find(".replace.disabled").tooltip({
                    title: "You don't have sufficient privileges to replace this item.",
                    placement: "left",
                    trigger: "hover",
                    delay: { show: 400 },
                    container: "body"
                  });

                //Check if the data package is in progress of being uploaded
                this.toggleSaving();

                //Create tooltips based on the upload status
                if(this.model.get("uploadStatus") == "e" && this.model.get("errorMessage")){
                	var errorMsg = this.model.get("errorMessage");

                	this.$(".status .icon").tooltip({
                		placement: "top",
                		trigger: "hover",
                		html: true,
                		title: "<div class='status-tooltip error'><h6>Error saving:</h6><div>" + errorMsg + "</div></div>",
                		container: "body"
                	});

                	this.$el.removeClass("loading");
                }
                else if (( !this.model.get("uploadStatus") || this.model.get("uploadStatus") == "c" || this.model.get("uploadStatus") == "q") && attributes.numAttributes == 0){

                	this.$(".status .icon").tooltip({
                		placement: "top",
                		trigger: "hover",
                		html: true,
                		title: "<div class='status-tooltip'>This file needs to be described - Click 'Describe'</div>",
                		container: "body"
                	});

            		this.$el.removeClass("loading");

            	}
                else if( attributes.hasInvalidAttribute || !attributes.entityIsValid ){

                	this.$(".status .icon").tooltip({
                		placement: "top",
                		trigger: "hover",
                		html: true,
                		title: "<div class='status-tooltip'>There is missing information about this file. Click 'Describe'</div>",
                		container: "body"
                	});

                	this.$el.removeClass("loading");

                }
                else if(this.model.get("uploadStatus") == "c"){

            		this.$(".status .icon").tooltip({
                		placement: "top",
                		trigger: "hover",
                		html: true,
                		title: "<div class='status-tooltip'>Complete</div>",
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
                				return "<div class='status-tooltip'>Something went wrong during upload. <br/> Trying again... (attempt " + (model.get("numSaveAttempts") + 1) + " of 3)</div>";
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

            /**
             * Update the folder name based on the scimeta title
             *
             * @param e The event triggering this method
             */
            updateName: function(e) {

                var enteredText = this.cleanInput($(e.target).text().trim());

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
                        enteredText !== "Untitled dataset") {
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

                    // Reset sysMetaUploadStatus only if this item doesn't
                    // have content changes. This is here because replaceFile
                    // sets sysMetaUploadStatus to "c" to prevent the editor
                    // from updating sysmeta after the update call
                    if (!this.model.get("hasContentChanges")) {
                        this.model.set("sysMetaUploadStatus", null);
                    }
                }
            },

            /* Duplicate a file or folder */
            duplicate: function(event) {

            },

            /* Add a sub folder */
            addFolder: function(event) {

            },

            /*
                Handle the add file event, showing the file picker dialog
                Multiple files are allowed using the shift and or option/alt key
            */
            handleAddFiles: function(event) {

                event.stopPropagation();
                var fileUploadElement = this.$(".file-upload");

                fileUploadElement.val("");

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

                var fileList,            // The list of chosen files
                    parentDataPackage,   // The id of the first resource of this row's scimeta
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

                        var uploadStatus = "l",
                            errorMessage = "";

                        if( file.size == 0 ){
                          uploadStatus = "e";
                          errorMessage = "This is an empty file. It won't be included in the dataset.";
                        }

                        var dataONEObject = new DataONEObject({
                            synced: true,
                            type: "Data",
                            fileName: file.name,
                            size: file.size,
                            mediaType: file.type,
                            uploadFile: file,
                            uploadStatus: uploadStatus,
                            errorMessage: errorMessage,
                            isDocumentedBy: [this.parentSciMeta.id],
                            resourceMap: [this.collection.packageModel.id]
                        });
                        // Add it to the parent collection
                        this.collection.add(dataONEObject);

                        // Asychronously calculate the checksum
                        if ( dataONEObject.get("uploadFile") && ! dataONEObject.get("checksum") ) {
                            dataONEObject.stopListening(dataONEObject, "checksumCalculated");
                            dataONEObject.listenToOnce(dataONEObject, "checksumCalculated", dataONEObject.save);
                            try {
                                dataONEObject.calculateChecksum();
                            } catch (exception) {
                                // TODO: Fail gracefully here for the user
                            }
                        }


                    }, this);

                }

            },

            /* During file reading, update the progress bar */
            updateLoadProgress: function(event) {

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

            /**
             * Handle the user's click of the Replace item in the DataItemView
             * dropdown. Triggers replaceFile after some basic validation.
             *
             * Called indirectly via the "click" event on elements with the
             * class .replaceFile. See this View's events map.
             *
             * @param {MouseEvent} event: Browser Click event
             */
            handleReplace: function(event) {
                event.stopPropagation();

                // Stop immediately if we know the user doesn't have privs
                if (!this.canReplace) {
                    event.preventDefault();
                    return;
                }

                var fileReplaceElement = $(event.target)
                    .parents(".dropdown-menu")
                    .children(".file-replace")

                if (!fileReplaceElement) {
                    console.log("Unable to find Replace file picker.");

                    return;
                }

                fileReplaceElement.val("");
                fileReplaceElement.trigger("click");

                event.preventDefault();
            },

            /**
             * Replace a file (DataONEObject) in the collection with another one
             * from a file picker. Maintains attributes on the original
             * DataONEObject and maintains the entity information in the parent
             * collection's metadata record (i.e., keeps your attributes, etc.).
             *
             * Called indirectly via the "change" event on elements with the
             * class .file-upload. See this View's events map.
             *
             * The bulk of the work is done in a try-catch block to catch
             * mistakes that would cause the editor to get into a broken state.
             * On error, we attempt to return the editor back to its pre-replace
             * state.
             *
             * @param {Event}
             */
            replaceFile: function(event) {
                event.stopPropagation();
                event.preventDefault();

                if (!this.canReplace) {
                    return;
                }

                var fileList = event.target.files;

                // Pre-check fileList value to make sure we can work with it
                if (fileList.length != 1) {
                    // TODO: Show error, find out how to do this
                    return;
                }

                if (typeof event.delegateTarget.dataset.id === "undefined") {
                    // TODO: Show error, find out how to do this
                    return;
                }

                // Save uploadStatus for reverting if need to
                var oldUploadStatus = this.model.get("uploadStatus");

                var file = fileList[0],
                    uploadStatus = "q",
                    errorMessage = "";

                if (file.size == 0 ) {
                    uploadStatus = "e";
                    errorMessage = "This is an empty file. It won't be included in the dataset.";
                }

				if (!this.model) {
                    console.log("Couldn't find model we're supposed to be replacing. Stopping.");

					return;
				}

                // Copy model attributes aside for reverting on error
                var newAttributes = {
                    synced: false,
                    fileName: file.name,
                    size: file.size,
                    mediaType: file.type,
                    uploadFile: file,
                    hasContentChanges: true,
                    checksum: null,
                    uploadStatus: uploadStatus,
                    sysMetaUploadStatus: "c", // I set this so DataPackage::save
                    // wouldn't try to update the sysmeta after the update
                    errorMessage: errorMessage
                };

                // Save a copy of the attributes we're changing so we can revert
                // later if we encounter an exception
                var oldAttributes = {};
                _.each(Object.keys(newAttributes), function(k) {
                    oldAttributes[k] = _.clone(this.model.get(k));
                }, this);

                oldAttributes["uploadStatus"] = oldUploadStatus;

                try {

                    this.model.set(newAttributes);

                    // Attempt the formatId. Defaults to app/octet-stream
                    this.model.set("formatId", this.model.getFormatId());

                    // Grab a reference to the entity in the EML for the object
                    // we're replacing
                    this.parentSciMeta = this.getParentScienceMetadata(event);
                    var entity = null;

                    if (this.parentSciMeta) {
                        entity = this.parentSciMeta.getEntity(this.model);
                    }

                    // Eagerly update the PID for this object so we can update
                    // the matching EML entity
                    this.model.updateID();

                    // Update the EML entity with the new id
                    if (entity) {
                        entity.set("xmlID", this.model.getXMLSafeID());
                    }

                    this.render();

                    if (this.model.get("uploadFile") && !this.model.get("checksum")) {

                        try {
                            this.model.calculateChecksum();
                        } catch (exception) {
                            // TODO: Fail gracefully here for the user
                        }
                    }

                    MetacatUI.rootDataPackage.packageModel.set("changed", true);

                    // Last, provided a visual indication the replace was completed
                    var describeButton = this.$el
                        .children(".controls")
                        .children(".btn-group")
                        .children("button.edit")
                        .first();

                    if (describeButton.length != 1) {
                        return;
                    }

                    var oldText = describeButton.html();

                    describeButton.html('<i class="icon icon-ok success" /> Replaced');

                    var previousBtnClasses = describeButton.attr("class");
                    describeButton.removeClass("warning error").addClass("message");

                    window.setTimeout(function() {
                        describeButton.html(oldText);
                        describeButton.addClass(previousBtnClasses).removeClass("message");
                    }, 3000);
                } catch (error) {
                    console.log("Error replacing: ", error);

                    // Revert changes to the attributes
                    this.model.set(oldAttributes);
                    this.model.set("formatId", this.model.getFormatId());
                    this.model.set("sysMetaUploadStatus", "c"); // Prevents a sysmeta update
                    this.model.resetID();

                    this.render();
                }

                return;
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
                        return;
                    }

                    // Is this a Data or Metadata model?
                    if ( eventModel.get && eventModel.get("type") === "Metadata" ) {
                        return eventModel;

                    } else {
                        // It's data, get the parent scimeta
                        parentMetadata = MetacatUI.rootDataPackage.where({
                            id: Array.isArray(eventModel.get("isDocumentedBy"))? eventModel.get("isDocumentedBy")[0] : null
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

            cleanInput: function(input){
            	// 1. remove line breaks / Mso classes
      				var stringStripper = /(\n|\r| class=(")?Mso[a-zA-Z]+(")?)/g;
      				var output = input.replace(stringStripper, ' ');

      				// 2. strip Word generated HTML comments
      				var commentSripper = new RegExp('<!--(.*?)-->','g');
      				output = output.replace(commentSripper, '');
      				var tagStripper = new RegExp('<(/)*(meta|link|span|\\?xml:|st1:|o:|font)(.*?)>','gi');

      				// 3. remove tags leave content if any
      				output = output.replace(tagStripper, '');

      				// 4. Remove everything in between and including tags '<style(.)style(.)>'
      				var badTags = ['style', 'script','applet','embed','noframes','noscript'];

      				for (var i=0; i< badTags.length; i++) {
      				  tagStripper = new RegExp('<'+badTags[i]+'.*?'+badTags[i]+'(.*?)>', 'gi');
      				  output = output.replace(tagStripper, '');
      				}

      				// 5. remove attributes ' style="..."'
      				var badAttributes = ['style', 'start'];
      				for (var i=0; i< badAttributes.length; i++) {
      				  var attributeStripper = new RegExp(' ' + badAttributes[i] + '="(.*?)"','gi');
      				  output = output.replace(attributeStripper, '');
      				}

              output = EML.prototype.cleanXMLText(output);

      				return output;
            },

            /*
             * Style this table row to indicate it will be removed
             */
            previewRemove: function(){
            	this.$el.toggleClass("remove-preview");
            },
            /**
             * Clears the text in the cell if the text was the default. We add
             * an 'empty' class, and remove it when the user focuses back out.
             *
             */
            emptyName: function(e){

            	var editableCell = this.$(".name [contenteditable]");

            	if(editableCell.text().indexOf("Untitled") > -1){
            		editableCell.attr("data-original-text", editableCell.text().trim())
            					.text("")
            					.addClass("empty")
            					.on("focusout", function(){
            						if(!editableCell.text())
            							editableCell.text(editableCell.attr("data-original-text")).removeClass("empty");
            					});
            	}
            },

            /*
            * Changes the access policy of a data object based on user input.
            *
            * @param {HTML DOM Event} e - The event that triggered this function as a callback
            */
            changeAccessPolicy: function(e){

              if( typeof e === "undefined" || !e )
                return;

              var accessPolicy = this.model.get("accessPolicy");

              var makePublic = $(e.target).prop("checked");

              //If the user has chosen to make this object private
              if(!makePublic){
                if( accessPolicy ){
                  //Make the access policy private
                  accessPolicy.makePrivate();
                }
                else{
                  //Create an access policy from the default settings
                  this.model.createAccessPolicy();
                  //Make the access policy private
                  this.model.get("accessPolicy").makePrivate();
                }

              }
              else{
                if( accessPolicy ){
                  //Make the access policy public
                  accessPolicy.makePublic();
                }
                else{
                  //Create an access policy from the default settings
                  this.model.createAccessPolicy();
                  //Make the access policy public
                  this.model.get("accessPolicy").makePublic();
                }
              }

              //Close the tooltips
              this.$(".publicprivatetoggle").tooltip("hide");

            },

            showValidation: function(attr, errorMsg){

            	//Find the element that is required
            	var requiredEl = this.$("[data-category='" + attr + "']").addClass("error");

            	//When it is updated, remove the error styling
				this.listenToOnce(this.model, "change:" + attr, this.hideRequired);
            },

            hideRequired: function(){

            	//Remove the error styling
				this.$("[contenteditable].error").removeClass("error");
            },

            /*
             * Show the data item as saving
             */
            showSaving: function(){
            	this.$(".controls button").prop("disabled", true);

            	if(this.model.get("type") != "Metadata")
            		this.$(".controls").prepend($(document.createElement("div")).addClass("disable-layer"));

            	this.$(".name > div").prop("contenteditable", false);
            },

            hideSaving: function(){
            	this.$(".controls button").prop("disabled", false);
            	this.$(".disable-layer").remove();

            	//Make the name cell editable again
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
