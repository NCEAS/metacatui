'use strict';

define(['backbone', 'gmaps'], (Backbone, gmaps) => {
  /**
  * @class GoogleMapsAutocompleter
  * @classdes Integrate with the Google Maps Places Autocomplete API using the
  * Google Maps AutocompleteService JS library.
  * @classcategory Models
  */
  const GoogleMapsAutocompleter = Backbone.Model.extend({
    defaults() {
      return { autocompleter: new gmaps.places.AutocompleteService() };
    },

    /**
     * Use the Google Maps Places API to get place predictions based off of a
     * user input string as the user types.
     * @param {string} input - User input to search for Google Maps places.
     * @returns {Object[]} An array of objects with a unique Place ID and a 
     * brief description of the location.
     */
    async autocomplete(input) {
      try {
        const response = await this.get('autocompleter').getPlacePredictions({
          input,
        });
        return response.predictions;
      } catch (e) {
        return [];
      }
    },
  });

  return GoogleMapsAutocompleter;
});
