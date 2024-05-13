/* global define */
define([
  "underscore",
  "jquery",
  "backbone",
  "models/metadata/eml211/EMLTemporalCoverage",
  "text!templates/metadata/dates.html",
], function (_, $, Backbone, EMLTemporalCoverage, DatesTemplate) {
  /**
   * @class EMLTempCoverageView
   * @classdesc The EMLTempCoverage renders the content of an EMLTemporalCoverage model
   * @classcategory Views/Metadata
   * @extends Backbone.View
   */
  var EMLTempCoverageView = Backbone.View.extend(
    /** @lends EMLTempCoverageView.prototype */ {
      type: "EMLTempCoverageView",

      tagName: "div",

      className: "row-fluid eml-temporal-coverage",

      attributes: {
        "data-category": "temporalCoverage",
      },

      template: _.template(DatesTemplate),

      initialize: function (options) {
        if (!options) var options = {};

        this.isNew = options.isNew || (options.model ? false : true);
        this.model = options.model || new EMLTemporalCoverage();
        this.edit = options.edit || false;
      },

      events: {
        change: "updateModel",
        focusout: "showValidation",
        "keyup input.error": "updateError",
        "mouseover .remove": "toggleRemoveClass",
        "mouseout  .remove": "toggleRemoveClass",
      },

      render: function (e) {
        //Save the view and model on the element
        this.$el.data({
          model: this.model,
          view: this,
        });

        this.$el.append(this.template(this.model.toJSON()));

        if (this.isNew) {
          this.$el.addClass("new");
        }

        return this;
      },

      /**
       * Updates the model
       */
      updateModel: function (e) {
        if (!e) return false;

        e.preventDefault();

        //Get the attribute and value
        var element = $(e.target),
          value = element.val(),
          attribute = element.attr("data-category");

        // Get the parent EML model
        var emlModel = this.model.getParentEML();
        //If a parent EML model was found, clean up the text for XML
        if (emlModel) {
          value = emlModel.cleanXMLText(value);
        }

        //Get the attribute that was changed
        if (!attribute) return false;

        this.model.set(attribute, value);

        if (
          this.model.isValid() &&
          this.model.get("parentModel") &&
          this.model.get("parentModel").type == "EML"
        ) {
          this.notNew();

          this.model.mergeIntoParent();
          this.model.trickleUpChange();
        }
      },

      /**
       * If the model isn't valid, show verification messages
       */
      showValidation: function (e, options) {
        this.$el.find(".notification").empty();
        this.$el.find(".error").removeClass("error");

        //Validate the temporal coverage model
        if (!this.model.isValid()) {
          var errors = this.model.validationError;

          _.mapObject(
            errors,
            function (errorMsg, category) {
              this.$el
                .find(".notification")
                .addClass("error")
                .append(errorMsg + " ");
              this.$el
                .find("[data-category='" + category + "']")
                .addClass("error");
            },
            this,
          );
        }
      },

      /**
       * When the user is typing in an input with an error, check if they've fixed the error
       */
      updateError: function (e) {
        var input = $(e.target);

        if (input.val()) {
          input.removeClass("error");

          //If there are no more errors, remove the error class from the view
          if (!this.$(".error").length) {
            this.$(".notification.error").text("");
            this.$el.removeClass("error");
          }
        }
      },

      /**
       * Highlight what will be removed when the remove icon is hovered over
       */
      toggleRemoveClass: function () {
        this.$el.toggleClass("remove-preview");
      },

      /**
       * Unmarks this view as new
       */
      notNew: function () {
        this.$el.removeClass("new");
        this.isNew = false;
      },
    },
  );

  return EMLTempCoverageView;
});
