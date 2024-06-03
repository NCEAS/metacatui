"use strict";

define([], () => {
  /** IDs used to encode search parameters to save map location to URL.  */
  const saveToUrlDestinationIds = {
    LATITUDE: "lt",
    LONGITUDE: "ln",
    HEIGHT: "ht",
    HEADING: "hd",
    PITCH: "p",
    ROLL: "r",
  };

  /**
   * A map from search parameter key to the actual keys used by the application.
   */
  const paramIdToDestinationKey = {
    [saveToUrlDestinationIds.LATITUDE]: "latitude",
    [saveToUrlDestinationIds.LONGITUDE]: "longitude",
    [saveToUrlDestinationIds.HEIGHT]: "height",
    [saveToUrlDestinationIds.HEADING]: "heading",
    [saveToUrlDestinationIds.PITCH]: "pitch",
    [saveToUrlDestinationIds.ROLL]: "roll",
  };

  /** Destination IDs plus enabled layers. */
  const saveToUrlIds = {
    ...saveToUrlDestinationIds,
    ENABLED_LAYERS: "el",
  };

  /** Clear all search parameters in URL related to save view to URL feature. */
  const clearSavedView = () => {
    const url = new URL(location.href);
    for (const id of Object.values(saveToUrlIds)) {
      url.searchParams.delete(id);
    }

    history.replaceState(null, "", url);
  };

  /**
   * Set the destination related URL search params and update the URL.
   * @param {string[]} [layers] - Array of layerIds for encoding into the
   * enabled layers search parameter.
   */
  const updateEnabledLayerParam = (layers) => {
    const url = new URL(location.href);
    url.searchParams.set(
      saveToUrlIds.ENABLED_LAYERS,
      layers.filter((layer) => layer).join(","),
    );

    history.replaceState(null, "", url);
  };

  /**
   * Remove a layer ID from the layers search parameter.
   * @returns {string[]} A list of enabled layerIds or an empty array if there is
   * no enabled layer search parameter.
   */
  const getEnabledLayers = () => {
    const url = new URL(location.href);
    return url.searchParams.get(saveToUrlIds.ENABLED_LAYERS)?.split(",") || [];
  };

  /**
   * Add a layer ID to the layers search parameter.
   * @param {string} [layer] - A layerId to add to the enabled layers search
   * parameter.
   */
  const addEnabledLayer = (layer) => {
    if (typeof layer !== "string") return;

    const layers = getEnabledLayers();
    if (!layers.includes(layer)) {
      updateEnabledLayerParam([...layers, layer]);
    }
  };

  /**
   * Remove a layer ID from the layers search parameter.
   * @param {string} [layerToRemove] - A layerId to remove from the enabled
   * layers search parameter.
   */
  const removeEnabledLayer = (layerToRemove) => {
    if (typeof layerToRemove !== "string") return;

    const layers = getEnabledLayers();
    if (layers.includes(layerToRemove)) {
      updateEnabledLayerParam(
        layers.filter((layer) => layer !== layerToRemove),
      );
    }
  };

  /**
   * Set the destination related URL search params and update the URL.
   * @param {object} [params] - The parameters representing a destination
   * including information about heading, pitch, roll, latitude, longitude, and
   * height.
   */
  const updateDestination = (params) => {
    const url = new URL(location.href);
    for (const searchParamId of Object.values(saveToUrlDestinationIds)) {
      const id = paramIdToDestinationKey[searchParamId];
      url.searchParams.set(searchParamId, params[id]);
    }

    history.replaceState(null, "", url);
  };

  /**
   * Get all the search parameters in URL related to a destination (excludes
   * enabled layers).
   * @returns {object|undefined} Undefined if the search params are missing
   * latitude or longitude, otherwise an object that represents a destination
   * for a Cesium map to fly to.
   */
  const getDestination = () => {
    const url = new URL(location.href);
    const params = {};
    for (const searchParamId of Object.values(saveToUrlDestinationIds)) {
      const id = paramIdToDestinationKey[searchParamId];
      if (url.searchParams.has(searchParamId)) {
        const num = Number(url.searchParams.get(searchParamId));
        if (!Number.isNaN(num)) {
          params[id] = num;
        }
      }
    }

    if (
      params.latitude == null ||
      params.longitude == null ||
      params.height == null
    ) {
      return;
    }

    return params;
  };

  /**
   * @namespace SearchParams
   * @description Helpful functions for dealing with various search parameter
   * changes.
   * @type {object}
   * @since x.x.x
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
