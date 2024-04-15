"use strict";

define([
  "backbone",
  "models/maps/AssetCategory",
  "models/maps/Map",
  "collections/maps/MapAssets",
], function (
  Backbone,
  AssetCategory,
  MapModel,
  MapAssets,
) {
  /**
   * @classdesc AssetCategories collection is a group of AssetCategory models - models
   * that provide the information required to render geo-spatial data in categories,
   * including people, infrastructure, permafrost, etc.
   * @classcategory Collections/Maps
   * @class AssetCategories
   * @extends Backbone.Collection
   * @since 2.28.0
   * @constructor
   */
  const AssetCategories = Backbone.Collection.extend(
    /** @lends AssetCategories.prototype */ {

      /** @inheritdoc */
      model: AssetCategory,

      /**
       * Set the parent map model on each of the AssetCategory models in this
       * collection. This must be the Map model that contains this asset
       * collection.
       * @param {MapModel} mapModel The map model to set on each of the AssetCategory
       * models
       */
      setMapModel(mapModel) {
        this.each(assetCategoryModel => assetCategoryModel.setMapModel(mapModel));
      },

      /** 
       * Gets an array of MapAssets, one from each AssetCategory model.
       * @returns {MapAssets[]}
       */
      getMapAssets() {
        return this.map(assetCategory => {
          return assetCategory.get("mapAssets");
        });
      }
    }
  );

  return AssetCategories;
});
