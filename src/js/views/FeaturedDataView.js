/*global define */
define([
  "jquery",
  "underscore",
  "backbone",
  "text!templates/featuredData.html",
], function ($, _, Backbone, FeaturedDataTemplate) {
  "use strict";

  // Build the featured data view of the application
  var FeaturedDataView = Backbone.View.extend({
    el: "#FeaturedData",

    template: _.template(FeaturedDataTemplate),

    initialize: function () {},

    render: function () {
      this.$el.html(this.template());
    },
  });
  return FeaturedDataView;
});
