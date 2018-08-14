/*global define */
define(['jquery', 'underscore', 'backbone', 'd3'],
    function($, _, Backbone, d3) {
    'use strict';

    /*
    * The MetricsChartView will render an SVG times-series chart using D3 that shows the number of metrics over time.
    */
    var MetricsChartView = Backbone.View.extend({

      // http://stackoverflow.com/questions/9651167/svg-not-rendering-properly-as-a-backbone-view
      // Give our el a svg namespace because Backbone gives a different one automatically
      nameSpace: "http://www.w3.org/2000/svg",
        _ensureElement: function() {
           if (!this.el) {
              var attrs = _.extend({}, _.result(this, 'attributes'));
              if (this.id) attrs.id = _.result(this, 'id');
              if (this.className) attrs['class'] = _.result(this, 'className');
              var $el = $(window.document.createElementNS(_.result(this, 'nameSpace'), _.result(this, 'tagName'))).attr(attrs);
              this.setElement($el, false);
           } else {
              this.setElement(_.result(this, 'el'), false);
           }
       },

      tagName: "svg",

      initialize: function(options){
        if(typeof options !== "undefined"){

          //Set the model on this view when it is passed as an option
          this.model = options.model || null;

        }
      },

      render: function(){

        //Start rendering the D3 chart

      }

    });

    return MetricsChartView;

});
