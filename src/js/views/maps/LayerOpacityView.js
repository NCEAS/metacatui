"use strict";

define([
  "jquery",
  "underscore",
  "backbone",
  "models/maps/assets/MapAsset",
  "text!templates/maps/layer-opacity.html",
  "jqueryui",
], ($, _, Backbone, MapAsset, Template) => {
  const CLASS_NAMES = {
    sliderContainer: "layer-opacity__slider",
    handle: "layer-opacity__handle",
    range: "layer-opacity__range",
    label: "layer-opacity__label",
  };

  /**
   * @class LayerOpacityView
   * @classdesc A number slider that shows and updates the opacity in a MapAsset
   * model. Changing the opacity of a layer will also make it visible, if it was
   * not visible before (i.e. this view also updates the MapAsset's visible
   * attribute.)
   * @classcategory Views/Maps
   * @name LayerOpacityView
   * @augments Backbone.View
   * @screenshot views/maps/LayerOpacityView.png
   * @since 2.18.0
   * @constructs
   */
  const LayerOpacityView = Backbone.View.extend(
    /** @lends LayerOpacityView.prototype */ {
      /**
       * The type of View this is
       * @type {string}
       */
      type: "LayerOpacityView",

      /**
       * The HTML classes to use for this view's element
       * @type {string}
       */
      className: "layer-opacity",

      /**
       * The model that this view uses
       * @type {MapAsset|undefined|null}
       */
      model: undefined,

      /**
       * The primary HTML template for this view
       * @type {Underscore.template}
       */
      template: _.template(Template),

      /**
       * CSS classes assigned to the HTML elements that make up this view
       * @type {object}
       * @property {string} sliderContainer The element that will be converted
       * by this view into a number slider widget. An element with this class
       * must exist in the template.
       * @property {string} handle The class given to the element that acts as a
       * handle for the slider UI. The handle is created during render and the
       * class is set by the jquery slider widget.
       * @property {string} range The class given to the element that shades the
       * slider from 0 to the current opacity. The range is created during
       * render and the class is set by the jquery slider widget.
       * @property {string} label The element that displays the current opacity
       * value as a percentage. This element is created during render.
       */
      classes: CLASS_NAMES,

      /**
       * The events this view will listen to and the associated function to
       * call.
       * @type {object}
       */
      events: {},

      /**
       * Executed when a new LayerOpacityView is created
       * @param {object} [options] A literal object with options to pass to the
       * view
       */
      initialize(options) {
        if (typeof options === "object") {
          Object.assign(this, options);
        }
      },

      /**
       * Renders this view
       * @returns {LayerOpacityView} This view
       */
      render() {
        // Ensure the view's main element has the given class name
        this.el.classList.add(this.className);

        // Insert the template into the view
        this.$el.html(this.template({}));

        const startOpacity = this.model?.get("opacity") ?? 1;

        // Find the element that will contain the slider
        this.sliderContainer = this.$el
          .find(`.${this.classes.sliderContainer}`)
          .first();

        // The model opacity may be updated by this or other views or models.
        // Make sure that the UI reflects any of these changes.
        this.stopListening(this.model, "change:opacity");
        this.listenTo(this.model, "change:opacity", this.updateSlider);

        /**
         * Set the layer's opacity and hide it when the slider reaches zero.
         * @param {jQuery.Event} _event The slider event
         * @param {object} ui Slider state from jQuery UI
         * @param {number} ui.value The opacity from 0 to 1
         */
        const handleSliderEvent = (_event, ui) => {
          if (!this.model) return;
          const newOpacity = ui.value;
          const currentVisibility = this.model.get("visible");
          this.updateModel(newOpacity);
          if (newOpacity > 0 && !currentVisibility) {
            this.model.set("visible", true);
          } else if (newOpacity === 0 && currentVisibility) {
            this.model.set("visible", false);
          }
        };

        this.sliderContainer.slider({
          min: 0,
          max: 1,
          range: "min",
          value: startOpacity,
          step: 0.01,
          // classes to add to the slider elements
          classes: {
            "ui-slider": "",
            "ui-slider-handle": this.classes.handle,
            "ui-slider-range": this.classes.range,
          },
          slide: handleSliderEvent, // when the slider is moved by the user
          change: handleSliderEvent, // when the slider is changed programmatically
        });

        // Create the element that will display the current opacity value as a
        // percentage. Insert it into the slider handle so that it can be easily
        // positioned just below the handle, even as the handle moves.
        this.opacityLabel = document.createElement("div");
        this.opacityLabel.className = this.classes.label;
        this.sliderContainer
          .slider("instance")
          .handle.append(this.opacityLabel);
        // Show the initial opacity value
        this.updateLabel(startOpacity);

        return this;
      },

      /** Sync the slider handle and label with the layer's opacity */
      updateSlider() {
        const newOpacity = this.model.get("opacity");
        // Only update if the value has actually changed
        if (newOpacity !== this.displayedOpacity) {
          this.updateLabel(newOpacity);
          // If this function was triggered by any event other than a user
          // sliding the handle, then the slider handle position will need to be
          // updated
          this.sliderContainer.slider("value", newOpacity);
          this.displayedOpacity = newOpacity;
        }
      },

      /**
       * Update the MapAsset model's opacity attribute with a new value.
       * @param {number} newOpacity A number between 0 and 1 indicating the new
       * opacity value for the MapAsset model
       */
      updateModel(newOpacity) {
        if (!this.model || typeof newOpacity !== "number") {
          return;
        }
        this.model.set("opacity", newOpacity);
      },

      /**
       * Update the label with the newOpacity displayed as a percentage
       * @param {number} newOpacity A number between 0 and 1 indicating the new
       * opacity value for the MapAsset model
       */
      updateLabel(newOpacity) {
        if (
          !this.opacityLabel ||
          typeof newOpacity === "undefined" ||
          typeof newOpacity !== "number"
        ) {
          return;
        }
        const opacityPercent = Math.round(newOpacity * 100);
        this.opacityLabel.innerText = `${opacityPercent}%`;
      },

      /** Stop listening for changes to the layer's opacity */
      onClose() {
        this.stopListening(this.model, "change:opacity");
      },
    },
  );

  return LayerOpacityView;
});
