/*global define */
define(['jquery', 'underscore', 'backbone', 'text!templates/footer.html'],
  function ($, _, Backbone, FooterTemplate) {
    'use strict';

    // Build the Footer view of the application
    var FooterView = Backbone.View.extend({

      el: '#Footer',

      template: _.template(FooterTemplate),

      initialize: function () {
      },

      render: function () {
        this.$el.html(this.template());
      },

      /**
       * Hide the footer
       */
      hide: function () {
        this.el.style.setProperty('display', 'none') 
        document.body.style.setProperty('--footer-height', '0')
      },

      /**
       * Show the footer after it was hidden
       */
      show: function () {
        this.el.style.removeProperty('display')
        document.body.style.removeProperty('--footer-height')
      }

    });
    return FooterView;
  });
