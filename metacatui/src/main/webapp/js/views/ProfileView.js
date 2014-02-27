/*global define */
define(['jquery', 'underscore', 'backbone', 'd3', 'views/DonutChartView', 'text!templates/profile.html', 'text!templates/alert.html'], 				
	function($, _, Backbone, d3, DonutChart, ProfileTemplate, AlertTemplate) {
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
		
		/**
		** getFormatTypes will send three Solr queries to get the formatTypes and formatID statistics and will update the Profile model 
		**/
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

		},
		
		drawDataCountChart: function(){
			//Format our Solr facet counts for the donut chart rendering
			var data = profileModel.get('dataFormatIDs');	
			data = this.formatDonutData(data, profileModel.get('dataCount'));
			
			//Draw a donut chart
			var donut = new DonutChart();
			donut.render(data, "#data-chart", profileModel.style.dataChartColors, "data files", profileModel.get("dataCount"));
		},

		drawMetadataCountChart: function(){
			//Format our Solr facet counts for the donut chart rendering
			var data = profileModel.get('metadataFormatIDs');	
			data = this.formatDonutData(data, profileModel.get('metadataCount'));
			
			//Draw a donut chart
			var donut = new DonutChart();
			donut.render(data, "#metadata-chart", profileModel.style.metadataChartColors, "metadata files", profileModel.get("metadataCount"));
		},
		
		//** This function will loop through the raw facet counts response array from Solr and returns
		//   a new array of objects that are in the format needed to draw a donut chart
		formatDonutData: function(array, total){
			var newArray = [];
			var otherPercent = 0;
			var otherCount = 0;
			
			for(var i=1; i<array.length; i+=2){
				if(array[i]/total < .01){
					otherPercent += array[i]/total;
					otherCount += array[i];
				}
				else{
					var name = array[i+1];
					if((name.indexOf("ecoinformatics.org") > -1) && (name.indexOf("eml") > -1)){
						//Get the EML version only
						name = name.substr(name.lastIndexOf("/")+1).toUpperCase().replace('-', ' ');
					}
					newArray.push({label: name, perc: array[i]/total, count:array[i]});
				}
			}
			
			if(otherCount > 0){
				newArray.push({label: "Other", perc: otherPercent, count: otherCount});
			}
			
			return newArray;
		},
		
		onClose: function () {			
			console.log('Closing the profile view');
		},
		
	});
	return ProfileView;		
});
