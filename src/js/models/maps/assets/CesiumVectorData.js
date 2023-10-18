"use strict";

define([
  "underscore",
  "cesium",
  "models/maps/assets/MapAsset",
  "models/maps/AssetColor",
  "models/maps/AssetColorPalette",
  "collections/maps/VectorFilters",
], function (
  _,
  Cesium,
  MapAsset,
  AssetColor,
  AssetColorPalette,
  VectorFilters
) {
  /**
   * @classdesc A CesiumVectorData Model is a vector layer (excluding
   * Cesium3DTilesets) that can be used in Cesium maps. This model corresponds
   * to "DataSource" models in Cesium. For example, this could represent vectors
   * rendered from a Cesium GeoJSONDataSource.
   * {@link https://cesium.com/learn/cesiumjs/ref-doc/GeoJsonDataSource.html}.
   * Note: GeoJsonDataSource, CzmlDataSource, and CustomDataSource are
   * supported. Eventually this model could support the KmlDataSource.
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
      type: "CesiumVectorData",

      /**
       * Options that are supported for creating Cesium DataSources. The object
       * will be passed to the cesium DataSource's load method as options, so
       * the properties listed in the Cesium documentation are also supported.
       * Each type of Cesium Data Source has a specific set of load method
       * options. See for example, the GeoJsonDataSource options:
       * {@link https://cesium.com/learn/cesiumjs/ref-doc/GeoJsonDataSource.html}
       * @typedef {Object} CesiumVectorData#cesiumOptions
       * @property {string|Object} data - The url, GeoJSON object, or TopoJSON
       * object to be loaded.
       */

      /**
       * Default attributes for CesiumVectorData models
       * @name CesiumVectorData#defaults
       * @extends MapAsset#defaults
       * @type {Object}
       * @property {'GeoJsonDataSource'} type The format of the data. Must be
       * 'GeoJsonDataSource' or 'CzmlDataSource'.
       * @property {VectorFilters} [filters=new VectorFilters()] A set of
       * conditions used to show or hide specific features of this vector data.
       * @property {AssetColorPalette} [colorPalette=new AssetColorPalette()]
       * The color or colors mapped to attributes of this asset. Used to style
       * the features and to make a legend.
       * @property {Cesium.GeoJsonDataSource} cesiumModel A Cesium DataSource
       * model created and used by Cesium that organizes the data to display in
       * the Cesium Widget. See
       * {@link https://cesium.com/learn/cesiumjs/ref-doc/DataSource.html?classFilter=DataSource}
       * @property {CesiumVectorData#cesiumOptions} cesiumOptions options are
       * passed to the function that creates the Cesium model. The properties of
       * options are specific to each type of asset.
       * @property {string|AssetColor} [outlineColor=null] The color of the
       * outline of the features. If null, the outline will not be shown. If a
       * string, it should be a valid CSS color string. If an object, it should
       * be an AssetColor object, or a set of RGBA values.
       */
      defaults: function () {
        return Object.assign(this.constructor.__super__.defaults(), {
          type: "GeoJsonDataSource",
          filters: new VectorFilters(),
          cesiumModel: null,
          cesiumOptions: {},
          colorPalette: new AssetColorPalette(),
          icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M384 352h-1l-39-65a64 64 0 0 0 0-62l39-65h1a64 64 0 1 0-55-96H119a64 64 0 1 0-87 87v210a64 64 0 1 0 87 87h210a64 64 0 0 0 119-32c0-35-29-64-64-64zm-288 9V151a64 64 0 0 0 23-23h208l-38 64h-1a64 64 0 1 0 0 128h1l38 64H119a64 64 0 0 0-23-23zm176-105a16 16 0 1 1 32 0 16 16 0 0 1-32 0zM400 96a16 16 0 1 1-32 0 16 16 0 0 1 32 0zM64 80a16 16 0 1 1 0 32 16 16 0 0 1 0-32zM48 416a16 16 0 1 1 32 0 16 16 0 0 1-32 0zm336 16a16 16 0 1 1 0-32 16 16 0 0 1 0 32z"/></svg>',
          outlineColor: null,
          featureType: Cesium.Entity,
        });
      },

      /**
       * Executed when a new CesiumVectorData model is created.
       * @param {MapConfig#MapAssetConfig} [assetConfig] The initial values of
       * the attributes, which will be set on the model.
       */
      initialize: function (assetConfig) {
        try {
          if (!assetConfig) assetConfig = {};

          MapAsset.prototype.initialize.call(this, assetConfig);

          if (assetConfig.filters) {
            this.set("filters", new VectorFilters(assetConfig.filters));
          }

          // displayReady will be updated by the Cesium map within which the
          // asset is rendered. The map will set it to true when the data is
          // ready to be rendered. Used to know when it's safe to calculate a
          // bounding sphere.
          this.set("displayReady", false);

          if (
            assetConfig.outlineColor &&
            !(assetConfig.outlineColor instanceof AssetColor)
          ) {
            this.set(
              "outlineColor",
              new AssetColor({ color: assetConfig.outlineColor })
            );
          }

          if (
            assetConfig.highlightColor &&
            !(assetConfig.highlightColor instanceof AssetColor)
          ) {
            this.set(
              "highlightColor",
              new AssetColor({ color: assetConfig.highlightColor })
            );
          }

          this.createCesiumModel();
        } catch (error) {
          console.log("Error initializing a CesiumVectorData model.", error);
        }
      },

      /**
       * Creates a Cesium.DataSource model and sets it to this model's
       * 'cesiumModel' attribute. This cesiumModel contains all the information
       * required for Cesium to render the vector data. See
       * {@link https://cesium.com/learn/cesiumjs/ref-doc/DataSource.html?classFilter=DataSource}
       * @param {Boolean} [recreate = false]  - Set recreate to true to force
       * the function create the Cesium Model again. Otherwise, if a cesium
       * model already exists, that is returned instead.
       */
      createCesiumModel: function (recreate = false) {
        try {
          const model = this;
          const cesiumOptions = this.getCesiumOptions();
          const type = model.get("type");
          const label = model.get("label") || "";
          const dataSourceFunction = Cesium[type];

          // If the cesium model already exists, don't create it again unless
          // specified
          let dataSource = model.get("cesiumModel");
          if (dataSource) {
            if (!recreate) {
              return dataSource;
            } else {
              // If we are recreating the model, remove all entities first. see
              // https://stackoverflow.com/questions/31426796/loading-updated-data-with-geojsondatasource-in-cesium-js
              dataSource.entities.removeAll();
            }
          }

          model.set("displayReady", false);
          model.resetStatus();

          if (typeof dataSourceFunction !== "function") {
            model.setError(`${type} is not a supported data type.`);
            return;
          }
          if (!dataSource) {
            dataSource = new dataSourceFunction(label);
          }
          if (!dataSource) {
            model.setError("Failed to create a Cesium DataSource model.");
            return;
          }

          // There is no data to load for a CustomDataSource
          if (type === "CustomDataSource") {
            model.set("cesiumModel", dataSource);
            model.setListeners();
            model.setReady();
            model.runVisualizers();
            return;
          }

          // For GeoJSON and CZML data sources
          if (!cesiumOptions || !cesiumOptions.data) {
            model.setError(
              "No data was provided to create a Cesium DataSource model."
            );
            return;
          }
          const data = JSON.parse(JSON.stringify(cesiumOptions.data));
          delete cesiumOptions.data;

          dataSource
            .load(data, cesiumOptions)
            .then(function (loadedData) {
              model.set("cesiumModel", loadedData);
              if (!recreate) {
                model.setListeners();
              }
              model.updateFeatureVisibility();
              model.updateAppearance();
              model.setReady();
            })
            .otherwise(model.setError.bind(model));
        } catch (error) {
          console.log("Failed to create a VectorData Cesium Model.", error);
        }
      },

      /**
       * Set listeners that update the cesium model when the backbone model is
       * updated.
       */
      setListeners: function () {
        try {
          MapAsset.prototype.setListeners.call(this);
          const appearEvents =
            "change:visible change:opacity change:color change:outlineColor" +
            " change:temporarilyHidden";
          this.stopListening(this, appearEvents);
          this.listenTo(this, appearEvents, this.updateAppearance);
          const filters = this.get("filters");
          this.stopListening(filters, "update");
          this.listenTo(filters, "update", this.updateFeatureVisibility);
        } catch (error) {
          console.log("Failed to set CesiumVectorData listeners.", error);
        }
      },

      /**
       * Checks that the map is ready to display this asset. The displayReady
       * attribute is updated by the Cesium map when the dataSourceDisplay is
       * updated.
       * @returns {Promise} Returns a promise that resolves to this model when
       * ready to be displayed.
       */
      whenDisplayReady: function () {
        return this.whenReady().then(function (model) {
          return new Promise(function (resolve, reject) {
            if (model.get("displayReady")) {
              resolve(model);
              return;
            }
            model.stopListening(model, "change:displayReady");
            model.listenTo(model, "change:displayReady", function () {
              if (model.get("displayReady")) {
                model.stopListening(model, "change:displayReady");
                resolve(model);
              }
            });
          });
        });
      },

      /**
       * Try to find Entity object that comes from an object passed from the
       * Cesium map. This is useful when the map is clicked and the map returns
       * an object that may or may not be an Entity.
       * @param {Object} mapObject - An object returned from the Cesium map
       * @returns {Cesium.Entity} - The Entity object if found, otherwise null.
       * @since 2.25.0
       */
      getEntityFromMapObject: function (mapObject) {
        const entityType = this.get("featureType");
        if (mapObject instanceof entityType) return mapObject;
        if (mapObject.id instanceof entityType) return mapObject.id;
        return null;
      },

      /**
       * @inheritdoc
       * @since 2.25.0
       */
      getFeatureAttributes: function (feature) {
        feature = this.getEntityFromMapObject(feature);
        return MapAsset.prototype.getFeatureAttributes.call(this, feature);
      },

      /**
       * @inheritdoc
       * @since 2.25.0
       */
      usesFeatureType: function (feature) {
        // This method could be passed the entity directly, or the object
        // returned from Cesium on a click event (where the entity is in the id
        // property).
        if (!feature) return false;
        const baseMethod = MapAsset.prototype.usesFeatureType;
        let result = baseMethod.call(this, feature);
        if (result) return result;
        result = baseMethod.call(this, feature.id);
        return result;
      },

      /**
       * Given a feature from a Cesium Vector Data source, returns any
       * properties that are set on the feature, similar to an attributes table.
       * @param {Cesium.Entity} feature A Cesium Entity
       * @returns {Object} An object containing key-value mapping of property
       * names to properties.
       */
      getPropertiesFromFeature: function (feature) {
        feature = this.getEntityFromMapObject(feature);
        if (!feature) return null;
        const featureProps = feature.properties;
        let properties = {};
        if (featureProps) {
          properties = feature.properties.getValue(new Date());
        }
        properties = this.addCustomProperties(properties);
        return properties;
      },

      /**
       * Return the label for a feature from a DataSource model
       * @param {Cesium.Entity} feature A Cesium Entity
       * @returns {string} The label
       */
      getLabelFromFeature: function (feature) {
        feature = this.getEntityFromMapObject(feature);
        if (!feature) return null;
        return feature.name;
      },

      /**
       * Return the DataSource model for a feature from a Cesium DataSource
       * model
       * @param {Cesium.Entity} feature A Cesium Entity
       * @returns {Cesium.GeoJsonDataSource|Cesium.CzmlDataSource} The model
       */
      getCesiumModelFromFeature: function (feature) {
        feature = this.getEntityFromMapObject(feature);
        if (!feature) return null;
        return feature.entityCollection.owner;
      },

      /**
       * Return the ID used by Cesium for a feature from a DataSource model
       * @param {Cesium.Entity} feature A Cesium Entity
       * @returns {string} The ID
       */
      getIDFromFeature: function (feature) {
        feature = this.getEntityFromMapObject(feature);
        if (!feature) return null;
        return feature.id;
      },

      /**
       * Updates the styles set on the cesiumModel object based on the
       * colorPalette and filters attributes.
       */
      updateAppearance: function () {
        try {
          const model = this;
          const cesiumModel = this.get("cesiumModel");
          this.set("displayReady", false);

          if (!cesiumModel) {
            return;
          }

          const entities = cesiumModel.entities.values;

          // Suspending events while updating a large number of entities helps
          // performance.
          model.suspendEvents();

          // If the asset isn't visible, just hide all entities and update the
          // visibility property to indicate that layer is hidden
          if (!model.isVisible()) {
            cesiumModel.entities.show = false;
            if (model.get("opacity") === 0) model.set("visible", false);
          } else {
            cesiumModel.entities.show = true;
            this.styleEntities(entities);
          }

          model.resumeEvents();
          this.runVisualizers();
        } catch (e) {
          console.log("Failed to update CesiumVectorData model styles.", e);
        }
      },

      /**
       * Run the Cesium visualizers for this asset. Visualizers render data
       * associated with DataSource instances. Visualizers must be run after
       * changes are made to the data or the appearance of the data.
       * @since x.x.x
       * @see {@link https://cesium.com/learn/cesiumjs/ref-doc/Visualizer.html}
       */
      runVisualizers: function () {
        const dataSource = this.get("cesiumModel");
        const visualizers = dataSource._visualizers;
        if (!visualizers || !visualizers.length) {
          this.whenVisualizersReady(this.runVisualizers.bind(this));
          return;
        }
        const time = Cesium.JulianDate.now();
        let displayReadyNow = true
        for (let x = 0; x < visualizers.length; x++) {
          displayReadyNow = visualizers[x].update(time) && displayReadyNow;
        }
        if (!displayReadyNow) {
          setTimeout(this.runVisualizers.bind(this), 300);
        } else {
          this.set("displayReady", true);
        }
        this.trigger("appearanceChanged");
      },

      /**
       * Check for the existence of visualizers and run the callback when they
       * are ready. This is useful for waiting to run code that depends on the
       * visualizers being ready. It will attempt to run the callback every
       * pingRate ms until the visualizers are ready, or until the maxPings is
       * reached.
       * @param {Function} callBack - The function to run when the visualizers
       * are ready
       * @param {Number} [pingRate=100] - The number of milliseconds to wait
       * between pings - pings are used to check if the visualizers are ready
       * @param {Number} [maxPings=30] - The maximum number of pings to wait
       * before giving up
       */
      whenVisualizersReady: function (callBack, pingRate = 100, maxPings = 30) {
        const model = this;
        let pings = 0;
        const interval = setInterval(function () {
          pings++;
          if (pings > maxPings) {
            clearInterval(interval);
            return;
          }
          const visualizers = model.get("cesiumModel")._visualizers;
          if (visualizers && visualizers.length) {
            clearInterval(interval);
            callBack();
          }
        }, pingRate);
      },

      /**
       * Get the Cesium EntityCollection for this asset
       * @returns {Cesium.EntityCollection} The Cesium EntityCollection
       * @since x.x.x
       */
      getEntityCollection: function () {
        const model = this;
        const dataSource = model.get("cesiumModel");
        return dataSource?.entities;
      },

      /**
       * Get the Cesium Entities for this asset
       * @returns {Cesium.Entity[]} The Cesium Entities
       * @since x.x.x
       */
      getEntities: function () {
        return this.getEntityCollection()?.values || [];
      },

      /**
       * Suspend events on the Cesium EntityCollection. This will prevent
       * visualizers from running until resumeEvents is called.
       * @since x.x.x
       */
      suspendEvents: function () {
        const entities = this.getEntityCollection();
        if (entities) entities.suspendEvents();
      },

      /**
       * Resume events on the Cesium EntityCollection. This will allow
       * visualizers to run again.
       * @since x.x.x
       */
      resumeEvents: function () {
        const entities = this.getEntityCollection();
        if (entities) entities.resumeEvents();
      },

      /**
       * Manually an entity to the Cesium EntityCollection.
       * @param {Object} entity - The ConstructorOptions with properties to pass
       * to Cesium.EntityCollection.add. See
       * {@link https://cesium.com/learn/cesiumjs/ref-doc/EntityCollection.html?classFilter=EntityCollection#add}
       * @returns {Cesium.Entity} The Cesium Entity that was added
       * @since x.x.x
       */
      addEntity: function (entity) {
        try {
          const entities = this.getEntityCollection();
          if (!entities) return false;
          const newEntity = entities.add(entity);
          this.styleEntities([newEntity]);
          this.runVisualizers();
          return newEntity;
        } catch (e) {
          console.log("Failed to add an entity.", e);
        }
      },

      /**
       * Manually remove an entity from the Cesium EntityCollection.
       * @param {Cesium.Entity|string} entity - The entity or ID of the entity
       * to remove
       * @returns {Boolean} True if the entity was removed, false otherwise
       * @since x.x.x
       */
      removeEntity: function (entity) {
        try {
          const entities = this.getEntityCollection();
          if (!entities) return false;
          let removed = false;
          // if entity is a string, remove by ID
          if (typeof entity === "string") {
            removed = entities.removeById(entity);
          } else {
            // Otherwise, assume it's an entity object
            removed = entities.remove(entity);
          }
          this.runVisualizers();
          return removed;
        } catch (e) {
          console.log("Failed to remove an entity.", e);
        }
      },

      /**
       * Update the styles for a set of entities
       * @param {Array} entities - The entities to update
       * @since 2.25.0
       */
      styleEntities: function (entities) {
        // Map of entity types to style functions
        const entityStyleMap = {
          polygon: this.stylePolygon,
          polyline: this.stylePolyline,
          billboard: this.styleBillboard,
          point: this.stylePoint,
        };

        entities.forEach((entity) => {
          const styles = this.getStyles(entity);
          if (!styles) {
            entity.show = false;
            return;
          }
          entity.show = true;
          for (const [type, styleFunction] of Object.entries(entityStyleMap)) {
            if (entity[type]) {
              styleFunction.call(this, entity, styles);
            }
          }
        }, this);
      },

      /**
       * Update the styles for a polygon entity
       * @param {Cesium.Entity} entity - The entity to update
       * @param {Object} styles - Styles to apply, as returned by getStyles
       * @since 2.25.0
       */
      stylePolygon: function (entity, styles) {
        entity.polygon.material = styles.color;
        entity.polygon.outline = styles.outline;
        entity.polygon.outlineColor = styles.outlineColor;
        entity.polygon.outlineWidth = styles.outline ? 2 : 0;
      },

      /**
       * Update the styles for a point entity
       * @param {Cesium.Entity} entity - The entity to update
       * @param {Object} styles - Styles to apply, as returned by getStyles
       * @since 2.25.0
       */
      stylePoint: function (entity, styles) {
        entity.point.color = styles.color;
        entity.point.outlineColor = styles.outlineColor;
        entity.point.outlineWidth = styles.outline ? 2 : 0;
        entity.point.pixelSize = styles.pointSize;
      },

      /**
       * Update the styles for a polyline entity
       * @param {Cesium.Entity} entity - The entity to update
       * @param {Object} styles - Styles to apply, as returned by getStyles
       * @since 2.25.0
       */
      stylePolyline: function (entity, styles) {
        entity.polyline.material = styles.color;
        entity.polyline.width = styles.lineWidth;
      },

      /**
       * Update the styles for a billboard entity
       * @param {Cesium.Entity} entity - The entity to update
       * @param {Object} styles - Styles to apply, as returned by getStyles
       * @since 2.25.0
       */
      styleBillboard: function (entity, styles) {
        if (!this.pinBuilder) {
          this.pinBuilder = new Cesium.PinBuilder();
        }
        entity.billboard.image = this.pinBuilder
          .fromColor(styles.color, styles.markerSize)
          .toDataURL();
        // To convert the automatically created billboards to points instead:
        // entity.billboard = undefined; entity.point = new
        // Cesium.PointGraphics();
      },

      /**
       * Update the styles for a label entity
       * @param {Cesium.Entity} entity - The entity to update
       * @param {Object} styles - Styles to apply, as returned by getStyles
       * @since 2.25.0
       */
      styleLabel: function (entity, styles) {
        // TODO...
      },

      /**
       * Covert a Color model to a Cesium Color
       * @param {Color} color A Color model
       * @returns {Cesium.Color|null} A Cesium Color or null if the color is
       * invalid
       * @since 2.25.0
       */
      colorToCesiumColor: function (color) {
        color = color?.get ? color.get("color") : color;
        if (!color) return null;
        return new Cesium.Color(
          color.red,
          color.green,
          color.blue,
          color.alpha
        );
      },

      /**
       * Return the color for a feature based on the colorPalette and filters
       * attributes.
       * @param {Cesium.Entity} entity A Cesium Entity
       * @returns {Cesium.Color|null} A Cesium Color or null if the color is
       * invalid or alpha is 0
       * @since 2.25.0
       */
      colorForEntity: function (entity) {
        const properties = this.getPropertiesFromFeature(entity);
        const color = this.colorToCesiumColor(this.getColor(properties));
        const alpha = color.alpha * this.get("opacity");
        if (alpha === 0) return null;
        color.alpha = alpha;
        return this.colorToCesiumColor(color);
      },

      /**
       * Return the styles for a selected feature
       * @param {Cesium.Entity} entity A Cesium Entity
       * @returns {Object} An object containing the styles for the feature
       * @since 2.25.0
       */
      getSelectedStyles: function (entity) {
        const highlightColor = this.colorToCesiumColor(
          this.get("highlightColor")
        );
        return {
          color: highlightColor || this.colorForEntity(entity),
          outlineColor: Cesium.Color.WHITE,
          outline: true,
          lineWidth: 7,
          markerSize: 34,
          pointSize: 17,
        };
      },

      /**
       * Return the styles for a feature
       * @param {Cesium.Entity} entity A Cesium Entity
       * @returns {Object} An object containing the styles for the feature
       * @since 2.25.0
       */
      getStyles: function (entity) {
        if (!entity) return null;
        entity = this.getEntityFromMapObject(entity);
        if (this.featureIsSelected(entity)) {
          return this.getSelectedStyles(entity);
        }
        const color = this.colorForEntity(entity);
        if (!color) {
          return null;
        }
        const outlineColor = this.colorToCesiumColor(
          this.get("outlineColor")?.get("color")
        );
        return {
          color: color,
          outlineColor: outlineColor,
          outline: outlineColor ? true : false,
          lineWidth: 3,
          markerSize: 25,
          pointSize: 13,
        };
      },

      /**
       * Shows or hides each feature from this Map Asset based on the filters.
       */
      updateFeatureVisibility: function () {
        try {
          const model = this;
          const entities = this.getEntities();
          const filters = model.get("filters");

          if (!entities || !filters) return;

          // Suspending events while updating a large number of entities helps
          // performance.
          this.suspendEvents();

          for (var i = 0; i < entities.length; i++) {
            let visible = true;
            const entity = entities[i];
            if (filters && filters.length) {
              const properties = model.getPropertiesFromFeature(entity);
              visible = model.featureIsVisible(properties);
            }
            entity.show = visible;
          }

          this.resumeEvents();
          model.runVisualizers();
        } catch (e) {
          console.log("Failed to update CesiumVectorData model styles.", e);
        }
      },

      /**
       * Waits for the model to be ready to display, then gets a Cesium Bounding
       * Sphere that can be used to navigate to view the full extent of the
       * vector data. See
       * {@link https://cesium.com/learn/cesiumjs/ref-doc/BoundingSphere.html}.
       * @param {Cesium.DataSourceDisplay} dataSourceDisplay The data source
       * display attached to the CesiumWidget scene that this bounding sphere is
       * for. Required.
       * @returns {Promise} Returns a promise that resolves to a Cesium Bounding
       * Sphere when ready
       */
      getBoundingSphere: function (dataSourceDisplay) {
        return this.whenDisplayReady()
          .then(function (model) {
            const entities = model.getEntities(); // .slice(0)?
            const boundingSpheres = [];
            const boundingSphereScratch = new Cesium.BoundingSphere();
            for (let i = 0, len = entities.length; i < len; i++) {
              let state = Cesium.BoundingSphereState.PENDING;
              state = dataSourceDisplay.getBoundingSphere(
                entities[i],
                false,
                boundingSphereScratch
              );
              if (state === Cesium.BoundingSphereState.PENDING) {
                return false;
              } else if (state !== Cesium.BoundingSphereState.FAILED) {
                boundingSpheres.push(
                  Cesium.BoundingSphere.clone(boundingSphereScratch)
                );
              }
            }
            if (boundingSpheres.length) {
              return Cesium.BoundingSphere.fromBoundingSpheres(boundingSpheres);
            }
            return false;
          })
          .catch(function (e) {
            console.log("Error getting bounding sphere.", e);
          });
      },
    }
  );

  return CesiumVectorData;
});
