'use strict';

define(['underscore', 'backbone',], (_, Backbone) => {
  /**
  * @class ZoomPresetModel
  * @classdesc ZoomPresetModel represents a point of interest on a map that can
  * be configured within a MapView.
  * @classcategory Models/Maps
  * @extends Backbone.Model
  * @since x.x.x
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
          title: '',
          geoPoint: null,
          description: '',
          enabledLayerLabels: [],
          enabledLayers: [],
        }
      },
    });

  return ZoomPresetModel;
});