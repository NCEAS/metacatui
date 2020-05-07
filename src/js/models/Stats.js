/*global define */
define(['jquery', 'underscore', 'backbone', 'models/LogsSearch', 'promise'],
  function($, _, Backbone, LogsSearch, Promise) {
  'use strict';

  /**
  * @class Stats
  * @classdesc This model contains all a collection of statistics/metrics about a collection of DataONE objects
  * @name Stats
  * @extends Backbone.Model
  * @constructor
  */
  var Stats = Backbone.Model.extend(
    /** @lends Stats.prototype */{

    /**
    * Default attributes for Stats models
    * @type {Object}
    * @property {string} query - The base query that defines the data collection to get statistis about.
    * @property {string} postQuery - A copy of the `query`, but without any URL encoding
    * @property {number} metadataCount - The number of metadata objects in this data collection @readonly
    * @property {number} dataCount - The number of data objects in this data collection
    * @property {number} totalCount - The number of metadata and data objects in this data collection. Essentially this is the sum of metadataCount and dataCount
    * @property {number|string[]} metadataFormatIDs - An array of metadata formatIds and the number of metadata objects with that formatId. Uses same structure as Solr facet counts: ["text/csv", 5]
    * @property {number|string[]} dataFormatIDs - An array of data formatIds and the number of data objects with that formatId. Uses same structure as Solr facet counts: ["text/csv", 5]
    * @property {string} firstUpdate - The earliest upload date for any object in this collection, excluding uploads of obsoleted objects
    * @property {number|string[]} dataUpdateDates - An array of date strings and the number of data objects uploaded on that date. Uses same structure as Solr facet counts: ["2015-08-02", 5]
    * @property {number|string[]} metadataUpdateDates An array of date strings and the number of data objects uploaded on that date. Uses same structure as Solr facet counts: ["2015-08-02", 5]
    * @property {string} firstBeginDate - An ISO date string of the earliest year that this data collection describes, from the science metadata
    * @property {string} lastEndDate - An ISO date string of the latest year that this data collection describes, from the science metadata
    * @property {object} temporalCoverage A simple object of date ranges (the object key) and the number of metadata objects uploaded in that date range (the object value). Example: { "1990-2000": 5 }
    * @property {number} queryCoverageFrom - The year to start the temporal coverage range query
    * @property {number} queryCoverageUntil - The year to end the temporal coverage range query
    * @property {number} metadataTotalSize - The total number of bytes of all metadata files
    * @property {number} dataTotalSize - The total number of bytes of all data files
    * @property {number} totalSize - The total number of bytes or metadata and data files
    * @property {boolean} hideMetadataAssessment - If true, metadata assessment scores will not be retrieved
    * @property {Image} mdqScoresImage - The Image objet of an aggregated metadata assessment chart
    * @property {number} maxQueryLength - The maximum query length that will be sent via GET to the query service. Queries that go beyond this length will be sent via POST, if POST is enabled in the AppModel
    */
    defaults: function(){
      return{
      query: "*:* ",
      postQuery: "",

      metadataCount: 0,
      dataCount: 0,
      totalCount: 0,

      metadataFormatIDs: [],
      dataFormatIDs: [],

      firstUpload: 0,
      totalUploads: 0,
      metadataUploads: null,
      dataUploads: null,
      metadataUploadDates: null,
      dataUploadDates: null,

      //Number of updates to content for each time period
      firstUpdate: null,
      dataUpdateDates: null,
      metadataUpdateDates: null,

      firstBeginDate: null,
      lastEndDate : null,
      temporalCoverage: 0,
      queryCoverageFrom: null,
      queryCoverageUntil: null,

      metadataTotalSize: 0,
      dataTotalSize: 0,
      totalSize: 0,

      hideMetadataAssessment: false,
      mdqScoresImage: null,

      //HTTP GET requests are typically limited to 2,083 characters. So query lengths
      // should have this maximum before switching over to HTTP POST
      maxQueryLength: 2000
    }},

    /**
    * This function serves as a shorthand way to get all of the statistics stored in the model
    */
    getAll: function(){

      // Only get the MetaDIG scores if MetacatUI is configured to display metadata assesments
      // AND this model has them enabled, too.
      if ( !MetacatUI.appModel.get("hideSummaryMetadataAssessment") && !this.get("hideMetadataAssessment") ){
        this.getMdqScores();
      }

      //Send the call the get both the metadata and data stats
      this.getMetadataStats();
      this.getDataStats();

    },

    /**
    * Queries for statistics about metadata objects
    */
    getMetadataStats: function(){

      var query = this.get("query"),
          //Filter out the portal and collection documents
          filterQuery = "-formatId:*dataone.org/collections* AND -formatId:*dataone.org/portals*",
          //Use the stats feature to get the sum of the file size
          stats = "true",
          statsField = "size",
          //Get the facet counts for formatIds
          facet = "true",
          facetFormatIdField = "formatId",
          facetFormatIdMin = "1",
          facetFormatIdMissing = "false",
          facetLimit = "-1",
          //Get the upload counts for each month
          facetRange = "dateUploaded",
          facetRangeGap = "+1MONTH",
          facetRangeStart = "1900-01-01T00:00:00.000Z",
          facetRangeEnd = (new Date()).toISOString(),
          facetMissing = "true",
          //Query for the temporal coverage ranges
          facetQueries = [],
          facetBeginDateField = "beginDate",
          facetEndDateField = "endDate",
          facetDateMin = "1",
          facetDateMissing = "false",
          //Don't return any result docs
          rows = "0",
          //Use JSON for the response format
          wt = "json";

      //How many years back should we look for temporal coverage?
      var lastYear =  this.get('queryCoverageUntil') || new Date().getUTCFullYear(),
          firstYear = this.get('queryCoverageFrom')  || 1950,
          totalYears = lastYear - firstYear,
          today = new Date().getUTCFullYear(),
          yearsFromToday = {
           fromBeginning: today - firstYear,
           fromEnd: today - lastYear
          };

      //Determine our year range/bin size
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

      //Count all the datasets with coverage before the first year in the year range queries
      var beginDateLimit = new Date(Date.UTC(firstYear-1));
      facetQueries.push("{!key=<" + firstYear + "}(beginDate:[* TO " +
                        beginDateLimit.toISOString() +"/YEAR])");

      //Construct our facet.queries for the beginDate and endDates, starting with all years before this current year
      var key = "";

      for(var yearsAgo = yearsFromToday.fromBeginning; (yearsAgo >= yearsFromToday.fromEnd && yearsAgo > 0); yearsAgo -= binSize){
        // The query logic here is: If the beginnning year is anytime before or
        //  during the last year of the bin AND the ending year is anytime after
        //  or during the first year of the bin, it counts.
        if(binSize == 1){
          //Querying for just the current year needs to be treated a bit differently
          // and won't be caught in our for loop
          if(lastYear == today){
            var oneYearFromNow = new Date(Date.UTC(today+1, 0, 1));
            var now = new Date();

            facetQueries.push("{!key=" + lastYear + "}(beginDate:[* TO " +
                              oneYearFromNow.toISOString() + "/YEAR] AND endDate:[" +
                              now.toISOString() + "/YEAR TO *])");
          }
          else{
            key = today - yearsAgo;

            //The coverage should start sometime in this year range or earlier.
            var beginDateLimit = new Date(Date.UTC(today-(yearsAgo-1), 0, 1));
            //The coverage should end sometime in this year range or later.
            var endDateLimit = new Date(Date.UTC(today-yearsAgo, 0, 1));

            facetQueries.push("{!key=" + key + "}(beginDate:[* TO " +
                              beginDateLimit.toISOString() + "/YEAR] AND endDate:[" +
                              endDateLimit.toISOString() + "/YEAR TO *])");
          }
        }
        //If this is the last date range
        else if (yearsAgo <= binSize){
          //Label the facet query with a key for easier parsing
          // Because this is the last year range, which could be uneven with the other year ranges, use the exact end year
          key = (today - yearsAgo) + "-" + lastYear;

          //The coverage should start sometime in this year range or earlier.
          // Because this is the last year range, which could be uneven with the other year ranges, use the exact end year
          var beginDateLimit = new Date(Date.UTC(today-yearsFromToday.fromEnd, 0, 1));
          //The coverage should end sometime in this year range or later.
          var endDateLimit = new Date(Date.UTC(today-yearsAgo, 0, 1));

          facetQueries.push("{!key=" + key + "}(beginDate:[* TO " +
                            beginDateLimit.toISOString() +"/YEAR] AND endDate:[" +
                            endDateLimit.toISOString() + "/YEAR TO *])");
        }
        //For all other bins,
        else{
          //Label the facet query with a key for easier parsing
          key = (today - yearsAgo) + "-" + (today - yearsAgo + binSize-1);

          //The coverage should start sometime in this year range or earlier.
          var beginDateLimit = new Date(Date.UTC(today - (yearsAgo - binSize), 0, 1));
          //The coverage should end sometime in this year range or later.
          var endDateLimit = new Date(Date.UTC(today-yearsAgo, 0, 1));

          facetQueries.push("{!key=" + key + "}(beginDate:[* TO " +
                         beginDateLimit.toISOString() + "/YEAR] AND endDate:[" +
                         endDateLimit.toISOString() + "/YEAR TO *])");
        }
      }

      var model = this;
      var successCallback = function(data, textStatus, xhr) {

        if( !data || !data.response || !data.response.numFound ){
          //Store falsey data
          model.set("totalCount", 0);
          model.trigger("change:totalCount");
          model.set('metadataCount', 0);
          model.trigger("change:metadataCount");
          model.set('metadataFormatIDs', ["", 0]);
          model.set('firstUpdate', null);
          model.set("metadataUpdateDates", []);
        }
        else{
          //Save tthe number of metadata docs found
          model.set('metadataCount', data.response.numFound);
          model.set("totalCount", model.get("dataCount") + data.response.numFound);

          //Save the format ID facet counts
          if( data.facet_counts && data.facet_counts.facet_fields && data.facet_counts.facet_fields.formatId ){
            model.set("metadataFormatIDs", data.facet_counts.facet_fields.formatId);
          }
          else{
            model.set("metadataFormatIDs", ["", 0]);
          }

          //Save the metadata update date counts
          if( data.facet_counts && data.facet_counts.facet_ranges && data.facet_counts.facet_ranges.dateUploaded ){

            //Find the index of the first update date
            var updateFacets = data.facet_counts.facet_ranges.dateUploaded.counts,
                cropAt = 0;

            for( var i=1; i<updateFacets.length; i+=2 ){
              //If there was at least one update/upload in this date range, then save this as the first update
              if( typeof updateFacets[i] == "number" && updateFacets[i] > 0){
                //Save the first first update date
                cropAt = i;
                model.set('firstUpdate', updateFacets[i-1]);
                //Save the update dates, but crop out months that are empty
                model.set("metadataUpdateDates", updateFacets.slice(cropAt+1));
                i = updateFacets.length;
              }
            }

            //If no update dates were found, save falsey values
            if( cropAt === 0 ){
              model.set('firstUpdate', null);
              model.set("metadataUpdateDates", []);
            }
          }

          //Save the temporal coverage dates
          if( data.facet_counts && data.facet_counts.facet_queries ){

            //Find the beginDate and facets so we can store the earliest beginDate
            if( data.facet_counts.facet_fields && data.facet_counts.facet_fields.beginDate ){
              var earliestBeginDate = _.find(data.facet_counts.facet_fields.beginDate, function(value){
                return ( typeof value == "string" && parseInt(value.substring(0,4)) > 1000 );
              });
              if( earliestBeginDate ){
                model.set("firstBeginDate", earliestBeginDate);
              }
            }

            //Find the endDate and facets so we can store the latest endDate
            if( data.facet_counts.facet_fields && data.facet_counts.facet_fields.endDate ){
              var latestEndDate,
                  endDates = data.facet_counts.facet_fields.endDate,
                  nextYear = (new Date()).getUTCFullYear() + 1,
                  i = 0;

              //Iterate over each endDate and find the first valid one. (After year 1000 but not after today)
              while( !latestEndDate && i<endDates.length ){
                var endDate = endDates[i];
                if( typeof endDate == "string" ){
                  endDate = parseInt(endDate.substring(0,3));
                  if( endDate > 1000 && endDate < nextYear){
                    latestEndDate = endDate;
                  }
                }
                i++;
              }

              //Save the latest endDate if one was found
              if( latestEndDate ){
                model.set("lastEndDate", latestEndDate);
              }
            }

            //Save the temporal coverage year ranges
            var tempCoverages = data.facet_counts.facet_queries;
            model.set("temporalCoverage", tempCoverages);
          }
          else{
            model.set("temporalCoverage", 0);
            model.triggerChange("temporalCoverage");
          }

          //Get the total size of all the files in the index
          if( data.stats && data.stats.stats_fields && data.stats.stats_fields.size && data.stats.stats_fields.size.sum ){
            //Save the size sum
            model.set("metadataTotalSize", data.stats.stats_fields.size.sum);
            //If there is a data size sum,
            if( model.get("dataTotalSize") > 0 ){
              //Add it to the metadata size sum as the total sum
              model.set("totalSize", model.get("dataTotalSize") + data.stats.stats_fields.size.sum);
            }
          }
        }
      }

      //Construct the full URL for the query
      var fullQueryURL = MetacatUI.appModel.get('queryServiceUrl') +
          "q=" + query +
          "&fq=" + filterQuery +
          "&stats=" + stats +
          "&stats.field=" + statsField +
          "&facet=" + facet +
          "&facet.field=" + facetFormatIdField +
          "&facet.field=" + facetBeginDateField +
          "&facet.field=" + facetEndDateField +
          "&f." + facetFormatIdField  + ".facet.mincount=" + facetFormatIdMin +
          "&f." + facetFormatIdField  + ".facet.missing=" + facetFormatIdMissing +
          "&f." + facetBeginDateField + ".facet.mincount=" + facetDateMin +
          "&f." + facetEndDateField   + ".facet.mincount=" + facetDateMin +
          "&f." + facetBeginDateField + ".facet.missing=" + facetDateMissing +
          "&f." + facetEndDateField   + ".facet.missing=" + facetDateMissing +
          "&facet.limit=" + facetLimit +
          "&f." + facetRange + ".facet.missing=" + facetMissing +
          "&facet.range=" + facetRange +
          "&facet.range.start=" + facetRangeStart +
          "&facet.range.end=" + facetRangeEnd +
          "&facet.range.gap=" + encodeURIComponent(facetRangeGap) +
          "&facet.query=" + facetQueries.join("&facet.query=") +
          "&rows=" + rows +
          "&wt=" + wt;

      if( this.getRequestType(fullQueryURL) == "POST" ){

        if( this.get("postQuery") ){
          query = this.get("postQuery");
        }
        else if( this.get("searchModel") ){
          query = this.get("searchModel").getQuery(undefined, { forPOST: true });
          this.set("postQuery", query);
        }

        var queryData = new FormData();
        queryData.append("q", query);
        queryData.append("fq", filterQuery);
        queryData.append("stats", stats);
        queryData.append("stats.field", statsField);
        queryData.append("facet", facet);
        queryData.append("facet.field", facetFormatIdField);
        queryData.append("facet.field", facetBeginDateField);
        queryData.append("facet.field", facetEndDateField);
        queryData.append("f." + facetFormatIdField  + ".facet.mincount", facetFormatIdMin);
        queryData.append("f." + facetFormatIdField  + ".facet.missing", facetFormatIdMissing);
        queryData.append("f." + facetBeginDateField + ".facet.mincount", facetDateMin);
        queryData.append("f." + facetEndDateField   + ".facet.mincount", facetDateMin);
        queryData.append("f." + facetBeginDateField + ".facet.missing", facetDateMissing);
        queryData.append("f." + facetEndDateField   + ".facet.missing", facetDateMissing);
        queryData.append("facet.limit", facetLimit);
        queryData.append("facet.range", facetRange);
        queryData.append("facet.range.start", facetRangeStart);
        queryData.append("facet.range.end", facetRangeEnd);
        queryData.append("facet.range.gap", facetRangeGap);
        queryData.append("f." + facetRange + ".facet.missing", facetMissing);
        queryData.append("rows", rows);
        queryData.append("wt", wt);

        //Add the facet queries to the POST body
        _.each(facetQueries, function(facetQuery){
          queryData.append("facet.query", facetQuery);
        });

        //Create the request settings for POST requests
        var requestSettings = {
          url: MetacatUI.appModel.get('queryServiceUrl'),
          type: "POST",
          contentType: false,
          processData: false,
          data: queryData,
          dataType: "json",
          success: successCallback
        }
      }
      else{
        //Create the request settings for GET requests
        var requestSettings = {
          url: fullQueryURL,
          type: "GET",
          dataType: "json",
          success: successCallback
        }
      }

      //Send the request
      $.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));

    },

    /**
    * Queries for statistics about data objects
    */
    getDataStats: function(){

      var query = "{!join from=resourceMap to=resourceMap}" + this.get("query"),
          //Filter out resource maps and metatdata objects
          filterQuery = "formatType:DATA",
          //Use the stats feature to get the sum of the file size
          stats = "true",
          statsField = "size",
          //Get the facet counts for formatIds
          facet = "true",
          facetField = "formatId",
          facetFormatIdMin = "1",
          facetFormatIdMissing = "false",
          facetLimit = "-1",
          //Get the upload counts for each month
          facetRange = "dateUploaded",
          facetRangeGap = "+1MONTH",
          facetRangeStart = "1900-01-01T00:00:00.000Z",
          facetRangeEnd = (new Date()).toISOString(),
          facetRangeMissing = "true",
          //Don't return any result docs
          rows = "0",
          //Use JSON for the response format
          wt = "json";

      var fullQueryURL = MetacatUI.appModel.get('queryServiceUrl') +
          "q=" + query +
          "&fq=" + filterQuery +
          "&stats=" + stats +
          "&stats.field=" + statsField +
          "&facet=" + facet +
          "&facet.field=" + facetField +
          "&facet.limit=" + facetLimit +
          "&f." + facetField + ".facet.mincount=" + facetFormatIdMin +
          "&f." + facetField + ".facet.missing=" + facetFormatIdMissing +
          "&f." + facetRange + ".facet.missing=" + facetRangeMissing +
          "&facet.range=" + facetRange +
          "&facet.range.start=" + facetRangeStart +
          "&facet.range.end=" + facetRangeEnd +
          "&facet.range.gap=" + encodeURIComponent(facetRangeGap) +
          "&rows=" + rows +
          "&wt=" + wt;

      var model = this;
      var successCallback = function(data, textStatus, xhr) {

        if( !data || !data.response || !data.response.numFound ){
          //Store falsey data
          model.set("totalCount", 0);
          model.trigger("change:totalCount");
          model.set('dataCount', 0);
          model.trigger("change:dataCount");
          model.set('dataFormatIDs', ["", 0]);
          model.set('firstUpdate', null);
          model.set("dataUpdateDates", []);
        }
        else{
          //Save the number of data docs found
          model.set('dataCount', data.response.numFound);
          model.set("totalCount", model.get("metadataCount") + data.response.numFound);

          //Save the format ID facet counts
          if( data.facet_counts && data.facet_counts.facet_fields && data.facet_counts.facet_fields.formatId ){
            model.set("dataFormatIDs", data.facet_counts.facet_fields.formatId);
          }
          else{
            model.set("dataFormatIDs", ["", 0]);
          }

          //Save the data update date counts
          if( data.facet_counts && data.facet_counts.facet_ranges && data.facet_counts.facet_ranges.dateUploaded ){

            //Find the index of the first update date
            var updateFacets = data.facet_counts.facet_ranges.dateUploaded.counts,
                cropAt = 0;

            for( var i=1; i<updateFacets.length; i+=2 ){
              //If there was at least one update/upload in this date range, then save this as the first update
              if( typeof updateFacets[i] == "number" && updateFacets[i] > 0){
                //Save the first first update date
                cropAt = i;
                model.set('firstUpdate', updateFacets[i-1]);
                //Save the update dates, but crop out months that are empty
                model.set("dataUpdateDates", updateFacets.slice(cropAt+1));
                i = updateFacets.length;
              }
            }

            //If no update dates were found, save falsey values
            if( cropAt === 0 ){
              model.set('firstUpdate', null);
              model.set("dataUpdateDates", []);
            }
          }

          //Get the total size of all the files in the index
          if( data.stats && data.stats.stats_fields && data.stats.stats_fields.size && data.stats.stats_fields.size.sum ){
            //Save the size sum
            model.set("dataTotalSize", data.stats.stats_fields.size.sum);
            //If there is a metadata size sum,
            if( model.get("metadataTotalSize") > 0 ){
              //Add it to the data size sum as the total sum
              model.set("totalSize", model.get("metadataTotalSize") + data.stats.stats_fields.size.sum);
            }
          }
        }
      }

      if( this.getRequestType(fullQueryURL) == "POST" ){

        if( this.get("postQuery") ){
          query = this.get("postQuery");
        }
        else if( this.get("searchModel") ){
          query = this.get("searchModel").getQuery(undefined, { forPOST: true });
          this.set("postQuery", query);
        }

        var queryData = new FormData();
        queryData.append("q", query);
        queryData.append("fq", filterQuery);
        queryData.append("stats", stats);
        queryData.append("stats.field", statsField);
        queryData.append("facet", facet);
        queryData.append("facet.field", facetField);
        queryData.append("facet.limit", facetLimit);
        queryData.append("f." + facetField + ".facet.mincount", facetFormatIdMin);
        queryData.append("f." + facetField + ".facet.missing", facetFormatIdMissing);
        queryData.append("f." + facetRange + ".facet.missing", facetRangeMissing);
        queryData.append("facet.range", facetRange);
        queryData.append("facet.range.start", facetRangeStart);
        queryData.append("facet.range.end", facetRangeEnd);
        queryData.append("facet.range.gap", facetRangeGap);
        queryData.append("rows", rows);
        queryData.append("wt", wt);

        //Create the request settings for POST requests
        var requestSettings = {
          url: MetacatUI.appModel.get('queryServiceUrl'),
          type: "POST",
          contentType: false,
          processData: false,
          data: queryData,
          dataType: "json",
          success: successCallback
        }
      }
      else{
        //Create the request settings for GET requests
        var requestSettings = {
          url: fullQueryURL,
          type: "GET",
          dataType: "json",
          success: successCallback
        }
      }

      //Send the request
      $.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));

    },

    /**
    * @deprecated as of MetacatUI version 2.11.1. Use {@link Stats#getMetadataStats} and {@link Stats#getDataStats} to get the formatTypes.
    * This function may be removed in a future release.
    */
    getFormatTypes: function(){
      this.getMetadataStats();
      this.getDataStats();
    },

    /**
    * @deprecated as of MetacatUI version 2.11.1. Use {@link Stats#getDataStats} to get the formatTypes.
    * This function may be removed in a future release.
    */
    getDataFormatIDs: function(){
      this.getDataStats();
    },

    /**
    * @deprecated as of MetacatUI version 2.11.1. Use {@link Stats#getMetadataStats} to get the formatTypes.
    * This function may be removed in a future release.
    */
    getMetadataFormatIDs: function(){
      this.getMetadataStats();
    },

    /**
    * @deprecated as of MetacatUI version 2.11.1. Use {@link Stats#getMetadataStats} and {@link Stats#getDataStats} to get the formatTypes.
    * This function may be removed in a future release.
    */
    getUpdateDates: function(){
      this.getMetadataStats();
      this.getDataStats();
    },

    /**
    * @deprecated as of MetacatUI version 2.11.1. Use {@link Stats#getMetadataStats} to get the formatTypes.
    * This function may be removed in a future release.
    */
    getCollectionYearFacets: function(){
      this.getMetadataStats();
    },

    /**
    * Retrieves an image of the metadata assessment scores
    */
    getMdqScores: function(){
      try{
        var myImage = new Image();
        var model = this;
        myImage.crossOrigin = ""; // or "anonymous"
        if(MetacatUI.appView.currentView === null) return;

        // Call the function with the URL we want to load, but then chain the
        // promise then() method on to the end of it. This contains two callbacks
        var serviceUrl = MetacatUI.appModel.get('mdqScoresServiceUrl');

        if( !serviceUrl ){
          this.set("mdqScoresImage", this.defaults().mdqScoresImage);
          this.trigger("change:mdqScoresImage");
          return;
        }

        if( Array.isArray(MetacatUI.appModel.get('mdqAggregatedSuiteIds')) && MetacatUI.appModel.get('mdqAggregatedSuiteIds').length ){
          var suite = MetacatUI.appModel.get('mdqAggregatedSuiteIds')[0];
          var id = MetacatUI.appView.currentView.model.get("id");
          var url = serviceUrl + "?collection=" + id + "&suite=" + suite;
          this.imgLoad(url).then(function (response) {
              // The first runs when the promise resolves, with the request.reponse specified within the resolve() method.
              var imageURL = window.URL.createObjectURL(response);
              myImage.src = imageURL;
              model.set('mdqScoresImage', myImage);
              // The second runs when the promise is rejected, and logs the Error specified with the reject() method.
          }, function (Error) {
              console.error(Error);
          });
        }
        else{
          this.set("mdqScoresImage", this.defaults().mdqScoresImage);
        }
      }
      catch(e){
        this.set("mdqScoresImage", this.defaults().mdqScoresImage);
        this.trigger("change:mdqScoresImage");
        console.error("Cannot get the Metadata Quality scores: ", e);
      }
    },

    /**
    * Retrieves an image via a Promise. Primarily used by {@link Stats#getMdqScores}
    * @param {string} url - The URL of the image
    */
    imgLoad: function(url) {
        // Create new promise with the Promise() constructor;
        // This has as its argument a function with two parameters, resolve and reject
        var model = this;
        return new Promise(function (resolve, reject) {
            // Standard XHR to load an image
            var request = new XMLHttpRequest();
            request.open('GET', url);
            request.responseType = 'blob';

            // When the request loads, check whether it was successful
            request.onload = function () {
                if (request.status === 200) {
                    // If successful, resolve the promise by passing back the request response
                    resolve(request.response);
                } else {
                    // If it fails, reject the promise with a error message
                    reject(new Error('Image didn\'t load successfully; error code:' + request.statusText));
                    model.set('mdqScoresError', request.statusText);
                }
            };

            request.onerror = function () {
                console.log("onerror");
                // Also deal with the case when the entire request fails to begin with
                // This is probably a network error, so reject the promise with an appropriate message
                reject(new Error('There was a network error.'));
            };

            // Send the request
            request.send();
        });
    },

    /**
    * Given the query or URL, determine whether this model should send GET or POST
    * requests, because of URL length restrictions in browsers.
    * @param {string} queryOrURLString - The full query or URL that will be sent to the query service
    * @returns {string} The request type to use. Either `GET` or `POST`
    */
    getRequestType: function(queryOrURLString){
      //If POSTs to the query service are disabled completely, use GET
      if( MetacatUI.appModel.get("disableQueryPOSTs") ){
        return "GET";
      }
      //If POSTs are enabled and the URL is over the maximum, use POST
      else if( queryOrURLString && queryOrURLString.length > this.get("maxQueryLength") ){
        return "POST";
      }
      //Otherwise, default to GET
      else{
        return "GET";
      }
    }

  });
  return Stats;
});
