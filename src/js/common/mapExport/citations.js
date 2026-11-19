"use strict";

/**
 * Reads the source attributions for the map export from the Map model.
 * @module mapExport/citations
 * @since 2.41.0
 */
define(["common/mapExport/htmlText"], (htmlToText) => {
  /**
   * @typedef {object} Citation
   * @property {string[]} layers The names of the layers that share this text.
   * @property {string} text The attribution text.
   */

  const getLayers = (mapModel) =>
    typeof mapModel.getAllLayers === "function"
      ? mapModel.getAllLayers()
      : mapModel.get("allLayers")?.models || [];

  /**
   * @param {MapAsset} layer The layer.
   * @returns {string} The attribution, or the imagery provider's credit when
   * the layer has no attribution of its own.
   */
  function getAttributionText(layer) {
    const attribution = htmlToText(layer.get("attribution"));
    if (attribution) return attribution;
    const credit = layer.get("cesiumModel")?.imageryProvider?.credit;
    return htmlToText(credit?.html);
  }

  /**
   * Gets the attributions of the visible layers. Layers with identical text are
   * grouped.
   * @param {Map} mapModel The map model.
   * @returns {Citation[]} The citations, in layer order.
   */
  function getCitations(mapModel) {
    const byText = new window.Map();
    getLayers(mapModel).forEach((layer) => {
      if (!layer.get("visible")) return;
      const text = getAttributionText(layer);
      if (!text) return;
      if (!byText.has(text)) byText.set(text, { layers: [], text });
      const name = htmlToText(layer.get("label"));
      const { layers } = byText.get(text);
      if (name && !layers.includes(name)) layers.push(name);
    });
    return Array.from(byText.values());
  }

  /**
   * @param {Citation} citation The citation.
   * @returns {string} e.g. "Layer A, Layer B: attribution text".
   */
  function formatCitation(citation) {
    return citation.layers.length
      ? `${citation.layers.join(", ")}: ${citation.text}`
      : citation.text;
  }

  getCitations.formatCitation = formatCitation;
  return getCitations;
});
