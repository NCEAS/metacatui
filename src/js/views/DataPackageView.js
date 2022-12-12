/* global define */
define([
    'jquery',
    'underscore',
    'backbone',
    'localforage',
    'collections/DataPackage',
    'models/DataONEObject',
    'models/metadata/ScienceMetadata',
    'models/metadata/eml211/EML211', 
    'models/PackageModel',
    'views/DownloadButtonView',
    'views/DataItemView',
    'text!templates/dataPackage.html',
    'text!templates/dataPackageStart.html',
    'text!templates/downloadContents.html'],
    function($, _, Backbone, LocalForage, DataPackage, DataONEObject, ScienceMetadata, EML211, Package, DownloadButtonView, DataItemView,
    		DataPackageTemplate, DataPackageStartTemplate, DownloadContentsTemplate) {
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

            downloadContentsTemplate: _.template(DownloadContentsTemplate),

            type: "DataPackage",

            tagName: "table",

            className: "table table-striped table-hover",

            metadataViewTagName : "div",

		    metadataViewClassName : "download-contents",

            id: "data-package-table",

            events: {
                "click .toggle-rows" 		   : "toggleRows", // Show/hide rows associated with event's metadata row
                "click .message-row .addFiles" : "handleAddFiles",
                "click .expand-control"   : "expand",
			    "click .collapse-control" : "collapse"
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

                    this.packageId  = options.packageId	 || null;
                    this.memberId	= options.memberId	 || null;
                    this.attributes = options.attributes || null;
                    this.metadataViewClassName += options.metadataViewClassName  || "";
                    this.currentlyViewing = options.currentlyViewing || null;
                    this.numVisible = options.numVisible || 4;
                    this.parentView = options.parentView || null;
                    this.title = options.title || "";
                    this.nested = (typeof options.nested === "undefined")? false : options.nested;

                    //Set up the Package model
                    if((typeof options.model === "undefined") || !options.model){
                        this.model = new Package();
                        this.model.set("memberId", this.memberId);
                        this.model.set("packageId", this.packageId);
                    }

                    if(!(typeof options.metricsModel == "undefined")){
                        this.metricsModel = options.metricsModel;
                    }

                    //Get the members
                    if(this.packageId)    this.model.getMembers();
                    else if(this.memberId) this.model.getMembersByMemberID(this.memberId);

                    this.onMetadataView = (this.parentView && this.parentView.type == "Metadata");
                    this.hasEntityDetails = (this.onMetadataView && (this.model.get("members") && this.model.get("members").length < 150))? this.parentView.hasEntityDetails() : false;

                    this.listenTo(this.model, "changeAll", this.renderMetadataView);
                }
                else {
                    //Get the options sent to this view
                    if(typeof options == "object"){
                        //The edit option will allow the user to edit the table
                        this.edit = options.edit || false;

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

                //Render the Share control(s)
                this.renderShareControl();

                return this;
            },

            /*
            * Creates a table of package/download contents that this metadata doc is a part of
            */
            renderMetadataView: function(){

                var view = this,
                    members = this.model.get("members");

                //If the model isn't complete, we may be still waiting on a response from the index so don't render anything yet
                if(!this.model.complete) return false;

                //Start the HTML for the rows
                var	tbody = $(document.createElement("tbody"));

                //Filter out the packages from the member list
                members = _.filter(members, function(m){ return(m.type != "Package") });

                //Filter the members in order of preferred appearance
                members = this.sort(members);
                this.sortedMembers = members;

                var metadata = this.model.getMetadata();

                //Count the number of rows in this table
                var numRows = members.length;

                //Cut down the members list to only those that will be visible
                members = members.slice(0, this.numVisible);
                this.rowsComplete = false;

                //Create the HTML for each row
                _.each(members, function(solrResult){
                    //Append the row element
                    $(tbody).append(view.getMemberRow(solrResult));
                });

                var bodyRows = $(tbody).find("tr");
                this.numHidden = numRows - this.numVisible;

                //Draw the footer which will have an expandable/collapsable control
                if(this.numHidden > 0){
                    var tfoot        = $(document.createElement("tfoot")),
                        tfootRow     = $(document.createElement("tr")),
                        tfootCell    = $(document.createElement("th")).attr("colspan", "100%"),
                        item         = (this.numHidden == 1)? "item" : "items",
                        expandLink   = $(document.createElement("a")).addClass("expand-control control").text("Show " + this.numHidden + " more " + item + " in this data set"),
                        expandIcon   = $(document.createElement("i")).addClass("icon icon-caret-right icon-on-left"),
                        collapseLink = $(document.createElement("a")).addClass("collapse-control control").text("Show less").css("display", "none"),
                        collapseIcon = $(document.createElement("i")).addClass("icon icon-caret-up icon-on-left");

                    $(tfoot).append(tfootRow);
                    $(tfootRow).append(tfootCell);
                    $(tfootCell).append(expandLink, collapseLink);
                    $(expandLink).prepend(expandIcon);
                    $(collapseLink).prepend(collapseIcon);
                }

                if(bodyRows.length == 0){
                    tbody.html("<tr><td colspan='100%'>This is an empty dataset.</td></tr>");
                }

                if(!this.title && metadata){
                    this.title = '<a href="<%= MetacatUI.root %>/view/' + encodeURIComponent(metadata.get("id")) +
                        '">Files in this dataset';

                    if(this.model.get("id"))
                        this.title += '<span class="subtle"> Package: ' + this.model.get("id") + '</span>';

                    this.title += '</a>';
                }
                else if(!this.title && !metadata){
                    this.title = "Files in this dataset";
                }

                this.$el.html(this.downloadContentsTemplate({
                        title   : this.title || "Files in this dataset",
                        metadata : this.nested ? metadata : null,
                        colspan : bodyRows.first().find("td").length,
                        packageId : this.model.get("id"),
                            nested : this.nested
                }));

                //Insert the Download All button
                if(this.model.getURL() && this.model.get("id")){

                    var downloadBtn = new DownloadButtonView({ model: this.model });
                    downloadBtn.render();
                    this.$(".download-container").append(downloadBtn.el);
                }

                //Add the table body and footer
                this.$("thead").after(tbody);
                if(typeof tfoot !== "undefined") this.$(tbody).after(tfoot);

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

                var dataItemView, scimetaParent, parentRow, delayed_models;

                if ( _.contains(Object.keys(this.subviews), item.id) ) {
                    return false; // Don't double render

                }

                dataItemView = new DataItemView({
                    model: item,
                    parentEditorView: this.parentEditorView
                });
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

            },

            /**
             * Add all rows to the DataPackageView
             */
            addAll: function() {
                this.$el.find('#data-package-table-body').html(''); // clear the table first
                this.dataPackage.sort();
                this.dataPackage.each(this.addOne, this);

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
    
            getMemberRow: function(memberModel, options){
                var formatType = memberModel.get("formatType"),
                    type       = memberModel.type == "Package" ? "data" : memberModel.getType(),
                    id		   = memberModel.get("id"),
                    entityName = memberModel.get("fileName"),
                    url        = memberModel.get("url"),
                    hidden     = (typeof options === "undefined") ? false : options.hidden,
                    collapsable = hidden? true : (typeof options === "undefined") ? false : options.collapsable;
    
                if(!url){
                    memberModel.setURL();
                    url = memberModel.get('url');
                }
                //Use the metadata title instead of the ID
                if(!entityName && (formatType == "METADATA")) entityName = memberModel.get("title");
                if((formatType == "METADATA") && entityName) entityName =  "Metadata: " + entityName;
                else if((formatType == "METADATA") && !entityName) entityName = "Metadata";
    
                //Display the id in the table if not name is present
                if((typeof entityName === "undefined") || !entityName) entityName = id;
    
                //Create a row for this member of the data package
                var tr = $(document.createElement("tr"));
    
                //Icon cell (based on formatType)
                var iconCell = $(document.createElement("td")).addClass("format-type"),
                    formatTypeIcon = document.createElement("i"),
                    icon = "icon-table";
    
                //Determine the icon type based on format type
                if(type == "program")
                    icon = "icon-code";
                else if(type == "data")
                    icon = "icon-table";
                else if(type == "metadata")
                    icon = "icon-file-text";
                else if (type == "image")
                    icon = "icon-picture";
                else if (type == "pdf")
                    icon = "icon-file pdf";
    
                $(formatTypeIcon).addClass(icon).tooltip({
                    placement: "top",
                    trigger: "hover focus",
                    title: type.charAt(0).toUpperCase() + type.slice(1)
    
                });
                $(iconCell).html(formatTypeIcon);
                $(tr).append(iconCell);
    
    
                //Name cell
                var nameCell = $(document.createElement("td")).addClass("name wrap-contents");
                var nameEl = $(document.createElement("span")).text(entityName);
                $(nameCell).html(nameEl);
                $(tr).append(nameCell);
    
                if(entityName == id)
                    $(nameCell).addClass("entity-name-placeholder").attr("data-id", id);
    
                //"More info" cell
                var moreInfoCell = $(document.createElement("td")).addClass("more-info");
    
                //If we are on the metadata view and there is no entity details section, then append a blank cell
                var	entityDetails = this.hasEntityDetails? this.parentView.findEntityDetailsContainer(memberModel) : false,
                    currentlyViewing = (id == this.currentlyViewing);
                if((this.onMetadataView && !this.hasEntityDetails) || (this.onMetadataView && !entityDetails) || currentlyViewing || this.nested){
                    $(tr).append(moreInfoCell);
                }
                else{
                    let metadataId = (this.onMetadataView && this.currentlyViewing)? this.currentlyViewing : memberModel.get("isDocumentedBy")[0];
                    var moreInfo = $(document.createElement("a"))
                                    .attr("href", MetacatUI.root + "/view/" + encodeURIComponent(metadataId) + "#" + encodeURIComponent(id))
                                    .addClass("preview")
                                    .attr("data-id", id)
                                    .text("More info");
                    $(moreInfoCell).append(moreInfo);
                }
                $(tr).append(moreInfoCell);
    
                //Format id cell
                var fileTypeCell = $(document.createElement("td")).addClass("formatId wrap-contents");
                $(fileTypeCell).html(memberModel.getFormat());
                $(tr).append(fileTypeCell);
    
                //File size cell
                var sizeCell = $(document.createElement("td")).addClass("size");
                var size = memberModel.bytesToSize();
                $(sizeCell).text(size);
                $(tr).append(sizeCell);
    
                if( MetacatUI.appModel.get("displayDatasetMetrics") ){
                        // Retreiving the Package Metrics Counts from the Metrics Model
                        // Adding a Metric Cell for the corresponding DataONE object in the table
                        var readsCell = $(document.createElement("td"))
                                    .addClass("metrics-count downloads")
                                                    .attr("data-id", id);
                    $(tr).append(readsCell);
            
                    if( !memberModel.hideMetrics() ){
                            // If the model has already been fethced.
                            if (this.metricsModel.get("views") !== null) {
                                readsCell.append(this.getMemberRowMetrics(id, formatType));
                            }
                            else {
                                // Update the metrics later on
                                // If the fetch() is still in progress.
                                this.listenTo(this.metricsModel, "sync", function(){
                                    var readsCell = this.$('.metrics-count.downloads[data-id="' + id + '"]');
                                    readsCell.text(this.getMemberRowMetrics(id, formatType));
                                });
                            }
                    }
                }
    
                //Download button cell
                var downloadBtnCell = $(document.createElement("td")).addClass("download-btn btn-container");
    
                var downloadButton = new DownloadButtonView({ model: memberModel });
                downloadButton.render();
    
                $(downloadBtnCell).append(downloadButton.el);
                $(tr).append(downloadBtnCell);
    
                if(collapsable)
                    tr.addClass("collapse");
                if(hidden)
                    tr.css("display", "none");
    
                return tr;
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
    
                //If this is a nested dataset, we need to actually draw the remaining rows
                if(!this.rowsComplete){
                    var tbody = this.$("tbody");
    
                    //Create the HTML for each row
                    var members = this.sortedMembers.slice(this.numVisible);
                    _.each(members, function(solrResult){
                        //Append the row element
                        $(tbody).append(view.getMemberRow(solrResult, { collapsable: true }));
                    });
    
                    //Make the view as complete so we don't do this again
                    this.rowsComplete = true;
                }
    
                this.$("tr.collapse").fadeIn();
                this.$(".expand-control").fadeOut(function(){
                    view.$(".collapse-control").fadeIn("fast");
                    view.$(".tooltip-this").tooltip();
                });
            },
    
            collapse: function(e){
                //Don't do anything...
                e.preventDefault();
    
                var view = this;
    
                this.$("tr.collapse").fadeOut();
                this.$(".collapse-control").fadeOut(function(){
                    view.$(".expand-control").fadeIn();
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
            }
    
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
