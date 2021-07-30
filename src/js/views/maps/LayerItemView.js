
'use strict';

define(
  [
    'jquery',
    'underscore',
    'backbone',
    'models/maps/Layer',
    'text!templates/maps/layer-item.html'
  ],
  function (
    $,
    _,
    Backbone,
    Layer,
    Template
  ) {

    /**
    * @class LayerItemView
    * @classdesc A view of a ... TODO
    * @classcategory Views/Maps
    * @name LayerItemView
    * @extends Backbone.View
    * @screenshot maps/LayerItemView.png // TODO: add screenshot
    * @constructs
    */
    var LayerItemView = Backbone.View.extend(
      /** @lends LayerItemView.prototype */{

        /**
        * The type of View this is
        * @type {string}
        */
        type: 'LayerItemView',

        /**
        * The HTML classes to use for this view's element
        * @type {string}
        */
        className: 'layer-item',

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
        * The events this view will listen to and the associated function to call.
        * @type {Object}
        */
        events: {
          // 'event selector': 'function',
        },

        /**
        * Executed when a new LayerItemView is created
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
            console.log('A LayerItemView failed to initialize. Error message: ' + e);
          }

        },

        /**
        * Renders this view
        * @return {LayerItemView} Returns the rendered view element
        */
        render: function () {

          try {

            // Save a reference to this view
            var view = this;

            // Insert the template into the view
            this.$el.html(this.template({
              label: this.model.get("label")
            }));

            // Ensure the view's main element has the given class name
            this.el.classList.add(this.className);

            return this

          }
          catch (error) {
            console.log(
              'There was an error rendering a LayerItemView' +
              '. Error details: ' + error
            );
          }
        },


      }
    );

    return LayerItemView;

  }
);
