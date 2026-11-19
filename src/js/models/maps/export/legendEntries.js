"use strict";

/**
 * Reads the legend content for the map export from the Map model, without
 * changing any model state.
 * @module models/maps/export/legendEntries
 * @since 2.41.0
 */
define(["common/HtmlUtilities", "common/ValueUtilities"], (
  HtmlUtilities,
  ValueUtilities,
) => {
  const { htmlToText } = HtmlUtilities;

  /**
   * @typedef {object} LegendEntry
   * @property {string} layerId The layer's id, label or an index-based fallback.
   * @property {string} name The layer name, with the palette property in
   * parentheses when there is one.
   * @property {'categorical'|'continuous'} type
   * @property {{label: string, css: string}[]} [categories] Categorical only.
   * @property {{offset: number, css: string}[]} [stops] Continuous only,
   * ordered from the top (min) to the bottom (max) of the gradient.
   * @property {string[]} [labels] Continuous only: min, mid and max labels.
   */

  const getLayers = (mapModel) =>
    typeof mapModel.getAllLayers === "function"
      ? mapModel.getAllLayers()
      : mapModel.get("allLayers")?.models || [];

  /**
   * @param {AssetColorPalette} palette The palette.
   * @returns {number[]|null} The [min, mid, max, range] values, or null.
   */
  function getContinuousRange(palette) {
    const colors = palette.get("colors");
    if (!colors?.length) return null;
    const first = colors.first().get("value");
    const last = colors.last().get("value");
    const min = first === "min" ? palette.get("minVal") : first;
    const max = last === "max" ? palette.get("maxVal") : last;
    if (typeof min !== "number" || typeof max !== "number") return null;
    return [min, (min + max) / 2, max, max - min];
  }

  /**
   * @param {MapAsset} layer The layer.
   * @param {AssetColorPalette} palette The layer's palette.
   * @returns {VectorFilter|null} The filter on the palette's property.
   */
  function findPaletteFilter(layer, palette) {
    const property = palette.get("property");
    let found = null;
    layer.get("filters")?.forEach((filter) => {
      if (filter.get("property") === property) found = filter;
    });
    return found;
  }

  /**
   * @param {AssetColor} color The color.
   * @param {VectorFilter|null} filter The filter on the palette's property.
   * @returns {boolean} False when the category is filtered out.
   */
  function isCategoryActive(color, filter) {
    if (!filter || filter.get("filterType") !== "categorical") return true;
    const values = filter.get("values");
    // An empty list means the filter is not hiding anything.
    if (!Array.isArray(values) || !values.length) return true;
    return (
      values.includes(color.get("value")) || values.includes(color.get("label"))
    );
  }

  /**
   * Builds the legend entries for the visible layers, in the order and with the
   * same inclusion rules as the on-screen legend. Does not modify any model.
   * @param {Map} mapModel The map model.
   * @returns {LegendEntry[]} The entries.
   */
  function getLegendEntries(mapModel) {
    const entries = [];
    getLayers(mapModel).forEach((layer, index) => {
      const palette = layer.get("colorPalette");
      if (
        !layer.get("visible") ||
        layer.get("hideInLegend") ||
        !palette ||
        palette.get("colors").isEmpty()
      ) {
        return;
      }

      const property = palette.get("label") || palette.get("property");
      const layerName = htmlToText(layer.get("label"));
      const propertyName = htmlToText(property);
      let name = layerName || propertyName;
      if (layerName && propertyName) name = `${layerName} (${propertyName})`;

      const entry = {
        layerId: layer.get("layerId") || layer.get("label") || `layer-${index}`,
        name,
        type: palette.get("paletteType"),
      };

      if (entry.type === "categorical") {
        const filter = findPaletteFilter(layer, palette);
        entry.categories = palette.get("colors").reduce((memo, color) => {
          if (isCategoryActive(color, filter)) {
            memo.push({
              label: htmlToText(color.get("label") ?? color.get("value")),
              css: color.getCss(),
            });
          }
          return memo;
        }, []);
        if (!entry.categories.length) return;
      } else if (entry.type === "continuous") {
        const range = getContinuousRange(palette);
        if (!range) return;
        const colors = palette.get("colors");
        const last = Math.max(colors.length - 1, 1);
        entry.stops = colors.map((color, i) => ({
          offset: i / last,
          css: color.getCss(),
        }));
        entry.labels = range
          .slice(0, 3)
          .map((value) => ValueUtilities.formatNumber(value, range[3]));
      } else {
        return;
      }
      entries.push(entry);
    });
    return entries;
  }

  return getLegendEntries;
});
