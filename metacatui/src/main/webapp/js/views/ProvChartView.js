define(['jquery', 'underscore', 'backbone', "views/CitationView", "views/ProvStatementView"], 				
	function($, _, Backbone, CitationView, ProvStatement) {
	'use strict';

	
	var ProvChartView = Backbone.View.extend({
		initialize: function(options){
			if((typeof options === "undefined") || !options) var options = {};
			
			this.parentView    = options.parentView    || null;
			this.sources 	   = options.sources       || null;
			this.derivations   = options.derivations   || null;
			this.context 	   = options.context       || null;
			this.contextEl     = options.contextEl     || $("body");
			this.packageModel  = options.packageModel  || null;
			this.nodeHeight    = options.nodeHeight    || 67; 	  //Pixel height of the node including padding and margins
			this.pointerHeight = options.pointerHeight || 15;     //Pixel height of the pointer/arrow image
			this.offsetTop     = options.offsetTop     || this.nodeHeight; //The top margin of the chart, in pixels
			this.title 		   = options.title         || "";
			this.editor 	   = options.editor        || false;
			this.editorType    = options.editorType    || null;

			//For Sources charts
			if(!this.derivations && this.sources){
				this.type 		    = "sources";
				this.provEntities   = this.sources;
				
				//Find the number of sources and programs
				var sources = [], programs = [];
				_.each(this.sources, function(model){
					if(model.get("type") == "program")
						programs.push(model);
					else
						sources.push(model);
				});
				
				this.sources = sources;
				this.programs = programs;
				
				this.numSources      = this.sources.length;
				this.numPrograms     = this.programs.length;
				this.numProvEntities = this.numSources;
				this.numPrograms     = this.programs.length;
				this.numDerivations = 0;
			}
			
			//For Derivations charts
			if(!this.sources && this.derivations){
				this.type 	   	     = "derivations";
				this.provEntities = this.derivations;
				
				//Find the number of derivations and programs
				var derivations = [], programs = [];
				_.each(this.derivations, function(model){
					if(model.get("type") == "program")
						programs.push(model);
					else
						derivations.push(model);
				});
				
				this.derivations  = derivations;
				this.programs     = programs;
				
				this.numDerivations  = this.derivations.length;
				this.numProvEntities = this.numDerivations;
				this.numPrograms     = this.programs.length;
				this.numSources      = 0;
			}
			
			//For empty editor charts
			if(this.editor && !this.provEntities.length){
				this.type = options.editorType || null;
				this.sources = [];
				this.derivations = [];
				this.programs = [];
				this.provEntities = [];
				this.numDerivations = 0;
				this.numSources = 0;
				this.numProvEntities = 0;
				this.className += " editor empty";
			}
			
			//Add the chart type to the class list
			this.className = this.className + " " + this.type;
			
			//Create a title
			if((this.context.get("type") == "program") && (this.type == "derivations")){
				this.title = this.numProvEntities + " outputs";				
			}
			else if((this.context.get("type") == "program") && (this.type == "sources")){
				this.title = this.numProvEntities + " inputs";				
			}
			else
				this.title 	   = this.numProvEntities + " " + this.type;
			
			//The default height of the chart when all nodes are visible/expanded
			this.height = (this.numProvEntities * this.nodeHeight);

		},
		
		tagName: "aside",
		
		className: "prov-chart",
		
		events: {
			"click .expand-control"   : "expandNodes",
			"click .collapse-control" : "collapseNodes",
			"click .preview"         : "previewData"
		},
		
		subviews: new Array(),
		
		render: function(){
			//Nothing to do if there are no entities and it isn't an editor
			if(!this.numProvEntities && !this.editor) return false;
			
			var view = this;
			
			//Are there any programs?
			if(this.programs.length && !this.editor){
				this.$el.append($(document.createElement("div")).addClass(this.type + "-programs programs"));
			}
			
			var position = 0,
				programPosition = 0;
			_.each(this.provEntities, function(entity, i){
				
				//Create the HTML node and line connecter
				if(entity.type == "Package")
					view.$el.append(view.createNode(entity, position, _.find(entity.get("members"), function(member){ return member.get("formatType") == "METADATA"; })));	
				else{
					//Find the id of the metadata that documents this object
					var metadataID = entity.get("isDocumentedBy"),
						metadata = null;
					
					if(Array.isArray(metadataID))
						metadataID = metadataID[0];
					
					if(metadataID){
						//The metadata doc for this object may be in the same package as the context of this prov chart
						metadata = _.find(view.packageModel.get("members"), function(member){ return member.get("id") == metadataID });
					}
					
					if(!metadata){
					//Or it may be in any of the other packages related to that package
						var potentialMatch;
						_.each(view.packageModel.get("relatedModels"), function(model){
							potentialMatch = _.find(model.get("members"), function(member){ return member.get("id") == metadataID });
							if(potentialMatch)
								metadata = potentialMatch;
						});
					}

					//Programs will be positioned at a different point in the graph
					if(entity.get("type") == "program"){
						//Find the program position
						this.$(".programs").append(this.createNode(entity, programPosition, metadata));
					}
					else
						this.$el.append(view.createNode(entity, position, metadata));						
				}
				
				//Derivation charts have a pointer for each node
				if(view.type == "derivations") view.$el.append(view.createPointer(position));
				//Source charts have a connector for each node and one pointer
				if(view.type == "sources")	view.$el.append(view.createConnecter(position));
				
				//Bump the position for non-programs only
				if(entity.get("type") == "program")
					programPosition++;
				else
					position++;
				
			}, this);	
			
			//If we are drawing a blank editor
			if(this.editor){
				this.$el.append(this.createEditorNode());
				
				//Derivation charts have a pointer for each node
				if(this.type == "derivations") this.$el.append(this.createPointer(this.numProvEntities));
				//Source charts have a connector for each node and one pointer
				if(this.type == "sources")	this.$el.append(this.createConnecter(this.numProvEntities));
			}
			
			//Move the last-viewed prov node to the top of the chart so it is always displayed first
			if(this.$(".node.previous").length > 0)
				this.switchNodes(this.$(".node.previous").first(), this.$(".node").first());
	
			//Add classes
			this.$el.addClass(this.className);
			var contextClasses = this.type == "sources" ? "hasProvLeft" : "hasProvRight";
			if(this.numPrograms > 0) contextClasses += " hasPrograms";
			$(this.contextEl).addClass(contextClasses);
			
			//If it's a derivation chart, add a connector line
			if(this.type == "derivations" && !this.numPrograms) this.$el.append(this.createConnecter());
			//If it's a sources chart, add a pointer arrow
			if((this.type == "sources") && !this.numPrograms) this.$el.append(this.createPointer());
			
			if(this.programs.length && (this.type == "sources")) this.$(".programs").append(this.createConnecter());
			
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
				
				if(type == "data")
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
			var name = provEntity.get("fileName") || provEntity.get("id") || type;
			var id   = provEntity.get("id");
			
			//Get the top CSS style of this node based on its position in the chart and determine if it vertically overflows past its context element
			if(provEntity.get("type") == "program"){
				var distanceFromMiddle = (position * this.nodeHeight) - (this.nodeHeight/2),
					operator           = distanceFromMiddle > 0 ? "+" : "-",
				    top                = "calc(50% " + operator + " " + Math.abs(distanceFromMiddle).toString() + "px)",
					isCollapsed        = "expanded";
			}
			else{
				var top = (position * this.nodeHeight) - (this.nodeHeight/2),
					isCollapsed = ((top + this.nodeHeight + this.offsetTop) > $(this.contextEl).outerHeight()) ? "collapsed" : "expanded";					
			}

			if(provEntity.get("type") != "program"){
				//Create a DOM element to represent the node	
				var nodeEl = $(document.createElement("div")).css("top", top);;
			}
			else{
				//Create an SVG drawing for the program arrow shape
				var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"),
					nodeEl = $(document.createElementNS("http://www.w3.org/2000/svg", "polygon"))
					    		 .attr("points", "2,20 2,48 17,48 17,67 67,33.5 17,2 17,20")
					    		 .css("stroke-width", "1");

				//Set a viewBox, height, width, and top position
				svg.setAttribute("viewBox", "0 0 " + this.nodeHeight + " " + this.nodeHeight);
				$(svg).attr("width", this.nodeHeight + "px").attr("height", this.nodeHeight + "px").css("top", top);
				
				//Insert the code icon
				var icon = $(document.createElementNS("http://www.w3.org/2000/svg", "text"))
							.text("\u{F121}")
							.attr("class", "icon icon-foo program-icon")
							.attr("transform", "translate(18,43)");
				
				//Glue it all together
				$(svg).append(nodeEl, icon);
				
			}
			
			//Add classes via .attr() so it works for SVG, too
			var currentClasses = $(nodeEl).attr("class") || "";
			$(nodeEl).attr("class", currentClasses + " " + type + " node pointer popover-this " + isCollapsed)
					 .attr("tabindex", 0)
					 //Reference the id of the data object
					 .attr("data-id", provEntity.get("id"));
			
			//Display images in the prov chart node
			if(type == "image"){
				$(nodeEl).css("background-image", "url('" + provEntity.get("url") + "')");
			}
			//Create an icon inside the node for other format types
			else{
				var iconEl = $(document.createElement("i"))
							 .addClass(icon + " icon");
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
			
			//The citation
			var createLink = true;
			if((provEntity.get("id") == appModel.get("pid")) || (citationModel.get("id") == appModel.get("pid")))
				createLink = false;
			
			var citationHeader = $(document.createElement("h6")).addClass("subtle").text("Citation");
			var citationEl = new CitationView({
				model: citationModel,
				createLink: createLink
			}).render().el;
			
			//The title
			var titleEl = $(document.createElement("span")).append($(document.createElement("i")).addClass(icon + " icon-on-left"), title);
			
			//The name
			if(name)
				var nameEl = $(document.createElement("h5")).addClass("name").text(name);

			//The View link
			var arrowIcon = $(document.createElement("i")).addClass("icon-double-angle-right icon-on-right");
			if(_.contains(this.packageModel.get("memberIds"), provEntity.get("id")))
				var linkEl = $(document.createElement("a")).attr("href", "#view/" + provEntity.get("id")).addClass("btn preview").attr("data-id", provEntity.get("id")).text("View").append(arrowIcon);
			else
				var linkEl = $(document.createElement("a")).attr("href", "#view/" + provEntity.get("id")).addClass("btn").text("View").append(arrowIcon);
			
			//The provenance statements
			var provStatementView = new ProvStatement({
				model            : provEntity, 
				relatedModels    : relatedModels,
				currentlyViewing : this.context,
				parentView       : this
				});
			var provStatementEl = provStatementView.render().el;
			this.subviews.push(provStatementView);
			
			//Glue all the parts together
			var headerContainer = $(document.createElement("div")).addClass("well header").append(citationHeader, citationEl, linkEl);
			var popoverContent = $(document.createElement("div")).append(headerContainer, provStatementEl);
			if(name)
				$(headerContainer).prepend(nameEl);
			
			//Display images in the prov chart node popover 
			if(type == "image"){
				var img = $(document.createElement("img")).attr("src", provEntity.get("url")).addClass("thumbnail");
				$(citationEl).after(img);
			}

			//Mark the node that was last viewed, if any
			if(appModel.get("previousPid") == provEntity.get("id")){
				$(nodeEl).addClass("previous");
				$(citationEl).before($(document.createElement("h7")).text("Last viewed"));
			}
			
			//Get the id->class name map for unique node colors
			var classMap = this.parentView.classMap || null;
			
			//Add a popover to the node that will show the citation for this dataset and a provenance statement
			var view = this,
				popoverTriggerEl = $(nodeEl).prop("tagName") == "polygon" ? [nodeEl, $(nodeEl).find(".icon")] : nodeEl;
			$(popoverTriggerEl).popover({
				html: true,
				placement: placement,
				trigger: "click",
				container: this.el,
				title: titleEl,
				content: function(){ 
					//Find the unique class name associated with this ID
					if(classMap){
						var allProvLinks = $(popoverContent).find(".provenance-statement .node-link[data-id]");
						_.each(allProvLinks, function(provlink, i, allProvLinks){
							var id      = $(provlink).attr("data-id"),
								mapItem = _.findWhere(classMap, {id: id});
						
							if(typeof mapItem !== "undefined"){
								var className = mapItem.className,
									matchingProvLinks = $(allProvLinks).filter("[data-id='" + id + "']");
								if(matchingProvLinks.length > 0)
									$(matchingProvLinks).addClass(className);	
							}
						});					
					}
					
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
			
			// If the prov statement views in the popover content have an expand collapse list view, then we want to delegate events 
			//  again when the popover is done displaying. This is because the ExpandCollapseList view hides/shows DOM elements, and each time
			// the DOM elements are hidden, their events are detached.
			if(provStatementView.subviews.length > 0){
				//Get the ExpandCollapseList views
				var expandCollapseLists = _.where(provStatementView.subviews, {name: "ExpandCollapseList"});
				if(expandCollapseLists.length > 0){
					//When the popover is *done* displaying
					$(nodeEl).on("shown.bs.popover", function(){
						//Delegate the events of each of the ExpandCollapseList views
				  	    _.each(expandCollapseLists, function(subview){
							subview.delegateEvents(subview.events);
						});
		 			});
				}
			}
			
			//If this node is rendered as an SVG, return that. Otherwise return the node element created.
			return (typeof svg != "undefined")? svg : nodeEl;
		},
		
		createEditorNode: function(){
			//Get the top CSS style of this node based on its position in the chart and determine if it vertically overflows past its context element
			var position = this.numProvEntities,
				top = (position * this.nodeHeight) - (this.nodeHeight/2),
				isCollapsed = ((top + this.nodeHeight + this.offsetTop) > $(this.contextEl).outerHeight()) ? "collapsed" : "expanded";			
			
			//Create a DOM element to represent the node	
			var nodeEl = $(document.createElement("div"))
						 .addClass(this.type + " node pointer popover-this editor " + isCollapsed)
						 .attr("tabindex", 0)
						 .attr("data-id", "")
						 .css("top", top);
			
			//Create the plus icon
			var iconEl = $(document.createElement("i"))
						 .addClass("editor icon icon-plus");
			
			//Put the icon in the node
			$(nodeEl).append(iconEl);
			
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
		},
		
		previewData: function(e){
			//Don't go anywhere yet...
			e.preventDefault();
			
			if(this.parentView){
				if(this.parentView.previewData(e))
					return;
			}
			
			//Get the target of the click
			var button = $(e.target);
			if(!$(button).hasClass("preview")) 
				button = $(button).parents("a.preview");
			if(button.length < 1) 
				button = $(button).parents("[href]");
			
			window.location = $(button).attr("href");  //navigate to the link href
		},
		
		onClose: function() {			
			this.remove();			
		}
		
	});
	
	return ProvChartView;
});