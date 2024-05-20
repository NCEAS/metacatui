define([
  "jquery",
  "underscore",
  "backbone",
  "models/filters/BooleanFilter",
  "views/filters/FilterView",
  "text!templates/filters/booleanFilter.html",
], function ($, _, Backbone, BooleanFilter, FilterView, Template) {
  "use strict";

  /**
   * @class BooleanFilterView
   * @classdesc Render a view of a single BooleanFilter model
   * @classcategory Views/Filters
   * @extends FilterView
   */
  var BooleanFilterView = FilterView.extend(
    /** @lends BooleanFilterView.prototype */ {
      /**
       * A BooleanFilter model to be rendered in this view
       * @type {BooleanFilter} */
      model: null,

      className: "filter boolean",

      template: _.template(Template),

      /**
       * @inheritdoc
       */
      events: function () {
        try {
          const events = FilterView.prototype.events.call(this);
          events["click input[type='checkbox']"] = "updateModel";
          return events;
        } catch (e) {
          console.log("Failed to create events for BooleanFilterView: " + e);
          return {};
        }
      },

      render: function (templateVars) {
        FilterView.prototype.render.call(this, templateVars);
        this.stopListening(this.model, "change:values");
        this.listenTo(this.model, "change:values", this.updateCheckbox);
      },

      /**
       * Gets the value of the checkbox and updates the BooleanFilter model
       */
      updateModel: function () {
        //Find out if the checkbox has been checked or not
        var isChecked = this.$("input[type='checkbox']").prop("checked");

        //Set the boolean value on the model
        this.model.set("values", [isChecked]);
      },

      /**
       * Updates the checked property of the checkbox based on the model value
       */
      updateCheckbox: function () {
        //Get the value from the model
        var modelValue = this.model.get("values")[0];

        //If the model value is falsey, then set to false
        if (!modelValue) {
          modelValue = false;
        }

        //Update the checkbox based on the model value
        this.$("input[type='checkbox']").prop("checked", modelValue);
      },
    },
  );
  return BooleanFilterView;
});
