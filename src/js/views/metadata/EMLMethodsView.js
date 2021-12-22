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
          * A small template to display each EMLMethodStep
          * @type {UnderscoreTemplate}
          */
          stepTemplate: _.template('<div class="step-container">\
                <h5>Step <span class="step-num"><%=num%></span></h5>\
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
            "keyup .method-step.new" : "addNewMethodStep",
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

              //Render the custom methods differently
              this.renderCustomMethods();
            }

            return this;
          },

      renderTextArea: function(textModel, data) {
        if (typeof data === 'undefined') return;

        var text,
            isNew;

        if (!textModel || typeof textModel === 'undefined') {
          text = '';
          isNew = true;
        } else {
          text = textModel.get('text').toString();
          isNew = false;
        }

        var el = $(document.createElement('textarea'))
          .attr('rows', '7')
          .attr('data-attribute', data.category)
          .attr('data-type', data.type)
          .addClass("method-step").addClass(data.classes || "")
          .text(text);

        if (isNew) {
          $(el).addClass('new')
        }

        return el;
      },

      /**
      * Renders a single EMLMethodStep model
      * @param step {[EMLMethodStep]}
      */
      renderMethodStep: function(step){
        try{

          let stepEl;

          if(step){
            //Render the step HTML
            stepEl = this.stepTemplate({
              text: step.get("description").toString(),
              num: this.model.getNonCustomSteps().indexOf(step)+1
            });
            //Attach the model to the element
            $(stepEl).find("textarea[data-attribute='methodStepDescription']").data({ methodStepModel: step });
          }
          else{
            //Render the step HTML
            stepEl = this.stepTemplate({
              text: "",
              num: this.model.getNonCustomSteps().length+1
            });
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
                view.$(view.customMethodsSelector).find("textarea,input").data({ methodStepModel: step })
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

      /*
       * Add a new method step
       */
      addNewMethodStep: function(){
        // Add new textareas as needed
        var newStep = this.$(".method-step.new"),
          nextStepNum = this.$(".method-step").length + 1,
          methodStepContainer =  $(document.createElement("div")).addClass("step-container");

        newStep.removeClass("new");

        //Put it all together
        newStep.parent(".step-container")
            .after(methodStepContainer.append(
                $(document.createElement("h5"))
                  .append("Step ", $(document.createElement("span")).addClass("step-num").text(nextStepNum)),
                  this.renderTextArea(null, {
                    category: "methodStepDescription",
                type: "description",
                classes: "new"
                  }),
                  $(document.createElement("i")).addClass("icon icon-remove remove hidden")
        ));
      },

      /*
       * Remove this method step
       */
      removeMethodStep: function(e){
        //Get the index of this step
        var stepEl = $(e.target).parent(".step-container").find(".method-step"),
          index  = this.$(".method-step").index(stepEl),
          view   = this;

        //Remove this step from the model
        this.model.set("methodStepDescription", _.without(this.model.get("methodStepDescription"), this.model.get("methodStepDescription")[index]));

        //If this was the last step to be removed, and the rest of the EMLMethods
        // model is empty, then remove the model from the parent EML model
        if( this.model.isEmpty() ){
          //Get the parent EML model
          var parentEML = this.model.get("parentModel");

          //Make sure this model type is EML211
          if( parentEML && parentEML.type == "EML" ){

            //If the methods are an array,
            if( Array.isArray(parentEML.get("methods")) ){
              //remove this EMLMethods model from the array
              parentEML.set( "methods", _.without(parentEML.get("methods"), this.model) );
            }
            else{
              //If the methods attribute is set to this EMLMethods model,
              // then just set it back to it's default
              if( parentEML.get("methods") == this.model )
                parentEML.set("methods", parentEML.defaults().methods);
            }
          }

        }


        //Remove the step elements from the page
        stepEl.parent(".step-container").slideUp("fast", function(){
          this.remove();

            //Bump down all the step numbers
            var stepNums = view.$(".step-num");

            for(var i=index; i < stepNums.length; i++){
              $(stepNums[i]).text(i+1);
            }
        });

      },

      previewRemove: function(e){
        $(e.target).parents(".step-container").toggleClass("remove-preview");
      }
    });

    return EMLMethodsView;
});
