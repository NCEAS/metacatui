'use strict';

define(
  [
    'jquery',
    'underscore',
    'backbone',
    'cesium',
    'models/maps/assets/MapAsset',
  ],
  function (
    $,
    _,
    Backbone,
    Cesium,
    MapAsset
  ) {
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
     * @since 2.x.x
     * @constructor
    */
    var CesiumImagery = MapAsset.extend(
      /** @lends CesiumImagery.prototype */ {

        /**
         * The name of this type of model
         * @type {string}
        */
        type: 'CesiumImagery',

        /**
         * Options that are supported for creating imagery tiles
         * @typedef {Object} ImageryOptions
         * @property {string|number} key - A key or token required to access the tiles.
         * For example, if this is a BingMapsImageryProvider, then the Bing maps key. If
         * one is required and not set, the model will look in MetacatUI for a key.
         */

        /**
         * Default attributes for CesiumImagery models
         * @name CesiumImagery#defaults
         * @type {Object}
         * @property {Cesium.ImageryLayer} cesiumModel A model created and used by Cesium
         * that organizes the data to display in the Cesium Widget. See
         * {@link https://cesium.com/learn/cesiumjs/ref-doc/ImageryLayer.html?classFilter=ImageryLayer}
         * @property {ImageryOptions} cesiumOptions options are passed to the function
         * that creates the Cesium model. The properties of options are specific to each
         * type of asset, but most contain a URL to the server where the data is hosted.
           // * @property {number} brightness The brightness of this layer. 1.0 uses the
           // * unmodified imagery color. Less than 1.0 makes the imagery darker while
           //* greater than 1.0 makes it brighter.
        */
        defaults: function () {
          return _.extend(
            this.constructor.__super__.defaults(),
            {
              cesiumModel: null,
              cesiumOptions: {},
              // brightness: 1, contrast: 1, gamma: 1, hue: 0, saturation: 1,
            }
          );
        },

        /**
         * Executed when a new CesiumImagery model is created.
         * @param {Object} [attributes] The initial values of the attributes, which will
         * be set on the model.
         * @param {Object} [options] Options for the initialize function.
         */
        initialize: function (attributes, options) {
          try {
            MapAsset.prototype.initialize.call(this, attributes, options);

            this.createCesiumModel();

            this.getThumbnail();
          }
          catch (error) {
            console.log(
              'There was an error initializing a CesiumImagery model' +
              '. Error details: ' + error
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
          var cesiumOptions = this.get('cesiumOptions');
          var type = this.get('type')
          var providerFunction = Cesium[type]

          var initialAppearance = {
            alpha: this.get('opacity'),
            show: this.get('visible')
            // TODO: brightness, contrast, gamma, etc.
          }

          // If the cesium model already exists, don't create it again unless specified
          if (!recreate && this.get('cesiumModel')) {
            return this.get('cesiumModel')
          }

          if (type === 'BingMapsImageryProvider') {
            cesiumOptions.key = cesiumOptions.key || MetacatUI.AppConfig.bingMapsKey
          } else if (type === 'IonImageryProvider') {
            cesiumOptions.assetId = Number(cesiumOptions.ionAssetId)
            delete cesiumOptions.ionAssetId
            cesiumOptions.accessToken =
                cesiumOptions.cesiumToken || MetacatUI.appModel.get('cesiumToken');
          }

          if (providerFunction && typeof providerFunction === 'function') {
            let provider = new providerFunction(cesiumOptions)
            provider.readyPromise
              .then(function () {
                // Imagery must be converted from a Cesium Imagery Provider to a Cesium
                // Imagery Layer. See
                // https://cesium.com/learn/cesiumjs-learn/cesiumjs-imagery/#imagery-providers-vs-layers
                model.set('cesiumModel', new Cesium.ImageryLayer(provider, initialAppearance))
                model.set('status', 'ready')
                model.setListeners()
              })
              .otherwise(function (error) {
                // See https://cesium.com/learn/cesiumjs/ref-doc/RequestErrorEvent.html
                let details = error;
                // Write a helpful error message
                switch (error.statusCode) {
                  case 404:
                    details = 'The resource was not found (error code 404).'
                    break;
                  case 500:
                    details = 'There was a server error (error code 500).'
                    break;
                }
                model.set('status', 'error');
                model.set('statusDetails', details)
              })
          } else {
            model.set('status', 'error')
            model.set('statusDetails', type + ' is not a supported imagery type.')
          }

        },

        /**
         * Set listeners that update the cesium model when the backbone model is updated.
         */
        setListeners: function () {
          try {

            var cesiumModel = this.get('cesiumModel')

            // Make sure the listeners are only set once!
            this.stopListening(this);

            this.listenTo(this, 'change:opacity', function (model, opacity) {
              cesiumModel.alpha = opacity
              // Let the map and/or other parent views know that a change has been made
              // that requires the map to be re-rendered
              model.trigger('appearanceChanged')

            })
            this.listenTo(this, 'change:visible', function (model, visible) {
              cesiumModel.show = visible
              // Let the map and/or other parent views know that a change has been made
              // that requires the map to be re-rendered
              model.trigger('appearanceChanged')
            })
          }
          catch (error) {
            console.log(
              'There was an error setting listeners in a cesium Imagery model' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Checks if the Cesium Imagery Provider has been converted to a Cesium Imagery
         * Layer model that is ready to use.
         * @returns {Promise} Returns a promise that resolves to this model when ready.
          */
        whenReady: function () {
          const model = this
          return new Promise(function (resolve, reject) {
            if (model.get('status') === 'ready') {
              resolve(model)
            }
            model.stopListening(model, 'change:status')
            model.listenTo(model, 'change:status', function () {
              resolve(model)
            })
          });
        },

        /**
         * Gets a Cesium Bounding Sphere that can be used to navigate to view the full
         * extent of the imagery. See
         * {@link https://cesium.com/learn/cesiumjs/ref-doc/BoundingSphere.html}
         * @returns {Promise} Returns a promise that resolves to a Cesium Bounding Sphere
         * when ready
         */
        getCameraBoundSphere: function () {
          return this.whenReady()
            .then(function (model) {
              return model.get('cesiumModel').getViewableRectangle()
            })
            .then(function (rectangle) {
              return Cesium.BoundingSphere.fromRectangle3D(rectangle)
            })
        },

        /**
         * Requests a tile from the imagery provider that is at the center of the layer's
         * bounding box and at the minimum level. Once the image is fetched, sets its URL
         * on the thumbnail property of this model. This function is first called when the
         * layer initialized, but waits for the cesiumModel to be ready.
         */
        getThumbnail: function () {
          try {
            if (this.get('status') !== 'ready') {
              this.listenToOnce(this, 'change:status', this.getThumbnail)
              return
            }
  
            const model = this
            const cesImageryLayer = this.get('cesiumModel');
            const provider = cesImageryLayer.imageryProvider
            const rect = cesImageryLayer.rectangle
            var x = (rect.east + rect.west) / 2
            var y = (rect.north + rect.south) / 2
            var level = provider.minimumLevel
  
            provider.requestImage(x, y, level).then(function (response) {
              var objectURL = URL.createObjectURL(response.blob);
              model.set('thumbnail', objectURL)
            }).otherwise(function (e) {
              console.log('Error requesting an image tile to use as a thumbnail for an ' +
              'Imagery Layer. Error message: ' + e);
            })
          }
          catch (error) {
            console.log(
              'There was an error getting a thumbnail for a CesiumImagery layer' +
              '. Error details: ' + error
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

      });

    return CesiumImagery;

  }
);
