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
            pid: '',
            url: null,

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


            // Total counts for metrics
            totalCitations: null,
            totalViews: null,
            totalDownloads: null,


            metricsRequiredFields: {
                metricName: true,
                pid: true
            }
        },
        

        metricRequest: {
            "metricsPage": {
                "total": 0,
                "start": 0,
                "count": 0
            },
            "metrics": [
                "Citations",
                "Unique_Dataset_Requests",
                "Total_Dataset_Requests",
                "Total_Dataset_Investigations",
                "Unique_Dataset_Investigations"
            ],
            "filterBy": [
                {
                    "filterType": "dataset",
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
                "month", "country"
            ]
        },

        // Initializing the Model objects pid and gthe metricName variables.
        initialize: function(options) {
            if(!(options.pid == 'undefined')) {
                this.pid = options.pid;
            }
            // url for the model that is used to for the fetch() call
            this.url = MetacatUI.appModel.get("metricsUrl")
        },

        // Overriding the Model's fetch function.
        fetch: function(){
          var fetchOptions = {};

          this.metricRequest.filterBy[0].values = [];
          this.metricRequest.filterBy[0].values.push(this.pid);
          
          // TODO: Set the startDate and endDate based on the datePublished and current date
          // respctively.
          this.metricRequest.filterBy[1].values = [];
          this.metricRequest.filterBy[1].values.push("01/01/2000");
          this.metricRequest.filterBy[1].values.push("06/10/2018");

          // HTTP GET
          fetchOptions = _.extend({data:"metricsRequest="+JSON.stringify(this.metricRequest)});
          
          // Uncomment to set it as a HTTP POST
          // fetchOptions = _.extend({data:JSON.stringify(this.metricRequest), type="POST"});

          //This calls the Backbone fetch() function but with our custom fetch options.
          return Backbone.Model.prototype.fetch.call(this, fetchOptions);
        },

        // Parsing the response for setting the Model's member variables.
        parse: function(response){
            return {
                "metricRequest": response.metricsRequest,
                "citations": response.results.citations,
                "views": response.results.views,
                "downloads": response.results.downloads,
                "months": response.results.month,
                "country": response.results.country
            }
        }

    });
    return Metrics;
});
