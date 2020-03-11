/*global define */
define(['jquery', 'underscore', 'backbone'],
    function($, _, Backbone) {
    'use strict';

    // Metric Model
    // -------------
    var Metrics = Backbone.Model.extend({
        defaults: {
            metricRequest: null,
            startDate: null,
            endDate: null,
            results: null,
            resultDetails: null,
            pid_list: null,
            url: null,
            filterType: null,

            // metrics and metric Facets returned as response from the user
            // datatype: array
            citations: null,
            views: null,
            downloads: null,
            months: null,
            country: null,
            years: null,
            repository: null,
            award: null,
            datasets: null,


            // Total counts for metrics
            totalCitations: null,
            totalViews: null,
            totalDownloads: null,


            metricsRequiredFields: {
                metricName: true,
                pid_list: true
            }
        },


        metricRequest: {
            "metricsPage": {
                "total": 0,
                "start": 0,
                "count": 0
            },
            "metrics": [
                "citations",
                "downloads",
                "views"
            ],
            "filterBy": [
                {
                    "filterType": "",
                    "values": [],
                    "interpretAs": "list"
                },
                {
                    "filterType": "month",
                    "values": [],
                    "interpretAs": "range"
                }
            ],
            "groupBy": [
                "month"
            ]
        },

        // Initializing the Model objects pid and the metricName variables.
        initialize: function(options) {
            if((options) && options.pid_list !== 'undefined') {
                this.set("pid_list", options.pid_list);
                this.set("filterType", options.type);
            }
            this.set("startDate", "01/01/2012");
            // url for the model that is used to for the fetch() call
            this.url = MetacatUI.appModel.get("metricsUrl");
        },

        // Overriding the Model's fetch function.
        fetch: function(){
          var fetchOptions = {};
          this.metricRequest.filterBy[0].filterType = this.get("filterType");
          this.metricRequest.filterBy[0].values = this.get("pid_list");

          // TODO: Set the startDate and endDate based on the datePublished and current date
          // respctively.
          this.metricRequest.filterBy[1].values = [];
          this.metricRequest.filterBy[1].values.push(this.get("startDate"));
          this.metricRequest.filterBy[1].values.push(this.getCurrentDate());

          // HTTP GET
          fetchOptions = _.extend({data:"metricsRequest="+JSON.stringify(this.metricRequest), timeout:50000});
          // Uncomment to set it as a HTTP POST
          // fetchOptions = _.extend({data:JSON.stringify(this.metricRequest), type="POST"});

          //This calls the Backbone fetch() function but with our custom fetch options.
          return Backbone.Model.prototype.fetch.call(this, fetchOptions);
        },

        getCurrentDate: function() {
            var today = new Date();
            var dd = today.getDate();
            var mm = today.getMonth()+1; //January is 0!

            var yyyy = today.getFullYear();
            if(dd<10){
                dd='0'+dd;
            }
            if(mm<10){
                mm='0'+mm;
            }
            var today = mm+'/'+dd+'/'+yyyy;
            return today;
        },

        // Parsing the response for setting the Model's member variables.
        parse: function(response){
            var metricsObject = {
                "metricRequest": response.metricsRequest,
                "citations": response.results.citations,
                "views": response.results.views,
                "downloads": response.results.downloads,
                "months": response.results.months,
                "country": response.results.country,
                "resultDetails": response.resultDetails,
                "datasets": response.results.datasets
            }
            
            if (response.results.citations != null) {
                metricsObject["totalCitations"] =  response.results.citations.reduce(function(acc, val) { return acc + val; }, 0)
            }
            else {
                metricsObject["totalCitations"] =  0
            }
            
            if (response.results.downloads != null) {
                metricsObject["totalDownloads"] =  response.results.downloads.reduce(function(acc, val) { return acc + val; }, 0)
            }
            else {
                metricsObject["totalDownloads"] =  0
            }
            
            if (response.results.views != null) {
                metricsObject["totalViews"] =  response.results.views.reduce(function(acc, val) { return acc + val; }, 0)
            }
            else {
                metricsObject["totalViews"] =  0
            }

            //trim off the leading zeros and their corresponding months
            if (response.results.months != null) {
                
                // iterate all the metrics objects and remove the entry if the counts are 0
                for (var i = 0 ; i < metricsObject["months"].length; i++) {

                    if ( metricsObject["citations"] != null &&
                        metricsObject["views"]     != null &&
                        metricsObject["downloads"] != null ) {
                            
                        if (( metricsObject["citations"][i] == 0 ) &&
                            ( metricsObject["views"][i]     == 0 ) &&
                            ( metricsObject["downloads"][i] == 0 )) {
                        
                            metricsObject["months"].splice(i,1);
                            metricsObject["citations"].splice(i,1);
                            metricsObject["views"].splice(i,1);
                            metricsObject["downloads"].splice(i,1);
                            
                            // if country facet was part of the request; update object;
                            if ( metricsObject["country"] != null) {
                                metricsObject["country"].splice(i,1)
                            }
                            
                            // modified array size; decrement the counter;
                            i--;
                        }
                        else {
                            break;
                        }	
                    }
                }
            }
            
            return metricsObject;
        },

    });
    return Metrics;
});
