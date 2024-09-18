"use strict";

define(["underscore", "backbone", "models/maps/GeoPoint"], (
  _,
  Backbone,
  GeoPoint,
) => {
  /**
   * @class ZoomPresetModel
   * @classdesc ZoomPresetModel represents a point of interest on a map that can
   * be configured within a MapView.
   * @classcategory Models/Maps
   * @extends Backbone.Model
   * @since 2.29.0
   */
  const ZoomPresetModel = Backbone.Model.extend(
    /** @lends ZoomPresetModel.prototype */ {
      /**
       * @typedef {Object} ZoomPresetModelOptions
       * @property {string} title The displayed title for the preset.
       * @property {GeoPoint} geoPoint The location representing this preset,
       * including height information.
       * @property {string} description A brief description of the layers and
       * location.
       * @property {string[]} enabledLayerIds A list of layer IDs which are to
       * be enabled for this preset.
       * @property {string[]} enabledLayerLabels A list of layer labels which
       * are enabled for this preset.
       */

      /**
       * @name ZoomPresetModel#defaults
       * @type {ZoomPresetModelOptions}
       */
      defaults() {
        return {
          description: "",
          enabledLayerIds: [],
          enabledLayerLabels: [],
          geoPoint: null,
          title: "",
        };
      },

      /**
       * @param {Object} position The latitude, longitude, and height of this
       * ZoomPresetModel's GeoPoint.
       */
      parse({ position, ...rest }) {
        const geoPoint = new GeoPoint({
          latitude: position.latitude,
          longitude: position.longitude,
          height: position.height,
        });

        return { geoPoint, ...rest };
      },
    },
  );

  return ZoomPresetModel;
});
