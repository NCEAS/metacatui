/*global define */
define(['jquery', 'underscore', 'backbone', 'd3'], 				
	function($, _, Backbone, d3) {
	'use strict';
		
	// Build the main header view of the application
	var DonutChartView = Backbone.View.extend({

		initialize: function (options) {
			
			/*  -- Options for creating donut charts --
			 *  id of the SVG element to be created
		 	 *  data: An array of objects with the data needed to draw each arc. Format:
			 * 				[{label: "label text", count: 100, perc: 0.35}]
			 * 				label = text for arc label
			 * 				count = number for arc label
			 * 				perc  = percent of total to determine arc size
			 * colors: an array of colors (strings of hex code) for the arcs 
			 * titleText (optional): A string to insert in the center of the donut 
			 * titleCount (optional): A number to insert in the center of the donut
			 * height: height of SVG element
			 * width: width of SVG element
			 */
			
			//Give all the specified options to this view
			this.id 		= options.id 		 || "chart";
			this.data 		= options.data 		 || [{label: "", count: 0, perc: 0}];
			this.colors 	= options.colors 	 || ["#000000"];
			this.titleText  = options.titleText  || "";
			this.titleCount = options.titleCount || 0;
			this.height 	= options.height	 || 400;
			this.width		= options.width		 || 500;
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
			console.log('Rendering a donut chart');
			
			var viewRef = this;
						
			//Reiterate over the colors if there aren't enough specified for each arc
			var i = 0;
			while(this.colors.length < this.data.length){
				this.colors.push(this.colors[i]);
				i++;
			}
	
			//Set up the attributes for our donut chart
	        var w = this.width,
	            h = this.height,
	            lastX = 0,
	            lastY = 0,
	            lastWidth = 0,
	            r = Math.min(w, h) / 4,
	            labelr = r*1.3, // radius for label anchor
	            donut = d3.layout.pie(),
	            arc = d3.svg.arc().innerRadius(r * .85).outerRadius(r);

	        //Select the SVG element and connect our data to it
	        var vis = d3.select(this.el)
	        			.data([viewRef.data]);

	        //Set up a group for each arc we will create
	        var arcs = vis.selectAll("g.arc")
	            .data(donut.value(function(d) { return d.perc })) //connect data to this group 
	            .enter().append("svg:g") 
	            .attr("class", "donut-arc-group")
	            .attr("transform",
					"translate(" + w/2 + ", " + h/2 + ")"); //center in the SVG element

	        //Append an arc to each group
	        arcs.append("svg:path")
	        	.attr("class", "donut-arc")
	            .attr("fill", function(d, i) { return viewRef.colors[i]; })
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
	            .attr("fill", function(d, i){ return viewRef.colors[i]; })
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
	        if((this.titleText || (this.titleText !== undefined)) && (this.titleCount || (this.titleCount !== undefined))){
		        //Add the data count in text inside the circle
	        	var textData = [];
	        	
	        	if(this.titleCount || (this.titleCount !== undefined)){
	        		textData.push({
									"cx" : w/2,  //Start at the center
									"cy" : h/2, //Start at the center
									"text" : this.commaSeparateNumber(this.titleCount),
									"className" : "donut-title-count"
								});
	        	}
	        	if(this.titleText || (this.titleText !== undefined)){
	        		textData.push({
									"cx" : w/2,  //Start at the center
									"cy" : h/2, //Start at the center
									"text" : this.titleText,
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
							.attr("x", function(d, i){ return d.cx  }) 
							.attr("y", function(d, i){ 
											//Center vertically based on the height
											if(i > 0){
												return d.cy + 15;
											}
											else{
												return d.cy - 15;
											}
							})
							.attr("text-anchor", "middle")
							.attr(function(d){  return "transform", "translate(" + d.cx + "," + d.cy + ")" });
	
	        }
	        
	        // We will need to add event listeners here instead of using the Backbone event handler because we
	        // are dynamically creating our SVG element
	        // jQuery class selectors don't work on SVG elements so we are going to do this in a round-about way
	        var arcs = this.$el.find('[class=donut-arc]');
	        $(arcs).mouseover(function(e){
				 var arc = e.target;
				 
				//Toggle the inactive/active class for all arcs in this chart
				 $(arc).parents("svg").each(function(i, svg){
					 
					//Select all elements with donut-arc class attribute
					$(svg).find("[class~=donut-arc]").each(function(i, otherArc){
						//Get the current classes
						var classes = $(otherArc).attr("class");
						 
						if(otherArc == arc){
							 // add the active class				 
							 $(arc).attr("class", classes + " active");
						}
						else{
							// add the 'inactive' class
							$(otherArc).attr("class", classes + " inactive");
						}
					});
					
				 });
	        });
	        
	        $(arcs).mouseout(function(e){
				 var arc = e.target;
				 
				//Toggle the inactive/active class for all arcs in this chart
				 $(arc).parents("svg").each(function(i, svg){
					 
					//Select all elements with donut-arc class attribute
					$(svg).find("[class~=donut-arc]").each(function(i, otherArc){
						//Get the current classes
						var classes = $(otherArc).attr("class");
						 
						//remove either "active" or "inactive" class names
						classes = classes.replace("inactive", "")
										 .replace("active", "");
						
						$(otherArc).attr("class", classes);
					});
					
				 });
	        });
	        	        	 	        
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
