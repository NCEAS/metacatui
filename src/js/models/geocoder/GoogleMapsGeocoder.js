'use strict';

define(['backbone', 'gmaps'], (Backbone, gmaps,) => {
  /**
  * @class GoogleMapsGeocoder
  * @classdes Integrate with the Google Maps Geocoder API using the Google Maps
  * Geocoder JS library.
  * @classcategory Models
  */
  const GoogleMapsGeocoder = Backbone.Model.extend({
    defaults() {
      return { geocoder: new gmaps.Geocoder() };
    },

    /**
     * Use the Google Maps Geocoder API to convert a Google Maps Place ID into
     * a geocoded object that includes latitude and longitude information along
     * with a bound box for viewing the location.
     * @param {string} placeId - Google Maps Place ID that uniquely identifies
     * a place in the Google Maps API.
     * @returns {Object[]} An array of objects with geocoding information about
     * the specified place including a viewport bounding box and location
     * description.
     */
    async geocode(placeId) {
      try {
        const response = await this.get('geocoder').geocode({ placeId });
        return response.results;
      } catch (e) {
        return [];
      }
    },
  });

  return GoogleMapsGeocoder;
});
