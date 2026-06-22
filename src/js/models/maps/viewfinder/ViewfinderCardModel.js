"use strict";

define(["underscore", "backbone", "models/maps/GeoPoint"], (
  _,
  Backbone,
  GeoPoint,
) => {
  /**
   * @class ViewfinderCardModel
   * @classdesc ViewfinderCardModel represents a point of interest on a map that
   * can be configured within a MapView. Supports three card variants:
   * - Basic: zoom + toggle layers via "View Layers" button
   * - Virtual Tour: adds a "Open in Browser" button that opens `tabUrl` in a
   *   new tab
   * - Visualization App: adds an "Explore in App" button that opens `iframeUrl`
   *   in a full-screen overlay above the map
   * @classcategory Models/Maps
   * @augments Backbone.Model
   * @since 2.29.0
   */
  const ViewfinderCardModel = Backbone.Model.extend(
    /** @lends ViewfinderCardModel.prototype */ {
      /**
       * @typedef {object} ViewfinderCardAction
       * @property {'iframe'|'tab'} type The action type. 'iframe' opens the
       * URL in the full-screen visualization overlay; 'tab' opens it in a new
       * browser tab.
       * @property {string} url The URL to open.
       * @property {string} label The button label.
       * @property {string} [icon] FontAwesome icon class for the button.
       */

      /**
       * @typedef {object} ViewfinderCardModelOptions
       * @property {string} title The displayed title for the card.
       * @property {GeoPoint|null} [geoPoint] The location representing this
       * card, including height information. If absent, the "View Layers"
       * button toggles layers without zooming.
       * @property {string} description A brief description of the layers and
       * location.
       * @property {string[]} enabledLayerIds A list of layer IDs which are to
       * be enabled for this card.
       * @property {string[]} enabledLayerLabels A list of layer labels which
       * are enabled for this card.
       * @property {string} [image] URL or path to a preview image for the card.
       * @property {string} [date] Display date string, e.g. "March 2024".
       * @property {string[]} [authors] Names of authors/creators to display.
       * @property {ViewfinderCardAction[]} [ctaActions] CTA buttons to display
       * above the "View Layers" button. Each entry declares the action type,
       * URL, label, and optional icon.
       */

      /**
       * @name ViewfinderCardModel#defaults
       * @type {ViewfinderCardModelOptions}
       */
      defaults() {
        return {
          authors: [],
          ctaActions: [],
          date: null,
          description: "",
          enabledLayerIds: [],
          enabledLayerLabels: [],
          geoPoint: null,
          image: null,
          title: "",
        };
      },

      /**
       * Parse incoming data to create a ViewfinderCardModel.
       * @param {object} data The data to parse
       * @param {object} [data.position] The latitude, longitude, and height of
       * this ViewfinderCardModel's GeoPoint. If absent, geoPoint is null and
       * zoom actions are skipped.
       * @returns {object} An object containing the GeoPoint and all remaining
       * ViewfinderCardModel properties.
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

  return ViewfinderCardModel;
});
