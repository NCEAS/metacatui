/* global define */
define(['underscore', 'jquery', 'backbone', 
        'models/DataONEObject',
        'models/metadata/eml211/EMLAttribute',
        'models/metadata/eml211/EMLMeasurementScale',
        'views/metadata/EMLMeasurementScaleView',
        'text!templates/metadata/eml-attribute.html'], 
    function(_, $, Backbone, DataONEObject, EMLAttribute, EMLMeasurementScale,
    		EMLMeasurementScaleView, EMLAttributeTemplate){
        
        /* 
            An EMLAttributeView displays the info about one attribute in a data object
        */
        var EMLAttributeView = Backbone.View.extend({
           
            tagName: "div",
            
            className: "eml-attribute",
            
            id: null,
            
            /* The HTML template for an attribute */
            template: _.template(EMLAttributeTemplate),
            
            /* Events this view listens to */
            events: {
            	"change .input": "updateModel",
            	"focusout" 	   : "showValidation",
            	"keyup .error" : "hideValidation",
            	"click .radio" : "hideValidation"
            },
            
            initialize: function(options){
            	if(!options)
            		var options = {};
            	
            	this.isNew = (options.isNew == true) ? true : options.model? false : true;
            	this.model = options.model || new EMLAttribute();
            },
            
            render: function(){
            	
            	var templateInfo = {
            			title: this.model.get("attributeName")? this.model.get("attributeName") : "Add New Attribute"
            	}
            	
            	_.extend(templateInfo, this.model.toJSON());
            	
            	//Render the template
            	var viewHTML = this.template(templateInfo);
            	
            	//Insert the template HTML
            	this.$el.html(viewHTML);
            	
            	//Add the measurement scale view
            	if(this.isNew){
            		var measurementScaleModel = EMLMeasurementScale.getInstance();
            		measurementScaleModel.set("parentModel", this.model);
            		this.model.set("measurementScale", measurementScaleModel);
            		
            		this.$el.addClass("new");
            	}
            	else
            		measurementScaleModel = this.model.get("measurementScale");
            	
            	var measurementScaleView = new EMLMeasurementScaleView({
            		model: measurementScaleModel
            	});
            	measurementScaleView.render();
            	this.$(".measurement-scale-container").append(measurementScaleView.el);
            	this.measurementScaleView = measurementScaleView;
            	
            },
            
            postRender: function(){
            	this.measurementScaleView.postRender();
            },

            updateModel: function(e){
            	if(!e) return;
            	
            	var newValue = $(e.target).val(),
            		category  = $(e.target).attr("data-category"),
            		currentValue = this.model.get(category);
            	
            	if(Array.isArray(currentValue)){
            		var index = this.$(".input[data-category='" + category + "']").index(e.target);
            		
            		if(currentValue.length > 0)
            			currentValue.split(index, 0, newValue);
            		else
            			currentValue.push(newValue);
            		
            		this.model.trigger("change:" + category);
            	}
            	else{
            		this.model.set(category, newValue);
            	}
            },
            
            showValidation: function(){
            	
            	var view = this;
            	
            	setTimeout(function(){
					//If the user focused on another element in this view, don't do anything
					if( _.contains($(document.activeElement).parents(), view.el) )
						return;
					
					//Reset the error messages and styling
					view.$el.removeClass("error");
					view.$(".error").removeClass("error");
					view.$(".notification").text("");
	        		
	            	if(!view.model.isValid()){
	            		
	            		var errors = view.model.validationError;
	            		
	            		_.each(Object.keys(errors), function(attr){
	            			
	            			view.$(".input[data-category='" + attr + "']").addClass("error");
	            			view.$(".radio [data-category='" + attr + "']").addClass("error");
	            			view.$("[data-category='" + attr + "'] .notification").text(errors[attr]).addClass("error");
	            			
	            		}, view);
	            		
	            		view.$el.addClass("error");
	            	}
	            	else if(!view.model.get("measurementScale")){
	            		
	            	}

            	}, 200);

            },
            
            hideValidation: function(e){
            	var input 	 = $(e.target),
            		category = input.attr("data-category");
            	
            	input.removeClass("error");
            	
            	this.$("[data-category='" + category + "'] .notification").removeClass("error").empty();
            }
        });
        
        return EMLAttributeView;
});