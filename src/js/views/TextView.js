define([
  "jquery",
  "underscore",
  "backbone",
  "text!templates/alert.html",
  "text!templates/about.html",
  "text!templates/api.html",
  "text!templates/tools.html",
  "text!templates/help-searchTips.html",
  "text!templates/content/signin-help.html",
], function (
  $,
  _,
  Backbone,
  AlertTemplate,
  AboutTemplate,
  APITemplate,
  ToolsTemplate,
  SearchTipsTemplate,
  SignInHelpTemplate,
) {
  "use strict";

  // A generic view that loads a text template
  var TextView = Backbone.View.extend({
    el: "#Content",

    //Templates
    alert: _.template(AlertTemplate),
    about: _.template(AboutTemplate),
    api: _.template(APITemplate),
    tools: _.template(ToolsTemplate),
    searchTips: _.template(SearchTipsTemplate),
    signInHelp: _.template(SignInHelpTemplate),

    initialize: function () {},

    render: function (options) {
      this.anchorId = "";
      if (options && options.anchorId) this.anchorId = options.anchorId;
      else if (window.location.hash) {
        this.anchorId = window.location.hash.replace("#", "");
      }

      //Use a smaller header unless this is a subview
      if (!this.isSubview) MetacatUI.appModel.set("headerType", "default");

      //Get the text template from the options (sent from the router, most likely)
      var template = "";
      if (options && options.pageName) {
        template = this[options.pageName];
      }

      //If there is no template of that name, display a 404 message
      if (!template) {
        this.$el.html(
          this.alert({
            classes: "alert-error",
            msg:
              'Whoops, this page does not exist! Did you want to <a href="' +
              MetacatUI.root +
              '/data">search for data</a> or learn <a href="' +
              MetcatUI.root +
              '/about">more about this site</a>?',
          }),
        );
      }

      if (options.pageName == "searchTips")
        var dataForTemplate = MetacatUI.appSearchModel;

      //Load the text template
      this.$el.html(
        template({
          data: dataForTemplate,
        }),
      );

      return this;
    },

    postRender: function () {
      var anchorId = this.anchorId;
      if (anchorId) {
        this.scrollToAnchor(anchorId);
      } else {
        this.scrollToTop();
      }
    },

    // scroll to the anchor given to the render function
    scrollToAnchor: function (anchorId) {
      var anchorTag = this.$("#" + anchorId);
      if (!anchorTag.length) anchorTag = this.$("[name='" + anchorId + "']");
      if (!anchorTag.length) return;

      $("html,body").animate({ scrollTop: anchorTag.offset().top }, "slow");
    },

    // scroll to top of page
    scrollToTop: function () {
      $("html, body").animate({ scrollTop: 0 }, "slow");
      return false;
    },
  });
  return TextView;
});
