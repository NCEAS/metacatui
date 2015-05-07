define(['jquery', 'underscore', 'backbone', "views/CitationView", "views/ProvStatementView"], 				
	function($, _, Backbone, CitationView, ProvStatement) {
	'use strict';

	
	var ProvChartView = Backbone.View.extend({
		initialize: function(options){
			if((typeof options === "undefined") || !options) var options = {};
			
			this.sources 	   = options.sources       || null;
			this.derivations   = options.derivations   || null;
			this.context 	   = options.context       || null;
			this.contextEl     = options.contextEl     || $("body");
			this.packageModel  = options.packageModel  || null;
			this.nodeHeight    = options.nodeHeight    || 67; 	  //Pixel height of the node including padding and margins
			this.pointerHeight = options.pointerHeight || 15;     //Pixel height of the pointer/arrow image
			this.offsetTop     = options.offsetTop     || this.nodeHeight; //The top margin of the chart, in pixels
			this.title 		   = options.title         || "";

			//For Sources charts
			if(!this.derivations && this.sources){
				this.type 		    = "sources";
				this.provEntities   = this.sources;
				this.numSources     = this.sources.length;
				this.numProvEntities = this.numSources;
				this.numDerivations = 0;
			}
			
			//For Derivations charts
			if(!this.sources && this.derivations){
				this.type 	   	     = "derivations";
				this.provEntities    = this.derivations;
				this.numDerivations  = this.derivations.length;
				this.numProvEntities = this.numDerivations;
				this.numSources      = 0;
			}
			
			//Add the chart type to the class list and create a title
			this.className = this.className + " " + this.type;
			this.title 	   = this.numProvEntities + " " + this.type;
			
			//The default height of the chart when all nodes are visible/expanded
			this.height = (this.numProvEntities * this.nodeHeight);

		},
		
		tagName: "aside",
		
		className: "prov-chart",
		
		events: {
			"click .expand.control"   : "expandNodes",
			"click .collapse.control" : "collapseNodes"
		},
		
		render: function(){
			if(!this.numProvEntities) return false;
			
			var view = this;
			
			_.each(this.provEntities, function(entity, i){	
				//Create the HTML node and line connecter
				if(entity.type == "Package")
					view.$el.append(view.createNode(entity, i, _.find(entity.get("members"), function(member){ return member.get("formatType") == "METADATA"; })));	
				else
					view.$el.append(view.createNode(entity, i));	
				
				//Derivation charts have a pointer for each node
				if(view.type == "derivations") view.$el.append(view.createPointer(i));
				//Source charts have a connector for each node and one pointer
				if(view.type == "sources")	view.$el.append(view.createConnecter(i));
			});	
			
			//Move the last-viewed prov node to the top of the chart so it is always displayed first
			if(this.$(".node.previous").length > 0)
				this.switchNodes(this.$(".node.previous").first(), this.$(".node").first());
	
			this.$el.addClass(this.className);
			
			if(this.type == "derivations") this.$el.append(this.createConnecter());
			if(this.type == "sources")     this.$el.append(this.createPointer());
			
			if(this.$(".collapsed").length){
				var expandIcon   = $(document.createElement("i")).addClass("icon icon-expand-alt"),
				    collapseIcon = $(document.createElement("i")).addClass("icon icon-collapse-alt");

				this.$el.addClass("expand-collapse")
				        .append($(document.createElement("a"))
				        		          .addClass("expand-control")
				        		          .text("view more ")
				        		          .append(expandIcon))
				        .append($(document.createElement("a"))
				        		          .addClass("collapse-control")
				        		          .text("view less ")
				        		          .append(collapseIcon));
				this.collapseNodes(false);
			}
			else
				this.$el.css("height", this.height - this.offsetTop);
			
			//Lastly, add the title
			this.$el.prepend($(document.createElement("h3")).addClass("title").text(this.title));
						
			return this;
		},
		
		createNode: function(provEntity, position, metadata){
			//What kind of icon will visually represent this object type?
			var icon = "",
				type = null;
			
			if(provEntity.type == "SolrResult"){
				type = provEntity.getType();
				
				if(type == "program")
					icon = "icon-code";
				else if(type == "data")
					icon = "icon-table";
				else if(type == "metadata")
					icon = "icon-file-text";
				else if (type == "image")
					icon = "icon-picture";
				else if (type == "pdf")
					icon = "icon-file pdf";
			}
			else if(provEntity.type == "Package"){
				icon = "icon-folder-open",
				type = "package";
			}
			
			if(!type){
				type = "data";
				icon = "icon-table";
			}
			
			//Get the name of this object
			var name = provEntity.get("entityName");
			
			//Get the top CSS style of this node based on its position in the chart and determine if it vertically overflows past its context element
			var top = (position * this.nodeHeight) - (this.nodeHeight/2),
				isCollapsed = ((top + this.nodeHeight + this.offsetTop) > $(this.contextEl).outerHeight()) ? "collapsed" : "expanded";			
			
			//Create a DOM element to represent the node	
			var nodeEl = $(document.createElement("div"))
						 .addClass(type + " node pointer popover-this " + isCollapsed)
						 .attr("tabindex", 0)
						 .attr("data-pid", provEntity.get("id"))
						 .css("top", top);
			
			//Display images in the prov chart node
			if(type == "image"){
				$(nodeEl).css("background-image", "url('" + provEntity.get("url") + "')");
			}
			//Create an icon inside the node for other format types
			else{
				var iconEl = $(document.createElement("i"))
							 .addClass(icon);
				//Put the icon in the node
				$(nodeEl).append(iconEl);		
			}
		
			//The placement and title of the popover depends on what type of chart this is
			if(this.type == "derivations"){
				var placement = "left";
				var title = "Derived " + type;
			}
			else{
				var placement = "right";		
				var title = "Source " + type;
			}
						
			if(metadata) var citationModel = metadata;
			else var citationModel = provEntity;
			
			var relatedModels = this.packageModel.get("relatedModels");
			
			//Create all the elements that will go inside the popover
			var citationHeader = $(document.createElement("h6")).addClass("subtle").text("Citation");
			var citationEl = new CitationView({model: citationModel}).render().el;
			var titleEl = $(document.createElement("span")).append($(document.createElement("i")).addClass(icon + " icon-on-left"), title);
			
			if(name){
				var nameHeader = $(document.createElement("h6")).addClass("subtle").text("Name");
				var nameEl = $(document.createElement("h5")).addClass("name").text(name);
			}
			
			var provStatementEl = new ProvStatement({
				model         : provEntity, 
				relatedModels : relatedModels,
				currentlyViewing : this.context}).render().el;
			var arrowIcon = $(document.createElement("i")).addClass("icon-double-angle-right icon-on-right");
			var linkEl = $(document.createElement("a")).attr("href", "#view/" + provEntity.get("id")).addClass("btn").text("View").append(arrowIcon);
			
			var popoverContent = $(document.createElement("div")).append(citationEl, provStatementEl, linkEl);
			$(popoverContent).prepend(citationHeader);
			
			if(name)
				$(popoverContent).prepend(nameHeader, nameEl);
			
			//Display images in the prov chart node popover 
			if(type == "image"){
				var img = $(document.createElement("img")).attr("src", provEntity.getURL()).addClass("thumbnail");
				$(citationEl).after(img);
			}

			//Mark the node that was last viewed, if any
			if(appModel.get("previousPid") == provEntity.get("id")){
				$(nodeEl).addClass("previous");
				$(citationEl).before($(document.createElement("h7")).text("Last viewed"));
			}
			
			//Add a popover to the node that will show the citation for this dataset and a provenance statement
			$(nodeEl).popover({
				html: true,
				placement: placement,
				trigger: "click",
				container: this.el,
				title: titleEl,
				content: function(){ 
					return 	popoverContent;
				}
			}).on("show.bs.popover", function(){
				//Close the last open node popover
				$(".node.popover-this.active").popover("hide");
				
				//Toggle the active class
				$(this).toggleClass("active");
				
			}).on("hide.bs.popover", function(){
				//Toggle the active class
				$(this).toggleClass("active");
			});
			
			return nodeEl;
		},
		
		createConnecter: function(position){
			if(typeof position == "undefined"){
				var top = "50%",
					isCollapsed = "";
			}
			else{
				var top = this.nodeHeight * position,
				    isCollapsed = ((top + (this.nodeHeight/2) + this.offsetTop) > $(this.contextEl).outerHeight()) ? "collapsed" : "expanded";			
			}			
			
			return $(document.createElement("div")).addClass("connecter " + isCollapsed).css("top", top);
		},
		
		createPointer: function(position){			
			var pointer =  $(document.createElement("img")).attr("src", "./img/arrow.gif").addClass("prov-pointer");
			
			if(typeof position !== "undefined"){
				var top = ((this.nodeHeight * position) - (this.pointerHeight/2)),
					isCollapsed = ((top + (this.nodeHeight/2) + this.offsetTop) > $(this.contextEl).outerHeight()) ? "collapsed" : "expanded";
				
				$(pointer).css("top", top + "px").addClass(isCollapsed);
			}
			
			return pointer;
		},
		
		/*
		 * Displays the nodes that are collapsed/hidden - not all provenance charts will have collapsed nodes
		 */
		expandNodes: function(){
			//Change the context element (accompanying metadata section) and the chart itself to the full expanded height
			$(this.contextEl).height(this.height + this.offsetTop);
			this.$el.height(this.height - this.offsetTop);
			
			//Hide the expand control and show the hidden nodes
			this.$(".expand-control").fadeOut();
			this.$(".collapse-control").fadeIn();
			this.$(".collapsed").fadeIn();
		},
		
		collapseNodes: function(scroll){			
			//Fit the context element to its contents
			$(this.contextEl).height("auto");
			
			//For source charts
			if(this.sources){
				//Use the last expanded/visible connecter element to determine the chart height
				var lastConnecter = _.last(this.$(".connecter.expanded"));				
				if(typeof lastConnecter !== "undefined") 
					this.$el.height(parseInt(lastConnecter.style.top));
				else
					this.$el.height(this.height);
				
				//Find the pointer and move to the half-way point of the chart height
				this.$(".prov-pointer").css("top", "50%");
			}
			//For derivations charts
			else if(this.derivations){
				//Get the position of the last visible pointer in the chart and use that to determine the chart height
				var lastPointer = _.last(this.$(".prov-pointer.expanded"));				
				if(typeof lastPointer !== "undefined")
					this.$el.height(parseInt(lastPointer.style.top) + this.pointerHeight/2);
				else
					this.$el.height(this.height);
					
				this.$(".connecter").css("top", "50%");	
			}
			
			//Hide the expand control and show the hidden nodes
			this.$(".expand-control").fadeIn();
			this.$(".collapse-control").css("display", "none");
			
			//Fade out the collapsed elements and scroll the page back up to the chart since when
			//the elements collapse the user may be left several hundred pixels downpage
			var chartEl = this.$el,
				i = 0,
				numAnimations = this.$(".collapsed").length;
			this.$(".collapsed").fadeOut(/*function(){
				i++;
				if(scroll && numAnimations == i)
					appView.scrollTo(chartEl);
			}*/);			
		},
		
		switchNodes: function(nodeA, nodeB){
			if(nodeA == nodeB) return;
			
			var oldPosition =  $(nodeA).css("top");
			var isCollapsed =  $(nodeA).hasClass("collapsed");
			
			$(nodeA).css("top", (this.nodeHeight/2) * -1).removeClass("collapsed");
			$(nodeB).first().css("top", oldPosition);
			if(isCollapsed) $(nodeB).first().addClass("collapsed");
		}
		
	});
	
	return ProvChartView;
});