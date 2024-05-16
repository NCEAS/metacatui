'use strict';

define(
  [
    'jquery',
    'underscore',
    'backbone',
    'cesium',
    'models/maps/assets/MapAsset',
    'TiffImageryProvider',
  ],
  function (
    $,
    _,
    Backbone,
    Cesium,
    MapAsset,
    { TIFFImageryProvider },
  ) {
    var GeoTIFFImagery = MapAsset.extend(
      /** @lends CesiumTerrain.prototype */ {

        /**
         * The name of this type of model
         * @type {string}
        */
        type: 'GeoTIFFImagery',

        async initialize(assetConfig) {
          console.log({ TIFFImageryProvider });
          try {
            MapAsset.prototype.initialize.call(this, assetConfig);

            const provider = await TIFFImageryProvider.fromUrl(
              assetConfig.cesiumOptions.url,
              {
                renderOptions: {
                  single: {
                    "colors": [
                      [1, "rgb(154, 206, 127)"],
                      [2, "rgb(163, 214, 245)"],
                      [3, "rgb(255, 251, 177)"],
                      [4, "rgb(193, 114, 97)"],
                      [5, "rgb(220, 100, 120)"],
                      [6, "rgb(49, 173, 105)"]
                    ],
                    type: "discrete",
                    useRealValue: true // use real value in colors stops
                  }
                }
              }
            );
            this.set('cesiumModel', provider)
            console.log("set the status as ready");
            this.set('status', 'ready')
          }
          catch (e) {
            console.log('Error initializing a GeoTIFFImagery model: ', e);
          }
        },

      });
    return GeoTIFFImagery;
  });
