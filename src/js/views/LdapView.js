/*global define */
define([
  "jquery",
  "underscore",
  "backbone",
  "bootstrap",
  "recaptcha",
  "text!templates/loading.html",
], function ($, _, Backbone, BootStrap, Recaptcha, LoadingTemplate) {
  "use strict";

  // Build the main header view of the application
  var LdapView = Backbone.View.extend({
    el: "#Content",

    template: null,

    loadingTemplate: _.template(LoadingTemplate),

    containerTemplate:
      '<article><div class="container"><div class="row-fluid"><div id="DynamicContent" class="text-left"></div></div></div></article>',

    ldapwebUrl: null,

    ldapwebQueryString: "?cfg=metacatui",

    stage: null,

    initialize: function () {},

    render: function () {
      // look up the url from the main application model
      this.ldapwebUrl = MetacatUI.appModel.get("ldapwebServiceUrl");

      // request a smaller header
      MetacatUI.appModel.set("headerType", "default");

      // show the loading icon
      this.showLoading();

      // do we have a specific stage?
      var completeUrl = this.ldapwebUrl + this.ldapwebQueryString;
      if (this.stage) {
        completeUrl += "&stage=" + this.stage;
      }

      // load all the ldapweb content so all the js can run in what gets loaded
      var viewRef = this;
      this.$el.html(viewRef.containerTemplate);
      var contentArea = this.$("#DynamicContent");
      contentArea.load(completeUrl, function () {
        viewRef.show();
      });

      return this;
    },

    show: function () {
      var view = this;

      this.$el.hide();

      this.$el.fadeIn({
        duration: "slow",
        done: function () {
          //Add btn class
          view.$(":submit").addClass("btn");

          //Find the captcha container and captcha function, if it exists (requires captcha API key in Metacat)
          if (
            view.$("#captchaArea").length > 0 &&
            typeof showRecaptcha == "function"
          ) {
            //Make sure the link doesn't already exist, too
            if (view.$("#captchaArea").find("a").length == 0) {
              var link = $(document.createElement("a"))
                .text("Show code")
                .addClass("pointer")
                .on("click", function () {
                  showRecaptcha("captchaArea");
                });
              $("#captchaArea").append(link);
            }
          }
        },
      });
    },

    events: {
      "click input[type='submit']": "submitForm",
    },

    submitForm: function (event) {
      // which form?
      var form = $(event.target).parents("form");

      // get the form data before replacing everything with the loading icon!
      var formData = $(form).serialize();

      // show the loading icon
      this.showLoading();

      // ajax call to submit the given form and then render the results in the content area
      var viewRef = this;

      var requestSettings = {
        type: "POST",
        url: this.ldapwebUrl,
        data: formData,
        success: function (data, textStatus, jqXHR) {
          viewRef.$el.html(viewRef.containerTemplate);
          var contentArea = viewRef.$("#DynamicContent");
          contentArea.html(data);

          //Show the content
          viewRef.show();
        },
      };

      $.ajax(
        _.extend(requestSettings, MetacatUI.appUserModel.createAjaxSettings()),
      );

      return false;
    },

    showLoading: function () {
      this.scrollToTop();
      this.$el.html(this.loadingTemplate());
    },

    scrollToTop: function () {
      $("html, body").animate({ scrollTop: 0 }, "slow");
      return false;
    },
  });
  return LdapView;
});
