
'use strict';

define(
  [
    'jquery',
    'underscore',
    'backbone',
    'collections/maps/AssetCategories',
    // Sub-views
    'views/maps/LayerCategoryItemView',
  ],
  function (
    $,
    _,
    Backbone,
    AssetCategories,
    // Sub-views
    LayerCategoryItemView,
  ) {

    /**
    * @class LayerCategoryListView
    * @classdesc A LayerCategoryListView shows a collection of AssetCategories, each with
    * a MapAssets collection nested under it.
    * @classcategory Views/Maps
    * @name LayerCategoryListView
    * @screenshot views/maps/LayerCategoryListView.png
    * @extends Backbone.View
    //  * @since x.x.x
    * @constructs
    */
    const LayerCategoryListView = Backbone.View.extend(
      /** @lends LayerCategoryListView.prototype */{

        /**
        * The type of View this is
        * @type {string}
        */
        type: 'LayerCategoryListView',

        /**
        * The HTML classes to use for this view's element
        * @type {string}
        */
        className: 'layer-category-list',

        /**
        * The collection of layers to display in the list
        * @type {AssetCategories}
        */
        collection: undefined,

        /**
        * Executed when a new LayerCategoryListView is created
        * @param {Object} options - A literal object with options to pass to the view
        */
        initialize(options) {
          if (options.collection instanceof AssetCategories) {
            this.collection = options.collection.clone();
          }
        },

        /**
        * Renders this view
        * @return {LayerCategoryListView} Returns the rendered view element
        */
        render() {
          if (!this.collection) {
            return;
          }

          // Render a layer item for each layer in the collection
          this.layerCategoryItemViews = this.collection.map(categoryModel => {
            const layerCategoryItemView = new LayerCategoryItemView({model: categoryModel});
            layerCategoryItemView.render();
            this.el.appendChild(layerCategoryItemView.el);
          });

          return this;
        },

        /**
         * Searches and only dispays categories and layers that match the text.
         * @param {string} [text] - The search text from user input.
         * @returns {boolean} - True if a layer item matches the text
         */
        search(text) {
          return this.layerCategoryItemViews.reduce((matched, layerCategoryItem) => {
            return layerCategoryItem.search(text) || matched;
          }, false);
        },
      }
    );

    return LayerCategoryListView;

  }
);
