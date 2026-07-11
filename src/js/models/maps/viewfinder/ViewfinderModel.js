"use strict";

define([
  "underscore",
  "backbone",
  "cesium",
  "models/geocoder/GeocoderSearch",
  "models/maps/GeoPoint",
], (_, Backbone, Cesium, GeocoderSearch, GeoPoint) => {
  const EMAIL = MetacatUI.appModel.get("emailContact");
  const NO_RESULTS_MESSAGE =
    "No search results found, try using another place name.";
  const API_ERROR = `We're having trouble identifying locations on the map right now. Please reach out to support for help with this issue${
    EMAIL ? `: ${EMAIL}` : "."
  }`;
  const PLACES_API_ERROR = API_ERROR;
  const GEOCODING_API_ERROR = API_ERROR;

  /**
   * @class ViewfinderModel
   * @classdesc ViewfinderModel maintains state for the ViewfinderView and
   * interfaces with location searching services.
   * @classcategory Models/Maps
   * @since 2.28.0
   * @augments Backbone.Model
   */
  const ViewfinderModel = Backbone.Model.extend(
    /** @lends ViewfinderModel.prototype */ {
      /**
       * @name ViewfinderModel#defaults
       * @type {object}
       * @property {string} error is the current error string to be displayed in
       * the UI.
       * @property {number} focusIndex is the index of the element in the list
       * of predictions that shoudl be highlighted as focus.
       * @property {Prediction[]} predictions a list of Predictions models that
       * correspond to the user's search query.
       * @property {string} query the user's search query.
       * @property {ViewfinderCardCategories|null} viewfinderCards is the
       * collection of ViewfinderCards available in the current map. Renamed from
       * zoomPresets when zoom presets were deprecated in favor of more generalized
       * viewfinder cards.
       * @since 2.28.0
       */
      defaults() {
        return {
          error: "",
          focusIndex: -1,
          predictions: [],
          query: "",
          viewfinderCards: null,
        };
      },

      /**
       * @param {Map} mapModel The Map model that the ViewfinderModel is
       * managing for the corresponding ViewfinderView.
       */
      initialize({ mapModel }) {
        this.geocoderSearch = new GeocoderSearch();
        this.mapModel = mapModel;

        this.set("viewfinderCards", mapModel.get("viewfinderCardsCollection"));
      },

      /**
       * Get autocompletion predictions from the GeocoderSearch model.
       * @param {string} rawQuery is the user's search query with spaces.
       */
      async autocompleteSearch(rawQuery) {
        const query = rawQuery.trim();
        if (this.get("query") === query) {
          return;
        }
        if (!query) {
          this.set({ error: "", predictions: [], query: "", focusIndex: -1 });
          return;
        }
        if (GeoPoint.couldBeLatLong(query)) {
          this.set({ predictions: [], query: "", focusIndex: -1 });
          return;
        }

        // Unset error so the error will fire a change event even if it is the
        // same error as already exists.
        this.unset("error", { silent: true });

        try {
          // User is looking for autocompletions.
          const predictions = await this.geocoderSearch.autocomplete(query);
          const error = predictions.length === 0 ? NO_RESULTS_MESSAGE : "";
          this.set({ error, focusIndex: -1, predictions, query });
        } catch (e) {
          if (
            e.code === "REQUEST_DENIED" &&
            e.endpoint === "PLACES_AUTOCOMPLETE"
          ) {
            this.set({
              error: PLACES_API_ERROR,
              focusIndex: -1,
              predictions: [],
              query,
            });
          } else {
            this.set({
              error: NO_RESULTS_MESSAGE,
              focusIndex: -1,
              predictions: [],
              query,
            });
          }
        }
      },

      /**
       * Decrement the focused index with a minimum value of 0. This corresponds
       * to an ArrowUp key down event.
       * Note: An ArrowUp key press while the current index is -1 will
       * result in highlighting the first element in the list.
       */
      decrementFocusIndex() {
        const currentIndex = this.get("focusIndex");
        this.set("focusIndex", Math.max(0, currentIndex - 1));
      },

      /**
       * Increment the focused index with a maximum value of the last value in
       * the list. This corresponds to an ArrowDown key down event.
       */
      incrementFocusIndex() {
        const currentIndex = this.get("focusIndex");
        this.set(
          "focusIndex",
          Math.min(currentIndex + 1, this.get("predictions").length - 1),
        );
      },

      /**
       * Reset the focused index back to the initial value so that no element
       * in the UI is highlighted.
       */
      resetFocusIndex() {
        this.set("focusIndex", -1);
      },

      /**
       * Navigate to the GeocodedLocation.
       * @param {GeocodedLocation} geocoding is the location that corresponds
       * to the the selected prediction.
       */
      goToLocation(geocoding) {
        if (!geocoding) return;

        const coords = geocoding.get("box").getCoords();
        this.mapModel.zoomTo({
          destination: Cesium.Rectangle.fromDegrees(
            coords.west,
            coords.south,
            coords.east,
            coords.north,
          ),
        });
      },

      /**
       * Open a visualization app in the full-screen iframe overlay by setting
       * the activeVisualizationUrl attribute on the map model.
       * @param {string} url The URL to load in the iframe overlay.
       * @since 2.37.0
       */
      openVisualization(url) {
        this.mapModel.set({ activeVisualizationUrl: url });
      },

      /**
       * Close the visualization overlay by clearing activeVisualizationUrl on
       * the map model.
       * @since 2.37.0
       */
      closeVisualization() {
        this.mapModel.set({ activeVisualizationUrl: null });
      },

      /**
       * Extended from ZoomPresetModel's selectZoomPreset() when zoom presets
       * were deprecated in favor of generalized viewfinder cards. Select a
       * ViewfinderCardModel from the list of cards and navigate there.
       * When `action` is a 'map' type ctaAction, its `layerIds` and coordinates
       * are used directly. Otherwise falls back to the preset's `enabledLayerIds`
       * and `geoPoint` for backward compatibility.
       * @param {ViewfinderCardModel} preset A user selected card.
       * @param {ViewfinderCardAction} [action] The specific 'map' ctaAction
       * that was activated. When omitted, the preset's own fields are used.
       */
      selectViewfinderCard(preset, action) {
        let enabledLayerIds;
        let geoPoint;

        if (action && action.type === "map") {
          enabledLayerIds = action.layerIds || [];
          if (action.latitude != null && action.longitude != null) {
            geoPoint = new GeoPoint({
              latitude: action.latitude,
              longitude: action.longitude,
              height: action.height,
            });
          }
        } else {
          // Backward compat: read directly from the legacy zoom preset model attributes.
          enabledLayerIds = preset.get("enabledLayerIds") || [];
          geoPoint = preset.get("geoPoint");
        }

        this.mapModel.get("allLayers").forEach((layer) => {
          const isVisible = enabledLayerIds.includes(layer.get("layerId"));
          // Show or hide the layer according to the preset.
          layer.set("visible", isVisible);
        });

        if (geoPoint) {
          this.mapModel.zoomTo(geoPoint);
        }

        // If this preset corresponds to a specific feature, select it on the
        // map.
        const layer = preset.get("featureLayer");
        const featId = preset.get("featureId");
        if (layer && featId) {
          const feature = layer.getFeatureById(featId);
          if (feature) {
            const featAttrs = layer.getFeatureAttributes(feature);
            this.mapModel.selectFeatures([featAttrs]);
          }
        } else {
          // close any open feature panels
          this.mapModel.selectFeatures([]);
        }
      },

      /**
       * Backward-compatibility alias for selectViewfinderCard.
       * @deprecated Use selectViewfinderCard instead.
       * @param {ViewfinderCardModel} preset The card to select.
       * @returns {void}
       */
      selectZoomPreset(preset) {
        return this.selectViewfinderCard(preset);
      },

      /**
       * Select a prediction from the list of predictions and navigate there.
       * @param {Prediction} prediction is the user-selected Prediction that
       * needs to be geocoded and navigated to.
       */
      async selectPrediction(prediction) {
        if (!prediction) return;
        try {
          const geocodings = await this.geocoderSearch.geocode(prediction);

          if (geocodings.length === 0) {
            this.set("error", NO_RESULTS_MESSAGE);
            return;
          }
          if (geocodings.length === 0) {
            this.set("error", NO_RESULTS_MESSAGE);
            return;
          }

          this.trigger("selection-made", prediction.get("description"));
          this.goToLocation(geocodings[0]);
        } catch (e) {
          if (
            e.code === "REQUEST_DENIED" &&
            e.endpoint === "GEOCODER_GEOCODE"
          ) {
            this.set({
              error: GEOCODING_API_ERROR,
              focusIndex: -1,
              predictions: [],
            });
          } else {
            this.set("error", NO_RESULTS_MESSAGE);
          }
        }
      },

      /**
       * Event handler for Backbone.View configuration that is called whenever
       * the user clicks the search button or hits the Enter key.
       * @param {string} value is the query string.
       */
      async search(value) {
        if (!value) return;

        // This is not a lat,long value, so geocode the prediction instead.
        if (!GeoPoint.couldBeLatLong(value)) {
          const focusedIndex = Math.max(0, this.get("focusIndex"));
          this.selectPrediction(this.get("predictions")[focusedIndex]);
          return;
        }

        // Unset error so the error will fire a change event even if it is the
        // same error as already exists.
        this.unset("error", { silent: true });

        try {
          const geoPoint = new GeoPoint(value, { parse: true });
          geoPoint.set("height", 10000 /* meters */);
          if (geoPoint.isValid()) {
            this.set("error", "");
            this.mapModel.zoomTo(geoPoint);
            return;
          }

          const errors = geoPoint.validationError;
          if (errors.latitude) {
            this.set("error", errors.latitude);
          } else if (errors.longitude) {
            this.set("error", errors.longitude);
          }
        } catch (e) {
          this.set("error", e.message);
        }
      },
    },
  );

  return ViewfinderModel;
});
