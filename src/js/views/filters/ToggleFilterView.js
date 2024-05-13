/*global define */
define([
  "jquery",
  "underscore",
  "backbone",
  "models/filters/ToggleFilter",
  "views/filters/FilterView",
  "text!templates/filters/toggleFilter.html",
  "text!templates/filters/booleanFilter.html",
], function (
  $,
  _,
  Backbone,
  ToggleFilter,
  FilterView,
  Template,
  BooleanTemplate,
) {
  "use strict";

  /**
   * @class ToggleFilterView
   * @classdesc Render a view of a single ToggleFilter model
   * @classcategory Views/Filters
   * @extends FilterView
   */
  var ToggleFilterView = FilterView.extend(
    /** @lends ToggleFilterView.prototype */ {
      /**
       *  A ToggleFilter model to be rendered in this view
       * @type {ToggleFilter} */
      model: null,

      /**
       * @inheritdoc
       */
      modelClass: ToggleFilter,

      className: "filter toggle",

      template: _.template(Template),
      booleanTemplate: _.template(BooleanTemplate),

      /**
       * @inheritdoc
       */
      events: function () {
        try {
          var events = FilterView.prototype.events.call(this);
          events["click input[type='checkbox']"] = "updateModel";

          return events;
        } catch (error) {
          console.log(
            "There was an error creating the events object for a ToggleFilterView" +
              " Error details: " +
              error,
          );
        }
      },

      /**
       * @inheritdoc
       */
      render: function (templateVars = {}) {
        try {
          templateVars = _.extend(this.model.toJSON(), templateVars);
          templateVars.id = this.model.cid;

          if (!this.model.get("falseLabel")) {
            //If the value is the same as the trueValue, the checkbox should be checked
            templateVars.checked =
              this.model.get("values")[0] == this.model.get("trueValue")
                ? true
                : false;

            //Use the BooleanFilter template for toggles with only a true value
            this.$el.addClass("boolean");
            this.template = this.booleanTemplate;
          }

          // Renders the template and inserts the FilterEditorView if the mode is uiBuilder
          FilterView.prototype.render.call(this, templateVars);

          this.listenTo(this.model, "change:values", this.updateToggle);
        } catch (error) {
          console.log(
            "There was an error rendering a ToggleFilterView." +
              " Error details: " +
              error,
          );
        }
      },

      /**
       * Actions to perform after the render() function has completed and this view's
       * element is added to the webpage.
       */
      postRender: function () {
        this.setToggleWidth();
      },

      updateToggle: function () {
        //If the model is set to true
        if (
          this.model.get("values").length &&
          this.model.get("values")[0] == this.model.get("trueValue")
        ) {
          this.$("input").prop("checked", true);
        } else if (
          this.model.get("values").length &&
          this.model.get("values")[0] == this.model.get("falseValue")
        ) {
          this.$("input").prop("checked", false);
        } else if (!this.model.get("values").length) {
          this.$("input").prop("checked", false);
        }

        this.setToggleWidth();
      },

      /**
       * Gets the width of the toggle labels and sets the various CSS attributes
       * necessary for the switch to fully display each label
       */
      setToggleWidth: function () {
        //If there is no toggle element, exit now
        if (!this.$(".can-toggle-switch").length) {
          return;
        }

        //Get the padding and widths of the switch elements
        var switchPadding = 24,
          onSwitchWidth = this.$(".true-label").width(),
          offSwitchWidth = this.$(".false-label").width(),
          totalSwitchWidth =
            onSwitchWidth + offSwitchWidth + switchPadding * 2 + 2,
          isChecked = this.$("input[type='checkbox']").prop("checked");

        //Set the width on the whole view
        this.$el.width(totalSwitchWidth + "px");

        //Get the toggle switch element
        var toggleSwitch = this.$(".can-toggle-switch");

        //Add an identifier to the toggle switch element
        toggleSwitch.attr("id", "toggle-" + this.model.cid);

        //Change the width of the toggle switch
        toggleSwitch.css("flex", "0 0 " + totalSwitchWidth + "px");

        //Create CSS for the :before and :after pseudo elements, which is best done
        // by adding a style tag directly to the DOM
        if (isChecked) {
          var newCSS =
            "#" +
            "toggle-" +
            this.model.cid +
            ":before{ " +
            "transform: translate3d(" +
            (onSwitchWidth + switchPadding) +
            "px, 0, 0);" +
            "width: " +
            (offSwitchWidth + switchPadding) +
            "px ;" +
            "}" +
            "#" +
            "toggle-" +
            this.model.cid +
            ":after{ " +
            "width: " +
            (onSwitchWidth + switchPadding) +
            "px;" +
            "transform: translate3d(0px, 0, 0);" +
            "}";
        } else {
          var newCSS =
            "#" +
            "toggle-" +
            this.model.cid +
            ":before{ " +
            "width: " +
            (offSwitchWidth + switchPadding) +
            "px ;" +
            "left: 0px ;" +
            "}" +
            "#" +
            "toggle-" +
            this.model.cid +
            ":after{ " +
            "width: " +
            (onSwitchWidth + switchPadding) +
            "px;" +
            "transform: translate3d(" +
            (offSwitchWidth + switchPadding) +
            "px, 0, 0);" +
            "}";
        }

        //Get or create a style tag
        var styleTag = toggleSwitch.children("style");
        if (!styleTag.length) {
          styleTag = $(document.createElement("style"));
          toggleSwitch.append(styleTag);
        }

        //Add the CSS to the style tag
        styleTag.html(newCSS);
      },

      /**
       * Updates the value set on the ToggleFilter Model associated with this view.
       * The filter value is grabbed from the checkbox element in this view.
       *
       */
      updateModel: function () {
        //Check if the checkbox is checked
        var isChecked = this.$("input").prop("checked");

        //If the toggle is checked, then set the true toggle value on the model
        if (isChecked) {
          if (this.model.get("values")[0] !== this.model.get("trueValue")) {
            this.model.set("values", [this.model.get("trueValue")]);
          }
        }
        //If the toggle is not checked and there is no false value specified,
        // then remove the value from the model completely
        else if (!this.model.get("falseValue")) {
          if (this.model.get("values").length > 0) {
            this.model.set("values", []);
          }
        }
        //If the toggle is not checked and there is a false value specified,
        // then set the false toggle value on the model
        else {
          if (this.model.get("values")[0] !== this.model.get("falseValue")) {
            this.model.set("values", [this.model.get("falseValue")]);
          }
        }
      },
    },
  );
  return ToggleFilterView;
});
