/*global define */
define(['jquery', 'underscore', 'backbone', 'd3', 'text!templates/profile.html', 'text!templates/alert.html'], 				
	function($, _, Backbone, d3, ProfileTemplate, AlertTemplate) {
	'use strict';
		
	// Build the main header view of the application
	var ProfileView = Backbone.View.extend({

		el: '#Content',
		
		template: _.template(ProfileTemplate),
		
		alertTemplate: _.template(AlertTemplate),
		
		dataCount: 0,
		metadataCount: 0,
				
		render: function () {
			
			this.$el.html(this.template());
			
			// set the header type
			appModel.set('headerType', 'default');
			
			console.log('Rendering the profile view');
			
			//Get the query from the appModel
			var query = appModel.get('profileQuery');
			
			//If no query was given, then show all of the repository info
			if(!query){
				query = "*:*";
			}
			
			this.getFormatTypes(query);

			
			return this;
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
						viewRef.metadataCount = data.grouped.formatType.groups[0].doclist.numFound;
					}else{
						viewRef.dataCount = data.grouped.formatType.groups[0].doclist.numFound;
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
					viewRef.metadataCount = data.grouped.formatType.groups[0].doclist.numFound;
					viewRef.dataCount = data.grouped.formatType.groups[1].doclist.numFound;
				}	

				if(viewRef.dataCount > 0){
					var dataFormatIds = "q=formatType:DATA" +
					"&facet=true" +
					"&facet.field=formatId" +
					"&facet.limit=-1" +
					"&wt=json" +
					"&rows=0";
					
					//Now get facet counts of the data format ID's 
					$.get(appModel.get('queryServiceUrl') + dataFormatIds, function(data, textStatus, xhr) {
						viewRef.dataFormatIds = data.facet_counts.facet_fields.formatId;
					}).error(function(){
						console.warn('Solr query error for data formatIds - not vital to page, so we will keep going');
					});
				}
				
				if(viewRef.metadataCount > 0){
					var metadataFormatIds = "q=formatType:METADATA" +
					"&facet=true" +
					"&facet.field=formatId" +
					"&facet.limit=-1" +
					"&wt=json" +
					"&rows=0";
					
					//Now get facet counts of the metadata format ID's 
					$.get(appModel.get('queryServiceUrl') + metadataFormatIds, function(data, textStatus, xhr) {
						viewRef.metadataFormatIds = data.facet_counts.facet_fields.formatId;
					}).error(function(){
						console.warn('Solr query error for metadata formatIds - not vital to page, so we will keep going');
					});
				}
					
				//Insert the counts into the DOM
				$('#data-chart').html(viewRef.dataCount);
				$('#metadata-chart').html(viewRef.metadataCount);
						
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
