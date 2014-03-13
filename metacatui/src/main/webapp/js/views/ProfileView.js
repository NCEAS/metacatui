/*global define */
define(['jquery', 'underscore', 'backbone', 'd3', 'views/DonutChartView', 'views/LineChartView', 'text!templates/profile.html', 'text!templates/alert.html'], 				
	function($, _, Backbone, d3, DonutChart, LineChart, ProfileTemplate, AlertTemplate) {
	'use strict';
		
	// Build the main header view of the application
	var ProfileView = Backbone.View.extend({

		el: '#Content',
		
		template: _.template(ProfileTemplate),
		
		alertTemplate: _.template(AlertTemplate),
		
		initialize: function(){
		},
		
		events: {
			'click .donut-arc' : function(){console.log('hello');}
		},
				
		render: function () {
			console.log('Rendering the profile view');
			
			/*//Stop listening to the profile model while we reset it
			this.stopListening(profileModel);
			//Reset the profile model
			profileModel.clear().set(profileModel.defaults);	*/
			
			//Now listen again to the profile model so we can draw charts when values are changed
			this.listenTo(profileModel, 'change:dataFormatIDs', this.drawDataCountChart);
			this.listenTo(profileModel, 'change:metadataFormatIDs', this.drawMetadataCountChart);
			this.listenTo(profileModel, 'change:firstUpload', this.drawUploadChart);
			
			//Insert the template
			this.$el.html(this.template());
			
			// set the header type
			profileModel.set('headerType', 'default');
			
			//If no query was given, then show all of the repository info
			if(!profileModel.get('query')){
				profileModel.set('query', '*:*');
			}

			//Start retrieving data from Solr
			this.getGeneralInfo();
			this.getFormatTypes();	
			this.getTemporalCoverage();
			
			return this;
		},
		
		
		getGeneralInfo: function(){
		
			//Send a Solr query to retrieve some preliminary information we will need for this person/query
			var query = "q=" + profileModel.get('query') +
				"&rows=1" +
				"&wt=json" +
				"&fl=dateUploaded" +
				"&sort=dateUploaded+asc";
			
			//Run the query
			$.get(appModel.get('queryServiceUrl') + query, function(data, textStatus, xhr) {
				profileModel.set('firstUpload', data.response.docs[0].dateUploaded);
				profileModel.set('totalUploaded', data.response.numFound);
			});
			
			//Is the query for a user only? If so, treat the general info as a user profile
			var query = profileModel.get('query');
			
			
		},
		
		/**
		** getFormatTypes will send three Solr queries to get the formatTypes and formatID statistics and will update the Profile model 
		**/
		getFormatTypes: function(){
			var viewRef = this;
			
			//Build the query to get the format types
			var facetFormatType = "q=" + profileModel.get('query') +
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
						profileModel.set('metadataCount', data.grouped.formatType.groups[0].doclist.numFound);
						profileModel.set('dataCount', 0);
						profileModel.set('dataFormatIDs', ["", 0]);
					}else{
						profileModel.set('dataCount', data.grouped.formatType.groups[0].doclist.numFound);
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
					profileModel.set('metadataCount', data.grouped.formatType.groups[0].doclist.numFound);
					profileModel.set('dataCount', data.grouped.formatType.groups[1].doclist.numFound);
				}	

				if(profileModel.get('dataCount') > 0){
					var dataFormatIds = "q=" + profileModel.get('query') +
					"+formatType:DATA+-obsoletedBy:*" +
					"&facet=true" +
					"&facet.field=formatId" +
					"&facet.limit=-1" +
					"&facet.mincount=1" +
					"&wt=json" +
					"&rows=0";
					
					//Now get facet counts of the data format ID's 
					$.get(appModel.get('queryServiceUrl') + dataFormatIds, function(data, textStatus, xhr) {
						profileModel.set('dataFormatIDs', data.facet_counts.facet_fields.formatId);
					}).error(function(){
						console.warn('Solr query error for data formatIds - not vital to page, so we will keep going');
					});
					
				}
				
				if(profileModel.get('metadataCount') > 0){
					var metadataFormatIds = "q=" + profileModel.get('query') +
					"+formatType:METADATA+-obsoletedBy:*" +
					"&facet=true" +
					"&facet.field=formatId" +
					"&facet.limit=-1" +
					"&facet.mincount=1" +
					"&wt=json" +
					"&rows=0";
					
					//Now get facet counts of the metadata format ID's 
					$.get(appModel.get('queryServiceUrl') + metadataFormatIds, function(data, textStatus, xhr) {
						profileModel.set('metadataFormatIDs', data.facet_counts.facet_fields.formatId);
					}).error(function(){
						console.warn('Solr query error for metadata formatIds - not vital to page, so we will keep going');
					});
				}
					
				//Insert the counts into the DOM
				$('#data-chart').prepend(profileModel.get('dataCount'));
				$('#metadata-chart').prepend(profileModel.get('metadataCount'));
						
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
			var dataCount = profileModel.get('dataCount');
			var data = profileModel.get('dataFormatIDs');
			//Format our Solr facet counts for the donut chart rendering
			data = this.formatDonutData(data, profileModel.get('dataCount'));

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
							colors: profileModel.style.dataChartColors, 
							titleText: "data files", 
							titleCount: dataCount,
							svgClass: svgClass
						});
			this.$('.format-charts').append(donut.render().el);
		},

		drawMetadataCountChart: function(){
			var metadataCount = profileModel.get("metadataCount");
			//Format our Solr facet counts for the donut chart rendering
			var data = profileModel.get('metadataFormatIDs');	
			data = this.formatDonutData(data, profileModel.get('metadataCount'));
			
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
							colors: profileModel.style.metadataChartColors, 
							titleText: "metadata files", 
							titleCount: metadataCount,
							svgClass: svgClass
						});
			
			this.$('.format-charts').append(donut.render().el); 
		},
		
		//** This function will loop through the raw facet counts response array from Solr and returns
		//   a new array of objects that are in the format needed to draw a donut chart
		// Format of data output:
		//		  label: formatID from array given	perc: percentage of total	count: count from array given
		//		[{label: "Format ID", perc: .50, count: 20}]
		// param counts: array of formatID names followed by their count, identical to Solr facet format. e.g. ["text/CSV", 10, "text", 20]
		formatDonutData: function(counts, total){
			var newArray = [];
			var otherPercent = 0;
			var otherCount = 0;
			
			for(var i=1; i<=counts.length; i+=2){
				if(counts[i]/total < .01){
					otherPercent += counts[i]/total;
					otherCount += counts[i];
				}
				else{
					var name = counts[i-1];
					if((name !== undefined) && (name.indexOf("ecoinformatics.org") > -1) && (name.indexOf("eml") > -1)){
						//Get the EML version only
						name = name.substr(name.lastIndexOf("/")+1).toUpperCase().replace('-', ' ');
					}
					if((total == 0) && (counts[i] == 0)){
						var perc = 1;
					}
					else{
						var perc = counts[i]/total;
					}
					newArray.push({label: name, perc: perc, count:counts[i]});
				}
			}
			
			if(otherCount > 0){
				newArray.push({label: "Other", perc: otherPercent, count: otherCount});
			}
			
			return newArray;
		},
		
		/**
		 * drawUploadChart will get the files uploaded statistics and draw the upload time series chart
		 */
		drawUploadChart: function() {
			
				function setQuery(formatType){
					return query = "q=" + profileModel.get('query') +
					  "+formatType:" + formatType +
					  "&wt=json" +
					  "&rows=0" +
					  "&facet=true" +
					  "&facet.missing=true" + //Include months that have 0 uploads
					  "&facet.limit=-1" +
					  "&facet.range=dateUploaded" +
					  "&facet.range.start=" + profileModel.get('firstUpload') +
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
					profileModel.set("metadataUploaded", data.response.numFound);
										
					//Format our data for the line chart drawing function
					var counts = data.facet_counts.facet_ranges.dateUploaded.counts;					
					var metadataUploadData = formatUploadData(counts);
									
					/* Now do the same thing for DATA uploads */
					query = setQuery("DATA");
					
					$.get(appModel.get('queryServiceUrl') + query, function(data, textStatus, xhr) {
						profileModel.set("dataUploaded", data.response.numFound);
												
						//Format our data for the line chart drawing function
						counts = data.facet_counts.facet_ranges.dateUploaded.counts;
						var dataUploadData = formatUploadData(counts);
						
						//Check which line we should draw first since the scale will be based off the first line
						if(profileModel.get("metadataUploaded") > profileModel.get("dataUploaded") ){
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
						
						var titleChartData = [
						                      {count: profileModel.get("metadataUploaded"), label: "metadata", className: "metadata"},
										      {count: profileModel.get("dataUploaded"), label: "data", className: "data"}
											 ];
						
						//Draw the upload chart title
						viewRef.drawTitle("#upload-chart-title", titleChartData, "uploads");
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
		
		drawTitle: function(svgEl, data, title){	
			console.log("draw chart title");
			
			var viewRef = this;
		
			var r = 30; //The circle radius
			
			//If we have counts with at least 4 digits, we'll need to increase the radius
			_.each(data, function(d, i){
				if(d.count > 1000){
					r = 40;
				}
			});
			
			var svg = d3.select(svgEl); //Select the SVG element
			
			//Draw the circles
			var circle = svg.selectAll("circle")
							.data(data)
							.enter().append("svg:circle")
							.attr("class", function(d, i){ return d.className; })
							.attr("r", r)
							.attr("transform", function(d, i){ 
								return "translate(" + ((r*2*(i+1))+(r*i))+ "," + r + ")";
							});
			
			//Draw the text labels underneath the circles
			svg.append("g")
				.selectAll("text")
				.data(data)
				.enter().append("svg:text")
				.attr("transform", function(d, i){ 
					return "translate(" + ((r*2*(i+1))+(r*i))+ "," + ((r*2) + 20) + ")";
				})
				.attr("class", function(d){ return d.className + " label"; })
				.attr("text-anchor", "middle")
				.text(function(d){ return d.label; });
			
			//Draw the count labels inside the circles
			svg.append("g")
				.selectAll("text")
				.data(data)
				.enter().append("svg:text")
				.text(function(d){ return viewRef.commaSeparateNumber(d.count); })
				.attr("transform", function(d, i){
					return "translate(" + ((r*2*(i+1))+(r*i))+ "," + (r+5) + ")";
				})
				.attr("class", function(d){ return d.className + " count"; })
				.attr("text-anchor", "middle");
					
			//Draw the title next to the circles at the end
			svg.append("text")
				.text(title)
				.attr("class", "title")
				.attr("transform", "translate(" + (((r * 2 * (data.length+1))+(r * (data.length)))-r) + "," + r + ")")
				.attr("text-anchor", "left");
		},
		
		/* getTemporalCoverage
		 * Get the temporal coverage of this query/user from Solr
		 */
		getTemporalCoverage: function(){
			//Construct our query to get the begin and end date of all objects for this query
		/*	var query = "q=" + profileModel.get('query') +
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
			console.log('Closing the profile view');
		},
		
	});
	return ProfileView;		
});
