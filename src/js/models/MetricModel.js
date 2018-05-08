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
            response: null,
            pid: '',
            metricsRequiredFields: {
                metricName: true,
                metricValue: true,
                pid: true
            }
        },
        
        // url for the model that is used to for the fetch() call
        url: 'https://virtserver.swaggerhub.com/nenuji/data-metrics/1.0.0.3/getmetrics',

        initialize: function(options) {
            if(!(options.pid == 'undefined')) {
                pid: options.pid;
            }
        },

        // Setting the results object from the fetch() response
        setResults: function(resultsObject) {
            this.results = resultsObject;
        },

        // Setting the MetricsRequest object from the fetch() response
        setMetricsRequest: function(metricRequestObject) {
            this.metricRequest = metricRequestObject;
        },

        // Setting a custom url for the given model
        setUrl: function(newUrl) {
            this.url = newUrl;
        },

        getResults: function() {
            return this.results;
        }
    });
    return Metric;
});
