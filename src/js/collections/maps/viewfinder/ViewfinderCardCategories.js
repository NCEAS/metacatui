"use strict";

define([
  "backbone",
  "models/maps/viewfinder/ViewfinderCardCategory",
  "models/maps/Map",
  "collections/maps/viewfinder/ViewfinderCards",
], (Backbone, ViewfinderCardCategory, MapModel, ViewfinderCards) => {
  /**
   * @classdesc ViewfinderCardCategories is a collection of
   * ViewfinderCardCategory models. Each category groups a ViewfinderCards
   * collection used by the Viewfinder UI. This component was generalized
   * from ZoomPresetsCollection and was renamed for clarity when the
   * zoom presets were deprecated in favor of viewfinder cards in 0.0.0.
   * @classcategory Collections/Maps
   * @class ViewfinderCardCategories
   * @augments Backbone.Collection
   * @since 2.35.0
   * @class
   */
  const ViewfinderCardCategories = Backbone.Collection.extend(
    /** @lends ViewfinderCardCategories.prototype */ {
      /** @inheritdoc */
      model: ViewfinderCardCategory,

      /**
       * Parse raw category configs into attributes for ViewfinderCardCategory
       * models. Ensures the Map model is available to each category.
       * @param {MapConfig#ViewfinderCardCategory[]} resp The raw array of
       * category configs.
       * @param {object} options Options passed to the collection constructor.
       * @param {MapModel} [options.mapModel] The Map model for these cards.
       * @returns {object[]} The parsed attributes for each model.
       */
      parse(resp, options = {}) {
        const { mapModel } = options;
        if (!Array.isArray(resp)) return [];
        return resp.map((attrs) => ({ ...attrs, mapModel }));
      },

      /**
       * Set the parent Map model on each ViewfinderCardCategory in this
       * collection.
       * @param {MapModel} mapModel The Map model that contains these
       * categories.
       */
      setMapModel(mapModel) {
        this.each((categoryModel) => categoryModel.setMapModel(mapModel));
      },

      /**
       * Get a single flattened ViewfinderCards collection from all categories.
       * @returns {ViewfinderCards} A ViewfinderCards collection constructed
       * from the combined models of each category's ViewfinderCards.
       */
      getViewfinderCardsFlat() {
        const models = this.map(
          (cat) => cat.get("viewfinderCards")?.models || [],
        ).flat();
        return new ViewfinderCards(models);
      },

      /**
       * Get an array of ViewfinderCards, one per ViewfinderCardCategory.
       * @returns {ViewfinderCards[]} A list of ViewfinderCards collections.
       */
      getViewfinderCards() {
        return this.map((cat) => cat.get("viewfinderCards"));
      },
    },
  );

  return ViewfinderCardCategories;
});
