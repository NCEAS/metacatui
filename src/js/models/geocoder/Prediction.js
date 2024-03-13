'use strict';

define(['backbone'], (Backbone) => {
  /**
  * @class Prediction
  * @classdes Prediction represents a value returned from a location
  * autocompletion search.
  * @classcategory Models/Geocoder
  * @since x.x.x
  */
  const Prediction = Backbone.Model.extend({
      /**
       * Overrides the default Backbone.Model.defaults() function to specify
       * default attributes for the Map
       * @name Prediction#defaults
       * @type {Object}
       * @property {string} description A user-friendly description of a Google
       * Maps Place.
       * @property {string} googleMapsPlaceId Unique identifier that can be 
       * geocoded by the Google Maps Geocoder API.
       */
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
