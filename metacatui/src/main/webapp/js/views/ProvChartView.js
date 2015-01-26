define(['jquery', 'underscore', 'backbone'], 				
	function($, _, Backbone) {
	'use strict';

	
	var ProvChartView = Backbone.View.extend({
		initialize: function(options){
			if((typeof options === "undefined") || !options) var options = {};
			
			this.sources = options.sources || null;
			this.derivations = options.derivations || null;
			this.context = options.context || null;
			this.nodeHeight = options.nodeHeight || 67; //Pixel height of the node including padding and margins
			this.title = options.title || "";
			
			if(!this.derivations && this.sources){
				this.type = "sources";
				this.title 	   = this.sources.length + " " + this.type;
				this.provEntities  = this.sources;
			}
			if(!this.sources && this.derivations){
				this.type = "derivations";
				this.title 	   = this.derivations.length + " " + this.type;
				this.provEntities  = this.derivations;
			}
			
			this.className = this.className + " " + this.type;
		},
		
		tagName: "aside",
		
		className: "prov-chart",
		
		render: function(){
			//First add the title
			this.$el.append($(document.createElement("h3")).addClass("title").text(this.title));
			
			var view = this;
			
			_.each(this.provEntities, function(entity, i){
				//Determine which type of object this is
				var type = "package";

				if(entity.type == "SolrResult"){
					if(entity.get("formatType") == "DATA"){
						type = "data";
					}
					else if(entity.get("formatType") == "METADATA"){
						type = "metadata";
					}
				}
				
				//Create the HTML node and line connecter
				view.$el.append(view.createNode(type, i));	
				
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
		
		createNode: function(type, position){
			var icon = "icon-folder-open";
			if(type == "data") 	   icon = "icon-table";
			if(type == "metadata") icon = "icon-file-text"
				
			var nodeEl = $(document.createElement("div"))
						 .addClass(type + " node pointer popover-this")
						 .css("top", (position * this.nodeHeight) - (this.nodeHeight/2));
			var iconEl = $(document.createElement("i"))
						 .addClass(icon);
			
			$(nodeEl).append(iconEl);
			
			//Add a popover to the node that will show the citation for this dataset and a provenance statement
			$(nodeEl).popover({
				html: true,
				placement: "top",
				trigger: "click",
				container: this.el,
				title: "test",
				content: function(){ return "return the citation from solrResult"; }
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
			if(typeof position !== "undefined") $(pointer).css("top", ((this.nodeHeight * position) - 7.5) + "px");
			
			return pointer;
		}
	});
	
	return ProvChartView;
});