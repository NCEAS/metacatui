/*global define */
define(['jquery', 'underscore', 'backbone', 'text!templates/reportCitation.html'],
    function($, _, Backbone, ReportCitationTemplate) {
    'use strict';

    var ReportCitationView = Backbone.View.extend({

        id: 'citation-modal',
        className: 'modal fade hide',
        template: _.template(ReportCitationTemplate),

        events: {
          'hidden': 'teardown',
        },

        initialize: function(options) {
          _.bindAll(this, 'show', 'teardown', 'render', 'renderView');
          if((typeof options == "undefined")){
              var options = {};
          }

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

        renderView: function(){

            this.$el.html(this.template());
            this.$el.modal({show:false}); // dont show modal on instantiation
        }


    });

     return ReportCitationView;
  });
