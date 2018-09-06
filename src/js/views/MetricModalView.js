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

        events: {
          'hidden': 'teardown'
        },

        initialize: function(options) {
          _.bindAll(this, 'show', 'teardown', 'render', 'renderView');
          if((typeof options == "undefined")){
              var options = {};
          }

          this.metricName = options.metricName;
          this.metricsModel = options.metricsModel;
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
            var self = this;
          
            this.metricNameLemma = this.metricName.toLowerCase().substring(0, this.metricName.length - 1);
            
            if ( this.metricName === "Citations") {
                var resultDetails = this.metricsModel.get("resultDetails")
                var citationCollection = new Citations(resultDetails["citations"], {parse:true});

                this.citationCollection = citationCollection;

                var citationList = new CitationList({citations: this.citationCollection});
                this.citationList = citationList;

                this.$el.html(this.template({metricName:this.metricName, metricNameLemma:this.metricNameLemma, metricValue: self.metricsModel.get("totalCitations") ,metricBody:this.citationList.render().$el.html()}));
            }
            else {
                
                this.$el.html(this.template({metricName:this.metricName, metricNameLemma:this.metricNameLemma, metricBody:"<div class='metric-chart'></div>"}));
            }

            this.$el.modal({show:false}); // dont show modal on instantiation

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
                            height: 380
                        });

            this.$('.metric-chart').html(modalMetricChart.render().el);
        }

    });

     return MetricModalView;
  });
