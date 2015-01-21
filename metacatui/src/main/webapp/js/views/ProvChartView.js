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
				this.className = this.className + " sources";
				this.title 	   = this.sources.length + " sources";
				this.provEntities  = this.sources;
				this.type = "source";
			}
			if(!this.sources && this.derivations){
				this.className = this.className + " derivations";
				this.title 	   = this.derivations.length + " derivations";
				this.provEntities  = this.derivations;
				this.type = "derivation";
			}
		},
		
		tagName: "aside",
		
		className: "prov-chart",
		
		render: function(){
			//First add the title
			this.$el.append($(document.createElement("h3")).text(this.title));
			
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
				view.$el.append(view.createConnecter(i));				
			});	
			
			//Add classes again to make sure they are all added
			this.$el.addClass(this.className)
					.css("height", ((this.provEntities.length-1) * this.nodeHeight) + "px");
			
			this.$el.append(this.createPointer());
						
			return this;
		},
		
		createNode: function(type, position){
			var icon = "icon-folder-open";
			if(type == "data") 	   icon = "icon-table";
			if(type == "metadata") icon = "icon-file-text"
				
			var nodeEl = $(document.createElement("div"))
						 .addClass(type + " node")
						 .css("top", (position * this.nodeHeight) - (this.nodeHeight/2));
			var iconEl = $(document.createElement("i"))
						 .addClass(icon);
			
			$(nodeEl).append(iconEl);
			
			return nodeEl;
		},
		
		createConnecter: function(position){
			return $(document.createElement("div")).addClass("connecter").css("top", this.nodeHeight * position);
		},
		
		createPointer: function(type){
			return $(document.createElement("img")).attr("src", "./img/" + this.type + "_arrow.gif").addClass("pointer");
		}
	});
	
	return ProvChartView;
});