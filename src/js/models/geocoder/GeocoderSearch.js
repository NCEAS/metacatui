'use strict';

define(
  [
    'underscore',
    'backbone',
    'models/geocoder/GoogleMapsGeocoder',
    'models/geocoder/GoogleMapsAutocompleter',
  ],
  (
    _,
    Backbone,
    GoogleMapsGeocoder,
    GoogleMapsAutocompleter,
    Prediction,
  ) => {
    /**
    * @class GeocoderSearch
    * @classdes GeocoderSearch interfaces with various geocoding and location
    * searching services.
    * @classcategory Models/Geocoder
    */
    const GeocoderSearch = Backbone.Model.extend({
      /**
       * Overrides the default Backbone.Model.defaults() function to specify
       * default attributes for the Map
       * @name GeocoderSearch#defaults
       * @type {Object}
       * @property {GoogleMapsAutocompleter} googleMapsAutocompleter Model for
       * interacting with Google Maps Places Autocomplete APIs.
       * @property {GoogleMapsGeocoder} googleMapsGeocoder Model for
       * interacting with Google Maps Geocoder APIs.
       */
      defaults() {
        return {
          googleMapsAutocompleter: new GoogleMapsAutocompleter(),
          googleMapsGeocoder: new GoogleMapsGeocoder(),
        };
      },

      /**
       * Convert a Google Maps Place ID into a list geocoded objects that can be
       * displayed in the map widget.
       * @param {string} newQuery - The user's input search query.
       * @returns {Prediction[]} An array of places that could be the result the
       * user is looking for. Most often this comes in five or less results.
       */
      async autocomplete(newQuery) {
        return this.get('googleMapsAutocompleter').autocomplete(newQuery);
      },

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
        return this.get('googleMapsGeocoder').geocode(
          prediction.get('googleMapsPlaceId')
        );
      },
    });

    return GeocoderSearch;
  });
