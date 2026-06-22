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
  /**
   * Determine if array is non-empty.
   * @param {Array} a The array in question.
   * @returns {boolean} Whether the array is non-empty.
   */
  function isNonEmptyArray(a) {
    return a && a.length && Array.isArray(a);
  }

  /**
   * Configuration options for preset map locations and enabled layers that
   * will be shown in the viewfinder UI.
   * @typedef {MapConfig#ViewfinderCard[]|MapConfig#LeoNetworkViewfinderCardConfig} MapConfig#ViewfinderCards
   * @since 2.35.0
   */

  /**
   * A configuration object for fetching viewfinder cards from the LEO Network.
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
   * @typedef {object} MapConfig#ViewfinderCard
   * @property {string} title The displayed title for the card.
   * @property {number} [latitude] The latitude of the card location.
   * @property {number} [longitude] The longitude of the card location.
   * @property {number} [height] The height (camera altitude) of the card
   * location in meters.
   * @property {string} [description] A brief description of the layers and
   * location.
   * @property {string[]} enabledLayerIds A list of layer IDs which are to be
   * enabled for this card. Must match the IDs of layers in the
   * MapConfig#MapAssetConfig.
   * @property {string[]} enabledLayerLabels A corresponding list of layer
   * labels which are enabled for this card.
   * @property {string} [image] An optional URL to a preview image shown in
   * the card.
   * @property {string} [date] An optional display date string shown in the
   * card (e.g. "2024 June 26").
   * @property {string[]} [authors] An optional list of author names to
   * display in the card.
   * @property {ViewfinderCardAction[]} [ctaActions] An optional list of
   * call-to-action buttons to display on the card. Each entry must have a
   * `type` ('iframe' or 'tab'), a `url`, a `label`, and may also have an
   * optional `icon` (FontAwesome class). 'iframe' opens the URL in the
   * full-screen visualization overlay; 'tab' opens it in a new browser tab.
   * Note that the View Layers button is always present and does not need to
   * be included in this list.
   */

  /**
   * @class ViewfinderCards
   * @classdesc A ViewfinderCards collection is a group of ViewfinderCardModel
   * models that provide a location and list of layers to make visible when
   * the user selects.
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
       * the LEO Network.
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
        const allLayers = map.get("allLayers");

        let featureLayer = null;

        const viewfinderCards = response.map((cardObj) => {
          const enabledLayerIds = [];
          const enabledLayerLabels = [];
          allLayers.models.forEach((layer) => {
            const layerId = layer.get("layerId");
            if (cardObj.layerIds?.find((id) => id === layerId)) {
              enabledLayerIds.push(layerId);
              enabledLayerLabels.push(layer.get("label"));
            }
            if (cardObj.featureLayerId && cardObj.featureLayerId === layerId) {
              featureLayer = layer;
            }
          });

          return new ViewfinderCardModel(
            {
              description: cardObj.description,
              enabledLayerLabels,
              enabledLayerIds,
              position: {
                latitude: cardObj.latitude,
                longitude: cardObj.longitude,
                height: cardObj.height,
              },
              title: cardObj.title,
              image: cardObj.image,
              featureId: cardObj.featureId,
              isLEONetwork: cardObj.isLEONetwork === true,
              featureLayerId: cardObj.featureLayerId || null,
              featureLayer,
              authors: cardObj.authors || [],
              ctaActions: Array.isArray(cardObj.ctaActions)
                ? cardObj.ctaActions
                : [],
              date: cardObj.date || null,
            },
            { parse: true },
          );
        });

        return viewfinderCards;
      },

      /**
       * Parse the GeoJSON response from the LEO Network to extract viewfinder
       * card data.
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
          const { title, summary } = observation;
          const { coordinates } = geometry;
          const [longitude, latitude] = coordinates;

          return {
            description: `<b>${localizedDate}:</b> ${summary}`,
            layerIds: this.defaults?.layerIds || [],
            latitude,
            longitude,
            height: DEFAULT_HEIGHT,
            title,
            image: thumbnailUrl ? `${imgBaseUrl}${thumbnailUrl}` : null,
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
