/*global define */
define(['jquery', 'underscore', 'backbone', 'MetricsChart', 'text!templates/metricModalTemplate.html', 'collections/Citations', 'views/CitationListView'],
    function($, _, Backbone, MetricsChart, MetricModalTemplate, Citations, CitationList) {
    'use strict';

    var MetricModalView = Backbone.View.extend({

        id: 'metric-modal',
        className: 'modal fade hide',
        template: _.template(MetricModalTemplate),
        metricName: null,
        metricsModel: null,
        metrics: ['Citations', 'Downloads', 'Views'],
        metricIndex: null,
        prevMetricName: null,
        nextMetricName: null,

        events: {
          'hidden': 'teardown',
          'click .left-modal-footer' : 'showPreviousMetricModal',
          'click .right-modal-footer' : 'showNextMetricModal'
        },

        initialize: function(options) {
          _.bindAll(this, 'show', 'teardown', 'render', 'renderView');
          if((typeof options == "undefined")){
              var options = {};
          }

          this.metricName = options.metricName;
          this.metricsModel = options.metricsModel;

        },
        
        getPreviousMetric : function(currentMetricName) {
            if(currentMetricName != 'undefined') {
                    this.metricIndex = this.metrics.indexOf(currentMetricName);
            }
            
            // Implementing a circular queue to get the previous metric
            return(this.metrics[((this.metricIndex + this.metrics.length - 1) % this.metrics.length)]);
        },
        
        getNextMetric : function(currentMetricName) {
            if(currentMetricName != 'undefined') {
                    this.metricIndex = this.metrics.indexOf(currentMetricName);
            }
            
            // Implementing a circular queue to get the next metric
            return(this.metrics[((this.metricIndex + this.metrics.length + 1) % this.metrics.length)]);
        },

        show: function() {
          this.$el.modal('show');
        },

        teardown: function() {
          this.$el.data('modal', null);
          this.remove();
        },

        render: function() {
          this.renderView();
          this.drawMetricsChart();
          return this;
        },

        renderView: function() {
            this.metricNameLemma = this.metricName.toLowerCase().substring(0, this.metricName.length - 1);

            if ( this.metricName === "Citations") {
                var resultDetails = this.metricsModel.get("resultDetails");
                var citationCollection = new Citations(resultDetails["citations"], {parse:true});

                this.citationCollection = citationCollection;


                // Checking if there are any citations available for the List display.
                if(this.metricsModel.get("totalCitations") == 0) {
                    var citationList = new CitationList({citationsForDataCatalogView: true});
                }
                else {
                    var citationList = new CitationList({citations: this.citationCollection, citationsForDataCatalogView: true});
                }

                this.citationList = citationList;

                this.$el.html(this.template({metricName:this.metricName, metricNameLemma:this.metricNameLemma, metricValue: this.metricsModel.get("totalCitations"), metricBody:this.citationList.render().$el.html()}));
            }
            else {
                if (this.metricName === "Views") {
                    this.$el.html(this.template({metricName:this.metricName, metricNameLemma:this.metricNameLemma, metricValue: this.metricsModel.get("totalViews"), metricBody:"<div class='metric-chart'></div>"}));
                }
                if (this.metricName === "Downloads") {
                    this.$el.html(this.template({metricName:this.metricName, metricNameLemma:this.metricNameLemma, metricValue: this.metricsModel.get("totalDownloads"), metricBody:"<div class='metric-chart'></div>"}));
                }

            }

            this.$el.modal({show:false}); // dont show modal on instantiation

        },

        showPreviousMetricModal: function() {
            
            this.nextMetricName = this.metricName;
            this.metricName = this.getPreviousMetric(this.metricName);
            this.nextMetricName = this.getPreviousMetric(this.metricName);
            

            this.metricNameLemma = this.metricName.toLowerCase().substring(0, this.metricName.length - 1);
            if ( this.metricName === "Citations") {
                var resultDetails = this.metricsModel.get("resultDetails")
                var citationCollection = new Citations(resultDetails["citations"], {parse:true});

                this.citationCollection = citationCollection;

                // Checking if there are any citations available for the List display.
                if(this.metricsModel.get("totalCitations") == 0) {
                    var citationList = new CitationList({citationsForDataCatalogView: true});
                }
                else {
                    var citationList = new CitationList({citations: this.citationCollection, citationsForDataCatalogView: true});
                }
                
                this.citationList = citationList;

                this.$el.html(this.template({metricName:this.metricName, metricNameLemma:this.metricNameLemma, metricValue: this.metricsModel.get("totalCitations"), metricBody:this.citationList.render().$el.html()}));
            }
            if (this.metricName === "Views") {
                this.$el.html(this.template({metricName:this.metricName, metricNameLemma:this.metricNameLemma, metricValue: this.metricsModel.get("totalViews"), metricBody:"<div class='metric-chart'></div>"}));
                this.drawMetricsChart();
            }
            if (this.metricName === "Downloads") {
                this.$el.html(this.template({metricName:this.metricName, metricNameLemma:this.metricNameLemma, metricValue: this.metricsModel.get("totalDownloads"), metricBody:"<div class='metric-chart'></div>"}));
                this.drawMetricsChart();
            }
        },


        showNextMetricModal: function() {
            this.prevMetricName = this.metricName;
            this.metricName = this.getNextMetric(this.metricName);
            this.nextMetricName = this.getNextMetric(this.metricName);
            

            this.metricNameLemma = this.metricName.toLowerCase().substring(0, this.metricName.length - 1);
            if ( this.metricName === "Citations") {
                var resultDetails = this.metricsModel.get("resultDetails")
                var citationCollection = new Citations(resultDetails["citations"], {parse:true});

                this.citationCollection = citationCollection;

                // Checking if there are any citations available for the List display.
                if(this.metricsModel.get("totalCitations") == 0) {
                    var citationList = new CitationList({citationsForDataCatalogView: true});
                }
                else {
                    var citationList = new CitationList({citations: this.citationCollection, citationsForDataCatalogView: true});
                }
                
                this.citationList = citationList;

                this.$el.html(this.template({metricName:this.metricName, metricNameLemma:this.metricNameLemma, metricValue: this.metricsModel.get("totalCitations"), metricBody:this.citationList.render().$el.html()}));
            }
            if (this.metricName === "Views") {
                this.$el.html(this.template({metricName:this.metricName, metricNameLemma:this.metricNameLemma, metricValue: this.metricsModel.get("totalViews"), metricBody:"<div class='metric-chart'></div>"}));
                this.drawMetricsChart();
            }
            if (this.metricName === "Downloads") {
                this.$el.html(this.template({metricName:this.metricName, metricNameLemma:this.metricNameLemma, metricValue: this.metricsModel.get("totalDownloads"), metricBody:"<div class='metric-chart'></div>"}));
                this.drawMetricsChart();
            }
        },

        drawMetricsChart: function(){

            var metricCount         = MetacatUI.appView.currentView.metricsModel.get(this.metricName.toLowerCase());
            var metricMonths        = MetacatUI.appView.currentView.metricsModel.get("months");
            var metricName          = this.metricName;

            //Draw a metric chart
            var modalMetricChart = new MetricsChart({
                            id: "metrics-chart",
                            metricCount: metricCount,
                            metricMonths: metricMonths,
                            metricName: metricName,
                            width: 600,
                            height: 370
                        });

            this.$('.metric-chart').html(modalMetricChart.render().el);
        }

    });

     return MetricModalView;
  });
