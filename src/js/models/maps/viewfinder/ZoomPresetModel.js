'use strict';

define(['underscore', 'backbone',], (_, Backbone) => {
  /**
  * @class ZoomPresetModel
  * @classdes ZoomPresetModel represents an element for the ZoomPresetModel.
  * @classcategory Models/Maps
  */
  const ZoomPresetModel = Backbone.Model.extend({

    /**
     * @name ZoomPresetModel#defaults
     * @type {ZoomPresetModelOptions}
     */
    defaults() {
      return {
        title: '',
        geoPoint: null,
        description: '',
        enabledLayers: [],
      }
    },

    /**
     * @typedef {Object} ZoomPresetModelOptions
     * @property {string} title The displayed title for the preset.
     * @property {GeoPoint} geoPoint The location representing this preset,
     * including height information.
     * @property {string} description A brief description of the layers and
     * location.
     * @property {string[]} enabledLayers A list of layer identifiers which are 
     * to be enabled for this preset.
     */
    initialize({ title, geoPoint, description, enabledLayers }) {
      this.title = title;
      this.geoPoint = geoPoint;
      this.description = description;
      this.enabledLayers = enabledLayers;
    },
  });

  return ZoomPresetModel;
});