"use strict";

/**
 * Chooses a "nice" scale bar length. Uses the same table as the on-screen
 * {@link ScaleBarView}.
 * @module mapExport/scaleBar
 * @since 2.41.0
 */
define([], () => {
  const DISTANCES = [
    0.1, 0.5, 1, 2, 3, 5, 10, 20, 30, 50, 100, 200, 300, 500, 1000, 2000, 3000,
    5000, 10000, 20000, 30000, 50000, 100000, 200000, 300000, 500000, 1000000,
    2000000, 3000000, 5000000, 10000000, 20000000, 30000000, 50000000,
  ];

  /**
   * @param {number} meters A distance in meters.
   * @returns {string} The label, e.g. "50 km", "200 m" or "50 cm".
   */
  function formatDistance(meters) {
    if (meters >= 1000) return `${meters / 1000} km`;
    if (meters > 1) return `${meters} m`;
    return `${meters * 100} cm`;
  }

  /**
   * @typedef {object} ScaleBarChoice
   * @property {number} meters The distance the bar represents.
   * @property {number} widthPx The bar length, in the same pixels as
   * `metersPerPixel`.
   * @property {string} label The distance label.
   */

  /**
   * @param {number} metersPerPixel Ground distance covered by one pixel.
   * @param {number} maxBarWidthPx The longest the bar may be.
   * @returns {ScaleBarChoice|null} The longest bar not exceeding the maximum
   * width, or null when the scale is unknown or no distance fits.
   */
  function chooseScaleBar(metersPerPixel, maxBarWidthPx) {
    if (
      !Number.isFinite(metersPerPixel) ||
      metersPerPixel <= 0 ||
      !Number.isFinite(maxBarWidthPx) ||
      maxBarWidthPx <= 0
    ) {
      return null;
    }
    for (let i = DISTANCES.length - 1; i >= 0; i -= 1) {
      const widthPx = DISTANCES[i] / metersPerPixel;
      if (widthPx < maxBarWidthPx) {
        return {
          meters: DISTANCES[i],
          widthPx,
          label: formatDistance(DISTANCES[i]),
        };
      }
    }
    return null;
  }

  return { chooseScaleBar, formatDistance, DISTANCES };
});
