"use strict";

define([
  "underscore",
  "backbone",
  "models/maps/viewfinder/ZoomPresetModel",
], (_, Backbone, ZoomPresetModel) => {
  /**
   * Determine if array is empty. 
   * @param {Array} a The array in question.
   * @returns {boolean} Whether the array is empty. 
   */
  function isNonEmptyArray(a) {
    return a && a.length && Array.isArray(a);
  }

  /**
   * @class ZoomPresets
   * @classdesc A ZoomPresets collection is a group of ZoomPresetModel models
   * that provide a location and list of layers to make visible when the user
   * selects.
   * @class ZoomPresets
   * @classcategory Collections/Maps
   * @augments Backbone.Collection
   * @since 2.29.0
   * @class
   */
  const ZoomPresets = Backbone.Collection.extend(
    /** @lends ZoomPresets.prototype */ {
      /** @inheritdoc */
      model: ZoomPresetModel,

      /**
       * @typedef {object} ZoomPresetsParseOptions
       * @property {object} zoomPresets The raw list of objects that represent
       * the zoom presets, to be converted into ZoomPresetModels.
       * @property {MapAsset[]} allLayers All of the layers available for display
       * in the map.
       */

      /**
       * Parse values and return a list of models for creating a 
       * Backbone.Collection.
       * @param {ZoomPresetsParseOptions} object Values to be parsed into the 
       * Backbone.Collection.
       * @returns {ZoomPresets} A collection of models representative of the 
       * values passed in.
       */
      parse({ zoomPresetObjects, allLayers }) {
        if (isNonEmptyArray(zoomPresetObjects)) {
          const zoomPresets = zoomPresetObjects.map((zoomPresetObj) => {
            const enabledLayerIds = [];
            const enabledLayerLabels = [];
            allLayers.models.forEach(layer => {
              if (
                zoomPresetObj.layerIds?.find(
                  (id) => id === layer.get("layerId"),
                )
              ) {
                enabledLayerIds.push(layer.get("layerId"));
                enabledLayerLabels.push(layer.get("label"));
              }
            });

            return new ZoomPresetModel(
              {
                description: zoomPresetObj.description,
                enabledLayerLabels,
                enabledLayerIds,
                position: {
                  latitude: zoomPresetObj.latitude,
                  longitude: zoomPresetObj.longitude,
                  height: zoomPresetObj.height,
                },
                title: zoomPresetObj.title,
              },
              { parse: true },
            );
          });

          return zoomPresets;
        }

        return [];
      },
    },
  );

  return ZoomPresets;
});
