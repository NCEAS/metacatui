define([
  "jquery",
  "underscore",
  "backbone",
  "text!templates/footer.html",
], function ($, _, Backbone, FooterTemplate) {
  "use strict";

  /**
   * @class FooterView
   * @classdesc The FooterView renders the main footer for the application, at the bottom of each page.
   * @classcategory Views
   * @extends Backbone.View
   */
  var FooterView = Backbone.View.extend(
    /** @lends FooterView.prototype */ {
      el: "#Footer",

      template: _.template(FooterTemplate),

      initialize: function () {},

      render: function () {
        this.$el.html(this.template());
      },

      /**
       * Hide the footer
       * @since 2.19.0
       */
      hide: function () {
        this.el.style.setProperty("display", "none");
        document.body.style.setProperty("--footer-height", "0");
      },

      /**
       * Show the footer after it was hidden
       * @since 2.19.0
       */
      show: function () {
        this.el.style.removeProperty("display");
        document.body.style.removeProperty("--footer-height");
      },
    },
  );
  return FooterView;
});
