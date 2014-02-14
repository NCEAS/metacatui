/*global define */
define(['jquery', 'underscore', 'backbone', 'd3', 'text!templates/profile.html', 'text!templates/alert.html'], 				
	function($, _, Backbone, d3, ProfileTemplate, AlertTemplate) {
	'use strict';
		
	// Build the main header view of the application
	var ProfileView = Backbone.View.extend({

		el: '#Content',
		
		template: _.template(ProfileTemplate),
		
		alertTemplate: _.template(AlertTemplate),
		
		dataChartColors: ['#006a66', '#98cbcb', '#329898', '#005149', '#00e0cf', '#416865', '#002825'],
		
		metadataChartColors: ['#992222', '#5f1616', '#411313', '#681818', '#b22929', '#cc2e2e', '#ee3837'],
		
		initialize: function(){
		},
				
		render: function () {
			console.log('Rendering the profile view');
			
			this.listenTo(profileModel, 'change:dataFormatIDs', this.drawDataCountChart);
			this.listenTo(profileModel, 'change:metadataFormatIDs', this.drawMetadataCountChart);
			
			this.$el.prepend(this.template());
			
			// set the header type
			appModel.set('headerType', 'default');
			
			//Get the query from the appModel
			var query = appModel.get('profileQuery');
			
			//If no query was given, then show all of the repository info
			if(!query){
				query = "*:*";
			}
			
			this.getFormatTypes(query);
			
			return this;
		},
		
		drawDataCountChart: function(){
			//** Just making the data chart for now
			var data = profileModel.get('dataFormatIDs');	
			
			data = this.getPercentages(data, profileModel.get('dataCount'));
			
			console.log(data);			
			
			var chart = d3.select("#data-chart");
			
			var c = 2 * Math.PI;
			
			//Set up the global src properties
			var arc = d3.svg.arc()
			  .innerRadius(87)
			  .outerRadius(100);
			
			//Reiterate over the colors if there aren't enough specified
			var i = 0;
			while(this.dataChartColors.length < data.length){
				this.dataChartColors.push(this.dataChartColors[i]);
				i++;
			}
			
			var endAngle = data[0]*c; //Calculate the end angle for the first arc
			
			//Add an arc piece for each format ID we have
			for(i=0; i<data.length; i++){
				//The first arc is treated differently
				if(i==0){
					arc.startAngle(0)  //Start it at the top
					   .endAngle(endAngle);
				}
				else{		
					//Start at the end of the last arc
					arc.startAngle(endAngle);
					
					//Calculate the end angle and apply it
					endAngle += (data[i] * c); 					
					arc.endAngle(endAngle);
				}
				
				//Append the arc paths and apply styling
				chart.append("path")
					.attr("d", arc)
					.attr("fill", this.dataChartColors[i])
					.attr("transform", 
							"translate(" + $('#data-chart').attr('width')/2 + ", " + 
							$('#data-chart').attr('height')/2 + ")");  //Center the circle
			}
			
			//Add the data count in text inside the circle
			var textData = [{
								"cx" : $('#data-chart').attr('width')/2,  //Start at the center
								"cy" : $('#data-chart').attr('height')/2, //Start at the center
								"text" : profileModel.get('dataCount'),
								"fontFamily" : "sans-serif",
								"fontSize" : "26px",
								"color" : "#006a66"
							},
							{
								"cx" : $('#data-chart').attr('width')/2,  //Start at the center
								"cy" : $('#data-chart').attr('height')/2, //Start at the center
								"text" : "data files",
								"fontFamily" : "sans-serif",
								"fontSize" : "19px",
								"color" : "#555555"
							}];
			
			var count = chart.selectAll('text')
							.data(textData)
							.enter()
							.append('text');
			
			var attributes = count
							.text(function(d){ return d.text; })
							.attr("font-family", function(d){ return d.fontFamily; })
							.attr("font-size",   function(d){ return d.fontSize; })
							.attr("fill",        function(d){ return d.color; })
							.attr("x", function(d, i){ return d.cx - count[0][i].clientWidth/2; }) //Center horizontally based on the width
							.attr("y", function(d, i){ 
											//Center vertically based on the height
											if(i > 0){
												return d.cy + count[0][i-1].clientHeight/2;
											}
											else{
												return d.cy - count[0][i].clientHeight/2;
											}
							});

		},

		drawMetadataCountChart: function(){
			//** Just making the data chart for now
			var data = profileModel.get('metadataFormatIDs');	
			
			data = this.getPercentages(data, profileModel.get('metadataCount'));
			
			console.log(data);			
			
			var chart = d3.select("#metadata-chart");
			
			var c = 2 * Math.PI;
			
			//Set up the global src properties
			var arc = d3.svg.arc()
			  .innerRadius(87)
			  .outerRadius(100);
			
			//Reiterate over the colors if there aren't enough specified
			var i = 0;
			while(this.metadataChartColors.length < data.length){
				this.metadataChartColors.push(this.metadataChartColors[i]);
				i++;
			}
			
			var endAngle = data[0]*c; //Calculate the end angle for the first arc
			
			//Add an arc piece for each format ID we have
			for(i=0; i<data.length; i++){
				//The first arc is treated differently
				if(i==0){
					arc.startAngle(0)  //Start it at the top
					   .endAngle(endAngle);
				}
				else{		
					//Start at the end of the last arc
					arc.startAngle(endAngle);
					
					//Calculate the end angle and apply it
					endAngle += (data[i] * c); 					
					arc.endAngle(endAngle);
				}
				
				//Append the arc paths and apply styling
				chart.append("path")
					.attr("d", arc)
					.attr("fill", this.metadataChartColors[i])
					.attr("transform", 
							"translate(" + $('#metadata-chart').attr('width')/2 + ", " + 
							$('#metadata-chart').attr('height')/2 + ")");  //Center the circle
			}
			
			//Add the data count in text inside the circle
			var textData = [{
								"cx" : $('#metadata-chart').attr('width')/2,  //Start at the center
								"cy" : $('#metadata-chart').attr('height')/2, //Start at the center
								"text" : profileModel.get('metadataCount'),
								"fontFamily" : "sans-serif",
								"fontSize" : "26px",
								"color" : "#992222"
							},
							{
								"cx" : $('#metadata-chart').attr('width')/2,  //Start at the center
								"cy" : $('#metadata-chart').attr('height')/2, //Start at the center
								"text" : "metadata files",
								"fontFamily" : "sans-serif",
								"fontSize" : "19px",
								"color" : "#555555"
							}];
			
			var count = chart.selectAll('text')
							.data(textData)
							.enter()
							.append('text');
			
			var attributes = count
							.text(function(d){ return d.text; })
							.attr("font-family", function(d){ return d.fontFamily; })
							.attr("font-size",   function(d){ return d.fontSize; })
							.attr("fill",        function(d){ return d.color; })
							.attr("x", function(d, i){ return d.cx - count[0][i].clientWidth/2; }) //Center horizontally based on the width
							.attr("y", function(d, i){ 
											//Center vertically based on the height
											if(i > 0){
												return d.cy + count[0][i-1].clientHeight/2;
											}
											else{
												return d.cy - count[0][i].clientHeight/2;
											}
							});

		},
		
		//** This function will loop through the raw facet counts response array from Solr and returns
		//   a new array containing the fractions of those counts of the total specified
		getPercentages: function(array, total){
			var newArray = [];
			var other = 0;
			
			for(var i=1; i<array.length; i+=2){
				if(array[i]/total < .01){
					other += array[i]/total;
				}
				else{
					newArray.push(array[i]/total);
				}
			}
			
			if(other){
				newArray.push(other);
			}
			
			return newArray;
		},
		
		onClose: function () {			
			console.log('Closing the profile view');
		},
		
		postRender: function(){

		},
		
		getFormatTypes: function(query){
			var viewRef = this;
			
			//Build the query to get the format types
			var facetFormatType = "q=" + query +
								  "+%28formatType:METADATA%20OR%20formatType:DATA%29" +
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
						classes: "alert-error"
					}));
				}
				else{
					//Extract the format types (because of filtering and sorting they will always return in this order)
					profileModel.set('metadataCount', data.grouped.formatType.groups[0].doclist.numFound);
					profileModel.set('dataCount', data.grouped.formatType.groups[1].doclist.numFound);
				}	

				if(profileModel.get('dataCount') > 0){
					var dataFormatIds = "q=formatType:DATA" +
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
					var metadataFormatIds = "q=formatType:METADATA" +
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
					classes: "alert-error"
				}));
			});

		}
		
	});
	return ProfileView;		
});
