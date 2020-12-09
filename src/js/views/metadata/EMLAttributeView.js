/* global define */
define(['underscore', 'jquery', 'backbone',
        'models/DataONEObject',
        'models/metadata/eml211/EMLAttribute',
        'models/metadata/eml211/EMLMeasurementScale',
        'views/metadata/EMLMeasurementScaleView',
        'text!templates/metadata/eml-attribute.html'],
    function(_, $, Backbone, DataONEObject, EMLAttribute, EMLMeasurementScale,
    		EMLMeasurementScaleView, EMLAttributeTemplate){

        /**
        * @class EMLAttributeView
        * @classdesc An EMLAttributeView displays the info about one attribute in a data object
        * @classcategory Views/Metadata
        * @extends Backbone.View
        */
        var EMLAttributeView = Backbone.View.extend(
          /** @lends EMLAttributeView.prototype */{

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
            	this.model = options.model || new EMLAttribute({xmlID: DataONEObject.generateId()});
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

            	var measurementScaleModel = this.model.get("measurementScale");

            	if( !this.model.get("measurementScale") ){
            		//Create a new EMLMeasurementScale model if this is a new attribute
            		measurementScaleModel = EMLMeasurementScale.getInstance();
            	}

            	//Save a reference to this EMLAttribute model
            	measurementScaleModel.set("parentModel", this.model);

            	//Create an EMLMeasurementScaleView for this attribute's measurement scale
            	var measurementScaleView = new EMLMeasurementScaleView({
            		model: measurementScaleModel,
            		parentView: this
            	});

            	//Render the EMLMeasurementScaleView and insert it into this view
            	measurementScaleView.render();
            	this.$(".measurement-scale-container").append(measurementScaleView.el);
            	this.measurementScaleView = measurementScaleView;

            	//Mark this view DOM as new if it is a new attribute
            	if(this.isNew){
            		this.$el.addClass("new");
            	}

            	//Save a reference to this model's id in the DOM
            	this.$el.attr("data-attribute-id", this.model.cid);
            },

            postRender: function(){
            	this.measurementScaleView.postRender();
            },

            updateModel: function(e){
            	if(!e) return;

              var emlModel = this.model.get("parentModel"),
                  tries = 0;

              while (emlModel.type !== "EML" && tries < 6){
                emlModel = emlModel.get("parentModel");
                tries++;
              }

            	var newValue = emlModel? emlModel.cleanXMLText( $(e.target).val() ) : $(e.target).val(),
            		category  = $(e.target).attr("data-category"),
            		currentValue = this.model.get(category);

              //If the new value is just a string of space characters, then set it to an empty string
              if( typeof newValue == "string" && !newValue.trim().length ){
                newValue = "";
              }

              // If the current value is an array...
            	if(Array.isArray(currentValue)){

                //Get the position of the updated DOM element
            		var index = this.$(".input[data-category='" + category + "']").index(e.target);

                //If there is at least one value already in the array...
            		if(currentValue.length > 0){
                  //If the new value is a falsey value, then don't' set it on the model
                  if( typeof newValue == "undefined" || newValue === false || newValue === null){

                    //Remove one element at this index instead of inserting an
                    // empty value
                    var newArray = currentValue.splice(index, 1);

                    //Set the new array on the model
                    this.model.set(category, newArray);
                  }
                  //Otherwise, insert the value in the array at the calculated index
                  else{
                    currentValue[index] = newValue;
                  }
                }
                // Otherwise if it's an empty array AND there is a value to set...
            		else if( typeof newValue != "undefined" && newValue !== false && newValue !== null){

                    //Push the new value into this array
                    currentValue.push(newValue);

                }

                //Trigger a change on this model attribute
            		this.model.trigger("change:" + category);

            	}
              //If the value is not an array...
            	else{

                //Check that there is an actual value here
                if( typeof newValue != "undefined" && newValue !== false && newValue !== null){

            		      this.model.set(category, newValue);

                }

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

	            	//If the measurement scale model is not valid
	            	if(view.model.get("measurementScale") && !view.model.get("measurementScale").isValid()){
	            		view.measurementScaleView.showValidation();
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
