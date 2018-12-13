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

    className: "filter date",

    template: _.template(Template),

    initialize: function (options) {

      if( !options || typeof options != "object" ){
        var options = {};
      }

      this.model = options.model || new NumericFilter();

    },

    render: function () {
      this.$el.html( this.template( this.model.toJSON() ) );
    }

  });
  return NumericFilterView;
});
