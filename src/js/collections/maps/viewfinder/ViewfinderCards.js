"use strict";

define([
  "underscore",
  "backbone",
  "models/maps/viewfinder/ViewfinderCardModel",
], (_, Backbone, ViewfinderCardModel) => {
  // The LEO Network domain for viewfinder cards. This is used to determine
  // if the cards are from the LEO Network and to use as the base URL for
  // images.
  const LEO_NEWTORK_DOMAIN = "leonetwork.org";
  // Default height for viewfinder cards if not specified.
  const DEFAULT_HEIGHT = 800;
  const LEO_THUMBNAIL_PATH_SEGMENT = "/thumbnail/";
  const LEO_RESIZED_PATH_SEGMENT = "/resized/";
  /**
   * Determine if array is non-empty.
   * @param {Array} a The array in question.
   * @returns {boolean} Whether the array is non-empty.
   */
  function isNonEmptyArray(a) {
    return a && a.length && Array.isArray(a);
  }

  /**
   * Prefer the higher resolution LEO image path when available.
   * @param {string|null|undefined} thumbnailUrl LEO thumbnail path.
   * @returns {string|null} Upgraded image path, or null when unavailable.
   * @since 2.38.0
   */
  function getLeoImagePath(thumbnailUrl) {
    if (typeof thumbnailUrl !== "string" || !thumbnailUrl.length) return null;
    return thumbnailUrl.replace(
      LEO_THUMBNAIL_PATH_SEGMENT,
      LEO_RESIZED_PATH_SEGMENT,
    );
  }

  /**
   * Configuration options for preset map locations and enabled layers that
   * will be shown in the viewfinder UI. Renamed from ZoomPresets
   * for clarity when zoom presets were deprecated in favor of
   * more generalized viewfinder cards in 2.37.0.
   * @typedef {MapConfig#ViewfinderCard[]|MapConfig#LeoNetworkViewfinderCardConfig} MapConfig#ViewfinderCards
   * @since 2.35.0
   */

  /**
   * A configuration object for fetching viewfinder cards from the LEO Network.
   * Renamed from LeoNetworkZoomPresetConfig for clarity when zoom presets were
   * deprecated in favor of more generalized viewfinder cards in 2.37.0.
   * @typedef {object} MapConfig#LeoNetworkViewfinderCardConfig
   * @property {string} url The URL to fetch the GeoJSON of viewfinder cards
   * from the LEO Network, e.g.
   * `https://leonetwork.org/en/lists/geojson/A54B4AEA-21F9-4162-AEB7-AFE930C0D4E4`
   * @property {string[]} [layerIds] An optional list of layer IDs to enable
   * when a card is selected. If not provided, the visible layers will not
   * change when a card is selected.
   * @since 2.35.0
   */

  /**
   * Configuration options for a viewfinder card in the MapConfig.
   * Extended from ZoomPreset for clarity when zoom presets were
   * deprecated in favor of more generalized viewfinder cards in 2.37.0.
   * @typedef {object} MapConfig#ViewfinderCard
   * @property {string} title The displayed title for the card.
   * @property {string} description A brief description of the card.
   * @property {ViewfinderCardAction[]} [buttons] A list of action buttons.
   * buttons. Supported types:
   * - `iframe`: opens a URL in the full-screen visualization overlay; requires
   *   `url`, `label`, and optional `icon`.
   * - `tab`: opens a URL in a new browser tab; requires `url`, `label`, and
   *   optional `icon`.
   * - `map`: zooms the map to a location and/or toggles layers; requires
   *   `latitude` and `longitude`, and optional `height`, and `layerIds`.
   * @property {string} [image] An optional URL to a preview image shown in
   * the card.
   * @property {number} [latitude] Camera latitude for the "View Layers" button.
   * @property {number} [longitude] Camera longitude for the "View Layers" button.
   * @property {number} [height] Camera altitude (metres) for the "View Layers" button.
   * @property {string[]} [layerIds] Layer IDs toggled by the "View Layers" button.
   * Example configs:
   * Legacy preset:
   *   { title: "Lost Lakes", description: "Show a location", latitude: 64.1, longitude: -149.586, height: 3749999.999999828, layerIds: ["iwp"] }
   * Equivalent map action:
   *   { type: "map", label: "View Layers", latitude: 64.1, longitude: -149.586, height: 3749999.999999828, layerIds: ["iwp"] }
   * New tab action:
   *   { type: "tab", label: "Open in tab", url: "https://lostlakes.arcticdata.io/" }
   * New iframe action with url encoding and initial query params:
   *   { type: "iframe", label: "Open dashboard", url: "https://lostlakes.arcticdata.io/{?selected_lake,lat,lon,zoom}{#section_id}", initialQueryParams: { theme: "light", show_share: "false" } }
   * @since 2.37.0
   */

  /**
   * @class ViewfinderCards
   * @classdesc A ViewfinderCards collection is a group of ViewfinderCardModel
   * models that provide a location and list of layers to make visible
   * and/or allow the user to open content in an iframe or new tab. Renamed
   * from ZoomPresets for clarity when zoom presets were deprecated in favor
   * of more generalized viewfinder cards in 2.37.0.
   * @classcategory Collections/Maps
   * @augments Backbone.Collection
   * @since 2.29.0
   */
  const ViewfinderCards = Backbone.Collection.extend(
    /** @lends ViewfinderCards.prototype */ {
      /** @inheritdoc */
      model: ViewfinderCardModel,

      /**
       * Constructor for the ViewfinderCards collection.
       * @param {Array} _models The initial set of models to be added to the
       * collection.
       * @param {object} [options] Options for the collection.
       * @param {MapModel} options.mapModel The map model that this collection
       * is associated with.
       */
      initialize(_models, options = {}) {
        this.mapModel = options.mapModel;
      },

      /**
       * Checks if this collection of cards is fetched from the LEO Network.
       * @returns {boolean} True if there is a URL and it contains the LEO
       * Network domain, false otherwise.
       */
      isLEONetwork() {
        return this.url && this.url.includes(LEO_NEWTORK_DOMAIN);
      },

      /**
       * Parse the configured viewfinder cards or the GeoJSON response from
       * the LEO Network. Extended from the ZoomPresets parse method
       * when zoom presets were deprecated in favor of more generalized
       * viewfinder cards in 2.37.0. Applies default ordinality, labels, and icons and
       * synthesizes legacy top-level parameters into a map type button action.
       * @param {object[]|object} resp The configured cards passed to parse
       * may be one of:
       *    1. custom cards directly from a map config: a list of objects with
       *       properties like `description`, `latitude`, `longitude`,
       *       `height`, `title`, and `image`
       *   2. the configuration for the LEO Network collection: an object
       *      with a `url` and optionally `layerIds` property
       *   3. a GeoJSON response from the LEO Network.
       * @param {object} options Options for parsing the response.
       * @param {MapModel} [options.mapModel] The map model that this
       * collection is associated with, used to get all layers.
       * @returns {ViewfinderCardModel[]} A list of ViewfinderCardModel
       * instances representing the parsed viewfinder cards.
       */
      parse(resp, options = {}) {
        // So we can re-assign the response
        let response = resp;

        if (response?.url) {
          this.url = response.url;
          this.defaults = {
            layerIds: response.layerIds,
            featureLayerId: response.featureLayerId,
          };
        }

        if (this.isLEONetwork()) {
          response = this.parseLEONetwork(response);
        }

        if (!isNonEmptyArray(response)) return [];

        const map = options.mapModel || this.mapModel;
        const allLayers =
          typeof map.getAllLayers === "function"
            ? map.getAllLayers()
            : map.get("allLayers")?.models || [];

        const viewfinderCards = response.map((cardObj) => {
          const normalizedCard =
            ViewfinderCardModel.normalizeCardAttributes(cardObj);
          const { buttons } = normalizedCard;

          // Collect layerIds from top-level AND from any explicit map
          // buttons so all relevant layers appear in the badge display.
          const topLevelLayerIds = Array.isArray(cardObj.layerIds)
            ? cardObj.layerIds
            : [];
          const ctaMapLayerIds = buttons
            .filter((a) => a.type === "map")
            .flatMap((a) => a.layerIds || []);
          const uniqueMapLayerIds = [
            ...new Set([...topLevelLayerIds, ...ctaMapLayerIds]),
          ];

          const enabledLayerIds = [];
          const enabledLayerLabels = [];
          let featureLayer = null;

          allLayers.forEach((layer) => {
            const layerId = layer.get("layerId");
            if (uniqueMapLayerIds.includes(layerId)) {
              enabledLayerIds.push(layerId);
              enabledLayerLabels.push(layer.get("label"));
            }
            if (cardObj.featureLayerId && cardObj.featureLayerId === layerId) {
              featureLayer = layer;
            }
          });

          return new ViewfinderCardModel({
            ...normalizedCard,
            enabledLayerLabels,
            enabledLayerIds,
            featureId: cardObj.featureId,
            isLEONetwork: cardObj.isLEONetwork === true,
            featureLayerId: cardObj.featureLayerId || null,
            featureLayer,
          });
        });

        return viewfinderCards;
      },

      /**
       * Parse the GeoJSON response from the LEO Network to extract viewfinder
       * card data. This was updated to return ViewfinderCards instead of the
       * legacy ZoomPresets format when zoom presets were deprecated in 2.37.0,
       * and in 2.38.0 it was updated to use the new viewfinder card format
       * which attempts to use the resized higher res images when available and
       * synthesizes a buttons array specifying actions which get their ID from
       * the leonetwork id property.
       * @param {GeoJSON} response The GeoJSON response from the LEO Network.
       * @returns {object[]} An array of objects representing viewfinder cards.
       * @since 2.35.0
       */
      parseLEONetwork(response) {
        if (!response.features || !isNonEmptyArray(response.features)) {
          return [];
        }

        const imgBaseUrl = `https://${LEO_NEWTORK_DOMAIN}`;
        return response.features.map((feature) => {
          // Extract viewfinder card data from the GeoJSON
          const { properties, geometry } = feature;
          const { observation, id } = properties;
          const localizedDate = properties.localized_date;
          const thumbnailUrl = properties.thumbnail_url;
          const imagePath = getLeoImagePath(thumbnailUrl);
          const thumbnailPath =
            typeof thumbnailUrl === "string" && thumbnailUrl.length
              ? thumbnailUrl
              : null;
          const { title, summary } = observation;
          const { coordinates } = geometry;
          const [longitude, latitude] = coordinates;
          const layerIds = this.defaults?.layerIds || [];

          return {
            description: `<b>${localizedDate}:</b> ${summary}`,
            title,
            image: imagePath ? `${imgBaseUrl}${imagePath}` : null,
            imageFallback:
              thumbnailPath && thumbnailPath !== imagePath
                ? `${imgBaseUrl}${thumbnailPath}`
                : null,
            buttons: [
              {
                id,
                type: "map",
                latitude,
                longitude,
                height: DEFAULT_HEIGHT,
                layerIds,
              },
            ],
            featureId: id,
            isLEONetwork: true,
            featureLayerId: this.defaults?.featureLayerId,
          };
        });
      },
    },
  );

  return ViewfinderCards;
});
