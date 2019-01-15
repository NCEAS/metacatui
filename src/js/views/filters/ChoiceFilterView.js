/*global define */
define(['jquery', 'underscore', 'backbone',
        'models/filters/ChoiceFilter',
        'views/filters/FilterView',
        'text!templates/filters/choiceFilter.html'],
  function($, _, Backbone, ChoiceFilter, FilterView, Template) {
  'use strict';

  // Render a view of a single ChoiceFilter model
  var ChoiceFilterView = FilterView.extend({

    // @type {ChoiceFilter} - A ChoiceFilter model to be rendered in this view
    model: null,

    className: "filter choice",

    template: _.template(Template),

    events: {
      "change" : "handleChange"
    },

    initialize: function (options) {

      if( !options || typeof options != "object" ){
        var options = {};
      }

      this.model = options.model || new ChoiceFilter();

    },

    render: function () {
      this.$el.html( this.template( this.model.toJSON() ) );

      var select = this.$("select");

      //Create the default option
      var defaultOption = $(document.createElement("option"))
                            .attr("value", "")
                            .text( this.model.get("placeholder") || "Choose a " + this.model.get("label") );
      select.append(defaultOption);

      //Create an option element for each choice listen in the model
      _.each( this.model.get("choices"), function(choice){

        select.append( $(document.createElement("option"))
                         .attr("value", choice.value)
                         .text(choice.label) );

      }, this );

      this.listenTo(this.model, "change:values", this.updateChoices);

    },

    /*
    * Updates the view when the filter input is updated
    *
    * @param {Event} - The DOM Event that occured on the filter view input element
    */
    handleChange: function(){

      this.updateModel();

      //Change the select menu back to the default option
      this.$("select").val("");

    },

    /*
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

    /*
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
