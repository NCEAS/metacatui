/* global define */
define([
  "underscore",
  "jquery",
  "backbone",
  "models/metadata/eml211/EMLGeoCoverage",
  "text!templates/metadata/EMLGeoCoverage.html",
], function (_, $, Backbone, EMLGeoCoverage, EMLGeoCoverageTemplate) {
  /**
   * @class EMlGeoCoverageView
   * @classdesc The EMLGeoCoverage renders the content of an EMLGeoCoverage
   * model
   * @classcategory Views/Metadata
   * @extends Backbone.View
   */
  var EMLGeoCoverageView = Backbone.View.extend(
    /** @lends EMLGeoCoverageView.prototype */ {
      type: "EMLGeoCoverageView",

      /**
       * The HTML tag name for this view element
       * @type {string}
       * @default "div"
       */
      tagName: "div",

      /**
       * The class names to add to this view's HTML element
       */
      className: "row-fluid eml-geocoverage",

      /**
       * Attributes for the HTML element.
       */
      attributes: {
        "data-category": "geoCoverage",
      },

      /**
       * Events applied to this view's HTML elements by Backbone.
       */
      events: {
        change: "updateModel", // <- TODO: does this work?
        "mouseover .remove": "toggleRemoveClass",
        "mouseout .remove": "toggleRemoveClass",
      },

      /**
       * The template to use for this view in edit mode
       */
      editTemplate: _.template(EMLGeoCoverageTemplate),

      /**
       * Initializes the EMLGeoCoverageView
       * @param {Object} options - A literal object with options to pass to the
       * view
       * @param {EMLGeoCoverage} options.model - The EMLGeoCoverage model to
       * render
       * @param {boolean} options.edit - Flag to toggle whether this view is in
       * edit mode
       * @param {boolean} options.isNew - Flag to toggle whether this view is
       * new
       */
      initialize: function (options) {
        if (!options) var options = {};

        this.isNew = options.isNew || (options.model ? false : true);
        this.model = options.model || new EMLGeoCoverage();
        this.edit = options.edit || false;
      },

      /**
       * Renders the EMLGeoCoverageView
       * @returns {EMLGeoCoverageView} Returns the view
       */
      render: function () {
        try {
          // Save the view and model on the element
          this.$el.data({
            model: this.model,
            view: this,
          });

          this.$el.html(
            this.editTemplate({
              edit: this.edit,
              model: this.model.toJSON(),
            })
          );

          if (this.isNew) {
            this.$el.addClass("new");
          }

          return this;
        } catch (e) {
          console.log("Error rendering EMLGeoCoverageView: ", e);
          return this;
        }
      },

      /**
       * Updates the model. If this is called from the user switching between
       * latitude and longitude boxes, we check to see if the input was valid
       * and display any errors if we need to.
       *
       * @param {Event} e - The event that triggered this function
       */
      updateModel: function (e) {
        if (!e) return false;

        e.preventDefault();

        //Get the attribute and value
        var element = $(e.target),
          value = element.val(),
          attribute = element.attr("data-attribute");

        //Get the attribute that was changed
        if (!attribute) return false;

        var emlModel = this.model.getParentEML();
        if (emlModel) {
          value = emlModel.cleanXMLText(value);
        }

        //Are the NW and SE points the same? i.e. is this a single point and not
        //a box?
        var isSinglePoint =
          this.model.get("north") != null &&
          this.model.get("north") == this.model.get("south") &&
          this.model.get("west") != null &&
          this.model.get("west") == this.model.get("east"),
          hasEmptyInputs =
            this.$("[data-attribute='north']").val() == "" ||
            this.$("[data-attribute='south']").val() == "" ||
            this.$("[data-attribute='west']").val() == "" ||
            this.$("[data-attribute='east']").val() == "";

        //Update the model
        if (value == "") this.model.set(attribute, null);
        else this.model.set(attribute, value);

        //If the NW and SE points are the same point...
        if (isSinglePoint && hasEmptyInputs) {
          /* If the user updates one of the empty number inputs, then we can
           *   assume they do not want a single point and are attempting to
           *   enter a second point. So we should empty the value from the model
           *   for the corresponding coordinate For example, if the UI shows a
           *   lat,long pair of NW: [10] [30] SE: [ ] [ ] then the model values
           *   would be N: 10, W: 30, S: 10, E: 30 if the user updates that to:
           *   NW: [10] [30] SE: [5] [ ] then we want to remove the "east" value
           *   of "30", so the model would be: N: 10, W: 30, S: 5, E: null
           */
          if (
            attribute == "north" &&
            this.$("[data-attribute='west']").val() == ""
          )
            this.model.set("west", null);
          else if (
            attribute == "south" &&
            this.$("[data-attribute='east']").val() == ""
          )
            this.model.set("east", null);
          else if (
            attribute == "east" &&
            this.$("[data-attribute='south']").val() == ""
          )
            this.model.set("south", null);
          else if (
            attribute == "west" &&
            this.$("[data-attribute='north']").val() == ""
          )
            this.model.set("north", null);
          /*
           * If the user removes one of the latitude or longitude values, reset
           * the opposite point
           */ else if (
            ((attribute == "north" && this.model.get("north") == null) ||
              (attribute == "west" && this.model.get("west") == null)) &&
            this.$("[data-attribute='south']").val() == "" &&
            this.$("[data-attribute='east']").val() == ""
          ) {
            this.model.set("south", null);
            this.model.set("east", null);
          } else if (
            ((attribute == "south" && this.model.get("south") == null) ||
              (attribute == "east" && this.model.get("east") == null)) &&
            this.$("[data-attribute='north']").val() == "" &&
            this.$("[data-attribute='west']").val() == ""
          ) {
            this.model.set("north", null);
            this.model.set("west", null);
          } else if (attribute == "north" && this.model.get("north") != null)
            /* Otherwise, if the non-empty number inputs are updated, we simply
             *  update the corresponding value in the other point
             */
            this.model.set("south", value);
          else if (attribute == "south" && this.model.get("south") != null)
            this.model.set("north", value);
          else if (attribute == "west" && this.model.get("west") != null)
            this.model.set("east", value);
          else if (attribute == "east" && this.model.get("east") != null)
            this.model.set("west", value);
        } else {
          //Find out if we are missing a complete NW or SE point
          var isMissingNWPoint =
            this.model.get("north") == null && this.model.get("west") == null,
            isMissingSEPoint =
              this.model.get("south") == null && this.model.get("east") == null;

          // If there is a full NW point but no SE point, we can assume the user
          //  wants a single point and so we will copy the NW values to the SE
          if (
            this.model.get("north") != null &&
            this.model.get("west") != null &&
            isMissingSEPoint
          ) {
            this.model.set("south", this.model.get("north"));
            this.model.set("east", this.model.get("west"));
          }
          // Same for when there is a SE point but no NW point
          else if (
            this.model.get("south") != null &&
            this.model.get("east") != null &&
            isMissingNWPoint
          ) {
            this.model.set("north", this.model.get("south"));
            this.model.set("west", this.model.get("east"));
          }
        }

        // Validate the coordinate boxes this.validateCoordinates(e);

        //If this model is part of the EML inside the root data package, mark
        //the package as changed
        if (this.model.get("parentModel")) {
          if (
            this.model.get("parentModel").type == "EML" &&
            _.contains(
              MetacatUI.rootDataPackage.models,
              this.model.get("parentModel")
            )
          ) {
            MetacatUI.rootDataPackage.packageModel.set("changed", true);
          }
        }

        this.validate();
      },

      /**
       * Checks to see if any error messages need to be removed. If not, then it
       * performs validation across the row and displays any errors. This id
       * called when the user clicks out of an edit box on to the page.
       *
       * @param {Event} e - The event that triggered this function
       * @param {Object} options - Validation options
       */
      validate: function (e, options) {
        //Query for the EMlGeoCoverageView element that the user is actively
        //interacting with
        var activeGeoCovEl = $(document.activeElement).parents(
          ".eml-geocoverage"
        );

        //If the user is not actively in this view, then exit
        if (activeGeoCovEl.length && activeGeoCovEl[0] == this.el) return;

        //If the model is valid, then remove error styling and exit
        if (this.model.isValid()) {
          this.$(".error").removeClass("error");
          this.$el.removeClass("error");
          this.$(".notification").empty();
          this.model.trigger("valid");

          return;
        } else {
          this.showValidation();
        }
      },

      /*
       * Resets the error messaging and displays the current error messages for
       * this model This function is used by the EML211EditorView during the
       * package validation process
       */
      showValidation: function () {
        this.$(".error").removeClass("error");
        this.$el.removeClass("error");
        this.$(".notification").empty();

        const errorObj = this.model.validationError;
        // Get all of the field keys
        const fields = Object.keys(errorObj);
        // Get all of the error messages (values). Remove duplicates.
        let errorMessages = [...new Set(Object.values(errorObj))];
        // Join the error messages into a single string
        errorMessages = errorMessages.join(" ");

        // Highlight the fields that need to be fixed
        fields.forEach((field) => {
          this.$("[data-attribute='" + field + "']").addClass("error");
        })
        // Show the combined error message
        this.$(".notification").text(errorMessages).addClass("error");
      },

      /**
       * Highlight what will be removed when the remove icon is hovered over.
       */
      toggleRemoveClass: function () {
        this.$el.toggleClass("remove-preview");
      },

      /**
       * Unmark this view as news
       */
      notNew: function () {
        this.$el.removeClass("new");
        this.isNew = false;
      },
    }
  );

  return EMLGeoCoverageView;
});
