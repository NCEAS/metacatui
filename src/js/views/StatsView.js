/*global define */
define(['jquery', 'underscore', 'backbone', 'd3', 'LineChart', 'BarChart', 'DonutChart', 'CircleBadge',
'collections/Citations', 'models/MetricsModel', 'models/Stats', 'MetricsChart', 'views/CitationListView',
'text!templates/metricModalTemplate.html',  'text!templates/profile.html',
'text!templates/alert.html', 'text!templates/loading.html', 'text!templates/loading-metrics.html', ],
	function($, _, Backbone, d3, LineChart, BarChart, DonutChart, CircleBadge, Citations, MetricsModel,
    StatsModel, MetricsChart, CitationList, MetricModalTemplate, profileTemplate, AlertTemplate,
    LoadingTemplate, MetricsLoadingTemplate) {
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

		metricsLoadingTemplate: _.template(MetricsLoadingTemplate),

		initialize: function(options){
			if(!options) options = {};

			this.title = (typeof options.title === "undefined") ? "Summary of Holdings" : options.title;
			this.description = (typeof options.description === "undefined") ?
					"A summary of all datasets in our catalog." : options.description;
			this.metricsModel = (typeof options.metricsModel === undefined) ? undefined : options.metricsModel;

			this.userType = (typeof options.userType === undefined) ? undefined : options.userType;
			this.userId = (typeof options.userId === undefined) ? undefined : options.userId;
			this.userLabel = (typeof options.userLabel === undefined) ? undefined : options.userLabel;

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

      //The Node info needs to be fetched first since a lot of this code requires info about MNs
      if( !MetacatUI.nodeModel.get("checked") && !MetacatUI.nodeModel.get("error") ){
        this.listenToOnce( MetacatUI.nodeModel, "change:checked error", function(){
          //Remove listeners and render the view, even if there was an error fetching the NodeModel
          this.stopListening(MetacatUI.nodeModel);
          this.render(options);
        });

        this.$el.html(this.loadingTemplate);

        return;
      }

			if ( !options )
				options = {};

			var view = this,
          userIsCN = false,
          nodeId,
          isHostedRepo = false;

			// Check if the node is a coordinating node
			this.userIsCN = userIsCN;
			if( this.userType !== undefined && this.userLabel !== undefined) {
				if (this.userType === "repository") {
					userIsCN = MetacatUI.nodeModel.isCN(this.userId);
					if (userIsCN && typeof isCN !== 'undefined')
						this.userIsCN = true;
				}
			}

			if ( options.nodeSummaryView ) {
				this.nodeSummaryView = true;
				nodeId = MetacatUI.appModel.get("nodeId");
				userIsCN = MetacatUI.nodeModel.isCN(nodeId);

        //Save whether this profile is for a CN
				if (userIsCN && typeof userIsCN !== 'undefined'){
					this.userIsCN = true;
        }
        //Figure out if this profile is for a hosted repo
        else if( nodeId ){
          isHostedRepo = _.contains(MetacatUI.appModel.get("dataoneHostedRepos"), nodeId);
        }

				// Disable the metrics if the nodeId is not available or if it is not a DataONE Hosted Repo
				if (!this.userIsCN && (nodeId === "undefined" || nodeId === null || !isHostedRepo) ) {
					this.hideCitationsChart = true;
					this.hideDownloadsChart = true;
					this.hideViewsChart = true;
          this.hideMetadataAssessment = true;
				}
        else{
          // Overwrite the metrics display flags as set in the AppModel
          this.hideMetadataAssessment = MetacatUI.appModel.get("hideSummaryMetadataAssessment");
          this.hideCitationsChart = MetacatUI.appModel.get("hideSummaryCitationsChart");
          this.hideDownloadsChart = MetacatUI.appModel.get("hideSummaryDownloadsChart");
          this.hideViewsChart = MetacatUI.appModel.get("hideSummaryViewsChart");
        }
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
          hideMetadataAssessment: this.hideMetadataAssessment,
          mdqImageId: nodeId
        });
			}

			//Clear the page
			this.$el.html("");

			//Only trigger the functions that draw SVG charts if d3 loaded correctly
			if(d3){
        //Draw a chart that shows the temporal coverage of all datasets in this collection
				this.listenTo(this.model, 'change:temporalCoverage', this.drawCoverageChart);

        //Draw charts that plot the latest updates of metadata and data files
				this.listenTo(this.model, "change:dataUpdateDates",     this.drawDataUpdatesChart);
        this.listenTo(this.model, "change:metadataUpdateDates", this.drawMetadataUpdatesChart);

        //Render the total file size of all contents in this collection
				this.listenTo(this.model, "change:totalSize", this.displayTotalSize);

        //Render the total number of datasets in this collection
				this.listenTo(this.model, 'change:metadataCount', this.displayTotalCount);

        // Display replicas only for member nodes
				if (this.userType === "repository" && !this.userIsCN)
					this.listenTo(this.model, "change:totalReplicas", this.displayTotalReplicas);

        //Draw charts that show the breakdown of format IDs for metadata and data files
				this.listenTo(this.model, 'change:dataFormatIDs',     this.drawDataCountChart);
				this.listenTo(this.model, 'change:metadataFormatIDs', this.drawMetadataCountChart);
			}

      //When the last coverage endDate is found, draw a title for the temporal coverage chart
			this.listenTo(this.model, 'change:lastEndDate', this.drawCoverageChartTitle);

      //When the total count is updated, check if there if the count is 0, so we can show there is no "activity" for this collection
			this.listenTo(this.model, "change:totalCount", this.showNoActivity);

			// set the header type
			MetacatUI.appModel.set('headerType', 'default');

			// Loading template for the FAIR chart
			var fairLoadingHtml = this.metricsLoadingTemplate({
				message: "Running an assessment report...",
				character: "none",
				type: "FAIR"
			});

			// Loading template for the citations section
			var citationsLoadingHtml = this.metricsLoadingTemplate({
				message: "Scouring our records for publications that cited these datasets...",
				character: "none",
				type: "citations"
			});

			// Loading template for the downloads bar chart
			var downloadsLoadingHtml = this.metricsLoadingTemplate({
				message: "Crunching some numbers...",
				character: "developer",
				type: "barchart"
			});

			// Loading template for the views bar chart
			var viewsLoadingHtml = this.metricsLoadingTemplate({
				message: "Just doing a few more calculations...",
				character: "statistician",
				type: "barchart"
			});

			//Insert the template
			this.$el.html(this.template({
				query: this.model.get('query'),
				title: this.title,
				description: this.description,
				userType: this.userType,
				userIsCN: this.userIsCN,
				fairLoadingHtml: fairLoadingHtml,
				citationsLoadingHtml: citationsLoadingHtml,
				downloadsLoadingHtml: downloadsLoadingHtml,
				viewsLoadingHtml: viewsLoadingHtml,
				hideUpdatesChart: this.hideUpdatesChart,
				hideCitationsChart: this.hideCitationsChart,
				hideDownloadsChart: this.hideDownloadsChart,
				hideViewsChart: this.hideViewsChart,
				hideMetadataAssessment: this.hideMetadataAssessment
			}));

		// Insert the metadata assessment chart
		var view = this;
		if( this.hideMetadataAssessment !== true ){
			this.listenTo(this.model, "change:mdqScoresImage", this.drawMetadataAssessment);
			this.listenTo(this.model, "change:mdqScoresError", function () {
					view.renderMetadataAssessmentError();
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

            var view = this;
            setTimeout(function(){
              if( view.$('.views-metrics, .downloads-metrics, #user-citations').find(".metric-chart-loading").length ){
                view.renderUsageMetricsError();
                view.stopListening(view.metricsModel, "error", view.renderUsageMetricsError);
              }
            }, 6000);
					}
				}
			}

		//Start retrieving data from Solr
		this.model.getAll();

		// Only gather replication stats if the view is a repository view
		if (this.userType === "repository") {
			if (this.userLabel !== undefined)
			{
				var identifier = MetacatUI.appSearchModel.escapeSpecialChar(encodeURIComponent(this.userId));
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
        if( scoresImage ){
          // Replace the preloader figure with the assessment chart
        	this.$("#metadata-assessment-graphic").html(scoresImage);
        }
        // If there was no image received from the MDQ scores service,
				// then show a warning message
        else {
					this.renderMetadataAssessmentError();
        }
      } catch (e) {
        // If there's an error inserting the image, log an error message
        console.log("Error displaying the metadata assessment figure. Error message: " + e);
				this.renderMetadataAssessmentError();
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

		//drawUploadChart will get the upload stats from the stats model and draw a time series cumulative chart
		drawUploadChart: function(){
			//Get the width of the chart by using the parent container width
			var parentEl = this.$('.upload-chart');
			var width = parentEl.width() || null;

			//If there was no first upload, draw a blank chart and exit
			if( (!this.model.get("metadataUploads") || !this.model.get("metadataUploads").length) && (!this.model.get("dataUploads") || !this.model.get("dataUploads").length) ){

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
				this.$('#uploads-title').html("<h2 class='packages fallback'>" + MetacatUI.appView.commaSeparateNumber(this.model.get('totalCount')) + "</h2>");

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
		 * displayTotalCount - renders a simple count of total metadata files/datasets
		 */
		displayTotalCount: function(){

			var className = "quick-stats-count";

			if( !this.model.get("metadataCount") && !this.model.get("dataCount") )
				className += " no-activity";

			var countEl = $(document.createElement("p"))
							.addClass(className)
							.text(MetacatUI.appView.commaSeparateNumber(this.model.get("metadataCount")));

			var titleEl = $(document.createElement("p"))
							.addClass("chart-title")
							.text("datasets");

			this.$('#total-datasets').html(countEl);
			this.$('#total-datasets').append(titleEl);
		},

		/*
		 * displayTotalSize renders a count of the total file size of
		 * all current metadata and data files
		 */
		displayTotalSize: function(){

			var className = "quick-stats-count";
			var count = "";

			if( !this.model.get("totalSize") ){
				count = "0 bytes";
				className += " no-activity";
			}
			else{
				count = this.bytesToSize( this.model.get("totalSize") );
			}

			var countEl = $(document.createElement("p"))
							.addClass(className)
							.text(count);

			var titleEl = $(document.createElement("p"))
							.addClass("chart-title")
							.text("of content");

			this.$('#total-size').html(countEl);
			this.$('#total-size').append(titleEl);
		},

    /**
     * Draws both the metadata and data update date charts.
     * Note that this function may be deprecated in the future.
     *  Views should directly call drawMetadataUpdatesChart() or drawDataUpdatesChart() directly,
     *  since metadata and data dates are fetched via separate AJAX calls.
     */
    drawUpdatesChart: function(){

      //Draw the metadata and data updates charts
      this.drawMetadataUpdatesChart();
      this.drawDataUpdatesChart();

    },

    /**
     * Draws a line chart representing the latest metadata updates over time
     */
    drawMetadataUpdatesChart: function(){

      //Set some configurations for the LineChart
      var chartClasses = "data",
          data;

      //If the number of metadata objects in this data collection is 0, then set the data for the LineChart to null.
      // And add a "no-activity" class to the chart.
      if( !this.model.get("metadataUpdateDates") || !this.model.get("metadataUpdateDates").length ){
        data = null;
        chartClasses += " no-activity";
      }
      else{
        //Use the metadata update dates for the LineChart
        data = this.model.get('metadataUpdateDates');
      }

      //Create the line chart for metadata updates
      var metadataLineChart = new LineChart({
        data: data,
        formatFromSolrFacets: true,
        cumulative: false,
        id: "updates-chart",
        className: chartClasses,
        yLabel: "metadata files updated",
        radius: 2,
        width: this.$('.metadata-updates-chart').width(),
        labelDate: "M-y"
      });

      //Render the LineChart and insert it into the container element
      this.$('.metadata-updates-chart').html(metadataLineChart.render().el);
    },

    /**
    * Draws a line chart representing the latest metadata updates over time
    */
    drawDataUpdatesChart: function(){
      //Set some configurations for the LineChart
      var chartClasses = "data",
          view = this,
          data;

      //Use the data update dates for the LineChart
      if(this.model.get("dataCount")){
        data = this.model.get('dataUpdateDates');
      }
      else{
        //If the number of data objects in this data collection is 0, then set the data for the LineChart to null.
        // And add a "no-activity" class to the chart.
        data = null;
        chartClasses += " no-activity";
      }

      //Create the line chart for data updates
      var dataLineChart = new LineChart({
        data: data,
        formatFromSolrFacets: true,
        cumulative: false,
        id: "updates-chart",
        className: chartClasses,
        yLabel: "data files updated",
        radius: 2,
        width: this.$('.data-updates-chart').width(),
        labelDate: "M-y"
      });

      //Render the LineChart and insert it into the container element
      this.$('.data-updates-chart').html(dataLineChart.render().el);

			// redraw the charts to avoid overlap at different widths
			$(window).on("resize", function(){

				if(!view.hideUpdatesChart)
					view.drawUpdatesChart();

			});

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
			if(!this.model.get('temporalCoverage')){

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
			if((!this.model.get('firstBeginDate')) || (!this.model.get('lastEndDate')) || !this.model.get("temporalCoverage") ) return;

			//Create the range query
			var yearRange = this.model.get('firstBeginDate').getUTCFullYear() + " - " + this.model.get('lastEndDate').getUTCFullYear();

			//Find the year range element
			this.$('#data-coverage-year-range').text(yearRange);
		},

		/*
		 * Shows that this person/group/node has no activity
		 */
		showNoActivity: function(){

      if( this.model.get("metadataCount") === 0 && this.model.get("dataCount") === 0 ){
  			this.$(".show-loading .loading").remove();
  			this.$(".stripe").addClass("no-activity");
				this.$(".metric-chart-loading svg animate").remove();
				$.each($(".metric-chart-loading .message"), function(i,messageEl){
					$(messageEl).html("No metrics to show")
				});
      }

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

		renderUsageMetricsError: function() {
			$.each($('.views-metrics, .downloads-metrics, #user-citations'), function(i,metricEl){
				$(metricEl).find(".message").append("<br><strong>This might take some time. Check back in 24 hours to see these results.</strong>")
			});
		},

		/**
		 * renderMetadataAssessmentError - update the metadata assessment
		 * pre-loading figure to indicate to the user that the assessment is not
		 * available at the moment.
		 */
		renderMetadataAssessmentError: function(){
			try {
				$("#metadata-assessment-graphic .message").append("<br><strong>This might take some time. Check back in 24 hours to see these results.</strong>")
			} catch (e) {
				console.log("Error showing the metadata assessment error message in the metrics. " + e);
			}
		},

		/*
		 * getReplicas gets the number of replicas in this member node
		 */
		displayTotalReplicas: function(){

			var view = this;
			var className = "quick-stats-count";
			var count;

			if( this.model.get("totalReplicas") > 0 ){
				count = MetacatUI.appView.commaSeparateNumber(view.model.get("totalReplicas"));

				var countEl = $(document.createElement("p"))
							.addClass(className)
							.text(count);

				var titleEl = $(document.createElement("p"))
								.addClass("chart-title")
								.text("replicas");

				// display the totals
				this.$('#total-replicas').html(countEl);
				this.$('#total-replicas').append(titleEl);

			}
			else{
				// hide the replicas container if the replica count is 0.
				this.$('#replicas-container').hide()
			}

		},

		onClose: function () {
			//Clear the template
			this.$el.html("");

			//Stop listening to changes in the model
			this.stopListening(this.model);

			//Stop listening to resize
			$(window).off("resize");

			//Reset the stats model
			this.model = null;
		}

	});

	return StatsView;
});
