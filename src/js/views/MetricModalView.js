/*global define */
define(['jquery', 'underscore', 'backbone', 'text!templates/metricModalTemplate.html'],
    function($, _, Backbone, MetricModalTemplate) {
    'use strict';

    var MetricModalView = Backbone.View.extend({

        id: 'base-modal',
        className: 'modal fade hide',
        template: _.template(MetricModalTemplate),

        events: {
          'hidden': 'teardown'
        },

        initialize: function() {
          _.bindAll(this, 'show', 'teardown', 'render', 'renderView');
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
          this.$el.html(this.template({metricValue:2, metricIcon:'icon-quote-right', metricName:'Citation', prevMetricName:'View', nextMetricName:'Download'}));
          this.$el.modal({show:false}); // dont show modal on instantiation
        }
     });
     
     return MetricModalView;
  });