"use strict";

define([
  "backbone",
  "collections/maps/Features",
  "models/maps/Feature",
  "models/maps/GeoBoundingBox",
  "models/maps/GeoPoint",
  "models/maps/GeoScale",
], function (Backbone, Features, Feature, GeoBoundingBox, GeoPoint, GeoScale) {
  /**
   * @class MapInteraction
   * @classdesc The Map Interaction stores information about user interaction
   * with a map, including the current position of the mouse, the feature that
   * the mouse is currently hovering over, and the position on the map that the
   * user has clicked, as well as the current view extent of the map.
   * @classcategory Models/Maps
   * @name MapInteraction
   * @since x.x.x
   * @extends Backbone.Model
   */
  var MapInteraction = Backbone.Model.extend(
    /** @lends MapInteraction.prototype */ {
      /**
       * The type of model this is.
       * @type {String}
       */
      type: "MapInteraction",

      /**
       * Overrides the default Backbone.Model.defaults() function to specify
       * default attributes for the Map.
       * @returns {Object} The default attributes for the Map.
       * @property {GeoPoint} mousePosition - The current position of the mouse
       * on the map.
       * @property {GeoPoint} clickedPosition - The position on the map that the
       * user last clicked.
       * @property {GeoScale} scale - The current scale of the map in
       * pixels:meters.
       * @property {GeoBoundingBox} viewExtent - The current extent of the map
       * view.
       * @property {Features} hoveredFeatures - The feature that the mouse is
       * currently hovering over.
       * @property {Features} clickedFeatures - The feature that the user last
       * clicked.
       * @property {Features} selectedFeatures - The feature that is currently
       * selected.
       * @property {Boolean} firstInteraction - Whether or not the user has
       * interacted with the map yet. This is set to true when the user has
       * clicked, hovered, panned, or zoomed the map. The only action that is
       * ignored is mouse movement over the map.
       * @property {String} previousAction - The previous action that was
       * performed on the map. This may be any of the labels in the Cesium
       * ScreenSpaceEventType enumeration:
       * {@link https://cesium.com/learn/cesiumjs/ref-doc/global.html#ScreenSpaceEventType}
       * @property {Feature|MapAsset|GeoBoundingBox} zoomTarget - The feature or
       * map asset that the map should zoom to. The map widget should listen to
       * this property and zoom to the specified feature or map asset when this
       * property is set. The property should be cleared after the map widget
       * has zoomed to the specified feature or map asset.
       *
       * TODO
       * * @property {Object} [currentPosition={ longitude: null, latitude:
       *   null, height: null}] An object updated by the map widget to show the
       *   longitude, latitude, and height (elevation) at the position of the
       *   mouse on the map. Note: The CesiumWidgetView does not yet update the
       *   height property.
       * @property {Object} [currentScale={ meters: null, pixels: null }] An
       * object updated by the map widget that gives two equivalent measurements
       * based on the map's current position and zoom level: The number of
       * pixels on the screen that equal the number of meters on the map/globe.
       * @property {Object} [currentViewExtent={ north: null, east: null, south:
       * null, west: null }] An object updated by the map widget that gives the
       * extent of the current visible area as a bounding box in
       * longitude/latitude coordinates, as well as the height/altitude in
       * meters.
       *
       * * @property {Features} [selectedFeatures = new Features()] - Particular
       *   features from one or more layers that are highlighted/selected on the
       *   map. The 'selectedFeatures' attribute is updated by the map widget
       *   (cesium) with a Feature model when a user selects a geographical
       *   feature on the map (e.g. by clicking)
       */
      defaults: function () {
        return {
          mousePosition: new GeoPoint(),
          clickedPosition: new GeoPoint(),
          scale: new GeoScale(),
          viewExtent: new GeoBoundingBox(),
          hoveredFeatures: new Features(),
          clickedFeatures: new Features(),
          selectedFeatures: new Features(),
          firstInteraction: false, // <- "hasInteracted"?
          previousAction: null,
          zoomTarget: null,
        };
      },

      /**
       * Run when a new Map is created.
       * @param {MapConfig} attrs - An object specifying configuration options
       * for the map. If any config option is not specified, the default will be
       * used instead (see {@link MapInteraction#defaults}).
       */
      initialize: function (attrs, options) {
        try {
          this.connectEvents();
        } catch (e) {
          console.log("Error initializing a Map Interaction model", e);
        }
      },

      /**
       * Connects the MapInteraction model to events from the map widget.
       */
      connectEvents: function () {
        this.listenForFirstInteraction();
        this.listenTo(this, "change:previousAction", this.handleClick);
      },

      /**
       * Listens for the first interaction with the map (click, hover, pan, or
       * zoom) and sets the 'firstInteraction' attribute to true when it occurs.
       */
      listenForFirstInteraction: function () {
        if (model.get("firstInteraction")) return;
        const listener = new Backbone.Model();
        const model = this;
        listener.listenTo(
          this,
          "change:previousAction",
          function (m, eventType) {
            if (eventType != "MOUSE_MOVE") {
              model.set("firstInteraction", true);
              listener.stopListening();
              listener.destroy();
            }
          }
        );
      },

      /**
       * Handles a mouse click on the map. If the user has clicked on a feature,
       * the feature is set as the 'clickedFeatures' attribute. If the map is
       * configured to show details when a feature is clicked, the feature is
       * also set as the 'selectedFeatures' attribute.
       * @param {MapInteraction} m - The MapInteraction model.
       * @param {String} action - The type of mouse click event that occurred.
       * All except LEFT_CLICK are ignored.
       */
      handleClick: function (m, action) {
        if (action !== "LEFT_CLICK") return;
        // Clone the models in hovered features and set them as clicked features
        const hoveredFeatures = this.get("hoveredFeatures").models;
        this.setClickedFeatures(hoveredFeatures);
        if (this.get("mapModel")?.get("clickFeatureAction") === "showDetails") {
          this.selectFeatures(hoveredFeatures);
        }
      },

      /**
       * Sets the position of the mouse on the map. Creates a new GeoPoint model
       * if one doesn't already exist on the mousePosition attribute.
       * @param {Object} position - An object with 'longitude' and 'latitude'
       * properties.
       * @returns {GeoPoint} The mouse position as a GeoPoint model.
       */
      setMousePosition: function (position) {
        let mousePosition = this.get("mousePosition");
        if (!mousePosition) {
          mousePosition = new GeoPoint();
          this.set("mousePosition", mousePosition);
        }
        mousePosition.set(position);
        return mousePosition;
      },

      /**
       * Set the pixel:meter scale of the map. Creates a new GeoScale model if
       * one doesn't already exist on the scale attribute.
       * @param {Object} scale - An object with 'meters' and 'pixels'
       * properties.
       * @returns {GeoScale} The scale as a GeoScale model.
       */
      setScale: function (scale) {
        let scaleModel = this.get("scale");
        if (!scaleModel) {
          scaleModel = new GeoScale();
          this.set("scale", scaleModel);
        }
        scaleModel.set(scale);
        return scaleModel;
      },

      /**
       * Set the extent of the map view. Creates a new GeoBoundingBox model if
       * one doesn't already exist on the viewExtent attribute.
       * @param {Object} extent - An object with 'north', 'east', 'south', and
       * 'west' properties.
       * @returns {GeoBoundingBox} The view extent as a GeoBoundingBox model.
       */
      setViewExtent: function (extent) {
        let viewExtent = this.get("viewExtent");
        if (!viewExtent) {
          viewExtent = new GeoBoundingBox();
          this.set("viewExtent", viewExtent);
        }
        viewExtent.set(extent);
        return viewExtent;
      },

      /**
       * Set the feature that the mouse is currently hovering over.
       * @param {Cesium.Entity|Cesium.Cesium3DTileFeature|Feature[]} features -
       * An array of feature objects selected directly from the map view.
       */
      setHoveredFeatures: function (features) {
        this.setFeatures(features, "hoveredFeatures", true);
      },

      /**
       * Set the feature that the user last clicked.
       * @param {Cesium.Entity|Cesium.Cesium3DTileFeature|Feature[]|Object[]}
       * features - An array of feature objects selected directly from the map
       * view.
       */
      setClickedFeatures: function (features) {
        this.setFeatures(features, "clickedFeatures", true);
      },

      /**
       * Set the feature that is currently selected.
       * @param {Cesium.Entity|Cesium.Cesium3DTileFeature|Feature[|Object[]]}
       * features - An array of feature objects selected directly from the map
       * view.
       */
      selectFeatures: function (features) {
        this.setFeatures(features, "selectedFeatures", true);
      },

      /**
       * Set features on either the hoveredFeatures, clickedFeatures, or
       * selectedFeatures attribute. If the replace parameter is true, then the
       * features will replace the current features on the attribute.
       * @param {Cesium.Entity|Cesium.Cesium3DTileFeature|Feature[]|Object[]}
       * features - An array of feature objects selected directly from the map
       * view.
       * @param {'hoveredFeatures'|'clickedFeatures'|'selectedFeatures'} type -
       * The type of feature to set.
       * @param {Boolean} [replace=true] - Whether or not to replace the current
       * features on the attribute with the new features.
       */
      setFeatures: function (features, type, replace = true) {
        try {
          const model = this;

          // Create a features collection if one doesn't already exist
          if (!model.get(type)) model.set(type, new Features());

          // Remove any null or undefined features
          if (Array.isArray(features)) features = features.filter((f) => f);
          // Remove any default features (which are empty models)
          if (features instanceof Features) {
            features = features.filter((f) => !f.isDefault());
          }
          // If no feature is passed to this function (and replace is true),
          if (!features || features.length === 0) {
            if (replace) model.get(type).set([], { remove: true });
            return;
          }

          // Ignore if new features are identical to the current features
          const currentFeatures = model.get(type);
          if (
            features &&
            currentFeatures &&
            currentFeatures.length === features.length &&
            currentFeatures.containsFeatures(features)
          ) {
            return;
          }

          // Convert the feature objects, which may be types specific to the map
          // widget (Cesium), to a generic Feature model
          features = model.convertFeatures(features);

          // Update the Feature model with the new selected feature information.
          const newAttrs = features.map(function (feature) {
            return Object.assign(
              {},
              new Feature().defaults(),
              feature.attributes
            );
          });
          model.get(type).set(newAttrs, { remove: replace });
        } catch (e) {
          console.log("Failed to select a Feature in a Map model.", e);
        }
      },

      /**
       * Convert an array of feature objects to an array of Feature models.
       * @param {Cesium.Entity|Cesium.Cesium3DTileFeature|Feature[]} features -
       * An array of feature objects selected directly from the map view, or
       * @returns {Feature[]} An array of Feature models.
       * @since 2.25.0
       */
      convertFeatures: function (features) {
        if (!features) return [];
        if (!features.map) features = [features];
        const mapModel = this.get("mapModel");
        const attrs = features.map(function (feature) {
          if (!feature) return null;
          if (feature instanceof Feature) return feature.attributes;
          // if this is already an object with feature attributes, return it
          if (
            feature.hasOwnProperty("mapAsset") &&
            feature.hasOwnProperty("properties")
          ) {
            return feature;
          }
          // Otherwise, assume it's a Cesium object and get the feature
          // attributes
          return mapModel.get("layers").getFeatureAttributes(features)?.[0];
        });
        return attrs.map((attr) => new Feature(attr));
      },
    }
  );

  return MapInteraction;
});
