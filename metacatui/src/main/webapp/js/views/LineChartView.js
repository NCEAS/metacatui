/*global define */
define(['jquery', 'underscore', 'backbone', 'd3'], 				
	function($, _, Backbone, d3) {
	'use strict';
		
	// Build the main header view of the application
	var LineChartView = Backbone.View.extend({
		
		width: 960,
		
		height: 500,
		
		x: function(){ return d3.time.scale().range([0, this.width]); },

		y: function(){ return d3.scale.linear().range([this.height, 0]); },
		
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
			
			var margin = {top: 20, right: 20, bottom: 30, left: 50};
			this.width  = $(svgEl).width() - margin.left - margin.right;
			this.height = $(svgEl).height() - margin.top - margin.bottom;

			this.x = this.x();
			this.y = this.y();
			
			var viewRef = this;
			
			var xAxis = d3.svg.axis()
			    .scale(viewRef.x)
			    .orient("bottom");

			var yAxis = d3.svg.axis()
			    .scale(viewRef.y)
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
			
		  this.x.domain(d3.extent(data, function(d) { return d.date; }));
		  this.y.domain(d3.extent(data, function(d) { return d.count; }));

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
		  
		  viewRef = this;
		  
			var line = d3.svg.line()
			.interpolate("cardinal")
			.x(function(d) { return viewRef.x(d.date); })
			.y(function(d) { return viewRef.y(d.count); });


		  svg.append("path")
		      .datum(data)
		      .attr("class", "line " + className)
		      .attr("d", line);
	  		  
		  /* save a reference to certain objects so we can add new lines later */
			this.svg = svg; 
			this.line = line; 
			
			this.addPoints(data, className, points);

	        
			return this;
		},
		
		addLine: function(data, className, points){
			console.log('add a line');
							
			var viewRef = this;
			
		   data.forEach(function(d) {
		    	d.date = viewRef.parseDate(d.date);
		    	d.count = +d.count;
		    });
					   
			viewRef = this;
		    
			var line = d3.svg.line()
				.interpolate("cardinal")
				.x(function(d) { return viewRef.x(d.date); })
				.y(function(d) { return viewRef.y(d.count); });

		    this.svg.append("path")
		    	.datum(data)
		    	.attr("class", "line " + className)
		    	.attr("d", line);
		    
		    this.addPoints(data, className, points);
		    
		},
		
		addPoints: function(data, className, points){
			var viewRef = this;
		
			  //Should we add points?
			  if(points){
				  console.log('add line points');
				  
				  //Pare down the data to every X for the points
				  var pointData = [];
				  for(var i=0; i<data.length; i+=points.frequency){
					  pointData.push(data[i]);
				  }
				  
				  
				  var circles = viewRef.svg.selectAll("svg")
						  					.data(pointData)
						  					.enter().append("g");
				  
						  			circles.append("svg:circle")
						  					.attr("stroke", "black")
						  					.attr("fill", "black")
						  					.attr("class", "point " + className)
						  					.attr("cx", function(d, i){ return viewRef.x(d.date) })
						  					.attr("cy", function(d, i){ return viewRef.y(d.count)})
						  					.attr("r", function(d, i){ return points.radius });
						  
				  circles.append("text")
				  						.text(function(d, i){
				  							return viewRef.commaSeparateNumber(d.count);
				  						})
				  				 .attr("x", function(d, i){
					  						var labelX = viewRef.x(d.date) - 20;
					  						if(labelX > (viewRef.width-100)){
					  							labelX = viewRef.x(d.date) - 80;
					  						}
					  						return  viewRef.x(d.date); })
					  			.attr("y", function(d, i){
					  						var labelY = viewRef.y(d.count) - 10;
					  						if(labelY < 20){
					  							labelY = viewRef.y(d.count) + 20;
					  						}
					  						return labelY; })
					  			.attr("class", "line-chart-label " + className)
					  			.attr("text-anchor", "end");
			  }
		},
		
		//Function to add commas to large numbers
		commaSeparateNumber: function(val){
		    while (/(\d+)(\d{3})/.test(val.toString())){
		      val = val.toString().replace(/(\d+)(\d{3})/, '$1'+','+'$2');
		    }
		    return val;
		 }
		
	});
	return LineChartView;		
});
