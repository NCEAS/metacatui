'use strict';

define(
  [
    'jquery',
    'underscore',
    'backbone',
    'cesium',
    'models/maps/Map',
    'models/maps/assets/MapAsset',
    'models/maps/assets/Cesium3DTileset',
    'text!templates/maps/cesium-widget-view.html'
  ],
  function (
    $,
    _,
    Backbone,
    Cesium,
    Map,
    MapAsset,
    Cesium3DTileset,
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
        * The HTML classes to use for this view's element. Note that the first child
        * element added to this view by cesium will have the class "cesium-widget".
        * @type {string}
        */
        className: 'cesium-widget-view',

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

        // /**
        // * The events this view will listen to and the associated function to call.
        // * @type {Object}
        // */
        // events: {
        //   // 'event selector': 'function', 
        // },

        /**
         * An array of objects the match a Map Asset's type property to the function in
         * this view that adds and renders that asset on the map, given the Map Asset
         * model. Each object in the array has two properties: 'types' and
         * 'renderFunction'.
         * @type {Object[]}
         * @property {string[]} types The list of types that can be added to the map given
         * the renderFunction
         * @property {string} renderFunction The name of the function in the view that
         * will add the asset to the map and render it, when passed the MapAsset model
         */
        mapAssetRenderFunctions: [
          {
            types: ['Cesium3DTileset'],
            renderFunction: 'add3DTileset'
          },
          {
            types: ['BingMapsImageryProvider', 'IonImageryProvider'],
            renderFunction: 'addImagery'
          },
          {
            types: ['CesiumTerrainProvider'],
            renderFunction: 'updateTerrain'
          }
        ],

        /**
         * The border color to use on vector features that a user clicks.
         * See {@link https://cesium.com/learn/cesiumjs/ref-doc/Color.html?classFilter=color}
         * @type {Cesium.Color}
         */
        highlightBorderColor: Cesium.Color.WHITE,

        /**
        * Executed when a new CesiumWidgetView is created
        * @param {Object} [options] - A literal object with options to pass to the view
        */
        initialize: function (options) {
          try {

            // Set the Cesium Ion token (required for some map features)
            Cesium.Ion.defaultAccessToken = MetacatUI.appModel.get('cesiumToken');

            // Get all the options and apply them to this view
            if (typeof options == 'object') {
              for (const [key, value] of Object.entries(options)) {
                this[key] = value;
              }
            }

            // Make sure that there is a Map model and that it has a selectedFeature
            // attribute. The selectedFeature attribute is used to store information about
            // the vector feature, if any, that is currently in focus on the map.
            if (!this.model) {
              this.model = new Map()
            }
            if (!this.model.get('selectedFeature')) {
              this.model.selectFeature()
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
            view.$el.html(view.template({}));

            // Ensure the view's main element has the given class name
            view.el.classList.add(view.className);

            // Create the Cesium Widget and save a reference to it to the view
            view.widget = new Cesium.CesiumWidget(view.el, {
              // We will add a base imagery layer after initialization
              imageryProvider: false,
              terrain: false,
              // Use explicit rendering to make the widget must faster.
              // See https://cesium.com/blog/2018/01/24/cesium-scene-rendering-performance
              requestRenderMode: true,
              // Need to change the following once we support a time/clock component.
              // See https://cesium.com/blog/2018/01/24/cesium-scene-rendering-performance/#handling-simulation-time-changes.
              maximumRenderTimeChange: Infinity
            });

            // Save references to parts of the widget that the view will access often
            view.scene = view.widget.scene;
            view.camera = view.widget.camera;
            view.inputHandler = view.widget.screenSpaceEventHandler;

            // Disable HDR lighting for better performance and to avoid changing imagery colors.
            view.scene.highDynamicRange = false;
            view.scene.globe.enableLighting = false;

            // Keep all parts of the globe lit regardless of what time the Cesium clock is
            // set to. This avoids data and imagery appearing too dark.
            view.scene.light = new Cesium.DirectionalLight({
              direction: new Cesium.Cartesian3(1, 0, 0)
            });
            view.scene.preRender.addEventListener(function (scene, time) {
              view.scene.light.direction = Cesium.Cartesian3.clone(
                scene.camera.directionWC, view.scene.light.direction
              );
            });

            // Go to the home position, if one is set.
            view.flyHome()

            // If users are allowed to click on features for more details, initialize
            // picking behaviour on the map
            if (view.model.get('showFeatureInfo')) {
              view.initializePicking()
            }

            // If the scale bar is showing, then get the coordinates when the mouse moves
            if (view.model.get('showScaleBar')) {
              view.setMouseCoordinateListener()
              view.setCameraListener()
            }

            // The Cesium Widget will support just one terrain option to start. Later,
            // we'll allow users to switch between terrains if there is more than one.
            var terrains = view.model.get('terrains')
            var terrainModel = terrains ? terrains.first() : false;
            if (terrainModel) {
              var type = terrainModel.get('type')
              var renderOption = _.find(
                view.mapAssetRenderFunctions,
                function (option) {
                  return option.types.includes(type)
                }
              )
              if (renderOption) {
                const terrainRenderFunction = view[renderOption.renderFunction]
                terrainRenderFunction.call(view, terrainModel)
              }
            }

            // When the appearance of a layer has been updated, then tell Cesium to
            // re-render the scene. Each layer model triggers the 'appearanceChanged'
            // function whenever the color, opacity, etc. has been updated in the
            // associated Cesium model.
            view.stopListening(view.model.get('layers'), 'appearanceChanged')
            view.listenTo(view.model.get('layers'), 'appearanceChanged', view.requestRender)

            // Other views may trigger an event on the layer/asset model that indicates
            // that the map should navigate to the extent of the data
            view.stopListening(view.model.get('layers'), 'flyToExtent')
            view.listenTo(view.model.get('layers'), 'flyToExtent', view.flyTo)

            // Add each layer from the Map model to the Cesium widget. Render using the
            // function configured in the View's mapAssetRenderFunctions property.
            view.model.get('layers').forEach(function (layerModel) {
              var type = layerModel.get('type')
              var renderOption = _.find(
                view.mapAssetRenderFunctions,
                function (option) {
                  return option.types.includes(type)
                }
              )
              var renderFunction = view[renderOption.renderFunction]

              if (!renderFunction || typeof renderFunction !== 'function') {
                console.log(
                  'A create function must be set in the Cesium Widget View for layer' +
                  'models with type: ' + type + '. A layer will not be shown ' +
                  'for the following layer:', layerModel
                );
              } else {
                // Do not immediately render layers that are initially invisible
                if (layerModel.get('visible')) {
                  renderFunction.call(view, layerModel)
                } else {
                  // Start rendering the layer once it is set to visible in the map
                  view.listenToOnce(layerModel, 'change:visible', function () {
                    renderFunction.call(view, layerModel)
                  })
                }
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
         * Because the Cesium widget is configured to use explicit rendering (see
         * {@link https://cesium.com/blog/2018/01/24/cesium-scene-rendering-performance/}),
         * we need to tell Cesium when to render a new frame if it's not one of the cases
         * handle automatically. This function tells the Cesium scene to render, but is
         * limited by the underscore.js debounce function to only happen a maximum of once
         * every 50 ms (see {@link https://underscorejs.org/#debounce}).
         */
        requestRender: _.debounce(function () {
          this.scene.requestRender()
        }, 50),

        /**
         * Set up the Cesium scene and set listeners and behaviour that enable users to
         * click on vector features on the map to view more information about them.
         */
        initializePicking: function () {
          try {
            // Save a reference to this view the Cesium scene
            var view = this;
            var scene = this.scene

            // To add an outline to 3D tiles in Cesium, we 'silhouette' them. Set up the the
            // scene to support silhouetting.
            view.silhouettes = Cesium.PostProcessStageLibrary.createEdgeDetectionStage();
            view.silhouettes.uniforms.color = view.highlightBorderColor;
            view.silhouettes.uniforms.length = 0.02;
            view.silhouettes.selected = [];

            scene.postProcessStages.add(
              Cesium.PostProcessStageLibrary.createSilhouetteStage([view.silhouettes])
            );

            // When the Map model's selectedFeature attribute changes, update which
            // features are highlighted on the map.
            var setSelectedFeatureListeners = function () {
              var selectedFeature = view.model.get('selectedFeature')
              view.stopListening(selectedFeature, 'change')
              view.listenTo(selectedFeature, 'change', view.highlightSelectedFeature)
            }
            setSelectedFeatureListeners()

            // If the Selected Feature model is ever completely replaced for any reason,
            // make sure to reset the listeners onto the new Feature model
            view.stopListening(view.model, 'change:selectedFeature')
            view.listenTo(view.model, 'change:selectedFeature', setSelectedFeatureListeners)

            // Change cursor to pointer when the mouse is over a vector feature. Change it
            // back to the default when the mouse leaves a feature.
            view.inputHandler.setInputAction(function (movement) {
              var pickedFeature = scene.pick(movement.endPosition);
              if (Cesium.defined(pickedFeature)) {
                view.el.style.cursor = 'pointer';
              } else {
                view.el.style.cursor = 'default';
              }
            }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

            // When a feature is clicked, highlight the feature and trigger an event that
            // tells the parent map view to open the feature details panel
            view.inputHandler.setInputAction(function (movement) {
              // Select the feature that's at the position where the user clicked, if
              // there is one
              var pickedFeature = scene.pick(movement.position);
              // Update the Map model's `selectedFeature` model with the newly selected
              // feature. This will also trigger an event to highlight the selected
              // feature.
              view.updateSelectedFeatureModel(pickedFeature)
            }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
          }
          catch (error) {
            console.log(
              'There was an error initializing picking in a CesiumWidgetView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * This function is called whenever any attributes change in the {@link Feature}
          * model that is set on the {@link Map} model's selectedFeature attribute. Looks
          * in the Map model for the selected feature entity. Highlights that entity on the
          * map by drawing a border around it with the highlightBorderColor configured on
          * this view. Removes highlighting from all previously highlighted entities. NOTE:
          * This currently only works with 3D tile features.
          */
        highlightSelectedFeature: function () {
          try {

            const view = this;
            const featureModel = view.model.get('selectedFeature');
            let isTileset = false;

            // Remove highlight from all currently silhouetted 3D tiles
            view.silhouettes.selected.forEach(function(prevCesiumEntity){
              prevCesiumEntity.selectedInMap = false
              // Make sure the style is updated for the features that are no longer
              // selected
              const prevLayerModel = view.model.get('layers').findWhere({
                cesiumModel: prevCesiumEntity.primitive
              })
              if (prevLayerModel.update3DTileStyle) {
                prevLayerModel.update3DTileStyle()
              }
            })
            view.silhouettes.selected = []

            // Get the currently selected feature set on the model
            var cesiumEntity = featureModel.get('featureObject')

            // If the selected feature exists, then highlight it by adding a border.
            if (Cesium.defined(cesiumEntity)) {
              isTileset = cesiumEntity instanceof Cesium.Cesium3DTileFeature;
              // Borders are added to 3D tiles by silhouetting them
              if (isTileset) {
                // Set a property on the Cesium.Cesium3DTileFeature for use by the
                // evaluate color function. This allows the feature to be styled
                // differently when selected (e.g. make opacity 1),
                cesiumEntity.selectedInMap = true
                // Add the border ('silhouettes')
                view.silhouettes.selected = [cesiumEntity]
              }
              // TODO: add borders if this is another type of geometry (e.g. polygons)
            }

            // Reset the 3D tile styles so the selected feature's style is updated.
            if (featureModel.get('mapAsset')) {
              if (isTileset) {
                featureModel.get('mapAsset').update3DTileStyle()
              }
            }

            view.requestRender()
          }
          catch (error) {
            console.log(
              'There was an error highlighting a feature in a CesiumWidgetView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Given a feature from a vector layer (e.g. a Cesium3DTileFeature), gets any
         * properties that are associated with that feature, the MapAsset model that
         * contains the feature, and the ID that Cesium uses to identify it, and updates
         * the Feature model that is set on the Map's `selectedFeature` attribute. NOTE:
         * This currently only works with 3D tile features.
         * @param {Cesium3DTileFeature} feature
        */
        updateSelectedFeatureModel: function (feature) {

          try {
            var view = this

            // If the feature that was clicked on was already selected, do nothing
            if (view.model.get('selectedFeature').get('featureObject') === feature) {
              return;
            }

            // Passing null to the Map model's selectFeature function will reset the Map's
            // selectedFeature Feature model to the defaults
            var featureProps = null

            // If there is a selected feature, get all of the attributes needed for a
            // Feature model
            if (feature) {
              var layers = view.model.get('layers')

              featureProps = {
                properties: {},
                mapAsset: null,
                featureID: feature.pickId ? feature.pickId.key : null,
                featureObject: feature
              }

              // Find out which layer model this belongs to
              featureProps.mapAsset = layers.findWhere({
                cesiumModel: feature.primitive
              })

              // Get the attributes that are set on this feature.
              if (feature instanceof Cesium.Cesium3DTileFeature) {
                var propertyNames = feature.getPropertyNames();
                var length = propertyNames.length;
                for (var i = 0; i < length; ++i) {
                  var propertyName = propertyNames[i];
                  featureProps.properties[propertyName] = feature.getProperty(propertyName)
                }
              }
              // TODO: Get properties from other types of features, e.g. polygon entities
              // and markers created from geoJSON
            }

            // Pass the new information to the Map's selectFeature function, which will
            // update the selectFeature attribute on the Map model
            view.model.selectFeature(featureProps)
          }
          catch (error) {
            console.log(
              'There was an error updating the selected feature model from a ' +
              'CesiumWidgetView. Error details: ' + error
            );
          }
        },

        /**
         * Move the camera position and zoom to the specified target entity or position on
         * the map, using a nice animation.
         * @param {MapAsset|Cesium.BoundingSphere|Object} target The target asset,
         * bounding sphere, or location to change the camera focus to. If target is a
         * MapAsset, then the bounding sphere from that asset will be used for the target
         * destination. If target is an Object, it may contain any of the properties that
         * are supported by the Cesium camera flyTo options, see
         * {@link https://cesium.com/learn/cesiumjs/ref-doc/Camera.html#flyTo}. The target
         * can otherwise be a Cesium BoundingSphere, see
         * {@link https://cesium.com/learn/cesiumjs/ref-doc/BoundingSphere.html}
         * @param {object} options - For targets that are a bounding sphere or asset,
         * options to pass to Cesium Camera.flyToBoundingSphere(). See
         * {@link https://cesium.com/learn/cesiumjs/ref-doc/Camera.html#flyToBoundingSphere}.
         */
        flyTo: function (target, options) {

          try {

            const view = this;
            if (typeof options !== 'object') {
              options = {}
            }

            // A target is required
            if (!target) {
              return
            }

            // If the target is a Bounding Sphere, use the camera's built-in function
            if (target instanceof Cesium.BoundingSphere) {
              view.camera.flyToBoundingSphere(target, options)
              return
            }

            // If the target is some type of map asset, then get a Bounding Sphere for
            // that asset and call this function again.
            if (target instanceof MapAsset && typeof target.getCameraBoundSphere === 'function') {
              target.getCameraBoundSphere()
                .then(function (assetBoundingSphere) {
                  // Base value offset required to zoom in close enough to 3D tiles for
                  // them to render.
                  if ((target instanceof Cesium3DTileset) && !Cesium.defined(options.offset)) {
                    options.offset = new Cesium.HeadingPitchRange(
                      0.0, -0.5, assetBoundingSphere.radius
                    )
                  }
                  view.flyTo(assetBoundingSphere, options)
                })
              return
            }

            // If not a Map Asset or a BoundingSphere, then the target must be an Object.
            // Assume target are options for the Cesium camera flyTo function
            if (typeof target === 'object') {
              view.camera.flyTo(target)
            }

          }
          catch (error) {
            console.log(
              'There was an error navigating to a target position in a CesiumWidgetView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Navigate to the homePosition that's set on the Map.
         */
        flyHome: function () {
          try {
            var position = this.model.get('homePosition')

            if (position) {

              this.flyTo({
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
              'There was an error navigating to the home position in a CesiumWidgetView' +
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
        getCameraPosition: function () {
          try {
            var camera = this.camera
            var cameraPosition = Cesium.Cartographic.fromCartesian(camera.position)

            return {
              longitude: Cesium.Math.toDegrees(cameraPosition.longitude),
              latitude: Cesium.Math.toDegrees(cameraPosition.latitude),
              height: camera.position.z,
              heading: Cesium.Math.toDegrees(camera.heading),
              pitch: Cesium.Math.toDegrees(camera.pitch),
              roll: Cesium.Math.toDegrees(camera.roll)
            }

          }
          catch (error) {
            console.log(
              'There was an error getting the current position in a CesiumWidgetView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Set a listener that updates the Map model's current position attribute whenever
         * the mouse moves
         */
        setMouseCoordinateListener: function () {
          try {
            // Use globe.ellipsoid.cartesianToCartographic?

            var view = this;

            // Handle mouse move
            this.inputHandler.setInputAction(e => {

              var mousePosition = e.endPosition;
              var pickRay = view.camera.getPickRay(mousePosition);
              var cartesian = view.scene.globe.pick(pickRay, view.scene);

              // TODO: Limit how often the function runs if it seems to slow down the map.
              if (cartesian) {
                var cartographic = Cesium.Cartographic.fromCartesian(cartesian);
                view.model.set('currentPosition', {
                  latitude: Cesium.Math.toDegrees(cartographic.latitude),
                  longitude: Cesium.Math.toDegrees(cartographic.longitude),
                  height: cartographic.height,
                })
              }

            }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
          }
          catch (error) {
            console.log(
              'There was an error setting the mouse coordinate listener in a CesiumWidgetView' +
              '. Error details: ' + error
            );
          }
        },


        /**
         * Set listeners for when the Cesium camera changes a significant amount. Update
         * the map model's currentScale attribute, which is used for the scale bar.
         * See {@link https://cesium.com/learn/cesiumjs/ref-doc/Camera.html#changed}.
         */
        setCameraListener: function () {
          try {
            const view = this

            // When the camera position has changed significantly, update the scale.
            view.camera.changed.addEventListener(function () {

              // TODO: Limit how often the function runs if it seems to slow down the map.
              // Find the distance between two pixels at the *bottom center* of the screen.
              // Update the map Model's current scale.
              let currentScale = {
                pixels: null,
                meters: null
              }
              const onePixelInMeters = view.pixelToMeters()
              if (onePixelInMeters || onePixelInMeters === 0) {
                currentScale = {
                  pixels: 1,
                  meters: onePixelInMeters
                }
              }
              view.model.set('currentScale', currentScale);

            });
          }
          catch (error) {
            console.log(
              'There was an error  in a CesiumWidgetView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Finds the geodesic distance (in meters) between two points that are 1 pixel
         * apart at the bottom, center of the Cesium canvas. Adapted from TerriaJS. See
         * {@link https://github.com/TerriaJS/terriajs/blob/main/lib/ReactViews/Map/Legend/DistanceLegend.jsx}
         * @returns {number|boolean} Returns the distance on the globe, in meters, that is
         * equivalent to 1 pixel on the screen at the center bottom point of the current
         * scene. Returns false if there was a problem getting the measurement.
         */
        pixelToMeters: function () {
          try {

            const view = this
            const scene = view.scene
            const globe = scene.globe

            // For measuring geodesic distances (shortest route between two points on the
            // Earth's surface)
            const geodesic = new Cesium.EllipsoidGeodesic();

            // Find two points that are 1 pixel apart at the bottom center of the cesium
            // canvas.
            const width = scene.canvas.clientWidth;
            const height = scene.canvas.clientHeight;

            const left = scene.camera.getPickRay(
              new Cesium.Cartesian2((width / 2) | 0, height - 1)
            );
            const right = scene.camera.getPickRay(
              new Cesium.Cartesian2((1 + width / 2) | 0, height - 1)
            );

            const leftPosition = globe.pick(left, scene);
            const rightPosition = globe.pick(right, scene);

            // A point must exist at both positions to get the distance
            if (!Cesium.defined(leftPosition) || !Cesium.defined(rightPosition)) {
              return false
            }

            // Find the geodesic distance, in meters, between the two points that are 1
            // pixel apart
            const leftCartographic = globe.ellipsoid.cartesianToCartographic(
              leftPosition
            );
            const rightCartographic = globe.ellipsoid.cartesianToCartographic(
              rightPosition
            );

            geodesic.setEndPoints(leftCartographic, rightCartographic);

            const onePixelInMeters = geodesic.surfaceDistance;

            return onePixelInMeters

          }
          catch (error) {
            console.log(
              'Failed to get a pixel to meters measurement in a CesiumWidgetView' +
              '. Error details: ' + error
            );
            return false
          }
        },

        /**
         * Renders peaks and valleys in the 3D version of the map, given a terrain model.
         * If a terrain model has already been set on the map, this will replace it.
         * @param {Terrain} terrainModel a Terrain Map Asset model
        */
        updateTerrain: function (terrainModel) {
          try {
            if (terrainModel.get('status') !== 'ready') {
              this.stopListening(terrainModel)
              this.listenTo(terrainModel, 'change:status', this.updateTerrain)
              return
            }
            var cesiumModel = terrainModel.get('cesiumModel')
            this.scene.terrainProvider = cesiumModel
            this.requestRender();
          }
          catch (error) {
            console.log(
              'There was an error rendering terrain in a CesiumWidgetView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Renders a 3D tileset in the map and sets listeners to update the tileset when
         * the opacity or visibility changes.
         * @param {Layer} tilesetModel The Map Asset Layer model that contains the
         * information about the 3D tiles to render in the map
        */
        add3DTileset: function (tilesetModel) {
          try {

            if (tilesetModel.get('status') !== 'ready') {
              this.stopListening(tilesetModel)
              this.listenTo(tilesetModel, 'change:status', this.add3DTileset)
              return
            }

            this.stopListening(tilesetModel)

            // Get the cesium tiles
            var cesiumModel = tilesetModel.get('cesiumModel')
            this.scene.primitives.add(cesiumModel)

          }
          catch (error) {
            console.log(
              'There was an error adding a 3D tileset to a CesiumWidgetView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Renders imagery in the Map given a Layer model. Sets listeners to update the
         * imagery when the opacity or visibility changes.
         * @param {Layer} imageryModel A Layer Map Asset model
              */
        addImagery: function (imageryModel) {
          try {
            if (imageryModel.get('status') !== 'ready') {
              this.stopListening(imageryModel)
              this.listenTo(imageryModel, 'change:status', this.addImagery)
              return
            }
            var cesiumModel = imageryModel.get('cesiumModel')

            if (cesiumModel) {
              this.scene.imageryLayers.add(cesiumModel)
            }
          }
          catch (error) {
            console.log(
              'There was an error adding imagery to a CesiumWidgetView' +
              '. Error details: ' + error
            );
          }
        },

        // WIP
        // /**
        //  * Renders geometries in the Cesium map based on vector data (e.g. GeoJSON)
        //  * @param {Layer} vectorModel The 'data' type layer model to render
        //  */
        // addVectorData: function (assetModel) {

        //   try {

        //     // This is a WIP and not working yet
        //     return
        //     var view = this
        //     var scene = view.scene
        //     var cesiumModel = vectorModel.get('cesiumModel')

        //     var dataSourceCollection = new Cesium.DataSourceCollection();
        //     var dataSourceDisplay = new Cesium.DataSourceDisplay({
        //       scene: scene,
        //       dataSourceCollection: dataSourceCollection
        //     });
        //     var entities = dataSourceDisplay.defaultDataSource.entities;
        //     dataSourceCollection.add(cesiumModel)
        //   }
        //   catch (error) {
        //     console.log(
        //       'There was an error rendering data in a CesiumWidgetView' +
        //       '. Error details: ' + error
        //     );
        //   }

        // },


      }
    );

    return CesiumWidgetView;

  }
);
