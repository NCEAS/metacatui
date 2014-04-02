/*global define */
define(['jquery', 'underscore', 'backbone', 'd3', 'views/DonutChartView', 'views/LineChartView', 'views/CircleBadgeView', 'views/BarChartView', 'text!templates/profile.html', 'text!templates/alert.html', 'text!templates/loading.html'], 				
	function($, _, Backbone, d3, DonutChart, LineChart, CircleBadge, BarChart, profileTemplate, AlertTemplate, LoadingTemplate) {
	'use strict';
		
	// Build the main header view of the application
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
			
			//Listen to the stats model so we can draw charts when values are changed
			this.listenTo(statsModel, 'change:dataFormatIDs', 	  this.drawDataCountChart);
			this.listenTo(statsModel, 'change:metadataFormatIDs', this.drawMetadataCountChart);
			
			this.listenTo(statsModel, 'change:firstUpload', 	  this.drawUploadChart);
			
			this.listenTo(statsModel, 'change:lastEndDate', 	  this.getTemporalCoverage);
			this.listenTo(statsModel, 'change:lastEndDate',	  	  this.drawCoverageChartTitle);
			this.listenTo(statsModel, 'change:temporalCoverage',  this.drawCoverageChart);
			
			// set the header type
			appModel.set('headerType', 'default');
			
			//If no query was given, then show all of the repository info
			if(!statsModel.get('query')){
				statsModel.set('query', '*:*');
			}
			
			//Insert the template
			this.$el.html(this.template({
				query: statsModel.get('query')
			}));
			
			//Insert the loading template into the space where the charts will go
			this.$(".chart").html(this.loadingTemplate);
			
			//Is the query for a user only? If so, treat the general info as a user profile
			var statsQuery = statsModel.get('query');
			if(statsQuery.indexOf("rightsHolder") > -1){
				//Extract the uid string from the query string 
				var uid = statsQuery.substring(statsQuery.indexOf("uid="));
				uid = uid.substring(4, uid.indexOf(","));

				//Display the name of the person
				$(".profile-title").text(uid);
			}

			//Start retrieving data from Solr
			this.getDates();
			this.getFormatTypes();	
			
			return this;
		},
		
		
		getDates: function(){
		
			//Get the earliest upload date	
			var query = "q=" + statsModel.get('query') +
						"+dateUploaded:*" +
						"&wt=json" +
						"&fl=dateUploaded" +
						"&rows=1" +
						"&sort=dateUploaded+asc";
			
			//Run the query
			$.get(appModel.get('queryServiceUrl') + query, function(data, textStatus, xhr) {
						if(!data.response.numFound){
							//Save some falsey values if none are found
							statsModel.set('firstUpload', null);
							statsModel.set('totalDateUploaded', 0);
						}
						else{
							// Save the earliest dateUploaded and total found in our model
							statsModel.set('firstUpload', data.response.docs[0].dateUploaded);
							statsModel.set('totalDateUploaded', data.response.numFound);
						}					
			});
			
			//Get the earliest temporal data coverage year
			query = "q=" + statsModel.get('query') +
					"+(beginDate:18*%20OR%20beginDate:19*%20OR%20beginDate:20*)+-obsoletedBy:*" + //Only return results that start with 18,19, or 20 to filter badly formatted data (e.g. 1-01-03 in doi:10.5063/AA/nceas.193.7)
					"&rows=1" +
					"&wt=json" +	
					"&fl=beginDate" +
					"&sort=beginDate+asc";
			
			//Run the query
			$.get(appModel.get('queryServiceUrl') + query, function(data, textStatus, xhr) {
				if(!data.response.numFound){
					//Save some falsey values if none are found
					statsModel.set('firstBeginDate', null);
					statsModel.set('totalBeginDates', 0);
				}
				else{
					// Save the earliest beginDate and total found in our model
					statsModel.set('firstBeginDate', new Date(data.response.docs[0].beginDate));					
					statsModel.set('totalBeginDates', data.response.numFound);
				}
				
				//Get the latest temporal data coverage year
				query = "q=" + statsModel.get('query') +
						"+(endDate:18*%20OR%20endDate:19*%20OR%20endDate:20*)+-obsoletedBy:*" + //Only return results that start with 18,19, or 20 to filter badly formatted data (e.g. 1-01-03 in doi:10.5063/AA/nceas.193.7)
						"&rows=1" +
						"&wt=json" +	
						"&fl=endDate" +
						"&sort=endDate+desc";
				
				//Run the query
				$.get(appModel.get('queryServiceUrl') + query, function(data, textStatus, xhr) {
					if(!data.response.numFound){
						//Save some falsey values if none are found
						statsModel.set('lastEndDate', null);
					}
					else{
						// Save the earliest beginDate and total found in our model - but do not accept a year greater than this current year
						var now = new Date();
						if(new Date(data.response.docs[0].endDate).getUTCFullYear() > now.getUTCFullYear()) statsModel.set('lastEndDate', now);
						else statsModel.set('lastEndDate', new Date(data.response.docs[0].endDate));
					}	
				});
				
			});
			
			

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
		
		/**
		 * drawUploadChart will get the files uploaded statistics and draw the upload time series chart
		 */
		drawUploadChart: function() {
			//If there was no first upload, draw a blank chart and exit
			if(!statsModel.get('firstUpload')){
				
				//Draw the upload chart title
				var uploadChartTitle = new CircleBadge({
					id: "upload-chart-title",
					globalR: 40
				});
				this.$('#uploads-title').prepend(uploadChartTitle.render().el);
				
				var lineChartView = new LineChart(
						{	  id: "upload-chart",
						 	yLabel: "files uploaded",
						 frequency: 0
						});
				
				this.$('.upload-chart').html(lineChartView.render().el);
								
				return;
		}
			
			function setQuery(formatType){
					return query = "q=" + statsModel.get('query') +
					  "+-obsoletedBy:*+formatType:" + formatType +
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
						
						//Set the frequency of our points
						var frequency = 12;
						if(metadataUploadData.length < 20) frequency = 1;
												
						//Check which line we should draw first since the scale will be based off the first line
						if(statsModel.get("metadataUploaded") > statsModel.get("dataUploaded") ){
							//Create the line chart and draw the metadata line
							var lineChartView = new LineChart(
									{	  data: metadataUploadData,
											id: "upload-chart",
									 className: "metadata",
									 	yLabel: "files uploaded",
									 frequency: frequency, 
										radius: 5
									});
							
							viewRef.$('.upload-chart').html(lineChartView.render().el);
							
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
									 frequency: frequency, 
										radius: 4
									 });
							
							viewRef.$('.upload-chart').html(lineChartView.render().el);

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
							className: "chart-title",
							useGlobalR: true,
							globalR: 40
						});
						viewRef.$('#uploads-title').prepend(uploadChartTitle.render().el);
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
			
			//How many years back should we look for temporal coverage?
			var lastYear = statsModel.get('lastEndDate').getUTCFullYear(),
				firstYear = statsModel.get('firstBeginDate').getUTCFullYear(),
				totalYears = lastYear - firstYear,
				today = new Date().getUTCFullYear(),
				yearsFromToday = { fromBeginning: today - firstYear, 
								   fromEnd: today - lastYear
								  };
			
			//Determine our year bin size so that no more than 10 facet.queries are being sent at a time
			var binSize = 1;
			
			if((totalYears > 10) && (totalYears <= 20)){
				binSize = 2;
			}
			else if((totalYears > 20) && (totalYears <= 50)){
				binSize = 5;
			}
			else if((totalYears > 50) && (totalYears <= 100)){
				binSize = 10;
			}
			else if(totalYears > 100){
				binSize = 25;
			}

			//Construct our facet.queries for the beginDate and endDates, starting with all years before this current year
			var fullFacetQuery = "",
				key = "";
			
			for(var yearsAgo = yearsFromToday.fromBeginning; yearsAgo >= yearsFromToday.fromEnd; yearsAgo -= binSize){
				// The query logic here is: If the beginnning year is anytime before or during the last year of the bin AND the ending year is anytime after or during the first year of the bin, it counts.
				if(binSize == 1){
					//Querying for just the current year needs to be treated a bit differently and won't be caught in our for loop 
					if((yearsAgo == 0) && (lastYear == today)){
						fullFacetQuery += "&facet.query={!key=" + lastYear + "}(beginDate:[*%20TO%20NOW%2B1YEARS/YEAR]%20endDate:[NOW-0YEARS/YEAR%20TO%20*])";
					}
					else{
						key = today - yearsAgo;
						fullFacetQuery += "&facet.query={!key=" + key + "}(beginDate:[*%20TO%20NOW-" + (yearsAgo-1) +"YEARS/YEAR]%20endDate:[NOW-" + yearsAgo + "YEARS/YEAR%20TO%20*])";
					}
				}
				else if (yearsAgo <= binSize){
					key = (today - yearsAgo) + "-" + lastYear;
					fullFacetQuery += "&facet.query={!key=" + key + "}(beginDate:[*%20TO%20NOW-" + yearsFromToday.fromEnd +"YEARS/YEAR]%20endDate:[NOW-" + yearsAgo + "YEARS/YEAR%20TO%20*])";
				}
				else{
					key = (today - yearsAgo) + "-" + (today - yearsAgo + binSize-1);
					fullFacetQuery += "&facet.query={!key=" + key + "}(beginDate:[*%20TO%20NOW-" + (yearsAgo - binSize-1) +"YEARS/YEAR]%20endDate:[NOW-" + yearsAgo + "YEARS/YEAR%20TO%20*])";
				}				
			}
			
			
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
				
				/* ---Save this logic in case we want total coverage years later on---
				// Get the total number of years with coverage by counting the number of indices with a value
				// This method isn't perfect because summing by the bin doesn't guarantee each year in that bin is populated
				var keys = Object.keys(data.facet_counts.facet_queries),
					coverageYears = 0,
					remainder = totalYears%binSize;
				
				for(var i=0; i<keys.length; i++){
					if((i == keys.length-1) && data.facet_counts.facet_queries[keys[i]]){
						coverageYears += remainder;
					}
					else if(data.facet_counts.facet_queries[keys[i]]){
						coverageYears += binSize;
					}
				}
				
				//If our bins are more than one year, we need to subtract one bin from our total since we are actually conting the number of years BETWEEN bins (i.e. count one less)
				if(binSize > 1){
					coverageYears -= binSize;
				}
				
								
				statsModel.set('coverageYears',  coverageYears); */
				
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
		drawCoverageChart: function(e, data){
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
		},
		
	});
	return StatsView;		
});
