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

      //Create the placeholder text for the dropdown menu
      var placeHolderText;

      //If placeholder text is already provided in the model, use it
      if( this.model.get("placeholder") ){
        placeHolderText = this.model.get("placeholder");
      }
      //If not, create placeholder text using the model label
      else{

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

      //When the ChoiceFilter is changed, update the choice list in the UI
      this.listenTo(this.model, "change:values", this.updateChoices);
      this.listenTo(this.model, "remove", this.updateChoices);

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
