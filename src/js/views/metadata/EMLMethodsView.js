/* global define */
define(['underscore', 'jquery', 'backbone', 'models/metadata/eml211/EMLMethods', 'models/metadata/eml/EMLMethodStep',
        'models/metadata/eml211/EMLText', 'models/metadata/eml/EMLSpecializedText',
        'text!templates/metadata/EMLMethods.html'],
    function(_, $, Backbone, EMLMethods, EMLMethodStep, EMLText, EMLSpecializedText, EMLMethodsTemplate){

        /**
        * @class EMLMethodsView
        * @classdesc The EMLMethods renders the content of an EMLMethods model
        * @classcategory Views/Metadata
        * @extends Backbone.View
        */
        var EMLMethodsView = Backbone.View.extend(
          /** @lends EMLMethodsView.prototype */{

          type: "EMLMethodsView",

          tagName: "div",

          className: "row-fluid eml-methods",

          stepsContainerSelector: "#eml-method-steps-container",

          editTemplate: _.template(EMLMethodsTemplate),

          /**
          * A small template to display each EMLMethodStep.
          * If you are going to extend this template for a theme, note that:
          * This template must keep the ".step-container" wrapper class.
          * This template must keep the textarea with the default data attributes.
          * The remove button must have a "remove" class
          * @type {UnderscoreTemplate}
          */
          stepTemplate: _.template('<div class="step-container">\
                <h5>Step <span class="step-num"><%=num%></span></h5>\
                <p class="notification" data-attribute="methodStepDescription"></p>\
                <textarea data-attribute="methodStepDescription"\
                      data-step-attribute="description"\
                      rows="7" class="method-step"><%=text%></textarea>\
                <i class="remove icon-remove"></i>\
              </div>'),

          /**
          * A reference to the EML211View that contains this EMLMethodsView.
          * @type {EML211View}
          */
          parentEMLView: null,

          /**
          * jQuery selector for the element that contains the Custom Methods
          * @type {string}
          */
          customMethodsSelector: ".custom-methods-container",

          initialize: function(options){
            options = options || {};

            this.isNew = options.isNew || (options.model? false : true);
            this.model = options.model || new EMLMethods();
            this.edit  = options.edit  || false;
            this.parentEMLView = options.parentEMLView || null;

            this.$el.data({ model: this.model });
          },

          events: {
            "change" : "updateModel",
            "keyup .method-step.new" : "renderNewMethodStep",
            "click .remove" : "removeMethodStep",
            "mouseover .remove" : "previewRemove",
            "mouseout .remove"  : "previewRemove"
          },

          render: function() {
            //Save the view and model on the element
            this.$el.data({
                model: this.model,
                view: this
              })
              .attr("data-category", "methods");

            if (this.edit) {

              this.$el.html(this.editTemplate({
                studyExtentDescription: this.model.get('studyExtentDescription'),
                samplingDescription: this.model.get('samplingDescription')
              }));

              //Render each EMLMethodStep
              let regularMethodSteps = this.model.getNonCustomSteps();
              regularMethodSteps.forEach(step => {
                this.renderMethodStep(step)
              });

              //Create a blank step for the user to make a new one
              this.renderMethodStep();

              //Populate all the step numbers
              this.updateMethodStepNums();

              //Render the custom methods differently
              this.renderCustomMethods();
            }

            return this;
          },

      /**
      * Renders a single EMLMethodStep model
      * @param step {[EMLMethodStep]}
      * @since 2.19.0
      */
      renderMethodStep: function(step){
        try{

          let stepEl;

          if(step){
            //Render the step HTML
            stepEl = $(this.stepTemplate({
              text: step.get("description").toString(),
              num: ""
            }));
            //Attach the model to the elements that will be interacted with
            stepEl.find("textarea[data-attribute='methodStepDescription'], .remove").data({ methodStepModel: step });
          }
          else{

            //Only one new method step should be displayed at the same time
            if( this.$(".method-step.new").length ){
              return;
            }

            //Render the step HTML
            stepEl = $(this.stepTemplate({
              text: "",
              num: ""
            }));

            stepEl.find("textarea[data-attribute='methodStepDescription']").addClass("new");
          }

          //Add the step to the page
          this.$(this.stepsContainerSelector).append(stepEl);

        }
        catch(e){
          console.error("Failed to render a method step: ", e);
        }
      },

      /**
      * Renders the inputs for the custom EML Methods that are configured in the {@link AppConfig}
      * If none are configured, nothing will be shown.
      * @since 2.19.0
      */
      renderCustomMethods: function(){

        //Get the custom EML Methods that are configured in the AppConfig
        let customMethodsOptions = MetacatUI.appModel.get("customEMLMethods");

        //If there is at least one custom Method configured, proceed with rendering it
        if( Array.isArray(customMethodsOptions) && customMethodsOptions.length ){

          let view = this;

          //Get the custom Methods template
          require(['text!templates/metadata/eml-custom-methods.html'], function(CustomMethodsTemplate){

            try{

              //Get the Methods from the EMLMethods model
              let allMethodSteps = view.model.get("methodSteps"),
              //Find the custom methods set on the model
                  allCustomMethods = allMethodSteps.filter(step => { return step.isCustom() }),
              //Start a literal object to send to the custom methods template
                  templateInfo = {};

              //Add each custom method model to the template info
              allCustomMethods.forEach(step => {
                templateInfo[step.get("customMethodID")] = step
              });

              //Insert the custom methods template into the page
              let customMethodsTemplate = _.template(CustomMethodsTemplate);
              view.$(view.customMethodsSelector).html(customMethodsTemplate(templateInfo));

              //Attach each custom method model to it's textarea or input
              allCustomMethods.forEach(step => {
                view.$(view.customMethodsSelector).find("[data-custom-method-id='" + step.get("customMethodID") + "']").data({ methodStepModel: step })
              });

              //If this is inside a parent EML View (most likely), trigger the event
              //that lets the parent view know that new editor components have been added to the page.
              if( view.parentEMLView ){
                view.parentEMLView.trigger("editorInputsAdded");
              }
            }
            catch(e){
              console.error("Couldn't show the custom EML Methods: ", e);
              return;
            }

          });

        }
      },

      updateModel: function(e){
        if(!e) return false;

        var updatedInput = $(e.target);

        //Get the attribute that was changed
        var changedAttr = updatedInput.attr("data-attribute");
        if(!changedAttr) return false;

        // Method Step Descriptions are ordered arrays, so update them with special rules
        if (changedAttr == "methodStepDescription") {

          // Get the EMLMethodStep model
          var methodStep = updatedInput.data("methodStepModel");

          //If there is already an EMLMethodStep model created, then update it
          if( methodStep ){
            let desc = methodStep.get("description");
            desc.setText(updatedInput.val());
          }
          else{
            //Create a new EMLMethodStep model
            var newMethodStep = this.model.addMethodStep();

            //Attach the model to the elements that will be interacted with
            updatedInput.parents(".step-container")
                        .find("textarea[data-attribute='methodStepDescription'], .remove")
                        .data({ methodStepModel: newMethodStep });

            //Update the model with the textarea value
            newMethodStep.get("description").setText(updatedInput.val());
          }

          // Trigger the change event manually because, without this, the change event
          // never fires.
          this.model.trigger('change:methodSteps');
        }
        //All other attributes on this model are updated differently
        else {

          //Get the EMLText model to update
          var textModelToUpdate = this.model.get(changedAttr);

          //Double-check that this is an EMLText model, then update it
          if( textModelToUpdate && typeof textModelToUpdate == "object" && textModelToUpdate.type == "EMLText"){
            textModelToUpdate.setText(updatedInput.val());
          }
          //If there's no value set on this attribute yet, create a new EMLText model
          else if(!textModelToUpdate){

            let textType;
            switch(changedAttr){
              case "studyExtentDescription":
                textType = "description";
                break;
              case "samplingDescription":
                textType = "samplingdescription";
                break;
            }

            if(!textType) return;

            //Create a new EMLText model
            var newTextModel = new EMLText({
              type: textType,
              parentModel: this.model
            });

            //Update the model with the textarea value
            newTextModel.setText(updatedInput.val());

            //Set the EMLText model on the EMLMethods model
            this.model.set(changedAttr, newTextModel);

          }

        }

        //Add this model to the parent EML model when it is valid
        if(this.model.isValid()){
          this.model.get("parentModel").set("methods", this.model);
        }

        //Show the remove button
        $(e.target).parents(".step-container").find(".remove").show();
      },

      /**
       * Renders a new empty method step input. Does not update the model at all.
       */
      renderNewMethodStep: function(){
        // Add new textareas as needed
        this.$(".method-step.new").removeClass("new");

        this.renderMethodStep();

        this.updateMethodStepNums();
      },

      /**
       * Remove this method step
       * @param {Event} e
       */
      removeMethodStep: function(e){

        try{
          //Get the EMLMethodStep
          var step = $(e.target).data("methodStepModel");

          //Exit if there is no EMLMethodStep
          if( !step ){
            return;
          }

          //Remove this step from the model
          this.model.removeMethodStep(step);

          //Remove the step elements from the page
          let view = this;
          $(e.target).parent(".step-container").slideUp("fast", function(){
            this.remove();

              //Bump down all the step numbers
              view.updateMethodStepNums();
          });
        }
        catch(e){
          console.error("Failed to remove the EML Method Step: ", e);
        }

      },

      /**
      * Updates the step number in the view for each step
      * @since 2.19.0
      */
      updateMethodStepNums: function(){
        //Update all the step numbers
        this.$(".step-num").each((i, numEl) => {
          numEl.textContent = i+1;
        })
      },

      /**
      * Shows validation errors that need to be fixed by the user
      */
      showValidation: function(){

        try{

          if( Object.keys(this.model.validationError).length ){
            if( this.model.validationError.methodSteps ){

              //A general error about all method steps will just be a string.
              //Apply the error styling to all the elements for the method steps
              if( typeof this.model.validationError.methodSteps == "string" ){
                this.$('.notification[data-attribute="methodStepDescription"]')
                    .text(this.model.validationError.methodSteps)
                    .addClass("error");
                this.$('[data-attribute="methodStepDescription"]:not([data-custom-method-id])').addClass("error");
              }
              //Validation errors that aren't strings are errors about specific
              // Custom EML Method Steps.
              else{
                _.mapObject(this.model.validationError.methodSteps, (errors, customMethodID) => {
                  this.$(`.notification[data-category="${customMethodID}"]`)
                      .text(errors.description)
                      .addClass("error");
                  this.$(`[data-custom-method-id="${customMethodID}"]`).addClass("error");
                });
              }
            }
          }

        }
        catch(e){
          console.warn("Failed to show Methods validation: ", e);
        }

      },

      previewRemove: function(e){
        $(e.target).parents(".step-container").toggleClass("remove-preview");
      }
    });

    return EMLMethodsView;
});
