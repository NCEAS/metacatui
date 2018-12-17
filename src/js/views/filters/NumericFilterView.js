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

    initialize: function (options) {

      if( !options || typeof options != "object" ){
        var options = {};
      }

      this.model = options.model || new NumericFilter();

    },

    render: function () {
      this.$el.html( this.template( this.model.toJSON() ) );

      var numberInput = this.$("input");

      //If a minimum number is set on the model defaults
      if(this.model.get("min") !== null){
        //Set the minimum value on the number input
        numberInput.attr("min", this.model.get("min"));
      }

      //If a maximum number is set on the model defaults
      if(this.model.get("max") !== null){
        //Set the minimum value on the number input
        numberInput.attr("max", this.model.get("max"));
      }

      //Set a step attribute if there is one set on the model
      if( this.model.get("step") ){
        numberInput.attr("step", this.model.get("step"));
      }

    }

  });
  return NumericFilterView;
});
