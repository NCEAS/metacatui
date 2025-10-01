"use strict";

define([
  "backbone",
  "models/maps/viewfinder/ZoomPresetCategory",
  "models/maps/Map",
  "collections/maps/viewfinder/ZoomPresets",
], (Backbone, ZoomPresetCategory, MapModel, ZoomPresets) => {
  /**
   * @classdesc ZoomPresetCategories is a collection of ZoomPresetCategory
   * models. Each category groups a ZoomPresets collection used by the
   * Viewfinder UI.
   * @classcategory Collections/Maps
   * @class ZoomPresetCategories
   * @augments Backbone.Collection
   * @since 2.35.0
   * @class
   */
  const ZoomPresetCategories = Backbone.Collection.extend(
    /** @lends ZoomPresetCategories.prototype */ {
      /** @inheritdoc */
      model: ZoomPresetCategory,

      /**
       * Parse raw category configs into attributes for ZoomPresetCategory
       * models. Ensures the Map model is available to each category.
       * @param {MapConfig#ZoomPresetCategory[]} resp The raw array of category
       * configs.
       * @param {object} options Options passed to the collection constructor.
       * @param {MapModel} [options.mapModel] The Map model for these presets.
       * @returns {object[]} The parsed attributes for each model.
       */
      parse(resp, options = {}) {
        const { mapModel } = options;
        if (!Array.isArray(resp)) return [];
        return resp.map((attrs) => ({ ...attrs, mapModel }));
      },

      /**
       * Set the parent Map model on each ZoomPresetCategory in this collection.
       * @param {MapModel} mapModel The Map model that contains these
       * categories.
       */
      setMapModel(mapModel) {
        this.each((categoryModel) => categoryModel.setMapModel(mapModel));
      },

      /**
       * Get a single flattened ZoomPresets collection from all categories.
       * @returns {ZoomPresets} A ZoomPresets collection constructed from the
       * combined models of each category's ZoomPresets.
       */
      getZoomPresetsFlat() {
        const models = this.map(
          (cat) => cat.get("zoomPresets")?.models || [],
        ).flat();
        return new ZoomPresets(models);
      },

      /**
       * Get an array of ZoomPresets, one per ZoomPresetCategory.
       * @returns {ZoomPresets[]} A list of ZoomPresets collections.
       */
      getZoomPresets() {
        return this.map((cat) => cat.get("zoomPresets"));
      },
    },
  );

  return ZoomPresetCategories;
});
