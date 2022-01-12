'use strict';

define(
  [
    'jquery',
    'underscore',
    'backbone',
    'cesium',
    'models/maps/assets/MapAsset',
    'models/maps/AssetColor',
    'models/maps/AssetColorPalette',
    'collections/maps/VectorFilters'
  ],
  function (
    $,
    _,
    Backbone,
    Cesium,
    MapAsset,
    AssetColor,
    AssetColorPalette,
    VectorFilters
  ) {
    /** 
     * @classdesc A CesiumVectorData Model is a vector layer (excluding Cesium3DTilesets)
     * that can be used in Cesium maps. This model corresponds to "DataSource" models in
     * Cesium. For example, this could represent vectors rendered from a Cesium
     * GeoJSONDataSource.
     * {@link https://cesium.com/learn/cesiumjs/ref-doc/GeoJsonDataSource.html}. Note:
     * GeoJsonDataSource is the only supported DataSource so far, eventually this model
     * could be used to support Cesium's CzmlDataSource and KmlDataSource (and perhaps a
     * Cesium CustomDataSource).
     * @classcategory Models/Maps/Assets
     * @class CesiumVectorData
     * @name CesiumVectorData
     * @extends MapAsset
     * @since 2.x.x
     * @constructor
    */
    var CesiumVectorData = MapAsset.extend(
      /** @lends CesiumVectorData.prototype */ {

        /**
         * The name of this type of model
         * @type {string}
        */
        type: 'CesiumVectorData',

        /**
         * Options that are supported for creating Cesium DataSources. The object will be
         * passed to the cesium DataSource's load method as options, so the properties
         * listed in the Cesium documentation are also supported. Each type of Cesium Data
         * Source has a specific set of load method options. See for example, the
         * GeoJsonDataSource options:
         * {@link https://cesium.com/learn/cesiumjs/ref-doc/GeoJsonDataSource.html}
         * @typedef {Object} CesiumVectorData#cesiumOptions
         * @property {string|Object} data - The url, GeoJSON object, or TopoJSON object to
         * be loaded.
         */

        /**
         * Default attributes for CesiumVectorData models
         * @name CesiumVectorData#defaults
         * @extends MapAsset#defaults
         * @type {Object}
         * @property {'GeoJsonDataSource'} type The format of the data. Must be
         * 'GeoJsonDataSource'. (The only Cesium DataSource supported so far.)
         * @property {VectorFilters} [filters=new VectorFilters()] A set of conditions
         * used to show or hide specific features of this vector data.
         * @property {AssetColorPalette} [colorPalette=new AssetColorPalette()] The color
         * or colors mapped to attributes of this asset. Used to style the features and to
         * make a legend.
         * @property {Cesium.GeoJsonDataSource} cesiumModel A Cesium DataSource model
         * created and used by Cesium that organizes the data to display in the Cesium
         * Widget. See
         * {@link https://cesium.com/learn/cesiumjs/ref-doc/DataSource.html?classFilter=DataSource}
         * @property {CesiumVectorData#cesiumOptions} cesiumOptions options are passed to
         * the function that creates the Cesium model. The properties of options are
         * specific to each type of asset.
        */
        defaults: function () {
          return _.extend(
            this.constructor.__super__.defaults(),
            {
              type: 'GeoJsonDataSource',
              filters: new VectorFilters(),
              cesiumModel: null,
              cesiumOptions: {},
              colorPalette: new AssetColorPalette(),
              icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M384 352h-1l-39-65a64 64 0 0 0 0-62l39-65h1a64 64 0 1 0-55-96H119a64 64 0 1 0-87 87v210a64 64 0 1 0 87 87h210a64 64 0 0 0 119-32c0-35-29-64-64-64zm-288 9V151a64 64 0 0 0 23-23h208l-38 64h-1a64 64 0 1 0 0 128h1l38 64H119a64 64 0 0 0-23-23zm176-105a16 16 0 1 1 32 0 16 16 0 0 1-32 0zM400 96a16 16 0 1 1-32 0 16 16 0 0 1 32 0zM64 80a16 16 0 1 1 0 32 16 16 0 0 1 0-32zM48 416a16 16 0 1 1 32 0 16 16 0 0 1-32 0zm336 16a16 16 0 1 1 0-32 16 16 0 0 1 0 32z"/></svg>'
            }
          );
        },

        /**
         * Executed when a new CesiumVectorData model is created.
         * @param {MapConfig#MapAssetConfig} [assetConfig] The initial values of the
         * attributes, which will be set on the model.
         */
        initialize: function (assetConfig) {
          try {

            MapAsset.prototype.initialize.call(this, assetConfig);

            if (assetConfig.filters) {
              this.set('filters', new VectorFilters(assetConfig.filters))
            }

            // displayReady will be updated by the Cesium map within which the asset is
            // rendered. The map will set it to true when the data is ready to be
            // rendered. Used to know when it's safe to calculate a bounding sphere.
            this.set('displayReady', false)

            this.createCesiumModel();
          }
          catch (error) {
            console.log(
              'There was an error initializing a CesiumVectorData model' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Creates a Cesium.DataSource model and sets it to this model's
         * 'cesiumModel' attribute. This cesiumModel contains all the information required
         * for Cesium to render the vector data. See
         * {@link https://cesium.com/learn/cesiumjs/ref-doc/DataSource.html?classFilter=DataSource}
         * @param {Boolean} recreate - Set recreate to true to force the function create
         * the Cesium Model again. Otherwise, if a cesium model already exists, that is
         * returned instead.
         */
        createCesiumModel: function (recreate = false) {

          try {

            const model = this;
            const cesiumOptions = model.get('cesiumOptions')
            const type = model.get('type')
            const label = model.get('label') || ''
            const dataSourceFunction = Cesium[type]

            // If the cesium model already exists, don't create it again unless specified
            if (!recreate && model.get('cesiumModel')) {
              return model.get('cesiumModel')
            }

            if (!cesiumOptions || !cesiumOptions.data) {
              model.set('status', 'error');
              model.set('statusDetails', 'Vector data source is missing: A URL or GeoJSON/TopoJson object is required')
              return
            }

            if (dataSourceFunction && typeof dataSourceFunction === 'function') {
              let dataSource = new dataSourceFunction(label)

              const data = cesiumOptions.data;
              delete cesiumOptions.data

              dataSource.load(data, cesiumOptions)
                .then(function (loadedData) {
                  model.set('cesiumModel', loadedData)
                  model.setListeners()
                  model.updateFeatureVisibility()
                  model.updateAppearance()
                  model.set('status', 'ready')
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
          }
          catch (error) {
            console.log(
              'Failed to create a Cesium Model for a CesiumVectorData model' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Set listeners that update the cesium model when the backbone model is updated.
         */
        setListeners: function () {
          try {
            this.stopListening(this, 'change:visible change:opacity change:color')
            this.listenTo(
              this, 'change:visible change:opacity change:color', this.updateAppearance
            )
            this.stopListening(this.get('filters'), 'update')
            this.listenTo(this.get('filters'), 'update', this.updateFeatureVisibility)
          }
          catch (error) {
            console.log(
              'There was an error setting listeners in a CesiumVectorData model' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Checks that the map is ready to display this asset. The displayReady attribute
         * is updated by the Cesium map when the dataSourceDisplay is updated.
         * @returns {Promise} Returns a promise that resolves to this model when ready to
         * be displayed.
        */
        whenDisplayReady: function () {
          return this.whenReady()
            .then(function (model) {
              return new Promise(function (resolve, reject) {
                if (model.get('displayReady')) {
                  resolve(model)
                  return
                }
                model.stopListening(model, 'change:displayReady')
                model.listenTo(model, 'change:displayReady', function () {
                  if (model.get('displayReady')) {
                    model.stopListening(model, 'change:displayReady')
                    resolve(model)
                  }
                })
              });
            })
        },

        /**
         * Given a feature from a Cesium Vector Data source, returns any properties that are set
         * on the feature, similar to an attributes table.
         * @param {Cesium.Entity} feature A Cesium Entity
         * @returns {Object} An object containing key-value mapping of property names to
         * properties.
        */
        getPropertiesFromFeature(feature) {
          try {
            const featureProps = feature.properties
            let properties = {}
            if (featureProps) {
              properties = feature.properties.getValue(new Date())
            }
            properties = this.addCustomProperties(properties)
            return properties
          }
          catch (error) {
            console.log(
              'There was an error getting properties from a Cesium Entity' +
              '. Error details: ' + error +
              '. Returning an empty object.'
            );
            return {}
          }
        },

        /**
         * Updates the styles set on the cesiumModel object based on the colorPalette and
         * filters attributes.
         */
        updateAppearance: function () {
          try {

            const model = this;
            const cesiumModel = this.get('cesiumModel')
            const opacity = this.get('opacity')
            const entities = cesiumModel.entities.values

            // If the asset isn't visible at all, don't bother setting up colors. Just set
            // every feature to hidden.
            if (!model.isVisible()) {
              cesiumModel.entities.show = false
            } else {
              cesiumModel.entities.show = true
              for (var i = 0; i < entities.length; i++) {

                const entity = entities[i];
                const properties = model.getPropertiesFromFeature(entity)

                let outlineColor = null
                let featureOpacity = opacity
                let outline = false
                // For polylines
                let lineWidth = 3
                // For billboard pins and points. We could make size configurable. Size
                // could also be set according to a vector property
                let markerSize = 25

                // If the feature is selected, set the opacity to 1, and add an outline
                if (model.featureIsSelected(entity)) {
                  featureOpacity = 1
                  outline = true
                  // TODO: This colour should be configurable in the Map model
                  outlineColor = Cesium.Color.WHITE
                  lineWidth = 7
                  markerSize = 34
                }

                const rgb = model.getColor(properties)
                const color = new Cesium.Color(
                  rgb.red, rgb.green, rgb.blue, featureOpacity
                )

                if (entity.polygon) {
                  entity.polygon.material = color
                  entity.polygon.outline = outline;
                  entity.polygon.outlineColor = outlineColor
                  entity.polygon.outlineWidth = outline ? 2 : 0
                }
                if (entity.billboard) {
                  if (!model.pinBuilder) {
                    model.pinBuilder = new Cesium.PinBuilder()
                  }
                  entity.billboard.image = model.pinBuilder.fromColor(color, markerSize).toDataURL()
                  // To convert the automatically created billboards to points instead:
                  // entity.billboard = undefined;
                  // entity.point = new Cesium.PointGraphics();
                }
                if (entity.point) {
                  entity.point.color = color
                  entity.point.outlineColor = outlineColor
                  entity.point.outlineWidth = outline ? 2 : 0
                  // Points look better a little smaller than billboards
                  entity.point.pixelSize = (markerSize * 0.5);
                }
                if (entity.polyline) {
                  entity.polyline.material = color
                  entity.polyline.width = lineWidth
                }

              }
            }

            // Let the map and/or other parent views know that a change has been made that
            // requires the map to be re-rendered
            model.trigger('appearanceChanged')

          }
          catch (error) {
            console.log(
              'There was an error updating CesiumVectorData model styles' +
              '. Error details: ' + error
            );
          }
        },

        /**
         * Shows or hides each feature from this Map Asset based on the filters.
         */
        updateFeatureVisibility: function () {
          try {
            const model = this;
            const cesiumModel = model.get('cesiumModel')
            const entities = cesiumModel.entities.values
            const filters = model.get('filters')

            for (var i = 0; i < entities.length; i++) {
              let visible = true
              const entity = entities[i]
              if (filters && filters.length) {
                const properties = model.getPropertiesFromFeature(entity)
                visible = model.featureIsVisible(properties)
              }
              entity.show = visible
            }
            // Let the map and/or other parent views know that a change has been made that
            // requires the map to be re-rendered
            model.trigger('appearanceChanged')
          }
          catch (error) {
            console.log(
              'There was an error updating CesiumVectorData feature visibility' +
              '. Error details: ' + error
            );
          }
        },

        /**
        * Waits for the model to be ready to display, then gets a Cesium Bounding Sphere
        * that can be used to navigate to view the full extent of the vector data. See
        * {@link https://cesium.com/learn/cesiumjs/ref-doc/BoundingSphere.html}.
        * @param {Cesium.DataSourceDisplay} dataSourceDisplay The data source display
        * attached to the CesiumWidget scene that this bounding sphere is for. Required.
        * @returns {Promise} Returns a promise that resolves to a Cesium Bounding Sphere
        * when ready
        */
        getBoundingSphere: function (dataSourceDisplay) {
          return this.whenDisplayReady()
            .then(function (model) {
              const entities = model.get('cesiumModel').entities.values.slice(0)
              const boundingSpheres = [];
              const boundingSphereScratch = new Cesium.BoundingSphere();
              for (let i = 0, len = entities.length; i < len; i++) {
                let state = Cesium.BoundingSphereState.PENDING;
                state = dataSourceDisplay.getBoundingSphere(
                  entities[i], false, boundingSphereScratch
                )
                if (state === Cesium.BoundingSphereState.PENDING) {
                  return false;
                } else if (state !== Cesium.BoundingSphereState.FAILED) {
                  boundingSpheres.push(Cesium.BoundingSphere.clone(boundingSphereScratch));
                }
              }
              if (boundingSpheres.length) {
                return Cesium.BoundingSphere.fromBoundingSpheres(boundingSpheres);
              }
              return false
            }).catch(function (error) {
              console.log(
                'Failed to get the bounding sphere for a CesiumVectorData model' +
                '. Error details: ' + error
              );
            })
        },

      });

    return CesiumVectorData;

  }
);
