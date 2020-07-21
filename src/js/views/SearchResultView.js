/*global define */
define(['jquery', 'underscore', 'backbone', 'models/SolrResult', 'models/PackageModel', 'views/CitationView', 'text!templates/resultsItem.html'],
	function($, _, Backbone, SolrResult, Package, CitationView, ResultItemTemplate) {

	'use strict';

	// SearchResult View
	// --------------

	// The DOM element for a SearchResult item...
	var SearchResultView = Backbone.View.extend({
		tagName:  'div',
		className: 'row-fluid result-row',

		// Cache the template function for a single item.
		//template: _.template($('#result-template').html()),
		template: _.template(ResultItemTemplate),
		//Templates
        metricStatTemplate:  _.template( "<span class='catalog badge'> <i class='catalog-metric-icon " +
                            " <%=metricIcon%>'></i> <%=metricValue%> </span>"),

		// The DOM events specific to an item.
		events: {
			'click .result-selection' : 'toggleSelected',
			'click .download'         : 'download'
		},

		// The SearchResultView listens for changes to its model, re-rendering. Since there's
		// a one-to-one correspondence between a **SolrResult** and a **SearchResultView** in this
		// app, we set a direct reference on the model for convenience.
		initialize: function (options) {

      if(typeof options !== "object"){
        var options = {}
      }

			this.listenTo(this.model, 'change', this.render);
			this.listenTo(this.model, 'reset', this.render);
			//this.listenTo(this.model, 'destroy', this.remove);
			//this.listenTo(this.model, 'visible', this.toggleVisible);

			if(typeof options.metricsModel !== "undefined")
				this.metricsModel = options.metricsModel;
		},

		// Re-render the citation of the result item.
		render: function () {

			//Convert the model to JSON and create the result row from the template
			var json = this.model.toJSON();

			/* Add other attributes to the JSON to send to the template */
			//Determine if there is a prov trace
			json.hasProv  = this.model.hasProvTrace();

			// Add flag to add in annotation icon in results item view if appropriate
			json.hasAnnotations = json.sem_annotation &&
				json.sem_annotation.length &&
				json.sem_annotation.length > 0;

			json.showAnnotationIndicator = MetacatUI.appModel.get("showAnnotationIndicator");

			//Find the member node object
			json.memberNode = _.findWhere(MetacatUI.nodeModel.get("members"), {identifier: this.model.get("datasource")});

      //Figure out if this objbect is a collection or portal
      var isCollection = this.model.getType() == "collection" || this.model.getType() == "portal";

      //Determine if this metadata doc documents any data files
			if( Array.isArray(json.documents) && json.documents.length ){
				var dataFileIDs = _.without(json.documents, this.model.get("id"), this.model.get("seriesId"), this.model.get("resourceMap"));
				json.numDataFiles = dataFileIDs.length;
				json.dataFilesMessage = "This dataset contains " + json.numDataFiles + " data file";
				if(json.numDataFiles > 1){
					json.dataFilesMessage += "s";
				}
			}
			else{
				json.numDataFiles = 0;
				json.dataFilesMessage = "This dataset doesn't contain any data files";
			}

      if( MetacatUI.appModel.get("displayRepoLogosInSearchResults") ){
        //If this result has a logo and it is not a URL, assume it is an ID and create a full URL
        if( json.logo && !json.logo.startsWith("http") ){
          json.logo = MetacatUI.appModel.get("objectServiceUrl") + json.logo;
        }
      }

      //Create a URL that leads to a view of this object
      json.viewURL = this.model.createViewURL();

			var resultRow = this.template(json);
			this.$el.html(resultRow);

      //Create the citation
      var citation = new CitationView({metadata: this.model}).render().el;
      var placeholder = this.$(".citation");
      if(placeholder.length < 1) this.$el.append(citation);
      else $(placeholder).replaceWith(citation);

      //Create the OpenURL COinS
      var span = this.getOpenURLCOinS();
      this.$el.append(span);

      //Non-collection metadata types will display metrics
      if( !isCollection ){

        if( MetacatUI.appModel.get("displayDatasetMetrics") && this.metricsModel ){
          if (this.metricsModel.get("views") !== null) {
            // Display metrics if the model has already been fetched
            this.displayMetrics();
          }
          else if( this.metricsModel ) {
            // waiting for the fetch() call to succeed.
            this.listenTo(this.metricsModel, "sync", this.displayMetrics);
          }
        }
      }
      else{
        this.$el.addClass("collection");
      }

			//Save the id in the DOM for later use
			var id = json.id;
			this.$el.attr("data-id", id);

			if(this.model.get("abstract")){
				var abridgedAbstract = (this.model.get("abstract").indexOf(" ", 250) < 0) ? this.model.get("abstract") : this.model.get("abstract").substring(0, this.model.get("abstract").indexOf(" ", 250)) + "...";
				var content = $(document.createElement("div"))
								.append($(document.createElement("p")).text(abridgedAbstract));

				this.$(".popover-this.abstract").popover({
					trigger: "hover",
					html: true,
					content: content,
					title: "Abstract",
					placement: "top",
					container: this.el
				});
			}
			else{
				this.$(".popover-this.abstract").addClass("inactive");
				this.$(".icon.abstract").addClass("inactive");
			}

			return this;
		},

		displayMetrics: function() {

      //If metrics for this object should be hidden, exit the function
      if( this.model.hideMetrics() ){
        return;
      }

			var datasets = this.metricsModel.get("datasets");
			var downloads = this.metricsModel.get("downloads");
			var views = this.metricsModel.get("views");
			var citations = this.metricsModel.get("citations");

			// Initializing the metric counts
			var viewCount = 0;
			var downloadCount = 0;
			var citationCount = 0;

			// Get the individual dataset metics only if the response from Metrics Service API
			// has non-zero array sizes
			if(datasets && datasets.length > 0) {
				var index = datasets.indexOf(this.model.get("id"));
				viewCount = views[index];
				downloadCount = downloads[index];
				citationCount = citations[index];
			}

			// Generating tool-tip title
			// Citations
			if(citationCount == 1){
				var citationToolTip = citationCount + " citation";
			}
			else {
				var citationToolTip = MetacatUI.appView.numberAbbreviator(citationCount,1) + " citations";
			}

			// Downloads
			if(downloadCount == 1){
				var downloadToolTip = downloadCount + " download";
			}
			else {
				var downloadToolTip = MetacatUI.appView.numberAbbreviator(downloadCount,1) + " downloads";
			}

			// Views
			if(viewCount == 1){
				var viewToolTip = viewCount + " view";
			}
			else {
				var viewToolTip = MetacatUI.appView.numberAbbreviator(viewCount,1) + " views";
			}

			// Replacing the metric total count with the spinning icon.
			this.$('.resultItem-CitationCount').html(this.metricStatTemplate({metricValue:MetacatUI.appView.numberAbbreviator(citationCount,1), metricIcon:'icon-quote-right'}))
												.tooltip({
													placement: "top",
													trigger: "hover",
													delay: 800,
													container: this.el,
													title: citationToolTip
												});

			this.$('.resultItem-DownloadCount').html(this.metricStatTemplate({metricValue:MetacatUI.appView.numberAbbreviator(downloadCount,1), metricIcon:'icon-cloud-download'}))
											   .tooltip({
													placement: "top",
													trigger: "hover",
													delay: 800,
													container: this.el,
													title: downloadToolTip
												});

			this.$('.resultItem-ViewCount').html(this.metricStatTemplate({metricValue:MetacatUI.appView.numberAbbreviator(viewCount,1), metricIcon:'icon-eye-open'}))
											.tooltip({
												placement: "top",
												trigger: "hover",
												delay: 800,
												container: this.el,
												title: viewToolTip
											});


			// Removing Citation metric if the citationCount is 0
			if (citationCount === 0) {
				this.$('.resultItem-CitationCount').css("visibility","hidden");
			}

			// Removing Download metric if the downloadCount is 0
			if (downloadCount === 0) {
				this.$('.resultItem-DownloadCount').css("visibility","hidden");
			}

			// Removing View metric if the viewCount is 0
			if (viewCount === 0) {
				this.$('.resultItem-ViewCount').css("visibility","hidden");
			}
		},

		// Toggle the `"selected"` state of the model.
		toggleSelected: function () {
			this.model.toggle();
		},

		routeToMetadata: function(e){
			var id = this.model.get("id");

			//If the user clicked on a download button or any element with the class 'stop-route', we don't want to navigate to the metadata
			if ($(e.target).hasClass('stop-route') || (typeof id === "undefined") || !id)
				return;

			MetacatUI.uiRouter.navigate('view/' + encodeURIComponent(id), {trigger: true});
		},

		download: function(e){
			if(MetacatUI.appUserModel.get("loggedIn") && !this.model.get("isPublic")){
				if(e){
					e.preventDefault();
					var packageId = $(e.target).attr("data-id") || this.model.get("resourceMap");
				}
				else
					var packageId = this.model.get("resourceMap");

				var fileName = this.model.get("fileName") || this.model.get("title");

				//Download the entire package if there is one
				if(packageId){

					//If there is more than one resource map, download all of them
					if(Array.isArray(packageId)){
						for(var i = 0; i<packageId.length; i++){
							var pkgFileName = fileName || "Dataset_" + (i+1);

							//Take off the file extension part of the file name
							if(pkgFileName.lastIndexOf(".") > 0)
								pkgFileName = pkgFileName.substring(0, pkgFileName.lastIndexOf("."));

							var packageModel = new Package({
								id: packageId[i],
								fileName: pkgFileName + ".zip"
							});
							packageModel.downloadWithCredentials();
						}
					}
					else{
						//Take off the file extension part of the file name
						if(fileName.lastIndexOf(".") > 0)
							fileName = fileName.substring(0, fileName.lastIndexOf("."));

						//Create a model to represent the package
						var packageModel = new Package({
							id: packageId,
							fileName: fileName + ".zip"
						});
						packageModel.downloadWithCredentials();
					}
				}
				//Otherwise just download this solo object
				else{
					this.model.downloadWithCredentials();
				}
			}
			else
				return true;
		},

		getOpenURLCOinS: function(){
			//Create the OpenURL COinS
			var spanTitle = "ctx_ver=Z39.88-2004&amp;rft_val_fmt=info:ofi/fmt:kev:mtx:dc&amp;rfr_id=info:sid/ocoins.info:generator&amp;rft.type=Dataset";

			if(this.model.get("title")) 	 spanTitle += "&amp;rft.title=" + this.model.get("title");
			if(this.model.get("origin")) 	 spanTitle += "&amp;rft.creator=" + this.model.get("origin");
			if(this.model.get("keywords")) 	 spanTitle += "&amp;rft.subject=" + this.model.get("keywords");
			if(this.model.get("abstract")) 	 spanTitle += "&amp;rft.description=" + this.model.get("abstract");
			if(this.model.get("datasource")) spanTitle += "&amp;rft.publisher=" + this.model.get("datasource");
			if(this.model.get("endDate")) 	 spanTitle += "&amp;rft.date=" + this.model.get("endDate");
			if(this.model.get("formatID")) 	 spanTitle += "&amp;rft.format=" + this.model.get("formatID");
			if(this.model.get("id"))         spanTitle += "&amp;rft.identifier=" + this.model.get("id");
			if(this.model.get("url")) 		 spanTitle += "&amp;rft.source=" + this.model.get("url");
			if(this.model.get("northBoundCoord")){
				spanTitle += "&amp;rft.coverage=POLYGON((" + this.model.get("southBoundCoord") + " " + this.model.get("westBoundCoord") + ", " +
														     this.model.get("northBoundCoord") + " " + this.model.get("westBoundCoord") + ", " +
														     this.model.get("northBoundCoord") + " " + this.model.get("eastBoundCoord") + ", " +
														     this.model.get("southBoundCoord") + " " + this.model.get("eastBoundCoord") + "))";
			}

			spanTitle = encodeURI(spanTitle);

			return $(document.createElement("span")).attr("title", spanTitle).addClass("Z3988");
		},

		// Remove the item, destroy the model from *localStorage* and delete its view.
		clear: function () {
			this.model.destroy();
		},

		onClose: function(){
			this.clear();
		}
	});
	return SearchResultView;
});
