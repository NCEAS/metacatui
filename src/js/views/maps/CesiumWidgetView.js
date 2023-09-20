"use strict";

define([
  "jquery",
  "underscore",
  "backbone",
  "cesium",
  "models/maps/Map",
  "models/maps/assets/MapAsset",
  "models/maps/assets/Cesium3DTileset",
  "models/maps/Feature",
  "text!templates/maps/cesium-widget-view.html",
], function (
  $,
  _,
  Backbone,
  Cesium,
  Map,
  MapAsset,
  Cesium3DTileset,
  Feature,
  Template
) {
  /**
   * @class CesiumWidgetView
   * @classdesc An interactive 2D and/or 3D map/globe rendered using CesiumJS.
   * This view comprises the globe without any of the UI elements like the
   * scalebar, layer list, etc.
   * @classcategory Views/Maps
   * @name CesiumWidgetView
   * @extends Backbone.View
   * @screenshot views/maps/CesiumWidgetView.png
   * @since 2.18.0
   * @constructs
   * @fires MapInteraction#moved
   * @fires MapInteraction#moveEnd
   * @fires MapInteraction#moveStart
   */
  var CesiumWidgetView = Backbone.View.extend(
    /** @lends CesiumWidgetView.prototype */ {
      /**
       * The type of View this is
       * @type {string}
       */
      type: "CesiumWidgetView",

      /**
       * The HTML classes to use for this view's element. Note that the first
       * child element added to this view by cesium will have the class
       * "cesium-widget".
       * @type {string}
       */
      className: "cesium-widget-view",

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
       * An array of objects the match a Map Asset's type property to the
       * function in this view that adds and renders that asset on the map,
       * given the Map Asset model. Each object in the array has two properties:
       * 'types' and 'renderFunction'.
       * @type {Object[]}
       * @property {string[]} types The list of types that can be added to the
       * map given the renderFunction
       * @property {string} renderFunction The name of the function in the view
       * that will add the asset to the map and render it, when passed the
       * cesiumModel attribute from the MapAsset model
       * @property {string} removeFunction The name of the function in the view
       * that will remove the asset from the map, when passed the cesiumModel
       * attribute from the MapAsset model
       */
      mapAssetRenderFunctions: [
        {
          types: ["Cesium3DTileset"],
          renderFunction: "add3DTileset",
          removeFunction: "remove3DTileset",
        },
        {
          types: ["GeoJsonDataSource", "CzmlDataSource"],
          renderFunction: "addVectorData",
          removeFunction: "removeVectorData",
        },
        {
          types: [
            "BingMapsImageryProvider",
            "IonImageryProvider",
            "TileMapServiceImageryProvider",
            "WebMapTileServiceImageryProvider",
            "WebMapServiceImageryProvider",
            "OpenStreetMapImageryProvider",
          ],
          renderFunction: "addImagery",
          removeFunction: "removeImagery",
        },
        {
          types: ["CesiumTerrainProvider"],
          renderFunction: "updateTerrain",
          removeFunction: null,
        },
      ],

      /**
       * The border color to use on vector features that a user clicks. See
       * {@link https://cesium.com/learn/cesiumjs/ref-doc/Color.html?classFilter=color}
       * @type {Cesium.Color}
       */
      // TODO - Make this color configurable in the Map model
      highlightBorderColor: Cesium.Color.WHITE,

      /**
       * Executed when a new CesiumWidgetView is created
       * @param {Object} [options] - A literal object with options to pass to
       * the view
       */
      initialize: function (options) {
        try {
          // Set the Cesium Ion token (required for some map features)
          Cesium.Ion.defaultAccessToken = MetacatUI.appModel.get("cesiumToken");

          // Get all the options and apply them to this view
          if (typeof options == "object") {
            for (const [key, value] of Object.entries(options)) {
              this[key] = value;
            }
          }

          if (!this.model) {
            this.model = new Map();
          }
          if (!this.model.get("interactions")) {
            this.model.setUpInteractions();
          }
          this.interactions = this.model.get("interactions");
          // The selectedFeature attribute is used to store information about
          // the vector feature, if any, that is currently in focus on the map.
          if (!this.interactions.get("selectedFeatures")) {
            this.interactions.selectFeatures();
          }
        } catch (e) {
          console.log("Failed to initialize a CesiumWidgetView. ", e);
        }
      },

      /**
       * Renders this view
       * @return {CesiumWidgetView} Returns the rendered view element
       */
      render: function () {
        try {
          // If Cesium features are disabled in the AppConfig, then exit without
          // rendering anything.
          if (!MetacatUI.appModel.get("enableCesium")) {
            return;
          }

          // Save a reference to this view
          const view = this;

          // Insert the template into the view
          view.$el.html(view.template({}));

          // Create the Cesium Widget
          view.renderWidget();

          // Configure the lighting on the globe
          view.setLighting();

          // Prepare Cesium to handle vector datasources (e.g.
          // geoJsonDataSources)
          view.setUpDataSourceDisplay();

          // Listeners for changes & events to the layers & map
          view.setAssetListeners();
          view.setNavigationListeners();
          // Listen to Cesium screen space events and update Interactions model
          view.setCameraListeners();
          view.setMouseListeners();
          // Listen to Interactions model and react when e.g. something is
          // clicked
          view.setInteractionListeners();

          // Render the layers
          view.addLayers();

          // Go to the home position, if one is set.
          view.flyHome(0);

          // Set the map up so that selected features may be highlighted
          view.setUpSilhouettes();

          return this;
        } catch (e) {
          console.log("Failed to render a CesiumWidgetView,", e);
          // TODO: Render a fallback map or error message
        }
      },

      /**
       * Create the Cesium Widget and save a reference to it to the view
       * @since x.x.x
       * @returns {Cesium.CesiumWidget} The Cesium Widget
       */
      renderWidget: function () {
        const view = this;
        // Clock for timeline component & updating data sources
        view.clock = new Cesium.Clock({ shouldAnimate: false });

        // Create the Cesium Widget and save a reference to it to the view
        view.widget = new Cesium.CesiumWidget(view.el, {
          clock: view.clock,
          // We will add a base imagery layer after initialization
          imageryProvider: false,
          terrain: false,
          useBrowserRecommendedResolution: false,
          // Use explicit rendering to make the widget must faster. See
          // https://cesium.com/blog/2018/01/24/cesium-scene-rendering-performance
          requestRenderMode: true,
          // Need to change the following once we support a time/clock
          // component. See
          // https://cesium.com/blog/2018/01/24/cesium-scene-rendering-performance/#handling-simulation-time-changes.
          maximumRenderTimeChange: Infinity,
        });

        // Save references to parts of  widget the view will access often
        view.scene = view.widget.scene;
        view.camera = view.widget.camera;

        return view.widget;
      },

      /**
       * Create a DataSourceDisplay and DataSourceCollection for the Cesium
       * widget, and listen to the clock tick to update the display. This is
       * required to display vector data (e.g. GeoJSON) on the map.
       * @since x.x.x
       * @returns {Cesium.DataSourceDisplay} The Cesium DataSourceDisplay
       */
      setUpDataSourceDisplay: function () {
        const view = this;
        view.dataSourceCollection = new Cesium.DataSourceCollection();
        view.dataSourceDisplay = new Cesium.DataSourceDisplay({
          scene: view.scene,
          dataSourceCollection: view.dataSourceCollection,
        });
        view.clock.onTick.removeEventListener(
          view.updateDataSourceDisplay,
          view
        );
        view.clock.onTick.addEventListener(view.updateDataSourceDisplay, view);
        return view.dataSourceDisplay;
      },

      /**
       * Because the Cesium widget is configured to use explicit rendering (see
       * {@link https://cesium.com/blog/2018/01/24/cesium-scene-rendering-performance/}),
       * we need to tell Cesium when to render a new frame if it's not one of
       * the cases handle automatically. This function tells the Cesium scene to
       * render, but is limited by the underscore.js debounce function to only
       * happen a maximum of once every 50 ms (see
       * {@link https://underscorejs.org/#debounce}).
       */
      requestRender: _.debounce(function () {
        this.scene.requestRender();
      }, 90),

      /**
       * Functions called after each time the scene renders. If a zoom target
       * has been set by the {@link CesiumWidgetView#flyTo} function, then calls
       * the functions that calculates the bounding sphere and zooms to it
       * (which required to visual elements to be rendered first.)
       */
      postRender: function () {
        try {
          const view = this;
          if (view.zoomTarget) {
            view.completeFlight(view.zoomTarget, view.zoomOptions);
          }
        } catch (e) {
          console.log("Error calling post render functions:", e);
        }
      },

      /**
       * Runs on every Cesium clock tick. Updates the display of the
       * CesiumVectorData models in the scene. Similar to
       * Cesium.DataSourceDisplay.update function, in that it runs update() on
       * each DataSource and each DataSource's visualizer, except that it also
       * updates each CesiumVectorData model's 'displayReady' attribute. (Sets
       * to true when the asset is ready to be rendered in the map, false
       * otherwise). Also re-renders the scene when the displayReady attribute
       * changes.
       */
      updateDataSourceDisplay: function () {
        try {
          const view = this;
          const layers = view.model.get("layers");

          var dataSources = view.dataSourceDisplay.dataSources;
          if (!dataSources || !dataSources.length) {
            return;
          }

          let allReady = true;
          const allReadyBefore = view.dataSourceDisplay._ready;

          for (let i = 0, len = dataSources.length; i < len; i++) {
            const time = view.clock.currentTime;
            const dataSource = dataSources.get(i);
            const visualizers = dataSource._visualizers;

            const assetModel = layers.findWhere({
              cesiumModel: dataSource,
            });
            let displayReadyNow = dataSource.update(time);

            for (let x = 0; x < visualizers.length; x++) {
              displayReadyNow = visualizers[x].update(time) && displayReadyNow;
            }

            assetModel.set("displayReady", displayReadyNow);

            allReady = displayReadyNow && allReady;
          }

          // If any dataSource has switched display states, then re-render the
          // scene.
          if (allReady !== allReadyBefore) {
            view.scene.requestRender();
          }
          // The dataSourceDisplay must be set to 'ready' to get bounding
          // spheres for dataSources
          view.dataSourceDisplay._ready = allReady;
        } catch (e) {
          console.log("Error updating the data source display.", e);
        }
      },

      /**
       * Configure the lighting on the globe.
       */
      setLighting: function () {
        const view = this;
        // Disable HDR lighting for better performance & to keep imagery
        // consistently lit.
        view.scene.highDynamicRange = false;
        view.scene.globe.enableLighting = false;

        // Keep all parts of the globe lit regardless of what time the Cesium
        // clock is set to. This avoids data and imagery appearing too dark.
        view.scene.light = new Cesium.DirectionalLight({
          direction: new Cesium.Cartesian3(1, 0, 0),
        });
        view.scene.preRender.addEventListener(function (scene, time) {
          view.scene.light.direction = Cesium.Cartesian3.clone(
            scene.camera.directionWC,
            view.scene.light.direction
          );
        });
      },

      /**
       * Set up the Cesium scene and set listeners and behavior that enable
       * users to click on vector features on the map to highlight them.
       * @since x.x.x
       */
      setUpSilhouettes: function () {
        try {
          // Save a reference to this view the Cesium scene
          var view = this;
          var scene = this.scene;

          // To add an outline to 3D tiles in Cesium, we 'silhouette' them. Set
          // up the the scene to support silhouetting.
          view.silhouettes =
            Cesium.PostProcessStageLibrary.createEdgeDetectionStage();
          view.silhouettes.uniforms.color = view.highlightBorderColor;
          view.silhouettes.uniforms.length = 0.02;
          view.silhouettes.selected = [];
          scene.postProcessStages.add(
            Cesium.PostProcessStageLibrary.createSilhouetteStage([
              view.silhouettes,
            ])
          );
        } catch (e) {
          console.log("Error initializing picking in a CesiumWidgetView", e);
        }
      },

      /**
       * Listen for changes to the assets and update the map accordingly.
       * @since x.x.x
       */
      setAssetListeners: function () {
        const view = this;
        const model = view.model;
        const layers = model.get("layers");

        // Listen for addition or removal of layers TODO: Add similar listeners
        // for terrain
        if(layers){
          view.stopListening(layers);
          view.listenTo(layers, "add", view.addAsset);
          view.listenTo(layers, "remove", view.removeAsset);
  
          // Each layer fires 'appearanceChanged' whenever the color, opacity,
          // etc. has been updated. Re-render the scene when this happens.
          view.listenTo(layers, "appearanceChanged", view.requestRender);
        }
        // Reset asset listeners if the layers collection is replaced
        view.stopListening(model, "change:layers");
        view.listenTo(model, "change:layers", view.setAssetListeners);
      },

      /**
       * Remove listeners for dynamic navigation.
       * @since x.x.x
       */
      removeNavigationListeners: function () {
        this.stopListening(this.interactions, "change:zoomTarget", this.flyTo);
        if (this.removePostRenderListener) this.removePostRenderListener();
      },

      /**
       * Set up listeners to allow for dynamic navigation. This includes zooming
       * to the extent of a layer and zooming to the home position. Note that
       * other views may trigger an event on the layer/asset model that
       * indicates that the map should navigate to a given extent.
       * @since x.x.x
       */
      setNavigationListeners: function () {
        this.removeNavigationListeners();
        // Zoom functions executed after each scene render
        this.removePostRenderListener = this.scene.postRender.addEventListener(
          this.postRender,
          this
        );
        this.listenTo(this.interactions, "change:zoomTarget", function () {
          const target = this.interactions.get("zoomTarget");
          if (target) {
            this.flyTo(target);
          }
        });
      },

      /**
       * Remove any previously set camera listeners.
       * @since x.x.x
       */
      removeCameraListeners: function () {
        if (!this.cameraListeners) this.cameraListeners = [];
        this.cameraListeners.forEach(function (removeListener) {
          removeListener();
        });
      },

      /**
       * Listen to cesium camera events, and translate them to events on the
       * interactions model. Also update the scale (pixels:meters) and the view
       * extent when the camera has moved.
       */
      setCameraListeners: function () {
        try {
          const view = this;
          const camera = view.camera;
          const interactions = view.interactions;

          // Remove any previously set camera listeners
          view.removeCameraListeners();
          // Amount camera must change before firing 'changed' event.
          camera.percentChanged = 0.1;

          // Functions to run for each Cesium camera event
          const cameraEvents = {
            moveEnd: [],
            moveStart: [],
            changed: ["updateScale", "updateViewExtent"],
          };
          // add a listener that triggers the same event on the interactions
          // model, and runs any functions configured above.
          Object.entries(cameraEvents).forEach(function ([label, functions]) {
            const callback = function () {
              interactions.trigger(label);
              functions.forEach(function (func) {
                view[func].call(view);
              });
            };
            const remover = camera[label].addEventListener(callback, view);
            view.cameraListeners.push(remover);
          });
        } catch (e) {
          console.log("Error updating the model on camera events", e);
        }
      },

      /**
       * Remove any previously set mouse listeners.
       * @since x.x.x
       */
      removeMouseListeners: function () {
        if (this.mouseEventHandler) this.mouseEventHandler.destroy();
      },

      /**
       * Set up listeners for mouse events on the map. This includes listening
       * for mouse clicks, mouse movement, and mouse hovering over features.
       * These listeners simply update the interactions model with mouse events.
       * @since x.x.x
       */
      setMouseListeners: function () {
        const view = this;
        const events = Cesium.ScreenSpaceEventType;

        // Remove previous listeners if they exist.
        view.removeMouseListeners;
        // Create Cesium object that handles interactions with the map.
        const handler = (view.mouseEventHandler =
          new Cesium.ScreenSpaceEventHandler(view.scene.canvas));

        // Every time the user interacts with the map, update the interactions
        // model with the type of interaction that occurred.
        Object.entries(events).forEach(function ([label, value]) {
          handler.setInputAction(function (event) {
            view.interactions.set("previousAction", label);
            if (label == "MOUSE_MOVE") {
              const position = event.position || event.endPosition;
              view.setMousePosition(position);
              view.setHoveredFeatures(position);
            }
          }, value);
        });
      },

      /**
       * When the mouse is moved over the map, update the interactions model
       * with the current mouse position.
       * @param {Object} event - The event object from Cesium
       * @since x.x.x
       */
      setMousePosition: function (position) {
        if (!position) return;
        const view = this;
        const pickRay = view.camera.getPickRay(position);
        const cartesian = view.scene.globe.pick(pickRay, view.scene);
        let newPosition = null;
        if (cartesian) {
          newPosition = view.getDegreesFromCartesian(cartesian);
        }
        view.interactions.setMousePosition(newPosition);
      },

      setHoveredFeatures: function (position, delay = 200) {
        const view = this;
        const lastCall = this.setHoveredFeaturesLastCall || 0;
        const now = new Date().getTime();
        if (now - lastCall < delay) return;
        this.setHoveredFeaturesLastCall = now;
        const pickedFeature = view.scene.pick(position);
        view.interactions.setHoveredFeatures([pickedFeature]);
      },

      setInteractionListeners: function () {
        // TODO: unset listeners too
        const interactions = this.interactions;
        const hoveredFeatures = interactions.get("hoveredFeatures");
        this.listenTo(hoveredFeatures, "change update", this.updateCursor);
        // this.listenTo( interactions, "change update",
        //   this.handleClickedFeatures
        // );
      },

      /**
       * Change the cursor to a pointer when the mouse is hovering over a
       * feature.
       * @param {Object|null} hoveredFeatures - The feature that the mouse is
       * hovering over or null if the mouse is not hovering over a feature.
       */
      // When mouse moves? maybe throttle mouse move...
      updateCursor: function (hoveredFeatures) {
        const view = this;
        let cursorStyle = "default";
        if (hoveredFeatures && hoveredFeatures.length) {
          cursorStyle = "pointer";
        }
        view.el.style.cursor = cursorStyle;
      },

      // TODO
      showSelectedFeatures: function () {
        // Remove highlights from previously selected 3D tiles
        view.silhouettes.selected = [];
        // Highlight the newly selected 3D tiles
        selectedFeatures
          .getFeatureObjects("Cesium3DTileFeature")
          .forEach(function (featureObject) {
            view.silhouettes.selected.push(featureObject);
          });
      },

      /**
       * Add all of the model's layers to the map. This function is called
       * during the render function.
       * @since 2.26.0
       */
      addLayers: function () {
        const view = this;

        // Add each layer from the Map model to the Cesium widget. Render using
        // the function configured in the View's mapAssetRenderFunctions
        // property. Add in reverse order for layers to appear in the correct
        // order on the map.
        const layers = view.model.get("layers");
        if (layers && layers.length) {
          const layersReverse = layers.last(layers.length).reverse();
          layersReverse.forEach(function (layer) {
            view.addAsset(layer);
          })
        }

        // The Cesium Widget will support just one terrain option to start.
        // Later, we'll allow users to switch between terrains if there is more
        // than one.
        var terrains = view.model.get("terrains");
        var terrainModel = terrains ? terrains.first() : false;
        if (terrainModel) {
          view.addAsset(terrainModel);
        }
      },

      /**
       * Move the camera position and zoom to the specified target entity or
       * position on the map, using a nice animation. This function starts the
       * flying/zooming action by setting a zoomTarget and zoomOptions on the
       * view and requesting the scene to render. The actual zooming is done by
       * {@link CesiumWidgetView#completeFlight} after the scene has finished
       * rendering.
       * @param {MapAsset|Cesium.BoundingSphere|Object|Feature} target The
       * target asset, bounding sphere, or location to change the camera focus
       * to. If target is a MapAsset, then the bounding sphere from that asset
       * will be used for the target destination. If target is an Object, it may
       * contain any of the properties that are supported by the Cesium camera
       * flyTo options, see
       * {@link https://cesium.com/learn/cesiumjs/ref-doc/Camera.html#flyTo}. If
       * the target is a Feature, then it must be a Feature of a
       * CesiumVectorData layer (currently Cesium3DTileFeatures are not
       * supported). The target can otherwise be a Cesium BoundingSphere, see
       * {@link https://cesium.com/learn/cesiumjs/ref-doc/BoundingSphere.html}
       * @param {object} options - For targets that are a bounding sphere or
       * asset, options to pass to Cesium Camera.flyToBoundingSphere(). See
       * {@link https://cesium.com/learn/cesiumjs/ref-doc/Camera.html#flyToBoundingSphere}.
       */
      flyTo: function (target, options) {
        this.zoomTarget = target;
        this.zoomOptions = options;
        this.requestRender();
      },

      /**
       * This function is called by {@link CesiumWidgetView#postRender}; it
       * should only be called once the target has been fully rendered in the
       * scene. This function gets the bounding sphere, if required, and moves
       * the scene to encompass the full extent of the target.
       * @param {MapAsset|Cesium.BoundingSphere|Object|Feature|GeoPoint} target
       * The target asset, bounding sphere, or location to change the camera
       * focus to. If target is a MapAsset, then the bounding sphere from that
       * asset will be used for the target destination. If target is an Object,
       * it may contain any of the properties that are supported by the Cesium
       * camera flyTo options, see
       * {@link https://cesium.com/learn/cesiumjs/ref-doc/Camera.html#flyTo}.
       * The object may also be a position with longitude, latitude, and height.
       * If the target is a Feature, then it must be a Feature of a
       * CesiumVectorData layer (currently Cesium3DTileFeatures are not
       * supported). The target can otherwise be a Cesium BoundingSphere, see
       * {@link https://cesium.com/learn/cesiumjs/ref-doc/BoundingSphere.html}
       * @param {object} options - For targets that are a bounding sphere or
       * asset, options to pass to Cesium Camera.flyToBoundingSphere(). See
       * {@link https://cesium.com/learn/cesiumjs/ref-doc/Camera.html#flyToBoundingSphere}.
       * For other targets, options will be merged with the target object and
       * passed to Cesium Camera.flyTo(). See
       * {@link https://cesium.com/learn/cesiumjs/ref-doc/Camera.html#flyTo}
       */
      completeFlight: function (target, options) {
        try {
          const view = this;
          if (typeof options !== "object") options = {};

          // A target is required
          if (!target) {
            return;
          }

          // If the target is a Bounding Sphere, use the camera's built-in
          // function
          if (target instanceof Cesium.BoundingSphere) {
            view.camera.flyToBoundingSphere(target, options);
            view.resetZoomTarget();
            return;
          }

          // If the target is some type of map asset, then get a Bounding Sphere
          // for that asset and call this function again.
          if (
            target instanceof MapAsset &&
            typeof target.getBoundingSphere === "function"
          ) {
            // Pass the dataSourceDisplay for CesiumVectorData models
            target
              .getBoundingSphere(view.dataSourceDisplay)
              .then(function (assetBoundingSphere) {
                // Base value offset required to zoom in close enough to 3D
                // tiles for them to render.
                if (
                  target instanceof Cesium3DTileset &&
                  !Cesium.defined(options.offset)
                ) {
                  options.offset = new Cesium.HeadingPitchRange(
                    0.0,
                    -0.5,
                    assetBoundingSphere.radius
                  );
                }
                view.flyTo(assetBoundingSphere, options);
              });
            return;
          }

          // Note: This doesn't work yet for Cesium3DTilesetFeatures -
          // Cesium.BoundingSphereState gets stuck in "PENDING" and never
          // resolves. There's no native way of getting the bounding sphere or
          // location from a 3DTileFeature!
          if (target instanceof Feature) {
            // If the object saved in the Feature is an Entity, then this
            // function will get the bounding sphere for the entity on the next
            // run.
            setTimeout(() => {
              // TODO check if needed
              view.flyTo(target.get("featureObject"), options);
            }, 0);
            return;
          }

          // If the target is a Cesium Entity, then get the bounding sphere for
          // the entity and call this function again.
          const entity = target instanceof Cesium.Entity ? target : target.id;
          if (entity instanceof Cesium.Entity) {
            let entityBoundingSphere = new Cesium.BoundingSphere();
            view.dataSourceDisplay.getBoundingSphere(
              entity,
              false,
              entityBoundingSphere
            );
            setTimeout(() => {
              // TODO check if needed
              view.flyTo(entityBoundingSphere, options);
            }, 0);
            return;
          }

          if (target.type && target.type == "GeoPoint") {
            view.flyTo(target.toJSON(), options);
            return;
          }

          if (
            typeof target === "object" &&
            typeof target.longitude === "number" &&
            typeof target.latitude === "number"
          ) {
            const pointTarget = view.positionToFlightTarget(target);
            view.flyTo(pointTarget, options);
            return;
          }

          // If not a Map Asset or a BoundingSphere, then the target must be an
          // Object. Assume target are options for the Cesium camera flyTo
          // function
          if (typeof target === "object") {
            // Merge the options with the target object, if there are any
            // options
            if (options && Object.keys(options).length) {
              target = Object.assign(target, options);
            }
            // Fly to the target
            view.camera.flyTo(target);
            view.resetZoomTarget();
          }
        } catch (e) {
          console.log("Failed to navigate to a target in Cesium.", e);
        }
      },

      resetZoomTarget: function () {
        const view = this;
        view.zoomTarget = null;
        view.interactions.set("zoomTarget", null);
        view.zoomOptions = null;
      },

      /**
       * Navigate to the homePosition that's set on the Map.
       * @param {number} duration The duration of the flight in seconds.
       */
      flyHome: function (duration) {
        const home = this.model.get("homePosition");
        this.flyTo(home, { duration });
      },

      /**
       * Navigate to the homePosition that's set on the Map.
       * @param {Object} position The position to navigate to. Must have
       * longitude, latitude, and may have a height (elevation) in meters,
       * heading, pitch, and roll in degrees.
       * @param {number} duration The duration of the flight in seconds.
       */
      positionToFlightTarget: function (position, duration) {
        try {
          if (!position) {
            return null;
          }

          if (
            position &&
            Cesium.defined(position.longitude) &&
            Cesium.defined(position.latitude)
          ) {
            // Set a default height (elevation) if there isn't one set
            if (!Cesium.defined(position.height)) {
              position.height = 1000000;
            }

            const target = {};
            target.destination = Cesium.Cartesian3.fromDegrees(
              position.longitude,
              position.latitude,
              position.height
            );

            if (
              Cesium.defined(position.heading) &&
              Cesium.defined(position.pitch) &&
              Cesium.defined(position.roll)
            ) {
              target.orientation = {
                heading: Cesium.Math.toRadians(position.heading),
                pitch: Cesium.Math.toRadians(position.pitch),
                roll: Cesium.Math.toRadians(position.roll),
              };
            }
            if (Cesium.defined(duration)) {
              target.duration = duration;
            }

            return target;
          }
        } catch (e) {
          console.log("Failed to convert a position to a flight target.", e);
          return null;
        }
      },

      /**
       * Get the current positioning of the camera in the view.
       * @returns {MapConfig#CameraPosition} Returns an object with the
       * longitude, latitude, height, heading, pitch, and roll in the same
       * format that the Map model uses for the homePosition (see
       * {@link Map#defaults})
       */
      getCameraPosition: function () {
        return this.getDegreesFromCartesian(this.camera.position);
      },

      /**
       * Update the 'currentViewExtent' attribute in the Map model with the
       * bounding box of the currently visible area of the map.
       */
      updateViewExtent: function () {
        try {
          this.interactions.setViewExtent(this.getViewExtent());
        } catch (e) {
          console.log("Failed to update the Map view extent.", e);
        }
      },

      /**
       * Get the north, south, east, and west-most lat/long that define a
       * bounding box around the currently visible area of the map. Also gives
       * the height/ altitude of the camera in meters.
       * @returns {MapConfig#ViewExtent} The current view extent.
       */
      getViewExtent: function () {
        const view = this;
        const scene = view.scene;
        const camera = view.camera;
        // Get the height in meters
        const height = camera.positionCartographic.height;

        // This will be the bounding box of the visible area
        let coords = {
          north: null,
          south: null,
          east: null,
          west: null,
          height: height,
        };

        // First try getting the visible bounding box using the simple method
        if (!view.scratchRectangle) {
          // Store the rectangle that we use for the calculation (reduces
          // pressure on garbage collector system since this function is called
          // often).
          view.scratchRectangle = new Cesium.Rectangle();
        }
        var rect = camera.computeViewRectangle(
          scene.globe.ellipsoid,
          view.scratchRectangle
        );
        coords.north = Cesium.Math.toDegrees(rect.north);
        coords.east = Cesium.Math.toDegrees(rect.east);
        coords.south = Cesium.Math.toDegrees(rect.south);
        coords.west = Cesium.Math.toDegrees(rect.west);

        // Check if the resulting coordinates cover the entire globe (happens if
        // some of the sky is visible). If so, limit the bounding box to a
        // smaller extent
        if (view.coversGlobe(coords)) {
          // Find points at the top, bottom, right, and left corners of the
          // globe
          const edges = view.findEdges();

          // Get the midPoint between the top and bottom points on the globe.
          // Use this to decide if the northern or southern hemisphere is more
          // in view.
          let midPoint = view.findMidpoint(edges.top, edges.bottom);
          if (midPoint) {
            // Get the latitude of the mid point
            const midPointLat = view.getDegreesFromCartesian(midPoint).latitude;

            // Get the latitudes of all the edge points so that we can calculate
            // the southern and northern most coordinate
            const edgeLatitudes = [];
            Object.values(edges).forEach(function (point) {
              if (point) {
                edgeLatitudes.push(
                  view.getDegreesFromCartesian(point).latitude
                );
              }
            });

            if (midPointLat > 0) {
              // If the midPoint is in the northern hemisphere, limit the
              // southern part of the bounding box to the southern most edge
              // point latitude
              coords.south = Math.min(...edgeLatitudes);
            } else {
              // Vice versa for the southern hemisphere
              coords.north = Math.max(...edgeLatitudes);
            }
          }

          // If not focused directly on one of the poles, then also limit the
          // east and west sides of the bounding box
          const northPointLat = view.getDegreesFromCartesian(
            edges.top
          ).latitude;
          const southPointLat = view.getDegreesFromCartesian(
            edges.bottom
          ).latitude;

          if (northPointLat > 25 && southPointLat < -25) {
            if (edges.right) {
              coords.east = view.getDegreesFromCartesian(edges.right).longitude;
            }
            if (edges.left) {
              coords.west = view.getDegreesFromCartesian(edges.left).longitude;
            }
          }
        }

        return coords;
      },

      /**
       * Check if a given bounding box covers the entire globe.
       * @param {Object} coords - An object with the north, south, east, and
       * west coordinates of a bounding box
       * @param {Number} latAllowance - The number of degrees latitude to allow
       * as a buffer. If the north and south coords range from -90 to 90, minus
       * this buffer * 2, then it is considered to cover the globe.
       * @param {Number} lonAllowance - The number of degrees longitude to allow
       * as a buffer.
       * @returns {Boolean} Returns true if the bounding box covers the entire
       * globe, false otherwise.
       */
      coversGlobe: function (coords, latAllowance = 0.5, lonAllowance = 1) {
        const maxLat = 90 - latAllowance;
        const minLat = -90 + latAllowance;
        const maxLon = 180 - lonAllowance;
        const minLon = -180 + lonAllowance;

        return (
          coords.west <= minLon &&
          coords.east >= maxLon &&
          coords.south <= minLat &&
          coords.north >= maxLat
        );
      },

      /**
       * Get longitude and latitude degrees from a cartesian point.
       * @param {Cesium.Cartesian3} cartesian - The point to get degrees for
       * @returns Returns an object with the longitude and latitude in degrees,
       * as well as the height in meters
       */
      getDegreesFromCartesian: function (cartesian) {
        const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
        const degrees = {
          height: cartographic.height,
        };
        const coordinates = [
          "longitude",
          "latitude",
          "heading",
          "pitch",
          "roll",
        ];
        coordinates.forEach(function (coordinate) {
          if (Cesium.defined(cartographic[coordinate])) {
            degrees[coordinate] = Cesium.Math.toDegrees(
              cartographic[coordinate]
            );
          }
        });
        return degrees;
      },

      /**
       * Find four points that exist on the globe that are closest to the
       * top-center, bottom-center, right-middle, and left-middle points of the
       * screen. Note that these are not necessarily the northern, southern,
       * eastern, and western -most points, since the map may be oriented in any
       * direction (e.g. facing the north pole).
       *
       * @returns {Cesium.Cartesian3[]} Returns an object with the top, bottom,
       * left, and right points of the globe.
       */
      findEdges: function () {
        try {
          const view = this;
          const canvas = view.scene.canvas;
          const maxX = canvas.clientWidth;
          const maxY = canvas.clientHeight;
          const midX = (maxX / 2) | 0;
          const midY = (maxY / 2) | 0;

          // Points at the extreme edges of the cesium canvas. These may not be
          // points on the globe (i.e. they could be in the sky)
          const topCanvas = new Cesium.Cartesian2(midX, 0);
          const rightCanvas = new Cesium.Cartesian2(maxX, midY);
          const bottomCanvas = new Cesium.Cartesian2(midX, maxY);
          const leftCanvas = new Cesium.Cartesian2(0, midY);

          // Find the real world coordinate that is closest to the canvas edge
          // points
          const points = {
            top: view.findPointOnGlobe(topCanvas, bottomCanvas),
            right: view.findPointOnGlobe(rightCanvas, leftCanvas),
            bottom: view.findPointOnGlobe(bottomCanvas, topCanvas),
            left: view.findPointOnGlobe(leftCanvas, rightCanvas),
          };

          return points;
        } catch (error) {
          console.log(
            "There was an error finding the edge points in a CesiumWidgetView" +
              ". Error details: " +
              error
          );
        }
      },

      /**
       * Given two Cartesian3 points, compute the midpoint.
       * @param {Cesium.Cartesian3} p1  The first point
       * @param {Cesium.Cartesian3} p2  The second point
       * @returns {Cesium.Cartesian3 | null} The midpoint or null if p1 or p2 is
       * not defined.
       */
      findMidpoint: function (p1, p2) {
        try {
          if (!p1 || !p2) {
            return null;
          }
          // Compute vector from p1 to p2
          let p1p2 = new Cesium.Cartesian3(0.0, 0.0, 0.0);
          Cesium.Cartesian3.subtract(p2, p1, p1p2);

          // Compute vector to midpoint
          let halfp1p2 = new Cesium.Cartesian3(0.0, 0.0, 0.0);
          Cesium.Cartesian3.multiplyByScalar(p1p2, 0.5, halfp1p2);

          // Compute point half way between p1 and p2
          let p3 = new Cesium.Cartesian3(0.0, 0.0, 0.0);
          p3 = Cesium.Cartesian3.add(p1, halfp1p2, p3);

          // Force point onto surface of ellipsoid
          const midPt = Cesium.Cartographic.fromCartesian(p3);
          const p3a = Cesium.Cartesian3.fromRadians(
            midPt.longitude,
            midPt.latitude,
            0.0
          );

          return p3a;
        } catch (error) {
          console.log(
            "There was an error finding a midpoint in a CesiumWidgetView" +
              ". Error details: " +
              error
          );
        }
      },

      /**
       * Find a coordinate that exists on the surface of the globe between two
       * Cartesian points. The points do not need to be withing the bounds of
       * the globe/map (i.e. they can be points in the sky). Uses the Bresenham
       * Algorithm to traverse pixels from the first coordinate to the second,
       * until it finds a valid coordinate.
       * @param {Cesium.Cartesian2} startCoordinates The coordinates to start
       * searching, in pixels
       * @param {Cesium.Cartesian2} endCoordinates The coordinates to stop
       * searching, in pixels
       * @returns {Cesium.Cartesian3 | null} Returns the x, y, z coordinates of
       * the first real point, or null if a valid point was not found.
       *
       * @see {@link https://groups.google.com/g/cesium-dev/c/e2H7EefikAk}
       */
      findPointOnGlobe: function (startCoordinates, endCoordinates) {
        const view = this;
        const camera = view.camera;
        const ellipsoid = view.scene.globe.ellipsoid;

        if (!startCoordinates || !endCoordinates) {
          return null;
        }

        let coordinate = camera.pickEllipsoid(startCoordinates, ellipsoid);

        // Translate coordinates
        let x1 = startCoordinates.x;
        let y1 = startCoordinates.y;
        const x2 = endCoordinates.x;
        const y2 = endCoordinates.y;
        // Define differences and error check
        const dx = Math.abs(x2 - x1);
        const dy = Math.abs(y2 - y1);
        const sx = x1 < x2 ? 1 : -1;
        const sy = y1 < y2 ? 1 : -1;
        let err = dx - dy;

        coordinate = camera.pickEllipsoid({ x: x1, y: y1 }, ellipsoid);
        if (coordinate) {
          return coordinate;
        }

        // Main loop
        while (!(x1 == x2 && y1 == y2)) {
          const e2 = err << 1;
          if (e2 > -dy) {
            err -= dy;
            x1 += sx;
          }
          if (e2 < dx) {
            err += dx;
            y1 += sy;
          }

          coordinate = camera.pickEllipsoid({ x: x1, y: y1 }, ellipsoid);
          if (coordinate) {
            return coordinate;
          }
        }

        return null;
      },

      /**
       * Update the map model's currentScale attribute, which is used for the
       * scale bar. Finds the distance between two pixels at the *bottom center*
       * of the screen.
       */
      updateScale: function () {
        try {
          const view = this;
          let currentScale = {
            pixels: null,
            meters: null,
          };
          const onePixelInMeters = view.pixelToMeters();
          if (onePixelInMeters || onePixelInMeters === 0) {
            currentScale = {
              pixels: 1,
              meters: onePixelInMeters,
            };
          }
          view.interactions.setScale(currentScale);
        } catch (e) {
          console.log("Error updating the scale from a CesiumWidgetView", e);
        }
      },

      /**
       * Finds the geodesic distance (in meters) between two points that are 1
       * pixel apart at the bottom, center of the Cesium canvas. Adapted from
       * TerriaJS. See
       * {@link https://github.com/TerriaJS/terriajs/blob/main/lib/ReactViews/Map/Legend/DistanceLegend.jsx}
       * @returns {number|boolean} Returns the distance on the globe, in meters,
       * that is equivalent to 1 pixel on the screen at the center bottom point
       * of the current scene. Returns false if there was a problem getting the
       * measurement.
       */
      pixelToMeters: function () {
        try {
          const view = this;
          const scene = view.scene;
          const globe = scene.globe;
          const camera = scene.camera;

          // For measuring geodesic distances (shortest route between two points
          // on the Earth's surface)
          if (!view.geodesic) {
            view.geodesic = new Cesium.EllipsoidGeodesic();
          }

          // Find two points that are 1 pixel apart at the bottom center of the
          // cesium canvas.
          const width = scene.canvas.clientWidth;
          const height = scene.canvas.clientHeight;

          const left = camera.getPickRay(
            new Cesium.Cartesian2((width / 2) | 0, height - 1)
          );
          const right = camera.getPickRay(
            new Cesium.Cartesian2((1 + width / 2) | 0, height - 1)
          );

          const leftPosition = globe.pick(left, scene);
          const rightPosition = globe.pick(right, scene);

          // A point must exist at both positions to get the distance
          if (!Cesium.defined(leftPosition) || !Cesium.defined(rightPosition)) {
            return false;
          }

          // Find the geodesic distance, in meters, between the two points that
          // are 1 pixel apart
          const leftCartographic =
            globe.ellipsoid.cartesianToCartographic(leftPosition);
          const rightCartographic =
            globe.ellipsoid.cartesianToCartographic(rightPosition);

          view.geodesic.setEndPoints(leftCartographic, rightCartographic);

          const onePixelInMeters = view.geodesic.surfaceDistance;

          return onePixelInMeters;
        } catch (error) {
          console.log(
            "Failed to get a pixel to meters measurement in a CesiumWidgetView" +
              ". Error details: " +
              error
          );
          return false;
        }
      },

      /**
       * Finds the function that is configured for the given asset model type in
       * the {@link CesiumWidgetView#mapAssetRenderFunctions} array, then
       * renders the asset in the map. If there is a problem rendering the asset
       * (e.g. it is an unsupported type that is not configured in the
       * mapAssetRenderFunctions), then sets the AssetModel's status to error.
       * @param {MapAsset} mapAsset A MapAsset layer to render in the map, such
       * as a Cesium3DTileset or a CesiumImagery model.
       */
      addAsset: function (mapAsset) {
        try {
          if (!mapAsset) {
            return;
          }
          var view = this;
          var type = mapAsset.get("type");
          // Find the render option from the options configured in the view,
          // given the asset model type
          const renderOption =
            _.find(view.mapAssetRenderFunctions, function (option) {
              return option.types.includes(type);
            }) || {};
          // Get the function for this type
          const renderFunction = view[renderOption.renderFunction];

          // If the cesium widget does not have a way to display this error,
          // update the error status in the model (this will be reflected in the
          // LayerListView)
          if (!renderFunction || typeof renderFunction !== "function") {
            mapAsset.set(
              "statusDetails",
              "This type of resource is not supported in the map widget."
            );
            mapAsset.set("status", "error");
            return;
          }

          // The asset should be visible and the cesium model should be ready
          // before starting to render the asset
          const checkAndRenderAsset = function () {
            let shouldRender =
              mapAsset.get("visible") && mapAsset.get("status") === "ready";
            if (shouldRender) {
              renderFunction.call(view, mapAsset.get("cesiumModel"));
              view.stopListening(mapAsset);
            }
          };

          checkAndRenderAsset();

          if (!mapAsset.get("visible")) {
            view.listenToOnce(mapAsset, "change:visible", checkAndRenderAsset);
          }

          if (mapAsset.get("status") !== "ready") {
            view.listenTo(mapAsset, "change:status", checkAndRenderAsset);
          }
        } catch (e) {
          console.error("Error rendering an asset", e, mapAsset);
          mapAsset.set(
            "statusDetails",
            "There was a problem rendering this resource in the map widget."
          );
          mapAsset.set("status", "error");
        }
      },

      /**
       * When an asset is removed from the map model, remove it from the map.
       * @param {MapAsset} mapAsset - The MapAsset model removed from the map
       * @since x.x.x
       */
      removeAsset: function (mapAsset) {
        if (!mapAsset) return;
        // Get the cesium model from the asset
        const cesiumModel = mapAsset.get("cesiumModel");
        if (!cesiumModel) return;
        // Find the remove function for this type of asset
        const removeFunctionName = this.mapAssetRenderFunctions.find(function (
          option
        ) {
          return option.types.includes(mapAsset.get("type"));
        })?.removeFunction;
        const removeFunction = this[removeFunctionName];
        // If there is a function for this type of asset, call it
        if (removeFunction && typeof removeFunction === "function") {
          removeFunction.call(this, cesiumModel);
        } else {
          console.log(
            "No remove function found for this type of asset",
            mapAsset
          );
        }
      },

      /**
       * Renders peaks and valleys in the 3D version of the map, given a terrain
       * model. If a terrain model has already been set on the map, this will
       * replace it.
       * @param {Cesium.TerrainProvider} cesiumModel a Cesium Terrain Provider
       * model to use for the map
       */
      updateTerrain: function (cesiumModel) {
        // TODO: Add listener to the map model for when the terrain changes
        this.scene.terrainProvider = cesiumModel;
        this.requestRender();
      },

      /**
       * Renders a 3D tileset in the map.
       * @param {Cesium.Cesium3DTileset} cesiumModel The Cesium 3D tileset model
       * that contains the information about the 3D tiles to render in the map
       */
      add3DTileset: function (cesiumModel) {
        this.scene.primitives.add(cesiumModel);
      },

      /**
       * Remove a 3D tileset from the map.
       * @param {Cesium.Cesium3DTileset} cesiumModel The Cesium 3D tileset model
       * to remove from the map
       * @since x.x.x
       */
      remove3DTileset: function (cesiumModel) {
        this.scene.primitives.remove(cesiumModel);
      },

      /**
       * Renders vector data (excluding 3D tilesets) in the Map.
       * @param {Cesium.GeoJsonDataSource} cesiumModel - The Cesium data source
       * model to render on the map
       */
      addVectorData: function (cesiumModel) {
        this.dataSourceCollection.add(cesiumModel);
      },

      /**
       * Remove vector data (excluding 3D tilesets) from the Map.
       * @param {Cesium.GeoJsonDataSource} cesiumModel - The Cesium data source
       * model to remove from the map
       * @since x.x.x
       */
      removeVectorData: function (cesiumModel) {
        this.dataSourceCollection.remove(cesiumModel);
      },

      /**
       * Renders imagery in the Map.
       * @param {Cesium.ImageryLayer} cesiumModel The Cesium imagery model to
       * render
       */
      addImagery: function (cesiumModel) {
        this.scene.imageryLayers.add(cesiumModel);
        this.sortImagery();
      },

      /**
       * Remove imagery from the Map.
       * @param {Cesium.ImageryLayer} cesiumModel The Cesium imagery model to
       * remove from the map
       * @since x.x.x
       */
      removeImagery: function (cesiumModel) {
        console.log("Removing imagery from map", cesiumModel);
        console.log("Imagery layers", this.scene.imageryLayers);
        this.scene.imageryLayers.remove(cesiumModel);
      },

      /**
       * Arranges the imagery that is rendered the Map according to the order
       * that the imagery is arranged in the layers collection.
       * @since 2.21.0
       */
      sortImagery: function () {
        try {
          const imageryInMap = this.scene.imageryLayers;
          const imageryModels = this.model
            .get("layers")
            .getAll("CesiumImagery");

          // If there are no imagery layers, or just one, return
          if (
            !imageryInMap ||
            !imageryModels ||
            imageryInMap.length <= 1 ||
            imageryModels.length <= 1
          ) {
            return;
          }

          // If there are more than one imagery layer, arrange them in the order
          // that they were added to the map
          for (let i = 0; i < imageryModels.length; i++) {
            const cesiumModel = imageryModels[i].get("cesiumModel");
            if (cesiumModel) {
              if (imageryInMap.contains(cesiumModel)) {
                imageryInMap.lowerToBottom(cesiumModel);
              }
            }
          }
        } catch (error) {
          console.log(
            "There was an error sorting displayed imagery in a CesiumWidgetView" +
              ". Error details: " +
              error
          );
        }
      },

      /**
       * Display a box around every rendered tile in the tiling scheme, and draw
       * a label inside it indicating the X, Y, Level indices of the tile. This
       * is mostly useful for debugging terrain and imagery rendering problems.
       * This function should be called after the other imagery layers have been
       * added to the map, e.g. at the end of the render function.
       * @param {string} [color='#ffffff'] The color of the grid outline and
       * labels. Must be a CSS color string, beginning with a #.
       * @param {'GeographicTilingScheme'|'WebMercatorTilingScheme'}
       *  [tilingScheme='GeographicTilingScheme'] The tiling scheme to use.
       *  Defaults to GeographicTilingScheme.
       */
      showImageryGrid: function (
        color = "#ffffff",
        tilingScheme = "GeographicTilingScheme"
      ) {
        try {
          const view = this;
          // Check the color is valid
          if (!color || typeof color !== "string" || !color.startsWith("#")) {
            console.log(
              `${color} is an invalid color for imagery grid. ` +
                `Must be a hex color starting with '#'. ` +
                `Setting color to white: '#ffffff'`
            );
            color = "#ffffff";
          }

          // Check the tiling scheme is valid
          const availableTS = [
            "GeographicTilingScheme",
            "WebMercatorTilingScheme",
          ];
          if (availableTS.indexOf(tilingScheme) == -1) {
            console.log(
              `${tilingScheme} is not a valid tiling scheme ` +
                `for the imagery grid. Using WebMercatorTilingScheme`
            );
            tilingScheme = "WebMercatorTilingScheme";
          }

          // Create the imagery grid
          const gridOpts = {
            tilingScheme: new Cesium[tilingScheme](),
            color: Cesium.Color.fromCssColorString(color),
          };

          const gridOutlines = new Cesium.GridImageryProvider(gridOpts);
          const gridCoords = new Cesium.TileCoordinatesImageryProvider(
            gridOpts
          );
          view.scene.imageryLayers.addImageryProvider(gridOutlines);
          view.scene.imageryLayers.addImageryProvider(gridCoords);
        } catch (error) {
          console.log(
            "There was an error showing the imagery grid in a CesiumWidgetView" +
              ". Error details: " +
              error
          );
        }
      },
    }
  );

  return CesiumWidgetView;
});
