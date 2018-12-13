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

    initialize: function (options) {

      if( !options || typeof options != "object" ){
        var options = {};
      }

      this.model = options.model || new DateFilter();

    },

    render: function () {
      this.$el.html( this.template( this.model.toJSON() ) );
    }

  });
  return DateFilterView;
});
