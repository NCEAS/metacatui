/* global define */
define(['underscore', 'jquery', 'backbone',
        'models/DataONEObject',
        'models/metadata/eml211/EMLAttribute',
        'models/metadata/eml211/EMLAnnotation',
        'models/metadata/eml211/EMLMeasurementScale',
        'views/metadata/EMLAnnotationView',
        'views/metadata/EMLMeasurementScaleView',
        'views/metadata/EMLMeasurementTypeView',
        'text!templates/metadata/eml-attribute.html'],
		function(_, $, Backbone, DataONEObject, EMLAttribute, EMLAnnotation,
			EMLMeasurementScale, EMLAnnotationView, EMLMeasurementScaleView, EMLMeasurementTypeView, EMLAttributeTemplate){

        /**
        * @class EMLAttributeView
        * @classdesc An EMLAttributeView displays the info about one attribute in a data object
        * @classcategory Views/Metadata
        * @screenshot views/metadata/EMLAttributeView.png
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
              "change .input" : "updateModel",
              "change input" : "updateModel",
              "focusout" : "showValidation",
              "keyup .error" : "hideValidation",
              "click .radio" : "hideValidation",
              "click .remove-annotation" : "removeAnnotation",
              "change .eml-annotation input": "updateAnnotations"
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

              // Measurement Type
              var emlMeasurementTypeView = new EMLMeasurementTypeView({
                model: this.model
              });
              emlMeasurementTypeView.render();
              this.$(".measurement-type-container").append(emlMeasurementTypeView.el);

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
            },

          /**
           * addAnnotation
           *
           * Adds a new attribute-level annotation to the view and the backing EML
           * model.
           */
          addAnnotation: function (e) {
            console.log("EMLAttributeView.addAnnotation");

            var annotationListEl = this.$(".attribute-annotation-list");

            if (annotationListEl.length !== 1) {
              return;
            }

            var model = new EMLAnnotation();
            var view = new EMLAnnotationView({
              model: model,
              isNew: true
            });

            // Store a reference for handling valiation UI later on
            this.annotationViews.push(view);

            view.render();
            annotationListEl.append(view.el);

            this.model.get("annotation").push(model);

            // Ensure the entity has an `id` because annotations require it
            if (!this.model.get("xmlID")) {
              this.model.createID();
            }

            // Update
            this.model.trickleUpChange();
          },

          /**
           * removeAnnotation
           *
           * Click event handler that removes the view and model corresponding
           * to the annotation the user clicked.
           *
           * @param {MouseEvent} e - Event handler
           */
          removeAnnotation: function (e) {
            // Don't allow removal of the last view
            if ($(".attribute-annotation-list .eml-annotation").length <= 1) {
              return;
            }

            var annoEl = $(e.target).parents(".eml-annotation").first();

            if (annoEl.length === 0) {
              return;
            }

            var index = $(".attribute-annotation-list .eml-annotation").index(annoEl);

            if (index < 0) {
              return;
            }

            // Remove view
            var annotationViews = $(".attribute-annotation-list .eml-annotation");

            if (annotationViews.length < index) {
              return;
            }

            // Don't remove view if it's a new view
            if ($(annotationViews[index]).hasClass("new")) {
              return;
            }

            annotationViews[index].remove();

            // Remove from view references
            if (this.annotationViews.length >= index) {
              this.annotationViews.splice(index, 1);
            }

            // Remove model
            var current = this.model.get("annotation");
            current.splice(index, 1);
            this.model.set("annotation", current);

            // Update
            this.model.trickleUpChange();
          },

          /**
           * updateAnnotations
           *
           * Event handler responsible for managing the 'new' class on
           * AnnotationViews which is used to decide when to add a new, blank
           * view.
           *
           * @param {Event} e - Event handler
           */
          updateAnnotations: function (e) {
            console.log("EMLAttributeView.updateAnnotations");

            var annoEl = $(e.target).parents(".eml-annotation").first();

            if (annoEl.length === 0) {
              return;
            }

            var index = $(".attribute-annotation-list .eml-annotation").index(annoEl);

            if (index < 0) {
              return;
            }

            // Find the view that triggered the event
            var annotationViews = $(".attribute-annotation-list .eml-annotation");

            if (annotationViews.length < index) {
              return;
            }

            // Stop now if we aren't updating an annotation that was previously
            // new (blank)
            if (!$(annotationViews[index]).hasClass("new")) {
              return;
            }

            $(annotationViews[index]).removeClass("new");
            this.addAnnotation();
          },
        });

        return EMLAttributeView;
});
