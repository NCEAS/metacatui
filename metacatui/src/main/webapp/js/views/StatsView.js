/*global define */
define(['jquery', 'underscore', 'backbone', 'd3', 'views/DonutChartView', 'views/LineChartView', 'views/CircleBadgeView', 'views/BarChartView', 'text!templates/profile.html', 'text!templates/alert.html'], 				
	function($, _, Backbone, d3, DonutChart, LineChart, CircleBadge, BarChart, profileTemplate, AlertTemplate) {
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
			this.listenTo(statsModel, 'change:dataFormatIDs', 	  this.drawDataCountChart);
			this.listenTo(statsModel, 'change:metadataFormatIDs', this.drawMetadataCountChart);
			this.listenTo(statsModel, 'change:firstUpload', 	  this.drawUploadChart);
			this.listenTo(statsModel, 'change:firstBeginDate', 	  this.getTemporalCoverage);
			this.listenTo(statsModel, 'change:temporalCoverage',  this.drawCoverageChart);
			this.listenTo(statsModel, 'change:coverageYears', 	  this.drawCoverageChartTitle);
			
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
			
			return this;
		},
		
		
		getGeneralInfo: function(){
		
			//Send a Solr query to retrieve some preliminary information we will need for this person/query	
			var query = "q=" + statsModel.get('query') +
						"&rows=0" +
						"&wt=json" +
						"&fl=dateUploaded,beginDate" +
						"&group=true" +
						"&group.rows=1" +
						"&group.query=dateUploaded:*" + 
						"&group.sort=dateUploaded+asc" +
						"&group.query=(beginDate:18*%20OR%20beginDate:19*%20OR%20beginDate:20*)+-obsoletedBy:*" + //Only return results that start with 18,19, or 20 to filter badly formatted data (e.g. 1-01-03 in doi:10.5063/AA/nceas.193.7)
						"&group.sort=beginDate+asc"; //Only return results that start with 18,19, or 20 to filter badly formatted data (e.g. 1-01-03 in doi:10.5063/AA/nceas.193.7)
			
			//Run the query
			$.get(appModel.get('queryServiceUrl') + query, function(data, textStatus, xhr) {
				var keys = Object.keys(data.grouped);	
				for(var i=0; i<keys.length; i++){
					//Which key is this? Find out by searching for beginDate and dateUploaded
					if(keys[i].indexOf("dateUploaded") > -1){
						//This is our group with the earliest dateUploaded
						if(!data.grouped[keys[i]].doclist.numFound){
							//Save some falsey values if none are found
							statsModel.set('firstUpload', null);
							statsModel.set('totalDateUploaded', 0);
						}
						else{
							// Save the earliest dateUploaded and total found in our model
							statsModel.set('firstUpload', data.grouped[keys[i]].doclist.docs[0].dateUploaded);
							statsModel.set('totalDateUploaded', data.grouped[keys[i]].doclist.numFound);
						}
					}
					else if(keys[i].indexOf("beginDate") > -1){
						// This is the group with our earliest beginDate
						if(!data.grouped[keys[i]].doclist.numFound){
							//Save some falsey values if none are found
							statsModel.set('firstBeginDate', null);
							statsModel.set('totalBeginDates', 0);
						}
						else{
							// Save the earliest beginDate and total found in our model
							statsModel.set('firstBeginDate', new Date(data.grouped[keys[i]].doclist.docs[0].beginDate));
							statsModel.set('totalBeginDates', data.grouped[keys[i]].doclist.numFound);
						}						
					}
				}
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
				var formats = data.grouped.formatType.groups;
				
				if(formats.length == 1){	//Only one format type was found				
					if(formats[0].groupValue == "METADATA"){ //That one format type is metadata
						statsModel.set('metadataCount', formats[0].doclist.numFound);
						statsModel.set('dataCount', 0);
						statsModel.set('dataFormatIDs', ["", 0]);
					}else{
						statsModel.set('dataCount', formats[0].doclist.numFound);
						statsModel.set('metadataCount', 0);
						statsModel.set('metadataFormatIDs', ["", 0]);
					}					
				}	
				//If no data or metadata objects were found, draw blank charts
				else if(formats.length == 0){
					console.warn('No metadata or data objects found. Draw some blank charts.');
					
					//Store falsey data
					statsModel.set('dataCount', 0);
					statsModel.set('metadataCount', 0);
					statsModel.set('metadataFormatIDs', ["", 0]);
					statsModel.set('dataFormatIDs', ["", 0]);
					
					return;
				}
				else{
					//Extract the format types (because of filtering and sorting they will always return in this order)
					statsModel.set('metadataCount', formats[0].doclist.numFound);
					statsModel.set('dataCount', formats[1].doclist.numFound);
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
			//If there was no first upload, draw a blank chart and exit
			if(!statsModel.get('firstUpload')) return;
			
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
							
							//If no data files were uploaded, we don't want to draw the data file line
							if(statsModel.get("dataUploaded")){
								//Add a line to our chart for data uploads
								lineChartView.className = "data";
								lineChartView.addLine(dataUploadData);
							}
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

							//If no data files were uploaded, we don't want to draw the data file line
							if(statsModel.get("metadataUploaded")){
								//Add a line to our chart for metadata uploads
								lineChartView.className = "metadata";
								lineChartView.addLine(metadataUploadData);
							}
						}
						
						//Get information for our upload chart title
						var titleChartData = [],
							metadataUploaded = statsModel.get("metadataUploaded"),
							dataUploaded = statsModel.get("dataUploaded"),
							metadataClass = "metadata",
							dataClass = "data";						
						
						if(metadataUploaded == 0) metadataClass = "default";
						if(dataUploaded == 0) dataClass = "default";
						
						var titleChartData = [
						                      {count: statsModel.get("metadataUploaded"), label: "metadata", className: metadataClass},
										      {count: statsModel.get("dataUploaded"), 	  label: "data", 	 className: dataClass}
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
			//If no results were found for this query, do not draw a chart
			if(!statsModel.get('firstBeginDate')) return;
			
			//Construct our query to get the begin and end date of all objects for this query
			var facetQuery = function(numYears, key){
				if(numYears==0){
					return "&facet.query=%7B!key=" + key + "%7D(beginDate:[*%20TO%20NOW]%20endDate:[NOW-1YEARS/YEAR%20TO%20NOW])";
				}
				return "&facet.query={!key=" + key + "}(beginDate:[*%20TO%20NOW-" + (numYears-1) +"YEARS/YEAR]%20endDate:[NOW-" + numYears + "YEARS/YEAR%20TO%20*])";
			}
			
			//How many years back should we look for temporal coverage?
			var now = new Date().getFullYear();
			var totalYears = now - statsModel.get('firstBeginDate').getFullYear(); 
			
			//Determine our year interval/bin size so that no more than 10 facet.queries are being sent at a time
			var interval = 1;
			
			if((totalYears > 10) && (totalYears <= 20)){
				interval = 2;
			}
			else if((totalYears > 20) && (totalYears <= 50)){
				interval = 5;
			}
			else if((totalYears > 50) && (totalYears <= 100)){
				interval = 10;
			}
			else if(totalYears > 100){
				interval = 25;
			}
			
			//Construct our facet.queries for the beginDate and endDates, starting with all years before this current year
			var fullFacetQuery = "";
			for(var i=totalYears; i>0; i-=interval){
				fullFacetQuery += facetQuery(i, now-i);
			}
			
			//Always query for the current year
			fullFacetQuery += facetQuery(0, now);

			//The full query			
			var query = "q=" + statsModel.get('query') +
			  "+(beginDate:18*%20OR%20beginDate:19*%20OR%20beginDate:20*)" + //Only return results that start with 18,19, or 20 to filter badly formatted data (e.g. 1-01-03 in doi:10.5063/AA/nceas.193.7)
			  "+-obsoletedBy:*" +
			  "&wt=json" +
			  "&rows=0" +
			  "&facet=true" +
			  "&facet.limit=30000" + //Put some reasonable limit here so we don't wait forever for this query
			  "&facet.missing=true" + //We want to retrieve years with 0 results
			  fullFacetQuery;
			
			var viewRef = this;
			
			$.get(appModel.get('queryServiceUrl') + query, function(data, textStatus, xhr) {
				statsModel.set('temporalCoverage', data.facet_counts.facet_queries);
				
				// Get the total number of years with coverage by counting the number of indices with a value
				// This method isn't perfect because summing by the interval doesn't guarantee each year in that interval is populated
				var keys = Object.keys(data.facet_counts.facet_queries),
					coverageYears = 0,
					remainder = totalYears%interval;
				
				for(var i=0; i<keys.length; i++){
					if((i == keys.length-1) && data.facet_counts.facet_queries[keys[i]]){
						coverageYears += remainder;
					}
					else if(data.facet_counts.facet_queries[keys[i]]){
						coverageYears += interval;
					}
					
				}
								
				statsModel.set('coverageYears',  coverageYears);
				
			}).error(function(){
				//Log this warning and display a warning where the graph should be
				console.warn("Solr query for temporal coverage failed. Displaying a warning.");
				$(".temporal-coverage-chart").prepend(viewRef.alertTemplate({
					msg: "Oops, something happened and we can't display the data coverage graph.",
					classes: "alert-warn",
					includeEmail: false
				}));
			}); 
		},
		
		//Draw a bar chart for the temporal coverage 
		drawCoverageChart: function(){
			
			var barChart = new BarChart({
				data: statsModel.get("temporalCoverage"),
				formatFromSolrFacets: true,
				id: "temporal-coverage-chart",
				yLabel: "data packages",
				yFormat: d3.format(",d"),
				barClass: "packages",
				roundedRect: true
			});
			this.$('.temporal-coverage-chart').append(barChart.render().el);
			
		},
		
		drawCoverageChartTitle: function(){
			//Match the radius to the metadata and data uploads chart title 
			var radius = parseInt(this.$('#upload-chart-title .metadata').attr('r')) || null;		
			
			//Also draw the title
			var coverageTitle = new CircleBadge({
				data: [{count: statsModel.get('coverageYears'), className: "packages", r: radius}],
				id: "temporal-coverage-title",
				title: "years of data coverage"
			});
			this.$('.temporal-coverage-chart').prepend(coverageTitle.render().el);
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
