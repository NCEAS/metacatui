'use strict';

define(
  [
    'underscore',
    'backbone',
    'models/geocoder/GoogleMapsGeocoder',
    'models/geocoder/GoogleMapsAutocompleter',
    'models/geocoder/GeocodedLocation',
    'models/geocoder/Prediction',
  ],
  (
    _,
    Backbone,
    GoogleMapsGeocoder,
    GoogleMapsAutocompleter,
    GeocodedLocation,
    Prediction,
  ) => {
    /**
    * @class GeocoderSearch
    * @classdes GeocoderSearch interfaces with various geocoding and location
    * searching services.
    * @classcategory Models/Geocoder
    */
    const GeocoderSearch = Backbone.Model.extend({
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
        return this.getPredictionsFromResults(
          await this.get('googleMapsAutocompleter').autocomplete(newQuery)
        );
      },

      /**
       * Helper function that converts a Google Maps Autocomplete API result
       * into a useable Prediction model.
       * @param {Object[]} List of Google Maps Autocomplete API results.
       * @returns {Prediction[]} List of corresponding predictions.
       */
      getPredictionsFromResults(results) {
        return results.map(result => new Prediction({
          description: result.description,
          googleMapsPlaceId: result.place_id,
        }));
      },

      /**
       * Convert a Google Maps Place ID into a list geocoded objects that can be
       * displayed in the map widget.
       * @param {string} placeId - Google Maps Place ID that uniquely identifies
       * a place in the Google Maps API.
       * @returns {GeocodedLocation[]} An array of locations with an associated
       * bounding box. According to Google Maps API this should most often be a
       * single value, but could potentially be many.
       */
      async geocode(placeId) {
        return this.getGeocodedLocationsFromResults(
          await this.get('googleMapsGeocoder').geocode(placeId)
        );
      },

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
      },
    });

    return GeocoderSearch;
  });
