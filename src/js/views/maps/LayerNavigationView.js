'use strict';

define(
  [
    'jquery',
    'underscore',
    'backbone',
    'models/maps/assets/MapAsset',
    'text!templates/maps/layer-navigation.html'
  ],
  function (
    $,
    _,
    Backbone,
    MapAsset,
    Template
  ) {

    /**
    * @class LayerNavigationView
    * @classdesc A panel with buttons that control navigation to points of interest in a
    * Layer or other Map Asset, including a button that zooms to the entire extent of the
    * asset. This view may update the opacity and visibility of a MapAsset.
    * @classcategory Views/Maps
    * @name LayerNavigationView
    * @extends Backbone.View
    * @screenshot views/maps/LayerNavigationView.png
    * @since 2.18.0
    * @constructs
    */
    var LayerNavigationView = Backbone.View.extend(
      /** @lends LayerNavigationView.prototype */{

        /**
        * The type of View this is
        * @type {string}
        */
        type: 'LayerNavigationView',

        /**
        * The HTML classes to use for this view's element
        * @type {string}
        */
        className: 'layer-navigation',

        /**
        * The model that this view uses
        * @type {MapAsset}
        */
        model: null,

        /**
         * The primary HTML template for this view
         * @type {Underscore.template}
         */
        template: _.template(Template),

        /**
         * CSS classes assigned to the HTML elements that make up this view
         * @type {Object}
         * @property {string} extentButton The button that should zoom to the full extent
         * of the asset/layer when clicked
        */
        classes: {
          extentButton: 'layer-navigation__button--extent',
        },

        /**
         * Creates an object that gives the events this view will listen to and the
         * associated function to call. Each entry in the object has the format 'event
         * selector': 'function'.
         * @returns {Object}
        */
         events: function () {
          var events = {};
          // Trigger an event for parent views when the 'zoom to extent' button is clicked
          events['click .' + this.classes.extentButton] = 'flyToExtent'
          return events
        },

        /**
        * Executed when a new LayerNavigationView is created
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
            console.log('A LayerNavigationView failed to initialize. Error message: ' + e);
          }

        },

        /**
        * Renders this view
        * @return {LayerNavigationView} Returns the rendered view element
        */
        render: function () {

          try {

            // Save a reference to this view
            var view = this;

            // Insert the template into the view
            this.$el.html(this.template({}));

            // Ensure the view's main element has the given class name
            this.el.classList.add(this.className);

            return this

          }
          catch (error) {
            console.log(
              'There was an error rendering a LayerNavigationView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Trigger an event for the parent view to tell the map widget to zoom to the full
         * extent of this layer or other asset. Also make sure that the layer is visible.
         * If it's not visible after the user clicks the "zoom" button, that could be
         * confusing.
         */
        flyToExtent : function(){
          try {
            // If the opacity is very low, set it to 50%
            if (this.model.get('opacity') < 0.05) {
              this.model.set('opacity', 0.5)
            }
            // Make sure the layer is visible
            if (this.model.get('visible') === false) {
              this.model.set('visible', true)
            }
            this.model.trigger('flyToExtent', this.model)
          }
          catch (error) {
            console.log(
              'There was an error triggering a "flyToExtent" event in a LayerNavigationView' +
              '. Error details: ' + error
            );
          }
        },


      }
    );

    return LayerNavigationView;

  }
);
