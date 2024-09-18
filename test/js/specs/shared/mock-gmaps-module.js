"use strict";

define([], () => {
  // Allow this test file to redefine gmaps module.
  require.undef("gmaps");

  // Re-define gmaps module.
  define("gmaps", [], function () {
    return {
      Geocoder: class {
        geocode() {}
      },
      places: {
        AutocompleteService: class {
          getPlacePredictions() {}
        },
      },
    };
  });
});
