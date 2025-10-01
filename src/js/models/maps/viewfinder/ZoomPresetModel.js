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
   * @augments Backbone.Model
   * @since 2.29.0
   */
  const ZoomPresetModel = Backbone.Model.extend(
    /** @lends ZoomPresetModel.prototype */ {
      /**
       * @typedef {object} ZoomPresetModelOptions
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
       * Parse incoming data to create a ZoomPresetModel.
       * @param {object} data The data to parse
       * @param {object} data.position The latitude, longitude, and height of
       * this ZoomPresetModel's GeoPoint.
       * @param {object} data.rest The rest of the properties for this
       * ZoomPresetModel.
       * @returns {object} An object containing the GeoPoint and the rest of the
       * ZoomPresetModel properties.
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
