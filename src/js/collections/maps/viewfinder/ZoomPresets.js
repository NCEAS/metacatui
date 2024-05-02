'use strict';

define(
  [
    'underscore',
    'backbone',
    'models/maps/viewfinder/ZoomPresetModel',
  ],
  function (_, Backbone, ZoomPresetModel) {
    /**
     * @class ZoomPresets
     * @classdesc A ZoomPresets collection is a group of ZoomPresetModel models
     * that provide a location and list of layers to make visible when the user
     * selects.
     * @class ZoomPresets
     * @classcategory Collections/Maps
     * @extends Backbone.Collection
     * @since x.x.x
     * @constructor
     */
    const ZoomPresets = Backbone.Collection.extend(
    /** @lends ZoomPresets.prototype */ {
        /** @inheritdoc */
        model: ZoomPresetModel,

        /**
         * @param {Object[]} zoomPresets The raw list of objects that represent
         * the zoom presets, to be converted into ZoomPresetModels.
         * @param {MapAsset[]} allLayers All of the layers available for display
         * in the map.
         */
        parse({ zoomPresetObjects, allLayers }) {
          if (isNonEmptyArray(zoomPresetObjects)) {
            const zoomPresets = zoomPresetObjects.map(zoomPresetObj => {
              const enabledLayerIds = [];
              const enabledLayerLabels = [];
              for (const layer of allLayers) {
                if (zoomPresetObj.layerIds?.find(id => id === layer.get('layerId'))) {
                  enabledLayerIds.push(layer.get('layerId'));
                  enabledLayerLabels.push(layer.get('label'));
                }
              }

              return new ZoomPresetModel({
                description: zoomPresetObj.description,
                enabledLayerLabels,
                enabledLayerIds,
                position: {
                  latitude: zoomPresetObj.latitude,
                  longitude: zoomPresetObj.longitude,
                  height: zoomPresetObj.height
                },
                title: zoomPresetObj.title,
              }, { parse: true });
            });

            return zoomPresets;
          }

          return [];
        },
      }
    );

    function isNonEmptyArray(a) {
      return a && a.length && Array.isArray(a);
    }

    return ZoomPresets;
  });