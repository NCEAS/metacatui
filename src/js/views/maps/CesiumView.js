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

        // TODO - These should be set by the (to be created) layer model that configures a
        // contour and elevation layer.
        contourColor: Cesium.Color.RED.clone(),
        contourUniforms: {},
        shadingUniforms: {},

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
          // TODO: make these options configurable
          this.viewer = new Cesium.Viewer('cesiumContainer', {

            // Use bing maps as the default base map for now
            imageryProvider: new Cesium.BingMapsImageryProvider({
              url: 'https://dev.virtualearth.net',
              key: MetacatUI.AppConfig.bingMapsKey,
              mapStyle: Cesium.BingMapsStyle.AERIAL
            }),

            // The arctic DEM via cesium ION
            terrainProvider: new Cesium.CesiumTerrainProvider({
              url: Cesium.IonResource.fromAssetId(3956),
              requestVertexNormals: true, // Needed to visualize slope and aspect
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

          // Enable lighting for hill shading
          this.viewer.scene.globe.enableLighting = true;

          // Save a reference to the cesium camera - it's used through-out the view to
          // zoom, listen for user changes, etc.
          this.camera = this.viewer.camera

          // --- Cesium examples ---
          // TODO: These functions show examples of the ways in which Cesium is capable of
          // displaying geo-spatial data. These need to be generalized so that we can use
          // a JSON config file to set any of these types of layers.
          this.makeLayers();
          this.updateMaterial();
          this.showExampleLakesTiles();
          this.showExampleLeoData();

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

        // Show LeoNetwork news markers. This is an example, and GeoJSON like this should
        // eventually be a configurable layer in the maps model config.
        showExampleLeoData: function () {

          var leoUrl = 'https://www.leonetwork.org/explore/posts?query=&type=TWEET&type=POST&type=ARTICLE&mode=geojson_compact&region=&polygon=&bbox=&minlat=&maxlat=&near=&radius=&categories=PERMAFROST%7cPermafrost+Change&categories_anyOrAll=ANY&fromdate=&todate=';

          // Format the description property of the GeoJSON so that the infobox will show
          // the title, date, thumbnail and summary of the related news article. Consider
          // how to generalize this in the future.
          var formattedJson = fetch(leoUrl)
            .then(response => response.json())
            .then(function (collection) {
              collection.features.forEach(function (feature, index) {
                var props = feature.properties;
                var img = '',
                    date = '',
                    location = '',
                    text = '',
                    link = '';
                if (props.thumbnail) {
                  img = '<img\
                    width="60px"\
                    max-width="50%"\
                    style="float:right; margin: 1em;"\
                    src="' + props.thumbnail +'"/>'
                }
                if (props.date) {
                  var d = new Date(props.date);
                  var ye = new Intl.DateTimeFormat('en', { year: 'numeric' }).format(d);
                  var mo = new Intl.DateTimeFormat('en', { month: 'short' }).format(d);
                  var da = new Intl.DateTimeFormat('en', { day: '2-digit' }).format(d);
                  date = '<time\
                    style="font-size: 0.8em; text-transform: uppercase; padding: 5px 0; display: block;"\
                    datetime=' + props.date + '>' + da + ' ' + mo + ' ' + ye + '</time>'
                }
                if (props.location) {
                  location = '<div\
                  style="font-size: 0.8em; text-transform: uppercase; padding: 5px 0; opacity: 0.65;"\
                  >' + props.location + '</div>'
                }
                if (props.description) {
                  text = '<p>' + props.description + '</p>'
                }
                if (props.url) {
                  link = '<a href="' + props.url +'" target="_blank">Read more on the LeoNetwork</a>'
                }
                collection.features[index].properties = {
                  name: props.title,
                  description: img + date + location + text + link
                }
              });
              return collection
            })
          
          this.viewer.dataSources.add(
            Cesium.GeoJsonDataSource.load(
              formattedJson,
              {
                markerSize: 25,
                markerColor: Cesium.Color.fromCssColorString('#dbba3d')
              })
          );
          
          
        },

        // Shows example 3D tiles created from the lakes shapefiles using FME. Hosted on
        // Cesium ION.
        showExampleLakesTiles: function () {

          var view = this;

          var tileset = this.viewer.scene.primitives.add(
            new Cesium.Cesium3DTileset({
              url: Cesium.IonResource.fromAssetId(509158),
              // debugShowRenderingStatistics: true
            })
          );

          // tileset.readyPromise
          //   .then(function () {
          //     view.viewer.zoomTo(tileset);
          //   })
          //   .otherwise(function (error) {
          //     console.log(error);
          //   });
        },

        // Set up the functions to hide and re-order imagery layers that appear in the
        // example toolbar. This uses knockout which is built into Cesium. We should use
        // backbone instead and maybe switch to the lighter weight Cesium widget instead
        // of Cesium viewer.
        makeLayers: function () {

          var view = this;

          this.knockoutViewModel = {
            // changing layers
            layers: [],
            baseLayers: [],
            upLayer: null,
            downLayer: null,
            selectedLayer: null,
            isSelectableLayer: function (layer) {
              return this.baseLayers.indexOf(layer) >= 0;
            },
            raise: function (layer, index) {
              view.viewer.imageryLayers.raise(layer);
              view.knockoutViewModel.upLayer = layer;
              view.knockoutViewModel.downLayer = view.knockoutViewModel.layers[Math.max(0, index - 1)];
              view.updateLayerList();
              window.setTimeout(function () {
                view.knockoutViewModel.upLayer = view.knockoutViewModel.downLayer = null;
              }, 10);
            },
            lower: function (layer, index) {
              view.viewer.imageryLayers.lower(layer);
              view.knockoutViewModel.upLayer =
                view.knockoutViewModel.layers[
                Math.min(view.knockoutViewModel.layers.length - 1, index + 1)
                ];
              view.knockoutViewModel.downLayer = layer;
              view.updateLayerList();
              window.setTimeout(function () {
                view.knockoutViewModel.upLayer = view.knockoutViewModel.downLayer = null;
              }, 10);
            },
            canRaise: function (layerIndex) {
              return layerIndex > 0;
            },
            canLower: function (layerIndex) {
              return layerIndex >= 0 && layerIndex < view.viewer.imageryLayers.length - 1;
            },
            // elevation shading & contour lines
            enableContour: false,
            contourSpacing: 150.0,
            contourWidth: 2.0,
            selectedShading: "none",
            changeColor: function () {
              view.contourUniforms.color = Cesium.Color.fromRandom(
                { alpha: 1.0 },
                view.contourColor
              );
            },
          };

          Cesium.knockout.track(view.knockoutViewModel);

          this.setupLayers();
          this.updateLayerList();

          //Bind the knockoutViewModel to the DOM elements of the UI that call for it.
          var toolbar = document.getElementById("toolbar");
          toolbar.style.display = "block"
          Cesium.knockout.applyBindings(view.knockoutViewModel, toolbar);

          Cesium.knockout
            .getObservable(view.knockoutViewModel, "selectedLayer")
            .subscribe(function (baseLayer) {
              // Handle changes to the drop-down base layer selector.
              var activeLayerIndex = 0;
              var numLayers = view.knockoutViewModel.layers.length;
              for (var i = 0; i < numLayers; ++i) {
                if (view.knockoutViewModel.isSelectableLayer(view.knockoutViewModel.layers[i])) {
                  activeLayerIndex = i;
                  break;
                }
              }
              var activeLayer = view.knockoutViewModel.layers[activeLayerIndex];
              var show = activeLayer.show;
              var alpha = activeLayer.alpha;
              view.viewer.imageryLayers.remove(activeLayer, false);
              view.viewer.imageryLayers.add(baseLayer, numLayers - activeLayerIndex - 1);
              baseLayer.show = show;
              baseLayer.alpha = alpha;
              view.updateLayerList();
            });

          // For the contours... 
          Cesium.knockout
            .getObservable(view.knockoutViewModel, "enableContour")
            .subscribe(function (newValue) {
              view.updateMaterial();
            });

          Cesium.knockout
            .getObservable(view.knockoutViewModel, "contourWidth")
            .subscribe(function (newValue) {
              view.contourUniforms.width = parseFloat(newValue);
            });

          Cesium.knockout
            .getObservable(view.knockoutViewModel, "contourSpacing")
            .subscribe(function (newValue) {
              view.contourUniforms.spacing = parseFloat(newValue);
            });

          Cesium.knockout
            .getObservable(view.knockoutViewModel, "selectedShading")
            .subscribe(function (value) {
              view.updateMaterial();
            });

        },

        // Add each of the base layers set in the model's baseLayer and dataLayer
        // attributes.
        setupLayers: function () {

          var view = this;

          view.addBaseLayerOption("Bing", undefined); // Name the current/default base layer

          // Add the base layer options
          var baseLayers = this.model.get("baseLayers");
          if (baseLayers && baseLayers.length) {
            baseLayers.forEach(function (baseLayer) {
              var label = baseLayer.label || "Base layer"
              var createFunction = Cesium[baseLayer.type]
              var createOptions = baseLayer.options || {}
              if (createFunction) {
                view.addBaseLayerOption(
                  label,
                  new createFunction(createOptions)
                );
              }
            })
          }

          // Add the data layer options
          var dataLayers = this.model.get("dataLayers");
          if (dataLayers && dataLayers.length) {
            dataLayers.forEach(function (dataLayer) {
              var label = dataLayer.label || "Base layer"
              var createFunction = Cesium[dataLayer.type]
              var createOptions = dataLayer.options || {}
              if (createFunction) {
                view.addAdditionalLayerOption(
                  label,
                  new createFunction(createOptions)
                );
              }
            })
          }

          return
        },

        addBaseLayerOption: function (name, imageryProvider) {
          var view = this;
          var layer;
          if (typeof imageryProvider === "undefined") {
            layer = view.viewer.imageryLayers.get(0);
            view.knockoutViewModel.selectedLayer = layer;
          } else {
            layer = new Cesium.ImageryLayer(imageryProvider);
          }

          layer.name = name;
          view.knockoutViewModel.baseLayers.push(layer);
        },

        addAdditionalLayerOption: function (name, imageryProvider, alpha, show) {
          var view = this;
          var layer = view.viewer.imageryLayers.addImageryProvider(imageryProvider);
          layer.alpha = Cesium.defaultValue(alpha, 0.5);
          layer.show = Cesium.defaultValue(show, true);
          layer.name = name;
          Cesium.knockout.track(layer, ["alpha", "show", "name"]);
        },
        
        updateLayerList: function () {
          var view = this;
          var numLayers = view.viewer.imageryLayers.length;
          view.knockoutViewModel.layers.splice(0, view.knockoutViewModel.layers.length);
          for (var i = numLayers - 1; i >= 0; --i) {
            view.knockoutViewModel.layers.push(view.viewer.imageryLayers.get(i));
          }
        },

        getElevationContourMaterial: function () {
          var view = this;
          // Creates a composite material with both elevation shading and contour lines
          return new Cesium.Material({
            fabric: {
              type: "ElevationColorContour",
              materials: {
                contourMaterial: {
                  type: "ElevationContour",
                },
                elevationRampMaterial: {
                  type: "ElevationRamp",
                },
              },
              components: {
                diffuse:
                  "contourMaterial.alpha == 0.0 ? elevationRampMaterial.diffuse : contourMaterial.diffuse",
                alpha:
                  "max(contourMaterial.alpha, elevationRampMaterial.alpha)",
              },
            },
            translucent: false,
          });
        },

        getSlopeContourMaterial: function () {
          // Creates a composite material with both slope shading and contour lines
          return new Cesium.Material({
            fabric: {
              type: "SlopeColorContour",
              materials: {
                contourMaterial: {
                  type: "ElevationContour",
                },
                slopeRampMaterial: {
                  type: "SlopeRamp",
                },
              },
              components: {
                diffuse:
                  "contourMaterial.alpha == 0.0 ? slopeRampMaterial.diffuse : contourMaterial.diffuse",
                alpha: "max(contourMaterial.alpha, slopeRampMaterial.alpha)",
              },
            },
            translucent: false,
          });
        },

        getAspectContourMaterial: function () {
          // Creates a composite material with both aspect shading and contour lines
          return new Cesium.Material({
            fabric: {
              type: "AspectColorContour",
              materials: {
                contourMaterial: {
                  type: "ElevationContour",
                },
                aspectRampMaterial: {
                  type: "AspectRamp",
                },
              },
              components: {
                diffuse:
                  "contourMaterial.alpha == 0.0 ? aspectRampMaterial.diffuse : contourMaterial.diffuse",
                alpha: "max(contourMaterial.alpha, aspectRampMaterial.alpha)",
              },
            },
            translucent: false,
          });
        },

        getColorRamp: function (selectedShading) {
          var elevationRamp = [0.0, 0.045, 0.1, 0.15, 0.37, 0.54, 1.0];
          var slopeRamp = [0.0, 0.29, 0.5, Math.sqrt(2) / 2, 0.87, 0.91, 1.0];
          var aspectRamp = [0.0, 0.2, 0.4, 0.6, 0.8, 0.9, 1.0];
          var ramp = document.createElement("canvas");
          ramp.width = 100;
          ramp.height = 1;
          var ctx = ramp.getContext("2d");

          var values;
          if (selectedShading === "elevation") {
            values = elevationRamp;
          } else if (selectedShading === "slope") {
            values = slopeRamp;
          } else if (selectedShading === "aspect") {
            values = aspectRamp;
          }

          var grd = ctx.createLinearGradient(0, 0, 100, 0);
          grd.addColorStop(values[0], "#000000"); //black
          grd.addColorStop(values[1], "#2747E0"); //blue
          grd.addColorStop(values[2], "#D33B7D"); //pink
          grd.addColorStop(values[3], "#D33038"); //red
          grd.addColorStop(values[4], "#FF9742"); //orange
          grd.addColorStop(values[5], "#ffd700"); //yellow
          grd.addColorStop(values[6], "#ffffff"); //white

          ctx.fillStyle = grd;
          ctx.fillRect(0, 0, 100, 1);

          return ramp;
        },

        updateMaterial: function () {

          var view = this;
          var minHeight = -100;
          var maxHeight = 3694.0; // approximate height of Gunnbjørn Fjeld
          var hasContour = view.knockoutViewModel.enableContour;
          var selectedShading = view.knockoutViewModel.selectedShading;
          var globe = view.viewer.scene.globe;
          var material;

          if (hasContour) {
            if (selectedShading === "elevation") {
              material = view.getElevationContourMaterial();
              view.shadingUniforms =
                material.materials.elevationRampMaterial.uniforms;
              view.shadingUniforms.minimumHeight = minHeight;
              view.shadingUniforms.maximumHeight = maxHeight;
              view.contourUniforms = material.materials.contourMaterial.uniforms;
            } else if (selectedShading === "slope") {
              material = view.getSlopeContourMaterial();
              view.shadingUniforms = material.materials.slopeRampMaterial.uniforms;
              view.contourUniforms = material.materials.contourMaterial.uniforms;
            } else if (selectedShading === "aspect") {
              material = view.getAspectContourMaterial();
              view.shadingUniforms = material.materials.aspectRampMaterial.uniforms;
              view.contourUniforms = material.materials.contourMaterial.uniforms;
            } else {
              material = Cesium.Material.fromType("ElevationContour");
              view.contourUniforms = material.uniforms;
            }
            view.contourUniforms.width = view.knockoutViewModel.contourWidth;
            view.contourUniforms.spacing = view.knockoutViewModel.contourSpacing;
            view.contourUniforms.color = view.contourColor;
          } else if (selectedShading === "elevation") {
            material = Cesium.Material.fromType("ElevationRamp");
            view.shadingUniforms = material.uniforms;
            view.shadingUniforms.minimumHeight = minHeight;
            view.shadingUniforms.maximumHeight = maxHeight;
          } else if (selectedShading === "slope") {
            material = Cesium.Material.fromType("SlopeRamp");
            view.shadingUniforms = material.uniforms;
          } else if (selectedShading === "aspect") {
            material = Cesium.Material.fromType("AspectRamp");
            view.shadingUniforms = material.uniforms;
          }
          if (selectedShading !== "none") {
            view.shadingUniforms.image = view.getColorRamp(selectedShading);
          }

          globe.material = material;
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
