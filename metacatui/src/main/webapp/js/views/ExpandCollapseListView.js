define(['jquery', 'underscore', 'backbone'], 				
	function($, _, Backbone) {
	'use strict';

	
	var ExpandCollapseListView = Backbone.View.extend({
		
		initialize: function(options){
			if((options === undefined) || (!options)) var options = {};

			this.max  		 = options.max  		 || 3;
			this.list 		 = options.list 		 || [];
			this.prependText = options.prependText   || "";
			this.appendText  = options.appendText    || "";
			this.id   		 = options.id	 	     || null;
			this.attributes  = options.attributes    || null;
			this.className  += options.className     || "";
		},
		
		tagName : "span",
		
		className : "expand-collapse",
		
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
			
			text += this.prependText;
			
			_.each(view.list, function(id, i){
				
				//If there are more than the max, hide the rest of the list in a collapsable element
				if(i == view.max){
					text +=  '<span class="teaser">' +
							 '<a href="#" class="obvious-link teaser"> (and ' +
							 (view.list.length - i) + ' more...) </a>' +
							 '</span>' +
							 '<span class="collapsed">';
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
				if((i == (view.list.length - 1)) && collapsed)
					text += '</span>';
			});
			
			text += this.appendText;
			
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
		
		toggle: function(e){
			e.preventDefault();
			
			var view = this;
			
			var collapsed = this.$el.find(".collapsed");
			var expanded  = this.$el.find(".expanded");
			var container = this.$el;
			
			//Expand any currently-expanded items
			_.each(collapsed, function(element, i){
				$(element).removeClass("collapsed");
				$(element).addClass("expanded");
				
				if(i==0){
					$(container).removeClass("collapsed");
					$(container).addClass("expanded");
				}
			});
			
			//Collapse any currently-collapsed items
			_.each(expanded, function(element, i){
				$(element).removeClass("expanded");
				$(element).addClass("collapsed");
				
				if(i==0){
					$(container).removeClass("expanded");
					$(container).addClass("collapsed");
				}
			});
			
			return false;
		}
	});
	
	return ExpandCollapseListView;		
});
