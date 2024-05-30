/*global define */
define([
  "jquery",
  "underscore",
  "backbone",
  "text!templates/mainContent.html",
], function ($, _, Backbone, MainContentTemplate) {
  "use strict";

  // Build the main content view of the application
  var MainContentView = Backbone.View.extend({
    el: "#mainContent",

    tagName: "section",

    template: _.template(MainContentTemplate),

    initialize: function () {},

    events: {
      "click #search_btn_main": "triggerSearch",
      "keypress #search_txt_main": "triggerOnEnter",
    },

    render: function () {
      this.$el.html(this.template());

      return this;
    },

    triggerSearch: function () {
      // alert the model that a search should be performed
      var searchTerm = $("#search_txt_main").val();

      if (searchTerm) {
        //Clear the search model to start a fresh search
        MetacatUI.appSearchModel
          .clear()
          .set(MetacatUI.appSearchModel.defaults());

        //Create a new array with the new search term
        var newSearch = [searchTerm];

        //Set up the search model for this new term
        MetacatUI.appSearchModel.set("all", newSearch);
      }

      // make sure the browser knows where we are going
      MetacatUI.uiRouter.navigate("data", { trigger: true });
    },

    triggerOnEnter: function (e) {
      if (e.keyCode != 13) return;
      e.preventDefault();
      this.triggerSearch();
    },
  });
  return MainContentView;
});
