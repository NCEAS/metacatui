/* global define */
define(['underscore', 'jquery', 'backbone', 
        'models/DataONEObject',
        'models/metadata/eml211/EMLAttribute',
        'views/metadata/EMLMeasurementScaleView',
        'text!templates/metadata/eml-attribute.html'], 
    function(_, $, Backbone, DataONEObject, EMLAttribute, EMLMeasurementScaleView, EMLAttributeTemplate){
        
        /* 
            An EMLAttributeView displays the info about one attribute in a data object
        */
        var EMLAttributeView = Backbone.View.extend({
           
            tagName: "div",
            
            className: "eml-attribute accordion-group",
            
            id: null,
            
            /* The HTML template for an attribute */
            template: _.template(EMLAttributeTemplate),
            
            /* Events this view listens to */
            events: {
            	"change"                   : "updateModel",
            	"click .accordion-toggle"  : "toggleAttribute",
            	"focusout .accordion-body" : "showValidation"
            },
            
            initialize: function(options){
            	if(!options)
            		var options = {};
            	
            	this.isNew = (options.isNew === true) ? true : this.model? false : true;
            	this.model = options.model || new EMLAttribute();
            },
            
            render: function(){
            	
            	//Send unique ids to the template for the accordion
            	var templateInfo = {
            			attrId:  this.model.cid,
            			title:   this.model.get("attributeName")? 
            					this.model.get("attributeName") : "Add New Attribute"
            	}
            	
            	_.extend(templateInfo, this.model.toJSON());
            	
            	//Render the template
            	var viewHTML = this.template(templateInfo);
            	
            	//Insert the template HTML
            	this.$el.html(viewHTML);
            	
            	//Add the measurement scale view
            	var measurementScaleView = new EMLMeasurementScaleView({
            		model: this.model.get("measurementScale")
            	});
            	measurementScaleView.render();
            	this.$(".measurement-scale-container").append(measurementScaleView.el);
            	this.measurementScaleView = measurementScaleView;
            	
            	if(this.isNew)
            		this.$el.addClass("new");
            	
            	this.listenTo(this.model, "change:attributeName", this.updateHeader);
            },
            
            updateHeader: function(){
            	var header = this.model.get("attributeName");
            	
            	if(header)
            		this.$(".heading").text(header);
            	else
            		this.$(".heading").text("Incomplete Attribute");
            },
            
            updateModel: function(e){
            	if(!e) return;
            	
            	var newValue = $(e.target).val(),
            		category  = $(e.target).attr("data-category"),
            		currentValue = this.model.get(category);
            	
            	if(Array.isArray(currentValue)){
            		var index = this.$(".input[data-category='" + category + "']").index(e.target);
            		
            		currentValue.split(index, 0, newValue);
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
	            			view.$("[data-category='" + attr + "'] .notification").text(errors[attr]).addClass("error");
	            			
	            		}, view);
	            		
	            		view.$el.addClass("error");
	            	}
					
					
            	}, 200);


            },
            
            toggleAttribute: function(e){
            	if(e)
            		e.preventDefault();
            	
            	this.$(".accordion-body").slideToggle();
            	
            	if(this.$(".eml-measurement-scale").is(":visible")){
            		this.measurementScaleView.postRender();            		
            	}
            },
            
            collapse: function(){
            	this.$(".accordion-body").hide();
            }
        });
        
        return EMLAttributeView;
});