"use strict";

define(["underscore", "backbone", "models/maps/GeoPoint"], (
  _,
  Backbone,
  GeoPoint,
) => {
  /**
   * @class ZoomPresetModel
   * @classdesc ZoomPresetModel represents a point of interest on a map that can
   * be configured within a MapView. Supports three card variants:
   * - Basic: zoom + toggle layers via "View Layers" button
   * - Virtual Tour: adds a "Open in Browser" button that opens `tabUrl` in a
   *   new tab
   * - Visualization App: adds an "Explore in App" button that opens `iframeUrl`
   *   in a full-screen overlay above the map
   * @classcategory Models/Maps
   * @augments Backbone.Model
   * @since 2.29.0
   */
  const ZoomPresetModel = Backbone.Model.extend(
    /** @lends ZoomPresetModel.prototype */ {
      /**
       * @typedef {object} ZoomPresetModelOptions
       * @property {string} title The displayed title for the preset.
       * @property {GeoPoint} geoPoint The location representing this preset,
       * including height information. Optional — if absent, the "View Layers"
       * button toggles layers without zooming.
       * @property {string} description A brief description of the layers and
       * location.
       * @property {string[]} enabledLayerIds A list of layer IDs which are to
       * be enabled for this preset.
       * @property {string[]} enabledLayerLabels A list of layer labels which
       * are enabled for this preset.
       * @property {string} [image] URL or path to a preview image for the card.
       * @property {string} [date] Display date string, e.g. "March 2024".
       * @property {string[]} [authors] Names of authors/creators to display.
       * @property {string} [ctaText] Label for the primary CTA button. Defaults
       * to "View Layers" when empty.
       * @property {string} [ctaIcon] FontAwesome icon class for the CTA button.
       * @property {string} [tabUrl] URL to open in a new browser tab when the
       * "Open in Browser" button is clicked.
       * @property {string} [iframeUrl] URL to load in the full-screen
       * visualization overlay when "Explore in App" is clicked.
       * @property {string} [iframePermissions] The sandbox attribute value for
       * the iframe. Defaults to "allow-scripts allow-same-origin".
       * @property {string} [messageOrigin] Trusted origin for postMessage
       * communication from the embedded app (reserved for future use).
       */

      /**
       * @name ZoomPresetModel#defaults
       * @type {ZoomPresetModelOptions}
       */
      defaults() {
        return {
          authors: [],
          ctaIcon: "",
          ctaText: "",
          date: null,
          description: "",
          enabledLayerIds: [],
          enabledLayerLabels: [],
          geoPoint: null,
          iframePermissions: "",
          iframeUrl: null,
          image: null,
          messageOrigin: "",
          tabUrl: null,
          title: "",
        };
      },

      /**
       * Parse incoming data to create a ZoomPresetModel.
       * @param {object} data The data to parse
       * @param {object} [data.position] The latitude, longitude, and height of
       * this ZoomPresetModel's GeoPoint. Optional — if absent, geoPoint is null
       * and zoom actions are skipped.
       * @param {object} data.rest The rest of the properties for this
       * ZoomPresetModel.
       * @returns {object} An object containing the GeoPoint and the rest of the
       * ZoomPresetModel properties.
       */
      parse({ position, ...rest }) {
        const geoPoint = position
          ? new GeoPoint({
              latitude: position.latitude,
              longitude: position.longitude,
              height: position.height,
            })
          : null;

        return { geoPoint, ...rest };
      },
    },
  );

  return ZoomPresetModel;
});
