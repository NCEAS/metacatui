define(['jquery', 'underscore', 'backbone', "views/CitationView", "views/ProvEntitySelectView", "views/ProvStatementView"], 				
	function($, _, Backbone, CitationView, ProvEntitySelectView, ProvStatement) {
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
			this.editModeOn    = options.editModeOn    || false;
			this.editorType    = options.editorType    || null;

			this.subviews = new Array()
			this.selectProvEntityView = null;
			this.type = null;
			// Does this chart need to be re-rendered after prov relationships have been updated?
			this.rerender = false;
			//For Sources charts
			if((!this.derivations && this.sources) || (this.editModeOn && this.editorType == "sources")) {
				console.log("***** provchart: configuring sources for member " + this.context.get("id") + ", type: " + this.context.get("type"));
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
				this.numDerivations = 0;
			}
			
			//For Derivations charts
			if((!this.sources && this.derivations) || (this.editModeOn && this.editorType == "derivations")) {
				console.log("***** provchart: configuring derivations for member " + this.context.get("id") + ", type: " + this.context.get("type"));
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
				this.numPrograms     = this.programs.length;
				this.numProvEntities = this.numDerivations;
				this.numSources      = 0;
			}
			
			//Add the chart type to the class list
			this.className = this.className + " " + this.type	;
			
			//Create a title
			if((this.context.get("type") == "program") && (this.type == "derivations")){
				this.title = this.numProvEntities + " outputs";				
			}
			else if((this.context.get("type") == "program") && (this.type == "sources")){
				this.title = this.numProvEntities + " inputs";				
			}
			else
				this.title = this.numProvEntities + " " + this.type;
			
			//The default height of the chart when all nodes are visible/expanded
			this.height = (this.numProvEntities * this.nodeHeight);
			
		},
		
		tagName: "aside",
		
		className: "prov-chart",
		
		events: {
			"click .expand-control"   : "expandNodes",
			"click .collapse-control" : "collapseNodes",
			"click .preview"          : "previewData",
			//"click .editor"		      : "selectProvEntities",
			"click #selectDone"       : "getSelectedProvEntities",
		},
		
		subviews: new Array(),
		
		render: function(){
			//Nothing to do if there are no entities and it isn't an editor
			if(!this.numProvEntities && !this.editModeOn) return false;
			
			var view = this;
			console.log("*** rendering " + this.type + " prov chart for package member: " + this.context.get("id"));
			
			//Are there any programs? If no programs are present in this package member and edit mode is on,
			// then we need to draw an edit icon in the program position, unless this member is a program (programs
		    // aren't connected directly to programs).
			if(this.programs.length || (this.editModeOn && (this.context.get("type") != "program"))) {
				console.log("render: setting programs for id: " + this.context.get("id") + ", type: " + this.type);
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
						view.$(".programs").append(view.createNode(entity, programPosition, metadata));
					}
					else {
						view.$el.append(view.createNode(entity, position, metadata));						
						// Sources and Derivation charts have a pointer for each node
						view.$el.append(view.createConnecter(position));
					}
				}
				
				//Bump the position for non-programs only
				if(entity.get("type") == "program")
					programPosition++;
				else
					position++;
				
			}, this);	
			
			// If edit mode is on, then draw an editor node. 
			//if(this.context.type != "Package" && this.editModeOn){
			if(this.editModeOn) {
				console.log("render: drawing editor icons");
				var nodeType;
				// If a program prov icon has already been
				// displayed, then don't display a program edit icon, as currently only one program is
				// supported per ProvCharView.
				if((this.context.get("type") != "program") && this.numPrograms == 0) {
					this.$(".programs").append(this.createEditorNode("program", this.context.get("id"), programPosition));
					programPosition++;
					this.numPrograms++;
				}
				
				// Draw a data node editor
				this.$el.append(this.createEditorNode("data", this.context.get("id"), position));
				position++;
				
				if(this.editorType == "sources") this.numSources++;
				if(this.editorType == "derivations") this.numDerivations++;
			}
			
			//Move the last-viewed prov node to the top of the chart so it is always displayed first
			if(this.$(".node.previous").length > 0)
				this.switchNodes(this.$(".node.previous").first(), this.$(".node").first());
	
			//Add classes
			this.$el.addClass(this.className);
			console.log("adding class to this.$el: " + this.className);
			if(this.numPrograms > 0) this.$el.addClass("has-programs");
			if(this.numDerivations == 1 && !this.numPrograms) this.$el.addClass("one-derivation");
			
			var contextClasses = this.type == "sources" ? "hasProvLeft" : "hasProvRight";
			if(this.numPrograms > 0) contextClasses += " hasPrograms";
			$(this.contextEl).addClass(contextClasses);
			
			//If it's a derivation chart, add a connector line
			if(this.type == "derivations" && !this.numPrograms) this.$el.append(this.createPointer());
			//If it's a sources chart, add a pointer arrow
			if((this.type == "sources") && !this.numPrograms) this.$el.append(this.createPointer());
			
			//Charts with programs need an extra connecter
			if(this.numPrograms) 
				this.$(".programs").append(this.createConnecter());
			
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
						
			// Display a prov entity selection box when an edit node is clicked.
			this.$(".editor").click(function(e) {
				view.selectProvEntities(e);
			});
			
			// Render the non-editor prov nodes so that the each have a unique style.
			var nodeMin = 1;
			var nodeMax = 23; // Max number of 'uniqueNoden' css classes defined (in metacatui-common.css)
			var i = view.getRandomInt(nodeMin, nodeMin+5);
			_.each(view.$('.node:not(.editor)'), function(thisNode){
				//Don't use the unique class on images since they will look a lot different anyway by their image
				if(!$(thisNode).first().hasClass("image")){
					var className = "uniqueNode" + i;
					//Add the unique class and up the iterator
					if($(thisNode).prop("tagName") != "polygon")
						$(thisNode).addClass(className);
					else
						$(thisNode).attr("class", $(thisNode).attr("class") + " " + className);
						
					// Increment the node counter, but not past the max value, which is the number of
					// unique css classes that are defined.
					(i == nodeMax) ? i = nodeMin : i++;
				}
			});
			
			return this;
		},
		

		createNode: function(provEntity, position, metadata){
			//What kind of icon will visually represent this object type?
			console.log("creatNode: drawing " + provEntity.get("type") + " node for id " + provEntity.get("id"));
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
				// Add a delete icon to the node if editing is on
				if(this.editModeOn) {
					var deleteIcon = $(document.createElement("i")).attr("class", "data icon-remove-sign hide");
					$(nodeEl).append(deleteIcon);
					
					$(nodeEl).hover(
						// mouseenter action
						// This could either be a nice, simple data node (a div) or a program node (an svg polygon).
						function(e) {
							// The cursor entered in the 'polygon' element, navigate to the group element that
							// holds the delete icon, so that we can turn it on.
							// Setup a data node for delete
							$(e.target).find("i.icon-remove-sign").removeClass("hide");
							$(e.target).find("i.icon-remove-sign").addClass("show");
							$(e.target).find("i.icon-remove-sign").on("click", function(evt){
								// Stop propagation of of the click event so that parent elements don't receive it.
								// This will prevent the node popover from displaying for this node when the delete icon is clicked.
								evt.stopPropagation();
								view.removeProv(evt.target.parentNode.getAttribute("data-id"), evt.target.parentNode.getAttribute("class"));
							});
						},
						// mouseleave action
						function(e) {
							$(e.target).find("i.icon-remove-sign").removeClass("show");
							$(e.target).find("i.icon-remove-sign").addClass("hide");
						}
					);	
				}
			} else {
				type="program";
				//Create an SVG drawing for the program arrow shape
				var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"),
					nodeEl = $(document.createElementNS("http://www.w3.org/2000/svg", "polygon"))
					    		 .attr("points", "2,20 2,48 17,48 17,67 67,33.5 17,2 17,20");

				//Set a viewBox, height, width, and top position
				svg.setAttribute("viewBox", "0 0 " + this.nodeHeight + " " + this.nodeHeight);
				svg.setAttribute("class", "popover-this");
				$(svg).attr("width", this.nodeHeight + "px").attr("height", this.nodeHeight + "px").css("top", top);
				
				//Create the code icon
				var iconEl = $(document.createElementNS("http://www.w3.org/2000/svg", "text"))
							.text("\u{F121}")
							.attr("class", "icon icon-foo program-icon pointer");
				
				//Create a group element to contain the icon
				var g = $(document.createElementNS("http://www.w3.org/2000/svg", "g"))
						.attr("transform", "translate(18,43)")
						.attr("class", "popover-this program-icon pointer");
				
				//Glue it all together
				$(g).append(iconEl);			
				$(svg).append(nodeEl, g);

				// Add a delete icon to the node if editing is on
				if(this.editModeOn) {
				    var gdel = $(document.createElementNS("http://www.w3.org/2000/svg", "g"))
							.attr("transform", "translate(35,25)")
							.attr("class", "program icon-remove-sign pointer hide");
					var deleteIcon = $(document.createElementNS("http://www.w3.org/2000/svg", "text"))
							.text("\u{F057}")
							.attr("fill", "#FF0000") // put this in the css file 
							.attr("class", "icon icon-foo pointer");
					$(gdel).append(deleteIcon);
					$(svg).append(gdel);
					
					$(svg).hover(
						// mouseenter action
						// This could either be a nice, simple data node (a div) or a program node (an svg polygon).
						function(e) {
							// The cursor entered in the 'polygon' element, navigate to the group element that
							// holds the delete icon, so that we can turn it on.
							var gNode = $(e.target).find("g[class*='icon-remove-sign']");
							var classStr = $(gNode).attr("class");
							$(gNode).attr("class", classStr.replace("hide", "show"));
							$(gNode).on("click", function(evt){
								// Stop propagation of of the click event so that parent elements don't receive it.
								// This will prevent the node popover from displaying for this node when the delete icon is clicked.
								evt.stopPropagation();	
								var dataId = $(evt.target).parent().parent().find("polygon").attr("data-id");
								var nodeClass = $(evt.target).parent().parent().find("polygon").attr("class");
								view.removeProv(dataId, nodeClass);
							});
						},
						// mouseleave action
						function(e) {
							var gNode = $(e.target).find("g[class*='icon-remove-sign']");
							var classStr = $(gNode).attr("class");
							$(gNode).attr("class", classStr.replace("show", "hide"));
						}
					);
				}
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
			else {
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
			if((provEntity.get("id") == MetacatUI.appModel.get("pid")) || (citationModel.get("id") == MetacatUI.appModel.get("pid")))
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
			var popoverContent = $(document.createElement("div")).append(headerContainer, provStatementEl).attr("data-id", provEntity.get("id"));
			
			//Add the name of the data object to the popover
			if(name)
				$(headerContainer).prepend(nameEl);
			
			//Display images in the prov chart node popover 
			if(type == "image"){
				var img = $(document.createElement("img")).attr("src", provEntity.get("url")).addClass("thumbnail");
				$(citationEl).after(img);
			}

			//Mark the node that was last viewed, if any
			if(MetacatUI.appModel.get("previousPid") == provEntity.get("id")){
				$(nodeEl).addClass("previous");
				$(citationEl).before($(document.createElement("h7")).text("Last viewed"));
			}
			
			//Get the id->class name map for unique node colors
			var classMap = this.parentView.classMap || null;
			
			//Add a popover to the node that will show the citation for this dataset and a provenance statement
			var view = this,
				popoverTriggerEl = (provEntity.get("type") == "program") ? $(nodeEl).add(g) : nodeEl;
			
			$(nodeEl).popover({
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
				$(".popover-this.active").popover("hide");
								
				//Toggle the active class
				if($(this).parent("svg").length) 
						$(this).attr("class", $(this).attr("class") + " active");
				else
					$(this).toggleClass("active");
				
			}).on("hide.bs.popover", function(){				
				//Toggle the active class
				if($(this).parent("svg").length) 
					$(this).attr("class", $(this).attr("class").replace(" active", " "));
				else
					$(this).toggleClass("active");
			});
			
			/*
			 * Set a separate event listener on the program icon since it is overlapped with the program arrow
			 */
			if(provEntity.get("type") == "program"){
				$(g).on("click", function(){
					var programNode = $(this).prev("polygon"),
						isOpen = $(programNode).attr("class").indexOf("active") > -1;
					
						if(isOpen)
							$(programNode).popover("hide");
						else
							$(programNode).popover("show");
				});
			}
			
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
		
		createEditorNode: function(type, id, position){
			console.log("createEditorNode:	 drawing " + type + " editor node for id " + id);
			
			//Get the top CSS style of this node based on its position in the chart and determine if it vertically overflows past its context element
			if(type == "program"){
				var distanceFromMiddle = (position * this.nodeHeight) - (this.nodeHeight/2),
					operator           = distanceFromMiddle > 0 ? "+" : "-",
					top                = "calc(50% " + operator + " " + Math.abs(distanceFromMiddle).toString() + "px)",
					isCollapsed        = "expanded";
			} else{
				var top = (position * this.nodeHeight) - (this.nodeHeight/2),
					isCollapsed = ((top + this.nodeHeight + this.offsetTop) > $(this.contextEl).outerHeight()) ? "collapsed" : "expanded";					
			}
			
			var nodeEl = null;
			var svg = null;
			// Only two types of editor nodes, "data" and "program"
			if(type != "program"){
				//Create a DOM element to represent the node	
				nodeEl = document.createElement("div");
				$(nodeEl).css("top", top);
				//Add classes via .attr() so it works for SVG, too
				var currentClasses = $(nodeEl).attr("class") || "";
				$(nodeEl).attr("class", currentClasses + " " + type + " node pointer editor " + isCollapsed);
				$(nodeEl).attr("tabindex", 0);
				//Reference the id of the data object
				$(nodeEl).attr("data-id", id);
						 
				//Create the plus icon
				var iconEl = document.createElement("i");
				$(iconEl).addClass(" icon icon-plus");
				
				//Put the icon in the node
				$(nodeEl).append(iconEl);
				$(nodeEl).append("Add");
			} else {
				//Create an SVG drawing for the program arrow shape
				svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
				nodeEl = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
				$(nodeEl).attr("points", "2,20 2,48 17,48 17,67 67,33.5 17,2 17,20");

				//Set a viewBox, height, width, and top position
				svg.setAttribute("viewBox", "0 0 " + this.nodeHeight + " " + this.nodeHeight);
				//svg.setAttribute("class", "editor");
				$(svg).attr("width", this.nodeHeight + "px").attr("height", this.nodeHeight + "px").css("top", top);
				
				//Create the plus icon
				var iconEl = $(document.createElementNS("http://www.w3.org/2000/svg", "text"))
							.text("\u{f067}")
							//.attr("class", "icon icon-foo program-icon pointer");
							.attr("class", "icon icon-foo pointer");

				
				//Create a group element to contain the icon
				var g = document.createElementNS("http://www.w3.org/2000/svg", "g");
				$(g).attr("transform", "translate(25,30)")
				//$(g).attr("class", "program-icon pointer ");
				$(g).attr("class", " program editor pointer ");
				
				//Add classes via .attr() so it works for SVG, too
				var currentClasses = $(nodeEl).attr("class") || "";
				$(nodeEl).attr("class", currentClasses + " " + type + " node editor pointer " + isCollapsed);
				$(nodeEl).attr("tabindex", 0);
				$(nodeEl).attr("data-id", id);
				
				//Create a group element to contain the text "Add"
				var addEl = $(document.createElementNS("http://www.w3.org/2000/svg", "text"))
										.text("Add");
				var gAdd = document.createElementNS("http://www.w3.org/2000/svg", "g");
				$(gAdd).attr("transform", "translate(18,45)")
				$(gAdd).attr("class", " program editor pointer ");
				$(gAdd).append(addEl);
				
				//Glue it all together
				$(g).append(iconEl);
				$(svg).append(nodeEl, g, gAdd);	
			}
			
			if(svg != null) {
				console.log("returning svg");
				return (svg);
			} else {
				console.log("returning nodeEl");
				return(nodeEl);
			}
			
			//return (svg != null)? svg : nodeEl;
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
					MetacatUI.appView.scrollTo(chartEl);
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
		
		// Display a modal dialog that will be used to select a list of package
		// members that will be associated with the current member (that belongs to this)
		// metadata detail section), by a provenance relationship.
		selectProvEntities: function(e) {
			// TODO: determine if this select was called from a program edit icon or a
			// data edit icon.
			var title = null;
			var label = "Choose files in this dataset: ";
			var selectEntityType = "data";
			var isProgram = false;
			var thisClass = null;
			var myClasses = Array.from(e.currentTarget.classList.values());
			if(myClasses.includes("program")) {
				isProgram = true; 
				selectEntityType = "program";
			}
			console.log("selecting entities");
			
			// Set the selection box labels according to the edit icon that was clicked,
			// and the ProvChart that it was clicked in.
			if(this.editorType == "sources") {
				if(isProgram) {
					title = "Add the program that generated " + this.context.get("fileName");
				} else {
					title = "Add source data to " + this.context.get("fileName");
				}
			} else if(this.editorType == "derivations") {
				if(isProgram) {
					title = "Add the program that read " + this.context.get("fileName");
				} else {
					title = "Add derived data to " + this.context.get("fileName");
				}	
			} else {
				title = "Add data to " + this.context.get("fileName");
				label = "Choose from: ";
			}
			
			// Check if a ProvEntitySelectView was left open previously for this
			// prov chart and close it if yes.
			_.each(this.subviews, function(thisView, i) {
				// Check if this is a ProvChartView
				if(thisView.className.indexOf("prov-entity-select") !== -1) {
					console.log("found orphaned ProvEntitySelectView" + thisView.cid);
					thisView.onClose();
				}
			});
			
			this.subviews = _.filter(this.subviews, function(item) {
 				return item.className !== "prov-entity-select";
			});
				
<<<<<<< HEAD
			this.selectProvEntityView = new ProvEntitySelectView({
=======
			this.selectProvEntityView = new ProvEntitySelect({
>>>>>>> branch 'METACATUI_2_1_BRANCH' of https://github.com/NCEAS/metacatui.git
				parentView    : this.parentView,
				title 		  : title,
				selectLabel   : label,
				selectEntityType : selectEntityType , // Can be either "data" or "program"
				packageModel  : this.packageModel,
				context       : this.context,
				// Number of ows in the select list
				displayRows   : Math.min(10, this.packageModel.get("members").length)
			});
<<<<<<< HEAD
			this.$el.append(this.selectProvEntityView.render().el);
=======
			this.$el.append(this.selectProvEntityView.render());
>>>>>>> branch 'METACATUI_2_1_BRANCH' of https://github.com/NCEAS/metacatui.git
			this.subviews.push(this.selectProvEntityView);

			// Display the modal and wait for completion.
			this.$('#selectModal').modal('show');
		},
		
		// Read selected values from a ProvEntitySelectView which is a modal dialog
		// that displays a selection list of package members to add to a prov chart.
		getSelectedProvEntities: function(e) {
			var selectedValues = null;
			var values = [];
			var myClasses = null;
			var isProgram = false;
			var view = this;

			// Read values from the selection list modal dialog
			selectedValues  = this.selectProvEntityView.readSelected();
			console.log("entities selected: " + selectedValues);
			// Return if no values were selected.
			if(selectedValues == null || selectedValues.length == 0) {
			    $('#selectModal').modal('hide');
				this.selectProvEntityView.onClose();	
				this.selectProvEntityView = null;
				return false;
			}	
			
			// Hide the selection modal dialog
			$('#selectModal').modal('hide');

			// Get the entity type ("program" or "data") from the selection view. This
			// is the entity type of the prov icon that was clicked in order to add
			// this type to the prov of the current package member. The entityType
			// is either "program" or "data".
			var entityType = this.selectProvEntityView.selectEntityType;
			
			// Remove the selection modal
			_.each(this.subviews, function(thisView, i) {
				// Check if this is a ProvChartView
				if(thisView.className.indexOf("prov-entity-select") !== -1) {
					console.log("closing ProvEntitySelectView" + thisView.cid);
					thisView.onClose();
				}
			});
			
			this.subviews = _.filter(this.subviews, function(item) {
				return item.className !== "prov-entity-select";
			});
			// Remove the selection modal
			//this.selectProvEntityView.onClose();
			//Backbone.View.prototype.remove.call(this.selectedProvEntityView);
			this.selectProvEntityView = null;
			
			// Return if no values were selected.
			if(selectedValues.length == 0) return false;
			// If a single value was returned, then put it into an array so 
			// so the loop can be used.
			if(typeof selectedValues == "string") {
				values[0] = selectedValues;
			} else {
				values = selectedValues;
			}
				
			var memberPid = this.context.get("id");
			// Loop through selected values, adding the proper relationships between the selected
			// value and the current package member.
			for (var i = 0; i < values.length; i++) { 
    			var thisPid = values[i];
				console.log("searching for pid: " + thisPid);
				if(this.editorType == "sources") {
					// This is a sources chart
					if(entityType == "program") {
						// source fields: prov_generatedByExecution, prov_generatedByProgram, prov_used, 
						// prov_wasDerivedFrom, prov_wasInformedBy
						this.addProvRel(this.packageModel, memberPid, "prov_generatedByProgram", thisPid);
						this.addProvRel(this.packageModel, thisPid,   "prov_instanceOfClass", "http://purl.dataone.org/provone/2015/01/15/ontology#Program");
						this.addProvRel(this.packageModel, thisPid,   "prov_generated", memberPid);
						this.setMemberAttr(this.packageModel, thisPid, "type", "program")
						// If data nodes already exist in this prov chart, then add them to the program.
						_.each(view.sources, function(model){
							if(model.get("type") == "data") {
								var dataPid = model.get("id");
								view.addProvRel(view.packageModel, dataPid, "prov_usedByProgram", thisPid);
								view.addProvRel(view.packageModel, thisPid,   "prov_used", dataPid);
							}
						});
					} else {
						// Prov for a data node is being added
						this.addProvRel(this.packageModel, memberPid, "prov_wasDerivedFrom", thisPid);
						this.setMemberAttr(this.packageModel, thisPid, "type", "data");
						this.addProvRel(this.packageModel, thisPid, "prov_hasDerivations", memberPid);
						// If a program already exists in this prov chart, then connect this data node to
						// the program as input.
						_.each(view.programs, function(thisProgram) {
							var programPid = thisProgram.get("id");
							view.addProvRel(view.packageModel, thisPid, "prov_usedByProgram", programPid);
							view.addProvRel(view.packageModel, programPid,   "prov_used", thisPid);
						});
					}
				} else {
					// This is a derivations chart
					// derivation fields: prov_usedByExecution, prov_usedByProgram, prov_hasDerivations,
					// prov_generated
					if(entityType == "program") {
			    		//var selectedMember = _.find(this.packageModel.get("members"), function(member){ return member.get("id") == thisPid});
						this.addProvRel(this.packageModel, memberPid, "prov_usedByProgram", thisPid);
						this.addProvRel(this.packageModel, thisPid,   "prov_instanceOfClass", "http://purl.dataone.org/provone/2015/01/15/ontology#Program");
						this.addProvRel(this.packageModel, thisPid,   "prov_used", memberPid);
						this.setMemberAttr(this.packageModel, thisPid, "type", "program")
						// If data nodes already exist in this prov chart, then add them to the program.
						_.each(view.derivations, function(model){
							if(model.get("type") == "data") {
								var dataPid = model.get("id");
								view.addProvRel(view.packageModel, dataPid, "prov_generatedByProgram", thisPid);
								view.addProvRel(view.packageModel, thisPid,   "prov_generated", dataPid);
							}
						});
					} else {
						// Prov for a data node is being added
						this.addProvRel(this.packageModel, thisPid, "prov_wasDerivedFrom", memberPid);
						this.setMemberAttr(this.packageModel, thisPid, "type", "data")
						this.addProvRel(this.packageModel, memberPid, "prov_hasDerivations", thisPid);
						// If a program already exists in this prov chart, then connect this data node to
						// the program as output.
						_.each(view.programs, function(thisProgram) {
							var programPid = thisProgram.get("id");
							view.addProvRel(view.packageModel, thisPid, "prov_generatedByProgram", programPid);
							view.addProvRel(view.packageModel, programPid,   "prov_generated", thisPid);
						});
					}
				}
			}
			
			this.packageModel.trigger("redrawProvCharts");
		},
			
		onClose: function() {			
			//var provEntitiesToAdd = getProvEntities();
			// Erase the current ProvChartView
			this.remove();
			this.unbind();
		},
		
		getRandomInt: function(min, max) {
  			min = Math.ceil(min);
  			max = Math.floor(max);
  			return Math.floor(Math.random() * (max - min)) + min; //The maximum is exclusive and the minimum is inclusive
		}, 
		
		// Add provenance relationships to a package member. Most of the provenance relationships store arrays of package
		// members and not pids (prov_used, prov_generatedByProgram, etc), however, some of them store just strings (prov_instanceOfClass)
		// Set the predicate attribute of the 'subject' package member to the 'object' package member, thereby establishing a 
		// provenance relationship between the two.
		addProvRel: function(packageModel, subjectId, predicate, object) {
			var subjectMember = _.find(packageModel.get("members"), function(member){ return member.get("id") == subjectId});
			var objectMember = _.find(packageModel.get("members"), function(member){ return member.get("id") == object});
			
			// Is the predicate a source or destination field
			var isSource = subjectMember.isSourceField(predicate)
			var isDerivation = subjectMember.isDerivationField(predicate)
			// If not a source or derivation prov field, then assume this is a single value, i.e. not an array of sources or derivations,
			// such as the field 'prov_instanceOfClass'
			if (!isSource && !isDerivation) {
				subjectMember.set(predicate, object);
			} else if (isSource) {
				// Also populate the 'sources' accumulated attribute
				subjectMember.set("provSources", _.union(subjectMember.get("provSources"), [objectMember]));
				subjectMember.set(predicate, _.union(subjectMember.get(predicate), [objectMember]));
			} else {
				// Its a derivation field
				// Also populate the 'derivations' accumulator field
				subjectMember.set("provDerivations", _.union(subjectMember.get("provDerivations"), [objectMember]));
				subjectMember.set(predicate, _.union(subjectMember.get(predicate), [objectMember]));
			}
		},
		
		// A delete icon has been clicked for a prov node, so remove the prov relationships that this node represents.
		// The pid and the type ("program" or "data") are needed in order to remove the appropriate prov relationships.
		removeProv: function(pid, classNames) {
			var memberPid = this.context.get("id");

			var entityType = null;
			// Is this a program node or a data node?
			(_.contains(classNames, "program")) ? entityType = "program" : entityType = "data"
			// Is this a source prov chart or derivations
			if(this.editorType == "sources") {
				// This is a sources chart
				if(entityType == "program") {
					// source fields: prov_generatedByExecution, prov_generatedByProgram, prov_used, 
					// prov_wasDerivedFrom, prov_wasInformedBy
					this.removeProvRel(this.packageModel, memberPid, "prov_generatedByProgram", pid);
					// Remove 'prov_instanceOfClass' if no relations from this pid any longer
					//this.addProvRel(this.packageModel, thisPid,   "prov_instanceOfClass", "http://purl.dataone.org/provone/2015/01/15/ontology#Program");
					this.removeProvRel(this.packageModel, pid, "prov_generated", memberPid);
					// Remove 'type: program' if no more prov relations from this pid
					//this.setMemberAttr(this.packageModel, thisPid, "type", "program")
				} else {
					this.removeProvRel(this.packageModel, memberPid, "prov_wasDerivedFrom", pid);
					//this.setMemberAttr(this.packageModel, thisPid, "type", "data");
					this.removeProvRel(this.packageModel, pid, "prov_hasDerivations", memberPid);
					// If there is a program present in this chart, then remove the prov relationship between
					// the node and the current package member and the relationship between the node and the program
					// (Currently only one program per prov chart).
					var view = this;
					_.each(view.programs, function(thisProgram) {
						var progPid = thisProgram.get("id");
						view.removeProvRel(view.packageModel, pid, "prov_usedByProgram", progPid);
						view.removeProvRel(view.packageModel, progPid, "prov_used", pid);
					});
				}
			} else {
				// This is a derivations chart
				// derivation fields: prov_usedByExecution, prov_usedByProgram, prov_hasDerivations,
				// prov_generated
				if(entityType == "program") {
					//var selectedMember = _.find(this.packageModel.get("members"), function(member){ return member.get("id") == thisPid});
					this.removeProvRel(this.packageModel, memberPid, "prov_usedByProgram", pid);
					this.removeProvRel(this.packageModel, pid, "prov_used", memberPid);
				} else {
					this.removeProvRel(this.packageModel, pid, "prov_wasDerivedFrom", memberPid);
					this.removeProvRel(this.packageModel, memberPid, "prov_hasDerivations", pid);
					var view = this;
					_.each(view.programs, function(thisProgram) {
						var progPid = thisProgram.get("id");
						view.removeProvRel(view.packageModel, pid, "prov_generatedByProgram", progPid);
						view.removeProvRel(view.packageModel, progPid, "prov_generated", pid);
					});
				}
			}
			this.packageModel.trigger("redrawProvCharts");
		},
		
		// Remove a provenance relationship from a package member and rerender the prov charts.
		removeProvRel: function(packageModel, subjectId, predicate, object) {
			var subjectMember = _.find(packageModel.get("members"), function(member){ return member.get("id") == subjectId});
			var objectMember = _.find(packageModel.get("members"), function(member){ return member.get("id") == object});
			
			// Is the predicate a source or destination field
			var isSource = subjectMember.isSourceField(predicate)
			var isDerivation = subjectMember.isDerivationField(predicate)
			// If not a source or derivation prov field, then assume this is a single value, i.e. not an array of sources or derivations,
			// such as the field 'prov_instanceOfClass'
			if (!isSource && !isDerivation) {
				subjectMember.set(predicate, null);
			} else if (isSource) {
				// Also populate the 'sources' accumulated attribute
				subjectMember.set("provSources", _.reject(subjectMember.get("provSources"), objectMember));
				subjectMember.set(predicate, _.reject(subjectMember.get(predicate), objectMember));
			} else {
				// Its a derivation field
				// Also populate the 'derivations' accumulator field
				subjectMember.set("provDerivations", _.reject(subjectMember.get("provDerivations"), objectMember));
				subjectMember.set(predicate, _.reject(subjectMember.get(predicate), objectMember));
			}
		},
			
		// Locate a package member give a pid, and set the supplied attribute with the value;
		setMemberAttr: function(packageModel, pid, attr, value) {
			var thisMember = _.find(packageModel.get("members"), function(member){ return member.get("id") == pid});
			thisMember.set(attr, value);
		}
	});
	
	return ProvChartView;
});