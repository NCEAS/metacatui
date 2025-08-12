"use strict";

define(["underscore", "backbone", "models/maps/viewfinder/ZoomPresetModel"], (
  _,
  Backbone,
  ZoomPresetModel,
) => {
  // The LEO Network domain for zoom presets. This is used to determine if the
  // presets are from the LEO Network and to use as the base URL for images.
  const LEO_NEWTORK_DOMAIN = "leonetwork.org";
  // Default height for zoom presets if not specified.
  const DEFAULT_HEIGHT = 800;
  /**
   * Determine if array is empty.
   * @param {Array} a The array in question.
   * @returns {boolean} Whether the array is empty.
   */
  function isNonEmptyArray(a) {
    return a && a.length && Array.isArray(a);
  }

  /**
   * Configuration options for preset map locations and enabled layers that
   * will be shown in the viewfinder UI.
   * @typedef {MapConfig#ZoomPreset[]|MapConfig#LeoNetworkZoomPresetConfig} MapConfig#ZoomPresets
   */

  /**
   * A configuration object for fetching zoom presets from the LEO Network.
   * @typedef {object} MapConfig#LeoNetworkZoomPresetConfig
   * @property {string} url The URL to fetch the GeoJSON of zoom presets from
   * the LEO Network, e.g.
   * `https://leonetwork.org/en/lists/geojson/A54B4AEA-21F9-4162-AEB7-AFE930C0D4E4`
   * @property {string[]} [layerIds] An optional list of layer IDs to enable
   * when a preset is selected. If not provided, the visible layers will not
   * change when a preset is selected.
   */

  /**
   * Configuration options for a zoom preset in the MapConfig.
   * @typedef {object} MapConfig#ZoomPreset
   * @property {string} title The displayed title for the preset.
   * @property {number} latitude The latitude of the preset location.
   * @property {number} longitude The longitude of the preset location.
   * @property {number} height The height of the preset location in meters.
   * @property {string} description A brief description of the layers and
   * location.
   * @property {string[]} enabledLayerIds A list of layer IDs which are to be
   * enabled for this preset. Must match the IDs of layers in the
   * MapConfig#MapAssetConfig.
   * @property {string[]} enabledLayerLabels A corresponding list of layer
   * labels which are enabled for this preset.
   * @property {string} [imageUrl] An optional URL to an image that represents
   * this preset.
   */

  /**
   * @class ZoomPresets
   * @classdesc A ZoomPresets collection is a group of ZoomPresetModel models
   * that provide a location and list of layers to make visible when the user
   * selects.
   * @class ZoomPresets
   * @classcategory Collections/Maps
   * @augments Backbone.Collection
   * @since 2.29.0
   * @class
   */
  const ZoomPresets = Backbone.Collection.extend(
    /** @lends ZoomPresets.prototype */ {
      /** @inheritdoc */
      model: ZoomPresetModel,

      /**
       * Constructor for the ZoomPresets collection.
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
       * Checks if this collection of presets is fetched from the LEO Network.
       * @returns {boolean} True if there is a URL and it contains the LEO
       * Network domain, false otherwise.
       */
      isLEONetwork() {
        return this.url && this.url.includes(LEO_NEWTORK_DOMAIN);
      },

      /**
       * Parse the configured zoom presets or the GeoJSON response from the LEO
       * Network.
       * @param {object[]|object} resp The configured zoom presets passed to
       * parse may be one of:
       *    1. custom presets directly from a map config: a list of objects with
       *       properties like `description`, `latitude`, `longitude`, `height`,
       *       `title`, and `image`
       *   2. the configuration for the LEO Network collection: an object with a
       *      `url` and optionally `layerIds` property
       *   2. a GeoJSON response from the LEO Network.
       * @param {object} options Options for parsing the response.
       * @param {MapModel} [options.mapModel] The map model that this collection
       * is associated with, used to get all layers.
       * @returns {ZoomPresetModel[]} A list of ZoomPresetModel instances
       * representing the parsed zoom presets.
       */
      parse(resp, options = {}) {
        // So we can re-assign the response
        let response = resp;

        if (response?.url) {
          this.url = response.url;
          this.defaults = {
            layerIds: response.layerIds,
          };
        }

        if (this.isLEONetwork()) {
          response = this.parseLEONetwork(response);
        }

        if (!isNonEmptyArray(response)) return [];

        const map = options.mapModel || this.mapModel;
        const allLayers = map.get("allLayers");

        const zoomPresets = response.map((zoomPresetObj) => {
          const enabledLayerIds = [];
          const enabledLayerLabels = [];
          allLayers.models.forEach((layer) => {
            if (
              zoomPresetObj.layerIds?.find((id) => id === layer.get("layerId"))
            ) {
              enabledLayerIds.push(layer.get("layerId"));
              enabledLayerLabels.push(layer.get("label"));
            }
          });

          return new ZoomPresetModel(
            {
              description: zoomPresetObj.description,
              enabledLayerLabels,
              enabledLayerIds,
              position: {
                latitude: zoomPresetObj.latitude,
                longitude: zoomPresetObj.longitude,
                height: zoomPresetObj.height,
              },
              title: zoomPresetObj.title,
              image: zoomPresetObj.image,
            },
            { parse: true },
          );
        });

        return zoomPresets;
      },

      /**
       * Parse the GeoJSON response from the LEO Network to extract zoom preset
       * data.
       * @param {GeoJSON} response The GeoJSON response from the LEO Network.
       * @returns {object[]} An array of objects representing zoom presets.
       * @since 0.0.0
       */
      parseLEONetwork(response) {
        if (!response.features || !isNonEmptyArray(response.features)) {
          return [];
        }

        const imgBaseUrl = `https://${LEO_NEWTORK_DOMAIN}`;
        return response.features.map((feature) => {
          // Extract zoom preset data from the GeoJSON
          const { properties, geometry } = feature;
          const { observation, id } = properties;
          const localizedDate = properties.localized_date;
          const thumbnailUrl = properties.thumbnail_url;
          const { title, summary } = observation;
          const { coordinates } = geometry;
          const [longitude, latitude] = coordinates;

          return {
            description: `<b>${localizedDate}:</b> ${summary}`,
            layerIds: this.defaults?.layerIds || [], // TOOD: or null?
            latitude,
            longitude,
            height: DEFAULT_HEIGHT,
            title,
            image: thumbnailUrl ? `${imgBaseUrl}${thumbnailUrl}` : null,
            id,
          };
        });
      },
    },
  );

  return ZoomPresets;
});
