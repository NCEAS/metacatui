"use strict";

define([], () => {
  /**
   * Labels longer than this are truncated with an ellipsis so a single very long
   * layer name can't dominate the loading message width.
   * @type {number}
   */
  const MAX_LABEL_LENGTH = 50;

  /**
   * Truncate a layer label's visible text to {@link MAX_LABEL_LENGTH} characters,
   * appending an ellipsis when truncated. Labels can contain HTML markup (e.g.
   * `<sub>`/`<sup>` tags for chemical/mathematical notation, rendered as real
   * HTML by the layer menu, see `layer-item.html`); truncating is done by
   * parsing the label with the browser's own HTML parser and trimming text
   * nodes, so any markup that survives stays well-formed instead of being cut
   * off mid-tag.
   * @param {string} label The label to truncate, which may contain HTML markup.
   * @returns {string} The truncated label, as an HTML string.
   * @since 0.0.0
   */
  function truncateLabel(label) {
    const container = document.createElement("div");
    container.innerHTML = label;
    if (container.textContent.length <= MAX_LABEL_LENGTH) return label;

    let remaining = MAX_LABEL_LENGTH;
    const trimNode = (node) => {
      if (remaining <= 0) {
        node.remove();
        return;
      }
      if (node.nodeType === Node.TEXT_NODE) {
        const truncated = node.textContent.slice(0, remaining);
        // eslint-disable-next-line no-param-reassign
        node.textContent = truncated;
        remaining -= truncated.length;
        return;
      }
      Array.from(node.childNodes).forEach(trimNode);
    };
    Array.from(container.childNodes).forEach(trimNode);

    return `${container.innerHTML}…`;
  }

  /**
   * Get a user-facing label for a loading layer. The label is returned as-is
   * (including any HTML markup, like the `<sub>`/`<sup>` tags the layer menu
   * already renders as HTML, see `LayerItemView`/`layer-item.html`) so the
   * loading message reads the same as the layer menu.
   * @param {Backbone.Model|object} layer The layer model.
   * @returns {string|null} The label to surface in the loading message.
   * @since 0.0.0
   */
  function getLoadingLayerLabel(layer) {
    const label = layer?.get("label");
    if (typeof label !== "string" || !label.trim().length) return null;
    return truncateLabel(label.trim());
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
   * Layer types that track ongoing tile work (imagery, 3D tilesets) report
   * it via `tilesLoading`, a continuously-updated pending-work signal, so
   * loading isn't stuck when a visible layer has no tiles in view, and
   * keeps reflecting later loading (e.g. while panning) after the first
   * tile appears. Layer types that don't track `tilesLoading` (e.g. vector
   * data) fall back to the one-time `displayReady` latch.
   * @param {Backbone.Model|object} layer The layer model to check.
   * @returns {boolean} Whether the layer is still loading.
   * @since 0.0.0
   */
  function isTrackedLayerLoading(layer) {
    if (!shouldTrackLayerLoading(layer)) return false;
    if (layer?.get("visible") !== true) return false;
    if (layer.get("status") === "error") return false;
    if (layer.get("status") === "loading") return true;

    const tilesLoading = layer.get("tilesLoading");
    if (tilesLoading != null) return tilesLoading === true;

    return layer.get("displayReady") === false;
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

    if (loadingLayers.length === 1) {
      return `Loading ${labels[0]}`;
    }

    // As soon as more than one layer is loading, switch to a compact "+n other
    // layers" form so the message doesn't keep growing with every extra label.
    const otherCount = loadingLayers.length - 1;
    const otherWord = otherCount === 1 ? "layer" : "layers";
    return `Loading ${labels[0]} and ${otherCount} other ${otherWord}`;
  }

  /**
   * Sync the aggregate map loading indicator state.
   * @param {Backbone.Model} mapModel The parent map model.
   * @since 0.0.0
   */
  function updateLayerLoadingState(mapModel) {
    const loadingLayers = getTrackedLoadingLayers(mapModel);
    syncTrackedLayerLoadingFlags(mapModel, loadingLayers);

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
