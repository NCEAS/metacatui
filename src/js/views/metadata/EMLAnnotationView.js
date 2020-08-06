/* global define */
define(['underscore', 'jquery', 'backbone',
  'models/metadata/eml211/EMLAnnotation',
  'text!templates/metadata/eml-annotation.html'],
  function (_, $, Backbone, EMLAnnotation, EMLAnnotationTemplate) {
    var EMLAnnotationView = Backbone.View.extend({

      tagName: "div",
      className: "eml-annotation row-fluid",
      template: _.template(EMLAnnotationTemplate),

      events: {
        "focusout input" : "showValidation",
        "change input": "updateModel",
      },

      initialize: function (options) {
        if (!options)
          var options = {};

        this.isNew = (options.isNew == true) ? true : options.model ? false : true;
        this.model = options.model || new EMLAnnotation();
      },

      render: function () {
        var viewHTML = this.template(this.model.attributes);

        this.$el.html(viewHTML);

        // Mark this view DOM as new if it has a new attribute
        if (this.isNew) {
          this.$el.addClass("new");
        }
      },

      updateModel: function (e) {
        if (!e) return;

        // Manage isNew
        if (this.model.get("isNew")) {
          this.model.set("isNew", false);
          this.isNew = false;
        }

        var what = e.target.dataset.category;
        var value = e.target.value.trim();

        if (!what) {
          return;
        }

        this.model.set(what, value);

        // Trigger a change on this model attribute
        this.model.trigger("change");
      },

      showValidation: function () {
        // Always clear all validation info first
        this.hideValidation();

        if (this.model.isValid()) {
          return;
        }

        _.each(this.model.validationError, function (error) {
          // Find DOM targets for error UI
          var target = this.$el.find("p.notification[data-category='" + error.category + "']");
          var input = this.$el.find("input[data-category='" + error.category + "']");

          if (target.length != 1) {
            return;
          }

          $(target).addClass("error");
          $(target).text(error.message);

          if (input.length != 1) {
            return;
          }

          $(input).addClass("error");
        }, this);
      },

      hideValidation: function () {
        $(this.$el).find("p.notification").empty();
        $(this.$el).find("input.error").removeClass("error");
      }
    });

    return EMLAnnotationView;
  });
