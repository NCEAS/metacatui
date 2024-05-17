"use strict";

define(
  [
    'jquery',
    'underscore',
    'backbone',
    'collections/maps/AssetCategories',
    // Sub-views
    'views/maps/LayerListView',
    'views/maps/ExpansionPanelView',
    'models/maps/ExpansionPanelsModel',
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
    * @since 2.28.0
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
      className: "layer-category-list",

      /**
       * The array of layer categories to display in the list
       * @type {LayerCategoryItemView[]}
       */
      layerCategoryItemViews: undefined,

      /**
       * Executed when a new LayerCategoryListView is created
       * @param {Object} options - A literal object with options to pass to the view
       */
      initialize(options) {
        if (options.collection instanceof AssetCategories) {
          this.layerCategoryItemViews = options.collection.map(
            (categoryModel) => {
              return new LayerCategoryItemView({ model: categoryModel });
            },
          );
        }
      },

      /**
       * Renders this view
       * @return {LayerCategoryListView} Returns the rendered view element
       */
      render() {
        this.layerCategoryItemViews = _.forEach(
          this.layerCategoryItemViews,
          (layerCategoryItemView) => {
            layerCategoryItemView.render();
            this.el.appendChild(layerCategoryItemView.el);
          },
        );

        return this;
      },

      /**
       * Searches and only dispays categories and layers that match the text.
       * @param {string} [text] - The search text from user input.
       * @returns {boolean} - True if a layer item matches the text
       */
      search(text) {
        return _.reduce(
          this.layerCategoryItemViews,
          (matched, layerCategoryItem) => {
            return layerCategoryItem.search(text) || matched;
          },
          false,
        );
      },
    },
  );

  return LayerCategoryListView;
});
