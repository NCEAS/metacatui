/*global define */
define(['jquery', 'underscore', 'backbone', 'd3'], 				
	function($, _, Backbone, d3) {
	'use strict';
		
	// Build the main header view of the application
	var CircleBadgeView = Backbone.View.extend({
				
		initialize: function (options) {
			/* OPTIONS:
			 *  data: an array of content with which to draw the circle badge. 
			 *  Each item in the array represents one circle badge and should have a count and may include an optional className to give the circle SVG elements and a label to display underneath the circle
			 *  	Example format:	
			 *  				[{count: 1045, 		   label: "metadata", className: "metadata"},
								 {count: "inner text", label: "data", 	  className: "data", r: 40}]
					r = radius of the circle - can be an int or if nothing is sent for radius, it will be determined based on the count length
			 *  id: The id to use for the svg element
			 *  title = optional text to append to the end of the row of circles
			 *  globalRadius = use the same radius for all circles in the data array. Pass a number to specify a global radius or true to determine the radius for each circle dynamically and use the largest found
			 *  className = class to give the SVG element
			 *  margin = margin in pixels between circles
			 */
			
			this.id		   = options.id	 	   || "";
			this.data	   = options.data	   || [{count: 0, className: "default"}];
			this.title	   = options.title	   || null;
			this.globalR   = options.globalR   || null;
			this.className = options.className || "";
			this.margin	   = options.margin	   || 20;
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
					
		render: function () {						
			console.log("drawing a circle badge");
			
			var viewRef = this;
			
			//TODO: add functinality for a global radius				
				//If we have counts with at least 4 digits, we'll need to increase the radius
				var largestR = 0;
				_.each(this.data, function(d, i){
					if((viewRef.globalR) && (viewRef.globalR > 0)){
						d.r = viewRef.globalR;
					}					
					//If no radius or global radius number is specified, we will determine the radius based on the count length
					else if(!d.r){						
						if(d.count < 100){ 	   							 //i.e. is 1-2 digits 
							d.r = 10;
							if(10 > largestR){
								largestR = 10;
							}
						}
						else if((d.count >= 100) && (d.count < 1000)){     //i.e. is 3 digits 
							d.r = 20;
							if(20 > largestR){
								largestR = 20;
							}
						}
						else if((d.count >= 1000) && (d.count < 10000)){   //i.e. is 4 digits 
							d.r = 30;
							if(30 > largestR){
								largestR = 30;
							}
						}
						else if((d.count >= 10000) && (d.count < 100000)){ //i.e. is 5 digits
							d.r = 40;
							if(40 > largestR){
								largestR = 40;
							}
						}
						else{
							d.r = 60;
							if(60 > largestR){
								largestR = 60;
							}
						}
					}
				});
			
			var svg = d3.select(this.el); //Select the SVG element
			
			//Draw the circles
			var circle = svg.selectAll("circle")
							.data(this.data)
							.enter().append("svg:circle")
							.attr("class", function(d, i){ return d.className; })
							.attr("r", function(d, i){ return d.r; })
							.attr("transform", function(d, i){ 
								if(i == 0){
									d.x = d.r;
								}
								else{
									d.x = viewRef.data[i-1].x + viewRef.data[i-1].r + viewRef.margin + d.r;
								}
								return "translate(" + d.x + "," + d.r + ")";
							});
			
			//Draw the text labels underneath the circles
			svg.append("g")
				.selectAll("text")
				.data(this.data)
				.enter().append("svg:text")
				.attr("transform", function(d, i){
					return "translate(" + d.x + "," + ((d.r*2) + 20) + ")";
				})
				.attr("class", function(d){ return d.className + " label"; })
				.attr("text-anchor", "middle")
				.text(function(d){ return d.label; });
			
			//Draw the count labels inside the circles
			svg.append("g")
				.selectAll("text")
				.data(this.data)
				.enter().append("svg:text")
				.text(function(d){ return viewRef.commaSeparateNumber(d.count); })
				.attr("transform", function(d, i){
					return "translate(" + d.x + "," + (d.r+5) + ")";
				})
				.attr("class", function(d){ return d.className + " count"; })
				.attr("text-anchor", "middle");
					
			if(this.title){
				//Draw the title next to the circles at the end
				svg.append("text")
					.text(this.title)
					.attr("class", "title") 
					.attr("transform", function(d, i){ return "translate(" + (viewRef.data[viewRef.data.length-1].x + viewRef.data[viewRef.data.length-1].r + viewRef.margin) + "," + viewRef.data[viewRef.data.length-1].r + ")"; })
					.attr("text-anchor", "left");	
			}
	        
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
	return CircleBadgeView;		
});
