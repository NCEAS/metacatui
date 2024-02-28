'use strict';

define(['backbone'], (Backbone) => {
  /**
  * @class Prediction
  * @classdes Prediction represents a value returned from a location
  * autocompletion search.
  * @classcategory Models/Geocoder
  */
  const Prediction = Backbone.Model.extend({
    defaults() {
      return { description: '', googleMapsPlaceId: '' };
    },

    /**
     * @typedef {Object} PredictionOptions
     * @property {string} description A string describing the location
     * represented by the Prediction. 
     * @property {string} googleMapsPlaceId The place ID that is used to
     * uniquely identify a place in Google Maps API. 
     */
    initialize({ description, googleMapsPlaceId, } = {}) {
      this.set('description', description);
      this.set('googleMapsPlaceId', googleMapsPlaceId);
    },
  });

  return Prediction;
});
