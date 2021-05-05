define(['underscore',
  'jquery',
  'backbone',
  "cesium",
  "models/maps/CesiumModel",
  "text!templates/maps/cesium.html"],
  function (_, $, Backbone, Cesium, CesiumModel, Template) {

    /**
    * @class CesiumView
    * @classdesc A Cesium map
    * @classcategory Views/Maps
    * @extends Backbone.View
    * @constructor
    // TODO: Add screenshot
    */
    var CesiumView = Backbone.View.extend(
      /** @lends CesiumView.prototype */
      {

        /**
        * The type of View this is
        * @type {string}
        */
        type: "CesiumView",

        /**
        * The HTML classes to use for this view's element
        * @type {string}
        */
        className: "cesium-view",

        /**
         * A Cesium Model that provides mapping options and geohash functionality to this
         * view.
         * @type {CesiumModel}
         */
        model: null,

        /**
        * The html template that contains the Cesium map. HTML files are converted to Underscore.js templates
        * @type {Underscore.Template}
        */
        template: _.template(Template),

        /**
        * The events this view will listen to and the associated function to call.
        * @type {Object}
        */
        events: {
        },

        /**
        * Creates a new CesiumView
        * @param {Object} options - A literal object with options to pass to the view
        */
        initialize: function (options) {
          try {
            // Set the Cesium map model on this view. Create a new one if required.
            if (options && options.model) {
              this.model = options.model
            } else {
              this.model = new CesiumModel();
            }
            // Set the Cesium Ion token (required for some map features)
            Cesium.Ion.defaultAccessToken = MetacatUI.appModel.get("cesiumToken");
          }
          catch (error) {
            console.log(
              'There was an error initializing a CesiumView' +
              '. Error details: ' + error
            );
          }
        },

        /**
        * Renders this view
        */
        render: function () {

          // If Cesium features are disabled in the AppConfig, then exit without rendering
          // anything.
          if (!MetacatUI.appModel.get("enableCesium")) {
            return;
          }

          // Save a reference to this view
          var view = this

          // Add the Cesium template
          this.$el.html(this.template());

          // Initialize the Cesium Viewer in the HTML element with the `cesiumContainer` ID.
          // TODO: make some of these options configurable
          this.viewer = new Cesium.Viewer('cesiumContainer', {
            imageryProvider: new Cesium.IonImageryProvider({ assetId: 3954 }),
            terrainProvider: new Cesium.CesiumTerrainProvider({
              url: Cesium.IonResource.fromAssetId(3956),
            }),
            baseLayerPicker: false,
            timeline: false,
            fullscreenButton: false,
            animation: false
          });

          // If there's a home position set on the Cesium model, fly to the home position
          // and overwrite the behaviour of the home button.
          if (this.model.get("homePosition")) {
            this.showHome()
            this.viewer.homeButton.viewModel.command.beforeExecute.addEventListener(
              function (e) {
                e.cancel = true;
                view.showHome()
              });
          }

        },

        /**
         * Navigate to the homePosition that's set on the CesiumModel.
         */
        showHome: function () {
          try {
            if (this.model.get("homePosition")) {
              var position = this.model.get("homePosition")
              this.viewer.camera.flyTo({
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
         * height, heading, pitch, and roll in the same format that the CesiumModel uses
         * for the homePosition (see {@link CesiumModel#defaults})
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
         * Shows the geohash grid in the map
         */
        showGeohashes: function () {
          try {
            var view = this;
            // Refresh the geohashes when the camera zooms or pans
            this.camera.moveEnd.addEventListener(function () {
              view.updateGeohashes()
            });
            // Show the geohashes right away
            this.updateGeohashes()
            // Highlight the hovered geohash
            var handler = new Cesium.ScreenSpaceEventHandler(view.viewer.scene.canvas);
            handler.setInputAction(function (movement) {
              // get an array of all primitives at the mouse position
              var pickedObjects = view.viewer.scene.drillPick(movement.endPosition);
              view.pickedEntities.removeAll();
              if (Cesium.defined(pickedObjects)) {
                // Update the collection of picked entities
                for (var i = 0; i < pickedObjects.length; ++i) {
                  var entity = pickedObjects[i].id;
                  if (!view.pickedEntities.contains(entity)) {
                    view.pickedEntities.add(entity);
                  }
                }
              }
            }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
          }
          catch (error) {
            console.log(
              'There was an error enabling geohashes in a CesiumView' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Add or update the geohash grid in the map
         */
        updateGeohashes: function () {

          try {
            // A reference to this view
            var view = this;
            // The current altitude
            var altitude = Cesium.Cartographic.fromCartesian(view.camera.position).height;
            // The precision for the geohashes
            var precision = view.model.determineGeohashLevel(altitude);
            // Get the coordinates of the area currently in view
            var bb = view.getVisibleBoundingBox()
            // Get the geohashes
            var geohashes = this.model.getGeohashes(
              bb.south, bb.west, bb.north, bb.east, precision, true
            )

            if (!view.geohashEntities) {
              // Create the collection of geohash entities, if not already created
              view.geohashEntities = new Cesium.CustomDataSource('geohashes');
              view.viewer.dataSources.add(view.geohashEntities);
              // TODO: make colours configurable in the CesiumModel
              view.pickColor = Cesium.Color.YELLOW.withAlpha(0.5);
              view.pickedEntities = new Cesium.EntityCollection();
            } else {
              // Clear the collection of geohash entities, if already created
              view.geohashEntities.entities.removeAll()
              view.pickedEntities.removeAll()
            }

            for (const [name, bb] of Object.entries(geohashes)) {
              // convert [minlat, minlon, maxlat, maxlon] to [west, south, east, north]
              var rectData = view.makeRectangleData(bb[1], bb[0], bb[3], bb[2], name)
              var geoHash = view.geohashEntities.entities.add(rectData)
              view.makeProperty(
                geoHash,
                // TODO: make colours configurable in the CesiumModel
                new Cesium.Color.fromCssColorString('rgba(172, 233, 241, 0.30)')
              );
            }
          }
          catch (error) {
            console.log(
              'There was an error updating geohashes in a CesiumView' +
              '. Error details: ' + error
            );
          }

        },

        // WIP: Takes an entity and makes the colour change on hover
        makeProperty: function (entity, color) {
          var view = this;

          var colorProperty = new Cesium.CallbackProperty(function (time, result) {
            if (view.pickedEntities.contains(entity)) {
              return view.pickColor.clone(result);
            }
            return color.clone(result);
          }, false);

          entity.rectangle.material = new Cesium.ColorMaterialProperty(
            colorProperty
          );
        },

        // WIP: Creates an Object with properties for a Cesium rectangle entity
        makeRectangleData: function (west, south, east, north, name) {
          return {
            name: name,
            rectangle: {
              coordinates: Cesium.Rectangle.fromDegrees(west, south, east, north),
              // material: material,
              height: 0,
              outline: true,
              outlineColor: Cesium.Color.WHITE,
              outlineWidth: 5
            }
          }
        },

        /**
         * Gets the coordinates for the area that is currently in view.
         * @returns returns on Object with north, east, south, and west coordinates.
         */
        getVisibleBoundingBox: function () {

          try {
            var view = this;
            var viewer = this.viewer;

            // Scratch memory allocation, happens only once.
            if (!this.scratchRectangle) {
              this.scratchRectangle = new Cesium.Rectangle();
            }

            var rect = viewer.camera.computeViewRectangle(
              viewer.scene.globe.ellipsoid,
              view.scratchRectangle
            );

            return {
              north: Cesium.Math.toDegrees(rect.north),
              east: Cesium.Math.toDegrees(rect.east),
              south: Cesium.Math.toDegrees(rect.south),
              west: Cesium.Math.toDegrees(rect.west),
            }
          }
          catch (error) {
            console.log(
              'There was an error getting the visible bounding box in a CesiumView' +
              '. Error details: ' + error
            );
          }

        },


      });

    return CesiumView;
  });
