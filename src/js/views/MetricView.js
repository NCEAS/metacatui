/*global define */
define(['jquery', 'underscore', 'backbone'],
    function($, _, Backbone) {
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
                        .attr("data-placement", "top")
                        .attr("data-trigger", "hover")
                        .attr("data-container", "body");
                if  (this.metricName == 'Citations') {
                    this.$el.attr("data-title", "For all the versions of this dataset, the number of times that all or part of this dataset was cited.");
                } else if (this.metricName == 'Downloads') {
                    this.$el.attr("data-title", "For all the versions of this dataset, the number of times that all or part of this dataset was downloaded.");
                } else if (this.metricName == 'Views') {
                    this.$el.attr("data-title", "For all the versions of this dataset, the number of times that all or part of this dataset was viewed.");
                } else {
                    this.$el.attr("data-title", "");
                }
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
                    
                    if(metric == 'Citations') {
                        total = results.reduce(function(acc, val) { return acc + val; });
                        this.model.set('totalCitations', total);
                    }
                    if(metric == 'Views') {
                        total = results.reduce(function(acc, val) { return acc + val; });
                        this.model.set('totalViews', total);
                    }
                    if(metric == 'Downloads') {
                        total = results.reduce(function(acc, val) { return acc + val; });
                        this.model.set('totalDownloads', total);
                    }
                }
                
            } else {
                if(metric == 'Citations') {
                    total = 0;
                    this.model.set('totalCitations', total);
                }
                if(metric == 'Views') {
                    total = 0;
                    this.model.set('totalViews', total);
                }
                if(metric == 'Downloads') {
                    total = 0;
                    this.model.set('totalDownloads', total);
                }
            };

            // Replacing the metric total count with the spinning icon.
            this.$('.metric-value').addClass("badge");
            this.$('.metric-value').text(this.numberAbbreviator(total, 1));
        },
        
        numberAbbreviator: function(number, decimalPlaces) {
            decimalPlaces = Math.pow(10,decimalPlaces);
            var abbreviations = [ "K", "M", "B", "T" ];

            // Go through the array backwards, so we do the largest first
            for (var i=abbreviations.length-1; i>=0; i--) {

                // Convert array index to "1000", "1000000", etc
                var size = Math.pow(10,(i+1)*3);

                // If the number is bigger or equal do the abbreviation
                if(size <= number) {

                    // Here, we multiply by decimalPlaces, round, and then divide by decimalPlaces.
                    // This gives us nice rounding to a particular decimal place.
                    number = Math.round(number*decimalPlaces/size)/decimalPlaces;

                    // Handle special case where we round up to the next abbreviation
                    if((number == 1000) && (i < abbreviations.length - 1)) {
                        number = 1;
                        i++;
                    }

                    // Add the letter for the abbreviation
                    number += abbreviations[i];
                    break;
                }
            }
            return number;
        }

    });

    return MetricView;
});
