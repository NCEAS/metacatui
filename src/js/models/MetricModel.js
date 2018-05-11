/*global define */
define(['jquery', 'underscore', 'backbone'],
    function($, _, Backbone) {
    'use strict';

    // Metric Model 
    // -------------
    var Metric = Backbone.Model.extend({
        defaults: {
            metricName: null,
            metricValue: null,
            metricRequest: null,
            results: null,
            url: null,
            pid: '',

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

            metricsRequiredFields: {
                metricName: true,
                pid: true
            }
        },

        // url for the model that is used to for the fetch() call
        url: 'https://virtserver.swaggerhub.com/nenuji/data-metrics/1.0.0.3/getmetrics',

        // Initializing the Model objects pid and gthe metricName variables.
        initialize: function(options) {
            if(!(options.pid == 'undefined')) {
                this.set('pid', options.pid);
                this.set('metricName', options.metricName);
            }
        },

        // Overriding the Model's fetch function.
        fetch: function(){
          var fetchOptions = {};

          fetchOptions = _.extend({headers: {'Accept': 'application/json'}});

          //This calls the Backbone fetch() function but with our custom fetch options.
          return Backbone.Model.prototype.fetch.call(this, fetchOptions);
        },

        // Parsing the response for setting the Model's member variables.
        parse: function(response){
            return {
                "metricRequest": response.metricsRequest,
                "citations": response.results.citations,
                "views": response.results.investigations,
                "downloads": response.results.requests,
                "months": response.results.month,
                "country": response.results.country
            }
        }

    });
    return Metric;
});
