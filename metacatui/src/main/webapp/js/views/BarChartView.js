/*global define */
define(['jquery', 'underscore', 'backbone', 'd3'], 				
	function($, _, Backbone, d3) {
	'use strict';
		
	// Build the main header view of the application
	var BarChartView = Backbone.View.extend({
				
		initialize: function (options) {
			/* OPTIONS:
			 * 	data: An array of objects that represents the data to be graphed. Pass in a format of {"x axis label": y-axis number, "className": "class attribute string"}. Example:
			 * 			[{x: "2009", y: 20, "className": "bar"}]
			 * 			Any objects with the same x value will be graphed as overlapping bars on the same spot on the x-axis, so stacked bar charts can be created that way.
			 * 	id: The id to use for the svg element
			 * 	className = class to give the SVG element
			 *  yLabel = the text of the label along the y-axis
			 *  width = width of SVG element
			 *  height = height of SVG element
			 */
			this.data 	   = options.data 	   || [{x: "", y: 0, className: "default"}];
			this.id 	   = options.id 	   || "";
			this.className = options.className || "";
			this.yLabel	   = options.yLabel	   || "";
			this.width 	   = options.width 	   || 800;
			this.height    = options.height    || 250;
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
		
		parseDate: d3.time.format("%Y-%m-%d").parse, //The format for the date - can be modified for each chart. This is the format for ISO dates returned from Solr
			
		/*
		 * --Adapted from http://bl.ocks.org/mbostock/7441121--
		 * This function draws a simple bar chart
		 */
		render: function () {			
			console.log('Rendering a bar chart');
					
			var viewRef = this;
			
			var margin = {top: 20, right: 30, bottom: 30, left: 80},
		    width = this.width - margin.left - margin.right,
		    height = this.height - margin.top - margin.bottom;

		var x = d3.scale.ordinal()
		    .rangeRoundBands([0, width], .1);

		var y = d3.scale.linear()
		    .range([height, 0]);

		var xAxis = d3.svg.axis()
		    .scale(x)
		    .orient("bottom");

		var yAxis = d3.svg.axis()
		    .scale(y)
		    .orient("left");

		var chart = d3.select(this.el)
			.attr("class", "bar-chart " + this.className)
		    .attr("width", width + margin.left + margin.right)
		    .attr("height", height + margin.top + margin.bottom)
		  .append("g")
		    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
		  
		  x.domain(this.data.map(function(d) { return d.x; }));
		  y.domain([0, d3.max(viewRef.data, function(d) {  return d.y; })]);

		  chart.append("g")
		      .attr("class", "x axis")
		      .attr("transform", "translate(0," + height + ")")
		      .call(xAxis);

		  chart.append("g")
		      .attr("class", "y axis")
		      .call(yAxis);

		  chart.selectAll(".bar")
		      .data(this.data)
		    .enter().append("rect")
		      .attr("class", "bar")
		      .attr("x", function(d) { return x(d.x); })
		      .attr("y", function(d) { console.log(d.y); return y(d.y); })
		      .attr("class", function(d){ if(!d.className){ d.className = ""; } return "bar " + d.className; })
		      .attr("height", function(d) { return height - y(d.y); })
		      .attr("width", x.rangeBand());
		  
		  //Add a label to the y-axis
		  d3.select(this.el).append("text")
		      .attr("y", 6)
		      .attr("dy", ".71em")
		      .style("text-anchor", "middle")
		      .text(this.yLabel)
		      .attr("class", "title")
		  	  .attr("transform", "translate(0, " + (this.height/2) + ") rotate(-90)");
				
			return this;
		},
		
		//Function to add commas to large numbers
		commaSeparateNumber: function(val){
		    while (/(\d+)(\d{3})/.test(val.toString())){
		      val = val.toString().replace(/(\d+)(\d{3})/, '$1'+','+'$2');
		    }
		    return val;
		 }
		
	});
	return BarChartView;		
});
