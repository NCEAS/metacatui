/*global define */
define(['jquery', 'underscore', 'backbone', 'd3'], 				
	function($, _, Backbone, d3) {
	'use strict';
		
	// Build the main header view of the application
	var LineChartView = Backbone.View.extend({
		
		width: 960,
		
		height: 500,
		
		parseDate: d3.time.format("%Y-%m-%d").parse, //The format for the date - can be modified for each chart. This is the format for ISO dates returned from Solr
				
		initialize: function () {
		},
				
		/*
		 * --Adapted from http://bl.ocks.org/mbostock/3885211--
		 * This function draws a line time series chart
		 * param data: An array of data to use to draw the line. Each point on the line needs a date and count.
		 * 				The points will be drawn in order, so sort the array in ascending time order first
		 * 				Format example:
		 * 				[{date: "13-01-08", count: 500}, {date: "20-03-12", count: 30}]
		 * param svgEl: A string to use as a selector for the svg element to draw the chart in (e.g. "#chart")
		 * param className: A class name to give the line
		 * param points: A couple of settings for adding points to the line (optional). Example:
		 * 				frequency = add a point for every X points in our data set (i.e. a point for every 12 months)
		 * 				radius = radius of the point circle
		 * 				className = class to give the circle elements
		 * 				{frequency: 12, radius: 5, className: "point"}
		 */
		render: function (data, svgEl, className, points) {			
			console.log('Rendering a line chart');
			
			var viewRef = this;
			
			var margin = {top: 20, right: 20, bottom: 30, left: 50};
			this.width  = $(svgEl).width() - margin.left - margin.right;
			this.height = $(svgEl).height() - margin.top - margin.bottom;
						
			var x = d3.time.scale()
		    		.range([0, this.width]);

			var y = d3.scale.linear()
			    	.range([this.height, 0]);

			var xAxis = d3.svg.axis()
			    .scale(x)
			    .orient("bottom");

			var yAxis = d3.svg.axis()
			    .scale(y)
			    .orient("left");
			
			var svg = d3.select(svgEl)
					    .attr("width", this.width + margin.left + margin.right)
					    .attr("height", this.height + margin.top + margin.bottom)
					    .append("g")
					    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

		  data.forEach(function(d) {
		    d.date = viewRef.parseDate(d.date);
		    d.count = +d.count;
		  });
		  
		  this.data = data;
			
		  x.domain(d3.extent(data, function(d) { return d.date; }));
		  y.domain(d3.extent(data, function(d) { return d.count; }));

		  svg.append("g")
		      .attr("class", "x axis")
		      .attr("transform", "translate(0," + this.height + ")")
		      .call(xAxis);

		  svg.append("g")
		      .attr("class", "y axis")
		      .call(yAxis)
		    .append("text")
		      .attr("y", 6)
		      .attr("dy", ".71em")
		      .style("text-anchor", "end")
		      .text("files uploaded")
		      .attr("transform", "translate(0, " + this.height/2 + ")")
		      .attr("transform", "rotate(-90)");
		  
			var line = d3.svg.line()
			.interpolate("cardinal")
			.x(function(d) { return x(d.date); })
			.y(function(d) {console.log(d.count); return y(d.count); });


		  svg.append("path")
		      .datum(data)
		      .attr("class", "line " + className)
		      .attr("d", line);
	  
		  //Should we add points?
		  if(points){
			  //Pare down the data to every X for the points
			  var pointData = [];
			  for(var i=0; i<data.length; i+=points.frequency){
				  pointData.push(data[i]);
			  }
			  
			  var points = svg.selectAll(".point")
			  					.data(pointData)
			  					.enter().append("svg:circle")
			  					.attr("stroke", "black")
			  					.attr("fill", "black")
			  					.attr("class", "point " + className)
			  					.attr("cx", function(d, i){ return x(d.date) })
			  					.attr("cy", function(d, i){ return y(d.count)})
			  					.attr("r", function(d, i){ return points.radius });  
		  }
		  
		  /* save a reference to certain objects so we can add new lines later */
			this.svg = svg; 
			this.line = line; 
			
			//this.addLine(data, className, points);
	        
			return this;
		},
		
		addLine: function(data, className, points){
			console.log('add a line');
			
			var viewRef = this;
							
			var x = d3.time.scale()
		    		.range([0, this.width]);

			var y = d3.scale.linear()
			    	.range([this.height, 0]);

		   data.forEach(function(d) {
		    	d.date = viewRef.parseDate(d.date);
		    	d.count = +d.count;
		    });
			
		    x.domain(d3.extent(data, function(d) { return d.date; }));
		    y.domain(d3.extent(data, function(d) { return d.count; }));
		    
			var line = d3.svg.line()
				.interpolate("cardinal")
				.x(function(d) { return x(d.date); })
				.y(function(d) { return y(d.count); });

		    this.svg.append("path")
		    	.datum(data)
		    	.attr("class", "line " + className)
		    	.attr("d", line);
		    
		  //Should we add points?
			  if(points){
				  console.log('add line points');
				  
				  //Pare down the data to every X for the points
				  var pointData = [];
				  for(var i=0; i<data.length; i+=points.frequency){
					  pointData.push(data[i]);
				  }
				  
				  var points = viewRef.svg.append("g")
				  					.selectAll(".point")
				  					.data(pointData)
				  					.enter().append("svg:circle")
				  					.attr("stroke", "black")
				  					.attr("fill", "black")
				  					.attr("class", "point " + className)
				  					.attr("cx", function(d, i){ return x(d.date) })
				  					.attr("cy", function(d, i){ return y(d.count)})
				  					.attr("r", function(d, i){ return points.radius });  
			  }
		}
		
	});
	return LineChartView;		
});
