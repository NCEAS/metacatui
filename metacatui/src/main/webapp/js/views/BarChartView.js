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
			 * 	formatFromSolrFacets = pass true to pass a Solr facets object to format and then use as the data to graph
			 *  id: The id to use for the svg element
			 * 	className = class to give the SVG element
			 *  barClass = a class to give every bar element
			 *  yLabel = the text of the label along the y-axis
			 *  yFormat = the format to use for the y-axis tick marks, in d3.format syntax (https://github.com/mbostock/d3/wiki/Formatting#d3_format)
			 *  width = width of SVG element
			 *  height = height of SVG element
			 *  roundedRect = pass true to rounded the top corners of the bars. Use false for stacked bar charts
			 *  displayBarLabel = pass false to turn off the count labels displayed at the top of each bar
			 */
			this.data 	   = options.data 	   || [{x: "", y: 0, className: "default"}];
			this.id 	   = options.id 	   || "";
			this.className = options.className || "";
			this.barClass  = options.barClass  || "";
			this.yLabel	   = options.yLabel	   || "";
			this.yFormat   = options.yFormat   || null;
			this.width 	   = options.width 	   || 650;
			this.height    = options.height    || 250;
			this.roundedRect 	 = options.roundedRect 	   || false;
			this.roundedRadius 	 = options.roundedRadius   || null;
			this.displayBarLabel = options.displayBarLabel || true;
			this.barLabelClass	 = options.barLabelClass   || "";
			
			if(options.formatFromSolrFacets){
				this.data = this.formatFromSolrFacets(this.data);
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
					
		/*
		 * --Adapted from http://bl.ocks.org/mbostock/7441121--
		 * This function draws a simple bar chart
		 */
		render: function () {			
			console.log('Rendering a bar chart');
					
			var viewRef = this;
			
			/*
	         * ========================================================================
	         * Gather and create preliminary data for our bar chart
	         * ========================================================================
	         */
			
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
		
		if(this.yFormat){
		    yAxis.tickFormat(this.yFormat); 
		}
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

		  /* rounded_rect: A function for drawing a rounded rectangle 
		    	x: x-coordinate
				y: y-coordinate
				w: width
				h: height
				r: corner radius
				tl: top_left rounded?
				tr: top_right rounded?
				bl: bottom_left rounded?
				br: bottom_right rounded?
		   */
		  function rounded_rect(x, y, w, h, r, tl, tr, bl, br) {
			    var retval;
			    retval  = "M" + (x + r) + "," + y;
			    retval += "h" + (w - 2*r);
			    if (tr) { retval += "a" + r + "," + r + " 0 0 1 " + r + "," + r; }
			    else { retval += "h" + r; retval += "v" + r; }
			    retval += "v" + (h - 2*r);
			    if (br) { retval += "a" + r + "," + r + " 0 0 1 " + -r + "," + r; }
			    else { retval += "v" + r; retval += "h" + -r; }
			    retval += "h" + (2*r - w);
			    if (bl) { retval += "a" + r + "," + r + " 0 0 1 " + -r + "," + -r; }
			    else { retval += "h" + -r; retval += "v" + -r; }
			    retval += "v" + (2*r - h);
			    if (tl) { retval += "a" + r + "," + r + " 0 0 1 " + r + "," + -r; }
			    else { retval += "v" + -r; retval += "h" + r; }
			    retval += "z";
			    return retval;
			}
		  
		  /*
	         * ========================================================================
	         * Draw the bars
	         * ========================================================================
	         */
		  
		  var bars = chart.selectAll(".bar")
			   			  .data(this.data).enter().append("g");
		  
			   bars.append("path")
			   	   .attr("d", function(d){
					    	  if(!d.y) return null; // Do not draw anything if this y-value is 0
					    	  
					    	  if(viewRef.roundedRect){
					    		  
					    		  if(viewRef.roundedRadius){
					    			  var radius = viewRef.roundedRadius;
					    		  }
					    		  else{
						    	  	  var radius = Math.min(x.rangeBand()/2, 30); //Try to make the bars completely rounded on top - i.e. the radius for both corners is half the width of the bar. - but don't go over 30 pixels because really wide bars with a completely round top look very odd
					    		  }	
				    			  
				    			  var DOMheight = height - y(d.y);
				    			  radius = Math.min(radius, DOMheight/2); //If bars are too short, the rounded corners will mess up the rendering so make sure the rounded corners are no more than half the height of the SVG path element
					      	  }
					      	  else var radius = 0; //Square corners
					    	  
					    	  return rounded_rect(x(d.x), y(d.y), x.rangeBand(), height - y(d.y), radius, true, true);
				})
				.attr("x", function(d) { return x(d.x); })
		  	    .attr("y", function(d) { return y(d.y); })
		  	    .attr("class", function(d){ if(!d.className){ d.className = ""; } return "bar " + d.className + " " + viewRef.barClass; });

		/*
		* ========================================================================
	    * Display the count above the bar
		* ========================================================================
		*/
	   if(this.displayBarLabel){
		  bars.append("text")
		  	  .attr("transform", function(d){ 
		  		  var textX = x(d.x) + (x.rangeBand()/2),
		  		  	  textY = y(d.y) - 10;
		  		  
		  		  return "translate(" + textX + "," + textY + ")"; })
		  	  .text(function(d){ return viewRef.commaSeparateNumber(d.y); })
		  	  .attr("text-anchor", "middle")
		  	  .attr("class", "bar-label " + this.barLabelClass);
	   }
		  
		  /*
	         * ========================================================================
	         * Add a label to the y-axis
	         * ========================================================================
	         */
		  	d3.select(this.el).append("text")
		      .attr("y", 6)
		      .attr("dy", ".71em")
		      .style("text-anchor", "middle")
		      .text(this.yLabel)
		      .attr("class", "title")
		  	  .attr("transform", "translate(0, " + (this.height/2) + ") rotate(-90)");
				
			return this;
		},
		
		// This function will take a single object of key:value pairs (identical to the format that Solr returns for facets) and format it as needed to draw a bar chart
		// param rawData: Format example: {"cats": 5, "dogs": 6, "fish": 10}
		formatFromSolrFacets: function(rawData){
			var keys = Object.keys(rawData);
			var data = [];
			for(var i=0; i<keys.length; i++){
				data.push({
					x: keys[i],
					y: rawData[keys[i]]
				});
			}
			
			return data;
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
