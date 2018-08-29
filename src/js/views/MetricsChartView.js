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
          this.metricCount  = options.metricCount   || "0";
          this.metricMonths = options.metricMonths  || "0";
          this.width        = options.width         || 600;
          this.height       = options.height        || 390;
          this.metricName   = options.metricName;

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

        console.log(this.metricName)

        /*
        * ========================================================================
        *  Prepare Data
        * ========================================================================
        */

        // Combine the months and count array to make "data".
        var dataset = [];
        for(var i=0; i<this.metricCount.length; i++){
            var obj = {count: this.metricCount[i], month: this.metricMonths[i]};
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

        /*
        * ========================================================================
        *  Sizing
        * ========================================================================
        */

        var margin	= {top: 0, right: 30, bottom: 100, left: 20},
            margin2 = {top: 320, right: 30, bottom: 20, left: 20},
            width	= this.width - margin.left - margin.right,
            height	= this.height - margin.top - margin.bottom,
            height2 = this.height - margin2.top - margin2.bottom;

        /*
        * ========================================================================
        *  X & Y vars
        * ========================================================================
        */

        // === MAIN CHART ==

        var xTickFormat	  =  d3.time.format("%b %Y");

        var x = d3.time.scale()
        	.range([0, (width)])
            .domain(d3.extent(dataset, function(d) { return d.month; }));

    	var y = d3.scale.linear()
        	.range([height, 0])
            .domain([0, d3.max(dataset, function(d) { return d.count; })]);

        var xAxis = d3.svg.axis()
        	.scale(x)
        	.ticks(5)
            .orient("bottom")
       		.tickSize(-(height))
        	.tickFormat(xTickFormat);

        var yAxis = d3.svg.axis()
        	.scale(y)
            .tickSize(-(width))
        	.ticks(4)
        	.orient("right");

        // === SLIDER CHART ('brush') ===

        // define maximum domain for the slider chart
        var mindate = new Date(2013,0,1), // ? start year?
            maxdate = new Date(); // today

        var x2 = d3.time.scale()
            .range([0, width])
            .domain([mindate, maxdate]);

        var y2 = d3.scale.linear()
        	.range([height2, 0])
            .domain(y.domain());

        var xAxis2 = d3.svg.axis()
            .scale(x2)
            .orient("bottom");


        /*
        * ========================================================================
        *  Line and Area vars
        * ========================================================================
        */

        // === MAIN CHART ==

        var line = d3.svg.line()
        	.x(function(d) { return x(d.month); })
        	.y(function(d) { return y(d.count); });

        var area = d3.svg.area()
          .x(function(d) { return x(d.month); })
          .y0((height))
          .y1(function(d) { return y(d.count); });

        // === SLIDER CHART ==

        var area2 = d3.svg.area()
            .x(function(d) { return x2(d.month); })
            .y0((height2))
            .y1(function(d) { return y2(d.count); });

        var line2 = d3.svg.line()
            .x(function(d) { return x2(d.month); })
            .y(function(d) { return y2(d.count); });

        /*
        * ========================================================================
        *  Vars for zooming/brushing variables
        * ========================================================================
        */

        var brush = d3.svg.brush()
            .x(x2)
            .on("brush", brushed);

        var zoom = d3.behavior.zoom()
            .on("zoom", draw);

        // brush handles
        var arc = d3.svg.arc()
            .outerRadius(height2 / 2)
            .startAngle(0)
            .endAngle(function(d, i) { return i ? -Math.PI : Math.PI; });

        /*
        * ========================================================================
        *  Define SVG vis and append
        * ========================================================================
        */

        // append everything to this
        var vis = d3.select(this.el)
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
          	.attr("class", "line-chart");

        // to keep line and area from going outside of plot area
        vis.append("defs").append("clipPath")
            .attr("id", "clip")
            .append("rect")
            .attr("width", width)
            .attr("height", height);

        // focus = main chart
        var focus = vis.append("g")
            .attr("class", "focus")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        // context = mini slider chart
        var context = vis.append("g")
            .attr("class", "context")
            .attr("transform", "translate(" + margin2.left + "," + margin2.top + ")");

        var rect = vis.append("svg:rect")
            .attr("class", "pane")
            .attr("width", width)
            .attr("height", height)
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
            .call(zoom)
            .call(draw);

        zoom.x(x);

        // focus main chart

        focus.append("g")
            .attr("class", "y axis")
            .call(yAxis)
           	.attr("transform", "translate(" + (width) + ", 0)");

        focus.append("path")
            .datum(dataset)
            .attr("class", "area")
            .attr("d", area);

        focus.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + height + ")")
            .call(xAxis);

        focus.append("path")
            .datum(dataset)
            .attr("class", "line")
            .attr("d", line);


        // context slider chart

        context.append("path")
            .datum(dataset)
            .attr("class", "area")
            .attr("d", area2);

        context.append("path")
            .datum(dataset)
            .attr("class", "line")
            .attr("d", line2);

        context.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + height2 + ")")
            .call(xAxis2);

        // y axis title
        vis.append("text")
            .attr("class", "y axis title")
            .text("Monthly " + this.metricName)
            .attr("x", (-(height/2)))
            .attr("y", 0)
            .attr("dy", "1em")
            .attr("transform", "rotate(-90)")
            .style("text-anchor", "middle");

        var brushg = context.append("g")
            .attr("class", "x brush")
            .call(brush);

        // extend handles
        brushg.selectAll(".resize")
            .append("rect")
            .attr("class", "handle")
            .attr("transform", "translate(0," +  -3 + ")")
            .attr('rx', 2)
			.attr('ry', 2)
            .attr("height", height2 + 6)
            .attr("width", 3);

        brushg.selectAll(".resize")
            .append("rect")
            .attr("class", "handle-mini")
            .attr("transform", "translate(-2,10)")
            .attr('rx', 3)
            .attr('ry', 3)
            .attr("height", (height2/2))
            .attr("width", 7);

        // extent 'window'
        brushg.selectAll(".extent")
           .attr("y", -6)
           .attr("height", height2 + 8);

         //functions
        function brushed() {
            x.domain(brush.empty() ? x2.domain() : brush.extent());
            focus.select(".area").attr("d", area);
            focus.select(".line").attr("d", line);
            focus.select(".x.axis").call(xAxis);
            // Reset zoom scale's domain
            zoom.x(x);
        }

        function draw() {
            focus.select(".area").attr("d", area);
            focus.select(".line").attr("d", line);
            focus.select(".x.axis").call(xAxis);
            // Force changing brush range
            brush.extent(x.domain());
            vis.select(".brush").call(brush);
        }

        return this;

      }

    });

    return MetricsChartView;

});
