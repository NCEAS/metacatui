"use strict";

define([
  "underscore",
  "backbone",
  "collections/maps/AssetCategories",
  "common/IconUtilities",
  // Sub-views
  "views/maps/LayerListView",
  "views/maps/ExpansionPanelView",
  "models/maps/ExpansionPanelsModel",
], (
  _,
  Backbone,
  AssetCategories,
  IconUtilities,
  // Sub-views
  LayerListView,
  ExpansionPanelView,
  ExpansionPanelsModel,
) => {
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
    /** @lends LayerCategoryListView.prototype */ {
      /**
       * The type of View this is
       * @type {string}
       */
      type: "LayerCategoryListView",

      /**
       * The HTML classes to use for this view's element
       * @type {string}
       */
      className: "layer-category-list",

      /**
       * The array of layer categories to display in the list
       * @type {ExpansionPanel[]}
       */
      panels: [],

      /**
       * Executed when a new LayerCategoryListView is created
       * @param {object} options - A literal object with options to pass to the view
       * @param {AssetCategories} options.collection - The collection of AssetCategory to display.
       */
      initialize(options) {
        this.assetCategories = options.collection;
      },

      /**
       * Renders this view
       * @returns {LayerCategoryListView} Returns the rendered view element
       */
      render() {
        if (this.assetCategories instanceof AssetCategories) {
          this.panels = this.assetCategories.map((categoryModel) => {
            const icon = categoryModel.get("icon");
            const panel = new ExpansionPanelView({
              contentViewInstance: new LayerListView({
                collection: categoryModel.get("mapAssets"),
                isCategorized: true,
              }),
              icon,
              isSvgIcon: IconUtilities.isSVG(icon),
              panelsModel: new ExpansionPanelsModel({ isMulti: true }),
              title: categoryModel.get("label"),
            });

            panel.render();
            this.el.appendChild(panel.el);

            return panel;
          });
        }

        return this;
      },

      /**
       * Searches and only dispays categories and layers that match the text.
       * @param {string} [text] - The search text from user input.
       * @returns {boolean} - True if a layer item matches the text
       */
      search(text) {
        return _.reduce(
          this.panels,
          (matched, panel) => {
            const searchResultsFound = panel.contentViewInstance.search(text);
            if (searchResultsFound) {
              panel.$el.show();
              if (text !== "") {
                panel.open();
              } else {
                panel.collapse();
              }
            } else {
              panel.$el.hide();
              panel.collapse();
            }

            return searchResultsFound || matched;
          },
          false,
        );
      },
    },
  );

  return LayerCategoryListView;
});
