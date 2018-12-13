/*global define */
define(['jquery', 'underscore', 'backbone',
        'models/filters/BooleanFilter',
        'views/filters/FilterView',
        'text!templates/filters/booleanFilter.html'],
  function($, _, Backbone, BooleanFilter, FilterView, Template) {
  'use strict';

  // Render a view of a single BooleanFilter model
  var BooleanFilterView = FilterView.extend({

    // @type {BooleanFilter} - A BooleanFilter model to be rendered in this view
    model: null,

    className: "filter boolean",

    template: _.template(Template),

    initialize: function (options) {

      if( !options || typeof options != "object" ){
        var options = {};
      }

      this.model = options.model || new BooleanFilter();

    },

    render: function () {
      this.$el.html( this.template( this.model.toJSON() ) );
    }

  });
  return BooleanFilterView;
});
