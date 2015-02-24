define(['jquery', 'underscore', 'backbone', "views/CitationView"], 				
	function($, _, Backbone, CitationView) {
	'use strict';

	
	var ProvChartView = Backbone.View.extend({
		initialize: function(options){
			if((typeof options === "undefined") || !options) var options = {};
			
			this.sources 	   = options.sources || null;
			this.derivations   = options.derivations || null;
			this.context 	   = options.context || null;
			this.nodeHeight    = options.nodeHeight || 67; 	  //Pixel height of the node including padding and margins
			this.pointerHeight = options.pointerHeight || 15; //Pixel height of the pointer/arrow image
			this.title 		   = options.title || "";
			
			//For Sources charts
			if(!this.derivations && this.sources){
				this.type 		   = "sources";
				this.title 	   	   = this.sources.length + " " + this.type;
				this.provEntities  = this.sources;
			}
			
			//For Derivations charts
			if(!this.sources && this.derivations){
				this.type 	   	   = "derivations";
				this.title 	       = this.derivations.length + " " + this.type;
				this.provEntities  = this.derivations;
			}
			
			//Add the chart type of the class list
			this.className = this.className + " " + this.type;
		},
		
		tagName: "aside",
		
		className: "prov-chart",
		
		render: function(){
			if((this.type == "derivations") && (!this.derivations.length)) return false;
			if((this.type == "sources") && (!this.sources.length)) return false;
					
			//First add the title
			this.$el.append($(document.createElement("h3")).addClass("title").text(this.title));
			
			var view = this;
			
			_.each(this.provEntities, function(entity, i){				
				//Create the HTML node and line connecter
				view.$el.append(view.createNode(entity, i));	
				
				//Derivation charts have a pointer for each node
				if(view.type == "derivations") view.$el.append(view.createPointer(i));
				//Source charts have a connector for each node and one pointer
				if(view.type == "sources")	view.$el.append(view.createConnecter(i));
			});	
			
			//Add classes again to make sure they are all added
			this.$el.addClass(this.className)
					.css("height", ((this.provEntities.length-1) * this.nodeHeight) + "px");
			
			if(this.type == "derivations") this.$el.append(this.createConnecter());
			if(this.type == "sources")     this.$el.append(this.createPointer());
						
			return this;
		},
		
		createNode: function(provEntity, position, metadata){
			//What kind of icon will visually represent this object type?
			var icon = "",
				type = null,
				titleType = "dataset";
			
			if(provEntity.type == "SolrResult"){
				if(provEntity.get("formatType") == "DATA"){
					icon = "icon-table";
					type = "data";
				}
				if(provEntity.get("formatType") == "METADATA"){
					icon = "icon-file-text";
					type = "metadata";
				}
				titleType = provEntity.getType();
			}
			else if(provEntity.type == "Package"){
				icon = "icon-folder-open",
				type = "package";
			}
			
			//Create a DOM element to represent the node	
			var nodeEl = $(document.createElement("div"))
						 .addClass(type + " node pointer popover-this")
						 .attr("tabindex", 0)
						 .css("top", (position * this.nodeHeight) - (this.nodeHeight/2));
			//Create a DOM element for the icon inside the node
			var iconEl = $(document.createElement("i"))
						 .addClass(icon);
			//Put the icon in the node
			$(nodeEl).append(iconEl);
		
			//The placement and title of the popover depends on what type of chart this is
			if(this.type == "derivations"){
				var placement = "left";
				var title = "Derived " + titleType;
			}
			else{
				var placement = "right";		
				var title = "Source " + titleType;
			}
			
			if(metadata) var citationModel = metadata;
			else var citationModel = provEntity;
			
			var popoverContent = new CitationView({model: citationModel}).render().el;
			
			//Add a popover to the node that will show the citation for this dataset and a provenance statement
			$(nodeEl).popover({
				html: true,
				placement: placement,
				trigger: "focus",
				container: this.el,
				title: title,
				content: function(){ 
					return 	popoverContent;
				}
			});
			
			return nodeEl;
		},
		
		createConnecter: function(position){
			if(typeof position == "undefined") var top = "50%";
			else var top = this.nodeHeight * position;
			
			return $(document.createElement("div")).addClass("connecter").css("top", top);
		},
		
		createPointer: function(position){			
			var pointer =  $(document.createElement("img")).attr("src", "./img/arrow.gif").addClass("prov-pointer");
			if(typeof position !== "undefined") $(pointer).css("top", ((this.nodeHeight * position) - (this.pointerHeight/2)) + "px");
			
			return pointer;
		}
	});
	
	return ProvChartView;
});