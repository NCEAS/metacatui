/*global define */
define(['jquery', 'underscore', 'backbone',
        'models/filters/DateFilter',
        'views/filters/FilterView',
        'text!templates/filters/dateFilter.html'],
  function($, _, Backbone, DateFilter, FilterView, Template) {
  'use strict';

  // Render a view of a single DateFilter model
  var DateFilterView = FilterView.extend({

    // @type {DateFilter} - A DateFilter model to be rendered in this view
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
      this.$el.html( this.template( this.model.toJSON() ) );

      var view = this;

      //jQueryUI slider
      this.$('.year-slider').slider({
          range: true,
          disabled: false,
          min: this.model.get("min"),  //sets the minimum on the UI slider on initialization
          max: this.model.get("max"),   //sets the maximum on the UI slider on initialization
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
    },

    /*
    * Gets the min and max years from the number inputs and updates the DateFilter
    *  model and the year UI slider. 
    * @param {Event} e - The event that triggered this callback function
    */
    updateYearRange : function(e) {

      //Get hte min and max values from the number inputs
      var minVal = this.$('input.min').val();
      var maxVal = this.$('input.max').val();

      //Update the DateFilter model to match what is in the text inputs
      this.model.set('min', minVal);
      this.model.set('max', maxVal);

      //Update the UI slider to match the new min and max
      // Setter
      this.$( ".year-slider" ).slider( "option", "values", [ minVal, maxVal ] );

      //Send this event to Google Analytics
      if(MetacatUI.appModel.get("googleAnalyticsKey") && (typeof ga !== "undefined")){
        ga("send", "event", "project search", "filter, Data Year", minVal + " to " + maxVal);
      }

    }

  });
  return DateFilterView;
});
