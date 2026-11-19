"use strict";

/**
 * Pure placement of the scale bar and north arrow in the corners of the frame.
 * @module views/maps/export/canvas/layout/PlacementLayout
 * @since 2.41.0
 */
define(["views/maps/export/constants"], (constants) => {
  const { STYLE } = constants;

  /**
   * @param {object} options Options.
   * @param {{width: number, height: number}} options.frame The frame.
   * @param {ScaleBarChoice|null} options.choice The scale bar, or null.
   * @param {Function} options.measure The `measure` function.
   * @param {object} [options.style] The style.
   * @returns {object|null} The scale bar's box (`x`, `y`, `width`, `height`),
   * the `barWidth` and the `label`, in the lower right corner of the frame.
   */
  function placeScaleBar({ frame, choice, measure, style = STYLE }) {
    if (!choice) return null;
    const S = style.scaleBar;
    const width = Math.max(choice.widthPx, measure(choice.label, S.fontPx, false));
    return {
      x: frame.width - style.margin - width,
      y: frame.height - style.margin - S.height,
      width,
      height: S.height,
      barWidth: choice.widthPx,
      label: choice.label,
    };
  }

  /**
   * @param {object} options Options.
   * @param {{width: number, height: number}} options.frame The frame.
   * @param {object|null} options.scaleBar The result of `placeScaleBar`.
   * @param {object} [options.style] The style.
   * @returns {{cx: number, cy: number, diameter: number}} The north arrow's
   * center, above the scale bar and aligned with the frame's right margin.
   */
  function placeNorthArrow({ frame, scaleBar, style = STYLE }) {
    const N = style.northArrow;
    const bottom = scaleBar
      ? scaleBar.y - N.gap
      : frame.height - style.margin;
    return {
      cx: frame.width - style.margin - N.diameter / 2,
      cy: bottom - N.diameter / 2,
      diameter: N.diameter,
    };
  }

  return { placeScaleBar, placeNorthArrow };
});
