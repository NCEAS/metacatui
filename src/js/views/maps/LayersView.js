
'use strict';

define(
  [
    'jquery',
    'underscore',
    'backbone',
    'models/maps/Map',
    'text!templates/maps/layers.html',
    // sub-views
    'views/maps/LayerListView'
  ],
  function (
    $,
    _,
    Backbone,
    Map, // TODO
    Template,
    LayerListView
  ) {

    /**
    * @class LayersView
    * @classdesc Displays information about the layers in a Map View, and views to change
    * the properties of each layer.
    * @classcategory Views/Maps
    * @name LayersView
    * @extends Backbone.View
    * @screenshot maps/LayersView.png // TODO: add screenshot
    * @constructs
    */
    var LayersView = Backbone.View.extend(
      /** @lends LayersView.prototype */{

        /**
        * The type of View this is
        * @type {string}
        */
        type: 'LayersView',

        /**
        * The HTML classes to use for this view's element
        * @type {string}
        */
        className: 'layers',

        /**
        * The model that this view uses
        * @type {Map}
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
        * Executed when a new LayersView is created
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
            console.log('A LayersView failed to initialize. Error message: ' + e);
          }

        },

        /**
        * Renders this view
        * @return {LayersView} Returns the rendered view element
        */
        render: function () {

          try {

            // Save a reference to this view
            var view = this;

            // Insert the template into the view
            this.$el.html(this.template({}));

            // Ensure the view's main element has the given class name
            this.el.classList.add(this.className);

            var layerList = this.renderLayerList(this.model.get("layers"));
            this.el.appendChild(layerList.el)

            return this

          }
          catch (error) {
            console.log(
              'There was an error rendering a LayersView' +
              '. Error details: ' + error
            );
          }
        },

        // TODO
        renderLayerList : function(layers){
          try {
            var layerList = new LayerListView({
              collection: layers
            })
            layerList.render()
            return layerList
          }
          catch (error) {
            console.log(
              'There was an error  in a LayersView' +
              '. Error details: ' + error
            );
          }
        },


      }
    );

    return LayersView;

  }
);
