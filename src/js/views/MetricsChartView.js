/*global define */
define(['jquery', 'underscore', 'backbone', 'd3'],
    function($, _, Backbone, d3) {
    'use strict';

    /*
    * The MetricsChartView will render an SVG times-series chart using D3 that shows the number of metrics over time.
    */
    var MetricsChartView = Backbone.View.extend({

      initialize: function (options) {

          if(!d3){ console.log('SVG is not supported'); return null; }

          if(typeof options !== "undefined"){

          //Set the model on this view when it is passed as an option
          this.model        = options.model         || null;
          this.id           = options.id            || "metrics-chart";
          this.metricY      = options.metricY       || "0";
          this.metricMonths = options.metricMonths;
          this.width        = options.width         || 900;
          this.height       = options.height        || 360;

        }
      },

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

      render: function(){
        // test pid: doi:10.18739/A2HT2GB23

        /*
        * ========================================================================
        *  Prepare Data
        * ========================================================================
        */

        // Better to have the model passed into the chart as data.
        // For now, combine the months and count array .
        var dataset = [];
        for(var i=0; i<this.metricY.length; i++){
            var obj = {count: this.metricY[i], month: this.metricMonths[i]};
            dataset.push(obj);
        }

        // format month as a date
        dataset.forEach(function(d) {
            d.month = d3.time.format("%Y-%m").parse(d.month);
        });

        // sort dataset by month
        dataset.sort(function(x, y){
           return d3.ascending(x.month, y.month);
        });

        var margin	= {top: 20, right: 20, bottom: 20, left: 20},
            width	= 900 - margin.left - margin.right,
            height	= 360 - margin.top - margin.bottom;

        /*
        * ========================================================================
        *  X & Y vars
        * ========================================================================
        */

        function getTickFormat(){
            //var timeSpan = (dataset[dataset.length-1].month) - (dataset[0].month);
            //var oneMonthMs = 2628000000*13;
            //if(timeSpan <= oneMonthMs) return d3.time.format("%b");
            //else return d3.time.format("%b %Y");
            return d3.time.format("%b %Y")
        }

        var xTickFormat	  =  getTickFormat();

        var x = d3.time.scale()
        	.range([margin.left, width-margin.right])
        	.domain(d3.extent(dataset, function(d) { return d.month; }));

    	var y = d3.scale.linear()
        	.range([height-margin.bottom, margin.top])
            .domain(d3.extent(dataset, function(d) { return d.count; }));

        var xAxis = d3.svg.axis()
        	.scale(x)
        	.ticks(10)
       		.tickSize(-(height-margin.top-margin.bottom))
        	.tickFormat(xTickFormat);

        var yAxis = d3.svg.axis()
        	.scale(y)
        	.ticks(4)
        	.tickSize(5)
        	.orient("right");

        /*
        * ========================================================================
        *  Line and Area vars
        * ========================================================================
        */

        var line = d3.svg.line()
        	//.interpolate("monotone")
        	.x(function(d) { return x(d.month); })
        	.y(function(d) { return y(d.count); });

        var area = d3.svg.area()
          //.interpolate("monotone")
          .x(function(d) { return x(d.month); })
          .y0((height-margin.bottom))
          .y1(function(d) { return y(d.count); });

        /*
        * ========================================================================
        *  Define SVG vis and append
        * ========================================================================
        */

        // append everything to this
        var vis = d3.select(this.el)
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
          	.attr("class", "line-chart")
      		.append("g")
      		.attr("transform", "translate(" + margin.left + "," + margin.top + ")")
          	.datum(dataset);

        // plot area
        vis.append("path")
            .attr("class", "area")
      		.attr("d", area);

        // x-axis
        vis.append("g")
           	.call(xAxis)
          	.attr("class", "x axis")
           	.attr("transform", "translate(" + 0 + "," + (height - margin.bottom) +")");

        // plot line
        vis.append("path")
           	.attr("class", "line")
            .attr("d", line);

        // y-axis
        vis.append("g")
           	.call(yAxis)
           	.attr("class", "y axis")
           	.attr("transform", "translate(" + (width - margin.right) + ", 0)");

        return this;

      }

    });

    return MetricsChartView;

});
