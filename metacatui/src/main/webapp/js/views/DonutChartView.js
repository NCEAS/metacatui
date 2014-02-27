/*global define */
define(['jquery', 'underscore', 'backbone', 'd3'], 				
	function($, _, Backbone, d3) {
	'use strict';
		
	// Build the main header view of the application
	var DonutChartView = Backbone.View.extend({
						
		initialize: function () {
		},
				
		/*
		 * This function draws a donut chart with a label next to each arc and a label title in the center 
		 * param data: An array of objects with the data needed to draw each arc. Format:
		 * 				[{label: "label text", count: 100, perc: 0.35}]
		 * 				label = text for arc label
		 * 				count = number for arc label
		 * 				perc  = percent of total to determine arc size
		 * param svgEl: A selector string for the SVG element to insert the donut chart into. e.g. "#chart"
		 * param colors: an array of colors (strings of hex code) for the arcs
		 * param titleText (optional): A string to insert in the center of the donut
		 * param titleCount (optional): A number to insert in the center of the donut
		 */
		render: function (data, svgEl, colors, titleText, titleCount) {			
			console.log('Rendering a donut chart');
			
			var viewRef = this;
			
			//Reiterate over the colors if there aren't enough specified for each arc
			var i = 0;
			while(colors.length < data.length){
				colors.push(colors[i]);
				i++;
			}
	
			//Set up the attributes for our donut chart
	        var w = $(svgEl).width(),
	            h = $(svgEl).height(),
	            lastX = 0,
	            lastY = 0,
	            lastWidth = 0,
	            r = Math.min(w, h) / 4,
	            labelr = r*1.3, // radius for label anchor
	            donut = d3.layout.pie(),
	            arc = d3.svg.arc().innerRadius(r * .85).outerRadius(r);

	        //Select the SVG element and connect our data to it
	        var vis = d3.select(svgEl)
	            .data([data]);

	        //Set up a group for each arc we will create
	        var arcs = vis.selectAll("g.arc")
	            .data(donut.value(function(d) { return d.perc })) //connect data to this group 
	            .enter().append("svg:g") 
	            .attr("class", "donut-arc")
	            .attr("transform",
					"translate(" + w/2 + ", " + h/2 + ")"); //center in the SVG element

	        //Append an arc to each group
	        arcs.append("svg:path")
	            .attr("fill", function(d, i) { return colors[i]; })
	            .attr("d", arc);
	        	
	        //Append a text label next to each arc
	        arcs.append("svg:g")
	        	.attr("class", "donut-labels")
	        	.attr("transform", function(d) { //Calculate the label position based on arc centroid
	                var c = arc.centroid(d),
	                    x = c[0],
	                    y = c[1],
	                    // pythagorean theorem for hypotenuse
	                    h = Math.sqrt(x*x + y*y);
	                return "translate(" + ((x/h * labelr)+5) +  ',' + ((y/h * labelr) -10) +  ")"; 
	            })
	        	.append("svg:text")
	        	.attr("class", "donut-arc-label")
	            .attr("fill", function(d, i){ return colors[i]; })
	            .attr("text-anchor", function(d) {
	                // are we past the center?
	                return (d.endAngle + d.startAngle)/2 > Math.PI ?
	                    "end" : "start";
	            })
	            .text(function(d, i) { 
	            	return d.data.label; 
	            });
	        
	        //Append a text label with the count next to each arc
	        arcs.selectAll("g.donut-labels")
	        	.append("svg:text")
	        	.attr("class", "donut-arc-count")
	            .attr("text-anchor", function(d) {
	                // are we past the center?
	                return (d.endAngle + d.startAngle)/2 > Math.PI ?
	                    "end" : "start";
	            })
	            .text(function(d, i) { 	         
	            	return viewRef.commaSeparateNumber(d.data.count); 
	            })
	           .attr("transform", function(d) {
	        	   return "translate(0,20)";
	            });
	        
	        //** Now add a title to the center of the donut chart
	        if((titleText || (titleText !== undefined)) && (titleCount || (titleCount !== undefined))){
		        //Add the data count in text inside the circle
	        	var textData = [];
	        	
	        	if(titleCount || (titleCount !== undefined)){
	        		textData.push({
									"cx" : $(svgEl).attr('width')/2,  //Start at the center
									"cy" : $(svgEl).attr('height')/2, //Start at the center
									"text" : this.commaSeparateNumber(titleCount),
									"className" : "donut-title-count"
								});
	        	}
	        	if(titleText || (titleText !== undefined)){
	        		textData.push({
									"cx" : $(svgEl).attr('width')/2,  //Start at the center
									"cy" : $(svgEl).attr('height')/2, //Start at the center
									"text" : titleText,
									"className" : "donut-title-text"
								});
	        	}
				
				var count = vis.append("svg:g")
								.selectAll("text")
							   .data(textData)
							   .enter().append('svg:text');
	
				var attributes = count
							.text(function(d){ return d.text; })
							.attr("id", function(d){ return d.id; })
							.attr("class", function(d){ return d.className; })
							.attr("font-family", function(d){ return d.fontFamily; })
							.attr("font-size",   function(d){ return d.fontSize; })
							.attr("fill",        function(d){ return d.color; })
							.attr("x", function(d, i){ return d.cx - count[0][i].clientWidth/2; }) //Center horizontally based on the width
							.attr("y", function(d, i){ 
											//Center vertically based on the height
											if(i > 0){
												return d.cy + count[0][i-1].clientHeight/2;
											}
											else{
												return d.cy - count[0][i].clientHeight/2;
											}
							})
							.attr(function(d){  return "transform", "translate(" + d.cx + "," + d.cy + ")" });
	
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
	return DonutChartView;		
});
