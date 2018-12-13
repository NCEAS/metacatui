/*global define */
define(['jquery', 'underscore', 'backbone',
        'models/filters/Filter',
        'text!templates/filters/filter.html'],
  function($, _, Backbone, Filter, Template) {
  'use strict';

  // Render a view of a single FilterModel
  var FilterView = Backbone.View.extend({

    // @type {Filter} - A Filter model to be rendered in this view
    model: null,

    tagName: "div",

    className: "filter",

    template: _.template(Template),

    initialize: function (options) {

      if( !options || typeof options != "object" ){
        var options = {};
      }

      this.model = options.model || new Filter();

    },

    render: function () {
      this.$el.html( this.template( this.model.toJSON() ) );
    }

  });
  return FilterView;
});
