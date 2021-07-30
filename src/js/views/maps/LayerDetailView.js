'use strict';

define(
  [
    'jquery',
    'underscore',
    'backbone',
    'models/maps/Layer',
  ],
  function (
    $,
    _,
    Backbone,
    Layer,
    Template
  ) {

    /**
    * @class LayerDetailView
    * @classdesc A view of a ... TODO
    * @classcategory Views/Maps TODO
    * @name LayerDetailView
    * @extends Backbone.View
    * @screenshot maps/LayerDetailView.png // TODO: add screenshot
    * @constructs
    */
    var LayerDetailView = Backbone.View.extend(
      /** @lends LayerDetailView.prototype */{

        /**
        * The type of View this is
        * @type {string}
        */
        type: 'LayerDetailView',

        /**
        * The HTML classes to use for this view's element
        * @type {string}
        */
        className: 'layer-detail',

        /**
        * The model that this view uses
        * @type {Layer}
        */
        model: undefined,

        /**
        * The events this view will listen to and the associated function to call.
        * @type {Object}
        */
        events: {
          // 'event selector': 'function',
        },

        /**
        * Executed when a new LayerDetailView is created
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
            console.log('A LayerDetailView failed to initialize. Error message: ' + e);
          }

        },

        /**
        * Renders this view
        * @return {LayerDetailView} Returns the rendered view element
        */
        render: function () {

          try {

            // Save a reference to this view
            var view = this;
            
            // Ensure the view's main element has the given class name
            this.el.classList.add(this.className);

            return this

          }
          catch (error) {
            console.log(
              'There was an error rendering a LayerDetailView' +
              '. Error details: ' + error
            );
          }
        },


      }
    );

    return LayerDetailView;

  }
);
