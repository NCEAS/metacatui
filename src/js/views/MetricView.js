/*global define */
define(['jquery', 'underscore', 'backbone', 'models/MetricModel', 'views/MetricModalView'],
    function($, _, Backbone, MetricModel, MetricModalTemplate) {
    'use strict';

    var MetricView = Backbone.View.extend({

        tagName: 'a',
        className: 'btn metrics',

        //Templates
        metricButtonTemplate:  _.template("<span class='value'> <i class='icon icon-spinner icon-spin'></i> </span>" + 
                            " <i class='icon <%=metricIcon%>'></i> <%=metricName%>" ),

        events: {

        },

        initialize: function(options){
            if((typeof options == "undefined")){
                var options = {};
            }

            this.model = new MetricModel({pid: options.pid, metricName: options.metricName});
        },

        render: function () {
            var metric = this.model.get('metricName');
            // Generating the Button view for the given metric
            if  (metric == 'Citations') {
                this.$el.html(this.metricButtonTemplate({metricValue:'', metricIcon:'icon-quote-right', metricName:metric}));
            } else if (metric == 'Downloads') {
                this.$el.html(this.metricButtonTemplate({metricValue:'', metricIcon:'icon-cloud-download', metricName:metric}));
            } else if (metric == 'Views') {
                this.$el.html(this.metricButtonTemplate({metricValue:'', metricIcon:'icon-eye-open', metricName:metric}));
            } else {
                this.$el.html('');
            };

            // Adding tool-tip for the buttons
            // TODO: Change to 'Show metricName', once you've the modals working.
            this.$el.addClass("tooltip-this")
                    .attr("data-title", "Dataset " + this.model.get("metricName"))
                    .attr("data-placement", "top")
                    .attr("data-trigger", "hover")
                    .attr("data-container", "body");

            // waiting for the fetch() call to succeed.
            this.listenTo(this.model, "change:results", this.renderResults);
            
            this.getMetrics();
            
            return this;
        },


        getMetrics: function() {
            this.model.fetch();
        },


        renderResults: function() {
            var metric = this.model.get('metricName');
            var results = this.model.get('results');

            // Check if the metric object exists in results obtained from the service 
            // If it does, get its total value else set the total count to 0
            if(metric.toLowerCase() in results) {
                var total = results[metric.toLowerCase()].reduce(function(acc, val) { return acc + val; });
                this.model.set('metricValue', total);
            } else {
                this.model.set('metricValue', 0);
            };

            // Replacing the metric total count with the spinning icon.
            this.$('.value').text(total);
        }

    });

    return MetricView;
});
