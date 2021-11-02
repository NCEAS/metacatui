'use strict';

define(
  [
    'jquery',
    'underscore',
    'backbone',
    'collections/maps/Features',
    'models/maps/Feature',
    'collections/maps/MapAssets',
  ],
  function (
    $,
    _,
    Backbone,
    Features,
    Feature,
    MapAssets,
  ) {
    /**
     * @class Map
     * @classdesc The Map Model contains all of the settings and options for a required to
     * render a map view.
     * @classcategory Models/Maps
     * @name Map
     * @since 2.x.x
     * @extends Backbone.Model
     */
    var Map = Backbone.Model.extend(
      /** @lends Map.prototype */ {

        /**
         * Coordinates that describe a camera position for Cesium
         * @typedef {Object} CameraPosition
         * @property {number} longitude - Longitude of the central home point
         * @property {number} latitude - Latitude of the central home point
         * @property {number} [height] - Height above sea level (meters)
         * @property {number} [heading] -  The rotation about the negative z axis (degrees)
         * @property {number} [pitch] - The rotation about the negative y axis (degrees)
         * @property {number} [roll] - The rotation about the positive x axis (degrees)
         */

        /**
         * Overrides the default Backbone.Model.defaults() function to specify default
         * attributes for the Map
         * @name Map#defaults
         * @type {Object}
         * @property {CameraPosition} homePosition - The position to display when the map
         * initially renders. The home button will also navigate back to this position.
         * @property {MapAssets} terrains - The terrain options to show in the map.
         * @property {MapAssets} layers - The imagery and vector data to render in the
         * map.
         * @property {Features} selectedFeatures - Particular features from one or more
         * layers that are highlighted/selected on the map. The 'selectedFeatures'
         * attribute is updated by the map widget (cesium) with a Feature model when a
         * user selects a geographical feature on the map (e.g. by clicking)
         * @property {Boolean} showToolbar - Whether or not to show the side bar with
         * layer list, etc. True by default.
         * @property {Boolean} showScaleBar - Whether or not to show a scale bar.
         * @property {Boolean} showFeatureInfo - Whether or not to allow users to click on
         * map features to show more information about them.
         * @property {Object} currentScale - An object updated by the map widget that
         * gives two equivalent measurements based on the map's current position and zoom
         * level: The number of pixels on the screen that equal the number of meters on
         * the map/globe.
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
            layers: new MapAssets(),
            terrains: new MapAssets(),
            selectedFeatures: new Features(),
            showToolbar: true,
            showScaleBar: true,
            showFeatureInfo: true,
            currentPosition: {
              longitude: null,
              latitude: null,
              height: null
            },
            currentScale: {
              meters: null,
              pixels: null
            }
          };
        },

        /**
         * initialize - Run when a new Map is created
         */
        initialize: function (attrs, options) {
          try {
            if (attrs) {

              // For now, filter out types that are not supported before initializing any
              // MapAssets collections. TODO: Make this a configurable list somewhere. 
              var supportedTypes = [
                'Cesium3DTileset', 'BingMapsImageryProvider', 'IonImageryProvider',
                'CesiumTerrainProvider'
              ]

              if (attrs.layers && attrs.layers.length && Array.isArray(attrs.layers)) {
                var supportedLayers = _.filter(attrs.layers, function (layer) {
                  return supportedTypes.includes(layer.type)
                })
                this.set('layers', new MapAssets(supportedLayers))
              }

              if (attrs.terrains && attrs.terrains.length && Array.isArray(attrs.terrains)) {
                var supportedTerrains = _.filter(attrs.terrains, function (terrain) {
                  return supportedTypes.includes(terrain.type)
                })
                this.set('terrains', new MapAssets(supportedTerrains))
              }

            }
          }
          catch (error) {
            console.log(
              'There was an error initializing a Map model' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Set or unset the selected Features on the map model. A selected feature is a
         * polygon, line, point, or other element of vector data that is in focus on the
         * map (e.g. because a user clicked it to show more details.)
         * @param {Feature|Object[]} features - An array of Feature models or objects with
         * attributes to set on new Feature models. If no features argument is passed to
         * this function, then any currently selected feature will be removed (as long as
         * replace is set to true)
         * @param {Boolean} [replace=true] - If true, any currently selected features will
         * be replaced with the newly selected features. If false, then the newly selected
         * features will be added to any that are currently selected.
         * @returns 
         */
        selectFeatures(features, replace = true) {
          try {

            const model = this;
            const defaults = new Feature().defaults()

            if (!model.get('selectedFeatures')) {
              model.set('selectedFeatures', new Features())
            }
            
            // If no feature is passed to this function (and replace is true), then empty
            // the Features collection
            if (!features || !Array.isArray(features)) {
              features = []
            }

            // If feature is a Feature model, get the attributes to update the model.
            features.forEach(function (feature, i) {
              if (feature instanceof Feature) {
                feature = feature.attributes
              }
              features[i] = _.extend(_.clone(defaults), feature)
            })

            // Update the Feature model with the new selected feature information
            const selectedFeatures = model.get('selectedFeatures')

            if (replace) {
              selectedFeatures.reset(null, { silent: true })
            }

            selectedFeatures.add(features,  { silent: true })

            // The update should only trigger one event
            selectedFeatures.trigger('update')

          }
          catch (error) {
            console.log(
              'Failed to select a Feature in a Map model' +
              '. Error details: ' + error
            );
          }
        },


      });

    return Map;
  });
