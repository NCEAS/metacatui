/*global define */
define(['jquery', 'underscore', 'backbone',  'views/MetricModalView'],
    function($, _, Backbone, MetricModalTemplate) {
    'use strict';

    var MetricView = Backbone.View.extend({

        tagName: 'a',
        className: 'btn metrics ',
        metricName: null,
        model: null,

        //Templates
        metricButtonTemplate:  _.template( "<span class='metric-icon'> <i class='icon" + 
                            " <%=metricIcon%>'></i> </span>" +
                            "<span class='metric-name'> <%=metricName%> </span>" +
                            "<span class='metric-value'> <i class='icon metric-icon icon-spinner icon-spin'>" +
                            "</i> </span>"),

        events: {

        },

        initialize: function(options){
            if((typeof options == "undefined")){
                var options = {};
            }

            this.metricName = options.metricName;
            this.model = options.model;
        },

        render: function () {
            // Generating the Button view for the given metric
            if  (this.metricName == 'Citations') {
                this.$el.html(this.metricButtonTemplate({metricValue:'', metricIcon:'icon-quote-right', metricName:this.metricName}));
            } else if (this.metricName == 'Downloads') {
                this.$el.html(this.metricButtonTemplate({metricValue:'', metricIcon:'icon-cloud-download', metricName:this.metricName}));
            } else if (this.metricName == 'Views') {
                this.$el.html(this.metricButtonTemplate({metricValue:'', metricIcon:'icon-eye-open', metricName:this.metricName}));
            } else {
                this.$el.html('');
            };

            // Adding tool-tip for the buttons
            // TODO: Change to 'Show metricName', once you've the modals working.
            if (MetacatUI.appModel.get("displayDatasetMetricsTooltip")) {
                this.$el.addClass("tooltip-this")
                        .attr("data-title", "Dataset " + this.metricName)
                        .attr("data-placement", "top")
                        .attr("data-trigger", "hover")
                        .attr("data-container", "body");
            };

            // waiting for the fetch() call to succeed.
            this.listenTo(this.model, "sync", this.renderResults);

            return this;
        },


        renderResults: function() {
            var metric = this.metricName
            var results = this.model.get(metric.toLowerCase());

            // Check if the metric object exists in results obtained from the service 
            // If it does, get its total value else set the total count to 0
            if (typeof results !== 'undefined') {
                var total = 0
                if (results.length > 0) {
                    var total = results.reduce(function(acc, val) { return acc + val; });
                }
                if(metric == 'Citations') {
                    this.model.set('totalCitations', total);
                }
                if(metric == 'Views') {
                    this.model.set('totalViews', total);
                }
                if(metric == 'Downloads') {
                    this.model.set('totalDownloads', total);
                }
            } else {
                if(metric == 'Citations') {
                    this.model.set('totalCitations', 0);
                }
                if(metric == 'Views') {
                    this.model.set('totalViews', 0);
                }
                if(metric == 'Downloads') {
                    this.model.set('totalDownloads', 0);
                }
            };

            // Replacing the metric total count with the spinning icon.
            this.$('.metric-value').addClass("badge")
            this.$('.metric-value').text(total);
        }

    });

    return MetricView;
});
