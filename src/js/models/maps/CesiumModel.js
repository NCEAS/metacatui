/* global define */
define(
  ['jquery', 'underscore', 'backbone', 'nGeohash'],
  function ($, _, Backbone, nGeohash) {
    "use strict";

    /**
     * @class CesiumModel
     * @classdesc  The Map Model represents all of the settings and options for a Cesium
     * Map.
     * @classcategory Models/Maps
     * @name CesiumModel
     * @since 2.x.x
     * @extends Backbone.Model
     */
    var CesiumModel = Backbone.Model.extend(
      /** @lends CesiumModel.prototype */ {

        /**
         * Coordinates that describe a camera position for Cesium
         * @typedef {Object} CameraPosition
         * @property {number} longitude - Longitude of the central home point
         * @property {number} latitude - Latitude of the central home point
         * @property {number} height - Height above sea level (meters)
         * @property {number} heading -  The rotation about the negative z axis (degrees)
         * @property {number} pitch - The rotation about the negative y axis (degrees)
         * @property {number} roll - The rotation about the positive x axis (degrees)
         */

        /**
         * Overrides the default Backbone.Model.defaults() function to
         * specify default attributes for the CesiumModel
         * @name CesiumModel#defaults
         * @type {Object}
         * @property {CameraPosition} homePosition - The position to display when the map
         * initially renders. The home button will also navigate back to this position.
        */
        defaults: function () {
          // TODO: Decide on reasonable default values.
          // These defaults are test values for development only.
          return {
            homePosition: {
              longitude: -65,
              latitude: 56,
              height: 10000000,
              heading: 1,
              pitch: -90,
              roll: 0,
            },
            baseLayers: [
              {
                label: 'My Bing Map',
                type: 'BingMapsImageryProvider',
                options:
                {
                  url: 'https://dev.virtualearth.net',
                  key: 'AtZec2nkf_e5N2FcCAO_1JYafsvAjUx81BJLwHVv6CDnHyabkyIlk6MJdt5CB7xs',
                  mapStyle: 'AERIAL' // Must be set to Cesium.BingMapsStyle.AERIAL
                }
              },
              {
                label: 'Bing Maps Road',
                type: 'createWorldImagery',
                options: {
                  style: 'ROAD' // Must be set to Cesium.IonWorldImageryStyle.ROAD
                }
              },
              {
                label: 'ArcGIS Street',
                type: 'ArcGisMapServerImageryProvider',
                options: {
                  url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer'
                }
              },
              {
                label: 'OpenStreetMaps',
                type: 'OpenStreetMapImageryProvider',
                options: {}
              },
              {
                label: 'Stamen Maps',
                type: 'OpenStreetMapImageryProvider',
                options: {
                  url: "https://stamen-tiles.a.ssl.fastly.net/watercolor/",
                  fileExtension: "jpg",
                  credit: "Map tiles by Stamen Design, under CC BY 3.0. Data by OpenStreetMap, under CC BY SA."
                }
              },
              {
                label: 'Natural Earth II (Local)',
                type: 'TileMapServiceImageryProvider',
                options: {
                  url: MetacatUI.root + "/components/Cesium/Assets/Textures/NaturalEarthII"
                }
              },
              {
                label: 'USGS Shaded Relief (via WMTS)',
                type: 'WebMapTileServiceImageryProvider',
                options: {
                  url: 'https://basemap.nationalmap.gov/arcgis/rest/services/USGSShadedReliefOnly/MapServer/WMTS',
                  layer: "USGSShadedReliefOnly",
                  style: "default",
                  format: "image/jpeg",
                  tileMatrixSetID: "default028mm",
                  maximumLevel: 19,
                  credit: "U. S. Geological Survey",

                }
              },
            ],
            dataLayers: [
              {
                label: 'United States GOES Infrared',
                type: 'WebMapServiceImageryProvider',
                options: {
                  url: 'https://mesonet.agron.iastate.edu/cgi-bin/wms/goes/conus_ir.cgi?',
                  layers: 'goes_conus_ir',
                  credit: 'Infrared data courtesy Iowa Environmental Mesonet',
                  parameters: {
                    transparent: 'true',
                    format: 'image/png',
                  },
                }
              },
              {
                label: 'United States Weather Radar',
                type: 'WebMapServiceImageryProvider',
                options: {
                  url: 'https://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0r.cgi?',
                  layers: 'nexrad-n0r',
                  credit: 'Radar data courtesy Iowa Environmental Mesonet',
                  parameters: {
                    transparent: 'true',
                    format: 'image/png',
                  },
                }
              },
              {
                label: 'Grid',
                type: 'GridImageryProvider',
                options: {}
              },
              {
                label: 'Tile Coordinates',
                type: 'TileCoordinatesImageryProvider',
                options: {}
              },
            ]
          };
        },

        /**
         * initialize - Run when a new CesiumModel is created
         */
        initialize: function (attrs, options) {
        },

        /**
         * This function will return the appropriate geohash level to use for mapping
         * geohash tiles on the map at the specified altitude (zoom level).
         * @param {Number} altitude The distance from the surface of the earth in meters
         * @returns The geohash level, an integer between 0 and 9.
         */
        determineGeohashLevel: function (altitude) {
          try {
            // map of precision integer to minimum altitude
            const precisionAltMap = {
              "1": 6000000,
              "2": 4000000,
              "3": 1000000,
              "4": 100000,
              "5": 0
            }
            const precision = _.findKey(precisionAltMap, function (minAltitude) {
              return altitude >= minAltitude
            })
            return Number(precision)
          }
          catch (error) {
            console.log(
              'There was an error getting the geohash level from altitude in a CesiumModel' +
              'Returning level 1 by default. ' +
              '. Error details: ' + error
            );
            return 1
          }
        },

        /**
         *
         * @param {Number} south The south-most coordinate of the area to get geohashes for
         * @param {Number} west The west-most coordinate of the area to get geohashes for
         * @param {Number} north The north-most coordinate of the area to get geohashes for
         * @param {Number} east The east-most coordinate of the area to get geohashes for
         * @param {Number} precision An integer between 1 and 9 representing the geohash
         * @param {Boolean} boundingBoxes Set to true to return the bounding box for each geohash
         * level to show
         */
        getGeohashes: function (south, west, north, east, precision, boundingBoxes = false) {
          try {
            // Get all the geohash tiles contained in the map bounds
            var geohashes = nGeohash.bboxes(
              south, west, north, east, precision
            )
            // If the boundingBoxes option is set to false, then just return the list of
            // geohashes
            if (!boundingBoxes) {
              return geohashes
            }
            // Otherwise, return the bounding box for each geohash as well
            var boundingBoxes = []
            geohashes.forEach(function (geohash) {
              boundingBoxes[geohash] = nGeohash.decode_bbox(geohash)
            })
            return boundingBoxes
          }
          catch (error) {
            console.log(
              'There was an error getting geohashes in a CesiumModel' +
              '. Error details: ' + error
            );
          }
        },


      });

    return CesiumModel;
  });
