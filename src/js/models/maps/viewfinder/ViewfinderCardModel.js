"use strict";

define(["underscore", "backbone", "models/maps/GeoPoint"], (
  _,
  Backbone,
  GeoPoint,
) => {
  /**
   * @class ViewfinderCardModel
   * @classdesc ViewfinderCardModel represents a point of interest on a map that
   * can be configured within a MapView. Each card requires a title,
   * description, and at least one ctaAction of type 'iframe', 'tab', or 'map'.
   * This class was generalized from ZoomPresetModel and was renamed for clarity
   * when zoom presets were deprecated in favor of more generalized viewfinder
   * cards in 2.37.0, but the legacy zoom preset configuration format is still supported
   * for backward compatibility. Top level latitude, longitude, height, and
   * layerIds fields are synthesized into a 'map' action button with secondary
   * ordinality, a "View Layers" label, and eye icon.
   * @classcategory Models/Maps
   * @augments Backbone.Model
   * @since 2.29.0
   */
  const ViewfinderCardModel = Backbone.Model.extend(
    /** @lends ViewfinderCardModel.prototype */ {
      /**
       * Configuration options to describe a single action button on a
       * ViewfinderCard. Added when zoom presets were deprecated in favor
       * of generalized viewfinder cards in 2.37.0.
       * @typedef {object} ViewfinderCardAction
       * @property {'iframe'|'tab'|'map'} type The action type.
       * - 'iframe': opens a URL in the visualization overlay above the map.
       * - 'tab': opens a URL in a new browser tab.
       * - 'map': zooms the map to a location and/or toggles layers.
       * @property {'primary'|'secondary'} [ordinality] Visual rendering style.
       * 'primary' renders as a bordered/filled button (the default for
       * 'iframe' and 'tab' actions). 'secondary' renders as plain text with an
       * icon and no border (the default for 'map' actions).
       * @property {string} label The button label.
       * @property {string} [icon] FontAwesome icon name for the button.
       * @property {string} [url] The URL to open (required for 'iframe'/'tab').
       * @property {number} [latitude] Latitude to zoom to (for 'map').
       * @property {number} [longitude] Longitude to zoom to (for 'map').
       * @property {number} [height] Camera altitude in meters (for 'map').
       * @property {string[]} [layerIds] Layer IDs to enable (for 'map').
       */

      /**
       * Configuration options for a ViewfinderCardModel. Extended from
       * ZoomPresetModelOptions when zoom presets were deprecated in favor
       * of generalized viewfinder cards in 2.37.0.
       * @typedef {object} ViewfinderCardModelOptions
       * @property {string} title The displayed title for the card.
       * @property {string} description A brief description of the card.
       * @property {ViewfinderCardAction[]} [buttons] Explicit action buttons.
       * Any top-level position fields will synthesize an additional 'map'
       * action that is appended after these.
       * @property {number} [latitude] Camera latitude. Synthesized into a
       * 'map' button with secondary ordinality, label "View Layers", and
       * the eye icon.
       * @property {number} [longitude] Camera longitude (paired with latitude).
       * @property {number} [height] Camera altitude in metres.
       * @property {string[]} [layerIds] Layer IDs enabled by the map action.
       * @property {string[]} [enabledLayerIds] Resolved layer IDs for display.
       * @property {string[]} [enabledLayerLabels] Resolved layer labels shown
       * as informational badges when the map action is active.
       * @property {string} [image] URL or path to a preview image for the card.
       * @property {GeoPoint|null} [geoPoint] Backward-compat: location used
       * when no 'map' button is present.
       */

      /**
       * @name ViewfinderCardModel#defaults
       * @type {ViewfinderCardModelOptions}
       */
      defaults() {
        return {
          buttons: [],
          description: "",
          enabledLayerIds: [],
          enabledLayerLabels: [],
          geoPoint: null,
          image: null,
          title: "",
        };
      },

      /**
       * Extended from ZoomPresetModel's Parse() when zoom presets were deprecated
       * in favor of generalized viewfinder cards in 2.37.0. Parses incoming data to
       * create a ViewfinderCardModel. Handles the legacy `position` field
       * and synthesizes a 'map' button action (with secondary ordinality,
       * "View Layers" label, and eye icon) from any top-level
       * `latitude`/`longitude`/`height`/`layerIds` fields or from
       * the legacy `position` object. The synthesized action is appended
       * after any explicitly provided buttons.
       * @param {object} data The raw data to parse.
       * @param {object} [data.position] Legacy {latitude, longitude, height}.
       * @param {number} [data.latitude] Top-level latitude.
       * @param {number} [data.longitude] Top-level longitude.
       * @param {number} [data.height] Top-level camera altitude in metres.
       * @param {string[]} [data.layerIds] Top-level layer IDs.
       * @param {ViewfinderCardAction[]} [data.buttons] Explicit button actions.
       * @returns {object} The parsed attributes.
       */
      parse({
        position,
        latitude,
        longitude,
        height,
        layerIds,
        buttons = [],
        ...rest
      }) {
        const lat = latitude ?? position?.latitude ?? null;
        const lng = longitude ?? position?.longitude ?? null;
        const alt = height ?? position?.height ?? null;
        const ids = layerIds ?? [];

        // Apply defaults to any explicit 'map' buttons.
        const normalizedActions = buttons.map((action) => {
          if (action.type !== "map") return action;
          return {
            ordinality: "secondary",
            label: "View Layers",
            icon: "eye-open",
            ...action,
          };
        });

        const allActions = [...normalizedActions];
        let geoPoint = null;

        if (lat != null || lng != null) {
          geoPoint = new GeoPoint({
            latitude: lat,
            longitude: lng,
            height: alt,
          });
          allActions.push({
            type: "map",
            ordinality: "secondary",
            label: "View Layers",
            icon: "eye-open",
            latitude: lat,
            longitude: lng,
            height: alt,
            layerIds: ids,
          });
        }

        return { geoPoint, buttons: allActions, ...rest };
      },
    },
  );

  return ViewfinderCardModel;
});
