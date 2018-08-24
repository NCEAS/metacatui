/*global define */
define(['jquery', 'underscore', 'backbone', 'text!templates/metricModalTemplate.html', 'collections/Citations', 'views/CitationListView'],
    function($, _, Backbone, MetricModalTemplate, Citations, CitationList) {
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
          return this;
        },

        renderView: function() {
            var self = this;
            
            if ( this.metricName === "Citations") { 
                var resultDetails = this.metricsModel.get("resultDetails")
                var citationCollection = new Citations(resultDetails["citations"], {parse:true});
                
                this.citationCollection = citationCollection;
                
                var citationList = new CitationList({citations: this.citationCollection});
                this.citationList = citationList;
                
                this.$el.html(this.template({metricName:this.metricName, metricBody:this.citationList.render().$el.html()}));
            }
            else {
                this.$el.html(this.template({metricName:this.metricName, metricBody:""}));
            }

            
            this.$el.modal({show:false}); // dont show modal on instantiation

        }
    });
     
     return MetricModalView;
  });