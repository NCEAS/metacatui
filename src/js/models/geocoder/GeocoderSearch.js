'use strict';

define(
  [
    'models/geocoder/GoogleMapsGeocoder',
    'models/geocoder/GoogleMapsAutocompleter',
  ],
  (GoogleMapsGeocoder, GoogleMapsAutocompleter) => {
    /**
     * GeocoderSearch interfaces with various geocoding and location
     * searching services.
     * @classcategory Models/Geocoder
     * @since x.x.x
     */
    class GeocoderSearch {
      /**
       * GoogleMapsAutocompleter model for interacting with Google Maps Places
       * Autocomplete APIs.
       */
      googleMapsAutocompleter = new GoogleMapsAutocompleter();

      /**
       * GoogleMapsGeocoder for interacting with Google Maps Geocoder APIs.
       */
      googleMapsGeocoder = new GoogleMapsGeocoder();

      /**
       * Convert a Google Maps Place ID into a list geocoded objects that can be
       * displayed in the map widget.
       * @param {string} newQuery - The user's input search query.
       * @returns {Prediction[]} An array of places that could be the result the
       * user is looking for. Most often this comes in five or less results.
       */
      async autocomplete(newQuery) {
        return this.googleMapsAutocompleter.autocomplete(newQuery);
      }

      /**
       * Convert a Google Maps Place ID into a list geocoded objects that can be
       * displayed in the map widget.
       * @param {Prediction} prediction An autocomplete prediction that includes
       * a unique identifier for geocoding.
       * @returns {GeocodedLocation[]} An array of locations with an associated
       * bounding box. According to Google Maps API this should most often be a
       * single value, but could potentially be many.
       */
      async geocode(prediction) {
        return this.googleMapsGeocoder.geocode(prediction);
      }
    }

    return GeocoderSearch;
  });
