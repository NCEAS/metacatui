"use strict";

define([], () => {
  /**
   * A map from search parameter key to the actual keys used by the application.
   */
  const paramIdToDestinationKey = {
    lt: "latitude",
    ln: "longitude",
    ht: "height",
    hd: "heading",
    p: "pitch",
    r: "roll",
  };
  /** The search parameter ID for enabled layers in the save to URL feature. */
  const ENABLED_LAYERS_ID = "el";
  /** Destination IDs plus enabled layers. */
  const saveToUrlIds = [
    ...Object.keys(paramIdToDestinationKey),
    ENABLED_LAYERS_ID,
  ];

  /** Clear all search parameters in URL related to save view to URL feature. */
  const clearSavedView = () => {
    const url = new URL(window.location.href);
    saveToUrlIds.forEach((id) => {
      url.searchParams.delete(id);
    });

    window.history.replaceState(null, "", url);
  };

  /**
   * Set the destination related URL search params and update the URL.
   * @param {string[]} [layerIds] - Array of layerIds for encoding into the
   * enabled layers search parameter.
   */
  const updateEnabledLayerParam = (layerIds) => {
    const url = new URL(window.location.href);
    url.searchParams.set(
      ENABLED_LAYERS_ID,
      layerIds.filter((layerId) => layerId).join(","),
    );

    window.history.replaceState(null, "", url);
  };

  /**
   * Remove a layer ID from the layers search parameter.
   * @returns {string[]} A list of enabled layerIds or an empty array if there is
   * no enabled layer search parameter.
   */
  const getEnabledLayers = () => {
    const url = new URL(window.location.href);
    return url.searchParams.get(ENABLED_LAYERS_ID)?.split(",") || [];
  };

  /**
   * Add a layer ID to the layers search parameter.
   * @param {string} [layerId] - A layerId to add to the enabled layers search
   * parameter.
   */
  const addEnabledLayer = (layerId) => {
    if (typeof layerId !== "string") return;

    const layerIds = getEnabledLayers();
    if (!layerIds.includes(layerId)) {
      updateEnabledLayerParam([...layerIds, layerId]);
    }
  };

  /**
   * Remove a layer ID from the layers search parameter.
   * @param {string} [layerIdToRemove] - A layerId to remove from the enabled
   * layers search parameter.
   */
  const removeEnabledLayer = (layerIdToRemove) => {
    if (typeof layerIdToRemove !== "string") return;

    const layerIds = getEnabledLayers();
    updateEnabledLayerParam(
      layerIds.filter((layerId) => layerId !== layerIdToRemove),
    );
  };

  /**
   * Set the destination related URL search params and update the URL.
   * @param {object} [params] - The parameters representing a destination
   * including information about heading, pitch, roll, latitude, longitude, and
   * height.
   */
  const updateDestination = (params) => {
    const url = new URL(window.location.href);
    Object.entries(paramIdToDestinationKey).forEach(
      ([searchParamId, destinationId]) => {
        url.searchParams.set(searchParamId, params[destinationId]);
      },
    );

    window.history.replaceState(null, "", url);
  };

  /**
   * Get all the search parameters in URL related to a destination (excludes
   * enabled layers).
   * @returns {object|undefined} Undefined if the search params are missing
   * latitude or longitude, otherwise an object that represents a destination
   * for a Cesium map to fly to.
   */
  const getDestination = () => {
    const url = new URL(window.location.href);
    const params = {};
    Object.entries(paramIdToDestinationKey).forEach(
      ([searchParamId, destinationId]) => {
        if (url.searchParams.has(searchParamId)) {
          const num = Number(url.searchParams.get(searchParamId));
          if (!Number.isNaN(num)) {
            params[destinationId] = num;
          }
        }
      },
    );

    if (
      params.latitude == null ||
      params.longitude == null ||
      params.height == null
    ) {
      return undefined;
    }

    return params;
  };

  /**
   * @namespace SearchParams
   * @description Helpful functions for dealing with various search parameter
   * changes.
   * @type {object}
   * @since 0.0.0
   */
  return {
    addEnabledLayer,
    clearSavedView,
    getDestination,
    getEnabledLayers,
    removeEnabledLayer,
    updateDestination,
  };
});
