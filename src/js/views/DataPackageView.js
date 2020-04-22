/* global define */
define([
    'jquery',
    'underscore',
    'backbone',
    'localforage',
    'collections/DataPackage',
    'models/DataONEObject',
    'models/metadata/ScienceMetadata',
    'models/metadata/eml211/EML211', 'views/DataItemView',
    'text!templates/dataPackage.html',
    'text!templates/dataPackageStart.html'],
    function($, _, Backbone, LocalForage, DataPackage, DataONEObject, ScienceMetadata, EML211, DataItemView,
    		DataPackageTemplate, DataPackageStartTemplate) {
        'use strict';

        /*
         *  The main view of a Data Package in the editor.  The view is
         *  a file/folder browser
         */
        var DataPackageView = Backbone.View.extend({

            tagName: "table",

            className: "table table-striped table-hover",

            id: "data-package-table",

            events: {
                "click .toggle-rows" 		   : "toggleRows", // Show/hide rows associated with event's metadata row
                "click .message-row .addFiles" : "handleAddFiles"
            },

            subviews: {},

            template: _.template(DataPackageTemplate),
            startMessageTemplate: _.template(DataPackageStartTemplate),

            // Models waiting for their parent folder to be rendered, hashed by parent id:
            // {'parentid': [model1, model2, ...]}
            delayedModels: {},

            /* Flag indicating the open or closed state of the package rows */
            isOpen: true,

            initialize: function(options) {
            	//Get the options sent to this view
            	if(typeof options == "object"){
            		//The edit option will allow the user to edit the table
            		this.edit = options.edit || false;

            		//The data package to render
            		this.dataPackage = options.dataPackage || new DataPackage();
            	}
            	//Create a new DataPackage collection if one wasn't sent
            	else if(!this.dataPackage){
            		this.dataPackage = new DataPackage();
            	}

                return this;

            },

            /*
             *  Render the DataPackage HTML
             */
            render: function() {
                this.$el.append(this.template({
                	loading: MetacatUI.appView.loadingTemplate({msg: "Loading files table... "}),
                	id: this.dataPackage.get("id")
                }));

                // Listen for  add events because models are being merged
                this.listenTo(this.dataPackage, 'add', this.addOne);
                this.listenTo(this.dataPackage, "fileAdded", this.addOne);

                // Render the current set of models in the DataPackage
                this.addAll();

                //If this is a new data package, then display a message and button
                if((this.dataPackage.length == 1 && this.dataPackage.models[0].isNew()) || !this.dataPackage.length){

                	var messageRow = this.startMessageTemplate();

                	this.$("tbody").append(messageRow);

                	this.listenTo(this.dataPackage, "add", function(){
                		this.$(".message-row").remove();
                	});
                }

                return this;
            },

            /*
             * Add a single DataItemView row to the DataPackageView
             */
            addOne: function(item) {
            	if(!item) return false;

                //Don't add duplicate rows
                if(this.$(".data-package-item[data-id='" + item.id + "']").length)
                	return;

                var dataItemView, scimetaParent, parentRow, delayed_models;

                if ( _.contains(Object.keys(this.subviews), item.id) ) {
                    return false; // Don't double render

                }

                dataItemView = new DataItemView({model: item});
                this.subviews[item.id] = dataItemView; // keep track of all views

                //Get the science metadata that documents this item
                scimetaParent = item.get("isDocumentedBy");

                //If this item is not documented by a science metadata object,
                // and there is only one science metadata doc in the package, then assume it is
                // documented by that science metadata doc
                if( typeof scimetaParent == "undefined" || !scimetaParent ){

                	//Get the science metadata models
                	var metadataIds = this.dataPackage.sciMetaPids;

                	//If there is only one science metadata model in the package, then use it
                	if( metadataIds.length == 1 )
                		scimetaParent = metadataIds[0];
                }
                //Otherwise, get the first science metadata doc that documents this object
                else{
                    scimetaParent = scimetaParent[0];
                }

                if((scimetaParent == item.get("id")) || (!scimetaParent && item.get("type") == "Metadata")) {
                	// This is a metadata folder row, append it to the table
                    this.$el.append(dataItemView.render().el);

                    // Render any delayed models if this is the parent
                    if ( _.contains(Object.keys(this.delayedModels), dataItemView.id) ) {

                        delayed_models = this.delayedModels[dataItemView.id];
                        _.each(delayed_models, this.addOne, this);

                    }
                }
                else{
                    // Find the parent row by it's id, stored in a custom attribute
                	if(scimetaParent)
                		parentRow = this.$("[data-id='" + scimetaParent + "']");

                    if ( typeof parentRow !== "undefined" && parentRow.length ) {
                        // This is a data row, insert below it's metadata parent folder
                        parentRow.after(dataItemView.render().el);

                        // Remove it from the delayedModels list if necessary
                        if ( _.contains(Object.keys(this.delayedModels), scimetaParent) ) {
                            delayed_models = this.delayedModels[scimetaParent];
                            var index = _.indexOf(delayed_models, item);
                            delayed_models = delayed_models.splice(index, 1);

                            // Put the shortened array back if delayed models remains
                            if ( delayed_models.length > 0 ) {
                                this.delayedModels[scimetaParent] = delayed_models;

                            } else {
                                this.delayedModels[scimetaParent] = undefined;

                            }
                        }

                        this.trigger("addOne");

                    } else {
                        console.log("Couldn't render " + item.id + ". Delayed until parent is rendered.");
                        // Postpone the data row until the parent is rendered
                        delayed_models = this.delayedModels[scimetaParent];

                        // Delay the model rendering if it isn't already delayed
                        if ( typeof delayed_models !== "undefined" ) {

                            if ( ! _.contains(delayed_models, item) ) {
                                delayed_models.push(item);
                                this.delayedModels[scimetaParent] = delayed_models;

                            }

                        } else {
                            delayed_models = [];
                            delayed_models.push(item);
                            this.delayedModels[scimetaParent] = delayed_models;
                        }
                    }

                }

            },

            /*
             * Add all rows to the DataPackageView
             */
            addAll: function() {
                this.$el.find('#data-package-table-body').html(''); // clear the table first
                this.dataPackage.sort();
                this.dataPackage.each(this.addOne, this);

            },

            /*
                Remove the subview represented by the given model item.

                @param item The model representing the sub view to be removed
            */
            removeOne: function(item) {
                if (_.contains(Object.keys(this.subviews), item.id)) {
                    // Remove the view and the its reference in the subviews list
                    this.subviews[item.id].remove();
                    delete this.subviews[item.id];

                }
            },

            handleAddFiles: function(e){
            	//Pass this on to the DataItemView for the root data package
            	this.$(".data-package-item.folder").first().data("view").handleAddFiles(e);
            },

            /*
             * Close subviews as needed
             */
            onClose: function() {
                // Close each subview
                _.each(Object.keys(this.subviews), function(id) {
    				var subview = this.subviews[id];
                    subview.onClose();

                }, this);

                //Reset the subviews from the view completely (by removing it from the prototype)
                this.__proto__.subviews = {};
            },

            /* Show or hide the data rows associated with the event row science metadata */
            toggleRows: function(event) {

                if ( this.isOpen ) {

                    // Get the DataItemView associated with each id
                    _.each(Object.keys(this.subviews), function(id) {

                        var subview = this.subviews[id];

                        if ( subview.model.get("type") === "Data" && subview.remove ) {
                            // Remove the view from the DOM
                            subview.remove();
                            // And from the subviews list
                            delete this.subviews[id];

                        }

                    }, this);

                    // And then close the folder
                    this.$el.find(".open")
                        .removeClass("open")
                        .addClass("closed")
                        .removeClass("icon-chevron-down")
                        .addClass("icon-chevron-right");

                    this.$el.find(".icon-folder-open")
                        .removeClass("icon-folder-open")
                        .addClass("icon-folder-close");

                    this.isOpen = false;

                } else {

                    // Add sub rows to the view
                    var dataModels =  this.dataPackage.where({type: "Data"});
                    _.each(dataModels, function(model) {
                            this.addOne(model);
                    }, this);

                    // And then open the folder
                    this.$el.find(".closed")
                        .removeClass("closed")
                        .addClass("open")
                        .removeClass("icon-folder-close")
                        .addClass("icon-chevron-down");

                    this.$el.find(".icon-folder-close")
                        .removeClass("icon-folder-close")
                        .addClass("icon-folder-open");

                    this.isOpen = true;

                }

                event.stopPropagation();
                event.preventDefault();
            },

        });
        return DataPackageView;
});
