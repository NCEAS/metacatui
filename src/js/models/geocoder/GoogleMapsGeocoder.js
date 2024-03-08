'use strict';

define(
  ['backbone', 'gmaps', 'models/geocoder/GeocodedLocation'],
  (Backbone, gmaps, GeocodedLocation) => {
    /**
    * @class GoogleMapsGeocoder
    * @classdes Integrate with the Google Maps Geocoder API using the Google Maps
    * Geocoder JS library.
    */
    return class GoogleMapsGeocoder {
      /** Google Maps service for interacting  with the Geocoder API.  */
      geocoder = new gmaps.Geocoder();

      /**
       * Use the Google Maps Geocoder API to convert a Google Maps Place ID into
       * a geocoded object that includes latitude and longitude information along
       * with a bound box for viewing the location.
       * @param {string} placeId - Google Maps Place ID that uniquely identifies
       * a place in the Google Maps API.
       * @returns {GeocodedLocation[]} An array of locations with an associated
       * bounding box. According to Google Maps API this should most often be a
       * single value, but could potentially be many.
       */
      async geocode(placeId) {
        try {
          const response = await this.geocoder.geocode({ placeId });
          return this.getGeocodedLocationsFromResults(response.results);
        } catch (e) {
          return [];
        }
      }

      /**
       * Helper function that converts a Google Maps Places API result into a
       * useable GeocodedLocation model.
       * @param {Object[]} List of Google Maps Places API results.
       * @returns {GeocodedLocation[]} List of corresponding geocoded locations.
       */
      getGeocodedLocationsFromResults(results) {
        return results.map(result => {
          return new GeocodedLocation({
            box: result.geometry.viewport.toJSON(),
            displayName: result.address_components[0].long_name,
          });
        });
      }
    }
  });
