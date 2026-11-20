"use strict";

/**
 * Pure placement of the scale bar and north arrow in the lower right corner of
 * the frame, next to the legend. The two are laid out together because the
 * arrangement depends on how much room the legend leaves.
 * @module views/maps/export/canvas/layout/PlacementLayout
 * @since 2.41.0
 */
define(["views/maps/export/constants"], (constants) => {
  const { STYLE } = constants;

  /**
   * Arrangements, from the widest to the narrowest:
   * - `row`: bar, units and north arrow side by side, bottoms aligned.
   * - `labelAbove`: the units move above the bar; the arrow stays to its right.
   * - `stacked`: the arrow moves above and to the right of the scale bar.
   * @typedef {"row"|"labelAbove"|"stacked"} ControlsArrangement
   */

  /**
   * @param {object} options Options.
   * @param {{width: number, height: number}} options.frame The frame.
   * @param {ScaleBarChoice|null} options.choice The scale bar, or null.
   * @param {Function} options.measure The `measure` function.
   * @param {number} [options.legendRight] The right edge of the legend, or 0
   * if there is none.
   * @param {object} [options.style] The style.
   * @returns {{scaleBar: (object|null), northArrow: object}} The scale bar
   * (`arrangement`, `x`, `y`, `width`, `height`, `barLeft`, `barRight`,
   * `bottom`, `label`, `labelX`, `labelAlign` and `labelAbove`) and the north
   * arrow's center (`cx`, `cy`) and `diameter`.
   */
  function placeControls({
    frame,
    choice,
    measure,
    legendRight = 0,
    style = STYLE,
  }) {
    const S = style.scaleBar;
    const N = style.northArrow;
    const right = frame.width - style.margin;
    const bottom = frame.height - style.margin;
    const minLeft = legendRight > 0 ? legendRight + style.margin : style.margin;
    const arrowCx = right - N.diameter / 2;
    const arrowCy = bottom - N.diameter / 2;

    if (!choice) {
      return {
        scaleBar: null,
        northArrow: { cx: arrowCx, cy: arrowCy, diameter: N.diameter },
      };
    }

    const barWidth = choice.widthPx;
    const labelWidth = measure(choice.label, S.fontPx, true);
    const stackedWidth = Math.max(barWidth, labelWidth);
    const rowWidth = barWidth + S.unitsGap + labelWidth + N.gap + N.diameter;
    const labelAboveWidth = stackedWidth + N.gap + N.diameter;

    let arrangement = "stacked";
    if (right - rowWidth >= minLeft) arrangement = "row";
    else if (right - labelAboveWidth >= minLeft) arrangement = "labelAbove";

    if (arrangement === "row") {
      const x = right - rowWidth;
      return {
        scaleBar: {
          arrangement,
          x,
          y: bottom - S.height,
          width: barWidth + S.unitsGap + labelWidth,
          height: S.height,
          barLeft: x,
          barRight: x + barWidth,
          bottom,
          label: choice.label,
          labelX: x + barWidth + S.unitsGap,
          labelAlign: "left",
          labelAbove: false,
        },
        northArrow: { cx: arrowCx, cy: arrowCy, diameter: N.diameter },
      };
    }

    const boxLeft =
      arrangement === "labelAbove"
        ? right - labelAboveWidth
        : right - stackedWidth;
    const centerX = boxLeft + stackedWidth / 2;
    const scaleBar = {
      arrangement,
      x: boxLeft,
      y: bottom - S.height,
      width: stackedWidth,
      height: S.height,
      barLeft: centerX - barWidth / 2,
      barRight: centerX + barWidth / 2,
      bottom,
      label: choice.label,
      labelX: centerX,
      labelAlign: "center",
      labelAbove: true,
    };
    const northArrow =
      arrangement === "labelAbove"
        ? { cx: arrowCx, cy: arrowCy, diameter: N.diameter }
        : {
            cx: arrowCx,
            cy: scaleBar.y - N.gap - N.diameter / 2,
            diameter: N.diameter,
          };
    return { scaleBar, northArrow };
  }

  return { placeControls };
});
