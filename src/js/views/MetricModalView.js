/*global define */
define(['jquery', 'underscore', 'backbone', 'text!templates/metricModalTemplate.html'],
    function($, _, Backbone, MetricModalTemplate) {
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
          this.render();
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
        }
     });
     
     return MetricModalView;
  });