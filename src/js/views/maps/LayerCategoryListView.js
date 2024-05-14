"use strict";

define(
  [
    'jquery',
    'underscore',
    'backbone',
    'collections/maps/AssetCategories',
    'common/IconUtilities',
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
    IconUtilities,
    // Sub-views
    LayerListView,
    ExpansionPanelView,
    ExpansionPanelsModel,
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
        * @type {ExpansionPanel[]}
        */
        panels: undefined,

        /**
        * Executed when a new LayerCategoryListView is created
        * @param {Object} options - A literal object with options to pass to the view
        */
        initialize(options) {
          if (options.collection instanceof AssetCategories) {
            this.panelsModel = new ExpansionPanelsModel({ isMulti: true });

            this.panels = options.collection.map(categoryModel => {
              const icon = categoryModel.get('icon');
              return new ExpansionPanelView({
                contentViewInstance: new LayerListView({
                  collection: categoryModel.get('mapAssets'),
                  isCategorized: true,
                }),
                icon,
                isSvgIcon: IconUtilities.isSVG(icon),
                panelsModel: this.panelsModel,
                title: categoryModel.get('label'),
              });
            });
          }
        },

        /**
        * Renders this view
        * @return {LayerCategoryListView} Returns the rendered view element
        */
        render() {
          this.panels = _.forEach(this.panels, panel => {
            panel.render();
            this.el.appendChild(panel.el);
          });

        return this;
      },

        /**
         * Searches and only dispays categories and layers that match the text.
         * @param {string} [text] - The search text from user input.
         * @returns {boolean} - True if a layer item matches the text
         */
        search(text) {
          return _.reduce(this.panels, (matched, panel) => {
            const searchResultsFound = panel.contentViewInstance.search(text);
            if (searchResultsFound) {
              panel.$el.show();
              if (text !== '') {
                panel.open();
              } else {
                panel.collapse();
              }
            } else {
              panel.$el.hide();
              panel.collapse();
            }

            return searchResultsFound || matched;
          }, false);
        },
      }
    );

  return LayerCategoryListView;
});
