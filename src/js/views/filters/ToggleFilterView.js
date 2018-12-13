/*global define */
define(['jquery', 'underscore', 'backbone',
        'models/filters/ToggleFilter',
        'views/filters/FilterView',
        'text!templates/filters/toggleFilter.html'],
  function($, _, Backbone, ToggleFilter, FilterView, Template) {
  'use strict';

  // Render a view of a single ToggleFilter model
  var ToggleFilterView = FilterView.extend({

    // @type {ToggleFilter} - A ToggleFilter model to be rendered in this view
    model: null,

    className: "filter date",

    template: _.template(Template),

    initialize: function (options) {

      if( !options || typeof options != "object" ){
        var options = {};
      }

      this.model = options.model || new ToggleFilter();

    },

    render: function () {
      this.$el.html( this.template( this.model.toJSON() ) );
    }

  });
  return ToggleFilterView;
});
