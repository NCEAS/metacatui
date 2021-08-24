'use strict';

define(
  [
    'jquery',
    'underscore',
    'backbone',
    'cesium',
    'models/maps/Map',
    'text!templates/maps/cesium-widget-view.html'
  ],
  function (
    $,
    _,
    Backbone,
    Cesium,
    Map,
    Template
  ) {

    /**
    * @class CesiumWidgetView
    * @classdesc An interactive 2D and/or 3D map rendered using Cesium
    * @classcategory Views/maps
    * @name CesiumWidgetView
    * @extends Backbone.View
    * @screenshot maps/CesiumWidgetView.png // TODO: add screenshot
    * @constructs
    */
    var CesiumWidgetView = Backbone.View.extend(
      /** @lends CesiumWidgetView.prototype */{

        /**
        * The type of View this is
        * @type {string}
        */
        type: 'CesiumWidgetView',

        /**
        * The HTML classes to use for this view's element
        * @type {string}
        */
        className: 'cesium-widget',

        /**
        * The model that this view uses
        * @type {Map}
        */
        model: null,

        /**
         * The primary HTML template for this view
         * @type {Underscore.template}
         */
        template: _.template(Template),

        /**
        * The events this view will listen to and the associated function to call.
        * @type {Object}
        */
        events: {
          // 'event selector': 'function', 
        },

        /**
         * Key-value pairs that match a Map Asset's type property to the function in this
         * view that creates and renders that asset, given the Map Asset model.
         * @type {Object}
         * @property {string} imagery The name of the function that renders imagery
         * @property {string} data The name of the function that renders vector data to
         * create geometries (e.g. GeoJSON data)
         * @property {string} tileset The name of the function that renders 3D tilesets.
         * @property {string} terrain The name of the function that renders terrain assets
         */
        mapAssetRenderFunctions: {
          imagery: 'renderImagery',
          data: 'renderData',
          tileset: 'render3DTiles',
          terrain: 'renderTerrain'
        },

        /**
        * Executed when a new CesiumWidgetView is created
        * @param {Object} [options] - A literal object with options to pass to the view
        */
        initialize: function (options) {

          // Set the Cesium Ion token (required for some map features)
          Cesium.Ion.defaultAccessToken = MetacatUI.appModel.get('cesiumToken');

          try {
            // Get all the options and apply them to this view
            if (typeof options == 'object') {
              for (const [key, value] of Object.entries(options)) {
                this[key] = value;
              }
            }
          } catch (e) {
            console.log('Failed to initialize a CesiumWidgetView. Error message: ' + e);
          }

        },

        /**
        * Renders this view
        * @return {CesiumWidgetView} Returns the rendered view element
        */
        render: function () {

          try {

            // If Cesium features are disabled in the AppConfig, then exit without rendering
            // anything.
            if (!MetacatUI.appModel.get('enableCesium')) {
              return;
            }

            // Save a reference to this view
            var view = this;

            // Insert the template into the view
            this.$el.html(this.template({}));

            // Ensure the view's main element has the given class name
            this.el.classList.add(this.className);

            // Create the Cesium Widget and save a reference to it to the view
            this.widget = new Cesium.CesiumWidget(this.el, {
              // We will add a base imagery layer after initialization
              imageryProvider: false,
              terrain: false,
              // To make it faster.
              // See https://cesium.com/blog/2018/01/24/cesium-scene-rendering-performance
              requestRenderMode: true,
              // Need to change the following once we support a time component.
              // See https://cesium.com/blog/2018/01/24/cesium-scene-rendering-performance/#handling-simulation-time-changes.
              maximumRenderTimeChange: Infinity,
            });

            // Save references to parts of the widget that the View will access often
            this.scene = this.widget.scene;
            this.camera = this.widget.camera;

            // Go to the home position, if one is set.
            this.showHome()

            // The Cesium Widget will support just one terrain option to start. Later,
            // we'll allow users to switch between terrains if there is more than one.
            var terrains = this.model.get('terrains')
            var terrainModel = terrains ? terrains.first() : false;
            if (terrainModel) {
              var terrainRenderFunction = view[view.mapAssetRenderFunctions.terrain]
              if (!terrainModel.get('cesiumModel')) {
                view.listenTo(terrainModel, 'change:cesiumModel', function () {
                  terrainRenderFunction.call(view, terrainModel)
                })
                terrainModel.createCesiumModel()
              } else {
                terrainRenderFunction.call(view, terrainModel)
              }
            }

            // Render each layer in the Map model. Render using the function configured in
            // the View's mapAssetRenderFunctions property.
            this.model.get('layers').forEach(function (layerModel) {

              var typeCategory = layerModel.get('typeCategory')
              var renderFunction = view[view.mapAssetRenderFunctions[typeCategory]]

              if (!renderFunction || typeof renderFunction !== 'function') {
                console.log(
                  'A create function must be set in the Cesium Widget View for layer' +
                  'models with type: ' + typeCategory + '. A layer will not be shown ' +
                  'for the following layer:', layerModel
                );
              } else if (!layerModel.get('cesiumModel')) {
                view.listenTo(layerModel, 'change:cesiumModel', function () {
                  renderFunction.call(view, layerModel)
                })
                layerModel.createCesiumModel()
              } else {
                renderFunction.call(view, layerModel)
              }

            });

            return this

          }
          catch (error) {
            console.log(
              'Failed to render a CesiumWidgetView. Error details: ' + error
            );
          }
        },

        /**
         * Navigate to the homePosition that's set on the Map.
         */
        showHome: function () {
          try {
            var position = this.model.get('homePosition')

            if (position) {
              
              this.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(
                  position.longitude,
                  position.latitude,
                  position.height
                ),
                orientation: {
                  heading: Cesium.Math.toRadians(position.heading),
                  pitch: Cesium.Math.toRadians(position.pitch),
                  roll: Cesium.Math.toRadians(position.roll)
                }
              });
            }
          }
          catch (error) {
            console.log(
              'There was an error navigating to the home position in a CesiumView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Get the current positioning of the camera in the view.
         * @returns {CameraPosition} Returns an object with the longitude, latitude,
         * height, heading, pitch, and roll in the same format that the Map model uses
         * for the homePosition (see {@link Map#defaults})
         */
        getCurrentPosition: function () {
          try {
            var view = this;
            var cameraPosition = Cesium.Cartographic
              .fromCartesian(view.viewer.camera.position)
            return {
              longitude: cameraPosition.longitude / Math.PI * 180,
              latitude: cameraPosition.latitude / Math.PI * 180,
              height: view.viewer.camera.position.z,
              heading: Cesium.Math.toDegrees(view.viewer.camera.heading),
              pitch: Cesium.Math.toDegrees(view.viewer.camera.pitch),
              roll: Cesium.Math.toDegrees(view.viewer.camera.roll)
            }
          }
          catch (error) {
            console.log(
              'There was an error getting the current position in a CesiumView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Renders peaks and valleys in the 3D version of the map, given a terrain model.
         * @param {Terrain} terrainModel a Terrain Map Asset model
         */
        renderTerrain: function (terrainModel) {
          try {
            var cesiumModel = terrainModel.get('cesiumModel')
            this.scene.terrainProvider = cesiumModel
            this.scene.requestRender();
          }
          catch (error) {
            console.log(
              'There was an error rendering terrain in a CesiumWidgetView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Renders imagery in the Map given a Layer model. Sets listeners to update the
         * imagery when the opacity or visibility changes.
         * @param {Layer} layerModel A Layer Map Asset model
         */
        renderImagery: function (layerModel) {

          var view = this;

          var cesiumModel = layerModel.get('cesiumModel')
          view.scene.imageryLayers.add(cesiumModel)

          // TODO: These listeners could go into the Map Asset models
          this.listenTo(layerModel, 'change:opacity', function (model, opacity) {
            cesiumModel.alpha = opacity
            this.scene.requestRender();
          })
          this.listenTo(layerModel, 'change:visible', function (model, visible) {
            if (visible) {
              cesiumModel.show = true
            } else {
              cesiumModel.show = false
            }
            this.scene.requestRender();
          })
        },

        /**
         * Renders a 3D tileset in the map and sets listeners to update the tileset when
         * the opacity or visibility changes.
         * @param {Layer} layerModel The Map Asset Layer model that contains the
         * information about the 3D tiles to render in the map
         */
        render3DTiles: function (layerModel) {
          try {
            var view = this;

            // Get the cesium tiles
            var cesiumModel = layerModel.get('cesiumModel')
            var initialOpacity = layerModel.get('opacity')

            // TODO: Allow setting a color in the map config

            this.scene.primitives.add(cesiumModel)

            cesiumModel
              .readyPromise
              .then(function () {
                // TODO: remove the 'blue' example that's used here, and allow setting a
                // colour from the Map Asset model
                view.update3DTileStyle(cesiumModel, Cesium.Color.AQUA, initialOpacity)
              })
              .otherwise(function (error) {
                // TODO: Save the error in the model and show error in the Layer Item View
                console.log(error);
              });

            // TODO: These listeners could go into the Map Asset models ?
            this.listenTo(layerModel, 'change:visible', function (model, visible) {
              if (visible) {
                cesiumModel.show = true
              } else {
                cesiumModel.show = false
              }
              // Ensure Cesium re-renders since we're using requestRenderMode
              this.scene.requestRender();
            })
            this.listenTo(layerModel, 'change:opacity', function (model, opacity) {
              this.update3DTileStyle(cesiumModel, null, opacity)
              // Ensure Cesium re-renders since we're using requestRenderMode
              this.scene.requestRender();
            })
          }
          catch (error) {
            console.log(
              'There was an error  in a CesiumWidgetView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Updates the colour and opacity of a 3D tileset
         * @param {Layer} cesiumModel The Layer Map Asset model that contains the 3D tile
         * information of the tilset to update
         * @param {Cesium.Color} newColor The new colour to set the tiles to
         * @param {Number} newOpacity A number between 0 and 1 that represents the new
         * opacity of the tiles
         */
        update3DTileStyle: function (cesiumModel, newColor, newOpacity) {

          try {

            // TODO: Move this into the Map Asset models?

            // Current styles
            var styles = cesiumModel.style;

            // Default color
            var color = Cesium.Color.WHITE.clone()
            // Default opacity
            var currentOpacity = 1

            // Get the current color and opacity, if there is one
            if (styles) {
              if (styles.color) {
                color = styles.color.evaluateColor()
                currentOpacity = color.alpha
              }
            }

            // Create the new styles
            if (newColor) {
              color = newColor
            }

            if (newOpacity) {
              color = color.withAlpha(newOpacity)
            }

            var newStyleProperties = styles || {}
            var newStyles = new Cesium.Cesium3DTileStyle(newStyleProperties);
            newStyles.color = {
              evaluateColor: function (feature, result) {
                return color
              }
            }

            // Set the new styles on the layer
            cesiumModel.style = newStyles
          }
          catch (error) {
            console.log(
              'There was an error updating styles of a 3D tileset in a CesiumWidgetView' +
              '. Error details: ' + error
            );
          }

        },

        /**
         * Renders geometries in the Cesium map based on vector data (e.g. GeoJSON)
         * @param {Layer} layerModel The 'data' type layer model to render
         */
        renderData: function (layerModel) {

          try {

            // This is a WIP and not working yet
            return
            var view = this
            var scene = view.scene
            var cesiumModel = layerModel.get('cesiumModel')

            var dataSourceCollection = new Cesium.DataSourceCollection();
            var dataSourceDisplay = new Cesium.DataSourceDisplay({
              scene: scene,
              dataSourceCollection: dataSourceCollection
            });
            var entities = dataSourceDisplay.defaultDataSource.entities;
            dataSourceCollection.add(cesiumModel)
          }
          catch (error) {
            console.log(
              'There was an error rendering data in a CesiumWidgetView' +
              '. Error details: ' + error
            );
          }

        },


      }
    );

    return CesiumWidgetView;

  }
);
