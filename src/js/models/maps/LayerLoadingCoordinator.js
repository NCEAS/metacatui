"use strict";

define([], () => {
  /**
   * Determine whether a layer should participate in the aggregate loading state.
   * Internal helper layers can opt out explicitly.
   * @param {Backbone.Model|object} layer The layer model to check.
   * @returns {boolean} Whether the layer should be tracked.
   * @since 0.0.0
   */
  function shouldTrackLayerLoading(layer) {
    return layer?.get("excludeFromLoadingState") !== true;
  }

  /**
   * Return true when a tracked layer is enabled but not yet displayed.
   * @param {Backbone.Model|object} layer The layer model to check.
   * @returns {boolean} Whether the layer is still loading.
   * @since 0.0.0
   */
  function isTrackedLayerLoading(layer) {
    if (!shouldTrackLayerLoading(layer)) return false;
    if (layer?.get("visible") !== true) return false;
    if (layer.get("status") === "error") return false;

    return (
      layer.get("status") === "loading" || layer.get("displayReady") === false
    );
  }

  /**
   * Get visible tracked layers that are actively loading.
   * @param {Backbone.Model} mapModel The parent map model.
   * @returns {Array} The layers still loading into the map.
   * @since 0.0.0
   */
  function getTrackedLoadingLayers(mapModel) {
    return mapModel
      .getAllLayers()
      .filter((layer) => isTrackedLayerLoading(layer));
  }

  /**
   * Sync each layer's canonical loading flag to match current tracked loading state.
   * @param {Backbone.Model} mapModel The parent map model.
   * @param {Backbone.Model[]} [loadingLayers] Optional precomputed loading layers.
   * @since 0.0.0
   */
  function syncTrackedLayerLoadingFlags(
    mapModel,
    loadingLayers = getTrackedLoadingLayers(mapModel),
  ) {
    const loadingLayerSet = new Set(loadingLayers);

    mapModel.getAllLayers().forEach((layer) => {
      if (!layer) return;
      const isLoadingLayer = loadingLayerSet.has(layer);
      if (layer.get("isLoadingLayer") === isLoadingLayer) return;
      layer.set("isLoadingLayer", isLoadingLayer);
    });
  }

  /**
   * Get a user-facing label for a loading layer.
   * @param {Backbone.Model|object} layer The layer model.
   * @returns {string|null} The label to surface in the loading message.
   * @since 0.0.0
   */
  function getLoadingLayerLabel(layer) {
    const label = layer?.get("label");
    return typeof label === "string" && label.trim().length
      ? label.trim()
      : null;
  }

  /**
   * Get the distinct labels for layers contributing to the current loading state.
   * @param {Backbone.Model[]} [loadingLayers] Optional precomputed loading layers.
   * @returns {string[]} A deduplicated list of loading layer labels.
   * @since 0.0.0
   */
  function getLoadingLayerLabels(loadingLayers) {
    return loadingLayers
      .map((layer) => getLoadingLayerLabel(layer))
      .filter(Boolean);
  }

  /**
   * Format the map-level loading message from the loading layer labels.
   * @param {Backbone.Model} mapModel The parent map model.
   * @param {Backbone.Model[]} [loadingLayers] Optional precomputed loading layers.
   * @returns {string|null} The user-facing loading message.
   * @since 0.0.0
   */
  function getLoadingLayersMessage(
    mapModel,
    loadingLayers = getTrackedLoadingLayers(mapModel),
  ) {
    const labels = getLoadingLayerLabels(loadingLayers);
    if (!labels.length) {
      return mapModel.get("isLoadingLayers") ? "Loading layers" : null;
    }

    if (labels.length === 1) {
      return `Loading ${labels[0]}`;
    }

    if (labels.length === 2) {
      return `Loading ${labels[0]} and ${labels[1]}`;
    }

    return `Loading ${labels[0]} and ${labels.length - 1} more layers`;
  }

  /**
   * Sync the aggregate map loading indicator state.
   * @param {Backbone.Model} mapModel The parent map model.
   * @since 0.0.0
   */
  function updateLayerLoadingState(mapModel) {
    const loadingLayers = getTrackedLoadingLayers(mapModel);
    syncTrackedLayerLoadingFlags(mapModel, loadingLayers);

    const hadLoadingState = mapModel.get("isLoadingLayers") === true;
    const isLoadingLayers = loadingLayers.length > 0;
    const loadingLayersMessage = isLoadingLayers
      ? getLoadingLayersMessage(mapModel, loadingLayers) || "Loading layers"
      : null;

    if (
      mapModel.get("isLoadingLayers") === isLoadingLayers &&
      mapModel.get("loadingLayersMessage") === loadingLayersMessage
    ) {
      return;
    }

    mapModel.set({
      isLoadingLayers,
      loadingLayersMessage,
    });

    if (!hadLoadingState && isLoadingLayers && !loadingLayersMessage) {
      mapModel.trigger("loading:started");
    }
  }

  return {
    shouldTrackLayerLoading,
    isTrackedLayerLoading,
    getTrackedLoadingLayers,
    syncTrackedLayerLoadingFlags,
    getLoadingLayerLabel,
    getLoadingLayerLabels,
    getLoadingLayersMessage,
    updateLayerLoadingState,
  };
});
