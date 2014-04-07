/*global define */
define(['jquery', 'underscore', 'backbone'], 				
	function($, _, Backbone) {
	'use strict';

	// Statistics Model 
	// ------------------
	var Stats = Backbone.Model.extend({
		// This model contains all of the statistics in a user's or query's profile
		defaults: {
			query: "*:*", //Show everything
			
			metadataCount: 0,
			dataCount: 0,
			metadataFormatIDs: [], //Uses same structure as Solr facet counts: ["text/csv", 5]
			dataFormatIDs: [], //Uses same structure as Solr facet counts: ["text/csv", 5]
			
			firstUpload: 0,
			totalUploads: 0, //total data and metadata objects uploaded, including now obsoleted objects
			metadataUploads: null,
			dataUploads: null,
			metadataUploadDates: null,
			dataUploadDates: null,
			
			firstBeginDate: 0,
			temporalCoverage: 0,
			coverageYears: 0
		},
		
		initialize: function(){
			//Add a function to parse ISO date strings for IE8 and other older browsers
			(function(){
			    var D= new Date('2011-06-02T09:34:29+02:00');
			    if(!D || +D!== 1307000069000){
			        Date.fromISO= function(s){
			            var day, tz,
			            rx=/^(\d{4}\-\d\d\-\d\d([tT ][\d:\.]*)?)([zZ]|([+\-])(\d\d):(\d\d))?$/,
			            p= rx.exec(s) || [];
			            if(p[1]){
			                day= p[1].split(/\D/);
			                for(var i= 0, L= day.length; i<L; i++){
			                    day[i]= parseInt(day[i], 10) || 0;
			                };
			                day[1]-= 1;
			                day= new Date(Date.UTC.apply(Date, day));
			                if(!day.getDate()) return NaN;
			                if(p[5]){
			                    tz= (parseInt(p[5], 10)*60);
			                    if(p[6]) tz+= parseInt(p[6], 10);
			                    if(p[4]== '+') tz*= -1;
			                    if(tz) day.setUTCMinutes(day.getUTCMinutes()+ tz);
			                }
			                return day;
			            }
			            return NaN;
			        }
			    }
			    else{
			        Date.fromISO= function(s){
			            return new Date(s);
			        }
			    }
			})()
		},
		
		//This function serves as a shorthand way to get all of the statistics stored in the model
		getAll: function(){
			//Listen for our responses back from the server before we send requests that require info from the response
			this.listenTo(this, 'change:firstBeginDate', this.getLastEndDate);
			this.listenTo(this, 'change:lastEndDate', this.getCollectionYearFacets);
			this.listenTo(this, 'change:dataCount', this.getDataFormatIDs);
			this.listenTo(this, 'change:metadataCount', this.getMetadataFormatIDs);
			
			
			this.getFirstBeginDate();
			this.getFormatTypes();
			this.getUploads();
		},
		
		// Send a Solr query to get the earliest beginDate, latest endDate, and facets of data collection years
		getFirstBeginDate: function(){
			var model = this;
			
			//Get the earliest temporal data coverage year
			var query = "q=" + this.get('query') +
					"+(beginDate:18*%20OR%20beginDate:19*%20OR%20beginDate:20*)+-obsoletedBy:*" + //Only return results that start with 18,19, or 20 to filter badly formatted data (e.g. 1-01-03 in doi:10.5063/AA/nceas.193.7)
					"&rows=1" +
					"&wt=json" +	
					"&fl=beginDate" +
					"&sort=beginDate+asc";
			
			//Query for the earliest beginDate
			$.get(appModel.get('queryServiceUrl') + query, function(data, textStatus, xhr) {
				if(!data.response.numFound){
					//Save some falsey values if none are found
					model.set('firstBeginDate', null);
					model.set('totalBeginDates', 0);
				}
				else{
					// Save the earliest beginDate and total found in our model
					model.set('firstBeginDate', new Date.fromISO(data.response.docs[0].beginDate));					
					model.set('totalBeginDates', data.response.numFound);
				}
				
			});
		},
		
		getLastEndDate: function(){
			var model = this;
			
			//Get the latest temporal data coverage year
			var query = "q=" + this.get('query') +
					"+(endDate:18*%20OR%20endDate:19*%20OR%20endDate:20*)+-obsoletedBy:*" + //Only return results that start with 18,19, or 20 to filter badly formatted data (e.g. 1-01-03 in doi:10.5063/AA/nceas.193.7)
					"&rows=1" +
					"&wt=json" +	
					"&fl=endDate" +
					"&sort=endDate+desc";
			
			//Query for the latest endDate
			$.get(appModel.get('queryServiceUrl') + query, function(data, textStatus, xhr) {
				if(!data.response.numFound){
					//Save some falsey values if none are found
					model.set('lastEndDate', null);
				}
				else{
					// Save the earliest beginDate and total found in our model - but do not accept a year greater than this current year
					var now = new Date();
					if(new Date.fromISO(data.response.docs[0].endDate).getUTCFullYear() > now.getUTCFullYear()) model.set('lastEndDate', now);
					else model.set('lastEndDate', new Date.fromISO(data.response.docs[0].endDate));
				}	
				
			});
		},
		
		/**
		** getFormatTypes will send three Solr queries to get the formatTypes and formatID statistics and will update the  model 
		**/
		getFormatTypes: function(){
			var model = this;
			
			//Build the query to get the format types
			var query = "q=" + statsModel.get('query') +
								  "+%28formatType:METADATA%20OR%20formatType:DATA%29+-obsoletedBy:*" +
								  "&wt=json" +
								  "&rows=2" +
							 	  "&group=true" +
								  "&group.field=formatType" +
								  "&group.limit=0" +
								  "&sort=formatType%20desc";			
			
			//Run the query
			$.get(appModel.get('queryServiceUrl') + query, function(data, textStatus, xhr) {
				var formats = data.grouped.formatType.groups;
				
				if(formats.length == 1){	//Only one format type was found				
					if(formats[0].groupValue == "METADATA"){ //That one format type is metadata
						model.set('metadataCount', formats[0].doclist.numFound);
						model.set('dataCount', 0);
						model.set('dataFormatIDs', ["", 0]);
					}else{
						model.set('dataCount', formats[0].doclist.numFound);
						model.set('metadataCount', 0);
						model.set('metadataFormatIDs', ["", 0]);
					}					
				}	
				//If no data or metadata objects were found, draw blank charts
				else if(formats.length == 0){
					console.warn('No metadata or data objects found. Draw some blank charts.');
					
					//Store falsey data
					model.set('dataCount', 0);
					model.set('metadataCount', 0);
					model.set('metadataFormatIDs', ["", 0]);
					model.set('dataFormatIDs', ["", 0]);
					
					return;
				}
				else{
					//Extract the format types (because of filtering and sorting they will always return in this order)
					model.set('metadataCount', formats[0].doclist.numFound);
					model.set('dataCount', formats[1].doclist.numFound);
				}	
						
			//Display error when our original Solr query went wrong
			}).error(function(){
				console.error('Solr query for format types returned error');
			});
		},
		
		getDataFormatIDs: function(){
			var model = this;
			
			var query = "q=" + this.get('query') +
			"+formatType:DATA+-obsoletedBy:*" +
			"&facet=true" +
			"&facet.field=formatId" +
			"&facet.limit=-1" +
			"&facet.mincount=1" +
			"&wt=json" +
			"&rows=0";
			
			if(this.get('dataCount') > 0){					
				//Now get facet counts of the data format ID's 
				$.get(appModel.get('queryServiceUrl') + query, function(data, textStatus, xhr) {
					model.set('dataFormatIDs', data.facet_counts.facet_fields.formatId);
				}).error(function(){
					console.warn('Solr query error for data formatIds - not vital to page, so we will keep going');
				});
				
			}
		},
		
		getMetadataFormatIDs: function(){
			var model = this;
			
			var query = "q=" + this.get('query') +
			"+formatType:METADATA+-obsoletedBy:*" +
			"&facet=true" +
			"&facet.field=formatId" +
			"&facet.limit=-1" +
			"&facet.mincount=1" +
			"&wt=json" +
			"&rows=0";
			
			if(this.get('metadataCount') > 0){
				
				//Now get facet counts of the metadata format ID's 
				$.get(appModel.get('queryServiceUrl') + query, function(data, textStatus, xhr) {
					model.set('metadataFormatIDs', data.facet_counts.facet_fields.formatId);
				}).error(function(){
					console.warn('Solr query error for metadata formatIds - not vital to page, so we will keep going');
				});
			}
		},
		
		/**
		 * getUploads will get the files uploaded statistics
		 */
		getUploads: function() {
			
			var model = this;
			
			//Get the earliest upload date	
			var query =  "q=" + this.get('query') +
								"+dateUploaded:*" +
								"&wt=json" +
								"&fl=dateUploaded" +
								"&rows=1" +
								"&sort=dateUploaded+asc";
			
			//Run the query
			$.get(appModel.get('queryServiceUrl') + query, function(data, textStatus, xhr) {
						if(!data.response.numFound){
							//Save some falsey values if none are found
							model.set('firstUpload', null);
							model.set('totalUploads', 0);
							model.set("dataUploads", 0);
							model.set("metadataUploads", 0);
							model.set('metadataUploadDates', []);
							model.set('dataUploadDates', []);
							
						}
						else{
							// Save the earliest dateUploaded and total found in our model
							model.set('firstUpload', data.response.docs[0].dateUploaded);
							model.set('totalUploads', data.response.numFound);	
							
							var dataQuery =  "q=" + model.get('query') +
							  "+-obsoletedBy:*+formatType:DATA";
							
							var metadataQuery =  "q=" + model.get('query') +
							  "+-obsoletedBy:*+formatType:METADATA";
							  
							var facets = "&wt=json" +
										  "&rows=0" +
										  "&facet=true" +
										  "&facet.missing=true" + //Include months that have 0 uploads
										  "&facet.limit=-1" +
										  "&facet.range=dateUploaded" +
										  "&facet.range.start=" + model.get('firstUpload') +
										  "&facet.range.end=NOW" +
										  "&facet.range.gap=%2B1MONTH";
				
							//Run the query
							$.get(appModel.get('queryServiceUrl') + metadataQuery+facets, function(data, textStatus, xhr) {
								model.set("metadataUploads", data.response.numFound);
								model.set("metadataUploadDates", data.facet_counts.facet_ranges.dateUploaded.counts);		
								
								$.get(appModel.get('queryServiceUrl') + dataQuery+facets, function(data, textStatus, xhr) {
									model.set("dataUploads", data.response.numFound);
									model.set("dataUploadDates", data.facet_counts.facet_ranges.dateUploaded.counts);		
								})
								.error(function(){
									console.warn('Solr query for data upload info returned error.');
								});
							})
							.error(function(){
								console.warn('Solr query for metadata upload info returned error.');
							});
						}
			});	
		},
		
		/* getTemporalCoverage
		 * Get the temporal coverage of this query/user from Solr
		 */
		getCollectionYearFacets: function(){
			
			//How many years back should we look for temporal coverage?
			var lastYear = this.get('lastEndDate').getUTCFullYear(),
				firstYear = this.get('firstBeginDate').getUTCFullYear(),
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
			var query = "q=" + this.get('query') +
			  "+(beginDate:18*%20OR%20beginDate:19*%20OR%20beginDate:20*)" + //Only return results that start with 18,19, or 20 to filter badly formatted data (e.g. 1-01-03 in doi:10.5063/AA/nceas.193.7)
			  "+-obsoletedBy:*" +
			  "&wt=json" +
			  "&rows=0" +
			  "&facet=true" +
			  "&facet.limit=30000" + //Put some reasonable limit here so we don't wait forever for this query
			  "&facet.missing=true" + //We want to retrieve years with 0 results
			  fullFacetQuery;
						
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
				console.warn("Solr query for temporal coverage failed.");
			}); 
		}
	});
	return Stats;
});
