/*global define */
define(['jquery', 'underscore', 'backbone', 'd3', 'LineChart', 'BarChart', 'DonutChart', 'CircleBadge', 'text!templates/profile.html', 'text!templates/alert.html', 'text!templates/loading.html'], 				
	function($, _, Backbone, d3, LineChart, BarChart, DonutChart, CircleBadge, profileTemplate, AlertTemplate, LoadingTemplate) {
	'use strict';
			
	var StatsView = Backbone.View.extend({

		el: '#Content',
		
		template: _.template(profileTemplate),
		
		alertTemplate: _.template(AlertTemplate),
		
		loadingTemplate: _.template(LoadingTemplate),
				
		initialize: function(){

		},
				
		render: function () {
			console.log('Rendering the stats view');
			
			//Clear the page first
			this.$el.html("");
			
			//Only trigger the functions that draw SVG charts if d3 loaded correctly
			if(d3){
				this.listenTo(statsModel, 'change:dataUploadDates',   this.drawUploadChart);
				this.listenTo(statsModel, 'change:temporalCoverage',  this.drawCoverageChart);
			}
			
			this.listenTo(statsModel, 'change:dataUploads', 	  this.drawUploadTitle);
			this.listenTo(statsModel, 'change:dataFormatIDs', 	  this.drawDataCountChart);
			this.listenTo(statsModel, 'change:metadataFormatIDs', this.drawMetadataCountChart);
			this.listenTo(statsModel, 'change:lastEndDate',	  	  this.drawCoverageChartTitle);

			
			// set the header type
			appModel.set('headerType', 'default');
			
			//Insert the template
			this.$el.html(this.template({
				query: statsModel.get('query')
			}));
			
			//Insert the loading template into the space where the charts will go
			if(d3){
				this.$(".chart").html(this.loadingTemplate);
			}
			//If SVG isn't supported, insert an info warning
			else{
				this.$el.prepend(this.alertTemplate({
					classes: "alert-info",
					msg: "Please upgrade your browser or use a different browser to view graphs of these statistics.",
					email: false
				}))
			}

			//Start retrieving data from Solr
			statsModel.getAll();	
		
			return this;
		},
		
		drawDataCountChart: function(){
			var dataCount = statsModel.get('dataCount');
			var data = statsModel.get('dataFormatIDs');

			if(dataCount){	
				var svgClass = "data";
			}
			else{	//Are we drawing a blank chart (i.e. 0 data objects found)?
				var svgClass = "data default";
			}
			
			//If d3 isn't supported in this browser or didn't load correctly, insert a text title instead
			if(!d3){
				this.$('.format-charts-data').html("<h2 class='" + svgClass + " fallback'>" + this.commaSeparateNumber(dataCount) + " data files</h2>");
				
				return;
			}
			
			//Draw a donut chart
			var donut = new DonutChart({
							id: "data-chart",
							data: data, 
							total: statsModel.get('dataCount'),
							titleText: "data files", 
							titleCount: dataCount,
							svgClass: svgClass,
							countClass: "data",
							height: 300
						});
			this.$('.format-charts-data').html(donut.render().el);
		},

		drawMetadataCountChart: function(){
			var metadataCount = statsModel.get("metadataCount");
			var data = statsModel.get('metadataFormatIDs');	
			
			if(metadataCount){
				var svgClass = "metadata";
			}
			else{	//Are we drawing a blank chart (i.e. 0 data objects found)?
				var svgClass = "metadata default";
			}
			
			//If d3 isn't supported in this browser or didn't load correctly, insert a text title instead
			if(!d3){
				this.$('.format-charts-metadata').html("<h2 class='" + svgClass + " fallback'>" + this.commaSeparateNumber(metadataCount) + " metadata files</h2>");
				
				return;
			}
			
			//Draw a donut chart
			var donut = new DonutChart({
							id: "metadata-chart",
							data: data,
							total: statsModel.get('metadataCount'),
							titleText: "metadata files", 
							titleCount: metadataCount,
							svgClass: svgClass,
							countClass: "metadata",
							height: 300,
							formatLabel: function(name){
								if((name !== undefined) && (name.indexOf("//ecoinformatics.org") > -1)){
									//EML - extract the version only
									if(name.substring(0,4) == "eml:") name = name.substr(name.lastIndexOf("/")+1).toUpperCase().replace('-', ' ');
									
									//EML modules
									if(name.indexOf("-//ecoinformatics.org//eml-") > -1) name = "EML " + name.substring(name.indexOf("//eml-")+6, name.lastIndexOf("-")) + " " + name.substr(name.lastIndexOf("-")+1, 5); 
								}
								
								return name;
							}
						});
			
			this.$('.format-charts-metadata').html(donut.render().el); 
		},
		
		//drawUploadChart will get the upload stats from the stats model and draw a time series cumulative chart
		drawUploadChart: function(){
			
			//If there was no first upload, draw a blank chart and exit
			if(!statsModel.get('firstUpload')){
				
				var lineChartView = new LineChart(
						{	  id: "upload-chart",
						 	yLabel: "files uploaded",
						 frequency: 0
						});
				
				this.$('.upload-chart').html(lineChartView.render().el);
					
				return;
			}
				
			//Set the frequency of our points
			var frequency = 12;
									
			//Check which line we should draw first since the scale will be based off the first line
			if(statsModel.get("metadataUploads") > statsModel.get("dataUploads") ){
				
				//If there isn't a lot of point to graph, draw points more frequently on the line
				if(statsModel.get("metadataUploadDates").length < 40) frequency = 1;
				
				//Create the line chart and draw the metadata line
				var lineChartView = new LineChart(
						{	  data: statsModel.get('metadataUploadDates'),
			  formatFromSolrFacets: true,
						cumulative: true,
								id: "upload-chart",
						 className: "metadata",
						 	yLabel: "files uploaded",
						 frequency: frequency, 
							radius: 5
						});
				
				this.$('.upload-chart').html(lineChartView.render().el);
			
				//Only draw the data file line if there was at least one uploaded
				if(statsModel.get("dataUploads")){
					//Add a line to our chart for data uploads
					lineChartView.className = "data";
					lineChartView.addLine(statsModel.get('dataUploadDates'));
				}
			}
			else{
					var lineChartView = new LineChart(
							{	  data: statsModel.get('dataUploadDates'),
				  formatFromSolrFacets: true,
							cumulative: true,
									id: "upload-chart",
							 className: "data",
							 	yLabel: "files uploaded",
							 frequency: frequency, 
								radius: 4
							 });
					
					this.$('.upload-chart').html(lineChartView.render().el);

					//If no data files were uploaded, we don't want to draw the data file line
					if(statsModel.get("metadataUploads")){
						//Add a line to our chart for metadata uploads
						lineChartView.className = "metadata";
						lineChartView.addLine(statsModel.get('metadataUploadDates'));
					}
				}
		},
		
		//drawUploadTitle will draw a circle badge title for the uploads time series chart
		drawUploadTitle: function(){
			
			//If d3 isn't supported in this browser or didn't load correctly, insert a text title instead
			if(!d3){
				this.$('#uploads-title').html("<h2 class='packages fallback'>" + this.commaSeparateNumber(statsModel.get('totalUploads')) + "</h2>");
				
				return;
			}
			
			if(!statsModel.get('dataUploads') && !statsModel.get('metadataUploads')){
				//Draw the upload chart title
				var uploadChartTitle = new CircleBadge({
					id: "upload-chart-title",
					globalR: 40
				});
				
				this.$('#uploads-title').prepend(uploadChartTitle.render().el);
				
				return;
			}
			
			//Get information for our upload chart title
			var titleChartData = [],
				metadataUploads = statsModel.get("metadataUploads"),
				dataUploads = statsModel.get("dataUploads"),
				metadataClass = "metadata",
				dataClass = "data";						
			
			if(metadataUploads == 0) metadataClass = "default";
			if(dataUploads == 0) dataClass = "default";
			
			
			var titleChartData = [
			                      {count: statsModel.get("metadataUploads"), label: "metadata", className: metadataClass},
							      {count: statsModel.get("dataUploads"), 	  label: "data", 	 className: dataClass}
								 ];
			
			//Draw the upload chart title
			var uploadChartTitle = new CircleBadge({
				id: "upload-chart-title",
				data: titleChartData,
				className: "chart-title",
				useGlobalR: true,
				globalR: 40
			});
			this.$('#uploads-title').prepend(uploadChartTitle.render().el);
		},
		
		
		//Draw a bar chart for the temporal coverage 
		drawCoverageChart: function(e, data){
			
			// If results were found but none have temporal coverage, draw a default chart
			if(!statsModel.get('firstBeginDate')){

				//Draw a default bar chart
				var barChart = new BarChart({
					id: "temporal-coverage-chart",
					yLabel: "data packages"
				});
				this.$('.temporal-coverage-chart').html(barChart.render().el);
									
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
						roundedRadius: 10,
						barLabelClass: "packages"
					};
			
			var barChart = new BarChart(options);
			this.$('.temporal-coverage-chart').html(barChart.render().el);
			
		},
		
		drawCoverageChartTitle: function(){
			if((!statsModel.get('firstBeginDate')) || (!statsModel.get('lastEndDate'))) return;
			
			//Create the range query
			var yearRange = statsModel.get('firstBeginDate').getUTCFullYear() + " - " + statsModel.get('lastEndDate').getUTCFullYear();
			
			//Find the year range element
			this.$('#data-coverage-year-range').text(yearRange);
		},
		
		//Function to add commas to large numbers
		commaSeparateNumber: function(val){
		    while (/(\d+)(\d{3})/.test(val.toString())){
		      val = val.toString().replace(/(\d+)(\d{3})/, '$1'+','+'$2');
		    }
		    return val;
		 },
		
		onClose: function () {			
			//Clear the template
			this.$el.html("");
			
			//Stop listening to changes in the model
			this.stopListening(statsModel);
			
			console.log('Closing the stats view');
		}
		
	});
	
	return StatsView;		
});
