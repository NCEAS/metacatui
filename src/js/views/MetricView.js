/*global define */
define(['jquery', 'underscore', 'backbone'],
    function($, _, Backbone) {
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
                console.console.log('Undefined options');
            }
            else {
                this.render(options.metric);
                console.log(options.metric);
            }
        },

        render: function (metric) {
            if  (metric == 'Citation') {
                var buttonContent = this.metricButtonTemplate({metricValue:2, metricIcon:'icon-quote-right', metricName:'Citation'});
            } else if (metric == 'Download') {
                var buttonContent = this.metricButtonTemplate({metricValue:3, metricIcon:'icon-cloud-download', metricName:'Download'});
            } else if (metric == 'View') {
                var buttonContent = this.metricButtonTemplate({metricValue:4, metricIcon:'icon-eye-open', metricName:'View'});
            } else if (metric == 'Quality') {
                var buttonContent = this.metricButtonTemplate({metricValue:95, metricIcon:'icon-dashboard', metricName:'Quality'});
            } else {
                var buttonContent = '';
            };
            this.$el = buttonContent;
            return this;
		}
	});
	
	return MetricView;
});