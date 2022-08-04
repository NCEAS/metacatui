'use strict';

define(
  [
    'jquery',
    'underscore',
    'backbone',
    'models/maps/assets/MapAsset',
    'models/maps/assets/Cesium3DTileset',
    'models/maps/assets/CesiumVectorData',
    'models/maps/assets/CesiumImagery',
    'models/maps/assets/CesiumTerrain',
    'models/maps/assets/CesiumGeohash'
  ],
  function (
    $,
    _,
    Backbone,
    MapAsset,
    Cesium3DTileset,
    CesiumVectorData,
    CesiumImagery,
    CesiumTerrain,
    CesiumGeohash
  ) {

    /**
     * @class MapAssets
     * @classdesc A MapAssets collection is a group of MapAsset models - models that
     * provide the information required to render geo-spatial data on a map, including
     * imagery (raster), vector, and terrain data.
     * @class MapAssets
     * @classcategory Collections/Maps
     * @extends Backbone.Collection
     * @since 2.18.0
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
         * @returns {(Cesium3DTileset|CesiumImagery|CesiumTerrain|CesiumVectorData)}
         * Returns a MapAsset model
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
                types: ['GeoJsonDataSource'],
                model: CesiumVectorData
              },
              {
                types: ['BingMapsImageryProvider', 'IonImageryProvider', 'WebMapTileServiceImageryProvider', 'TileMapServiceImageryProvider', 'NaturalEarthII'],
                model: CesiumImagery
              },
              {
                types: ['CesiumTerrainProvider'],
                model: CesiumTerrain
              },
              {
                types: ['CesiumGeohash'],
                model: CesiumGeohash
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

        /**
         * Set the parent map model on each of the MapAsset models in this collection.
         * This must be the Map model that contains this asset collection.
         * @param {MapModel} mapModel The map model to set on each of the MapAsset models
         */
        setMapModel: function (mapModel) {
          try {
            this.each(function (mapAssetModel) {
              mapAssetModel.set('mapModel', mapModel)
            })
          }
          catch (error) {
            console.log(
              'Failed to set the map model on a MapAssets collection' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Get a list of MapAsset models from this collection that are of a
         * given type.
         * @param {'Cesium3DTileset'|'CesiumVectorData'|'CesiumImagery'|'CesiumTerrain'} assetType -
         * The general type of asset to filter the collection by.
         * @returns {MapAsset[]} - Returns an array of MapAsset models that are
         * instances of the given asset type.
         * @since x.x.x
         */
        getAll: function (assetType) {
          try {
            // map strings to the models they represent
            var assetTypeMap = {
              'Cesium3DTileset': Cesium3DTileset,
              'CesiumVectorData': CesiumVectorData,
              'CesiumImagery': CesiumImagery,
              'CesiumTerrain': CesiumTerrain
            }
            if (assetType) {
              return this.filter(function (assetModel) {
                return assetModel instanceof assetTypeMap[assetType]
              })
            } else {
              return this.models
            }
          }
          catch (error) {
            console.log(
              'Failed to get all of the MapAssets in a MapAssets collection' +
              '. Error details: ' + error +
              '\n\n' +
              'Returning all models in the asset collection.'
            );
            return this.models
          }
        }

      }
    );

    return MapAssets;

  }
);