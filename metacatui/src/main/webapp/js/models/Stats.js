/*global define */
define(['jquery', 'underscore', 'backbone', 'models/LogsSearch'], 				
	function($, _, Backbone, LogsSearch) {
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
			
			downloads: 0,
			metadataDownloads: null,
			dataDownloads: null,
			metadataDownloadDates: null,
			dataDownloadDates: null,
			
			firstBeginDate: 0,
			temporalCoverage: 0,
			coverageYears: 0,
			
			// complex objects like this
			// {mdq_composite_d: {"min":0.25,"max":1.0,"count":11,"missing":0,"sum":6.682560903149138,"sumOfSquares":4.8545478685001076,"mean":0.6075055366499217,"stddev":0.2819317507548068}}
			mdqStats: {},
			mdqStatsTotal: {},
			
			supportDownloads: (appModel.get("nodeId") && appModel.get("d1LogServiceUrl"))
		},
		
		//Some dated used for query creation
		firstPossibleUpload: "2000-01-01T00:00:00Z", //The first possible date that an object could be uploaded (based on DataONE dates)
		firstPossibleDate: "1800-01-01T00:00:00Z",   //The first possible date that data could have been collected in (based on DataONE dates)
		
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
			})();
			
			//this.on("change:dataDownloads",     this.sumDownloads);
			//this.on("change:metadataDownloads", this.sumDownloads);
		},
		
		//This function serves as a shorthand way to get all of the statistics stored in the model
		getAll: function(){
			//Listen for our responses back from the server before we send requests that require info from the response
			this.listenToOnce(this, 'change:firstBeginDate', this.getLastEndDate);
			this.listenToOnce(this, 'change:lastEndDate', this.getCollectionYearFacets);
			this.listenToOnce(this, 'change:dataCount', this.getDataFormatIDs);
			this.listenToOnce(this, 'change:metadataCount', this.getMetadataFormatIDs);
			
			
			this.getFirstBeginDate();
			this.getFormatTypes();
			this.getUploads();
			this.getDownloadDates();
			this.getMdqStatsTotal();
			//this.getDataDownloadDates();
			//this.getMetadataDownloadDates();
		},
		
		// Send a Solr query to get the earliest beginDate, latest endDate, and facets of data collection years
		getFirstBeginDate: function(){
			var model = this;
			
			//Get the earliest temporal data coverage year
			var query = this.get('query') + 
						"+beginDate:[" + this.firstPossibleDate + "%20TO%20NOW]" //Use date filter to weed out badly formatted data 
						"+-obsoletedBy:*";
			
			var otherParams = "&rows=1" +
							  "&fl=beginDate" +
							  "&sort=beginDate+asc" +
							  "&wt=json";	
			
			//Save this
			this.getFirstBeginDateQuery = query; 
			
			//Query for the earliest beginDate
			var requestSettings = {
				url: appModel.get('queryServiceUrl') + "q=" + query + otherParams, 
				type: "GET",
				dataType: "json",
				success: function(data, textStatus, xhr) {
					
					//Is this the latest query?
					if(decodeURIComponent(model.getFirstBeginDateQuery).replace(/\+/g, " ") != data.responseHeader.params.q)
						return;
						
					if(!data.response.numFound){
						//There were no begin dates found
						model.set('totalBeginDates', 0);
						
						var endDateQuery = query.replace(/beginDate/g, "endDate");
						
						//Find the earliest endDate if there are no beginDates
						var requestSettings = {
							url: appModel.get('queryServiceUrl') + "q=" + endDateQuery + otherParams, 
							type: "GET",
							success: function(endDateData, textStatus, xhr) {
								//If not endDates or beginDates are found, there is no temporal data in the index, so save falsey values
								if(!endDateData.response.numFound){
									model.set('firstBeginDate', null);
									model.set('lastEndDate', null);
								}
								else{
									model.set('firstBeginDate', new Date.fromISO(endDateData.response.docs[0].endDate));
								}
							}
						}
						$.ajax(_.extend(requestSettings, appUserModel.createAjaxSettings()));
					}
					else{
						// Save the earliest beginDate and total found in our model
						model.set('firstBeginDate', new Date.fromISO(data.response.docs[0].beginDate));					
						model.set('totalBeginDates', data.response.numFound);
						
						model.trigger("change:firstBeginDate");
						model.trigger("change:totalBeginDates");
					}
				}
			}
			
			$.ajax(_.extend(requestSettings, appUserModel.createAjaxSettings()));
		},
		
		getLastEndDate: function(){
			var model = this;
			
			//Get the latest temporal data coverage year
			var query = this.get('query') + 
						"+endDate:[" + this.firstPossibleDate + "%20TO%20NOW]" + //Use date filter to weed out badly formatted data 
						"+-obsoletedBy:*";
			var otherParams = "&rows=1" +
							  "&fl=endDate" +
							  "&sort=endDate+desc" +
							  "&wt=json";
			
			//Save this query so we know what the most recent one is
			this.getLastEndDateQuery = query;
			
			//Query for the latest endDate
			var requestSettings = {
				url: appModel.get('queryServiceUrl') + "q=" + query + otherParams, 
				type: "GET",
				dataType: "json",
				success: function(data, textStatus, xhr) {
					if(typeof data == "string") data = JSON.parse(data);
					
					//Is this the latest query?
					if(decodeURIComponent(model.getLastEndDateQuery).replace(/\+/g, " ") != data.responseHeader.params.q)
						return;
					
					if(!data.response.numFound){
						//Save some falsey values if none are found
						model.set('lastEndDate', null);
					}
					else{
						// Save the earliest beginDate and total found in our model - but do not accept a year greater than this current year
						var now = new Date();
						if(new Date.fromISO(data.response.docs[0].endDate).getUTCFullYear() > now.getUTCFullYear()) model.set('lastEndDate', now);
						else model.set('lastEndDate', new Date.fromISO(data.response.docs[0].endDate));
						
						model.trigger("change:lastEndDate");
					}	
				}
			}
			
			$.ajax(_.extend(requestSettings, appUserModel.createAjaxSettings()));
		},
		
		/**
		** getFormatTypes will send three Solr queries to get the formatTypes and formatID statistics and will update the  model 
		**/
		getFormatTypes: function(){
			var model = this;
			
			//Build the query to get the format types
			var query = this.get('query') + 
						"+%28formatType:METADATA%20OR%20formatType:DATA%29+-obsoletedBy:*";
			var otherParams = "&rows=2" +
						 	  "&group=true" +
							  "&group.field=formatType" +
							  "&group.limit=0" +
							  "&sort=formatType%20desc" +			
							  "&wt=json";

			//Run the query
			var requestSettings = {
				url: appModel.get('queryServiceUrl') + "q=" + query + otherParams, 
				type: "GET",
				dataType: "json",
				success: function(data, textStatus, xhr) {

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
				}
			}
			
			$.ajax(_.extend(requestSettings, appUserModel.createAjaxSettings()));
		},
		
		getDataFormatIDs: function(){
			var model = this;
			
			var query = "q=" + this.get('query') +
			"+formatType:DATA+-obsoletedBy:*" +
			"&facet=true" +
			"&facet.field=formatId" +
			"&facet.limit=-1" +
			"&facet.mincount=1" +
			"&rows=0" +
			"&wt=json";
			
			if(this.get('dataCount') > 0){					
				//Now get facet counts of the data format ID's 
				var requestSettings = {
					url: appModel.get('queryServiceUrl') + query, 
					type: "GET",
					dataType: "json",
					success: function(data, textStatus, xhr) {
						model.set('dataFormatIDs', data.facet_counts.facet_fields.formatId);
					}
				}
				
				$.ajax(_.extend(requestSettings, appUserModel.createAjaxSettings()));
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
						"&rows=0" +
						"&wt=json";
			
			if(this.get('metadataCount') > 0){
				
				//Now get facet counts of the metadata format ID's 
				var requestSettings = {
					url: appModel.get('queryServiceUrl') + query, 
					type: "GET",
					dataType: "json",
					success: function(data, textStatus, xhr) {
						model.set('metadataFormatIDs', data.facet_counts.facet_fields.formatId);
					}
				}
				
				$.ajax(_.extend(requestSettings, appUserModel.createAjaxSettings()));			
			}
		},
		
		/**
		 * getUploads will get the files uploaded statistics
		 */
		getUploads: function() {
			
			var model = this;
			
			//Get the earliest upload date	
			var query =  "q=" + this.get('query') +
								"+formatType:(METADATA OR DATA)" + //Weeds out resource maps and annotations
								"+dateUploaded:[" + this.firstPossibleUpload + "%20TO%20NOW]" + //Weeds out badly formatted dates
								"+-obsoletes:*"+    //Only count one version of a revision chain
								"&fl=dateUploaded" +
								"&rows=1" +
								"&sort=dateUploaded+asc" +
								"&wt=json";
			
			//Run the query
			var requestSettings = {
				url: appModel.get('queryServiceUrl') + query, 
				type: "GET",
				dataType: "json",
				success: function(data, textStatus, xhr) {

					if(!data.response.numFound){
							//Save some falsey values if none are found
							model.set('totalUploads', 0);
							model.trigger("change:totalUploads");
							model.set('firstUpload', null);
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
							  "+-obsoletes:*+formatType:DATA";
							
							var metadataQuery =  "q=" + model.get('query') +
							  "+-obsoletes:*+formatType:METADATA";
							  
							var facets =  "&rows=0" +
										  "&facet=true" +
										  "&facet.missing=true" + //Include months that have 0 uploads
										  "&facet.limit=-1" +
										  "&facet.range=dateUploaded" +
										  "&facet.range.start=" + model.get('firstUpload') +
										  "&facet.range.end=NOW" +
										  "&facet.range.gap=%2B1MONTH" +
										  "&wt=json";
				
							//Run the query
							var requestSettings = {
								url: appModel.get('queryServiceUrl') + metadataQuery+facets, 
								dataType: "json",
								type: "GET",
								success: function(data, textStatus, xhr) {
									model.set("metadataUploads", data.response.numFound);
									model.set("metadataUploadDates", data.facet_counts.facet_ranges.dateUploaded.counts);		
									
									var requestSettings = {
										url: appModel.get('queryServiceUrl') + dataQuery+facets, 
										type: 'GET',
										dataType: "json",
										success: function(data, textStatus, xhr) {
											model.set("dataUploads", data.response.numFound);
											model.set("dataUploadDates", data.facet_counts.facet_ranges.dateUploaded.counts);	
										}
									}
									
									$.ajax(_.extend(requestSettings, appUserModel.createAjaxSettings()));
								}
							}
							
							$.ajax(_.extend(requestSettings, appUserModel.createAjaxSettings()));
						}
				}
			}
			
			$.ajax(_.extend(requestSettings, appUserModel.createAjaxSettings()));
		},
		
		/* getTemporalCoverage
		 * Get the temporal coverage of this query/user from Solr
		 */
		getCollectionYearFacets: function(){
			var model = this;
			
			//How many years back should we look for temporal coverage?
			var lastYear =  this.get('lastEndDate') ? this.get('lastEndDate').getUTCFullYear() : new Date().getUTCFullYear(),
				firstYear = this.get('firstBeginDate')? this.get('firstBeginDate').getUTCFullYear() : new Date().getUTCFullYear(),
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
			  "+beginDate:[" + this.firstPossibleDate + "%20TO%20NOW]" + //Use date filter to weed out badly formatted data 
			  "+-obsoletedBy:*" +
			  "&rows=0" +
			  "&facet=true" +
			  "&facet.limit=30000" + //Put some reasonable limit here so we don't wait forever for this query
			  "&facet.missing=true" + //We want to retrieve years with 0 results
			  fullFacetQuery + 
			  "&wt=json";
						
			var requestSettings = {
				url: appModel.get('queryServiceUrl') + query, 
				dataType: "json",
				success: function(data, textStatus, xhr) {
					model.set('temporalCoverage', data.facet_counts.facet_queries);
					
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
				}
				
			}
			
			$.ajax(_.extend(requestSettings, appUserModel.createAjaxSettings()));
		},
		
		/*
		 * The Downloads query can be customized only by: filtering by a certain MN or filtering by a rightsHolder
		 */
		
		getDataDownloadDates: function(){
			if(!appModel.get("d1LogServiceUrl")) return;
			
			var model = this;
				
			var logSearch = new LogsSearch();
			logSearch.set("event", "read");
			logSearch.set("formatType", "DATA");
			logSearch.set("facetRanges", ["dateLogged"]);

			var searchModel = this.get("searchModel");
			if(searchModel && searchModel.get("dataSource")){
				logSearch.set("nodeId", searchModel.get("dataSource"))
			}
			if(searchModel && searchModel.get("username")){
				logSearch.set("username", searchModel.get("username"));
			}
			
			var requestSettings = {
				url: appModel.get("d1LogServiceUrl") + "q=" +  logSearch.getQuery() + logSearch.getFacetQuery() + "&wt=json&rows=0",
				type: "GET",
				dataType: "json",
				success: function(data, textStatus, xhr){
					var counts = data.facet_counts.facet_ranges.dateLogged.counts;
					model.set("dataDownloads", data.response.numFound);	
					model.set("dataDownloadDates", counts);		
					
					if(data.response.numFound == 0) model.trigger("change:dataDownloads");
				}
			}
			
			$.ajax(_.extend(requestSettings, appUserModel.createAjaxSettings()));
		},

		getMetadataDownloadDates: function(){
			if(!appModel.get("d1LogServiceUrl")) return;
			
			var model = this;
				
			var logSearch = new LogsSearch();
			logSearch.set("event", "read");
			logSearch.set("formatType", "METADATA");
			logSearch.set("facetRanges", ["dateLogged"]);
			
			var searchModel = this.get("searchModel");
			if(searchModel && searchModel.get("dataSource")){
				logSearch.set("nodeId", searchModel.get("dataSource"))
			}
			if(searchModel && searchModel.get("username")){
				logSearch.set("username", searchModel.get("username"));
			}
			
			var requestSettings = {
				url: appModel.get("d1LogServiceUrl") + "q=" +  logSearch.getQuery() + logSearch.getFacetQuery() + "&wt=json&rows=0",
				type: "GET",
				dataType: "json",
				success: function(data, textStatus, xhr){
					var counts = data.facet_counts.facet_ranges.dateLogged.counts;
					
					model.set("metadataDownloads", data.response.numFound);	
					model.set("metadataDownloadDates", counts);	
					
					if(data.response.numFound == 0) model.trigger("change:metadataDownloads");
				}
			}
			
			$.ajax(_.extend(requestSettings, appUserModel.createAjaxSettings()));
		},
		
		getDownloadDates: function(){
			if(!appModel.get("d1LogServiceUrl")) return;
			
			var model = this;
				
			var logSearch = new LogsSearch();
			logSearch.set("event", "read");
			logSearch.set("formatType", ["METADATA", "DATA"]);
			logSearch.set("facetRanges", ["dateLogged"]);
			logSearch.set("facets", ["formatType", "pid"]);
			
			var searchModel = this.get("searchModel");
			if(searchModel && searchModel.get("dataSource")){
				logSearch.set("nodeId", searchModel.get("dataSource"))
			}
			if(searchModel && searchModel.get("username")){
				logSearch.set("username", searchModel.get("username"));
			}
			
			var requestSettings = {
				url: appModel.get("d1LogServiceUrl") + "q=" +  logSearch.getQuery() + logSearch.getFacetQuery() + "&wt=json&rows=0",
				type: "GET",
				dataType: "json",
				success: function(data, textStatus, xhr){
					var counts = data.facet_counts.facet_ranges.dateLogged.counts;
					
					var m_index = _.indexOf(data.facet_counts.facet_fields.formatType, "METADATA");
					if(m_index > -1) 
						model.set("metadataDownloads", data.facet_counts.facet_fields.formatType[m_index+1]);
					else
						model.set("metadataDownloads", 0);
					
					var d_index = _.indexOf(data.facet_counts.facet_fields.formatType, "DATA");
					if(d_index > -1) 
						model.set("dataDownloads", data.facet_counts.facet_fields.formatType[d_index+1]);
					else
						model.set("dataDownloads", 0);
					
					if(data.facet_counts.facet_fields.formatType[m_index+1] == 0) model.trigger("change:metadataDownloads");
					if( data.facet_counts.facet_fields.formatType[d_index+1] == 0) model.trigger("change:dataDownloads");
					
					
					model.set("downloads", data.response.numFound);	
					if(data.response.numFound == 0) model.trigger("change:downloads");
					
					model.set("downloadDates", counts);	
				}
			}
			
			$.ajax(_.extend(requestSettings, appUserModel.createAjaxSettings()));
		},
		
		sumDownloads: function(){
			if((this.get("dataDownloads") == null) || (this.get("metadataDownloads") == null)) return;
			
			this.set("downloads", this.get("dataDownloads") + this.get("metadataDownloads"));
			
			if(this.get("downloads") == 0) this.trigger("change:downloads");			
		},
		
		/**
		** getMdqStats will query SOLR for MDQ stats and will update the model accordingly
		**/
		getMdqStats: function(){
			var model = this;
			
			//Build the query to get the MDQ stats
			var query = this.get('query') + 
						"+formatId:%22https:%2F%2Fnceas.ucsb.edu%2Fmdqe%2Fv1%23run%22+-obsoletedBy:*";
			var otherParams = "&rows=0" +
						 	  "&stats=true" +
						 	  // fields
							  "&stats.field=mdq_composite_d" +
							  "&stats.field=mdq_discovery_d" +
							  "&stats.field=mdq_interpretation_d" +
							  "&stats.field=mdq_identification_d" +
							  // facets
							  "&stats.facet=mdq_metadata_formatId_s" +
							  "&stats.facet=mdq_metadata_rightsHolder_s" +
							  "&stats.facet=mdq_metadata_datasource_s" +
							  "&stats.facet=mdq_suiteId_s" +
							  //"&sort=mdq_metadata_formatId_s%20desc" +			
							  "&wt=json";

			//Run the query for stats
			var requestSettings = {
				url: appModel.get('queryServiceUrl') + "q=" + query + otherParams, 
				type: "GET",
				dataType: "json",
				success: function(data, textStatus, xhr) {

					var mdqStats = data.stats.stats_fields;
					
					// Set the pertinent information in the model
					model.set('mdqStats', mdqStats);
						
				}
			};
			
			$.ajax(_.extend(requestSettings, appUserModel.createAjaxSettings()));
		},
		
		/**
		** getMdqStatsTotal will query SOLR for ALL MDQ stats and will update the model accordingly
		**/
		getMdqStatsTotal: function(){
			var model = this;
			
			//Build the query to get ALL MDQ stats - not filtered!
			var query =  "formatId:%22https:%2F%2Fnceas.ucsb.edu%2Fmdqe%2Fv1%23run%22+-obsoletedBy:*";
			var otherParams = "&rows=0" +
						 	  "&stats=true" +
							  "&stats.field=mdq_composite_d" +
							  "&stats.field=mdq_discovery_d" +
							  "&stats.field=mdq_interpretation_d" +
							  "&stats.field=mdq_identification_d" +
							  //"&stats.facet=mdq_metadata_rightsHolder_s" +
							  //"&sort=mdq_metadata_rightsHolder_s%20desc" +			
							  "&wt=json";

			//Run the query for stats
			var requestSettings = {
				url: appModel.get('queryServiceUrl') + "q=" + query + otherParams, 
				type: "GET",
				dataType: "json",
				success: function(data, textStatus, xhr) {

					var mdqStatsTotal = data.stats.stats_fields;
					
					// Set total in the model
					model.set('mdqStatsTotal', mdqStatsTotal);
					
					// get the specific stats which will trigger rendering
					model.getMdqStats();
						
				}
			};
			
			$.ajax(_.extend(requestSettings, appUserModel.createAjaxSettings()));
		}
		
		
	});
	return Stats;
});
