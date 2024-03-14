'use strict';

define(
  ['backbone', 'gmaps', 'models/geocoder/Prediction'],
  (Backbone, gmaps, Prediction) => {
    /**
     * Integrate with the Google Maps Places Autocomplete API using the
     * Google Maps AutocompleteService JS library.
     * @classcategory Models/Geocoder
     * @since x.x.x
     */
    class GoogleMapsAutocompleter {
      /**
       * Google Maps service for interacting with the Places Autocomplete API.
       */
      autocompleter = new gmaps.places.AutocompleteService();

      /**
       * Use the Google Maps Places API to get place predictions based off of a
       * user input string as the user types.
       * @param {string} input - User input to search for Google Maps places.
       * @returns {Prediction[]} An array of places that could be the result the
       * user is looking for. Most often this comes in five or less results.
       */
      async autocomplete(input) {
        try {
          const response = await this.autocompleter.getPlacePredictions({
            input,
          });
          return this.getPredictionsFromResults(response.predictions);
        } catch (e) {
          return [];
        }
      }

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
      }
    }

    return GoogleMapsAutocompleter;
  });