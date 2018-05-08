/*global define */
define(['jquery', 'underscore', 'backbone', 'views/MetricModalView'],
    function($, _, Backbone, MetricModalTemplate) {
    'use strict';

    var MetricView = Backbone.View.extend({

        el: '#metricButton',

        //Templates
        metricButtonTemplate:  _.template("<a class='btn metrics'> <%=metricValue%> <i class='icon" +
                                            " <%=metricIcon%>'></i> <%=metricName%> </a>"),

        events: {

        },

        initialize: function(options){
            if((typeof options == "undefined")){
                var options = {};
            }
            else {
                this.render(options.metric, options.results);
            }
        },

        render: function (metric, results) {
            var metricTotal;

            // Check if the metric object exists in results obtained from the service 
            // If it does, get its total value else set the total count to 0
            if(metric.toLowerCase() in results) {
                var metricTotal = results[metric.toLowerCase()].reduce(function(acc, val) { return acc + val; });
                console.log(metricTotal);
            } else {
                metricTotal = 0;
            };

            // Generating the Button view for the given metric
            if  (metric == 'Citations') {
                var buttonContent = this.metricButtonTemplate({metricValue:metricTotal, metricIcon:'icon-quote-right', metricName:'Citations'});
            } else if (metric == 'Requests') {
                var buttonContent = this.metricButtonTemplate({metricValue:metricTotal, metricIcon:'icon-cloud-download', metricName:'Downloads'});
            } else if (metric == 'Investigation') {
                var buttonContent = this.metricButtonTemplate({metricValue:metricTotal, metricIcon:'icon-eye-open', metricName:'Views'});
            } else {
                var buttonContent = '';
            };

            this.$el = buttonContent;
            return this;
        }
    });

    return MetricView;
});
