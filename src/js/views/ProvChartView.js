define(['jquery', 'underscore', 'backbone', "views/CitationView", "views/ProvEntitySelectView", "views/ProvStatementView"], 				
	function($, _, Backbone, CitationView, ProvEntitySelectView, ProvStatement) {
	'use strict';

	
	var ProvChartView = Backbone.View.extend({
		initialize: function(options){
			if((typeof options === "undefined") || !options) var options = {};
			
			this.parentView    = options.parentView    || null;
			this.sources 	   = options.sources       || null;
			this.derivations   = options.derivations   || null;
			this.context 	   = options.context       || null;     // The package member
			this.contextEl     = options.contextEl     || $("body"); // The parent view DOM element for the package member
			this.dataPackage   = options.dataPackage   || null;
			this.nodeHeight    = options.nodeHeight    || 67; 	  //Pixel height of the node including padding and margins
			this.pointerHeight = options.pointerHeight || 15;     //Pixel height of the pointer/arrow image
			this.offsetTop     = options.offsetTop     || this.nodeHeight; //The top margin of the chart, in pixels
			this.title 		   = options.title         || "";
			this.editModeOn    = options.editModeOn    || false;
			
			this.subviews = new Array()
			this.selectProvEntityView = null;
			this.type = null;
			
			// Does this chart need to be re-rendered after prov relationships have been updated?
			this.rerender = false;
            this.serviceUrl = MetacatUI.appModel.get('objectServiceUrl') || MetacatUI.appModel.get('resolveServiceUrl');
			
			//For Sources charts
			if((!this.derivations && this.sources) || (this.editModeOn && this.type == "sources")) {
				this.type 		    = "sources";
				this.provEntities   = this.sources;
				
				//Find the number of sources and programs
				var sources = [], programs = [];
				_.each(this.sources, function(model){
					if(model.getType() == "program")
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
			if((!this.sources && this.derivations) || (this.editModeOn && this.type == "derivations")) {
				this.type 	   	     = "derivations";
				this.provEntities = this.derivations;
				
				//Find the number of derivations and programs
				var derivations = [], programs = [];
				_.each(this.derivations, function(model){
					if(model.getType() == "program")
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
			if((this.context.getType() == "program") && (this.type == "derivations")){
				this.title = this.numProvEntities + " outputs";				
			}
			else if((this.context.getType() == "program") && (this.type == "sources")){
				this.title = this.numProvEntities + " inputs";				
			}
			else
				this.title = this.numProvEntities + " " + this.type;
			
			//The default height of the chart when all nodes are visible/expanded
			this.height = (this.numProvEntities * this.nodeHeight);
            // Add height for one more node if edit mode is on. The node height affects portion of
            // the left or right border that is visible, which is what is used to display the vertical 
            // portion of the connectors between data nodes and programs or the package member 
            // (that owns the metadata detail section).
            if(this.editModeOn) this.height = this.height + this.nodeHeight;
			
		},
		
		tagName: "aside",
		
		className: "prov-chart",
		
		events: {
			"click .expand-control"   : "expandNodes",
			"click .collapse-control" : "collapseNodes",
			"click .preview"          : "previewData",
			"click .editor"		      : "selectProvEntities",
			"click #selectDone"       : "getSelectedProvEntities",
		},
		
		subviews: new Array(),
		
		render: function(){
			//Nothing to do if there are no entities and it isn't an editor
			//if(!this.numProvEntities && !this.numPrograms && !this.editor) return false;
			if(!this.numProvEntities && !this.editModeOn) return false;
			
			var view = this;
			
			//Are there any programs? If no programs are present in this package member and edit mode is on,
			// then we need to draw an edit icon in the program position, unless this member is a program (programs
		    // aren't connected directly to programs).
			if(this.programs.length || (this.editModeOn && (this.context.getType() != "program"))) {
				this.$el.append($(document.createElement("div")).addClass(this.type + "-programs programs"));
			}
			
			var position = 0,
				programPosition = 0;
			_.each(this.provEntities, function(entity, i){
				
				//Create the HTML node and line connecter
				if(entity.getType() == "Package")
					view.$el.append(view.createNode(entity, position, _.find(entity.get("members"), function(member){ return member.get("formatType") == "METADATA"; })));	
				else{
					//Find the id of the metadata that documents this object
					var metadataID = entity.get("isDocumentedBy"),
						metadata = null;
					
					if(Array.isArray(metadataID))
						metadataID = metadataID[0];
					
					if(metadataID){
						//The metadata doc for this object may be in the same package as the context of this prov chart
						metadata = view.dataPackage.find(function(member){ return member.get("id") == metadataID });
					}
					
					if(!metadata){
					//Or it may be in any of the other packages related to that package
						var potentialMatch;
						_.each(view.dataPackage.get("relatedModels"), function(model){
							potentialMatch = _.find(model.get("members"), function(member){ return member.get("id") == metadataID });
							if(potentialMatch)
								metadata = potentialMatch;
						});
					}

					//Programs will be positioned at a different point in the graph
					if(entity.getType() == "program"){
						//Find the program position
						view.$(".programs").append(view.createNode(entity, programPosition, metadata));
					}
					else {
						view.$el.append(view.createNode(entity, position, metadata));						
						// Sources and Derivation charts have a pointer for each node
						view.$el.append(view.createConnecter(position));
					}
				}
				
				//Derivation charts have a pointer for each node
				//if(view.type == "derivations" && (this.numDerivations > 0 || this.editModeOn))
				//	view.$el.append(view.createConnecter(position));
				
				//Source charts have a connector for each node and one pointer
				//if(view.type == "sources" && (this.numSources > 0 || this.editModeOn))
				//	view.$el.append(view.createConnecter(position));
				
				//Bump the position for non-programs only
				if(entity.getType() == "program")
					programPosition++;
				else
					position++;
				
			}, this);	
			
			// If edit mode is on, then draw an editor node. 
			//if(this.context.type != "Package" && this.editModeOn){
			if(this.editModeOn) {
				var nodeType;
				// If a program prov icon has already been
				// displayed, then don't display a program edit icon, as currently only one program is
				// supported per ProvCharView. Also, don't display a program icon if the package members
				// we are annotating is a program (cuurently don't support programs as inputs/outputs of programs).
				if((this.context.getType() != "program") && this.numPrograms == 0) {
					var programNode = this.createEditorNode("program", this.context.get("id"), programPosition);
					this.$(".programs").append(programNode, this.createConnecter());
    				this.createEditTooltip(programNode);
					programPosition++;
					this.numPrograms++;
				}
				
				// Draw a data node editor
				var dataNode = this.createEditorNode("data", this.context.get("id"), position);
				this.$el.append(dataNode);
				this.createEditTooltip(dataNode);
				position++;
				
				if(this.type == "sources")
					this.numSources++;
				if(this.type == "derivations")
					this.numDerivations++;
                
                // Add a connector for this edit icon.
                this.$el.append(this.createConnecter(position-1));
			}
			
			//Move the last-viewed prov node to the top of the chart so it is always displayed first
			if(this.$(".node.previous").length > 0)
				this.switchNodes(this.$(".node.previous").first(), this.$(".node").first());
	
			//Add classes
			this.$el.addClass(this.className);
			if(this.numPrograms > 0) this.$el.addClass("has-programs");
			if(this.numDerivations == 1 && !this.numPrograms) this.$el.addClass("one-derivation");
			
			//Specify classes for the context element (e.g. entity details container)
			var contextClasses = this.type == "sources" ? "hasProvLeft" : "hasProvRight";

			if(this.numPrograms > 0 && this.type == "sources"){
				contextClasses += " hasProgramsLeft";
			}
			else if(this.numPrograms > 0 && this.type == "derivations"){
				contextClasses += " hasProgramsRight";
			}
			
			$(this.contextEl).addClass(contextClasses);
			
			//If it's a derivation chart, add a connector line
			if(this.type == "derivations" && !this.numPrograms) this.$el.append(this.createPointer());
			//If it's a sources chart, add a pointer arrow
			if((this.type == "sources") && !this.numPrograms) this.$el.append(this.createPointer());
			
			//Charts with programs need an extra connecter
			if(this.programs.length && (this.numSources || this.numDerivations)) 
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
			
			if(this.editModeOn)
				this.$(".program.editor").click(function(e){
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
			var icon = "",
				type = null;
			
            var view = this;
			if(provEntity.type == "DataONEObject"){
				type = provEntity.getType();
                provEntity.selectedInEditor = true;
				
				if(type == "data")
					icon = "icon-table";
				else if(type == "metadata")
					icon = "icon-file-text";
				else if (type == "image")
					icon = "icon-picture";
				else if (type == "PDF")
					icon = "icon-file pdf";
			}
			else if(provEntity.type == "DataPackage"){
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
			if(provEntity.getType() == "program"){
				var distanceFromMiddle = (position * this.nodeHeight) - (this.nodeHeight/2),
					operator           = distanceFromMiddle > 0 ? "+" : "-",
				    top                = "calc(50% " + operator + " " + Math.abs(distanceFromMiddle).toString() + "px)",
					isCollapsed        = "expanded";
			}
			else{
				var top = (position * this.nodeHeight) - (this.nodeHeight/2),
					isCollapsed = ((top + this.nodeHeight + this.offsetTop) > $(this.contextEl).outerHeight()) ? "collapsed" : "expanded";					
			}

			if(provEntity.getType() != "program"){
				//Create a DOM element to represent the node	
				var nodeEl = $(document.createElement("div")).css("top", top);
				
				// Add a delete icon to the node if editing is on
				if(this.editModeOn) {
					
					//Create a delete icon
					var deleteIcon = $(document.createElement("i"))
									.addClass("data icon icon-remove-sign remove")
									.attr("title", "Remove")
									.hide();
					
					//Add the delete icon to the node
					nodeEl.append(deleteIcon);
					
					//When the node is hovered over, show the delete icon
					nodeEl.hover(
						// mouseenter action
						// This could either be a nice, simple data node (a div) or a program node (an svg polygon).
						function(e) {
							// The cursor entered in the 'polygon' element, navigate to the group element that
							// holds the delete icon, so that we can turn it on.
							// Setup a data node for delete
							$(e.target).find(".remove").show();

							$(e.target).find(".remove").on("click", function(evt){
								// Stop propagation of of the click event so that parent elements don't receive it.
								// This will prevent the node popover from displaying for this node when the delete icon is clicked.
								evt.stopPropagation();
                                // Remove the provenance icon and the associated relationships from the DataPackage.
								view.removeProv(evt.target.parentNode.getAttribute("data-id"), evt.target.parentNode.getAttribute("class"));
							});
						},
						// mouseleave action
                        // If the mouse passes over the delete icon as it is exiting the prov icon, then the event target
                        // becomes the delete icon itself, and not the div containing the prov icon. So, to be save, just
                        // turn off all delete icons in this prov chart, which works every time and doesn't require us
                        // to test the event target that was fired.
						function(e) {
                            view.$(".remove").hide();
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
							.text("\uF121")
							.attr("class", "icon icon-foo program-icon pointer");
				
				//Create a group element to contain the icon
				var g = $(document.createElementNS("http://www.w3.org/2000/svg", "g"))
						.attr("transform", "translate(18,43)")
						.attr("class", "popover-this program-icon pointer");
				
				//Glue it all together
				$(g).append(iconEl);			
				$(svg).append(nodeEl, g);

				if(this.editModeOn) {

					// Add a delete icon to the node if editing is on
					var gdel = $(document.createElementNS("http://www.w3.org/2000/svg", "g"))
							.attr("transform", "translate(35,25)")
							.attr("class", "program pointer");
					var deleteIcon = $(document.createElementNS("http://www.w3.org/2000/svg", "text"))
							.text("\uF057")
							.attr("class", "icon icon-foo remove pointer")
							.attr("title", "Remove")
							.hide();
					$(gdel).append(deleteIcon);
					$(svg).append(gdel);
										
					$(svg).hover(
						// mouseenter action
						// This could either be a nice, simple data node (a div) or a program node (an svg polygon).
						function(e) {
							// The cursor entered in the 'polygon' element, navigate to the group element that
							// holds the delete icon, so that we can turn it on.
							var deleteIcon = $(e.target).find("[class*='remove']");
							
							deleteIcon.show();
							
							deleteIcon.on("click", function(evt){
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
                            // Hide all remove icons for program nodes. See comments for
                            // hiding data icons above (mouseleave for data icons).
                            var deleteIcon = view.$("[class*='remove']");
                            
                            deleteIcon.hide();
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
			if(provEntity.getType() == "image"){
                $(nodeEl).css("background-image", "url('" + view.serviceUrl + encodeURIComponent(provEntity.get("id")) + "')");
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
			
			var relatedModels = this.dataPackage.get("relatedModels");
			
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
            var packageIds = this.dataPackage.toArray().map(function(singlePackage) { 
                return singlePackage.id;
              });

			if(_.contains(packageIds, provEntity.get("id"))) {
				var linkEl = $(document.createElement("a")).attr("href", MetacatUI.root + "/view/" + encodeURIComponent(provEntity.get("id"))).addClass("btn preview").attr("data-id", provEntity.get("id")).text("View").append(arrowIcon);
            } else {
				var linkEl = $(document.createElement("a")).attr("href", MetacatUI.root + "/view/" + encodeURIComponent(provEntity.get("id"))).addClass("btn").text("View").append(arrowIcon);
            }
            
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
			if(provEntity.getType() == "image"){
                var img = $(document.createElement("img")).attr("src", view.serviceUrl + encodeURIComponent(provEntity.get("id"))).addClass("thumbnail");

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
				popoverTriggerEl = (provEntity.getType() == "program") ? $(nodeEl).add(g) : nodeEl;
			
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
			if(provEntity.getType() == "program"){
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
				nodeEl = $(document.createElement("div")).css("top", top);
				
				//Add classes via .attr() so it works for SVG, too
				var currentClasses = nodeEl.attr("class") || "";
				nodeEl.attr("class", currentClasses + " " + type + " node pointer editor " + isCollapsed);
				nodeEl.attr("tabindex", 0);
				
				//Reference the id of the data object
				nodeEl.attr("data-id", id);
						 
				//Create the plus icon
				var iconEl = $(document.createElement("i")).addClass("icon icon-plus");
				
				//Put the icon in the node
				nodeEl.append(iconEl, "Add");
				
				
			} else {
				//Create an SVG drawing for the program arrow shape
				svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
				nodeEl = $(document.createElementNS("http://www.w3.org/2000/svg", "polygon"));
				
				//Create the SVG shape by adding x,y coordinates for lines to connect to
				nodeEl.attr("points", "2,20 2,48 17,48 17,67 67,33.5 17,2 17,20");

				//Set a viewBox, height, width, and top position
				svg.setAttribute("viewBox", "0 0 " + this.nodeHeight + " " + this.nodeHeight);
				//svg.setAttribute("class", "editor");
				$(svg).attr("width", this.nodeHeight + "px").attr("height", this.nodeHeight + "px").css("top", top);
				
				//Create the plus icon
				var iconEl = $(document.createElementNS("http://www.w3.org/2000/svg", "text"))
							.text("\uF067")
							//.attr("class", "icon icon-foo program-icon pointer");
							.attr("class", "icon icon-foo pointer");

				
				//Create a group element to contain the icon
				var g = document.createElementNS("http://www.w3.org/2000/svg", "g");
				$(g).attr("transform", "translate(25,30)")
				$(g).attr("class", " program editor pointer ");
				
				//Add classes via .attr() so it works for SVG, too
				var currentClasses = nodeEl.attr("class") || "";
				nodeEl.attr("class", currentClasses + " " + type + " node editor pointer " + isCollapsed);
				nodeEl.attr("tabindex", 0);
				nodeEl.attr("data-id", id);
				
				//Create a "group" element
				var gAdd = $(document.createElementNS("http://www.w3.org/2000/svg", "g"));
				
				//Position the group element and add the text "Add"
				gAdd.attr("transform", "translate(18,45)")
					.attr("class", " program node editor pointer ")
					.append($(document.createElementNS("http://www.w3.org/2000/svg", "text")).text("Add"));
				
				//Glue it all together
				$(g).append(iconEl);
				$(svg).append(nodeEl, g, gAdd);	
			}
			
			if(svg != null) {
				return svg;
			} else {
				return nodeEl;
			}
			
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
			var pointer =  $(document.createElement("img")).attr("src", MetacatUI.root + "/img/arrow.gif").addClass("prov-pointer");

			if(typeof position !== "undefined"){
				var top = ((this.nodeHeight * position) - (this.pointerHeight/2)),
					isCollapsed = ((top + (this.nodeHeight/2) + this.offsetTop) > $(this.contextEl).outerHeight()) ? "collapsed" : "expanded";
				
				$(pointer).css("top", top + "px").addClass(isCollapsed);
			}
			
			return pointer;
		},
		
		/*
		 * createEditTooltip
		 * Adds a Bootstrap tooltip to the given prov node which tells the user how to edit it
		 * 
		 * @param nodeEl - the DOM element for the prov node
		 */
		createEditTooltip: function(nodeEl){
			
			//Start a tooltip title and get the object's file name
			var toolTipTitle = "",
				fileName     = this.context.get("fileName") || " this data file.",
				nodeType     = $(nodeEl).is("svg") ? "program" : "data";
			
			//Create the tooltip title 
			if (this.type == "sources" && nodeType == "data") {
				toolTipTitle = "Add source " + nodeType + " to " + fileName;
			}
			else if(this.type == "sources" && nodeType == "program"){
				toolTipTitle = "Add a program that output " + fileName;
			}
			else if (this.type == "derivations" && nodeType == "data") {
				toolTipTitle = "Add derived data to " + fileName;
			}
			else if(this.type == "derivations" && nodeType == "program"){
				toolTipTitle = "Add a program that used " + fileName;
			}
			
			//Create the tooltip settings for programs and data nodes
			var tooltipOptions = {
				placement: "top",
				title: toolTipTitle,
				delay: 600	
			}
			
			//Programs need tooltips to be handled a bit differently since they are SVG elements
			if(nodeType == "program"){
				
				//Add the trigger
				tooltipOptions.trigger = "manual";
				tooltipOptions.container = this.el;
				
				//Create the Bootstrap tooltip and manually show and hide it 
				//based on mouseover and mouseout events
				$(nodeEl).tooltip(tooltipOptions)
						 .mouseenter(function(){
					          setTimeout(function(){ 
					        	  	$(nodeEl).tooltip("show") 
					        	  }, 500);
						 })
						 .mouseleave(function(){
					          setTimeout(function(){ 
					        	  	$(nodeEl).tooltip("hide") 
					        	  }, 500);
						 });
				
			}
			else{
				tooltipOptions.trigger = "hover";
				
				//Create the Bootstrap tooltip
				$(nodeEl).tooltip(tooltipOptions);	
			}
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
			//Use the last expanded/visible connecter element to determine the chart height
			var lastConnecter = _.last(this.$(".connecter.expanded"));				
			if(typeof lastConnecter !== "undefined") 
				this.$el.height(parseInt(lastConnecter.style.top));
			else
				this.$el.height(this.height);
				//Find the pointer and move to the half-way point of the chart height
			this.$(".prov-pointer").css("top", "50%");
			
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
		
		/*
		 * Will show a preview of the data for the currently active node
		 */
		previewData: function(e){
			//Don't go anywhere yet...
			e.stopPropagation();
			e.preventDefault();
			
			//If this prov chart has a parent view with a previewData function, then execute that
			if(this.parentView && this.parentView.previewData && this.parentView.previewData(e)){
					
				//Trigger a click on the active node to deactivate it
				this.$(".node.active").click();
				
				//Exit
				return;
			}
			
			//Get the target of the click
			var button = $(e.target);
			if(!$(button).hasClass("preview")) 
				button = $(button).parents("a.preview");
			if(button.length < 1) 
				button = $(button).parents("[href]");
			
			//Trigger a click on the active node to deactivate it
			this.$(".node.active").click();
			
			//navigate to the link href
			window.location = $(button).attr("href");
		},
		
		// Display a modal dialog that will be used to select a list of package
		// members that will be associated with the current member (that belongs to the
		// current metadata detail section), by a provenance relationship.
		selectProvEntities: function(e) {
			// TODO: determine if this select was called from a program edit icon or a
			// data edit icon.
			var title = null;
			var label = "Choose files in this dataset: ";
			var selectEntityType = "data";
			var isProgram = false;
			var thisClass = null;
			if (e.currentTarget.classList.contains("program")) {
				isProgram = true; 
				selectEntityType = "program";
			}
			
			// Set the selection box labels according to the edit icon that was clicked,
			// and the ProvChart that it was clicked in.
			if (this.type == "sources") {
				if(isProgram) {
					title = "Add the program that generated " + this.context.get("fileName");
				} else {
					title = "Add source data to " + this.context.get("fileName");
				}
			} else if (this.type == "derivations") {
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
					thisView.onClose();
				}
			});
			
			// Remove the prov entity selection modal dialog view from the list
			// of subviews, as this has been deleted after use.
			this.subviews = _.filter(this.subviews, function(item) {
 				return item.className !== "prov-entity-select";
			});
				
			this.selectProvEntityView = new ProvEntitySelectView({
				parentView    : this.parentView,
				title 		  : title,
				selectLabel   : label,
				selectEntityType : selectEntityType , // Can be either "data" or "program"
				dataPackage   : this.dataPackage,
				context       : this.context,
				// Number of ows in the select list
				displayRows   : Math.min(10, this.dataPackage.length)
			});
			this.$el.append(this.selectProvEntityView.render().el);
			this.subviews.push(this.selectProvEntityView);

			// Display the modal and wait for completion.
			this.$('#selectModal').modal('show');
		},

		// Read selected values from a ProvEntitySelectView which is a modal dialog
		// that displays a selection list of package members to add to a prov chart.
		getSelectedProvEntities: function(e) {
			var selectedValues = null;
			var values = [];
			var isProgram = false;
			var view = this;

			// Read values from the selection list modal dialog
			selectedValues  = this.selectProvEntityView.readSelected();
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
            
            // If the user has selected items in a 'program' editor icon, then ensure
            // that they will be recognized as a program when they are drawn.
            // If the MIME-type of the entity is something generic like 'octet-stream'
            // then it may be mistaken as data, so set the provenance object type to avoid
            // confusion - this will take precedence over the MIME-type by DataONEObject.getType().
            // Note that this attribute is set when a package is first read in, but has to be
            // set manually during prov editing.
            if(entityType == "program") {
                for (var i = 0; i < values.length; i++) { 
                    var pid = values[i];
                    var member = this.dataPackage.get(pid);
                    member.setProvClass("program");
                }
            }
            
            // Add the selected values to this prov graph.
			this.addProv(values, entityType);	
        },
        
        // For each identifier that has been selected by the user, after clicking an editor
        // icon, determine the position of the selected item in the prov chart and the
        // prov relationships that need to be added to the adjacent items in the chart.
        // Update the related prov charts so that the newly added item will appear in any
        // related prov chart. The ProvChartView 'provSources' and 'provDerivations' are
        // updated to accomplish this.
        // Also, add the necessary prov relationships to the DataPackage edit queue
        // so that these will be added to the RDF graph (before resmap save) when the prov editor 
        // 'save' button is clicked
        // Note that the provenance relationships that are added depend on the position of the 
        // add icon that was click in the prov graph and whether it is on the left (sources) or
        // right (derivations) side, and if any icons are already in the prov chart that need 
        // to be connected to the new item.
        addProv: function(values, entityType) {
            var view = this;
			var memberPid = this.context.get("id");
			// Loop through selected values, adding the proper relationships between the selected
			// value and the current package member.
			for (var i = 0; i < values.length; i++) { 
    			var pidToAdd = values[i];
                // Is this pid for a package member? It could be a link to another package
                // If it is a package member, mark it as selected, so it is not selected again.
                var addMember = null;
                if (_.contains(this.dataPackage.pluck("id"), pidToAdd)) {
                    addMember = this.dataPackage.get(pidToAdd);
                    addMember.selectedInEditor = true;
                };
				if(this.type == "sources") {
                    // source chart
					// This is a sources chart and the entity to add is a program
					if(entityType == "program") {
						// Programmer's note: source fields for prov charts: prov_generatedByExecution, prov_generatedByProgram, 
                        // prov_used, prov_wasDerivedFrom, prov_wasInformedBy
						this.addProvRel(this.dataPackage, memberPid, "prov_generatedByProgram", pidToAdd);
						this.setMemberAttr(this.dataPackage, pidToAdd, "type", "program")
						// If data nodes already exist in this prov chart, then add them to the program.
						_.each(view.sources, function(model){
							if(model.getType() == "data") {
								var dataPid = model.get("id");
								view.addProvRel(view.dataPackage, dataPid, "prov_usedByProgram", pidToAdd);
                                // Update the package member for the data item so that it's metadataview 
                                // detail section will show the program as using the data item.
                                if(addMember != null) {
                                    model.set("provDerivations", _.union(model.get("provDerivations"), [addMember]));
                                    addMember.set("provSources", _.union(addMember.get("provSources"), [model]));
                                }
							}
						});
                            
                        // Update the program's package member so that it's metadataview detail section will show
                        // the current member (provchart) as generated data there.
                        if(addMember != null) {
                            addMember.set("provDerivations", _.union(addMember.get("provDerivations"), [this.context]));
                        }
					} else {
                        // source chart
                        // The item to add is data.
                        // The prov chart is for a program.
                        if(this.context.getType() == "program") {
                            var programPid = this.context.get("id");
                            var progMember = this.context;
                            view.addProvRel(view.dataPackage, pidToAdd, "prov_usedByProgram", programPid);
                            this.setMemberAttr(this.dataPackage, programPid, "type", "program");
                            this.setMemberAttr(this.dataPackage, pidToAdd, "type", "data");
                            // Update the package member for the data item so that it's metadataview 
                            // detail section will show the program as using the data item.
                            progMember.set("provSources", _.union(progMember.get("provSources"), [addMember]));
                            addMember.set("provDerivations",  _.union(addMember.get("provDerivations"), [progMember]));
                            // Also add this data item to each output of the program. 
                            _.each(progMember.get("provDerivations"), function(model){
                                if(model.getType() == "data") {
                                    var dataPid = model.get("id");
                                    view.addProvRel(view.dataPackage, dataPid, "prov_wasDerivedFrom", pidToAdd);
                                }
                            });
                        } else {
                            // source chart
                            // The item to add is data.
						    // The prov chart is for data.
                            this.addProvRel(this.dataPackage, memberPid, "prov_wasDerivedFrom", pidToAdd);
                            this.setMemberAttr(this.dataPackage, pidToAdd, "type", "data");
                            this.setMemberAttr(this.dataPackage, memberPid, "type", "data");
                            this.context.set("provSources", _.union(this.context.get("provSources"), [addMember]));
                            // Add this prov chart data as derived from the data item being added as a source
                            addMember.set("provDerivations", _.union(addMember.get("provDerivations"), [this.context]))
                            //this.addProvRel(this.dataPackage, pidToAdd, "prov_hasDerivations", memberPid);
                            // If a program already exists in this prov chart, then connect this data node to
                            // the program as input.
                            _.each(view.programs, function(thisProgram) {
                                var programPid = thisProgram.get("id");
                                view.addProvRel(view.dataPackage, pidToAdd, "prov_usedByProgram", programPid);
                                // Update the program's package member so that it's metadataview detail section will show
                                // the current member (provchart) as a used data item there.
                                thisProgram.set("provSources", _.union(thisProgram.get("provSources"), [addMember]));
                            });
                        }
					}
				} else {
					// This is a derivations chart
					// derivation fields: prov_usedByExecution, prov_usedByProgram, prov_hasDerivations, prov_generated
                    // The item to add is a program.
                    // The prov chart will always be for data, as it is not allowed to add a program to a program chart.
					if(entityType == "program") {
			    	    //var selectedMember = _.find(this.packageModel.get("members"), function(member){ return member.get("id") == pidToAdd});
                        this.addProvRel(this.dataPackage, memberPid, "prov_usedByProgram", pidToAdd);
                        this.setMemberAttr(this.dataPackage, pidToAdd, "type", "program")
                        // If derived data items already exist this program prov chart, then add them to the program.
                        _.each(view.derivations, function(model){
                            if(model.getType() == "data") {
                                var dataPid = model.get("id");
                                view.addProvRel(view.dataPackage, dataPid, "prov_generatedByProgram", pidToAdd);
                                // Update the package member for the data item so that it's metadataview 
                                // detail section will show the program as generating the data item.
                                if(addMember != null) {
                                    model.set("provSources", _.union(model.get("provSources"), [addMember]));
                                    addMember.set("provDerivations", _.union(addMember.get("provDerivations"), [model]));
                                }
                            }
                        });
                        // Update the program's package member so that it's metadataview detail section will show
                        // the current member (provchart) as source data there.
                        if(addMember != null) {
                            addMember.set("provSources", _.union(addMember.get("provSources"), [this.context]));
                        }
					} else {
                        // derivations chart
                        // The item to add is data.
                        // The prov chart is for a program.
                        if(this.context.getType() == "program") {
                            var programPid = memberPid
                            var progMember = this.context;
                            view.addProvRel(view.dataPackage, pidToAdd, "prov_generatedByProgram", programPid);
                            this.setMemberAttr(this.dataPackage, pidToAdd, "type", "data");
                            this.setMemberAttr(this.dataPackage, programPid, "type", "program");
                            // Update the package member for the data item so that it's metadataview 
                            // detail section will show the program as derived from the data item.
                            progMember.set("provDerivations", _.union(progMember.get("provDerivations"), [addMember]));
                            // Also add the derived data item to each input of the program. 
                            _.each(progMember.get("provSources"), function(model){
                                if(model.getType() == "data") {
                                    var dataPid = model.get("id");
                                    view.addProvRel(view.dataPackage, pidToAdd, "prov_wasDerivedFrom", dataPid);
                                    model.set("provDerivations", _.union(model.get("provDerivations"), [addMember]));
                                }
                            });
                        } else {
                            // derivations chart
                            // The item to add is data.
                            // The prov chart is for a data item.
                            this.addProvRel(this.dataPackage, pidToAdd, "prov_wasDerivedFrom", memberPid);
                            this.setMemberAttr(this.dataPackage, pidToAdd, "type", "data")
                            this.setMemberAttr(this.dataPackage, memberPid, "type", "data")
                            this.context.set("provDerivations", _.union(this.context.get("provDerivations"), [addMember]))
                            //this.addProvRel(this.dataPackage, memberPid, "prov_hasDerivations", pidToAdd);
                            // If a program already exists in this prov chart, then connect this data node to
                            // the program as output.
                            _.each(view.programs, function(thisProgram) {
                                var programPid = thisProgram.get("id");
                                view.addProvRel(view.dataPackage, pidToAdd, "prov_generatedByProgram", programPid);
                                // Update the program's package member so that it's metadataview detail section will show
                                // the current member (provchart) as a used data item there.
                                thisProgram.set("provDerivations", _.union(thisProgram.get("provDerivations"), [addMember]))
                            });
                        }
                    }
                }
            }
			
			this.dataPackage.trigger("redrawProvCharts");
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
		
		// A delete icon has been clicked for a prov node, so remove the prov relationships that this node represents.
		// The pid and the type ("program" or "data") are needed in order to remove the appropriate prov relationships.
		removeProv: function(pidToRemove, classNames) {
            var view = this;
			var memberPid = this.context.get("id");
            
            var removeMember = null;
            if (_.contains(this.dataPackage.pluck("id"), pidToRemove)) {
                removeMember = this.dataPackage.get(pidToRemove);
                removeMember.selectedInEditor = false;
            };

			var entityType = null;
			// Is this a program node or a data node?
            if(typeof classNames == "string") {
                entityType = (_.contains(classNames.split(" "), "program")) ? "program" : "data";
            } else {
                entityType = (_.contains(classNames, "program")) ? "program" : "data";
            }
			// Is this a source prov chart or derivations
			if(this.type == "sources") {
                // This is a sources chart and the entity to remove is a program
				if(entityType == "program") {
					// source fields: prov_generatedByExecution, prov_generatedByProgram, prov_used, 
					// prov_wasDerivedFrom, prov_wasInformedBy
					this.removeProvRel(this.dataPackage, memberPid, "prov_generatedByProgram", pidToRemove);
                    _.each(view.sources, function(model){
                        if(model.getType() == "data") {
                            var dataPid = model.get("id");
                            view.removeProvRel(view.dataPackage, dataPid, "prov_usedByProgram", pidToRemove);
                            // Update the package member for the data item so that it's prov chart
                            // will show the program as using the data item. If pidToRemove
                            // is not a package member (it was a link to another package), then don't need to do this.
                            if(removeMember != null) {
                                model.set("provDerivations", _.reject(model.get("provDerivations"), 
                                    function(item) {return item.get("id") == pidToRemove}));
                                removeMember.set("provSources", _.reject(removeMember.get("provSources"),
                                    function(item) {return item.get("id") == dataPid}));
                            }
                        }
                    });
                    // Update the program's package member so that it's metadataview detail section will not show
                    // the current member (that has this provchart) as generated data there.
                    if(removeMember != null) {
                        removeMember.set("provDerivations", _.reject(removeMember.get("provDerivations"), 
                            function(item) {return item.get("id") == memberPid}));
                    }
                } else {
                    // source chart
                    // The item to remove is data.
                    // The prov chart is for a program.
                    if(this.context.getType() == "program") {
                        var programPid = this.context.get("id");
                        var progMember = this.context;
                        view.removeProvRel(view.dataPackage, pidToRemove, "prov_usedByProgram", programPid);
                        //this.setMemberAttr(this.dataPackage, programPid, "type", "program");
                        //this.setMemberAttr(this.dataPackage, pidToRemove, "type", "data");
                        // Update the package member for the data item so that it's metadataview 
                        // detail section will show the program as using the data item.
                        progMember.set("provSources", _.reject(progMember.get("provSources"),
                            function(item) {return item.get("id") == pidToRemove}));
                        removeMember.set("provDerivations",  _.reject(removeMember.get("provDerivations"), 
                            function(item) {return item.get("id") == programPid}));
                        // Also remove this data item from each output of the program. 
                        _.each(progMember.get("provDerivations"), function(model){
                            if(model.getType() == "data") {
                                var dataPid = model.get("id");
                                view.removeProvRel(view.dataPackage, dataPid, "prov_wasDerivedFrom", pidToRemove);
                                model.set("provDerivations",  _.reject(model.get("provDerivations"), 
                                    function(item) {return item.get("id") == pidToRemove}));
                                // Each program output is no longer derived from the input data being removed.
                                removeMember.set("provDerivations", _.reject(removeMember.get("provDerivations"),
                                    function(item) {return item.get("id") == dataPid}));
                            }
                        });
                    } else {
                        // source chart
                        // item to remove is data
                        // prov chart is for data
                        this.removeProvRel(this.dataPackage, memberPid, "prov_wasDerivedFrom", pidToRemove);
                        //this.setMemberAttr(this.packageModel, thisPid, "type", "data");
                        //this.removeProvRel(this.dataPackage, pidToRemove, "prov_hasDerivations", memberPid);
                        this.context.set("provSources", _.reject(this.context.get("provSources"),
                            function(item) {return item.get("id") == pidToRemove}));
                        removeMember.set("provDerivations", _.reject(removeMember.get("provDerivations"), 
                            function(item) {return item.get("id") == memberPid}));
                        // If there is a program present in this chart, then remove the prov relationship between
                        // the node to be removed and the current package member and the relationship between the 
                        // node to be removed and the program.
                        // (Currently only one program per prov chart).
                        _.each(view.programs, function(thisProgram) {
                            var progPid = thisProgram.get("id");
                            view.removeProvRel(view.dataPackage, pidToRemove, "prov_usedByProgram", progPid);
                            // Remove pidToRemove from the source chart of the program.
                            thisProgram.set("provSources", _.reject(thisProgram.get("provSources"),
                            function(item) {return item.get("id") == pidToRemove}));
                        });
                    }
                }
			} else {
				// This is a derivations chart
                // item to remove is data
                // the prov char is for a program
				// derivation fields: prov_usedByExecution, prov_usedByProgram, prov_hasDerivations,
				// prov_generated
				if(entityType == "program") {
					//var selectedMember = _.find(this.packageModel.get("members"), function(member){ return member.get("id") == thisPid});
					this.removeProvRel(this.dataPackage, memberPid, "prov_usedByProgram", pidToRemove);
					//this.removeProvRel(this.dataPackage, pid, "prov_used", memberPid);
                    _.each(view.derivations, function(model){
                        if(model.getType() == "data") {
                            var dataPid = model.get("id");
                            view.removeProvRel(view.dataPackage, dataPid, "prov_generatedByProgram", pidToRemove);
                            // Update the package member for the data item so that it's metadataview 
                            // detail section will not show the program as generating the data item.
                            if(removeMember != null) {
                                model.set("provSources", _.reject(model.get("provSources"), 
                                    function(item) {return item.get("id") == pidToRemove}));
                                removeMember.set("provDerivations", _.reject(removeMember.get("provDerivations"),
                                    function(item) {return item.get("id") == dataPid}));
                            }
                        }
                    });
                    // Remove the package member as a source of the program that is being removed.
                    if(removeMember != null) {
                        removeMember.set("provSources", _.reject(removeMember.get("provSources"),
                            function(item) {return item.get("id") == memberPid}));
                    }
				} else {
                    // derivations chart
                    // The item to remove is data.
                    // The prov chart is for a program.
                    if(this.context.getType() == "program") {
                        var programPid = memberPid
                        var progMember = this.context;
                        view.removeProvRel(view.dataPackage, pidToRemove, "prov_generatedByProgram", programPid);
                        //this.setMemberAttr(this.dataPackage, pidToRemove, "type", "data");
                        //this.setMemberAttr(this.dataPackage, programPid, "type", "program");
                        // Update the package member for the data item so that it's metadataview 
                        // detail section will show the program as derived from the data item.
                        progMember.set("provDerivations", _.reject(progMember.get("provDerivations"), 
                            function(item) {return item.get("id") == pidToRemove}));
                        // Also add the derived data item to each input of the program. 
                        _.each(progMember.get("provSources"), function(model){
                            if(model.getType() == "data") {
                                var dataPid = model.get("id");
                                view.addProvRel(view.dataPackage, pidToRemove, "prov_wasDerivedFrom", dataPid);
                                model.set("provDerivations", _.reject(model.get("provDerivations"), 
                                    function(item) {return item.get("id") == pidToRemove}));
                            }
                        });
                    } else {
                        // derivations chart
                        // The item to remove is data
                        // The prov chart is for data
                        this.removeProvRel(this.dataPackage, pidToRemove, "prov_wasDerivedFrom", memberPid);
                        //this.removeProvRel(this.dataPackage, memberPid, "prov_hasDerivations", pidToRemove);
                        this.context.set("provDerivations", _.reject(this.context.get("provDerivations"), 
                            function(item) {return item.get("id") == pidToRemove}));

                        var view = this;
                        _.each(view.programs, function(thisProgram) {
                            var progPid = thisProgram.get("id");
                            view.removeProvRel(view.dataPackage, pidToRemove, "prov_generatedByProgram", progPid);
                            thisProgram.set("provDerivations", _.reject(thisProgram.get("provDerivations"),
                                function(item) {return item.get("id") == pidToRemove}));
                        });
                    }
                }
            }
			this.dataPackage.trigger("redrawProvCharts");
		},
        
        // Add provenance relationships to a package member. Most of the provenance relationships store arrays of package
        // members and not pids (prov_used, prov_generatedByProgram, etc), however, some of them store just strings (prov_instanceOfClass)
        // Set the predicate attribute of the 'subject' package member to the 'object' package member, thereby establishing a 
        // provenance relationship between the two.
        addProvRel: function(dataPackage, subjectId, predicate, object) {
          var subjectMember = _.find(dataPackage.toArray(), function(member) { return member.get("id") == subjectId});
          var objectMember = _.find(dataPackage.toArray(), function(member) { return member.get("id") == object});
          
          // Record this provenance edit. This will be used during serialization of provenance relationships.
          dataPackage.recordProvEdit('add', subjectId, predicate, object);
          // Is the predicate a source or destination field
          var isSource = subjectMember.isSourceField(predicate);
          var isDerivation = subjectMember.isDerivationField(predicate);
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
        // Remove a provenance relationship from a package member
        removeProvRel: function(dataPackage, subjectId, predicate, object) {
          var subjectMember = _.find(dataPackage.toArray(), function(member){ return member.get("id") == subjectId});
          var objectMember = _.find(dataPackage.toArray(), function(member){ return member.get("id") == object});
          
          dataPackage.recordProvEdit('delete', subjectId, predicate, object)
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
		setMemberAttr: function(dataPackage, pid, attr, value) {
			var thisMember = dataPackage.find(function(member){ return member.get("id") == pid});
			thisMember.set(attr, value);
		}
	});
	
	return ProvChartView;
});
