"use strict";

define(["backbone", "models/maps/GeoPoint"], (Backbone, GeoPoint) => {
  /**
   * Normalize a configured action id.
   * @param {unknown} actionId Candidate action id.
   * @returns {string|null} Trimmed id string, or null when invalid.
   * @since 0.0.0
   */
  const normalizeActionId = (actionId) => {
    if (typeof actionId !== "string") return null;
    const id = actionId.trim();
    return id.length ? id : null;
  };

  /**
   * Keep only explicitly configured action ids and normalize whitespace.
   * Actions without an explicit id are left without an id so they are
   * excluded from URL restore-state (`a=`).
   * @param {object[]} actions The action list for a card.
   * @returns {object[]} Actions with normalized explicit ids.
   * @since 0.0.0
   */
  const normalizeConfiguredActionIds = (actions) =>
    actions.map((action = {}) => {
      const explicitId = normalizeActionId(action.id);
      if (explicitId) {
        return {
          ...action,
          id: explicitId,
        };
      }

      const { id: _id, ...rest } = action;
      return rest;
    });

  /**
   * Apply default presentation for map actions.
   * @param {object} action A card action.
   * @returns {object} The normalized action.
   * @since 0.0.0
   */
  const normalizeMapAction = (action) => {
    if (action?.type !== "map") return action;
    return {
      ordinality: "secondary",
      label: "View Layers",
      icon: "eye-open",
      ...action,
    };
  };

  /**
   * Resolve card location fields from modern and legacy config shapes.
   * @param {object} attrs Raw card attributes.
   * @param {object} [attrs.position] Legacy location object.
   * @param {number} [attrs.latitude] Top-level latitude.
   * @param {number} [attrs.longitude] Top-level longitude.
   * @param {number} [attrs.height] Top-level height.
   * @returns {{ latitude: number|null, longitude: number|null, height: number|null }} Location values.
   * @since 0.0.0
   */
  const normalizeLocation = ({
    position,
    latitude,
    longitude,
    height,
  } = {}) => ({
    latitude: latitude ?? position?.latitude ?? null,
    longitude: longitude ?? position?.longitude ?? null,
    height: height ?? position?.height ?? null,
  });

  /**
   * Normalize raw card config into model attributes.
   * @param {object} attrs Raw card attributes.
   * @param {object} [attrs.position] Legacy location object.
   * @param {number} [attrs.latitude] Top-level latitude.
   * @param {number} [attrs.longitude] Top-level longitude.
   * @param {number} [attrs.height] Top-level height.
   * @param {string[]} [attrs.layerIds] Top-level layer ids.
   * @param {object[]} [attrs.buttons] Card actions.
   * @returns {object} Normalized model attributes.
   * @since 0.0.0
   */
  const normalizeCardAttributes = ({
    position,
    latitude,
    longitude,
    height,
    layerIds,
    buttons = [],
    ...rest
  } = {}) => {
    const location = normalizeLocation({
      position,
      latitude,
      longitude,
      height,
    });
    const ids = Array.isArray(layerIds) ? layerIds : [];
    const normalizedButtons = (Array.isArray(buttons) ? buttons : []).map(
      normalizeMapAction,
    );
    const hasExplicitMapButton = normalizedButtons.some(
      (action) => action.type === "map",
    );
    const allActions = [...normalizedButtons];
    let geoPoint = null;

    if (location.latitude != null || location.longitude != null) {
      geoPoint = new GeoPoint(location);
    }

    if (
      !hasExplicitMapButton &&
      (location.latitude != null || location.longitude != null)
    ) {
      allActions.push({
        type: "map",
        ordinality: "secondary",
        label: "View Layers",
        icon: "eye-open",
        latitude: location.latitude,
        longitude: location.longitude,
        height: location.height,
        layerIds: ids,
      });
    }

    return {
      ...rest,
      geoPoint,
      buttons: allActions,
    };
  };

  /**
   * @class ViewfinderCardModel
   * @classdesc ViewfinderCardModel represents a point of interest on a map that
   * can be configured within a MapView. Each card requires a title,
   * description, and at least one button action of type 'iframe', 'tab', or 'map'.
   * This class was generalized from ZoomPresetModel and was renamed for clarity
   * when zoom presets were deprecated in favor of more generalized viewfinder
   * cards in 2.37.0, but the legacy zoom preset configuration format is still supported
   * for backward compatibility. Top level latitude, longitude, height, and
   * layerIds fields are synthesized into a 'map' action button with secondary
   * ordinality, a "View Layers" label, and eye icon. Actions are only
   * URL-restorable when they have an ID explicitly configured.
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
       * @property {string} id Unique action identifier used for URL restore
       * (`a=` query param). Provide a stable explicit id in config for
       * long-term link compatibility.
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
       * For iframes that require syncing state to the parent portal's url, this
       * parameter should be an RFC6570 uri template that describes the expected
       * structure.
       * @property {object} [initialQueryParams] Optional and only used for
       * 'iframe' actions. An object of query parameters to expand into the
       * URL when the iframe is first loaded.
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
       * Normalize configured action ids on construction so direct model
       * instantiation and collection parsing both preserve explicit URL
       * restore-state ids.
       * @since 0.0.0
       */
      initialize() {
        const buttons = this.get("buttons") || [];
        this.set("buttons", normalizeConfiguredActionIds(buttons), {
          silent: true,
        });
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
        return normalizeCardAttributes({
          position,
          latitude,
          longitude,
          height,
          layerIds,
          buttons,
          ...rest,
        });
      },
    },
  );

  ViewfinderCardModel.normalizeCardAttributes = normalizeCardAttributes;

  return ViewfinderCardModel;
});
