/*global define */
define(['jquery', 'underscore', 'backbone', 'models/LogsSearch', 'promise'],
	function($, _, Backbone, LogsSearch, Promise) {
	'use strict';

	// Statistics Model
	// ------------------
	var Stats = Backbone.Model.extend(
    /** @lends Stats.prototype */{
		// This model contains all of the statistics in a user's or query's profile
		defaults: {
			query: "*:* ", //Show everything
      postQuery: "", //An unencoded version of the query

			metadataCount: 0,
			dataCount: 0,
			totalCount: 0,
			metadataFormatIDs: [], //Uses same structure as Solr facet counts: ["text/csv", 5]
			dataFormatIDs: [], //Uses same structure as Solr facet counts: ["text/csv", 5]

			firstUpload: 0,
			totalUploads: 0, //total data and metadata objects uploaded, including now obsoleted objects
			metadataUploads: null,
			dataUploads: null,
			metadataUploadDates: null,
			dataUploadDates: null,

			//Number of updates to content for each time period
			firstUpdate: 0,
			dataUpdateDates: null,
			metadataUpdateDates: null,

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

      //HTTP GET requests are typically limited to 2,083 characters. So query lengths
      // should have this maximum before switching over to HTTP POST
      maxQueryLength: 1958,
      usePOST: false,

			supportDownloads: (MetacatUI.appModel.get("nodeId") && MetacatUI.appModel.get("d1LogServiceUrl"))
		},

		//Some dated used for query creation
		firstPossibleUpload: "2000-01-01T00:00:00Z", //The first possible date that an object could be uploaded (based on DataONE dates)
		firstPossibleDataONEDownload: "2012-07-01T00:00:00Z", //The first possible download date from the DataONE CN
		firstPossibleDataONEDate: "2012-07-01T00:00:00Z", //The first possible download date from the DataONE CN
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

      //Set the request type (GET or POST)
      this.setRequestType();
      this.on("change:query", this.setRequestType);

		},

		//This function serves as a shorthand way to get all of the statistics stored in the model
		getAll: function(){
			//Listen for our responses back from the server before we send requests that require info from the response
			this.listenToOnce(this, 'change:firstBeginDate', this.getLastEndDate);
			this.listenToOnce(this, 'change:lastEndDate', this.getCollectionYearFacets);
			this.listenToOnce(this, 'change:dataCount', this.getDataFormatIDs);
			this.listenToOnce(this, 'change:metadataCount', this.getMetadataFormatIDs);
			this.listenToOnce(this, 'change:firstUpload', this.getUpdateDates);


			this.getFirstBeginDate();
			this.getFirstUpload();

			this.getFormatTypes();

			this.getDownloadDates();
            this.getMdqScores();
			//this.getMdqStatsTotal();
			//this.getDataDownloadDates();
			//this.getMetadataDownloadDates();
		},

    // Send a Solr query to get the earliest beginDate, latest endDate, and facets of data collection years
    getFirstBeginDate: function(){
      var model = this;

      //Define a success callback when the query is successful
      var successCallback = function(data, textStatus, xhr) {

        if( !data.response.numFound ){

          //There were no begin dates found
          model.set('totalBeginDates', 0);

          //Construct a query
          var query = model.get('query') +
                " AND endDate:[" + model.firstPossibleDate + " TO " + (new Date()).toISOString() + "]" + //Use date filter to weed out badly formatted data
                " AND -obsoletedBy:*",
              //Get one row only
              rows = "1",
              //Sort the results in ascending order
              sort = "endDate asc",
              //Return only the endDate field
              fl = "endDate";

          var successCallback = function(endDateData, textStatus, xhr) {
            //If not endDates or beginDates are found, there is no temporal data in the index, so save falsey values
            if(!endDateData.response.numFound){
              model.set('firstBeginDate', null);
              model.set('lastEndDate', null);
            }
            else{
              model.set('firstBeginDate', new Date.fromISO(endDateData.response.docs[0].endDate));
            }
          }

          if( model.get("usePOST") ){

            var queryData = new FormData();
            queryData.append("q", query);
            queryData.append("rows", rows);
            queryData.append("sort", sort);
            queryData.append("fl", fl);
            queryData.append("wt", "json");

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
            //Find the earliest endDate if there are no beginDates
            var requestSettings = {
              url: MetacatUI.appModel.get('queryServiceUrl') + "q=" + query +
                   "&rows=" + rows + "&sort=" + sort + "&fl=" + fl + "&wt=json",
              type: "GET",
              dataType: "json",
              success: successCallback
            }
          }

          $.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));
        }
        else{
          // Save the earliest beginDate and total found in our model
          model.set('firstBeginDate', new Date.fromISO(data.response.docs[0].beginDate));
          model.set('totalBeginDates', data.response.numFound);

          model.trigger("change:firstBeginDate");
          model.trigger("change:totalBeginDates");
        }
      }

      //Construct a query
      var specialQueryParams = " AND beginDate:[" + this.firstPossibleDate + " TO " + (new Date()).toISOString() + "] AND -obsoletedBy:*",
          query = this.get("query") + specialQueryParams,
          //Get one row only
          rows = "1",
          //Sort the results in ascending order
          sort = "beginDate asc",
          //Return only the beginDate field
          fl = "beginDate";

      if( this.get("usePOST") ){

        //Get the unencoded query string
        if( this.get("postQuery") ){
          query = this.get("postQuery") + specialQueryParams;
        }
        else if( this.get("searchModel") ){
          query = this.get("searchModel").getQuery(undefined, { forPOST: true });
          this.set("postQuery", query);
          query = query + specialQueryParams;
        }

        var queryData = new FormData();
        queryData.append("q", query);
        queryData.append("rows", rows);
        queryData.append("sort", sort);
        queryData.append("fl", fl);
        queryData.append("wt", "json");

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

        var requestSettings = {
          url: MetacatUI.appModel.get('queryServiceUrl') + "q=" + query +
               "&rows=" + rows +
               "&fl=" + fl +
               "&sort=" + sort +
               "&wt=json",
          type: "GET",
          dataType: "json",
          success: successCallback
        }

      }

      //Send the query
      $.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));

		},

    getLastEndDate: function(){
      var model = this;

      var now = new Date();

      //Get the latest temporal data coverage year
      var specialQueryParams = " AND endDate:[" + this.firstPossibleDate + " TO " + now.toISOString() + "]" + //Use date filter to weed out badly formatted data
            " AND -obsoletedBy:*",
          query = this.get('query') + specialQueryParams,
          rows = 1,
          fl   = "endDate",
          sort = "endDate desc",
          wt   = "json";

      var successCallback = function(data, textStatus, xhr) {
        if(typeof data == "string"){
          data = JSON.parse(data);
        }

        if(!data.response.numFound){
          //Save some falsey values if none are found
          model.set('lastEndDate', null);
        }
        else{
          // Save the earliest beginDate and total found in our model - but do not accept a year greater than this current year
          var now = new Date();
          if(new Date.fromISO(data.response.docs[0].endDate).getUTCFullYear() > now.getUTCFullYear()){
            model.set('lastEndDate', now);
          }
          else{
            model.set('lastEndDate', new Date.fromISO(data.response.docs[0].endDate));
          }

          model.trigger("change:lastEndDate");
        }
      }

      if( this.get("usePOST") ){

        //Get the unencoded query string
        if( this.get("postQuery") ){
          query = this.get("postQuery") + specialQueryParams;
        }
        else if( this.get("searchModel") ){
          query = this.get("searchModel").getQuery(undefined, { forPOST: true });
          this.set("postQuery", query);
          query = query + specialQueryParams;
        }

        var queryData = new FormData();
        queryData.append("q", query);
        queryData.append("rows", rows);
        queryData.append("sort", sort);
        queryData.append("fl", fl);
        queryData.append("wt", "json");

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
        //Query for the latest endDate
        var requestSettings = {
          url: MetacatUI.appModel.get('queryServiceUrl') + "q=" + query +
               "&rows=" + rows + "&fl=" + fl + "&sort=" + sort + "&wt=" + wt,
          type: "GET",
          dataType: "json",
          success: successCallback
        }
      }

      $.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));
    },

    /**
    ** getFormatTypes will send three Solr queries to get the formatTypes and formatID statistics and will update the  model
    **/
    getFormatTypes: function(){
      var model = this;

      //Build the query to get the format types
      var specialQueryParams = " AND (formatType:METADATA OR formatType:DATA) AND -obsoletedBy:*",
          query = this.get('query') + specialQueryParams,
          rows  = "2",
          group = true,
          groupField = "formatType",
          groupLimit = "0",
          stats      = true,
          statsField = "size",
          sort       = "formatType desc",
          wt         = "json";

      var successCallback = function(data, textStatus, xhr) {

        var formats = data.grouped.formatType.groups;

        if(formats.length == 1){	//Only one format type was found
          if(formats[0].groupValue == "METADATA"){ //That one format type is metadata
            model.set('dataCount', 0);
            model.trigger("change:dataCount");
            model.set('metadataCount', formats[0].doclist.numFound);
            model.set('dataFormatIDs', ["", 0]);
          }else{
            model.set('dataCount', formats[0].doclist.numFound);
            model.set('metadataCount', 0);
            model.trigger("change:metadataCount");
            model.set('metadataFormatIDs', ["", 0]);
          }
        }
        //If no data or metadata objects were found, draw blank charts
        else if(formats.length == 0){

          //Store falsey data
          model.set('dataCount', 0);
          model.trigger("change:dataCount");

          model.set("totalCount", 0);
          model.trigger("change:totalCount");

          model.set('metadataCount', 0);
          model.trigger("change:metadataCount");

          model.set('metadataFormatIDs', ["", 0]);
          model.set('dataFormatIDs', ["", 0]);

          return;
        }
        else{
          //Extract the format types (because of filtering and sorting they will always return in this order)
          model.set('metadataCount', formats[0].doclist.numFound);
          model.set('dataCount', formats[1].doclist.numFound);
        }

        //Get the total size of all the files in the index
        var totalSize = data.stats.stats_fields.size.sum;
        model.set("totalSize", totalSize);
      }

      if( this.get("usePOST") ){

        //Get the unencoded query string
        if( this.get("postQuery") ){
          query = this.get("postQuery") + specialQueryParams;
        }
        else if( this.get("searchModel") ){
          query = this.get("searchModel").getQuery(undefined, { forPOST: true });
          this.set("postQuery", query);
          query = query + specialQueryParams;
        }

        var requestData = new FormData();
        requestData.append("q", query);
        requestData.append("rows", rows);
        requestData.append("group", group);
        requestData.append("group.field", groupField);
        requestData.append("group.limit", groupLimit);
        requestData.append("stats", stats);
        requestData.append("stats.field", statsField);
        requestData.append("sort", sort);
        requestData.append("wt", wt);

        //Request settings for POST requests
        var requestSettings = {
          url: MetacatUI.appModel.get('queryServiceUrl'),
          data: requestData,
          contentType: false,
          processData: false,
          type: "POST",
          dataType: "json",
          success: successCallback
        }

      }
      else{
        //Run the query
        var requestSettings = {
          url: MetacatUI.appModel.get('queryServiceUrl') +
               "q=" + query +
               "&rows=" + rows +
               "&group=" + group +
               "&group.field=" + groupField +
               "&group.limit=" + groupLimit +
               "&stats=" + stats +
               "&stats.field=" + statsField +
               "&sort=" + sort +
               "&wt=" + wt,
          type: "GET",
          dataType: "json",
          success: successCallback
        }
      }

      $.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));
    },

		getDataFormatIDs: function(){
			var model = this;

      if( !this.get('dataCount') ){
        return;
      }

      var specialQueryParams = " AND formatType:DATA AND -obsoletedBy:*",
          query = this.get('query') + specialQueryParams,
          facet = "true",
          facetField = "formatId",
          facetLimit = "-1",
          facetMincount = "1",
          rows = "0",
          wt = "json";

      var successCallback = function(data, textStatus, xhr) {
        model.set('dataFormatIDs', data.facet_counts.facet_fields.formatId);
      }

      if( this.get("usePOST") ){

        //Get the unencoded query string
        if( this.get("postQuery") ){
          query = this.get("postQuery") + specialQueryParams;
        }
        else if( this.get("searchModel") ){
          query = this.get("searchModel").getQuery(undefined, { forPOST: true });
          this.set("postQuery", query);
          query = query + specialQueryParams;
        }

        var queryData = new FormData();
        queryData.append("q", query);
        queryData.append("facet", facet);
        queryData.append("facet.field", facetField);
        queryData.append("facet.limit", facetLimit);
        queryData.append("facet.mincount", facetMincount);
        queryData.append("rows", rows);
        queryData.append("wt", wt);

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
        //Now get facet counts of the data format ID's
        var requestSettings = {
          url: MetacatUI.appModel.get('queryServiceUrl') + "q=" + query +
               "&facet=" + facet + "&facet.field=" + facetField +
               "&facet.limit=" + facetLimit + "&facet.mincount=" + facetMincount +
               "&rows=" + rows + "&wt=" + wt,
          type: "GET",
          dataType: "json",
          success: successCallback
        }
      }

      $.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));
		},

    getMetadataFormatIDs: function(){

      if( !this.get('metadataCount') ){
        return;
      }

			var model = this;

      var specialQueryParams = " AND formatType:METADATA AND -obsoletedBy:*",
          query = this.get("query") + specialQueryParams,
          facet = "true",
          facetField = "formatId",
          facetLimit = "-1",
          facetMincount = "1",
          rows = "0",
          wt = "json";

      var successCallback = function(data, textStatus, xhr) {
        model.set('metadataFormatIDs', data.facet_counts.facet_fields.formatId);
      }

      if( this.get("usePOST") ){

        //Get the unencoded query string
        if( this.get("postQuery") ){
          query = this.get("postQuery") + specialQueryParams;
        }
        else if( this.get("searchModel") ){
          query = this.get("searchModel").getQuery(undefined, { forPOST: true });
          this.set("postQuery", query);
          query = query + specialQueryParams;
        }

        var queryData = new FormData();
        queryData.append("q", query);
        queryData.append("facet", facet);
        queryData.append("facet.field", facetField);
        queryData.append("facet.limit", facetLimit);
        queryData.append("facet.mincount", facetMincount);
        queryData.append("rows", rows);
        queryData.append("wt", wt);

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
        //Now get facet counts of the metadata format ID's
        var requestSettings = {
          url: MetacatUI.appModel.get('queryServiceUrl') + "q=" + query +
               "&facet=" + facet + "&facet.field=" + facetField +
               "&facet.limit=" + facetLimit + "&facet.mincount=" + facetMincount +
               "&rows=" + rows + "&wt=" + wt,
          type: "GET",
          dataType: "json",
          success: successCallback
        }
      }

      $.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));
    },

    /*
    * getUpdateDates will get the number of newest-version science metadata and data
    * objects uploaded in each month
    */
    getUpdateDates: function(){

      var model = this;

      var now = new Date();

      var metadataQueryParams = "AND -obsoletedBy:* AND formatType:METADATA";
      var metadataQuery = this.get('query') + metadataQueryParams;

      var firstPossibleUpdate = MetacatUI.nodeModel.isCN(MetacatUI.nodeModel.get("currentMemberNode"))?
        this.firstPossibleDataONEDate : model.get("firstUpload");

      if( !firstPossibleUpdate ){
        firstPossibleUpdate = new Date();
        firstPossibleUpdate.setYear( firstPossibleUpdate.getYear() - 100 );
        firstPossibleUpdate = firstPossibleUpdate.toISOString();
      }

      var rows = "1",
          sort = "dateUploaded asc",
          facet = "true",
          facetMissing = "true", //Include months that have 0 uploads
          facetLimit = "-1",
          facetRange = "dateUploaded",
          facetRangeStart = firstPossibleUpdate,
          facetRangeEnd = now.toISOString(),
          wt = "json";

      var dataSuccessCallback = function(data, textStatus, xhr) {
        if( !data.response.numFound ){
          model.set("dataUpdateDates", []);
        }
        else{

          //Get the array of dateUploaded facets
          var updateDates = data.facet_counts.facet_ranges.dateUploaded.counts;

          //Remove all the empty facet counts at the beginning of the array
          while(updateDates[1] == 0){

            updateDates.splice(0, 2);

          }

          //Save the dateUploaded facets for data objects
          model.set("dataUpdateDates", updateDates);

          // Save the earliest dateUploaded and total found in our model
          if(updateDates[0] < model.get("firstUpdate"))
            model.set('firstUpdate', updateDates[0]);
        }
      }

      var metadataSuccessCallback = function(data, textStatus, xhr) {

        if( !data.response.numFound ){
          model.set('firstUpdate', null);

          model.set("metadataUpdateDates", []);
        }
        else{

          //Get the array of dateUploaded facets
          var updateDates = data.facet_counts.facet_ranges.dateUploaded.counts;

          //Remove all the empty facet counts at the beginning of the array
          while(updateDates[1] == 0){

            updateDates.splice(0, 2);

          }

          //Save the dateUploaded facets for metadata objects
          model.set("metadataUpdateDates", updateDates);

          // Save the earliest dateUploaded and total found in our model
          model.set('firstUpdate', updateDates[0]);
        }

        var dataQueryParams = " AND -obsoletedBy:* AND formatType:DATA",
            dataQuery = model.get("query") + dataQueryParams;

        if( model.get("usePOST") ){

          //Get the unencoded query string
          if( model.get("postQuery") ){
            dataQuery = model.get("postQuery") + dataQueryParams;
          }
          else if( model.get("searchModel") ){
            dataQuery = this.get("searchModel").getQuery(undefined, { forPOST: true });
            this.set("postQuery", query);
            dataQuery = dataQuery + dataQueryParams;
          }

          var queryData = new FormData();
          queryData.append("q", dataQuery);
          queryData.append("sort", sort);
          queryData.append("facet", facet);
          queryData.append("facet.missing", facetMissing);
          queryData.append("facet.limit", facetLimit);
          queryData.append("facet.range", facetRange);
          queryData.append("facet.range.start", facetRangeStart);
          queryData.append("facet.range.end", facetRangeEnd);
          queryData.append("facet.range.gap", "+1MONTH");
          queryData.append("rows", rows);
          queryData.append("wt", wt);

          var requestSettings = {
            url: MetacatUI.appModel.get('queryServiceUrl'),
            type: "POST",
            contentType: false,
            processData: false,
            data: queryData,
            dataType: "json",
            success: dataSuccessCallback
          }
        }
        else{
          var requestSettings = {
            url: MetacatUI.appModel.get('queryServiceUrl') + "q=" + dataQuery +
                 "&sort=" + sort + "&rows=" + rows + "&facet=" + facet +
                 "&facet.missing=" + facetMissing + "&facet.limit=" + facetLimit +
                 "&facet.range=" + facetRange + "&facet.range.start=" + facetRangeStart +
                 "&facet.range.end=" + facetRangeEnd + "&facet.range.gap=" + "%2B1MONTH" +
                 "&wt=" + wt,
            type: 'GET',
            dataType: "json",
            success: dataSuccessCallback
          }
        }

        $.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));
      }

      if( this.get("usePOST") ){

        //Get the unencoded query string
        if( this.get("postQuery") ){
          metadataQuery = this.get("postQuery") + metadataQueryParams;
        }
        else if( this.get("searchModel") ){
          metadataQuery = this.get("searchModel").getQuery(undefined, { forPOST: true });
          this.set("postQuery", metadataQuery);
          metadataQuery = metadataQuery + metadataQueryParams;
        }

        var queryData = new FormData();
        queryData.append("q", metadataQuery);
        queryData.append("sort", sort);
        queryData.append("facet", facet);
        queryData.append("facet.missing", facetMissing);
        queryData.append("facet.limit", facetLimit);
        queryData.append("facet.range", facetRange);
        queryData.append("facet.range.start", facetRangeStart);
        queryData.append("facet.range.end", facetRangeEnd);
        queryData.append("facet.range.gap", "+1MONTH");
        queryData.append("rows", rows);
        queryData.append("wt", wt);

        var requestSettings = {
          url: MetacatUI.appModel.get('queryServiceUrl'),
          type: "POST",
          contentType: false,
          processData: false,
          data: queryData,
          dataType: "json",
          success: metadataSuccessCallback
        }
      }
      else{
        //Run the query
        var requestSettings = {
          url: MetacatUI.appModel.get('queryServiceUrl') + "q=" + metadataQuery +
               "&sort=" + sort + "&rows=" + rows + "&facet=" + facet +
               "&facet.missing=" + facetMissing + "&facet.limit=" + facetLimit +
               "&facet.range=" + facetRange + "&facet.range.start=" + facetRangeStart +
               "&facet.range.end=" + facetRangeEnd + "&facet.range.gap=" + "%2B1MONTH" +
               "&wt=" + wt,
          dataType: "json",
          type: "GET",
          success: metadataSuccessCallback
        }
      }

			$.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));

		},

    /*
    * Gets the earliest dateUploaded from the solr index
    */
    getFirstUpload: function(){

      var now = new Date(),
          model = this,
          firstPossibleUpload = new Date();

        firstPossibleUpload.setYear( firstPossibleUpload.getYear() - 100 );
        firstPossibleUpload = firstPossibleUpload.toISOString();

      //Get the earliest upload date
      var specialQueryParams = " AND formatType:(METADATA OR DATA)" + //Weeds out resource maps and annotations
                  " AND dateUploaded:[" + firstPossibleUpload + " TO " + now.toISOString() + "]" + //Weeds out badly formatted dates
                  " AND -obsoletes:*",    //Only count one version of a revision chain
          query = this.get('query') + specialQueryParams,
          fl   = "dateUploaded",
          rows = "1",
          sort = "dateUploaded asc",
          wt   = "json";

      var successCallback = function(data, textStatus, xhr) {
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
        }
      }

      if( this.get("usePOST") ){

        //Get the unencoded query string
        if( this.get("postQuery") ){
          query = this.get("postQuery") + specialQueryParams;
        }
        else if( this.get("searchModel") ){
          query = this.get("searchModel").getQuery(undefined, { forPOST: true });
          this.set("postQuery", query);
          query = query + specialQueryParams;
        }

        var requestData = new FormData();
        requestData.append("q", query);
        requestData.append("rows", rows);
        requestData.append("fl", fl);
        requestData.append("sort", sort);
        requestData.append("wt", wt);

        //Request settings for POST requests
        var requestSettings = {
          url: MetacatUI.appModel.get('queryServiceUrl'),
          data: requestData,
          processData: false,
          contentType: false,
          type: "POST",
          dataType: "json",
          success: successCallback
        }

      }
      else{

        //Request settings for GET requests
        var requestSettings = {
          url: MetacatUI.appModel.get('queryServiceUrl') + "q=" + query +
               "&rows=" + rows + "&fl=" + fl + "&wt=" + wt + "&sort=" + sort,
          type: "GET",
          dataType: "json",
          success: successCallback
        }

      }


			$.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));

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
          now   = new Date(),
          yearsFromToday = {
           fromBeginning: today - firstYear,
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
      var allFacetQueries = [],
          key = "";

      for(var yearsAgo = yearsFromToday.fromBeginning; yearsAgo >= yearsFromToday.fromEnd; yearsAgo -= binSize){
        // The query logic here is: If the beginnning year is anytime before or
        //  during the last year of the bin AND the ending year is anytime after
        //  or during the first year of the bin, it counts.
        if(binSize == 1){
          //Querying for just the current year needs to be treated a bit differently
          // and won't be caught in our for loop
          if((yearsAgo == 0) && (lastYear == today)){
            var oneYearFromNow = new Date();
            oneYearFromNow.setFullYear( oneYearFromNow.getFullYear() + 1 );

            var now = new Date();

            allFacetQueries.push("{!key=" + lastYear + "}(beginDate:[* TO " +
                              oneYearFromNow.toISOString() + "/YEAR] AND endDate:[" +
                              now.toISOString() + "/YEAR TO *])");
          }
          else{
            key = today - yearsAgo;

            var beginDateLimit = new Date();
            beginDateLimit.setFullYear( beginDateLimit.getFullYear() - (yearsAgo-1) );

            var endDateLimit = new Date();
            endDateLimit.setFullYear( endDateLimit.getFullYear() - yearsAgo );

            allFacetQueries.push("{!key=" + key + "}(beginDate:[* TO " +
                              beginDateLimit.toISOString() + "/YEAR] AND endDate:[" +
                              endDateLimit.toISOString() + "/YEAR TO *])");
          }
        }
        else if (yearsAgo <= binSize){
          key = (today - yearsAgo) + "-" + lastYear;

          var beginDateLimit = new Date();
          beginDateLimit.setFullYear( beginDateLimit.getFullYear() - yearsFromToday.fromEnd );

          var endDateLimit = new Date();
          endDateLimit.setFullYear( endDateLimit.getFullYear() - yearsAgo );

          allFacetQueries.push("{!key=" + key + "}(beginDate:[* TO " +
                            beginDateLimit.toISOString() +"/YEAR] AND endDate:[" +
                            endDateLimit.toISOString() + "/YEAR TO *])");
        }
        else{
          key = (today - yearsAgo) + "-" + (today - yearsAgo + binSize-1);

          var beginDateLimit = new Date();
          beginDateLimit.setFullYear( beginDateLimit.getFullYear() - (yearsAgo - binSize-1) );

          var endDateLimit = new Date();
          endDateLimit.setFullYear( endDateLimit.getFullYear() - yearsAgo );

          allFacetQueries.push("{!key=" + key + "}(beginDate:[* TO " +
                         beginDateLimit.toISOString() + "/YEAR] AND endDate:[" +
                         endDateLimit.toISOString() + "/YEAR TO *])");
        }
      }

      var now = new Date();

      //The full query
      var specialQueryParams = " AND beginDate:[" + this.firstPossibleDate + " TO " + now.toISOString() + "] AND -obsoletedBy:*",
          query = this.get('query') + specialQueryParams,
          rows = "0",
          facet = "true",
          facetLimit = "30000", //Put some reasonable limit here so we don't wait forever for this query
          facetMissing = "true", //We want to retrieve years with 0 results
          wt = "json";

      var successCallback = function(data, textStatus, xhr) {
        model.set('temporalCoverage', data.facet_counts.facet_queries);
      }

      if( this.get("usePOST") ){

        //Get the unencoded query string
        if( this.get("postQuery") ){
          query = this.get("postQuery") + specialQueryParams;
        }
        else if( this.get("searchModel") ){
          query = this.get("searchModel").getQuery(undefined, { forPOST: true }) + specialQueryParams;
        }

        var requestData = new FormData();
        requestData.append("q", query);
        requestData.append("rows", rows);
        requestData.append("wt", wt);
        requestData.append("facet", facet);
        requestData.append("facet.limit", facetLimit);
        requestData.append("facet.missing", facetMissing);

        _.each(allFacetQueries, function(facetQuery){
          requestData.append("facet.query", facetQuery);
        });

        //Request settings for POST requests
        var requestSettings = {
          url: MetacatUI.appModel.get('queryServiceUrl'),
          data: requestData,
          processData: false,
          contentType: false,
          type: "POST",
          dataType: "json",
          success: successCallback
        }
      }
      else{
        var requestSettings = {
          url: MetacatUI.appModel.get('queryServiceUrl') + "q=" + query +
               "&rows=" + rows + "&facet=" + facet + "&facet.limit=" + facetLimit +
               "&facet.missing=" + facetMissing + "&wt=" + wt +
               "&facet.query=" + allFacetQueries.join("&facet.query="),
          dataType: "json",
          success: successCallback
        }
      }

      $.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));
    },

		/*
		 * The Downloads query can be customized only by: filtering by a certain MN or filtering by a rightsHolder
		 */

		getDataDownloadDates: function(){
			if(!MetacatUI.appModel.get("d1LogServiceUrl")){
				this.set("downloads", 0);
				this.trigger("change:downloads");
				return;
			}

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
				url: MetacatUI.appModel.get("d1LogServiceUrl") + "q=" +  logSearch.getQuery() + logSearch.getFacetQuery() + "&wt=json&rows=0",
				type: "GET",
				dataType: "json",
				success: function(data, textStatus, xhr){
					var counts = data.facet_counts.facet_ranges.dateLogged.counts;
					model.set("dataDownloads", data.response.numFound);
					model.set("dataDownloadDates", counts);

					if(data.response.numFound == 0) model.trigger("change:dataDownloads");
				}
			}

			$.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));
		},

		getMetadataDownloadDates: function(){
			if(!MetacatUI.appModel.get("d1LogServiceUrl")){
				this.set("downloads", 0);
				this.trigger("change:downloads");

				return;
			}

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
				url: MetacatUI.appModel.get("d1LogServiceUrl") + "q=" +  logSearch.getQuery() + logSearch.getFacetQuery() + "&wt=json&rows=0",
				type: "GET",
				dataType: "json",
				success: function(data, textStatus, xhr){
					var counts = data.facet_counts.facet_ranges.dateLogged.counts;

					model.set("metadataDownloads", data.response.numFound);
					model.set("metadataDownloadDates", counts);

					if(data.response.numFound == 0) model.trigger("change:metadataDownloads");
				}
			}

			$.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));
		},

		getDownloadDates: function(){
			if( !this.get("supportDownloads") ){
				this.set("downloads", 0);
				this.trigger("change:downloads");
				return;
			}

			var model = this;

			var logSearch = new LogsSearch();
			logSearch.set("event", "read");
			logSearch.set("formatType", ["METADATA", "DATA"]);
			logSearch.set("facetRanges", ["dateLogged"]);
			logSearch.set("facets", ["formatType"]);

			var today = new Date();
			today.setDate(today.getUTCDay() + 1);
			today.setHours(0);
			today.setMinutes(0);
			today.setSeconds(0);
			today.setMilliseconds(0);

			logSearch.set("facetRangeStart", this.firstPossibleDataONEDownload);
			logSearch.set("facetRangeEnd", today.toISOString());

			var searchModel = this.get("searchModel");
			if(searchModel && searchModel.get("dataSource")){
				logSearch.set("nodeId", searchModel.get("dataSource"))
			}
			if(searchModel && searchModel.get("username")){
				logSearch.set("username", searchModel.get("username"));
			}

			var requestSettings = {
				url: MetacatUI.appModel.get("d1LogServiceUrl") + "q=" +  logSearch.getQuery() + logSearch.getFacetQuery() + "&wt=json&rows=0",
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

			$.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));
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
			var query = decodeURIComponent(this.get('query'));
      if( query.length ){
        query += " AND ";
      }

      query += "formatId:\"https:%2F%2Fnceas.ucsb.edu%2Fmdqe%2Fv1%23run\" AND -obsoletedBy:*";

      var rows = "0",
          stats = "true",
          statsField = ["mdq_composite_d", "mdq_discovery_d", "mdq_interpretation_d", "mdq_identification_d"],
          statsFacet = ["mdq_metadata_formatId_s", "mdq_metadata_rightsHolder_s", "mdq_metadata_datasource_s", "mdq_suiteId_s"],
          wt = "json";

      var successCallback = function(data, textStatus, xhr) {

        // Set the pertinent information in the model
        model.set('mdqStats', data.stats.stats_fields);

      }

      if( this.get("usePOST") ){

        var queryData = new FormData();
        queryData.append("q", query);
        queryData.append("rows", rows);
        queryData.append("stats", stats);
        _.each(statsField, function(statsFieldValue){
          queryData.append("stats.field", statsFieldValue);
        });
        _.each(statsFacet, function(statsFacetValue){
          queryData.append("stats.facet", statsFacetValue);
        });
        queryData.append("wt", wt);

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

        //Run the query for stats
        var requestSettings = {
          url: MetacatUI.appModel.get('queryServiceUrl') +
              "q=" + query +
              "&rows=" + rows +
              "&stats=" + stats +
              "&stats.field=" + statsField.join("&stats.field=") +
              "&stats.facet=" + statsFacet.join("&stats.facet=") +
              "&wt=" + wt,
          type: "GET",
          dataType: "json",
          success: successCallback
        }

      }

      $.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));
    },

    /**
    ** getMdqStatsTotal will query SOLR for ALL MDQ stats and will update the model accordingly
    **/
    getMdqStatsTotal: function(){
      var model = this;

      //Build the query to get ALL MDQ stats - not filtered!
      var query =  "formatId:\"https:%2F%2Fnceas.ucsb.edu%2Fmdqe%2Fv1%23run\" AND -obsoletedBy:*",
          rows  = "0",
          stats = "true",
          statsField = ["mdq_identification_d", "mdq_composite_d", "mdq_discovery_d", "mdq_interpretation_d"],
          wt = "json";

      var successCallback = function(data, textStatus, xhr) {

        var mdqStatsTotal = data.stats.stats_fields;

        // Set total in the model
        model.set('mdqStatsTotal', mdqStatsTotal);

        // get the specific stats which will trigger rendering
        model.getMdqStats();

      }

      if( this.get("usePOST") ){

        var queryData = new FormData();
        queryData.append("q", query);
        queryData.append("rows", rows);
        queryData.append("stats", stats);
        _.each(statsField, function(statsFieldValue){
          queryData.append("stats.field", statsFieldValue);
        });
        queryData.append("wt", wt);

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

        //Run the query for stats
        var requestSettings = {
          url: MetacatUI.appModel.get('queryServiceUrl') +
               "q=" + query +
               "&rows=" + rows +
               "&stats=" + stats +
               "&stats.field=" + statsField.join("&stats.field=") +
               "&wt=" + wt,
          type: "GET",
          dataType: "json",
          success: successCallback
        }
      }


      $.ajax(_.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()));
    },
    
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

    getMdqScores: function(){
        var myImage = new Image();
        var model = this;
        myImage.crossOrigin = ""; // or "anonymous"
        if(MetacatUI.appView.currentView === null) return;
        // Call the function with the URL we want to load, but then chain the
        // promise then() method on to the end of it. This contains two callbacks
        var serviceUrl = MetacatUI.appModel.get('mdqScoresServiceUrl');
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
            console.log(Error);
        });
    },

    setRequestType: function(){
      if( MetacatUI.appModel.get("disableQueryPOSTs") ){
        this.set("usePOST", false);
      }
      else{
        if( this.get("query") && this.get("query").length > this.get("maxQueryLength") ){
          this.set("usePOST", true);
        }
      }
    }

  });
  return Stats;
});
