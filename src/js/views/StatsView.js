/*global define */
define(['jquery', 'underscore', 'backbone', 'd3', 'LineChart', 'BarChart', 'DonutChart', 'CircleBadge',
'collections/Citations', 'models/MetricsModel', 'models/Stats', 'MetricsChart', 'views/CitationListView',
'text!templates/metricModalTemplate.html',  'text!templates/profile.html',
'text!templates/alert.html', 'text!templates/loading.html'],
	function($, _, Backbone, d3, LineChart, BarChart, DonutChart, CircleBadge, Citations, MetricsModel,
    StatsModel, MetricsChart, CitationList, MetricModalTemplate, profileTemplate, AlertTemplate,
    LoadingTemplate) {
	'use strict';

	var StatsView = Backbone.View.extend(
  	/** @lends StatsView.prototype */{

		el: '#Content',

		model: null,

		hideUpdatesChart: false,

		/*
		* Flag to indicate whether the statsview is a node summary view
		* @type {boolean}
		*/
		nodeSummaryView: false,

		/**
		 * Whether or not to show the graph that indicated the assessment score for all metadata in the query.
		 * @type {boolean}
		 */
		hideMetadataAssessment: false,

		template: _.template(profileTemplate),

		metricTemplate: _.template(MetricModalTemplate),

		alertTemplate: _.template(AlertTemplate),

		loadingTemplate: _.template(LoadingTemplate),

		initialize: function(options){
			if(!options) options = {};


			this.title = (typeof options.title === "undefined") ? "Summary of Holdings" : options.title;
			this.description = (typeof options.description === "undefined") ?
					"A summary of all datasets in our catalog." : options.description;
			this.metricsModel = (typeof options.metricsModel === undefined) ? undefined : options.metricsModel;
			this.userType = (typeof options.userType === undefined) ? undefined : options.userType;
			this.userId = (typeof options.userId === undefined) ? undefined : options.userId;
			if(typeof options.el === "undefined")
				this.el = options.el;

			this.hideUpdatesChart = (options.hideUpdatesChart === true)? true : false;
			this.hideMetadataAssessment = (typeof options.hideMetadataAssessment === "undefined") ? true : options.hideMetadataAssessment;
			this.hideCitationsChart = (typeof options.hideCitationsChart === "undefined") ? true : options.hideCitationsChart;
			this.hideDownloadsChart = (typeof options.hideDownloadsChart === "undefined") ? true : options.hideDownloadsChart;
			this.hideViewsChart = (typeof options.hideViewsChart === "undefined") ? true : options.hideViewsChart;

			this.model = options.model || null;
		},

		render: function (options) {

			if ( !options )
				options = {};

			var view = this;

			if ( options.nodeSummaryView ) {
				this.nodeSummaryView = true;
				var nodeId = MetacatUI.appModel.get("nodeId");

				// Overwrite the metrics display flags as set in the AppModel
        this.hideMetadataAssessment = false;
				this.hideCitationsChart = MetacatUI.appModel.get("hideSummaryCitationsChart");
				this.hideDownloadsChart = MetacatUI.appModel.get("hideSummaryDownloadsChart");
				this.hideViewsChart = MetacatUI.appModel.get("hideSummaryViewsChart");

				// Disable the metrics of the nodeId is not available
				if (nodeId === "undefined" || nodeId === null) {
					this.hideCitationsChart = true;
					this.hideDownloadsChart = true;
					this.hideViewsChart = true;
				}
			}

          //If the metadata summery charts are turned off in the entire app, then they should be turned off here too
          if( MetacatUI.appModel.get("hideSummaryMetadataAssessment") === true ){
            this.hideMetadataAssessment = true;
          }

			if ( !this.hideCitationsChart || !this.hideDownloadsChart || !this.hideViewsChart ) {

				if ( typeof this.metricsModel === "undefined" ) {
					// Create a list with the repository ID
					var pid_list = new Array();
					pid_list.push(nodeId);

					// Create a new object of the metrics model
					var metricsModel = new MetricsModel({
						pid_list: pid_list,
						type: this.userType
					});
					metricsModel.fetch();
					this.metricsModel = metricsModel;
				}

			}

			if( !this.model ){
				this.model = new StatsModel({
          hideMetadataAssessment: this.hideMetadataAssessment
        });
			}

			//Clear the page
			this.$el.html("");

			//Only trigger the functions that draw SVG charts if d3 loaded correctly
			if(d3){
				//this.listenTo(this.model, 'change:dataUploadDates',       this.drawUploadChart);
				this.listenTo(this.model, 'change:temporalCoverage',      this.drawCoverageChart);
				this.listenTo(this.model, "change:dataUpdateDates",       this.drawUpdatesChart);
				this.listenTo(this.model, "change:totalSize",             this.drawTotalSize);
				this.listenTo(this.model, "change:totalReplicas",         this.drawTotalReplicas);
				this.listenTo(this.model, 'change:metadataCount', 	    this.drawTotalCount);
				this.listenTo(this.model, 'change:dataFormatIDs', 	  this.drawDataCountChart);
				this.listenTo(this.model, 'change:metadataFormatIDs', this.drawMetadataCountChart);

				//this.listenTo(this.model, 'change:dataUploads', 	  this.drawUploadTitle);
			}

			this.listenTo(this.model, 'change:lastEndDate',	  	  this.drawCoverageChartTitle);
			this.listenTo(this.model, "change:totalCount", this.showNoActivity);

			// set the header type
			MetacatUI.appModel.set('headerType', 'default');

			//Insert the template
			this.$el.html(this.template({
				query: this.model.get('query'),
				title: this.title,
				description: this.description,
				userType: this.userType,
				hideUpdatesChart: this.hideUpdatesChart,
				hideCitationsChart: this.hideCitationsChart,
				hideDownloadsChart: this.hideDownloadsChart,
				hideViewsChart: this.hideViewsChart,
				hideMetadataAssessment: this.hideMetadataAssessment
			}));

		// Insert the metadata assessment chart
		if( this.hideMetadataAssessment !== true ){
			this.listenTo(this.model, "change:mdqScoresImage", this.drawMetadataAssessment);
			this.listenTo(this.model, "change:mdqScoresError", function () {
					this.$("#metadata-assessment-loading").remove();
					MetacatUI.appView.showAlert("Metadata assessment scores are not available for this collection. " + this.model.get("mdqScoresError"),
						"alert-warning", this.$("#metadata-assessment-graphic"));
				});
		}

		//Insert the loading template into the space where the charts will go
		if(d3){
			this.$(".chart").html(this.loadingTemplate);
			this.$(".show-loading").html(this.loadingTemplate);
		}
		//If SVG isn't supported, insert an info warning
		else{
			this.$el.prepend(this.alertTemplate({
				classes: "alert-info",
				msg: "Please upgrade your browser or use a different browser to view graphs of these statistics.",
				email: false
			}));
		}

		this.$el.data("view", this);

			if (this.userType == "portal" || this.userType === "repository") {
				if ( !this.hideCitationsChart || !this.hideDownloadsChart || !this.hideViewsChart ) {
					if (this.metricsModel.get("totalViews") !== null) {
						this.renderMetrics();
					}
					else{
						// render metrics on fetch success.
						this.listenTo(view.metricsModel, "sync" , this.renderMetrics);

						// in case when there is an error for the fetch call.
						this.listenTo(view.metricsModel, "error", this.renderUsageMetricsError);
					}
				}
			}

		//Start retrieving data from Solr
		this.model.getAll();

		// Only gather replication stats if the view is a repository view
		if (this.userType === "repository") {
			if (this.userId !== undefined)
			{
				var identifier = MetacatUI.appSearchModel.escapeSpecialChar(encodeURIComponent("urn:node:" + this.userId));
				this.model.getTotalReplicas(identifier);
			}
			else if (this.nodeSummaryView) {
				var nodeId = MetacatUI.appModel.get("nodeId");
				var identifier = MetacatUI.appSearchModel.escapeSpecialChar(encodeURIComponent(nodeId));
				this.model.getTotalReplicas(identifier);
			}
			
		}

		return this;
	},

    /**
     * drawMetadataAssessment - Insert the metadata assessment image into the view
     */
    drawMetadataAssessment: function(){
      try {
        var scoresImage = this.model.get("mdqScoresImage");
        // Hide the spinner
        this.$("#metadata-assessment-loading").remove();

        if( scoresImage ){
          // Show the figure
          this.$("#metadata-assessment-graphic").append(scoresImage);
        }
        //If there was no image received from the MDQ scores service, then show a warning message
        else{
          MetacatUI.appView.showAlert(
            "Something went wrong while getting the metadata assessment scores. If changes were recently made " +
              " to these dataset(s), the scores may still be calculating.",
            "alert-warning",
            this.$("#metadata-assessment-graphic")
          );
        }
      } catch (e) {
        // If there's an error inserting the image, remove the entire section
        // that contains the image.
        console.error("Error displaying the metadata assessment figure. Error message: " + e);
        MetacatUI.appView.showAlert(
          "Something went wrong while getting the metadata assessment scores.",
          "alert-error",
          this.$("#metadata-assessment-graphic")
        );
      }
    },

		renderMetrics: function(){
			if(!this.hideCitationsChart)
				this.renderCitationMetric();

			if(!this.hideDownloadsChart)
				this.renderDownloadMetric();

			if(!this.hideViewsChart)
				this.renderViewMetric();

			var self = this;
			$(window).on("resize", function(){

				if(!self.hideDownloadsChart)
					self.renderDownloadMetric();

				if(!self.hideViewsChart)
					self.renderViewMetric();
			});
		},

		renderCitationMetric: function() {
			var citationSectionEl = this.$('#user-citations');
			var citationEl = this.$('.citations-metrics-list');
			var citationCountEl = this.$('.citation-count');
			var metricName = "Citations";
			var metricCount = this.metricsModel.get("totalCitations");
			citationCountEl.text(MetacatUI.appView.numberAbbreviator(metricCount,1));

			// Displaying Citations
			var resultDetails = this.metricsModel.get("resultDetails");

			// Creating a new collection object
			// Parsing result-details with citation dictionary format
			var resultDetailsCitationCollection = new Array();
			for (var key in resultDetails["citations"]) {
				resultDetailsCitationCollection.push(resultDetails["citations"][key]);
			}

			var citationCollection = new Citations(resultDetailsCitationCollection, {parse:true});

			this.citationCollection = citationCollection;

			// Checking if there are any citations available for the List display.
			if(this.metricsModel.get("totalCitations") == 0) {
				var citationList = new CitationList();

				// reattaching the citations at the bottom when the counts are 0.
				var detachCitationEl = this.$(citationSectionEl).detach();
				this.$('.charts-container').append(detachCitationEl);
			}
			else {
				var citationList = new CitationList({citations: this.citationCollection});
			}

			this.citationList = citationList;

			citationEl.html(this.citationList.render().$el.html());
		},

		renderDownloadMetric: function() {
			var downloadEl = this.$('.downloads-metrics > .metric-chart');
			var metricName = "Downloads";
			var metricCount = this.metricsModel.get("totalDownloads");
			var downloadCountEl = this.$('.download-count');
			downloadCountEl.text(MetacatUI.appView.numberAbbreviator(metricCount,1));

			downloadEl.html(this.drawMetricsChart(metricName));
		},

		renderViewMetric: function() {
			var viewEl = this.$('.views-metrics > .metric-chart');
			var metricName = "Views";
			var metricCount = this.metricsModel.get("totalViews");
			var viewCountEl = this.$('.view-count');
			viewCountEl.text(MetacatUI.appView.numberAbbreviator(metricCount,1));

			viewEl.html(this.drawMetricsChart(metricName));
		},

		// Currently only being used for portals and profile views
		drawMetricsChart: function(metricName){
			var metricNameLemma = metricName.toLowerCase()
			var metricMonths    = this.metricsModel.get("months");
			var metricCount     = this.metricsModel.get(metricNameLemma);
			var chartEl         = document.getElementById('user-'+metricNameLemma+'-chart' );
			var width           = (chartEl && chartEl.offsetWidth)? chartEl.offsetWidth : 1080;
			var viewType        = this.userType;

			// Draw a metric chart
			var modalMetricChart = new MetricsChart({
														id: metricNameLemma + "-chart",
														metricCount: metricCount,
														metricMonths: metricMonths,
														type: viewType,
														metricName: metricName,
														width: width
			});

			return modalMetricChart.render().el;
		},

		drawDataCountChart: function(){
			var dataCount = this.model.get('dataCount');
			var data = this.model.get('dataFormatIDs');

			if(dataCount){
				var svgClass = "data";
			}
			else if(!this.model.get('dataCount') && this.model.get('metadataCount')){	//Are we drawing a blank chart (i.e. 0 data objects found)?
				var svgClass = "data default";
			}
			else if(!this.model.get('metadataCount') && !this.model.get('dataCount'))
				var svgClass = "data no-activity";

			//If d3 isn't supported in this browser or didn't load correctly, insert a text title instead
			if(!d3){
				this.$('.format-charts-data').html("<h2 class='" + svgClass + " fallback'>" + MetacatUI.appView.commaSeparateNumber(dataCount) + " data files</h2>");

				return;
			}

			//Draw a donut chart
			var donut = new DonutChart({
							id: "data-chart",
							data: data,
							total: this.model.get('dataCount'),
							titleText: "data files",
							titleCount: dataCount,
							svgClass: svgClass,
							countClass: "data",
							height: 300,
              width: 380,
							formatLabel: function(name){
								//If this is the application/vnd.ms-excel formatID - let's just display "MS Excel"
								if((name !== undefined) && (name.indexOf("ms-excel") > -1)) name = "MS Excel";
								else if((name != undefined) && (name == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")) name= "MS Excel OpenXML"
								else if((name != undefined) && (name == "application/vnd.openxmlformats-officedocument.wordprocessingml.document")) name= "MS Word OpenXML"
								//Application/octet-stream - shorten it
								else if((name !== undefined) && (name == "application/octet-stream")) name = "Application file";

								if(name === undefined) name = "";

								return name;
							}
						});
			this.$('.format-charts-data').html(donut.render().el);
		},

		drawMetadataCountChart: function(){
			var metadataCount = this.model.get("metadataCount");
			var data = this.model.get('metadataFormatIDs');

			if(metadataCount){
				var svgClass = "metadata";
			}
			else if(!this.model.get('metadataCount') && this.model.get('dataCount')){	//Are we drawing a blank chart (i.e. 0 data objects found)?
				var svgClass = "metadata default";
			}
			else if(!this.model.get('metadataCount') && !this.model.get('dataCount'))
				var svgClass = "metadata no-activity";

			//If d3 isn't supported in this browser or didn't load correctly, insert a text title instead
			if(!d3){
				this.$('.format-charts-metadata').html("<h2 class='" + svgClass + " fallback'>" + MetacatUI.appView.commaSeparateNumber(metadataCount) + " metadata files</h2>");

				return;
			}

			//Draw a donut chart
			var donut = new DonutChart({
							id: "metadata-chart",
							data: data,
							total: this.model.get('metadataCount'),
							titleText: "metadata files",
							titleCount: metadataCount,
							svgClass: svgClass,
							countClass: "metadata",
							height: 300,
              width: 380,
							formatLabel: function(name){
								if((name !== undefined) && ((name.indexOf("//ecoinformatics.org") > -1) || (name.indexOf("//eml.ecoinformatics.org") > -1))){
									//EML - extract the version only
									if((name.substring(0,4) == "eml:") || (name.substring(0,6) == "https:")) name = name.substr(name.lastIndexOf("/")+1).toUpperCase().replace('-', ' ');

									//EML modules
									if((name.indexOf("-//ecoinformatics.org//eml-") > -1) || (name.indexOf("-//eml.ecoinformatics.org//eml-") > -1)) name = "EML " + name.substring(name.indexOf("//eml-")+6, name.lastIndexOf("-")) + " " + name.substr(name.lastIndexOf("-")+1, 5);

								}
								//Dryad - shorten it
								else if((name !== undefined) && (name == "http://datadryad.org/profile/v3.1")) name = "Dryad 3.1";
								//FGDC - just display "FGDC {year}"
								else if((name !== undefined) && (name.indexOf("FGDC") > -1)) name = "FGDC " + name.substring(name.length-4);

								//Onedcx v1.0
								else if((name !== undefined) && (name == "http://ns.dataone.org/metadata/schema/onedcx/v1.0")) name = "Onedcx v1.0";

								//GMD-NOAA
								else if((name !== undefined) && (name == "http://www.isotc211.org/2005/gmd-noaa")) name = "GMD-NOAA";

								//GMD-PANGAEA
								else if((name !== undefined) && (name == "http://www.isotc211.org/2005/gmd-pangaea")) name = "GMD-PANGAEA";

								if(name === undefined) name = "";
								return name;
							}
						});

			this.$('.format-charts-metadata').html(donut.render().el);
		},

		drawFirstUpload: function(){

			var className = "";

			if( !this.model.get("firstUpload") ){
				var chartData = [{
				              	  count: "N/A",
				              	  className: "packages no-activity"
	                			}];
			}
			else{
				var firstUpload = new Date(this.model.get("firstUpload")),
					readableDate = firstUpload.toDateString();

				readableDate = readableDate.substring(readableDate.indexOf(" ") + 1);

				var chartData = [{
				              	  count: readableDate,
				              	  className: "packages"
	                			}];
			}

			//Create the circle badge
			var dateBadge = new CircleBadge({
				id: "first-upload-badge",
				data: chartData,
				title: "first upload",
				titlePlacement: "inside",
				useGlobalR: true,
				globalR: 100
			});

			this.$("#first-upload").html(dateBadge.render().el);
		},

		//drawUploadChart will get the upload stats from the stats model and draw a time series cumulative chart
		drawUploadChart: function(){
			//Get the width of the chart by using the parent container width
			var parentEl = this.$('.upload-chart');
			var width = parentEl.width() || null;

			//If there was no first upload, draw a blank chart and exit
			if(!this.model.get('firstUpload')){

				var lineChartView = new LineChart(
						{	  id: "upload-chart",
						 	yLabel: "files uploaded",
						 frequency: 0,
						 	 width: width
						});

				this.$('.upload-chart').html(lineChartView.render().el);

				return;
			}

			//Set the frequency of our points
			var frequency = 12;

			//Check which line we should draw first since the scale will be based off the first line
			if(this.model.get("metadataUploads") > this.model.get("dataUploads") ){

				//If there isn't a lot of point to graph, draw points more frequently on the line
				if(this.model.get("metadataUploadDates").length < 40) frequency = 1;

				//Create the line chart and draw the metadata line
				var lineChartView = new LineChart(
						{	  data: this.model.get('metadataUploadDates'),
			  		formatFromSolrFacets: true,
						cumulative: true,
								id: "upload-chart",
						 className: "metadata",
						 	yLabel: "files uploaded",
						labelValue: "Metadata: ",
						// frequency: frequency,
							radius: 2,
							width: width,
						    labelDate: "M-y"
						});

				this.$('.upload-chart').html(lineChartView.render().el);

				//Only draw the data file line if there was at least one uploaded
				if(this.model.get("dataUploads")){
					//Add a line to our chart for data uploads
					lineChartView.className = "data";
					lineChartView.labelValue ="Data: ";
					lineChartView.addLine(this.model.get('dataUploadDates'));
				}
			}
			else{
					var lineChartView = new LineChart(
							{	  data: this.model.get('dataUploadDates'),
				  formatFromSolrFacets: true,
							cumulative: true,
									id: "upload-chart",
							 className: "data",
							 	yLabel: "files uploaded",
							labelValue: "Data: ",
						//	 frequency: frequency,
								radius: 2,
								 width: width,
						    labelDate: "M-y"
							 });

					this.$('.upload-chart').html(lineChartView.render().el);

					//If no metadata files were uploaded, we don't want to draw the data file line
					if(this.model.get("metadataUploads")){
						//Add a line to our chart for metadata uploads
						lineChartView.className = "metadata";
						lineChartView.labelValue = "Metadata: ";
						lineChartView.addLine(this.model.get('metadataUploadDates'));
					}
				}
		},

		//drawUploadTitle will draw a circle badge title for the uploads time series chart
		drawUploadTitle: function(){

			//If d3 isn't supported in this browser or didn't load correctly, insert a text title instead
			if(!d3){
				this.$('#uploads-title').html("<h2 class='packages fallback'>" + MetacatUI.appView.commaSeparateNumber(this.model.get('totalUploads')) + "</h2>");

				return;
			}

			if(!this.model.get('dataUploads') && !this.model.get('metadataUploads')){
				//Draw the upload chart title
				var uploadChartTitle = new CircleBadge({
					id: "upload-chart-title",
					className: "no-activity",
					globalR: 60,
					data: [{ count: 0, label: "uploads" }]
				});

				this.$('#uploads-title').prepend(uploadChartTitle.render().el);

				return;
			}

			//Get information for our upload chart title
			var titleChartData = [],
				metadataUploads = this.model.get("metadataUploads"),
				dataUploads = this.model.get("dataUploads"),
				metadataClass = "metadata",
				dataClass = "data";

			if(metadataUploads == 0) metadataClass = "default";
			if(dataUploads == 0) dataClass = "default";


			var titleChartData = [
			                      {count: this.model.get("metadataUploads"), label: "metadata", className: metadataClass},
							      {count: this.model.get("dataUploads"), 	  label: "data", 	 className: dataClass}
								 ];

			//Draw the upload chart title
			var uploadChartTitle = new CircleBadge({
				id: "upload-chart-title",
				data: titleChartData,
				className: "chart-title",
				useGlobalR: true,
				globalR: 60
			});
			this.$('#uploads-title').prepend(uploadChartTitle.render().el);
		},

		/*
		 * drawTotalCount - draws a simple count of total metadata files/datasets
		 */
		drawTotalCount: function(){

			var className = "";

			if( !this.model.get("metadataCount") && !this.model.get("dataCount") )
				className += " no-activity";

			var chartData = [{
	                    	  count: this.model.get("metadataCount"),
	                    	  className: "packages" + className
			                }];

			//Create the circle badge
			var countBadge = new CircleBadge({
				id: "total-datasets-title",
				data: chartData,
				title: "datasets",
				titlePlacement: "inside",
				useGlobalR: true,
				globalR: 60,
				height: 220
			});

			this.$('#total-datasets').html(countBadge.render().el);
		},

		/*
		 * drawTotalSize draws a CircleBadgeView with the total file size of
		 * all current metadata and data files
		 */
		drawTotalSize: function(){

			if( !this.model.get("totalSize") ){
				var chartData = [{
              	  				  count: "0 bytes",
				              	  className: "packages no-activity"
	                			}];

			}
			else{
				var chartData = [{
		                    	  count: this.bytesToSize( this.model.get("totalSize") ),
		                    	  className: "packages"
				                }];
			}

			//Create the circle badge
			var sizeBadge = new CircleBadge({
				id: "total-size-title",
				data: chartData,
				title: "of content",
				titlePlacement: "inside",
				useGlobalR: true,
				globalR: 60,
				height: 220
			});

			this.$('#total-size').html(sizeBadge.render().el);
		},

		/*
		 * drawUpdatesChart - draws a line chart representing the latest updates over time
		 */
		drawUpdatesChart: function(){

			//If there was no first upload, draw a blank chart and exit
			if(!this.model.get('firstUpdate')){

				var lineChartView = new LineChart(
						{	  id: "updates-chart",
						 	yLabel: "files updated",
						 frequency: 0,
						 cumulative: false,
						 	 width: this.$('.metadata-updates-chart').width()
						});

				this.$('.metadata-updates-chart').html(lineChartView.render().el);

				return;
			}

			//Set the frequency of our points
			var frequency = 12;

			//If there isn't a lot of points to graph, draw points more frequently on the line
			if(this.model.get("metadataUpdateDates").length < 40) frequency = 1;

			//Create the line chart for metadata updates
			var metadataLineChart = new LineChart(
					{	  data: this.model.get('metadataUpdateDates'),
		  formatFromSolrFacets: true,
					cumulative: false,
							id: "updates-chart",
					 className: "metadata",
					 	yLabel: "metadata files updated",
					// frequency: frequency,
						radius: 2,
						width: this.$('.metadata-updates-chart').width(),
					    labelDate: "M-y"
					});

			this.$('.metadata-updates-chart').html(metadataLineChart.render().el);

			//Only draw the data updates chart if there was at least one uploaded
			if(this.model.get("dataCount")){
				//Create the line chart for data updates
				var dataLineChart = new LineChart(
						{	  data: this.model.get('dataUpdateDates'),
			  formatFromSolrFacets: true,
						cumulative: false,
								id: "updates-chart",
						 className: "data",
						 	yLabel: "data files updated",
						// frequency: frequency,
							radius: 2,
							width: this.$('.data-updates-chart').width(),
						    labelDate: "M-y"
						});

				this.$('.data-updates-chart').html(dataLineChart.render().el);

			}
			else{
				//Create the line chart for data updates
				var dataLineChart = new LineChart(
						{	  data: null,
			  formatFromSolrFacets: true,
						cumulative: false,
								id: "updates-chart",
						 className: "data no-activity",
						 	yLabel: "data files updated",
						// frequency: frequency,
							radius: 2,
							width: this.$('.data-updates-chart').width(),
						    labelDate: "M-y"
						});

				this.$('.data-updates-chart').html(dataLineChart.render().el);
			}

		},

		//Draw a bar chart for the temporal coverage
		drawCoverageChart: function(e, data){

			//Get the width of the chart by using the parent container width
			var parentEl = this.$('.temporal-coverage-chart');

			if (this.userType == "repository") {
				parentEl.addClass("repository-portal-view");
			}
			var width = parentEl.width() || null;

			// If results were found but none have temporal coverage, draw a default chart
			if(!this.model.get('firstBeginDate')){

				parentEl.html("<p class='subtle center'>There are no metadata documents that describe temporal coverage.</p>");

				return;
			}

				var options = {
						data: data,
						formatFromSolrFacets: true,
						id: "temporal-coverage-chart",
						yLabel: "data packages",
						yFormat: d3.format(",d"),
						barClass: "packages",
						roundedRect: true,
						roundedRadius: 3,
						barLabelClass: "packages",
						width: width
					};

			var barChart = new BarChart(options);
			parentEl.html(barChart.render().el);

		},

		drawCoverageChartTitle: function(){
			if((!this.model.get('firstBeginDate')) || (!this.model.get('lastEndDate'))) return;

			//Create the range query
			var yearRange = this.model.get('firstBeginDate').getUTCFullYear() + " - " + this.model.get('lastEndDate').getUTCFullYear();

			//Find the year range element
			this.$('#data-coverage-year-range').text(yearRange);
		},

		/*
		 * Shows that this person/group/node has no activity
		 */
		showNoActivity: function(){
			this.$(".show-loading .loading").remove();

			this.$el.addClass("no-activity");
		},

				/**
		 * Convert number of bytes into human readable format
		 *
		 * @param integer bytes     Number of bytes to convert
		 * @param integer precision Number of digits after the decimal separator
		 * @return string
		 */
		bytesToSize: function(bytes, precision){
		    var kilobyte = 1024;
		    var megabyte = kilobyte * 1024;
		    var gigabyte = megabyte * 1024;
		    var terabyte = gigabyte * 1024;

		    if(typeof bytes === "undefined") var bytes = this.get("size");

		    if ((bytes >= 0) && (bytes < kilobyte)) {
		        return bytes + ' B';

		    } else if ((bytes >= kilobyte) && (bytes < megabyte)) {
		        return (bytes / kilobyte).toFixed(precision) + ' KB';

		    } else if ((bytes >= megabyte) && (bytes < gigabyte)) {
		        return (bytes / megabyte).toFixed(precision) + ' MB';

		    } else if ((bytes >= gigabyte) && (bytes < terabyte)) {
		        return (bytes / gigabyte).toFixed(precision) + ' GB';

		    } else if (bytes >= terabyte) {
		        return (bytes / terabyte).toFixed(precision) + ' TB';

		    } else {
		        return bytes + ' B';
		    }
		},

		onClose: function () {
			//Clear the template
			this.$el.html("");

			//Stop listening to changes in the model
			this.stopListening(this.model);

			//Reset the stats model
			this.model = null;
		},

		renderUsageMetricsError: function() {
			// Remove the Spinning icons and display error

			var metricsEls = new Array();

			metricsEls.push('.citations-metrics-list');
			metricsEls.push('#user-downloads-chart');
			metricsEls.push('#user-views-chart');

			// for each of the usage metrics section
			metricsEls.forEach(function(iconEl) {
				var errorMessage = "";

				if(iconEl === ".citations-metrics-list") {
					errorMessage = "Something went wrong while getting the citation metrics.";
				}
				else if(iconEl === '#user-downloads-chart') {
					errorMessage = "Something went wrong while getting the download metrics.";
				}
				else if(iconEl === "#user-views-chart") {
					errorMessage = "Something went wrong while getting the view metrics.";
				}
				else {
					errorMessage = "Something went wrong while getting the usage metrics.";
				}

				// remove the loading icon
				$(iconEl).find('.metric-chart-loading').css("display", "none");

				// display the error message
				MetacatUI.appView.showAlert(
					errorMessage,
					"alert-error",
					$(iconEl)
				);
			});

		},

		/*
		 * getReplicas gets the number of replicas in this member node
		 */
		drawTotalReplicas: function(){

			var view = this;
			var className = "";

			if( this.model.get("totalReplicas") > 0 ){
				var chartData = [{
					count: view.model.get("totalReplicas"),
					className: "packages" + className
				}];

			}
			else{
				var chartData = [{
					count: 0,
					className: "packages no-activity" 
				}];
			}

			var countBadge = new CircleBadge({
				id: "total-replica",
				data: chartData,
				title: "replicas",
				titlePlacement: "inside",
				useGlobalR: true,
				globalR: 60,
				height: 220
			});

			this.$('#total-replicas').html(countBadge.render().el);
			
		}

	});

	return StatsView;
});
