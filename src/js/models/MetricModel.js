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
            records: [],
            pid: '',
            metricsRequiredFields: {
                metricName: true,
                metricValue: true,
                pid: true
            }
        },

        initialize: function() {
            if(pid) {
                this.getMetricData(pid);
            }
        },

        getMetricData: function() {
            
        }
        
    });
    return Metric;
});