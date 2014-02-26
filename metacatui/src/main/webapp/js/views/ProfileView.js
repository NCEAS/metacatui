/*global define */
define(['jquery', 'underscore', 'backbone', 'd3', 'text!templates/profile.html', 'text!templates/alert.html'], 				
	function($, _, Backbone, d3, ProfileTemplate, AlertTemplate) {
	'use strict';
		
	// Build the main header view of the application
	var ProfileView = Backbone.View.extend({

		el: '#Content',
		
		template: _.template(ProfileTemplate),
		
		alertTemplate: _.template(AlertTemplate),
		
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
			var data = profileModel.get('dataFormatIDs');	
			
			data = this.getPercentages(data, profileModel.get('dataCount'));
						
			//Reiterate over the colors if there aren't enough specified
			var i = 0;
			while(profileModel.style.dataChartColors.length < data.length){
				profileModel.style.dataChartColors.push(profileModel.style.dataChartColors[i]);
				i++;
			}
			
			this.drawDonutChart(data, "#data-chart", "data", profileModel.style.dataChartColors);

		},

		drawMetadataCountChart: function(){
			var data = profileModel.get('metadataFormatIDs');	
			
			data = this.getPercentages(data, profileModel.get('metadataCount'));
						
			//Reiterate over the colors if there aren't enough specified
			var i = 0;
			while(profileModel.style.metadataChartColors.length < data.length){
				profileModel.style.metadataChartColors.push(profileModel.style.metadataChartColors[i]);
				i++;
			}
			
			this.drawDonutChart(data, "#metadata-chart", "metadata", profileModel.style.metadataChartColors);
			
		},
		
		drawDonutChart: function(data, svgEl, format, colors){
			
					//Set up the attributes for our donut chart
			        var w = $(svgEl).width(),
			            h = $(svgEl).height(),
			            lastX = 0,
			            lastY = 0,
			            lastWidth = 0,
			            r = Math.min(w, h) / 4,
			            labelr = r + 10, // radius for label anchor
			            donut = d3.layout.pie(),
			            arc = d3.svg.arc().innerRadius(r * .85).outerRadius(r);

			        //Select the SVG element and connect our data to it
			        var vis = d3.select(svgEl)
			            .data([data]);

			        //Set up a group for each arc we will create
			        var arcs = vis.selectAll("g.arc")
			            .data(donut.value(function(d) { return d.val }))
			            .enter().append("svg:g")
			            .attr("class", "arc")
			            .attr("transform", "translate(" + (r + 30) + "," + (r-20) + ")")
			            .attr("transform",
							"translate(" + (w)/2 + ", " + (h)/2 + ")");

			        //Append an arc to each group
			        arcs.append("svg:path")
			            .attr("fill", function(d, i) { return colors[i]; })
			            .attr("d", arc)
			            .attr(function(d){  return "transform", "translate(" + w/2 + "," + h/2 + ")" });
			        	
			        //Append a text label next to each arc
			        arcs.append("svg:g")
			        	.attr("class", "labels")
			        	.attr("transform", function(d) {
			                var c = arc.centroid(d),
			                    x = c[0],
			                    y = c[1],
			                    // pythagorean theorem for hypotenuse
			                    h = Math.sqrt(x*x + y*y);
			            	lastWidth = this.offsetWidth;
			                if((y/h * labelr) < -100){
			                	var newY = (y/h * labelr) - 20;
			                }
			                else{
			                	var newY = (y/h * labelr);
			                }
			                return "translate(" + ((x/h * labelr)+5) +  ',' + ((y/h * labelr) -20) +  ")"; 
			            })
			        	.append("svg:text")
			        	.attr("class", "id-label")
			        	.attr("x-test", function(d) {
			        			var c = arc.centroid(d),
			                    x = c[0],
			                    y = c[1],
			                    // pythagorean theorem for hypotenuse
			                    h = Math.sqrt(x*x + y*y);
			        			return (x/h * labelr);
			        	})
			        	.attr("y-test", function(d) {
			        			var c = arc.centroid(d),
			                    x = c[0],
			                    y = c[1],
			                    // pythagorean theorem for hypotenuse
			                    h = Math.sqrt(x*x + y*y);
			        			return ((y/h * labelr));
			        	})
			            .attr("fill", function(d, i){ return colors[i]; })
			            .attr("text-anchor", function(d) {
			                // are we past the center?
			                return (d.endAngle + d.startAngle)/2 > Math.PI ?
			                    "end" : "start";
			            })
			            .text(function(d, i) { 
			            	return d.data.name; 
			            });
			        
			        //Append a text label with the count next to each arc
			        arcs.selectAll("g.labels")
			        	.append("svg:text")
			        	.attr("class", "id-count")
			            .attr("text-anchor", function(d) {
			                // are we past the center?
			                return (d.endAngle + d.startAngle)/2 > Math.PI ?
			                    "end" : "start";
			            })
			            .text(function(d, i) { 	         
			            	return d.data.count; 
			            })
			           .attr("transform", function(d) {
			        	   return "translate(0,20)";
			            });
			        

			      //Add the data count in text inside the circle
					var textData = [{
										"cx" : $(svgEl).attr('width')/2,  //Start at the center
										"cy" : $(svgEl).attr('height')/2, //Start at the center
										"text" : profileModel.get(format + 'Count'),
										"id" : format + "-count-stat",
										"classType" : format
									},
									{
										"cx" : $(svgEl).attr('width')/2,  //Start at the center
										"cy" : $(svgEl).attr('height')/2, //Start at the center
										"text" : format + " files",
										"id" : format + "-count-label",
										"classType" : format
									}];
					
					var count = vis.append("svg:g")
									.selectAll("text")
								   .data(textData)
								   .enter().append('svg:text');

					var attributes = count
								.text(function(d){ return d.text; })
								.attr("id", function(d){ return d.id; })
								.attr("class", function(d){ return d.classType; })
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
								})
								.attr(function(d){  return "transform", "translate(" + d.cx + "," + d.cy + ")" })
		
		},
		
		
		//** This function will loop through the raw facet counts response array from Solr and returns
		//   a new array containing the fractions of those counts of the total specified
		getPercentages: function(array, total){
			var newArray = [];
			var otherPercent = 0;
			var otherCount = 0;
			
			for(var i=1; i<array.length; i+=2){
				if(array[i]/total < .01){
					otherPercent += array[i]/total;
					otherCount += array[i];
				}
				else{
					newArray.push({name: array[i+1], val: array[i]/total, count:array[i]});
				}
			}
			
			if(otherCount > 0){
				newArray.push({name: "Other", val: otherPercent, count: otherCount});
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
					classes: "alert-error",
					includeEmail: true
				}));
			});

		}
		
	});
	return ProfileView;		
});
