
'use strict';

define(
  [
    'jquery',
    'underscore',
    'backbone',
    'models/maps/Layer',
    'text!templates/maps/layer-opacity.html'
  ],
  function (
    $,
    _,
    Backbone,
    Layer,
    Template
  ) {

    /**
    * @class LayerOpacityView
    * @classdesc A number slider that shows and updates the opacity in a Layer model
    * @classcategory Views/Maps TODO
    * @name LayerOpacityView
    * @extends Backbone.View
    * @screenshot maps/LayerOpacityView.png // TODO: add screenshot
    * @constructs
    */
    var LayerOpacityView = Backbone.View.extend(
      /** @lends LayerOpacityView.prototype */{

        /**
        * The type of View this is
        * @type {string}
        */
        type: 'LayerOpacityView',

        /**
        * The HTML classes to use for this view's element
        * @type {string}
        */
        className: 'layer-opacity',

        /**
        * The model that this view uses
        * @type {Layer}
        */
        model: undefined,

        /**
         * The primary HTML template for this view
         * @type {Underscore.template}
         */
        template: _.template(Template),

        /**
         * CSS classes assigned to the HTML elements that make up this view
         * @type {Object}
         * @property {string} sliderContainer The element that will be converted by this
         * view into a number slider widget. An element with this class must exist in the
         * template.
         * @property {string} handle The class given to the element that acts as a
         * handle for the slider UI. The handle is created during render and the class is
         * set by the jquery slider widget.
         * @property {string} range The class given to the element that shades the
         * slider from 0 to the current opacity. The range is created during render and
         * the class is set by the jquery slider widget.
         * @property {string} label The element that displays the current opacity
         * value as a percentage. This element is created during render.
         */
        classes: {
          sliderContainer: 'layer-opacity__slider',
          handle: 'layer-opacity__handle',
          range: 'layer-opacity__range',
          label: 'layer-opacity__label'
        },

        /**
        * The events this view will listen to and the associated function to call.
        * @type {Object}
        */
        events: {
          // 'event selector': 'function',
        },

        /**
        * Executed when a new LayerOpacityView is created
        * @param {Object} [options] - A literal object with options to pass to the view
        */
        initialize: function (options) {

          try {
            // Get all the options and apply them to this view
            if (typeof options == 'object') {
              for (const [key, value] of Object.entries(options)) {
                this[key] = value;
              }
            }
          } catch (e) {
            console.log('A LayerOpacityView failed to initialize. Error message: ' + e);
          }

        },

        /**
        * Renders this view
        * @return {LayerOpacityView} Returns the rendered view element
        */
        render: function () {

          try {

            // Save a reference to this view
            var view = this;

            // Ensure the view's main element has the given class name
            this.el.classList.add(this.className);

            // Insert the template into the view
            this.$el.html(this.template({}));

            var startOpacity = this.model ? this.model.get('opacity') || 1 : 1;

            // Find the element that will contain the slider
            var sliderContainer = this.$el.find('.' + this.classes.sliderContainer).first()

            // The event handler needs the view context to call other functions that
            // update the model and the label
            var sliderEventHandler = function (e, ui) {
              view.handleSliderEvent(e, ui)
            }

            // Create the jQuery slider widget. See https://api.jqueryui.com/slider/
            sliderContainer.slider({
              min: 0,
              max: 1,
              range: 'min',
              value: startOpacity,
              step: 0.01,
              // classes to add to the slider elements
              classes: {
                'ui-slider': '',
                'ui-slider-handle': view.classes.handle,
                'ui-slider-range': view.classes.range
              },
              // event handling
              slide: sliderEventHandler, // when the slider is moved by the user
              change: sliderEventHandler // when the slider is changed programmatically
            })

            // Create the element that will display the current opacity value as a
            // percentage. Insert it into the slider handle so that it can be easily
            // positioned just below the handle, even as the handle moves.
            this.opacityLabel = document.createElement('div')
            this.opacityLabel.className = view.classes.label
            sliderContainer.slider('instance').handle.append(this.opacityLabel)

            // Show the initial opacity value
            view.updateLabel(startOpacity)

            return this

          }
          catch (error) {
            console.log(
              'There was an error rendering a LayerOpacityView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Get the new opacity value from the slider and update the model and label. This
         * function is called when either of two events happen in the slider UI.
         * @param {Event} e The event object - not used by this function
         * @param {Object} ui An object with properties of the slider widget, including
         * handle, handleIndex, and value. This function retrieves the current from from
         * ui.value.
         * @see {@link https://api.jqueryui.com/slider/#event-change}
         */
        handleSliderEvent: function (e, ui) {
          try {
            // Only update if the value has actually changed
            if (ui.value !== this.currentValue) {
              this.updateModel(ui.value)
              this.updateLabel(ui.value)
              this.currentValue = ui.value
            }
          }
          catch (error) {
            console.log(
              'There was an error handling a slider event in a LayerOpacityView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Update the Layer model's opacity attribute with a new value.
         * @param {Number} newOpacity A number between 0 and 1 indicating the new opacity
         * value for the Layer model
         */
        updateModel: function (newOpacity){
          try {
            if (!this.model || !newOpacity || typeof newOpacity !== 'number') {
              return
            }
            this.model.set('opacity', newOpacity)
          }
          catch (error) {
            console.log(
              'There was an error updating the model in a LayerOpacityView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Update the label with the newOpacity displayed as a percentage
         * @param {Number} newOpacity A number between 0 and 1 indicating the new opacity
         * value for the Layer model
         */
        updateLabel: function (newOpacity) {
         
          try {
            if (!this.opacityLabel || (typeof newOpacity === 'undefined') || typeof newOpacity !== 'number') {
              return
            }
            var opacityPercent = Math.round(newOpacity * 100);
            this.opacityLabel.innerText = opacityPercent + '%'
          }
          catch (error) {
            console.log(
              'There was an error updating the opacity label in a LayerOpacityView' +
              '. Error details: ' + error
            );
          }
        },

      }
    );

    return LayerOpacityView;

  }
);
