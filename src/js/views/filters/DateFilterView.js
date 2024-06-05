/*global define */
define([
  "jquery",
  "underscore",
  "backbone",
  "models/filters/DateFilter",
  "views/filters/FilterView",
  "text!templates/filters/dateFilter.html",
], function ($, _, Backbone, DateFilter, FilterView, Template) {
  "use strict";

  /**
   * @class DateFilterView
   * @classdesc Render a view of a single DateFilter model
   * @classcategory Views/Filters
   * @extends FilterView
   */
  var DateFilterView = FilterView.extend(
    /** @lends DateFilterView.prototype */ {
      /**
       * A DateFilter model to be rendered in this view
       * @type {DateFilter} */
      model: null,

      /**
       * @inheritdoc
       */
      modelClass: DateFilter,

      className: "filter date",

      template: _.template(Template),

      /**
       * @inheritdoc
       */
      events: function () {
        try {
          var events = FilterView.prototype.events.call(this);
          events["change input.max"] = "updateYearRange";
          events["change input.min"] = "updateYearRange";
          return events;
        } catch (error) {
          console.log(
            "There was an error creating the events object for a DateFilterView" +
              " Error details: " +
              error,
          );
        }
      },

      render: function () {
        var view = this;
        var templateVars = this.model.toJSON();

        var model = this.model,
          min = model.get("min"),
          max = model.get("max"),
          rangeMin = model.get("rangeMin"),
          rangeMax = model.get("rangeMax");

        if (!min && min !== 0) {
          templateVars.min = rangeMin;
        }
        if (!max && max !== 0) {
          templateVars.max = rangeMax;
        }
        if (templateVars.min < rangeMin) {
          templateVars.min = rangeMin;
        }
        if (templateVars.max > rangeMax) {
          templateVars.max = rangeMax;
        }

        // Renders the template and inserts the FilterEditorView if the mode is uiBuilder
        FilterView.prototype.render.call(this, templateVars);

        //jQueryUI slider
        this.$(".slider").slider({
          range: true,
          disabled: false,
          min: this.model.get("rangeMin"), //sets the minimum on the UI slider on initialization
          max: this.model.get("rangeMax"), //sets the maximum on the UI slider on initialization
          values: [this.model.get("min"), this.model.get("max")], //where the left and right slider handles are
          slide: function (event, ui) {
            // When the slider is changed, update the input values
            view.$("input.min").val(ui.values[0]);
            view.$("input.max").val(ui.values[1]);
          },
          stop: function (event, ui) {
            // When the slider is stopped, update the input values
            view.$("input.min").val(ui.values[0]);
            view.$("input.max").val(ui.values[1]);

            //Also update the DateFilter model
            view.updateModel(ui.values[0], ui.values[1]);
          },
        });

        //When the rangeReset event is triggered, reset the slider
        this.listenTo(view.model, "rangeReset", this.resetSlider);
      },

      /**
       * Override the base view which is triggered when the user types in the
       * input and presses "Enter". The DateFilterView handles updating the model
       * already and we do not want to clear the input value at any time.
       */
      handleChange: function () {
        return;
      },

      /**
       * Updates the min and max values set on the Filter Model associated with this view.
       * @param {number} min - The new minimum value
       * @param {number} max - The new maximum value
       * @since 2.17.0
       */
      updateModel: function (min, max) {
        try {
          this.model.set({
            min: min,
            max: max,
          });
        } catch (error) {
          console.log(
            "Error updating a DateFilter model from the DateFilter view. " +
              "Error details: " +
              error,
          );
        }
      },

      /**
       * Gets the min and max years from the number inputs and updates the DateFilter
       *  model and the year UI slider.
       * @param {Event} e - The event that triggered this callback function
       */
      updateYearRange: function (e) {
        //Get the min and max values from the number inputs
        var minVal = parseInt(this.$("input.min").val());
        var maxVal = parseInt(this.$("input.max").val());

        //Update the DateFilter model to match what is in the text inputs
        this.model.set("min", minVal);
        this.model.set("max", maxVal);

        //Update the UI slider to match the new min and max
        this.$(".slider").slider("option", "values", [minVal, maxVal]);

        //Track this event
        MetacatUI.analytics?.trackEvent(
          "portal search",
          "filter, Data Year",
          minVal + " to " + maxVal,
        );
      },

      /**
       * Resets the slider to the default values
       */
      resetSlider: function () {
        //Set the min and max values on the slider widget
        this.$(".slider").slider("option", "values", [
          this.model.get("rangeMin"),
          this.model.get("rangeMax"),
        ]);

        //Reset the min and max values
        this.$("input.min").val(this.model.get("rangeMin"));
        this.$("input.max").val(this.model.get("rangeMax"));
      },
    },
  );
  return DateFilterView;
});
