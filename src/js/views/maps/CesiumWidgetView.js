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
    * @classdesc An interactive 2D and/or 3D map/globe rendered using CesiumJS. This view
    * comprises the globe without any of the UI elements like the scalebar, layer list,
    * etc.
    * @classcategory Views/Maps
    * @name CesiumWidgetView
    * @extends Backbone.View
    * @screenshot views/maps/CesiumWidgetView.png
    * @since 2.18.0
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

        /**
         * An array of objects the match a Map Asset's type property to the function in
         * this view that adds and renders that asset on the map, given the Map Asset
         * model. Each object in the array has two properties: 'types' and
         * 'renderFunction'.
         * @type {Object[]}
         * @property {string[]} types The list of types that can be added to the map given
         * the renderFunction
         * @property {string} renderFunction The name of the function in the view that
         * will add the asset to the map and render it, when passed the cesiumModel
         * attribute from the MapAsset model
         */
        mapAssetRenderFunctions: [
          {
            types: ['Cesium3DTileset'],
            renderFunction: 'add3DTileset'
          },
          {
            types: ['GeoJsonDataSource'],
            renderFunction: 'addVectorData'
          },
          {
            types: ['BingMapsImageryProvider', 'IonImageryProvider', 'WebMapTileServiceImageryProvider'],
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
        // TODO - Consider making this color configurable in the Map model
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
            if (!this.model.get('selectedFeatures')) {
              this.model.selectFeatures()
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

            // Clock will be used for the timeline component, and for the clock.ontick
            // event
            view.clock = new Cesium.Clock({ shouldAnimate: false })

            // Create the Cesium Widget and save a reference to it to the view
            view.widget = new Cesium.CesiumWidget(view.el, {
              clock: view.clock,
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

            // Zoom functions executed after each scene render
            view.scene.postRender.addEventListener(function () {
              view.postRender();
            });

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

            // Prepare Cesium to handle vector datasources (e.g. geoJsonDataSources)
            view.dataSourceCollection = new Cesium.DataSourceCollection();
            view.dataSourceDisplay = new Cesium.DataSourceDisplay({
              scene: view.scene,
              dataSourceCollection: view.dataSourceCollection,
            });
            view.clock.onTick.addEventListener(function () {
              view.updateDataSourceDisplay.call(view)
            })

            // Go to the home position, if one is set.
            view.flyHome()

            // If users are allowed to click on features for more details, initialize
            // picking behavior on the map.
            if (view.model.get('showFeatureInfo')) {
              view.initializePicking()
            }

            // If the scale bar is showing, update the pixel to meter scale on the map
            // model when the camera angle/zoom level changes
            if (view.model.get('showScaleBar')) {
              // Set listeners for when the Cesium camera changes a significant amount. 
              // See https://cesium.com/learn/cesiumjs/ref-doc/Camera.html#changed}.
              view.camera.changed.addEventListener(function () {
                view.updateCurrentScale()
              })
            }

            // Sets listeners for when the mouse moves, depending on the value of the map
            // model's showScaleBar and showFeatureInfo attributes
            view.setMouseMoveListeners()

            // When the appearance of a layer has been updated, then tell Cesium to
            // re-render the scene. Each layer model triggers the 'appearanceChanged'
            // function whenever the color, opacity, etc. has been updated in the
            // associated Cesium model.
            view.stopListening(view.model.get('layers'), 'appearanceChanged')
            view.listenTo(view.model.get('layers'), 'appearanceChanged', view.requestRender)

            // Other views may trigger an event on the layer/asset model that indicates
            // that the map should navigate to the extent of the data, or on the Map model
            // to navigate to the home position.
            view.stopListening(view.model.get('layers'), 'flyToExtent')
            view.listenTo(view.model.get('layers'), 'flyToExtent', view.flyTo)
            view.stopListening(view.model, 'flyHome')
            view.listenTo(view.model, 'flyHome', view.flyHome)

            // Add each layer from the Map model to the Cesium widget. Render using the
            // function configured in the View's mapAssetRenderFunctions property.
            view.model.get('layers').forEach(function (mapAsset) {
              view.addAsset(mapAsset)
            })

            // The Cesium Widget will support just one terrain option to start. Later,
            // we'll allow users to switch between terrains if there is more than one.
            var terrains = view.model.get('terrains')
            var terrainModel = terrains ? terrains.first() : false;
            if (terrainModel) {
              view.addAsset(terrainModel)
            }

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
         * Functions called after each time the scene renders. If a zoom target has been
         * set by the {@link CesiumWidgetView#flyTo} function, then calls the functions
         * that calculates the bounding sphere and zooms to it (which required to visual
         * elements to be rendered first.)
         */
        postRender: function () {
          try {
            if (this.zoomTarget) {
              this.completeFlight(this.zoomTarget, this.zoomOptions)
              this.zoomTarget = null;
              this.zoomOptions = null;
            }
          }
          catch (error) {
            console.log(
              'There was an error calling post render functions in a CesiumWidgetView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Runs on every Cesium clock tick. Updates the display of the CesiumVectorData
         * models in the scene. Similar to Cesium.DataSourceDisplay.update function, in
         * that it runs update() on each DataSource and each DataSource's visualizer,
         * except that it also updates each CesiumVectorData model's 'displayReady'
         * attribute. (Sets to true when the asset is ready to be rendered in the map,
         * false otherwise). Also re-renders the scene when the displayReady attribute
         * changes. 
         */
        updateDataSourceDisplay: function () {
          try {
            const view = this;

            var dataSources = view.dataSourceDisplay.dataSources;
            if (!dataSources || !dataSources.length) {
              return
            }

            let allReady = true;
            const allReadyBefore = view.dataSourceDisplay._ready;


            for (let i = 0, len = dataSources.length; i < len; i++) {

              const time = view.clock.currentTime;
              const dataSource = dataSources.get(i);
              const visualizers = dataSource._visualizers;

              const assetModel = view.model.get('layers').findWhere({
                cesiumModel: dataSource
              })
              const displayReadyBefore = assetModel.get('displayReady')
              let displayReadyNow = dataSource.update(time)

              for (let x = 0; x < visualizers.length; x++) {
                displayReadyNow = visualizers[x].update(time) && displayReadyNow;
              }

              assetModel.set('displayReady', displayReadyNow)

              allReady = displayReadyNow && allReady

            }

            // If any dataSource has switched display states, then re-render the scene.
            if (allReady !== allReadyBefore) {
              view.scene.requestRender()
            }
            // The dataSourceDisplay must be set to 'ready' to get bounding spheres for
            // dataSources
            view.dataSourceDisplay._ready = allReady

          }
          catch (error) {
            console.log(
              'There was an error updating the data source display in a CesiumWidgetView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Set up the Cesium scene and set listeners and behavior that enable users to
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
            // When any Feature models in the Map model's selectedFeature collection are
            // changed, added, or removed, update silhouetting of 3D tiles.
            function setSelectedFeaturesListeners() {
              const selectedFeatures = view.model.get('selectedFeatures')
              view.stopListening(selectedFeatures, 'update')
              view.listenTo(selectedFeatures, 'update', function () {
                // Remove highlights from previously selected 3D tiles
                view.silhouettes.selected = []
                // Highlight the newly selected 3D tiles
                selectedFeatures
                  .getFeatureObjects('Cesium3DTileFeature')
                  .forEach(function (featureObject) {
                    view.silhouettes.selected.push(featureObject)
                  })
              })
            }

            setSelectedFeaturesListeners()
            // If the Selected Features collection is ever completely replaced for any
            // reason, make sure to reset the listeners onto the new collection
            view.stopListening(view.model, 'change:selectedFeatures')
            view.listenTo(view.model, 'change:selectedFeatures', setSelectedFeaturesListeners)

            // When a feature is clicked update the Map model's `selectedFeatures`
            // collection with the newly selected features. This will also trigger an
            // event to update styling of map assets with selected features, and tells the
            // parent map view to open the feature details panel.
            view.inputHandler.setInputAction(function (movement) {
              var pickedFeature = scene.pick(movement.position);
              view.updateSelectedFeatures([pickedFeature])
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
         * Given a feature from a vector layer (e.g. a Cesium3DTileFeature), gets any
         * properties that are associated with that feature, the MapAsset model that
         * contains the feature, and the ID that Cesium uses to identify it, and updates
         * the Features collection that is set on the Map's `selectedFeatures` attribute
         * with a new Feature model. NOTE: This currently only works with 3D tile
         * features.
         * @param {Cesium.Cesium3DTileFeature[]} features - An array of Cesium3DTileFeatures to
         * select
        */
        updateSelectedFeatures: function (features) {

          try {
            const view = this
            const layers = view.model.get('layers')

            // Don't update the selected features collection if the newly selected
            // features are identical
            const oldFeatures = view.model.get('selectedFeatures').getFeatureObjects()
            const noChange = _.isEqual(_.sortBy(features), _.sortBy(oldFeatures))
            if (noChange) {
              return;
            }

            // Properties of the selected features to pass to the Map model's
            // selectFeatures function. Passing null will empty the map's selectedFeatures
            // collection
            let featuresAttrs = features ? [] : null
            if (!features || !Array.isArray(features)) {
              features = []
            }

            features.forEach(function (feature) {
              if (feature) {
                // To find corresponding MapAsset model in the layers collection
                let cesiumModel = null
                // Attributes to make a new Feature model
                const attrs = {
                  properties: {},
                  mapAsset: null,
                  featureID: null,
                  featureObject: feature,
                  label: null,
                }
                if (feature instanceof Cesium.Cesium3DTileFeature) {
                  // Cesium.Cesium3DTileFeature.primitive gives the Cesium.Cesium3DTileset
                  cesiumModel = feature.primitive
                  attrs.featureID = feature.pickId ? feature.pickId.key : null
                  // Search for a property to use as a label
                  attrs.label = feature.getProperty('name') || feature.getProperty('label') || null
                } else {
                  // TODO: Test - does feature.id give the entity this work for all datasources ?
                  // A picked feature object's ID gives the Cesium.Entity
                  attrs.featureObject = feature.id
                  // Gives the parent DataSource
                  cesiumModel = attrs.featureObject.entityCollection.owner
                  attrs.featureID = attrs.featureObject.id
                  attrs.label = attrs.featureObject.name
                }

                attrs.mapAsset = layers.findWhere({
                  cesiumModel: cesiumModel
                })

                if (
                  attrs.mapAsset &&
                  typeof attrs.mapAsset.getPropertiesFromFeature === 'function'
                ) {
                  attrs.properties = attrs.mapAsset.getPropertiesFromFeature(attrs.featureObject)
                }

                featuresAttrs.push(attrs)
              }
            })

            // Pass the new information to the Map's selectFeatures function, which will
            // update the selectFeatures collection set on the Map model
            view.model.selectFeatures(featuresAttrs)

          }
          catch (error) {
            console.log(
              'There was an error updating the selected features collection from a ' +
              'CesiumWidgetView. Error details: ' + error
            );
          }
        },

        /**
         * Move the camera position and zoom to the specified target entity or position on
         * the map, using a nice animation. This function starts the flying/zooming
         * action by setting a zoomTarget and zoomOptions on the view and requesting the
         * scene to render. The actual zooming is done by
         * {@link CesiumWidgetView#completeFlight} after the scene has finished rendering.
         * @param {*} target 
         * @param {*} options 
         */
        flyTo: function (target, options) {
          this.zoomTarget = target;
          this.zoomOptions = options;
          this.requestRender();
        },

        /**
         * This function is called by {@link CesiumWidgetView#postRender}; it should only
         * be called once the target has been fully rendered in the scene. This function
         * gets the bounding sphere, if required, and moves the scene to encompass the
         * full extent of the target.
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
        completeFlight: function (target, options) {

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
            if (target instanceof MapAsset && typeof target.getBoundingSphere === 'function') {
              // Pass the dataSourceDisplay for CesiumVectorData models
              target.getBoundingSphere(view.dataSourceDisplay)
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

            if (position && Cesium.defined(position.longitude) && Cesium.defined(position.latitude)) {

              // Set a default height (elevation) if there isn't one set
              if (!Cesium.defined(position.height)) {
                position.height = 1000000;
              }

              const target = {}
              target.destination = Cesium.Cartesian3.fromDegrees(
                position.longitude,
                position.latitude,
                position.height
              )

              if (
                Cesium.defined(position.heading) &&
                Cesium.defined(position.pitch) &&
                Cesium.defined(position.roll)
              ) {
                target.orientation = {
                  heading: Cesium.Math.toRadians(position.heading),
                  pitch: Cesium.Math.toRadians(position.pitch),
                  roll: Cesium.Math.toRadians(position.roll)
                }
              }

              this.flyTo(target);
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
         * @returns {MapConfig#CameraPosition} Returns an object with the longitude, latitude,
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
         * Set a Cesium event handler for when the mouse moves. If the scale bar is
         * enabled, then a updates the Map model's current position attribute whenever the
         * mouse moves. If showFeatureInfo is enabled, then changes the cursor to a
         * pointer when it hovers over a feature.
         */
        setMouseMoveListeners: function () {
          try {

            const view = this;

            // Change the cursor to a pointer when it hovers over a clickable feature
            // (e.g. a 3D tile) if picking is enabled.
            const updateCursor = function (mousePosition) {
              var pickedFeature = view.scene.pick(mousePosition);
              if (Cesium.defined(pickedFeature)) {
                view.el.style.cursor = 'pointer';
              } else {
                view.el.style.cursor = 'default';
              }
            }

            // Slow this function down a little. Picking is quite slow.
            const updateCursorThrottled = _.throttle(updateCursor, 150)

            // Update the model with long and lat when the mouse moves, if the map model
            // is set to show the scale bar
            const setCurrentPosition = function (mousePosition) {
              var pickRay = view.camera.getPickRay(mousePosition);
              var cartesian = view.scene.globe.pick(pickRay, view.scene);
              if (cartesian) {
                // Use globe.ellipsoid.cartesianToCartographic ?
                var cartographic = Cesium.Cartographic.fromCartesian(cartesian);
                view.model.set('currentPosition', {
                  latitude: Cesium.Math.toDegrees(cartographic.latitude),
                  longitude: Cesium.Math.toDegrees(cartographic.longitude),
                  height: cartographic.height,
                })
              }
            }

            // Handle mouse move
            this.inputHandler.setInputAction(function (movement) {
              const mousePosition = movement.endPosition;
              if (view.model.get('showScaleBar')) {
                setCurrentPosition(mousePosition)
              }
              if (view.model.get('showFeatureInfo')) {
                updateCursorThrottled(mousePosition)
              }
            }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

          }
          catch (error) {
            console.log(
              'There was an error setting the mouse listeners in a CesiumWidgetView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Update the map model's currentScale attribute, which is used for the scale bar.
         * Finds the distance between two pixels at the *bottom center* of the screen.
         */
        updateCurrentScale: function () {
          try {
            const view = this;
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
          }
          catch (error) {
            console.log(
              'There was an error updating the scale from a CesiumWidgetView' +
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
         * Finds the function that is configured for the given asset model type in the
         * {@link CesiumWidgetView#mapAssetRenderFunctions} array, then renders the asset
         * in the map. If there is a problem rendering the asset (e.g. it is an
         * unsupported type that is not configured in the mapAssetRenderFunctions), then
         * sets the AssetModel's status to error.
         * @param {MapAsset} mapAsset A MapAsset layer to render in the map, such as a
         * Cesium3DTileset or a CesiumImagery model.
         */
        addAsset(mapAsset) {
          try {
            if (!mapAsset) {
              return
            }
            var view = this
            var type = mapAsset.get('type')
            // Find the render option from the options configured in the view, given the
            // asset model type
            const renderOption = _.find(view.mapAssetRenderFunctions, function (option) {
              return option.types.includes(type)
            }) || {};
            // Get the function for this type
            const renderFunction = view[renderOption.renderFunction]

            // If the cesium widget does not have a way to display this error, update the
            // error status in the model (this will be reflected in the LayerListView)
            if (!renderFunction || typeof renderFunction !== 'function') {
              mapAsset.set('statusDetails', 'This type of resource is not supported in the map widget.')
              mapAsset.set('status', 'error')
              return
            }

            // The asset should be visible and the cesium model should be ready before
            // starting to render the asset
            const checkAndRenderAsset = function () {
              let shouldRender = mapAsset.get('visible') && mapAsset.get('status') === 'ready'
              if (shouldRender) {
                renderFunction.call(view, mapAsset.get('cesiumModel'))
                view.stopListening(mapAsset)
              }
            }

            checkAndRenderAsset()

            if (!mapAsset.get('visible')) {
              view.listenToOnce(mapAsset, 'change:visible', checkAndRenderAsset)
            }

            if (mapAsset.get('status') !== 'ready') {
              view.listenTo(mapAsset, 'change:status', checkAndRenderAsset)
            }

          }
          catch (error) {
            console.log(
              'There was an error rendering an asset in a CesiumWidgetView' +
              '. Error details: ' + error
            );
            mapAsset.set('statusDetails', 'There was a problem rendering this resource in the map widget.')
            mapAsset.set('status', 'error')
          }
        },

        /**
         * Renders peaks and valleys in the 3D version of the map, given a terrain model.
         * If a terrain model has already been set on the map, this will replace it.
         * @param {Cesium.TerrainProvider} cesiumModel a Cesium Terrain Provider model to
         * use for the map
        */
        updateTerrain: function (cesiumModel) {
          this.scene.terrainProvider = cesiumModel
          this.requestRender();
        },

        /**
         * Renders a 3D tileset in the map.
         * @param {Cesium.Cesium3DTileset} cesiumModel The Cesium 3D tileset model that
         * contains the information about the 3D tiles to render in the map
        */
        add3DTileset: function (cesiumModel) {
          this.scene.primitives.add(cesiumModel)
        },

        /**
         * Renders vector data (excluding 3D tilesets) in the Map.
         * @param {Cesium.GeoJsonDataSource} cesiumModel - The Cesium data source
         * model to render on the map
         */
        addVectorData: function (cesiumModel) {
          this.dataSourceCollection.add(cesiumModel)
        },

        /**
         * Renders imagery in the Map.
         * @param {Cesium.ImageryLayer} cesiumModel The Cesium imagery model to render
        */
        addImagery: function (cesiumModel) {
          this.scene.imageryLayers.add(cesiumModel)
          this.sortImagery()
        },

        /**
         * Arranges the imagery that is rendered the Map according to the order
         * that the imagery is arranged in the layers collection.
         * @since x.x.x
         */
        sortImagery() {
          try {
            const imageryInMap = this.scene.imageryLayers
            const imageryModels = this.model.get('layers').getAll('CesiumImagery')

            // If there are no imagery layers, or just one, return
            if (
              !imageryInMap || !imageryModels ||
              imageryInMap.length <= 1 || imageryModels.length <= 1
            ) {
              return
            }

            // If there are more than one imagery layer, arrange them in the order that
            // they were added to the map
            for (let i = 0; i < imageryModels.length; i++) {
              const cesiumModel = imageryModels[i].get('cesiumModel')
              if (cesiumModel) {
                if (imageryInMap.contains(cesiumModel)) {
                  imageryInMap.lowerToBottom(cesiumModel)
                }
              }
            }
          }
          catch (error) {
            console.log(
              'There was an error sorting displayed imagery in a CesiumWidgetView' +
              '. Error details: ' + error
            );
          }
        },

      }
    );

    return CesiumWidgetView;

  }
);
