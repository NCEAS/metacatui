define(['jquery', 'underscore', 'backbone'], 				
	function($, _, Backbone) {
	'use strict';

	
	var ExpandCollapseListView = Backbone.View.extend({
		
		initialize: function(options){
			this.max  		= options.max  		 || 3;
			this.list 		= options.list 		 || [];
			this.id   		= options.id	 	 || null;
			this.attributes = options.attributes || null;
			this.className += options.className  || "";
		},
		
		tagName : "span",
		
		className : "",
		
		events: {
			"click .teaser" : "toggle"
		},
		
		/*
		 * Makes a list of object ID links that collapses after a max X amount
		 */
		render: function(){
			var view = this,
				text = "",
				collapsed = false;
			
			_.each(view.list, function(id, i){
				
				//If there are more than 4, hide the rest of the list in a collapsable element
				if(i == view.max){
					text +=  "<span class='expand-collapse'>" +
							 "<span class='teaser'>" +
							 "<a class='obvious-link teaser'> (and " +
							 (view.list.length - i) + " more...) </a>" +
							 "</span>" +
							 "<span class='collapsed'>";
					collapsed = true;
				}
				
				//Do we need a comma?
				if((view.list.length > 1) && (i < view.list.length) && (i > 0)) 
					text += ", ";
				
				//Make an anchor tag
				text += view.makeIDLink(id);
				
				//Put spaces where they are needed
				if(i == (view.list.length-1)) text += " ";
				
				//Close the collapsable element at the last item in the list
				if((i = (view.list.length - 1)) && collapsed)
					text += "</span></span>";
			});
			
			this.$el.append(text);
			
			return this;
		},
		
		makeIDLink: function(id){
			return "<a class='obvious-link'" +
				   "href='" + 
				   appModel.get('objectServiceUrl') + encodeURIComponent(id) + 
				   "'>" + 
				   id + 
				   "</a>";
		},
		
		toggle: function(){
			e.preventDefault();
			
			var collapsed = this.$el.find(".collapsed");
			var expanded  = this.$el.find(".expanded");
			
			_.each(collapsed, function(element, i){
				element.removeClass("collapsed");
				element.addClass("expanded");
			});
			_.each(expanded, function(element, i){
				element.removeClass("expanded");
				element.addClass("collapsed");
			});
			
			return false;
		}
	});
	
	return ExpandCollapseListView;		
});
