'use strict';

define(
  ['backbone', 'models/maps/GeoBoundingBox'],
  (Backbone, GeoBoundingBox) => {
    /**
    * @class GeocodedLocation
    * @classdes GeocodedLocation is the representation of a place that has been
    * geocoded to provide latitude and longitude bounding coordinates for
    * navigating to on a map.
    * @classcategory Models/Geocoder
    */
    const GeocodedLocation = Backbone.Model.extend({
      defaults() {
        return {
          box: new GeoBoundingBox,
          displayName: '',
        };
      },

      /**
       * @typedef {Object} GeocodedLocationOptions
       * @property {Object} box An object representing a boundary around a
       * location on a map. 
       * @property {string} displayName A display name for the location. 
       */
      initialize({ box: { north, south, east, west } = {}, displayName = '' } = {}) {
        this.set('box', new GeoBoundingBox({ north, south, east, west }));
        this.set('displayName', displayName);
      },
    });

    return GeocodedLocation;
  });
