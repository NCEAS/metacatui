
'use strict';

define(
  [
    'jquery',
    'underscore',
    'backbone',
    'models/maps/assets/MapAsset',
    'text!templates/maps/layer-opacity.html'
  ],
  function (
    $,
    _,
    Backbone,
    MapAsset,
    Template
  ) {

    /**
    * @class LayerOpacityView
    * @classdesc A number slider that shows and updates the opacity in a MapAsset model.
    * Changing the opacity of a layer will also make it visible, if it was not visible
    * before (i.e. this view also updates the MapAsset's visible attribute.)
    * @classcategory Views/Maps
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
        * @type {MapAsset}
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
            view.sliderContainer = this.$el.find('.' + this.classes.sliderContainer).first()

            // The model opacity may be updated by this or other views or models. Make
            // sure that the UI reflects any of these changes.
            view.stopListening(view.model, 'change:opacity')
            view.listenTo(view.model, 'change:opacity', view.updateSlider)

            // Create the jQuery slider widget. See https://api.jqueryui.com/slider/
            view.sliderContainer.slider({
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
              slide: handleSliderEvent, // when the slider is moved by the user
              change: handleSliderEvent // when the slider is changed programmatically
            })

            // What to do when the opacity slider is changed. The event handler needs the
            // view context to call other functions that update the model and the label.
            function handleSliderEvent (e, ui) {
              const newOpacity = ui.value
              const currentVisibility = view.model.get('visible')
              // Update the model. This will trigger other UI updates in this view.
              view.updateModel(newOpacity)
              // If the opacity changes to anything but zero, then make sure the asset is
              // also visible. (Why would a user change the opacity and not also want the
              // layer visible?)
              if (newOpacity > 0 && !currentVisibility) {
                view.model.set('visible', true)
              // If the opacity is changed to zero, also set visibility to false. This
              // triggers the layer list to grey-out the layer item.
              } else if (newOpacity === 0 && currentVisibility) {
                view.model.set('visible', false)
              }
            }

            // Create the element that will display the current opacity value as a
            // percentage. Insert it into the slider handle so that it can be easily
            // positioned just below the handle, even as the handle moves.
            this.opacityLabel = document.createElement('div')
            this.opacityLabel.className = view.classes.label
            view.sliderContainer.slider('instance').handle.append(this.opacityLabel)
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
         * Get the new opacity value from the model and update the slider handle position
         * and label. This function is called whenever the model opacity is updated.
         */
        updateSlider: function () {
          try {
            const newOpacity = this.model.get('opacity')
            // Only update if the value has actually changed
            if (newOpacity !== this.displayedOpacity) {
              this.updateLabel(newOpacity)
              // If this function was triggered by any event other than a user sliding the
              // handle, then the slider handle position will need to be updated
              this.sliderContainer.slider('value', newOpacity)
              this.displayedOpacity = newOpacity
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
         * Update the MapAsset model's opacity attribute with a new value.
         * @param {Number} newOpacity A number between 0 and 1 indicating the new opacity
         * value for the MapAsset model
         */
        updateModel: function (newOpacity) {
          try {
            if (!this.model || typeof newOpacity !== 'number') {
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
         * value for the MapAsset model
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
