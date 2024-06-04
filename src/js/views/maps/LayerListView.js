"use strict";

define([
  "jquery",
  "underscore",
  "backbone",
  "text!templates/maps/layer-list.html",
  // Sub-views
  "views/maps/LayerItemView",
], function (
  $,
  _,
  Backbone,
  Template,
  // Sub-views
  LayerItemView,
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
    /** @lends LayerListView.prototype */ {
      /**
       * The type of View this is
       * @type {string}
       */
      type: "LayerListView",

      /**
       * The HTML classes to use for this view's element
       * @type {string}
       */
      className: "layer-list",

      /**
       * The collection of layers to display in the list
       * @type {MapAssets}
       */
      collection: undefined,

      /**
       * Whether the layer list is a under a category. Flat layer list and categorized
       * layer list are styled differently.
       * @type {boolean}
       */
      isCategorized: undefined,

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
          if (typeof options == "object") {
            for (const [key, value] of Object.entries(options)) {
              this[key] = value;
            }
          }
          this.setListeners();
        } catch (e) {
          console.log(
            "A LayerListView failed to initialize. Error message: " + e,
          );
        }
      },

      /**
       * Remove any event listeners on the collection
       * @since 2.27.0
       */
      removeListeners: function () {
        try {
          if (this.collection) {
            this.stopListening(this.collection);
          }
        } catch (e) {
          console.log("Failed to remove listeners:", e);
        }
      },

      /**
       * Add or remove items from the list when the collection changes
       * @since 2.27.0
       */
      setListeners: function () {
        try {
          if (this.collection) {
            this.listenTo(this.collection, "add remove reset", this.render);
          }
        } catch (e) {
          console.log("Failed to set listeners:", e);
        }
      },

      /**
       * Renders this view
       * @return {LayerListView} Returns the rendered view element
       */
      render: function () {
        this.$el.html(this.template({}));

        // Ensure the view's main element has the given class name
        this.el.classList.add(this.className);

        if (!this.collection) {
          return;
        }

        // Render a layer item for each layer in the collection
        this.layerItemViews = this.collection.reduce((memo, layerModel) => {
          if (layerModel.get("hideInLayerList") === true) {
            // skip this layer
            return memo;
          }
          const layerItem = new LayerItemView({
            model: layerModel,
            isCategorized: this.isCategorized,
          });
          layerItem.render();
          this.el.appendChild(layerItem.el);
          memo.push(layerItem);
          return memo;
        }, []);

        return this;
      },

      /**
       * Searches and only displays layers that match the text.
       * @param {string} [text] - The search text from user input.
       * @returns {boolean} - True if a layer item matches the text
       */
      search(text) {
        return this.layerItemViews.reduce((matched, layerItem) => {
          return layerItem.search(text) || matched;
        }, false);
      },
    },
  );

  return LayerListView;
});
