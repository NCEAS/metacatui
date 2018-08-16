/*global define */
define(['jquery', 'underscore', 'backbone', 'MetricsChart', 'text!templates/metricModalTemplate.html'],
    function($, _, Backbone, MetricsChart, MetricModalTemplate) {
    'use strict';

    var MetricModalView = Backbone.View.extend({

        id: 'metric-modal',
        className: 'modal fade hide',
        template: _.template(MetricModalTemplate),
        metricName: null,
        metricCount: null,

        events: {
          'hidden': 'teardown'
        },

        initialize: function(options) {
          _.bindAll(this, 'show', 'teardown', 'render', 'renderView');
          if((typeof options == "undefined")){
              var options = {};
          }

          this.metricName = options.metricName;
          this.metricCount = options.metricCount;

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
          return this;
        },

        renderView: function() {
          this.$el.html(this.template({metricValue:this.metricCount, metricIcon:'icon-quote-right', metricName:this.metricName}));
          this.$el.modal({show:false}); // dont show modal on instantiation
          this.drawMetricsChart();
        },

        drawMetricsChart: function(){

            var metricCount = this.metricCount;

			//Draw a metric chart
			var mychart = new MetricsChart({
							id: "metadata-chart",
						});

			this.$('.metric-chart').html(mychart.render().el);
		},

    });
    return MetricModalView;
  });
