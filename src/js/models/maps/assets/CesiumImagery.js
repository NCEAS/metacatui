"use strict";

define([
  "jquery",
  "underscore",
  "backbone",
  "cesium",
  "models/maps/assets/MapAsset",
], function ($, _, Backbone, Cesium, MapAsset) {
  /**
   * @classdesc A CesiumImagery Model contains the information required for Cesium to
   * request and draw high-resolution image tiles using several standards (Cesium
   * "imagery providers"), including Cesium Ion and Bing Maps. Imagery layers have
   * brightness, contrast, gamma, hue, and saturation properties that can be dynamically
   * changed.
   * @classcategory Models/Maps/Assets
   * @class CesiumImagery
   * @name CesiumImagery
   * @extends MapAsset
   * @since 2.18.0
   * @constructor
   */
  var CesiumImagery = MapAsset.extend(
    /** @lends CesiumImagery.prototype */ {
      /**
       * The name of this type of model
       * @type {string}
       */
      type: "CesiumImagery",

      /**
       * Options that are supported for creating imagery tiles. Any properties provided
       * here are passed to the Cesium constructor function, so other properties that
       * are documented in Cesium are also supported. See
       * {@link https://cesium.com/learn/cesiumjs/ref-doc/BingMapsImageryProvider.html#.ConstructorOptions}
       * and
       * {@link https://cesium.com/learn/cesiumjs/ref-doc/IonImageryProvider.html#.ConstructorOptions}.
       * @typedef {Object} CesiumImagery#cesiumOptions
       * @property {string|number} ionAssetId - If this imagery is hosted by Cesium
       * Ion, then Ion asset ID.
       * @property {string|number} key - A key or token required to access the tiles.
       * For example, if this is a BingMapsImageryProvider, then the Bing maps key. If
       * one is required and not set, the model will look in the {@link AppModel} for a
       * key, for example, {@link AppModel#bingMapsKey}
       * @property {'GeographicTilingScheme'|'WebMercatorTilingScheme'} tilingScheme -
       * The tiling scheme to use when constructing an imagery provider. If not set,
       * Cesium uses WebMercatorTilingScheme by default.
       * @property {Number[]} rectangle - The rectangle covered by the layer. The list
       * of west, south, east, north bounding degree coordinates, respectively. This
       * will be passed to Cesium.Rectangle.fromDegrees to define the bounding box of
       * the imagery layer. If left undefined, the layer will cover the entire globe.
       */

      /**
       * Default attributes for CesiumImagery models
       * @name CesiumImagery#defaults
       * @extends MapAsset#defaults
       * @type {Object}
       * @property {'BingMapsImageryProvider'|'IonImageryProvider'|'TileMapServiceImageryProvider'|'WebMapTileServiceImageryProvider'} type
       * A string indicating a Cesium Imagery Provider type. See
       * {@link https://cesium.com/learn/cesiumjs-learn/cesiumjs-imagery/#more-imagery-providers}
       * @property {Cesium.ImageryLayer} cesiumModel A model created and used by Cesium
       * that organizes the data to display in the Cesium Widget. See
       * {@link https://cesium.com/learn/cesiumjs/ref-doc/ImageryLayer.html?classFilter=ImageryLayer}
       * and
       * {@link https://cesium.com/learn/cesiumjs/ref-doc/?classFilter=ImageryProvider}
       * @property {CesiumImagery#cesiumOptions} cesiumOptions options that are passed
       * to the function that creates the Cesium model. The properties of options are
       * specific to each type of asset.
       */
      defaults: function () {
        return _.extend(this.constructor.__super__.defaults(), {
          type: "",
          cesiumModel: null,
          cesiumOptions: {},
          // brightness: 1, contrast: 1, gamma: 1, hue: 0, saturation: 1,
        });
      },

      /**
       * Executed when a new CesiumImagery model is created.
       * @param {MapConfig#MapAssetConfig} [assetConfig] The initial values of the
       * attributes, which will be set on the model.
       */
      initialize: function (assetConfig) {
        try {
          MapAsset.prototype.initialize.call(this, assetConfig);

          if (assetConfig.type == "NaturalEarthII") {
            this.initNaturalEarthII(assetConfig);
          } else if (assetConfig.type == "USGSImageryTopo") {
            this.initUSGSImageryTopo(assetConfig);
          }

          this.createCesiumModel();

          this.getThumbnail();
        } catch (e) {
          console.log("Error initializing a CesiumImagery model: ", e);
        }
      },

      /**
       * Initializes a CesiumImagery model for the Natural Earth II asset.
       * @param {MapConfig#MapAssetConfig} [assetConfig] The initial values of the
       * attributes, which will be set on the model.
       */
      initNaturalEarthII: function (assetConfig) {
        try {
          if (
            !assetConfig.cesiumOptions ||
            typeof assetConfig.cesiumOptions !== "object"
          ) {
            assetConfig.cesiumOptions = {};
          }

          assetConfig.cesiumOptions.url = Cesium.buildModuleUrl(
            "Assets/Textures/NaturalEarthII",
          );
          this.set("type", "TileMapServiceImageryProvider");
          this.set("cesiumOptions", assetConfig.cesiumOptions);
        } catch (error) {
          console.log(
            "There was an error initializing NaturalEarthII in a CesiumImagery" +
              ". Error details: " +
              error,
          );
        }
      },

      /**
       * Initializes a CesiumImagery model for the USGS Imagery Topo asset.
       * @param {MapConfig#MapAssetConfig} [assetConfig] The initial values of the
       * attributes, which will be set on the model.
       */
      initUSGSImageryTopo: function (assetConfig) {
        try {
          if (
            !assetConfig.cesiumOptions ||
            typeof assetConfig.cesiumOptions !== "object"
          ) {
            assetConfig.cesiumOptions = {};
          }
          this.set("type", "WebMapServiceImageryProvider");
          assetConfig.cesiumOptions.url =
            "https://basemap.nationalmap.gov:443/arcgis/services/USGSImageryTopo/MapServer/WmsServer";
          assetConfig.cesiumOptions.layers = "0";
          assetConfig.cesiumOptions.parameters = {
            transparent: true,
            format: "image/png",
          };
          this.set("cesiumOptions", assetConfig.cesiumOptions);
          if (!assetConfig.moreInfoLink) {
            this.set(
              "moreInfoLink",
              "https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryTopo/MapServer",
            );
          }
          if (!assetConfig.attribution) {
            this.set(
              "attribution",
              "USGS The National Map: Orthoimagery and US Topo. Data refreshed January, 2022.",
            );
          }
          if (!assetConfig.description) {
            this.set(
              "description",
              "USGS Imagery Topo is a tile cache base map of orthoimagery in The National Map and US Topo vectors visible to the 1:9,028 scale.",
            );
          }
          if (!assetConfig.label) {
            this.set("label", "USGS Imagery Topo");
          }
        } catch (error) {
          console.log(
            "There was an error initializing USGSImageryTopo in a CesiumImagery" +
              ". Error details: " +
              error,
          );
        }
      },

      /**
       * Creates a Cesium ImageryLayer that contains information about how the imagery
       * should render in Cesium. See
       * {@link https://cesium.com/learn/cesiumjs/ref-doc/ImageryLayer.html?classFilter=ImageryLay}
       * @param {Boolean} recreate - Set recreate to true to force the function create
       * the Cesium Model again. Otherwise, if a cesium model already exists, that is
       * returned instead.
       */
      createCesiumModel: function (recreate = false) {
        var model = this;
        const cesiumOptions = this.getCesiumOptions();
        var type = this.get("type");
        var providerFunction = Cesium[type];

        // If the cesium model already exists, don't create it again unless specified
        if (!recreate && this.get("cesiumModel")) {
          console.log("returning existing cesium model");
          return this.get("cesiumModel");
        }

        model.resetStatus();

        var initialAppearance = {
          alpha: this.get("opacity"),
          show: this.get("visible"),
          saturation: this.get("saturation"),
          // TODO: brightness, contrast, gamma, etc.
        };

        if (type === "BingMapsImageryProvider") {
          cesiumOptions.key =
            cesiumOptions.key || MetacatUI.AppConfig.bingMapsKey;
        } else if (type === "IonImageryProvider") {
          cesiumOptions.assetId = Number(cesiumOptions.ionAssetId);
          delete cesiumOptions.ionAssetId;
          cesiumOptions.accessToken =
            cesiumOptions.cesiumToken || MetacatUI.appModel.get("cesiumToken");
        } else if (type === "OpenStreetMapImageryProvider") {
          cesiumOptions.url =
            cesiumOptions.url || "https://a.tile.openstreetmap.org/";
        }
        if (cesiumOptions && cesiumOptions.tilingScheme) {
          const ts = cesiumOptions.tilingScheme;
          const availableTS = [
            "GeographicTilingScheme",
            "WebMercatorTilingScheme",
          ];
          if (availableTS.indexOf(ts) > -1) {
            cesiumOptions.tilingScheme = new Cesium[ts]();
          } else {
            console.log(
              `${ts} is not a valid tiling scheme. Using WebMercatorTilingScheme`,
            );
            cesiumOptions.tilingScheme = new Cesium.WebMercatorTilingScheme();
          }
        }

        if (cesiumOptions.rectangle) {
          cesiumOptions.rectangle = Cesium.Rectangle.fromDegrees(
            ...cesiumOptions.rectangle,
          );
        }

        if (providerFunction && typeof providerFunction === "function") {
          let provider = new providerFunction(cesiumOptions);
          provider.readyPromise
            .then(function () {
              // Imagery must be converted from a Cesium Imagery Provider to a Cesium
              // Imagery Layer. See
              // https://cesium.com/learn/cesiumjs-learn/cesiumjs-imagery/#imagery-providers-vs-layers
              model.set(
                "cesiumModel",
                new Cesium.ImageryLayer(provider, initialAppearance),
              );
              model.set("status", "ready");
              model.setListeners();
            })
            .otherwise(function (error) {
              // See https://cesium.com/learn/cesiumjs/ref-doc/RequestErrorEvent.html
              let details = error;
              // Write a helpful error message
              switch (error.statusCode) {
                case 404:
                  details = "The resource was not found (error code 404).";
                  break;
                case 500:
                  details = "There was a server error (error code 500).";
                  break;
              }
              model.set("status", "error");
              model.set("statusDetails", details);
            });
        } else {
          model.set("status", "error");
          model.set(
            "statusDetails",
            type + " is not a supported imagery type.",
          );
        }
      },

      /**
       * Set listeners that update the cesium model when the backbone model is updated.
       */
      setListeners: function () {
        try {
          var cesiumModel = this.get("cesiumModel");

          // Make sure the listeners are only set once!
          this.stopListening(this);

          this.listenTo(this, "change:opacity", function (model, opacity) {
            cesiumModel.alpha = opacity;
            // Let the map and/or other parent views know that a change has been made
            // that requires the map to be re-rendered
            model.trigger("appearanceChanged");
          });
          this.listenTo(this, "change:visible", function (model, visible) {
            cesiumModel.show = visible;
            // Let the map and/or other parent views know that a change has been made
            // that requires the map to be re-rendered
            model.trigger("appearanceChanged");
          });
        } catch (error) {
          console.log(
            "There was an error setting listeners in a cesium Imagery model" +
              ". Error details: " +
              error,
          );
        }
      },

      /**
       * Gets a Cesium Bounding Sphere that can be used to navigate to view the full
       * extent of the imagery. See
       * {@link https://cesium.com/learn/cesiumjs/ref-doc/BoundingSphere.html}
       * @returns {Promise} Returns a promise that resolves to a Cesium Bounding Sphere
       * when ready
       */
      getBoundingSphere: function () {
        return this.whenReady()
          .then(function (model) {
            return model.get("cesiumModel").getViewableRectangle();
          })
          .then(function (rectangle) {
            return Cesium.BoundingSphere.fromRectangle3D(rectangle);
          });
      },

      /**
       * Requests a tile from the imagery provider that is at the center of the layer's
       * bounding box and at the minimum level. Once the image is fetched, sets its URL
       * on the thumbnail property of this model. This function is first called when the
       * layer initialized, but waits for the cesiumModel to be ready.
       */
      getThumbnail: function () {
        try {
          if (this.get("status") !== "ready") {
            this.listenToOnce(this, "change:status", this.getThumbnail);
            return;
          }

          const model = this;
          const cesImageryLayer = this.get("cesiumModel");
          const provider = cesImageryLayer.imageryProvider;
          const rect = cesImageryLayer.rectangle;
          var x = (rect.east + rect.west) / 2;
          var y = (rect.north + rect.south) / 2;
          var level = provider.minimumLevel;

          provider
            .requestImage(x, y, level)
            .then(function (response) {
              let data = response.blob;
              let objectURL = null;

              if (!data && response instanceof ImageBitmap) {
                objectURL = model.getDataUriFromBitmap(response);
              } else {
                objectURL = URL.createObjectURL(data);
              }

              model.set("thumbnail", objectURL);
            })
            .otherwise(function (e) {
              console.log(
                "Error requesting an image tile to use as a thumbnail for an " +
                  "Imagery Layer. Error message: " +
                  e,
              );
            });
        } catch (error) {
          console.log(
            "There was an error getting a thumbnail for a CesiumImagery layer" +
              ". Error details: " +
              error,
          );
        }
      },

      /**
       * Gets a data URI from a bitmap image.
       * @param {ImageBitmap} bitmap The bitmap image to convert to a data URI
       * @returns {String} Returns a string containing the requested data URI.
       */
      getDataUriFromBitmap: function (imageBitmap) {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = imageBitmap.width;
          canvas.height = imageBitmap.height;
          const ctx = canvas.getContext("2d");
          // y-flip the image - Natural Earth II bitmaps appear upside down otherwise
          // TODO: Test with other imagery layers
          ctx.translate(0, imageBitmap.height);
          ctx.scale(1, -1);
          ctx.drawImage(imageBitmap, 0, 0);
          return canvas.toDataURL();
        } catch (error) {
          console.log(
            "There was an error converting an ImageBitmap to a data URL" +
              ". Error details: " +
              error,
          );
        }
      },

      // /**
      //  * Parses the given input into a JSON object to be set on the model.
      //  *
      //  * @param {TODO} input - The raw response object
      //  * @return {TODO} - The JSON object of all the Imagery attributes
      //    */
      // parse: function (input) {

      //   try {

      //     var modelJSON = {};

      //     return modelJSON

      //   }
      //   catch (error) {console.log('There was an error parsing a Imagery model' + '.
      //     Error details: ' + error
      //     );
      //   }

      // },

      // /**
      //  * Overrides the default Backbone.Model.validate.function() to check if this if
      //  * the values set on this model are valid.
      //  *
      //  * @param {Object} [attrs] - A literal object of model attributes to validate.
      //  * @param {Object} [options] - A literal object of options for this validation
      //  * process
      //  *
      //  * @return {Object} - Returns a literal object with the invalid attributes and
      //  * their corresponding error message, if there are any. If there are no errors,
      //  * returns nothing.
      //    */
      // validate: function (attrs, options) {try {

      //   }
      //   catch (error) {console.log('There was an error validating a CesiumImagery
      //     model' + '. Error details: ' + error
      //     );
      //   }
      // },

      // /**
      //  * Creates a string using the values set on this model's attributes.
      //  * @return {string} The Imagery string
      //    */
      // serialize: function () {try {var serializedImagery = "";

      //     return serializedImagery;
      //   }
      //   catch (error) {console.log('There was an error serializing a CesiumImagery
      //     model' + '. Error details: ' + error
      //     );
      //   }
      // },
    },
  );

  return CesiumImagery;
});
