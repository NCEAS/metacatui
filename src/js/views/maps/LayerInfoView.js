
'use strict';

define(
  [
    'jquery',
    'underscore',
    'backbone',
    'models/maps/assets/MapAsset',
    'text!templates/maps/layer-info.html'
  ],
  function (
    $,
    _,
    Backbone,
    MapAsset,
    Template
  ) {

    /**
    * @class LayerInfoView
    * @classdesc A view that shows some of the basic info from a MapAsset model, like the
    * description, attribution, and link to more information.
    * @classcategory Views/Maps
    * @name LayerInfoView
    * @extends Backbone.View
    * @screenshot views/maps/LayerInfoView.png
    * @since 2.18.0
    * @constructs
    */
    var LayerInfoView = Backbone.View.extend(
      /** @lends LayerInfoView.prototype */{

        /**
        * The type of View this is
        * @type {string}
        */
        type: 'LayerInfoView',

        /**
        * The HTML classes to use for this view's element
        * @type {string}
        */
        className: 'layer-info',

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
        * The events this view will listen to and the associated function to call.
        * @type {Object}
        */
        events: {
          // 'event selector': 'function',
        },

        /**
        * Executed when a new LayerInfoView is created
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
            console.log('A LayerInfoView failed to initialize. Error message: ' + e);
          }

        },

        /**
        * Renders this view
        * @return {LayerInfoView} Returns the rendered view element
        */
        render: function () {

          try {

            // Save a reference to this view
            var view = this;

            // Ensure the view's main element has the given class name
            this.el.classList.add(this.className);

            // Insert the template into the view
            var templateOptions = this.model ? this.model.toJSON() : {};
            this.$el.html(this.template(templateOptions));

            return this

          }
          catch (error) {
            console.log(
              'There was an error rendering a LayerInfoView' +
              '. Error details: ' + error
            );
          }
        },


      }
    );

    return LayerInfoView;

  }
);
