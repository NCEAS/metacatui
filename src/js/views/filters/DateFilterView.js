/*global define */
define(['jquery', 'underscore', 'backbone',
        'models/filters/DateFilter',
        'views/filters/FilterView',
        'text!templates/filters/dateFilter.html'],
  function($, _, Backbone, DateFilter, FilterView, Template) {
  'use strict';

  /**
  * @class DateFilterView
  * @classdesc Render a view of a single DateFilter model
  * @classcategory Views/Filters
  * @extends FilterView
  */
  var DateFilterView = FilterView.extend(
    /** @lends DateFilterView.prototype */{

    /**
    * A DateFilter model to be rendered in this view
    * @type {DateFilter} */
    model: null,

    className: "filter date",

    template: _.template(Template),

    events: {
      "change input" : "updateYearRange"
    },

    initialize: function (options) {

      if( !options || typeof options != "object" ){
        var options = {};
      }

      this.model = options.model || new DateFilter();

    },

    render: function () {
      
      var templateVars = this.model.toJSON();
      
      if(!templateVars.min && templateVars.min !== 0){
        templateVars.min = this.model.get("rangeMin");
      }
      if(!templateVars.max && templateVars.max !== 0){
        templateVars.max = this.model.get("rangeMax");
      }
      
      if(templateVars.min < this.model.get("rangeMin")){
        templateVars.min = this.model.get("rangeMin")
      }
      
      if(templateVars.max > this.model.get("rangeMax")){
        templateVars.max = this.model.get("rangeMax")
      }

      this.$el.html( this.template( templateVars ) );

      var view = this;

      //jQueryUI slider
      this.$('.slider').slider({
          range: true,
          disabled: false,
          min: this.model.get("rangeMin"),  //sets the minimum on the UI slider on initialization
          max: this.model.get("rangeMax"),   //sets the maximum on the UI slider on initialization
          values: [ this.model.get("min"), this.model.get("max") ], //where the left and right slider handles are
          slide: function( event, ui ) {
            // When the slider is changed, update the input values
            view.$('input.min').val(ui.values[0]);
            view.$('input.max').val(ui.values[1]);
          },
          stop: function (event, ui) {

            // When the slider is stopped, update the input values
            view.$('input.min').val(ui.values[0]);
            view.$('input.max').val(ui.values[1]);

            //Also update the DateFilter model
            view.model.set('min', ui.values[0]);
            view.model.set('max', ui.values[1]);

          },
        });

        //When the rangeReset event is triggered, reset the slider
        this.listenTo(view.model, "rangeReset", this.resetSlider);

    },

    /**
    * Gets the min and max years from the number inputs and updates the DateFilter
    *  model and the year UI slider.
    * @param {Event} e - The event that triggered this callback function
    */
    updateYearRange : function(e) {

      //Get the min and max values from the number inputs
      var minVal = this.$('input.min').val();
      var maxVal = this.$('input.max').val();

      //Update the DateFilter model to match what is in the text inputs
      this.model.set('min', minVal);
      this.model.set('max', maxVal);

      //Update the UI slider to match the new min and max
      // Setter
      this.$( ".slider" ).slider( "option", "values", [ minVal, maxVal ] );

      //Send this event to Google Analytics
      if(MetacatUI.appModel.get("googleAnalyticsKey") && (typeof ga !== "undefined")){
        ga("send", "event", "portal search", "filter, Data Year", minVal + " to " + maxVal);
      }

    },

    /**
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
  return DateFilterView;
});
