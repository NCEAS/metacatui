/* global define */
define(['underscore', 'jquery', 'backbone', 'models/metadata/eml211/EMLMethods', 'models/metadata/eml211/EMLText',
        'text!templates/metadata/EMLMethods.html'],
    function(_, $, Backbone, EMLMethods, EMLText, EMLMethodsTemplate){

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

          editTemplate: _.template(EMLMethodsTemplate),

          initialize: function(options){
            options = options || {};

            this.isNew = options.isNew || (options.model? false : true);
            this.model = options.model || new EMLMethods();
            this.edit  = options.edit  || false;

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
                methodStepDescription: _(this.model.get('methodStepDescription')).map(function(step) { return step.toString()} ),
                studyExtentDescription: this.model.get('studyExtentDescription'),
                samplingDescription: this.model.get('samplingDescription')
              }));
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

      updateModel: function(e){
        if(!e) return false;

        var updatedInput = $(e.target);

        //Get the attribute that was changed
        var changedAttr = updatedInput.attr("data-attribute");
        if(!changedAttr) return false;

        // Get the EMLText type (parent element)
        var textType = updatedInput.attr("data-type");
        if (!textType) return false;

        //Get the current value
        var currentValue = this.model.get(changedAttr);

        // Method Step Descriptions are ordered arrays, so update them with special rules
        if (changedAttr == "methodStepDescription") {

          // Get the DOM position so we know which one to update
          var position = this.$(".method-step").index(updatedInput);

          // Stop if, for some odd reason, the position isn't found
          if (position === -1) {
            return;
          }

          //If there is already an EMLText model created, then update it
          if( typeof currentValue[position] == "object" && currentValue[position].type == "EMLText"){
            currentValue[position].setText(updatedInput.val());
          }
          else{
            //Create a new EMLText model
            var newTextModel = new EMLText({
              type: textType,
              parentModel: this.model
            });

            //Update the model with the textarea value
            newTextModel.setText(updatedInput.val());

            //Insert this new model into the correct position
            currentValue[position] = newTextModel;
          }

          // Trigger the change event manually because, without this, the change event
          // never fires.
          this.model.trigger('change:' + changedAttr);
        }
        //All other attributes on this model can be updated the same way
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
