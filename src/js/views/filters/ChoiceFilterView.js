/*global define */
define(['jquery', 'underscore', 'backbone',
        'models/filters/ChoiceFilter',
        'views/filters/FilterView',
        'text!templates/filters/choiceFilter.html'],
  function($, _, Backbone, ChoiceFilter, FilterView, Template) {
  'use strict';

  /**
  * @class ChoiceFilterView
  * @classdesc Render a view of a single ChoiceFilter model
  * @classcategory Views/Filters
  * @extends FilterView
  */
  var ChoiceFilterView = FilterView.extend(
    /** @lends ChoiceFilterView.prototype */{

    /**
    * A ChoiceFilter model to be rendered in this view 
    * @type {ChoiceFilter} */
    model: null,

    /**
     * @inheritdoc
     */
    modelClass: ChoiceFilter,

    className: "filter choice",

    template: _.template(Template),

    /**
     * The class to add to the element that a user should click to remove a choice
     * value and label when this view is in "uiEditor" mode
     * @since 2.15.0
     * @type {string}
     */
    removeChoiceClass: "remove-choice",

    /**
     * A function that creates and returns the Backbone events object.
     * @return {Object} Returns a Backbone events object
     */
    events: function () {
      try {
        var events = FilterView.prototype.events.call(this);
        events["change select"] = "handleChange";
        var removeClass = "." + this.removeChoiceClass;
        events["click " + removeClass] = "removeChoice";
        events["mouseover " + removeClass] = "previewRemoveChoice";
        events["mouseout " + removeClass] = "previewRemoveChoice";
        return events
      }
      catch (error) {
        console.log( 'There was an error creating the events object for a ChoiceFilterView' +
          ' Error details: ' + error );
      }
    },

    render: function () {

      var view = this;
      
      // Renders the template and inserts the FilterEditorView if the mode is uiBuilder
      FilterView.prototype.render.call(this)

      var placeHolderText = this.model.get("placeholder");
      var select = this.$("select");
      
      if(this.mode === "uiBuilder"){

        // If this is the filter view where the user can edit the filter UI options,
        // like the label, placeholder text, and choices, then render the inputs
        // for these options.

        var placeholderInput = $('<input class="' + this.uiInputClass +
          ' placeholder" data-category="placeholder" value="' +
          (placeHolderText ? placeHolderText : '') +'" />');
        // Replace the select element with the placeholder text element
        placeholderInput.insertAfter(select);

        // Create the interface for a user to edit the value-label choice options
        var choicesEditor = this.createChoicesEditor();
        view.$el.append(choicesEditor);
        

      } else {
        // For regular search filter views, or the edit filter view, render the dropdown
        // interface

        //Create the placeholder text for the dropdown menu
        
        //If placeholder text is already provided in the model, use it
        //If not, create placeholder text using the model label
        if (!placeHolderText){

          //If the label starts with a vowel, use "an"
          var vowels = ["a", "e", "i", "o", "u"];
          if( _.contains(vowels, this.model.get("label").toLowerCase().charAt(0)) ){
            placeHolderText = "Choose an " + this.model.get("label");
          }
          //Otherwise use "a"
          else{
            placeHolderText = "Choose a " + this.model.get("label");
          }
        }

        //Create the default option
        var defaultOption = $(document.createElement("option"))
                              .attr("value", "")
                              .text( placeHolderText );
        select.append(defaultOption);

        //Create an option element for each choice listen in the model
        _.each( this.model.get("choices"), function(choice){
          select.append( $(document.createElement("option"))
                          .attr("value", choice.value)
                          .text(choice.label) );
        }, this );

        this.listenTo(this.model, "change:values", this.updateChoices);
      }
      

    },

    /**
     * Create the set of inputs where a use can select label-value pairs for the regular
     * choice filter view
     * @since 2.15.0
     */
    createChoicesEditor: function(){

      try {
        this.choicesEditor = $("<div class='choices-editor'></div>");
        var choicesEditorText = $("<p class='subtle'>Allow people to select from the following search terms</p>");
        var labelContainer = $("<div class='choice-editor'></div>");

        this.choicesEditor.append(choicesEditorText, labelContainer)

        labelContainer.append("<p class='subtle ui-options-editor-label'>Enter the text to display</p>")
        labelContainer.append("<p class='subtle ui-options-editor-label'>Enter the text to search for</p>")


        _.each(this.model.get("choices"), function (choice) {
          var choiceEditorEl = this.createChoiceEditor(choice);
          this.choicesEditor.append(choiceEditorEl)
        }, this);

        // Create a blank choice at the end
        this.addEmptyChoiceEditor();

        return this.choicesEditor
      }
      catch (error) {
        console.log( 'There was an error creating choices editor in a ChoiceFilterView' +
          ' Error details: ' + error );
      }
      

    },

    /**
     * Create a row where a use can input a value and label for a single choice.
     */
    createChoiceEditor: function(choice){
      try {
        if (!choice) {
          return
        }

        // Create the choice container
        var choiceContainer = $("<div class='choice-editor'></div>");
        // Create inputs for "value" and "label", insert them in the container
        for (const [attrName, attrValue] of Object.entries(choice)) {
          var inputEl = $('<input>').attr({
            class: 'choice-input choice-' + attrName,
            value: attrValue
          })
          choiceContainer.append(inputEl);
        }

        // Create the remove "X" button. Save references to the parent choice container and
        // the choice element in the model, so that we can remove from the view and model
        // when the button is clicked
        var removeButton = $(
          "<i class='icon icon-remove " +
          this.removeChoiceClass +
          "' title='Remove this choice'></i>"
        ).data({
          choiceEl: choiceContainer,
          choiceObj: choice
        });

        // Insert the remove button into the choice container
        choiceContainer.append(removeButton);
        return choiceContainer
      }
      catch (error) {
        console.log( 'There was an error  ChoiceFilterView' +
          ' Error details: ' + error );
      }
      
    },

    /**
     * Create an empty choice editor row
     * @since 2.15.0
     */
    addEmptyChoiceEditor: function () {
      try {
        var view = this;
        var choice = {
          label: "",
          value: ""
        }
        this.model.get("choices").push(choice)
        var choiceEditorEl = this.createChoiceEditor(choice);
        this.choicesEditor.append(choiceEditorEl)

        // Don't let users remove the new choice entry fields until some text has been entered
        var removeButton = choiceEditorEl.find("." + this.removeChoiceClass);
        // The inputs for value and label
        var inputs = choiceEditorEl.find("input");
        removeButton.hide();
        var onInputChange = function () {
          removeButton.show();
          view.addEmptyChoiceEditor();
          inputs.off("input", onInputChange);
        }
        inputs.on("input", onInputChange);
      }
      catch (error) {
        console.log('There was an error creating a choice editor in a ChoiceFilterView' +
          ' Error details: ' + error);
      }
    },

    /**
     * Indicate to the user that the choice value and label inputs will be removed when
     * they hover over the remove button.
     * @since 2.15.0
     */
    previewRemoveChoice: function (e) {
      try {

        var normalOpacity = 1.0,
            previewOpacity = 0.2,
            speed = 120;

        var removeEl = $(e.target);
        var subElements = removeEl.data("choiceEl").children().not(removeEl);

        if(e.type === "mouseover"){
          subElements.fadeTo(speed, previewOpacity)
          $(removeEl).fadeTo(speed, normalOpacity)
        }
        if(e.type === "mouseout"){
          subElements.fadeTo(speed, normalOpacity)
          $(removeEl).fadeTo(speed, previewOpacity)
        }

      } catch (error) {
        console.log("Error showing a preview of the removal of a Choice editor in a " +
          "Choice Filter View, details: " + error);
      }
    },

    /**
     * Remove a choice editor row and the corresponding label-value pair from the choice
     * Filter Model (TODO)
     * @since 2.15.0
     * @param {Object} e The click event object
     */
    removeChoice: function(e){
      try {
        var choice = $(e.target).data("choiceEl");

        // See how many choice elements there are (subtract one because the label elements
        // are within a choice-editor element)
        var numChoices = this.$el.find(".choice-editor").length - 1

        // Don't allow removing the last choice element. Empty the last element and hide the
        // remove button instead.
        if (numChoices <= 1) {
          // TODO: update the model as well
          choice.find("input").val('')
          return
        }

        // Remove the choice editor element from the view
        choice.remove()
        // TODO: remove the choice from the model
        // this.model....
      }
      catch (error) {
        console.log( 'There was an error removing a choice editor in the ChoiceFilterView' +
          ' Error details: ' + error );
      }
      
    },

    /**
    * Updates the view when the filter input is updated
    *
    * @param {Event} - The DOM Event that occured on the filter view input element
    */
    handleChange: function(){

      this.updateModel();

      //Change the select menu back to the default option
      this.$("select").val("");

    },

    /**
    * Updates the value set on the ChoiceFilter Model associated with this view.
    * The filter value is grabbed from the select element in this view.
    *
    */
    updateModel: function(){

      //Get the new value from the text input
      var newValue = this.$("select").val();

      //Get the current values array from the model
      var currentValue = this.model.get("values");

      //If the ChoiceFilter allows multiple values to be added,
      // add the new choice to the values array
      if( this.model.get("chooseMultiple") ){

        //Duplicate the current values array
        var newValuesArray = currentValue.slice(0);

        //Add the new value to the array
        newValuesArray.push(newValue);

        //Set the new values array on the model
        this.model.set("values", newValuesArray);

      }
      //If multiple choices are not allowed,
      else{

        //Replace the first index of the array with the new value
        var newValuesArray = currentValue.slice(0);
        newValuesArray[0] = newValue;

        //Set the new values array on the model
        this.model.set("values", newValuesArray);
      }
    },

    /**
    * Update the choices in the select dropdown menu based on which choices are
    * currently selected
    */
    updateChoices: function(){

      //Enable all the choices
      this.$("option").prop("disabled", false);

      //Get the currently-selected choices
      var selectedChoices = this.model.get("values");

      _.each(selectedChoices, function(choice){

        //Find each choice in the dropdown menu and disable it
        this.$("option[value='" + choice + "']").prop("disabled", true);

      }, this);

    }

  });
  return ChoiceFilterView;
});
