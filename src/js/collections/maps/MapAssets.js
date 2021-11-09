'use strict';

define(
  [
    'jquery',
    'underscore',
    'backbone',
    'models/maps/assets/MapAsset',
    'models/maps/assets/Cesium3DTileset',
    'models/maps/assets/CesiumImagery',
    'models/maps/assets/CesiumTerrain',
  ],
  function (
    $,
    _,
    Backbone,
    MapAsset,
    Cesium3DTileset,
    CesiumImagery,
    CesiumTerrain
  ) {

    /**
     * @class MapAssets
     * @classdesc A MapAssets collection is a group of MapAsset models - models that
     * provide the information required to render geo-spatial data on a map, including
     * imagery (raster), vector, and terrain data.
     * @class MapAssets
     * @classcategory Collections/Maps
     * @extends Backbone.Collection
     * @since 2.x.x
     * @constructor
     */
    var MapAssets = Backbone.Collection.extend(
      /** @lends MapAssets.prototype */ {

        /**
         * Creates the type of Map Asset based on the given type. This function is
         * typically not called directly. It is used by Backbone.js when adding a new
         * model to the collection.
         * @param {MapConfig#MapAssetConfig} assetConfig - An object that configured the
         * source the asset data, as well as metadata and display properties of the asset.
         * @returns {(Cesium3DTileset|CesiumImagery|CesiumTerrain)} Returns a MapAsset
         * model
        */
        model: function (assetConfig) {
          try {

            // Supported types: Matches each 'type' attribute to the appropriate MapAsset
            // model. See also CesiumWidgetView.mapAssetRenderFunctions
            var mapAssetTypes = [
              {
                types: ['Cesium3DTileset'],
                model: Cesium3DTileset
              },
              {
                types: ['BingMapsImageryProvider', 'IonImageryProvider'],
                model: CesiumImagery
              },
              {
                types: ['CesiumTerrainProvider'],
                model: CesiumTerrain
              }
            ];
              
            var type = assetConfig.type
            var modelOption = _.find(mapAssetTypes, function (option) {
              return option.types.includes(type)
            })

            // Don't add an unsupported type to  the collection
            if (modelOption) {
              return new modelOption.model(assetConfig)
            } else {
              // Return a generic MapAsset as a default
              return new MapAsset(assetConfig)
            }

          }
          catch (error) {
            console.log(
              'Failed to add a new model to a MapAssets collection' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Executed when a new MapAssets collection is created.
         */
        initialize: function () {
          try {

            // Only allow one Map Asset in the collection to be selected at a time. When a
            // Map Asset model's 'selected' attribute is changed to true, change all of the
            // other models' selected attributes to false.
            this.stopListening(this, 'change:selected');
            this.listenTo(this, 'change:selected', function (changedAsset, newValue) {
              if (newValue === true) {
                var otherModels = this.reject(function (assetModel) {
                  return assetModel === changedAsset
                })
                otherModels.forEach(function (otherModel) {
                  otherModel.set('selected', false)
                })
              }
            })
          }
          catch (error) {
            console.log(
              'There was an error initializing a MapAssets collection' +
              '. Error details: ' + error
            );
          }
        },

      }
    );

    return MapAssets;

  }
);