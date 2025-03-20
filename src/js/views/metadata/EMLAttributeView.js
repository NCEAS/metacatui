define([
  "underscore",
  "jquery",
  "backbone",
  "models/DataONEObject",
  "models/metadata/eml211/EMLAttribute",
  "models/metadata/eml211/EMLMeasurementScale",
  "views/metadata/EMLMeasurementScaleView",
  "views/metadata/EML211MissingValueCodesView",
  "views/metadata/EMLMeasurementTypeView",
  "text!templates/metadata/eml-attribute.html",
], (
  _,
  $,
  Backbone,
  DataONEObject,
  EMLAttribute,
  EMLMeasurementScale,
  EMLMeasurementScaleView,
  EML211MissingValueCodesView,
  EMLMeasurementTypeView,
  EMLAttributeTemplate,
) => {
  /**
   * @class EMLAttributeView
   * @classdesc An EMLAttributeView displays the info about one attribute in a
   * data object
   * @classcategory Views/Metadata
   * @screenshot views/metadata/EMLAttributeView.png
   * @augments Backbone.View
   */
  const EMLAttributeView = Backbone.View.extend(
    /** @lends EMLAttributeView.prototype */ {
      tagName: "div",

      /**
       * The className to add to the view container
       * @type {string}
       */
      className: "eml-attribute",

      /**
       * The HTML template for an attribute
       * @type {Underscore.template}
       */
      template: _.template(EMLAttributeTemplate),

      /**
       * The events this view will listen to and the associated function to
       * call.
       * @type {object}
       */
      events: {
        "change .input": "updateModel",
        focusout: "showValidation",
        "keyup .error": "hideValidation",
        "click .radio": "hideValidation",
      },

      /**
       * Creates a new EMLAttributeView
       * @param {object} options - A literal object with options to pass to the
       * view
       * @param {EMLAttribute} [options.model] - The EMLAttribute model to
       * display. If none is provided, an empty EMLAttribute will be created.
       * @param {boolean} [options.isNew] - Set to true if this is a new
       * attribute
       */
      initialize(options = {}) {
        this.isNew = options.isNew === true ? true : !options.model;
        this.model =
          options.model ||
          new EMLAttribute({ xmlID: DataONEObject.generateId() });
      },

      /**
       * Renders this view
       * @returns {EMLAttributeView} A reference to this view
       */
      render() {
        const templateInfo = {
          title: this.model.get("attributeName")
            ? this.model.get("attributeName")
            : "Add New Attribute",
        };

        _.extend(templateInfo, this.model.toJSON());

        // Render the template
        const viewHTML = this.template(templateInfo);

        // Insert the template HTML
        this.$el.html(viewHTML);

        let measurementScaleModel = this.model.get("measurementScale");

        if (!this.model.get("measurementScale")) {
          // Create a new EMLMeasurementScale model if this is a new attribute
          measurementScaleModel = EMLMeasurementScale.getInstance();
        }

        // Save a reference to this EMLAttribute model
        measurementScaleModel.set("parentModel", this.model);

        // Create an EMLMeasurementScaleView for this attribute's measurement
        // scale
        const measurementScaleView = new EMLMeasurementScaleView({
          model: measurementScaleModel,
          parentView: this,
        });

        // Render the EMLMeasurementScaleView and insert it into this view
        measurementScaleView.render();
        this.$(".measurement-scale-container").append(measurementScaleView.el);
        this.measurementScaleView = measurementScaleView;

        // Create and insert a missing values view
        const MissingValueCodesView = new EML211MissingValueCodesView({
          collection: this.model.get("missingValueCodes"),
        });
        MissingValueCodesView.render();
        this.$(".missing-values-container").append(MissingValueCodesView.el);
        this.MissingValueCodesView = MissingValueCodesView;

        // Mark this view DOM as new if it is a new attribute
        if (this.isNew) {
          this.$el.addClass("new");
        }

        // Save a reference to this model's id in the DOM
        this.$el.attr("data-attribute-id", this.model.cid);

        return this;
      },

      /**
       * After this view has been rendered, add the MeasurementTypeView and
       * render the MeasurementScaleView
       */
      postRender() {
        this.measurementScaleView.postRender();
        this.renderMeasurementTypeView();
      },

      /**
       * Render and insert the MeasurementTypeView for this view.
       *
       * This is separated out into its own method so it can be called from
       * `postRender()` which is called after the user switches to the
       * EntityView tab for this attribute. We do this to avoid loading as many
       * MeasurementTypeViews as there are Attributes which would get us rate
       * limited by BioPortal because every MeasurementTypeView hits BioPortal's
       * API on render.
       */
      renderMeasurementTypeView() {
        if (
          !(
            MetacatUI.appModel.get("enableMeasurementTypeView") &&
            MetacatUI.appModel.get("bioportalAPIKey")
          )
        ) {
          return;
        }

        const viewRef = this;
        const containerEl = viewRef.$(".measurement-type-container");

        // Only insert a new view if we haven't already
        if (!containerEl.is(":empty")) {
          return;
        }

        const view = new EMLMeasurementTypeView({
          model: viewRef.model,
        });
        view.render();
        containerEl.html(view.el);
      },

      /**
       * Updates the model with the new value from the DOM element that was
       * changed.
       * @param {Event} e - The event that was triggered by the user
       */
      updateModel(e) {
        if (!e) return;

        let emlModel = this.model.get("parentModel");
        let tries = 0;

        while (emlModel.type !== "EML" && tries < 6) {
          emlModel = emlModel.get("parentModel");
          tries += 1;
        }

        let newValue = emlModel
          ? emlModel.cleanXMLText($(e.target).val())
          : $(e.target).val();
        const category = $(e.target).attr("data-category");
        const currentValue = this.model.get(category);

        // If the new value is just a string of space characters, then set it to
        // an empty string
        if (typeof newValue === "string" && !newValue.trim().length) {
          newValue = "";
        }

        // If the current value is an array...
        if (Array.isArray(currentValue)) {
          // Get the position of the updated DOM element
          const index = this.$(`.input[data-category='${category}']`).index(
            e.target,
          );

          // If there is at least one value already in the array...
          if (currentValue.length > 0) {
            // If the new value is a falsey value, then don't' set it on the
            // model
            if (
              typeof newValue === "undefined" ||
              newValue === false ||
              newValue === null
            ) {
              // Remove one element at this index instead of inserting an empty
              // value
              const newArray = currentValue.splice(index, 1);

              // Set the new array on the model
              this.model.set(category, newArray);
            }
            // Otherwise, insert the value in the array at the calculated index
            else {
              currentValue[index] = newValue;
            }
          }
          // Otherwise if it's an empty array AND there is a value to set...
          else if (
            typeof newValue !== "undefined" &&
            newValue !== false &&
            newValue !== null
          ) {
            // Push the new value into this array
            currentValue.push(newValue);
          }

          // Trigger a change on this model attribute
          this.model.trigger(`change:${category}`);
        }
        // If the value is not an array check that there is an actual value here
        else if (
          typeof newValue !== "undefined" &&
          newValue !== false &&
          newValue !== null
        ) {
          this.model.set(category, newValue);
        }

        this.model.set("isNew", false);
        this.isNew = false;
      },

      /**
       * Shows validation errors on this view
       */
      showValidation() {
        const view = this;

        setTimeout(() => {
          // If the user focused on another element in this view, don't do
          // anything
          if (_.contains($(document.activeElement).parents(), view.el)) return;

          // Reset the error messages and styling
          view.$el.removeClass("error");
          view.$(".error").removeClass("error");
          view.$(".notification").text("");

          if (!view.model.isValid()) {
            const errors = view.model.validationError;

            _.each(
              Object.keys(errors),
              (attr) => {
                view.$(`.input[data-category='${attr}']`).addClass("error");
                view.$(`.radio [data-category='${attr}']`).addClass("error");
                view
                  .$(`[data-category='${attr}'] .notification`)
                  .text(errors[attr])
                  .addClass("error");
              },
              view,
            );

            view.$el.addClass("error");
          }

          // If the measurement scale model is not valid
          if (
            view.model.get("measurementScale") &&
            !view.model.get("measurementScale").isValid()
          ) {
            view.measurementScaleView.showValidation();
          }
        }, 200);
      },

      /**
       * Hides validation errors on this view
       * @param {Event} e - The event that was triggered by the user
       */
      hideValidation(e) {
        const input = $(e.target);
        const category = input.attr("data-category");

        input.removeClass("error");

        this.$(`[data-category='${category}'] .notification`)
          .removeClass("error")
          .empty();
      },

      /** Display the view */
      show() {
        this.$el.show();
      },

      /** Hide the view */
      hide() {
        this.$el.hide();
      },
    },
  );

  return EMLAttributeView;
});
