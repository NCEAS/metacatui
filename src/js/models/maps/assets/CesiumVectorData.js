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
     * @classdesc A CesiumVectorData Model is a vector layer (excluding
     * Cesium3DTilesets) that can be used in Cesium maps. This model corresponds
     * to "DataSource" models in Cesium. For example, this could represent
     * vectors rendered from a Cesium GeoJSONDataSource.
     * {@link https://cesium.com/learn/cesiumjs/ref-doc/GeoJsonDataSource.html}.
     * Note: The GeoJsonDataSource and CzmlDataSource are the only supported
     * DataSources so far, but eventually this model could be used to support
     * the KmlDataSource (and perhaps a Cesium CustomDataSource).
     * @classcategory Models/Maps/Assets
     * @class CesiumVectorData
     * @name CesiumVectorData
     * @extends MapAsset
     * @since 2.19.0
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
         * 'GeoJsonDataSource' or 'CzmlDataSource'.
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
         * @property {outlineColor} [outlineColor=null] The color of the outline of the
         * features. If null, the outline will not be shown. If a string, it should be a
         * valid CSS color string. If an object, it should be an AssetColor object, or
         * a set of RGBA values.
        */
        defaults: function () {
          return Object.assign(
            this.constructor.__super__.defaults(),
            {
              type: 'GeoJsonDataSource',
              filters: new VectorFilters(),
              cesiumModel: null,
              cesiumOptions: {},
              colorPalette: new AssetColorPalette(),
              icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M384 352h-1l-39-65a64 64 0 0 0 0-62l39-65h1a64 64 0 1 0-55-96H119a64 64 0 1 0-87 87v210a64 64 0 1 0 87 87h210a64 64 0 0 0 119-32c0-35-29-64-64-64zm-288 9V151a64 64 0 0 0 23-23h208l-38 64h-1a64 64 0 1 0 0 128h1l38 64H119a64 64 0 0 0-23-23zm176-105a16 16 0 1 1 32 0 16 16 0 0 1-32 0zM400 96a16 16 0 1 1-32 0 16 16 0 0 1 32 0zM64 80a16 16 0 1 1 0 32 16 16 0 0 1 0-32zM48 416a16 16 0 1 1 32 0 16 16 0 0 1-32 0zm336 16a16 16 0 1 1 0-32 16 16 0 0 1 0 32z"/></svg>',
              outlineColor: null,
              featureType: Cesium.Entity
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

            if (assetConfig.outlineColor && !assetConfig.outlineColor instanceof AssetColor) {
              this.set('outlineColor', new AssetColor(assetConfig.outlineColor))
            }

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
         * 'cesiumModel' attribute. This cesiumModel contains all the
         * information required for Cesium to render the vector data. See
         * {@link https://cesium.com/learn/cesiumjs/ref-doc/DataSource.html?classFilter=DataSource}
         * @param {Boolean} [recreate = false]  - Set recreate to true to force
         * the function create the Cesium Model again. Otherwise, if a cesium
         * model already exists, that is returned instead.
         */
        createCesiumModel: function (recreate = false) {

          try {

            const model = this;
            const cesiumOptions = model.get('cesiumOptions')
            const type = model.get('type')
            const label = model.get('label') || ''
            const dataSourceFunction = Cesium[type]

            // If the cesium model already exists, don't create it again unless specified
            let dataSource = model.get('cesiumModel')
            if (dataSource) {
              if (!recreate) {
                return dataSource
              } else {
                // If we are recreating the model, remove all entities first.
                // see https://stackoverflow.com/questions/31426796/loading-updated-data-with-geojsondatasource-in-cesium-js
                dataSource.entities.removeAll();
                // Make sure the CesiumWidgetView re-renders the data
                model.set('displayReady', false);
              }
            }

            model.resetStatus();

            if (!cesiumOptions || !cesiumOptions.data) {
              model.set('status', 'error');
              model.set('statusDetails', 'Vector data source is missing: A URL or data object is required')
              return
            }

            if (dataSourceFunction && typeof dataSourceFunction === 'function') {

              if (!recreate) {
                dataSource = new dataSourceFunction(label)
              }

              const data = cesiumOptions.data;
              delete cesiumOptions.data

              dataSource.load(data, cesiumOptions)
                .then(function (loadedData) {
                  model.set('cesiumModel', loadedData)
                  if (!recreate) {
                    model.setListeners()
                  }
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
            const appearEvents =
              'change:visible change:opacity change:color change:outlineColor';
            this.stopListening(this, appearEvents)
            this.listenTo(this, appearEvents, this.updateAppearance)
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
         * Try to find Entity object that comes from an object passed from the
         * Cesium map. This is useful when the map is clicked and the map
         * returns an object that may or may not be an Entity.
         * @param {Object} mapObject - An object returned from the Cesium map
         * @returns {Cesium.Entity} - The Entity object if found, otherwise null.
         */
        getEntityFromMapObject(mapObject) {
          const entityType = this.get("featureType")
          if (mapObject instanceof entityType) return mapObject
          if (mapObject.id instanceof entityType) return mapObject.id
          return null
        },

        /**
         * Given a feature from a Cesium Vector Data source, returns any properties that are set
         * on the feature, similar to an attributes table.
         * @param {Cesium.Entity} feature A Cesium Entity
         * @returns {Object} An object containing key-value mapping of property names to
         * properties.
        */
        getPropertiesFromFeature(feature) {
          feature = this.getEntityFromMapObject(feature)
          if (!feature) return null
          const featureProps = feature.properties
          let properties = {}
          if (featureProps) {
            properties = feature.properties.getValue(new Date())
          }
          properties = this.addCustomProperties(properties)
          return properties
        },

        /**
         * Return the label for a feature from a DataSource model
         * @param {Cesium.Entity} feature A Cesium Entity
         * @returns {string} The label
         */
        getLabelFromFeature: function (feature) {
          feature = this.getEntityFromMapObject(feature)
          if (!feature) return null
          return feature.name
        },

        /**
         * Return the DataSource model for a feature from a Cesium DataSource
         * model
         * @param {Cesium.Entity} feature A Cesium Entity
         * @returns {Cesium.GeoJsonDataSource|Cesium.CzmlDataSource} The model
         */
        getCesiumModelFromFeature: function (feature) {
          feature = this.getEntityFromMapObject(feature)
          if (!feature) return null
          // TODO: Test - does feature.id give the entity this work for all datasources ?
          // A picked feature object's ID gives the Cesium.Entity
          return feature.entityCollection.owner
        },

        /**
         * Return the ID used by Cesium for a feature from a DataSource model
         * @param {Cesium.Entity} feature A Cesium Entity
         * @returns {string} The ID
         */
        getIDFromFeature: function (feature) {
          feature = this.getEntityFromMapObject(feature)
          if (!feature) return null
          return feature.id
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

            // Suspending events while updating a large number of entities helps
            // performance.
            cesiumModel.entities.suspendEvents()

            // If the asset isn't visible at all, don't bother setting up colors. Just set
            // every feature to hidden.
            if (!model.isVisible()) {
              cesiumModel.entities.show = false
              // Indicate that the layer is hidden if the opacity is zero by updating the
              // visibility property
              if (model.get('opacity') === 0) {
                model.set('visible', false);
              }
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
                } else {
                  outlineColor = model.get("outlineColor")?.get("color");
                  if(outlineColor) {
                    outline = true;
                    outlineColor = new Cesium.Color(
                      outlineColor.red, outlineColor.green, outlineColor.blue, outlineColor.alpha
                    );
                  }
                }

                const rgba = model.getColor(properties)
                const alpha = rgba.alpha * featureOpacity

                // If alpha is 0 then the feature is hidden, don't bother setting up
                // colors.
                let color = null
                if (alpha === 0) {
                  entity.show = false
                } else {
                  entity.show = true
                  color = new Cesium.Color(
                    rgba.red, rgba.green, rgba.blue, alpha
                  )
                }

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
                if (entity.label) {
                  // TODO...
                }

              }
            }

            cesiumModel.entities.resumeEvents()

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

            // Suspending events while updating a large number of entities helps
            // performance.
            cesiumModel.entities.suspendEvents()

            for (var i = 0; i < entities.length; i++) {
              let visible = true
              const entity = entities[i]
              if (filters && filters.length) {
                const properties = model.getPropertiesFromFeature(entity)
                visible = model.featureIsVisible(properties)
              }
              entity.show = visible
            }

            cesiumModel.entities.resumeEvents()

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
