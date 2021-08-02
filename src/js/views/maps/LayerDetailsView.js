
'use strict';

define(
  [
    'jquery',
    'underscore',
    'backbone',
    'models/maps/Layer',
    'text!templates/maps/layer-details.html'
  ],
  function (
    $,
    _,
    Backbone,
    Layer,
    Template
  ) {

    /**
    * @class LayerDetailsView
    * @classdesc A panel with additional information about a Layer, plus some UI for
    * updating the appearance of the Layer on the map, such as the opacity.
    * @classcategory Views/Maps
    * @name LayerDetailsView
    * @extends Backbone.View
    * @screenshot maps/LayerDetailsView.png // TODO: add screenshot
    * @constructs
    */
    var LayerDetailsView = Backbone.View.extend(
      /** @lends LayerDetailsView.prototype */{

        /**
        * The type of View this is
        * @type {string}
        */
        type: 'LayerDetailsView',

        /**
        * The HTML classes to use for this view's element
        * @type {string}
        */
        className: 'layer-details',

        /**
        * The Layer model that this view uses
        * @type {Layer}
        */
        model: undefined,

        /**
         * The primary HTML template for this view
         * @type {Underscore.template}
         */
        template: _.template(Template),

        /**
         * Classes that are used to identify the HTML elements that comprise this view.
         * @type {Object}
         * @property {string} open The class to add to the outermost HTML element for this
         * view when the layer details view is open/expanded (not hidden)
         * @property {string} toggle The element in the template that acts as a toggle to
         * close/hide the details view
         */
        classes: {
          open: 'layer-details--open',
          toggle: 'layer-details__toggle',
        },

        /**
        * Creates an object that gives the events this view will listen to and the
        * associated function to call. Each entry in the object has the format 'event
        * selector': 'function'.
        * @returns {Object}
        */
        events: function () {
          var events = {};
          // Close the layer details panel when the toggle button is clicked. Get the
          // class of the toggle button from the classes property set in this view.
          events['click .' + this.classes.toggle] = 'close'
          return events
        },

        /**
         * Whether or not the layer details view is open
         * @type {Boolean}
         */
        isOpen: false,

        /**
        * Executed when a new LayerDetailsView is created
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
            console.log('A LayerDetailsView failed to initialize. Error message: ' + e);
          }

        },

        /**
        * Renders this view
        * @return {LayerDetailsView} Returns the rendered view element
        */
        render: function () {

          try {

            // Save a reference to this view
            var view = this;

            // Show the layer details box as open if the view is set to have it open
            // already
            if (this.isOpen) {
              this.el.classList.add(this.classes.open);
            }

            // Insert the template into the view
            this.$el.html(this.template({
              label: this.model ? this.model.get('label') || '' : ''
            }));

            // Ensure the view's main element has the given class name
            this.el.classList.add(this.className);
            return this

          }
          catch (error) {
            console.log(
              'There was an error rendering a LayerDetailsView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Show/expand the Layer Details panel. Opening the panel also changes the Layer
         * model's 'selected attribute' to true.
         */
        open: function () {
          try {
            this.el.classList.add(this.classes.open);
            this.isOpen = true;
            // Ensure that the model is marked as selected
            if (this.model) {
              this.model.set('selected', true)
            }
          }
          catch (error) {
            console.log(
              'There was an error opening the LayerDetailsView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Hide/collapse the Layer Details panel. Closing the panel also changes the Layer
         * model's 'selected attribute' to false.
         */
        close: function () {
          try {
            this.el.classList.remove(this.classes.open);
            this.isOpen = false;
            // Ensure that the model is not marked as selected
            if (this.model) {
              this.model.set('selected', false)
            }
          }
          catch (error) {
            console.log(
              'There was an error closing the LayerDetailsView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Updates the Layer model set on the view then re-renders the view and displays
         * information about the new model.
         * @param {Layer|null} newModel the new Layer model to use to render the view. If
         * set to null, then the view will be rendered without any layer information.
         */
        updateModel: function (newModel) {
          try {
            this.model = newModel;
            this.render()
          }
          catch (error) {
            console.log(
              'There was an error updating the Layer model in a LayerDetailsView' +
              '. Error details: ' + error
            );
          }
        },

      }
    );

    return LayerDetailsView;

  }
);
