/*global define */
define(['jquery', 'underscore', 'backbone', 'd3'], 				
	function($, _, Backbone, d3) {
	'use strict';
		
	// Build the main header view of the application
	var LineChartView = Backbone.View.extend({
				
		initialize: function (options) {
			/* OPTIONS:
			 * data: An array of data to use to draw the line. Each point on the line needs a date and count.
			 * 				The points will be drawn in order, so sort the array in ascending time order first
			 * 				Format example:
			 * 				[{date: "13-01-08", count: 500}, {date: "20-03-12", count: 30}]
			 * id: The id to use for the svg element
			 * frequency = add a point for every X points in our data set (i.e. a point for every 12 months)
			 * labelDate = Instructions for how to display the date
			 * 					m - month only
			 * 					y - year only
			 * 					d - date only
			 * 					m-y - month and year
			 * 					m-d-y - month, date, and year
			 * 	radius = radius of the point circle
			 * 	className = class to give the line path and point circle elements
			 *  width = width of SVG element
			 *  height = height of SVG element
			 */
			
			this.data 	   = options.data 	   || [{date: "00-00-1900", count: 0}];
			this.id 	   = options.id 	   || "";
			this.className = options.className || "";
			this.frequency = options.frequency || 1; 	//Use 0 to not add any points
			if(!options.data) this.frequency = 0; //If no data is provided, do not draw any points (otherwise, one point at 0,0 will be drawn)
			this.labelDate = options.labelDate || "m-d-y";
			this.yLabel	   = options.yLabel	   || "";
			this.radius	   = options.radius    || 4;
			this.width 	   = options.width 	   || 650;
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
		 * --Adapted from http://bl.ocks.org/mbostock/3885211--
		 * This function draws a line time series chart
		 */
		render: function () {			
			console.log('Rendering a line chart');
			
			var margin = {top: 20, right: 50, bottom: 30, left: 80};
			this.width  = this.width - margin.left - margin.right;
			this.height = this.height - margin.top - margin.bottom;
			
			this.x = d3.time.scale().range([0, this.width]);
			this.y = d3.scale.linear().range([this.height, 0]);
			
			var viewRef = this;
			
			var xAxis = d3.svg.axis()
			    .scale(this.x)
			    .orient("bottom");

			var yAxis = d3.svg.axis()
			    .scale(this.y)
			    .orient("left");
			
			var svg = d3.select(this.el)
						.attr("class", "line-chart")
					    .attr("width", this.width + margin.left + margin.right)
					    .attr("height", this.height + margin.top + margin.bottom)
					    .append("g")
					    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

		  this.data.forEach(function(d) {
		    d.date = viewRef.parseDate(d.date);
		    d.count = +d.count;
		  });
		  		  		
		  this.x.domain(d3.extent(this.data, function(d) { return d.date; }));
		  this.y.domain([0, d3.max(this.data, function(d){ return d.count; })]); //y axis is always 0 - max y value
		  
		  svg.append("g")
		      .attr("class", "x axis")
		      .attr("transform", "translate(0," + this.height + ")")
		      .call(xAxis);

		  svg.append("g")
		      .attr("class", "y axis")
		      .call(yAxis);
		  
		  d3.select(this.el).append("text")
		      .attr("y", 6)
		      .attr("dy", ".71em")
		      .style("text-anchor", "middle")
		      .text(this.yLabel)
		      .attr("class", "title")
		  	  .attr("transform", "translate(0, " + (this.height/2) + ") rotate(-90)");
		  
		  
		  viewRef = this;
		  
		  var line = d3.svg.line()
						.x(function(d) { return viewRef.x(d.date); })
						.y(function(d) { return viewRef.y(d.count); })
						.interpolate("linear");


		  svg.append("path")
		      .datum(this.data)
		      .attr("class", "line " + this.className)
		      .attr("d", line);
	  		  
		  /* save a reference to certain objects so we can add new lines later */
			this.svg = svg; 
			this.line = line; 
			
			this.addPoints();
	        
			return this;
		},
		
		addLine: function(data){
			console.log('add a line');
							
			var viewRef = this;
					
		   data.forEach(function(d) {
		    	d.date = viewRef.parseDate(d.date);
		    	d.count = +d.count;
		    });
					   		    
			var line = d3.svg.line()
				.x(function(d) { return viewRef.x(d.date); })
				.y(function(d) { return viewRef.y(d.count); })
				.interpolate("linear");

		    this.svg.append("path")
		    	.datum(data)
		    	.attr("class", "line " + this.className)
		    	.attr("d", line);
		    
		    this.data = data;
		    
		    this.addPoints();
		    
		},
		
		addPoints: function(){
			var viewRef = this;
		
			  //Should we add points?
			  if(this.frequency > 0){
				  //Pare down the data to every X for the points
				  var pointData = [];
				  for(var i=0; i<this.data.length; i+=this.frequency){
					  pointData.push(this.data[i]);
				  }
				  var remainder = (this.data.length-1)%this.frequency;
				  if(remainder){
					  //Make sure we included the last data point - we always want our lines to end with a point
					  pointData.push(this.data[this.data.length-1]);  
				  }
				  
				  var circles = this.svg.selectAll("svg")
						  					.data(pointData)
						  					.enter().append("g");
				  
				circles.append("svg:circle")
						.attr("class", "point " + this.className)
						.attr("cx", function(d, i){ return viewRef.x(d.date) })
						.attr("cy", function(d, i){ return viewRef.y(d.count)})
						.attr("r", function(d, i){ return viewRef.radius });
						  
				  circles.append("text")
				  		.text(function(d, i){
				  			var date = "";
				  			//Format the date according to the options passed to this line chart
				  			switch(viewRef.labelDate){
				  				case "y": 
				  					date = new Date(d.date).getFullYear();
				  					break;
				  				case "m":
				  					date = new Date(d.date).getMonth();
				  					break;
				  				case "d":
				  					date = new Date(d.date).getDate();
				  					break;
				  				case "m-y":
				  					date = new Date(d.date);
				  					date = date.getMonth() + "/" + date.getFullYear();
				  					break;
				  				case "m-d-y":
				  					date = new Date(d.date);
				  					date = date.getMonth() + "/" + date.getDate() + "/" + date.getFullYear();
				  					break;
				  				default:
				  					date = new Date(d.date);
				  					date = date.getMonth() + "/" + date.getFullYear();
				  					break;
				  				}
				  			return date + " : " + viewRef.commaSeparateNumber(d.count);
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
					  		return labelY; 
					  	})
					  	.attr("class", "line-chart-label " + this.className)
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
