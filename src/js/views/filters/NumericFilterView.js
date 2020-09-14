/*global define */
define(['jquery', 'underscore', 'backbone',
        'models/filters/NumericFilter',
        'views/filters/FilterView',
        'text!templates/filters/numericFilter.html'],
  function($, _, Backbone, NumericFilter, FilterView, Template) {
  'use strict';

  // Render a view of a single NumericFilter model
  var NumericFilterView = FilterView.extend({

    // @type {NumericFilter} - A NumericFilter model to be rendered in this view
    model: null,

    className: "filter numeric",

    template: _.template(Template),

    events: {
      "change input.range" : "updateRange",
      "change input.single-number" : "updateModel",
      "click .btn"   : "handleChange",
      // "keypress input.single-number" : "handleTyping"
    },
    
    /**    
     * For single input (non-range) models, whether or not to show the search
     * button    
     * @type {boolean}
     */     
    showButton: true,

    initialize: function (options) {

      if( !options || typeof options != "object" ){
        var options = {};
      }

      this.model = options.model || new NumericFilter();
      
      if(typeof options.showButton === "boolean"){
        this.showButton = options.showButton;
      }

    },

    render: function () {

      this.$el.html(
        this.template(
          _.extend(this.model.toJSON(), { showButton:this.showButton })
        )
      );

      //If a range of values is allowed, show the filter as a numeric slider
      if( this.model.get("range") && (this.model.get("rangeMin") || this.model.get("rangeMax")) ){

        var view = this;

        //jQueryUI slider
        this.$('.slider').slider({
            range: true,
            disabled: false,
            min: this.model.get("rangeMin"),  //sets the minimum on the UI slider on initialization
            max: this.model.get("rangeMax"),   //sets the maximum on the UI slider on initialization
            values: [ this.model.get("min"), this.model.get("max") ], //where the left and right slider handles are
            stop: function( event, ui ) {

              // When the slider is changed, update the input values
              view.$('input.min').val(ui.values[0]);
              view.$('input.max').val(ui.values[1]);

              //Also update the DateFilter model
              view.model.set('min', ui.values[0]);
              view.model.set('max', ui.values[1]);

            }
          });

          //When the rangeReset event is triggered, reset the slider
          this.listenTo(view.model, "rangeReset", this.resetSlider);

      }
      else {
        // If a range of values is not allowed, show the filter as a single number input
        var numberInput = this.$("input.single-number");
        
        if(numberInput && numberInput.length){
          //If a minimum number is set on the model defaults
          if(this.model.get("min") !== null){
            //Set the minimum value on the number input
            numberInput.attr("value", this.model.get("min"));
            this.singleValueType = "min"
          //If a maximum number is set on the model defaults
          } else if(this.model.get("max") !== null){
            //Set the minimum value on the number input
            numberInput.attr("value", this.model.get("max"));
            this.singleValueType = "max"
          } else if (this.model.get("values")) {
            if(this.model.get("values").length){
              numberInput.attr("value", this.model.get("values")[0]);
              this.singleValueType = "value"
            }
          }
      }
        //Set a step attribute if there is one set on the model
        if( this.model.get("step") ){
          numberInput.attr("step", this.model.get("step"));
        }
      }
    },

    /*
    * Updates the value set on the Filter Model associated with this view.
    * The filter value is grabbed from the input element in this view,
    * and then set on either the min, max, or value attribute, depending
    * on the single value type.
    */
    updateModel: function(){
      //Get the value of the number input
      var value = this.$("input.single-number").val(),
          value = parseInt(value);
          
      if(["min", "max"].includes(this.singleValueType)){
        this.model.set(this.singleValueType, value)
      } else {
        this.model.set("values", [value])
      }
    },

    /*
    * Gets the min and max years from the number inputs and updates the DateFilter
    *  model and the year UI slider.
    * @param {Event} e - The event that triggered this callback function
    */
    updateRange : function(e) {

      //Get the min and max values from the number inputs
      var minVal = parseInt(this.$('input.min').val());
      var maxVal = parseInt(this.$('input.max').val());

      //Update the DateFilter model to match what is in the text inputs
      this.model.set('min', parseInt(minVal));
      this.model.set('max', parseInt(maxVal));

      // Update the UI slider to match the new min and max.
      // Can only update the slider values if the slider has been initialized.
      // There's no slider if there is a min & max on the model, but not maxRange
      // and no minRange.
      if(this.$( ".slider" ).slider("instance")){
        this.$( ".slider" ).slider( "option", "values", [ minVal, maxVal ] );
      }

      //Send this event to Google Analytics
      if(MetacatUI.appModel.get("googleAnalyticsKey") && (typeof ga !== "undefined")){
        ga("send", "event", "portal search", "filter, Data Year", minVal + " to " + maxVal);
      }

    },

    /*
    * Resets the slider to the default values
    */
    resetSlider: function(){

      //Set the min and max values on the slider widget
      this.$( ".slider" ).slider( "option", "values", [ this.model.get("rangeMin"), this.model.get("rangeMax") ] );

      //Reset the min and max values
      this.$('input.min').val( this.model.get("rangeMin") );
      this.$('input.max').val( this.model.get("rangeMax") );

    }

  });
  return NumericFilterView;
});
