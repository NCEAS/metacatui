/* global define */
define([
    'jquery',
    'underscore',
    'backbone',
    'localforage',
    'collections/DataPackage',
    'models/DataONEObject',
    'models/PackageModel',
    'models/metadata/ScienceMetadata',
    'models/metadata/eml211/EML211',
    'models/PackageModel',
    'views/DataItemView',
    'text!templates/dataPackage.html',
    'text!templates/dataPackageStart.html',
    'text!templates/dataPackageHeader.html'],
    function($, _, Backbone, LocalForage, DataPackage, DataONEObject, PackageModel, ScienceMetadata, EML211, Package, DataItemView,
    		DataPackageTemplate, DataPackageStartTemplate, DataPackageHeaderTemplate) {
        'use strict';

        /**
         * @class DataPackageView
         * @classdesc The main view of a Data Package in MetacatUI.  The view is
         *  a file/folder browser
         * @classcategory Views
         * @screenshot views/DataPackageView.png
         */
        var DataPackageView = Backbone.View.extend(
          /** @lends DataPackageView.prototype */{

            type: "DataPackage",

            tagName: "table",

            className: "table table-striped table-hover",

            id: "data-package-table",

            events: {
                "click .toggle-rows" 		   : "toggleRows", // Show/hide rows associated with event's metadata row
                "click .message-row .addFiles" : "handleAddFiles",
                "click .expand-control"   : "expand",
			    "click .collapse-control" : "collapse",
                "click .d1package-expand"   : "expandAll",
			    "click .d1package-collapse" : "collapseAll"
            },

            subviews: {},

            /**
            * A reference to the parent EditorView that contains this view
            * @type EditorView
            * @since 2.15.0
            */
            parentEditorView: null,

            template: _.template(DataPackageTemplate),
            startMessageTemplate: _.template(DataPackageStartTemplate),
            dataPackageHeaderTemplate: _.template(DataPackageHeaderTemplate),

            // Models waiting for their parent folder to be rendered, hashed by parent id:
            // {'parentid': [model1, model2, ...]}
            delayedModels: {},

            /* Flag indicating the open or closed state of the package rows */
            isOpen: true,

            initialize: function(options) {
                if((options === undefined) || (!options)) var options = {};

                if (!options.edit) {
                    //The edit option will allow the user to edit the table
                    this.edit = options.edit || false;
                    this.mode = "view";
                    this.packageId  = options.packageId	 || null;
                    this.memberId	= options.memberId	 || null;
                    this.attributes = options.attributes || null;
                    this.dataPackage = options.dataPackage || new DataPackage();
                    this.disablePackageDownloads = options.disablePackageDownloads || false;
                    this.currentlyViewing = options.currentlyViewing || null;
                    this.parentEditorView = options.parentView || null;
                    this.title = options.title || "";
                    this.packageTitle = options.packageTitle || "";
                    this.nested = (typeof options.nested === "undefined")? false : options.nested;

                    // set the package model
                    this.packageModel = this.dataPackage.packageModel;
                    this.listenTo(this.packageModel, "changeAll", this.render);
                }
                else {
                    //Get the options sent to this view
                    if(typeof options == "object"){
                        //The edit option will allow the user to edit the table
                        this.edit = options.edit || false;
                        this.mode = "edit";

                        //The data package to render
                        this.dataPackage = options.dataPackage || new DataPackage();

                        this.parentEditorView = options.parentEditorView || null;
                    }
                    //Create a new DataPackage collection if one wasn't sent
                    else if(!this.dataPackage){
                        this.dataPackage = new DataPackage();
                    }

                    return this;
                }
            },

            /**
             *  Render the DataPackage HTML
             */
            render: function() {
                this.$el.addClass("download-contents table-condensed");
                this.$el.append(this.template({
                    edit: this.edit,
                    dataPackageFiltering: MetacatUI.appModel.get("dataPackageFiltering") || "false",
                    dataPackageSorting: MetacatUI.appModel.get("dataPackageSorting") || "false",
                	loading: MetacatUI.appView.loadingTemplate({msg: "Loading files table... "}),
                	id: this.dataPackage.get("id"),
                    title   : this.title || "Files in this dataset",
                    classes: "download-contents table-striped table-condensed table",
                }));

                if (this.edit) {
                    // Listen for  add events because models are being merged
                    this.listenTo(this.dataPackage, 'add', this.addOne);
                    this.listenTo(this.dataPackage, "fileAdded", this.addOne);
                }

                // Render the current set of models in the DataPackage
                this.addAll();

                if (this.edit) {
                    //If this is a new data package, then display a message and button
                    if((this.dataPackage.length == 1 && this.dataPackage.models[0].isNew()) || !this.dataPackage.length){

                        var messageRow = this.startMessageTemplate();

                        this.$("tbody").append(messageRow);

                        this.listenTo(this.dataPackage, "add", function(){
                            this.$(".message-row").remove();
                        });
                    }

                    //Render the Share control(s)
                    this.renderShareControl();
                }
                else {
                    // check for nessted datasets

                    if (this.nested) {
                        this.getNestedPackages();
                    }
                }

                return this;
            },

            /**
             * Add a single DataItemView row to the DataPackageView
             */
            addOne: function(item) {
            	if(!item) return false;

                //Don't add duplicate rows
                if(this.$(".data-package-item[data-id='" + item.id + "']").length)
                	return;

                // Don't add data package
                if ((item.get("formatType") == "RESOURCE") || (item.get("type") == "DataPackage")) {
                    return;
                }

                var dataItemView, scimetaParent, parentRow, delayed_models;

                if ( _.contains(Object.keys(this.subviews), item.id) ) {
                    return false; // Don't double render

                }

                var itemPath = null;
                if (!(_.isEmpty(this.atLocationObj))) {
                    itemPath = this.atLocationObj[item.get("id")];
                }

                dataItemView = new DataItemView({
                    model: item,
                    memberRowMetrics: this.getMemberRowMetrics(item.get("id"), item.get("formatType")),
                    itemPath: itemPath,
                    currentlyViewing: this.currentlyViewing,
                    mode: this.mode,
                    parentEditorView: this.parentEditorView,
                    dataPackageId: this.dataPackage.id
                });
                this.subviews[item.id] = dataItemView; // keep track of all views

                if (this.edit) {
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
                            console.warn("Couldn't render " + item.id + ". Delayed until parent is rendered.");
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
                }
                else {

                    // This is a metadata folder row, append it to the table
                    this.$el.append(dataItemView.render().el);

                    this.trigger("addOne");
                }

            },

            /**
             * Render the Data Package View and insert it into this view
             */
            renderDataPackage: function () {

                var view = this;

                if(MetacatUI.rootDataPackage.packageModel.isNew()){
                view.renderMember(this.model);
                };

                // As the root collection is updated with models, render the UI
                this.listenTo(MetacatUI.rootDataPackage, "add", function (model) {

                if (!model.get("synced") && model.get('id'))
                    this.listenTo(model, "sync", view.renderMember);
                else if (model.get("synced"))
                    view.renderMember(model);

                //Listen for changes on this member
                model.on("change:fileName", model.addToUploadQueue);
                });

                //Render the Data Package view
                this.dataPackageView = new DataPackageView({
                edit: true,
                dataPackage: MetacatUI.rootDataPackage,
                parentEditorView: this
                });

                //Render the view
                var $packageTableContainer = this.$("#data-package-container");
                $packageTableContainer.html(this.dataPackageView.render().el);

                //Make the view resizable on the bottom
                var handle = $(document.createElement("div"))
                .addClass("ui-resizable-handle ui-resizable-s")
                .attr("title", "Drag to resize")
                .append($(document.createElement("i")).addClass("icon icon-caret-down"));
                $packageTableContainer.after(handle);
                $packageTableContainer.resizable({
                handles: { "s": handle },
                minHeight: 100,
                maxHeight: 900,
                resize: function () {
                    view.emlView.resizeTOC();
                }
                });

                var tableHeight = ($(window).height() - $("#Navbar").height()) * .40;
                $packageTableContainer.css("height", tableHeight + "px");

                var table = this.dataPackageView.$el;
                this.listenTo(this.dataPackageView, "addOne", function () {
                if (table.outerHeight() > $packageTableContainer.outerHeight() && table.outerHeight() < 220) {
                    $packageTableContainer.css("height", table.outerHeight() + handle.outerHeight());
                    if (this.emlView)
                    this.emlView.resizeTOC();
                }
                });

                if (this.emlView)
                this.emlView.resizeTOC();

                //Save the view as a subview
                this.subviews.push(this.dataPackageView);

                this.listenTo(MetacatUI.rootDataPackage.packageModel, "change:childPackages", this.renderChildren);
            },

            /**
             * Add all rows to the DataPackageView
             */
            addAll: function() {

                this.$el.find('#data-package-table-body').html(''); // clear the table first
                this.dataPackage.sort();

                if (!this.edit) {
                    var atLocationObj = this.dataPackage.getAtLocation();
                    this.atLocationObj = atLocationObj;

                    // form path to D1 object dictionary
                    if (this.atLocationObj !== undefined && !(_.isEmpty(this.atLocationObj))) {
                        var filePathObj = new Object();

                        this.dataPackage.each (function(item) {
                            if (!(Object.keys(this.atLocationObj).includes(item.id))) {
                                this.atLocationObj[item.id] = "/";
                            }
                        }, this);
                        
                        for (let key of Object.keys(this.atLocationObj)) {
                            var path = this.atLocationObj[key];
                            var pathArray = path.split('/');
                            pathArray.pop();
                            var parentPath = pathArray.join("/");
                            if (filePathObj.hasOwnProperty(parentPath)) {
                                filePathObj[parentPath].push(key);
                            }
                            else {
                                filePathObj[parentPath] = new Array();
                                filePathObj[parentPath].push(key);
                            }
                        }
                    }

                    // add top level data package row to the package table
                    var tableRow = null, 
                        view = this,
                        title = this.packageTitle,
                        packageUrl = null;

                    if (title === ""){
                        let metadataObj  = _.filter(this.dataPackage.models, function(m){ return(m.get("id") == view.currentlyViewing) });
                        if (metadataObj.length > 0){
                            title = metadataObj[0].get("title");
                        }
                        else{
                            title = this.dataPackage.get("id" );
                        }
                    }
                    if (title.length > 150) {
                        let newTitle = title.slice(0,75) + "..." + title.slice(title.length - 75, title.length);
                        title = newTitle;
                    }
                    
                    // set the package URL
                    if(MetacatUI.appModel.get("packageServiceUrl"))
                        packageUrl = MetacatUI.appModel.get("packageServiceUrl") + encodeURIComponent(view.dataPackage.id);

                    var disablePackageDownloads = this.disablePackageDownloads;
                    tableRow = this.dataPackageHeaderTemplate({id:view.dataPackage.id, title: title, downloadUrl: packageUrl, disablePackageDownloads: disablePackageDownloads});
                    this.$el.append(tableRow);

                    if (this.atLocationObj !== undefined && filePathObj !== undefined) {
                        // sort the filePath by length
                        var sortedFilePathObj = Object.keys(filePathObj).sort().reduce(
                            (obj, key) => { 
                            obj[key] = filePathObj[key]; 
                            return obj;
                            }, 
                            {}
                        );
                        this.sortedFilePathObj = sortedFilePathObj;
                        this.addFilesAndFolders(sortedFilePathObj);
                    }
                    else {
                        this.dataPackage.each(this.addOne, this);
                    }
                }
                else {
                    this.dataPackage.each(this.addOne, this);
                }
            },

            /**
             * Add all the files and folders
             */
            addFilesAndFolders: function(sortedFilePathObj) {
            	if(!sortedFilePathObj) return false;
                var insertedPath = new Array();
                let pathMap = new Object();
                pathMap[""] = "";

                for (let key of Object.keys(sortedFilePathObj)) {
                    // add folder
                    var pathArray = key.split("/");
                    //skip the first empty value
                    for (let i = 1; i < pathArray.length; i++) {
                        if (!(pathArray[i] in pathMap)) {
                            // insert path
                            var dataItemView,
                                itemPath;

                            // root
                            if (i == 1) {
                                itemPath = "";
                            }
                            else {
                                itemPath = pathMap[pathArray[i - 1]];
                            }
                            
                            dataItemView = new DataItemView({
                                mode: this.mode,
                                itemName: pathArray[i],
                                itemPath: itemPath,
                                itemType: "folder",
                                parentEditorView: this.parentEditorView,
                                dataPackageId: this.dataPackage.id
                            });

                            this.subviews[pathArray[i]] = dataItemView; // keep track of all views

                            this.$el.append(dataItemView.render().el);

                            this.trigger("addOne");

                            pathMap[pathArray[i]] = itemPath + "/" + pathArray[i];
                        }
                    }

                    // add files in the folder
                    var itemArray = sortedFilePathObj[key];
                    for (let i = 0; i < itemArray.length; i++) {
                        let item = itemArray[i];
                        this.addOne(this.dataPackage.get(item));
                    }
                }
            },

            /**
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

            /**
            * Renders a control that opens the AccessPolicyView for editing permissions on this package
            * @since 2.15.0
            */
            renderShareControl: function(){

                if( this.parentEditorView && !this.parentEditorView.isAccessPolicyEditEnabled() ){
                    this.$("#data-package-table-share").remove();
                }

            },

            /**
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

            /**
             Show or hide the data rows associated with the event row science metadata
             */
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

            sort: function(models){
                //Default to the package model members as the models to sort
                if(!models){
                    var models = this.model.get("members");
                    //If this model doesn't have members, return an empty array or a falsey value
                    if(!models) return models;
                }

                // One == already sorted!
                if(models.length == 1) return models;
                //If there are too many models to sort (takes too much time) then just get the metadata to display first
                else if(models.length > 150){
                    var view = this;


                    //Find the metadata doc we are currently viewing
                    var currentMetadata = _.find(models, function(m){ return (m.get("id") == view.currentlyViewing) });
                    //Add it to the front
                    if(currentMetadata){
                        models = _.without(models, currentMetadata);
                        models.unshift(currentMetadata);
                    }

                    //Return the newly sorted array
                    return models;
                }


                var view = this,
                    metadataView = this.onMetadataView? this.parentView : null;

                //** If this is not a nested package AND the parent view is the metadata view, then sort by order of appearance in the metadata **/
                if(!this.nested && (metadataView && !_.findWhere(metadataView.subviews, {type: "MetadataIndex"}))){
                    if(metadataView.hasEntityDetails()){

                        //If we are currently viewing a metadata document, find it
                        if(this.currentlyViewing)
                            var currentMetadata = _.find(models, function(m){ return (m.get("id") == view.currentlyViewing) });

                        //For each model, find its position on the Metadata View page
                        var numNotFound = 0;
                        _.each(models, function(model){
                            if(currentMetadata == model) return;

                            var container = view.parentView.findEntityDetailsContainer(model);
                            if(container) model.offsetTop = $(container)[0].offsetTop;
                            else{
                                model.offsetTop = window.outerHeight;
                                numNotFound++;
                            }
                        });

                        //Continue only if we found the entity details section for at least one model, if not, sort by the default method later
                        if(numNotFound < models.length-1){ //Minus 1 since we don't count the metadata
                            //Sort the models by this position
                            models = _.sortBy(models, "offsetTop");

                            //Move the metadata model that we are currently viewing in the Metadata view to the top
                            if(currentMetadata){
                                models = _.without(models, currentMetadata);
                                models.unshift(currentMetadata);
                            }

                            //Flatten the array in case we have nesting
                            models = _.flatten(models);

                            //Return the sorted array
                            return models;
                        }
                    }
                }

                //** For tables with no accompanying metadata (nested or not on the Metadata View), default to sorting by group then alpha by name**/
                //Split the members of this package into groups based on their format type (metaata, data, image, code, etc)
                var groupedModels = _.groupBy(models, function(m){
                        if(!m.get("type") || (typeof m.get("type") == "undefined"))
                            return "data";
                        return m.get("type");
                    }),
                    sortedModels = [];

                var rowOrder = ["metadata", "image", "PDF", "program", "data", "annotation"];

                for(var i=0; i<rowOrder.length; i++){
                    //Sort the members/rows alphabetically within each group
                    /*models = _.sortBy(models, function(m){
                        if(m.get("type") == "metadata") return "!"; //Always display metadata first since it will have the title in the table
                        return m.get("type");
                    });	*/
                    var group = groupedModels[rowOrder[i]];
                    group = _.sortBy(group, function(m){
                        return m.get("fileName") || m.get("id");
                    });
                    sortedModels.push(group);
                }

                models = _.flatten(sortedModels);

                return models;
            },

            // Member row metrics for the package table
            // Retrieving information from the Metrics Model's result details
            getMemberRowMetrics: function(id, formatType) {

                if(typeof this.metricsModel !== "undefined"){
                    var metricsResultDetails = this.metricsModel.get("resultDetails");

                    if( typeof metricsResultDetails !== "undefined" && metricsResultDetails ){
                          var metricsPackageDetails = metricsResultDetails["metrics_package_counts"];

                          var objectLevelMetrics = metricsPackageDetails[id];
                          if(typeof objectLevelMetrics !== "undefined") {
                              if(formatType == "METADATA") {
                                  var reads = objectLevelMetrics["viewCount"];
                              }
                              else {
                                  var reads = objectLevelMetrics["downloadCount"];
                              }
                          }
                          else{
                              var reads = 0;
                          }
                    }
                    else{
                          var reads = 0;
                    }

                }

                if((typeof reads !== "undefined") && reads){
                    // giving labels
                    if(formatType == "METADATA" && reads == 1)
                        reads += " view";
                    else if(formatType == "METADATA")
                        reads += " views";
                    else if(reads == 1)
                        reads += " download";
                    else
                        reads += " downloads";
                }
                else {
                    // returning an empty string if the metrics are 0
                    reads = "";
                }

                return reads;
            },

            expand: function(e){
                //Don't do anything...
                e.preventDefault();

                var view = this;
                var eventEl = $(e.target).parents("td");
                var rowEl = $(e.target).parents("tr");

                var parentId = rowEl.data("id");
                var children = "tr[data-parent='" + parentId + "']";

                this.$(children).fadeIn();
                
                this.$(eventEl).children().children(".expand-control").fadeOut(function(){
                    view.$(eventEl).children().children(".collapse-control").fadeIn("fast");
                    view.$(".tooltip-this").tooltip();
                });

                this.$(children).children().children().children(".collapse-control").fadeOut(function(){
                    view.$(children).children().children().children(".expand-control").fadeIn("fast");
                });
            },

            collapse: function(e){
                //Don't do anything...
                e.preventDefault();

                var view = this;
                var eventEl = $(e.target).parents("td");
                var rowEl = $(e.target).parents("tr");

                var parentId = rowEl.data("id");
                var children = "tr[data-parent^='" + parentId + "']";
                this.$(children).fadeOut();
                
                this.$(eventEl).children().children(".collapse-control").fadeOut(function(){
                    view.$(eventEl).children().children(".expand-control").fadeIn();
                    view.$(".tooltip-this").tooltip();
                });
            },

            expandAll: function(e){
                //Don't do anything...
                e.preventDefault();

                var view = this;
                var eventEl = $(e.target).parents("td");
                var rowEl = $(e.target).parents("tr");

                var parentId = rowEl.data("id");
                var children = "tr[data-packageid='" + parentId + "']";

                this.$(children).fadeIn();
                
                this.$(eventEl).children(".d1package-expand").fadeOut(function(){
                    view.$(eventEl).children(".d1package-collapse").fadeIn("fast");
                    view.$(".tooltip-this").tooltip();
                });

                this.$(children).children().children().children(".collapse-control").fadeOut(function(){
                    view.$(children).children().children().children(".expand-control").fadeIn("fast");
                });
            },

            collapseAll: function(e){
                //Don't do anything...
                e.preventDefault();

                var view = this;
                var eventEl = $(e.target).parents("td");
                var rowEl = $(e.target).parents("tr");

                var parentId = rowEl.data("id");
                var children = "tr[data-packageid='" + parentId + "']";

                this.$(children).each(function() {
                    $(this).fadeOut();
                    let childId = $(this).data("id");
                    let grandchildren = "tr[data-parent^='" + childId + "']";

                    $(grandchildren).fadeOut();
                });
                
                this.$(eventEl).children(".d1package-collapse").fadeOut(function(){
                    view.$(eventEl).children(".d1package-expand").fadeIn();
                    view.$(".tooltip-this").tooltip();
                });
            },

            checkForPrivateMembers: function(){
                try{
                    var packageModel      = this.model,
                        packageCollection = this.dataPackageCollection;

                    if( !packageModel || !packageCollection ){
                        return;
                    }

                    //Get the number of package members found in Solr and parsed from the RDF XML
                    var numMembersFromSolr = packageModel.get("members").length,
                        numMembersFromRDF  = packageCollection.length;

                    //If there are more package members in the RDF XML tthan found in SOlr, we
                    // can assume that those objects are private.
                    if( numMembersFromRDF > numMembersFromSolr ){
                        var downloadButtons = this.$(".btn.download");

                        for( var i=0; i<downloadButtons.length; i++){

                            var btn = downloadButtons[i];

                            //Find the Download All button for the package
                            var downloadURL = $(btn).attr("href");
                            if( downloadURL.indexOf(packageModel.get("id")) > -1 ||
                                downloadURL.indexOf( encodeURIComponent(packageModel.get("id"))) > -1 ){

                            //Disable this download button
                            $(btn).attr("disabled", "disabled")
                                    .addClass("disabled")
                                    .attr("href", "")
                                    .tooltip({
                                    trigger: "hover",
                                    placement: "top",
                                    delay: 500,
                                    title: "This dataset may contain private data, so each data file should be downloaded individually."
                                    });

                            i = downloadButtons.length;
                            }
                        }
                    }
                }
                catch(e){
                    console.error(e);
                }
            },

            getNestedPackages: function() {
                var nestedPackages = new Array();
                var nestedPackageIds = new Array();
                this.nestedPackages = nestedPackages;
                var childPackages = this.packageModel.get("childPackages");

                if (Object.keys(childPackages).length > 0) {
                    for (var childPkg in childPackages) {
                        if (!nestedPackageIds.includes(childPkg)) {
                            var nestedPackage = new PackageModel();
                            nestedPackage.set("id", childPkg);
                            nestedPackage.getMembers();
                            nestedPackages.push(nestedPackage);
                            nestedPackageIds.push(childPkg);

                            this.listenToOnce(nestedPackage, 'change:members', this.addNestedPackages, nestedPackage);
                        }
                    }
                }
            },

            addNestedPackages: function(dataPackage) {
                // add top level data package row to the package table

                var tableRow = null, 
                    view = this,
                    title = null,
                    packageUrl = null;

                var members = dataPackage.get("members");
                let metadataObj  = _.filter(members, function(m){ return(m.get("type") == "Metadata" || m.get("type") == "metadata") });

                title = metadataObj[0].get("title");
                
                // set the package URL
                if(MetacatUI.appModel.get("packageServiceUrl"))
                    packageUrl = MetacatUI.appModel.get("packageServiceUrl") + encodeURIComponent(dataPackage.id);

                tableRow = this.dataPackageHeaderTemplate({id:dataPackage.id, title: title, disablePackageDownloads:false, downloadUrl: packageUrl});
                this.$el.append(tableRow);

                // TODO parse each member and add to the package table in MetadataView            
                
                var view = this;
                // Filter out the packages from the member list
                members = _.filter(members, function(m){ return(m.type != "Package") });

                //add each member to the package table view
                _.each(members, function(m){ 
                    view.addOne(m);
                });
            },

            /*showDownloadProgress: function(e){
                e.preventDefault();

                var button = $(e.target);
                button.addClass("in-progress");
                button.html("Downloading... <i class='icon icon-on-right icon-spinner icon-spin'></i>");

                return true;

            }*/

        });
        return DataPackageView;
});
