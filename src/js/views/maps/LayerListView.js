
'use strict';

define(
  [
    'jquery',
    'underscore',
    'backbone',
    'text!templates/maps/layer-list.html',
    // Sub-views
    'views/maps/LayerItemView'
  ],
  function (
    $,
    _,
    Backbone,
    Template,
    // Sub-views
    LayerItemView
  ) {

    /**
    * @class LayerListView
    * @classdesc A Layer List shows a collection of Map Assets, like imagery and vector
    * layers. Each Map Asset in the collection is rendered as a single item in the list.
    * Each item can be clicked for more details.
    * @classcategory Views/Maps
    * @name LayerListView
    * @extends Backbone.View
    * @screenshot views/maps/LayerListView.png
    * @since 2.18.0
    * @constructs
    */
    var LayerListView = Backbone.View.extend(
      /** @lends LayerListView.prototype */{

        /**
        * The type of View this is
        * @type {string}
        */
        type: 'LayerListView',

        /**
        * The HTML classes to use for this view's element
        * @type {string}
        */
        className: 'layer-list',

        /**
        * The collection of layers to display in the list
        * @type {MapAssets}
        */
        collection: undefined,

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
        * Executed when a new LayerListView is created
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
            console.log('A LayerListView failed to initialize. Error message: ' + e);
          }

        },

        /**
        * Renders this view
        * @return {LayerListView} Returns the rendered view element
        */
        render: function () {

          try {

            // Save a reference to this view
            var view = this;

            // Insert the template into the view
            this.$el.html(this.template({}));

            // Ensure the view's main element has the given class name
            this.el.classList.add(this.className);

            if (!this.collection) {
              return
            }

            // Render a layer item for each layer in the collection
            this.collection.forEach(function (layerModel) {
              var layerItem = new LayerItemView({
                model: layerModel
              })
              layerItem.render();
              view.el.appendChild(layerItem.el)
            })

            return this

          }
          catch (error) {
            console.log(
              'There was an error rendering a LayerListView' +
              '. Error details: ' + error
            );
          }
        },


      }
    );

    return LayerListView;

  }
);
