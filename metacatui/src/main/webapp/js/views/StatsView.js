/*global define */
define(['jquery', 'underscore', 'backbone', 'd3', 'views/DonutChartView', 'views/LineChartView', 'views/CircleBadgeView', 'text!templates/profile.html', 'text!templates/alert.html'], 				
	function($, _, Backbone, d3, DonutChart, LineChart, CircleBadge, profileTemplate, AlertTemplate) {
	'use strict';
		
	// Build the main header view of the application
	var StatsView = Backbone.View.extend({

		el: '#Content',
		
		template: _.template(profileTemplate),
		
		alertTemplate: _.template(AlertTemplate),
		
		initialize: function(){
		},
		
		events: {
			'click .donut-arc' : function(){console.log('hello');}
		},
				
		render: function () {
			console.log('Rendering the stats view');
			
			//Listen to the stats model so we can draw charts when values are changed
			this.listenTo(statsModel, 'change:dataFormatIDs', this.drawDataCountChart);
			this.listenTo(statsModel, 'change:metadataFormatIDs', this.drawMetadataCountChart);
			this.listenTo(statsModel, 'change:firstUpload', this.drawUploadChart);
			
			//Insert the template
			this.$el.html(this.template());
			
			// set the header type
			statsModel.set('headerType', 'default');
			
			//If no query was given, then show all of the repository info
			if(!statsModel.get('query')){
				statsModel.set('query', '*:*');
			}

			//Start retrieving data from Solr
			this.getGeneralInfo();
			this.getFormatTypes();	
			this.getTemporalCoverage();
			
			return this;
		},
		
		
		getGeneralInfo: function(){
		
			//Send a Solr query to retrieve some preliminary information we will need for this person/query
			var query = "q=" + statsModel.get('query') +
				"&rows=1" +
				"&wt=json" +
				"&fl=dateUploaded" +
				"&sort=dateUploaded+asc";
			
			//Run the query
			$.get(appModel.get('queryServiceUrl') + query, function(data, textStatus, xhr) {
				statsModel.set('firstUpload', data.response.docs[0].dateUploaded);
				statsModel.set('totalUploaded', data.response.numFound);
			});
			
			//Is the query for a user only? If so, treat the general info as a user profile
			var statsQuery = statsModel.get('query');
			if(statsQuery.indexOf("rightsHolder") > -1){
				//Extract the uid string from the query string 
				var uid = statsQuery.substring(statsQuery.indexOf("uid="));
				uid = uid.substring(4, uid.indexOf(","));

				//Display the name of the person
				$(".stats-title").text(uid);
			}
			
			
		},
		
		/**
		** getFormatTypes will send three Solr queries to get the formatTypes and formatID statistics and will update the Stats model 
		**/
		getFormatTypes: function(){
			var viewRef = this;
			
			//Build the query to get the format types
			var facetFormatType = "q=" + statsModel.get('query') +
								  "+%28formatType:METADATA%20OR%20formatType:DATA%29+-obsoletedBy:*" +
								  "&wt=json" +
								  "&rows=2" +
							 	  "&group=true" +
								  "&group.field=formatType" +
								  "&group.limit=0" +
								  "&sort=formatType%20desc";
			
			//Run the query
			$.get(appModel.get('queryServiceUrl') + facetFormatType, function(data, textStatus, xhr) {
				
				if(data.grouped.formatType.groups.length == 1){
					
					//Extract the format type if there is only one type found
					if(data.grouped.formatType.groups[0].groupValue == "METADATA"){
						statsModel.set('metadataCount', data.grouped.formatType.groups[0].doclist.numFound);
						statsModel.set('dataCount', 0);
						statsModel.set('dataFormatIDs', ["", 0]);
					}else{
						statsModel.set('dataCount', data.grouped.formatType.groups[0].doclist.numFound);
					}					
				}	
				//If no data or metadata objects were found, display a warning
				else if(data.grouped.formatType.groups.length == 0){
					console.warn('No metadata or data objects found. Stopping view load.');
					var msg = "No data sets were found for that criteria.";
					viewRef.$el.prepend(viewRef.alertTemplate({
						msg: msg,
						classes: "alert-error",
						includeEmail: true
					}));
				}
				else{
					//Extract the format types (because of filtering and sorting they will always return in this order)
					statsModel.set('metadataCount', data.grouped.formatType.groups[0].doclist.numFound);
					statsModel.set('dataCount', data.grouped.formatType.groups[1].doclist.numFound);
				}	

				if(statsModel.get('dataCount') > 0){
					var dataFormatIds = "q=" + statsModel.get('query') +
					"+formatType:DATA+-obsoletedBy:*" +
					"&facet=true" +
					"&facet.field=formatId" +
					"&facet.limit=-1" +
					"&facet.mincount=1" +
					"&wt=json" +
					"&rows=0";
					
					//Now get facet counts of the data format ID's 
					$.get(appModel.get('queryServiceUrl') + dataFormatIds, function(data, textStatus, xhr) {
						statsModel.set('dataFormatIDs', data.facet_counts.facet_fields.formatId);
					}).error(function(){
						console.warn('Solr query error for data formatIds - not vital to page, so we will keep going');
					});
					
				}
				
				if(statsModel.get('metadataCount') > 0){
					var metadataFormatIds = "q=" + statsModel.get('query') +
					"+formatType:METADATA+-obsoletedBy:*" +
					"&facet=true" +
					"&facet.field=formatId" +
					"&facet.limit=-1" +
					"&facet.mincount=1" +
					"&wt=json" +
					"&rows=0";
					
					//Now get facet counts of the metadata format ID's 
					$.get(appModel.get('queryServiceUrl') + metadataFormatIds, function(data, textStatus, xhr) {
						statsModel.set('metadataFormatIDs', data.facet_counts.facet_fields.formatId);
					}).error(function(){
						console.warn('Solr query error for metadata formatIds - not vital to page, so we will keep going');
					});
				}
					
				//Insert the counts into the DOM
				$('#data-chart').prepend(statsModel.get('dataCount'));
				$('#metadata-chart').prepend(statsModel.get('metadataCount'));
						
			//Display error when our original Solr query went wrong
			}).error(function(){
				console.error('Solr query returned error, stopping view load');
				var msg = "It seems there has been an error. Please try again.";
				viewRef.$el.prepend(viewRef.alertTemplate({
					msg: msg,
					classes: "alert-error",
					includeEmail: true
				}));
			});

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
			
			//Draw a donut chart
			var donut = new DonutChart({
							id: "data-chart",
							data: data, 
							total: statsModel.get('dataCount'),
							colors: statsModel.style.dataChartColors, 
							titleText: "data files", 
							titleCount: dataCount,
							svgClass: svgClass
						});
			this.$('.format-charts').append(donut.render().el);
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
			
			//Draw a donut chart
			var donut = new DonutChart({
							id: "metadata-chart",
							data: data,
							total: statsModel.get('metadataCount'),
							colors: statsModel.style.metadataChartColors, 
							titleText: "metadata files", 
							titleCount: metadataCount,
							svgClass: svgClass
						});
			
			this.$('.format-charts').append(donut.render().el); 
		},
		
		/**
		 * drawUploadChart will get the files uploaded statistics and draw the upload time series chart
		 */
		drawUploadChart: function() {
			
				function setQuery(formatType){
					return query = "q=" + statsModel.get('query') +
					  "+formatType:" + formatType +
					  "&wt=json" +
					  "&rows=0" +
					  "&facet=true" +
					  "&facet.missing=true" + //Include months that have 0 uploads
					  "&facet.limit=-1" +
					  "&facet.range=dateUploaded" +
					  "&facet.range.start=" + statsModel.get('firstUpload') +
					  "&facet.range.end=NOW" +
					  "&facet.range.gap=%2B1MONTH";
				}
				
				function formatUploadData(counts){
					//Format the data before we draw the chart
					//We will take only the first 10 characters of the date
					//To make it a cumulative chart, we will keep adding to the count
					var uploadData = [];
					var lastCount = 0;
					for(var i=0; i < counts.length; i+=2){
						uploadData.push({date: counts[i].substr(0, 10), count: lastCount + counts[i+1]});
						lastCount += counts[i+1];
					}
					
					return uploadData;
				}
							
				var viewRef = this;
							
				//First query the Solr index to get the dates uploaded values
				var query = setQuery("METADATA");
	
				//Run the query
				$.get(appModel.get('queryServiceUrl') + query, function(data, textStatus, xhr) {
					statsModel.set("metadataUploaded", data.response.numFound);
										
					//Format our data for the line chart drawing function
					var counts = data.facet_counts.facet_ranges.dateUploaded.counts;					
					var metadataUploadData = formatUploadData(counts);
									
					/* Now do the same thing for DATA uploads */
					query = setQuery("DATA");
					
					$.get(appModel.get('queryServiceUrl') + query, function(data, textStatus, xhr) {
						statsModel.set("dataUploaded", data.response.numFound);
												
						//Format our data for the line chart drawing function
						counts = data.facet_counts.facet_ranges.dateUploaded.counts;
						var dataUploadData = formatUploadData(counts);
						
						//Check which line we should draw first since the scale will be based off the first line
						if(statsModel.get("metadataUploaded") > statsModel.get("dataUploaded") ){
							//Create the line chart and draw the metadata line
							var lineChartView = new LineChart(
									{	  data: metadataUploadData,
											id: "upload-chart",
									 className: "metadata",
									 	yLabel: "files uploaded",
									 frequency: 12, 
										radius: 4, 
									 labelDate: "y"});
							
							viewRef.$('.upload-chart').append(lineChartView.render().el);
							//Add a line to our chart for data uploads
							lineChartView.className = "data";
							lineChartView.addLine(dataUploadData);
						}
						else{
							var lineChartView = new LineChart(
									{	  data: dataUploadData,
											id: "upload-chart",
									 className: "data",
									 	yLabel: "files uploaded",
									 frequency: 12, 
										radius: 4, 
									 labelDate: "y"});
							
							viewRef.$('.upload-chart').append(lineChartView.render().el);
							lineChartView.className = "metadata";
							//Add a line to our chart for metadata uploads
							lineChartView.addLine(metadataUploadData);
						}
						
						//Get information for our upload chart title
						var titleChartData = [
						                      {count: statsModel.get("metadataUploaded"), label: "metadata", className: "metadata"},
										      {count: statsModel.get("dataUploaded"), 	  label: "data", 	 className: "data"}
											 ];
						
						//Draw the upload chart title
						var uploadChartTitle = new CircleBadge({
							id: "upload-chart-title",
							data: titleChartData,
							title: "uploads and revisions",
							className: "chart-title",
							useGlobalR: true
						});
						viewRef.$('.upload-chart').prepend(uploadChartTitle.render().el);
					})
					.error(function(){
						console.warn('Solr query for data upload info returned error. Continuing with load.');
						$(".upload-chart").prepend(viewRef.alertTemplate({
							msg: "Oops, something happened and we can't display the uploaded files graph.",
							classes: "alert-warn",
							includeEmail: false
						}));
					});
				})
				.error(function(){
					console.warn('Solr query for metadata upload info returned error. Continuing with load.');
					$(".upload-chart").prepend(viewRef.alertTemplate({
						msg: "Oops, something happened and we can't display the uploaded files graph.",
						classes: "alert-warn",
						includeEmail: false
					}));
				});
				
			
		},
		
		/* getTemporalCoverage
		 * Get the temporal coverage of this query/user from Solr
		 */
		getTemporalCoverage: function(){
			//Construct our query to get the begin and end date of all objects for this query
		/*	var query = "q=" + statsModel.get('query') +
			  "fl=beginDate,endDate" +
			  "-obsoletedBy:*" +
			  "&wt=json" +
			  "&rows=100000";
			
			var viewRef = this;
			
			$.get(appModel.get('queryServiceUrl') + query, function(data, textStatus, xhr) {
				
			}).error(function(){
				//Log this warning and display a warning where the graph should be
				console.warn("Solr query for temporal coverage failed. Displaying a warning.");
				$(".temporal-coverage-chart").prepend(viewRef.alertTemplate({
					msg: "Oops, something happened and we can't display the data coverage graph.",
					classes: "alert-warn",
					includeEmail: false
				}));
			}); */
		},
		
		//Function to add commas to large numbers
		commaSeparateNumber: function(val){
		    while (/(\d+)(\d{3})/.test(val.toString())){
		      val = val.toString().replace(/(\d+)(\d{3})/, '$1'+','+'$2');
		    }
		    return val;
		 },
		
		onClose: function () {			
			console.log('Closing the stats view');
		},
		
	});
	return StatsView;		
});
