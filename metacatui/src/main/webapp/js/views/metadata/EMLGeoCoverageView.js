/* global define */
define(['underscore', 'jquery', 'backbone', 
        'models/metadata/eml211/EMLGeoCoverage', 
        'text!templates/metadata/EMLGeoCoverage.html'], 
    function(_, $, Backbone, EMLGeoCoverage, EMLGeoCoverageTemplate){
        
        /* 
            The EMLGeoCoverage renders the content of an EMLGeoCoverage model
        */
        var EMLGeoCoverageView = Backbone.View.extend({
        	
        	type: "EMLGeoCoverageView",
        	
        	tagName: "div",
        	
        	className: "row-fluid eml-geocoverage",
        	
        	editTemplate: _.template(EMLGeoCoverageTemplate),
        	
        	initialize: function(options){
        		if(!options)
        			var options = {};
        		
        		this.isNew = options.isNew || (options.model? false : true);
        		this.model = options.model || new EMLGeoCoverage();
        		this.edit  = options.edit  || false;
        		
        	},
        	
        	events: {
        		"change"   : "updateModel",
        		"focusout .input-container" : "showRequired",
        		"keyup textarea.error" : "updateError",
        		"click .coord.error"   : "updateError",
        		"mouseover .remove"    : "toggleRemoveClass",
        		"mouseout  .remove"    : "toggleRemoveClass"
        	},
        	
        	render: function(e) {
        		//Save the view and model on the element
        		this.$el.data({
        			model: this.model,
        			view: this
        		});
        		
        		this.$el.html(this.editTemplate({
        			edit: this.edit,
        			model: this.model.toJSON()
        		}));
        		
        		if(this.isNew){
        			this.$el.addClass("new");
        		}
        		
        		return this;
        	},
        	
        	/*
        	 * Updates the model 
        	 */
        	updateModel: function(e){
        		if(!e) return false;
        		
        		e.preventDefault();
        		
        		//Get the attribute and value
        		var element = $(e.target),
        			value = element.val(),
        			attribute = element.attr("data-attribute");
        		
        		//Get the attribute that was changed
        		if(!attribute) return false;
        		
        		this.model.set(attribute, value);        		
        	},
        	
        	/*
        	 * If the model isn't valid, show verification messages
        	 */
        	showRequired: function(e){
        		
        		var view = this;
        		
        		setTimeout(function(){
        		
        			var geoCoverage = $(document.activeElement).parents(".eml-geocoverage");
        			
	        		if( geoCoverage.length && geoCoverage[0] == view.el )
	        			return;
	        		
	        		//Check if the model is valid
	        		var north = view.$(".north").val(),
	        			west  = view.$(".west").val(),
	        			south = view.$(".south").val(),
	        			east  = view.$(".east").val(),
	        			description = view.$(".description").val(),
	        			hasError = false;
	        		
	        		//Find any incomplete coordinates
	        		if(view.isNew && !north && !south && !east && !west && !description)
	        			hasError = false;
	        		else{
		        		if(north && !west){
		        			view.$(".west").addClass("error");
		        			hasError = true;
		        		}
		        		else if(west && !north){
		        			view.$(".north").addClass("error");
		        			hasError = true;
		        		}
		        		else if(south && !east){
		        			view.$(".east").addClass("error");
		        			hasError = true;
		        		}
		        		else if(east && !south){
		        			view.$(".south").addClass("error");
		        			hasError = true;
		        		}
		        		else if(north && west){
		        			view.$(".north, .west").removeClass("error");
		        		}
		        		else if(south && east){
		        			view.$(".south, .east").removeClass("error");
		        		}
		        		else if(!north && !west && !south && !east){
		        			view.$(".north, .west").addClass("error");
		        			hasError = true;
		        		}
		        		
		        		//Check if there isn't a geographic description
		        		if( !description ){
		        			view.$(".description").addClass("error");
		        			hasError = true;
		        		}
		        		else{
		        			view.$(".description").removeClass("error");
		        		}
	        		}
	        		
	        		if(hasError){
	        			var errorMsg = view.model.validate();
	        			view.$(".notification.error").text(errorMsg);
	        			view.$el.addClass("error");
	        		}
	        		else{
	        			view.$("input.error, textarea.error").removeClass("error");
	        			view.$(".notification.error").text("");
	        			view.$el.removeClass("error");
	        		}
        		}, 1);
        	},
        	
        	
        	/*
        	 * When the user is typing in an input with an error, check if they've fixed the error
        	 */
        	updateError : function(e){
        		var input = $(e.target);
        		
        		if(input.val()){
        			input.removeClass("error");
        			this.$(".notification.error").text("");
        		}
        	},
        	
        	/*
        	 * Highlight what will be removed when the remove icon is hovered over
        	 */
        	toggleRemoveClass: function(){
        		this.$el.toggleClass("show-remove");
        	},
        	
        	/*
        	 * Unmarks this view as new
        	 */
        	notNew: function(){
        		this.$el.removeClass("new");
        	}
        });
        
        return EMLGeoCoverageView;
    });