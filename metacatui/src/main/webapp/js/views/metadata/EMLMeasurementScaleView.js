/* global define */
define(['underscore', 'jquery', 'backbone', 
        'models/DataONEObject',
        'models/metadata/eml211/EMLMeasurementScale',
        'text!templates/metadata/eml-measurement-scale.html'], 
    function(_, $, Backbone, DataONEObject, EMLMeasurementScale, EMLMeasurementScaleTemplate){
        
        /* 
            An EMLMeasurementScaleView displays the info about 
            one the measurement scale or category of an eml attribute
        */
        var EMLMeasurementScaleView = Backbone.View.extend({
                   	
            tagName: "div",
            
            className: "eml-measurement-scale",
            
            id: null,
            
            /* The HTML template for a measurement scale */
            template: _.template(EMLMeasurementScaleTemplate),
            
            /* Events this view listens to */
            events: {
            	"click .category" : "switchCategory"
            },
            
            initialize: function(options){
            	if(!options)
            		var options = {};
            	
            	this.isNew = (options.isNew === true) ? true : this.model? false : true;
            	this.model = options.model || new EMLMeasurementScale();
            },
            
            render: function(){
            	            	
            	//Render the template
            	var viewHTML = this.template(this.model.toJSON());
            	
            	if(this.isNew)
            		this.$el.addClass("new");
            	
            	//Insert the template HTML
            	this.$el.html(viewHTML);
            	        	
            },
            
            /* 
             * Rendering functions to only be performed after the 
             * attribute section is fully expanded by the user
             */
            postRender: function(){
            	//Change the category to the 
            	this.setCategory();
            	
            	this.renderUnitDropdown();
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
            
            setCategory: function(){
            	this.$(".category[value='" + this.model.get("measurementScale") + "']").prop("checked", true);
        		this.switchCategory();
            },
            
            switchCategory: function(){
            	//Switch the category in the view
            	var newCategory = this.$("input[name='measurementScale']:checked").val();
            	
            	this.$(".options").hide();
            	this.$("." + newCategory + "-options.options").show();
            
            	//Switch the model type, if needed
            	var thisCategory = this.model.get("measurementScale");
            	if(thisCategory != newCategory){
            		var newModel;
            		            		
            		if(typeof this.modelCache != "object"){
            			this.modelCache = {};
            		}
            		
            		//Get the model type from this view's cache
            		if(this.modelCache[thisCategory])
            			newModel = this.modelCache[thisCategory];
            		//Get a new model instance based on the type
            		else
            			newModel = EMLMeasurementScale.getInstance(newCategory);
            		
            		//save this model for later in case the user switches back
            		this.modelCache[thisCategory] = this.model;
            		
            		//save the new model
            		this.model = newModel;
            	}
            
            },
            
            renderUnitDropdown: function(){
            	if(this.$("select.units").length) return;
            	
            	//Create a dropdown menu
            	var select = $(document.createElement("select"))
            					.addClass("units")
            					.attr("data-category", "standardUnit"),
            		eml    = this.model.get("parentModel"),
            		i 	   = 0;
            	
            	//Find the EML model
            	while(eml.type != "EML" && i<6){
            		eml = eml.get("parentModel");
            		i++;
            	}
            	
            	//Get the units collection or wait until it has been fetched
            	var units = eml.get("units");
            	if(!units.length){
            		this.listenTo(units, "sync", this.createUnitDropdown);
            		return;
            	}
            	
            	//Create a default option
            	var defaultOption = $(document.createElement("option"))
										.text("Choose a standard unit");
				select.append(defaultOption);
				
            	//Create each unit option in the unit dropdown
            	units.each(function(unit){
            		var option = $(document.createElement("option"))
            						.val(unit.get("_name"))
            						.text(unit.get("_name").charAt(0).toUpperCase() + 
            								unit.get("_name").slice(1) + 
            								" (" + unit.get("description") + ")")
            						.data({ model: unit });
            		select.append(option);
            	}, this);
            	
            	//Add the dropdown to the page
            	this.$(".units-container").append(select);
            	
            	//Select the unit from the EML, if there is one
            	var currentUnit = this.model.get("unit");
            	if(currentUnit && currentUnit.standardUnit){
            		
            		//Get the dropdown for this measurement scale
            		var currentDropdown = this.$("." + this.model.get("measurementScale") + "-options select");
 
            		//Select the unit from the EML
            		currentDropdown.val(currentUnit.standardUnit);
            	}
            }
        });
        
        return EMLMeasurementScaleView;
});