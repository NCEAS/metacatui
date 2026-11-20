"use strict";

/**
 * Draws the scale bar: a bracket with the distance beside or above it.
 * @module views/maps/export/canvas/painters/ScaleBarPainter
 * @since 2.41.0
 */
define(["views/maps/export/constants"], (constants) => {
  const { STYLE, FONT_FAMILY } = constants;

  /**
   * @param {CanvasRenderingContext2D} ctx The context (CSS pixel units).
   * @param {object} placement The scale bar from
   * `PlacementLayout.placeControls`.
   * @param {object} [style] The style.
   */
  function paintScaleBar(ctx, placement, style = STYLE) {
    if (!placement) return;
    const S = style.scaleBar;
    const left = placement.barLeft;
    const right = placement.barRight;
    // The outer edge of the stroke sits on the shared bottom line.
    const bottom = placement.bottom - S.lineWidth / 2;
    const top = bottom - S.tickHeight;
    const labelY = placement.labelAbove ? top - S.textGap : placement.bottom;
    const { labelX } = placement;

    ctx.save();
    ctx.lineCap = "square";
    ctx.lineJoin = "miter";
    ctx.font = `bold ${S.fontPx}px ${FONT_FAMILY}`;
    ctx.textAlign = placement.labelAlign;
    ctx.textBaseline = "alphabetic";

    const bracket = () => {
      ctx.beginPath();
      ctx.moveTo(left, top);
      ctx.lineTo(left, bottom);
      ctx.lineTo(right, bottom);
      ctx.lineTo(right, top);
    };

    // White halo first so the black marks stay legible on any imagery.
    ctx.strokeStyle = style.outlineColor;
    ctx.lineWidth = S.lineWidth + 2 * S.outlineWidth;
    bracket();
    ctx.stroke();
    ctx.lineJoin = "round";
    ctx.lineWidth = S.outlineWidth * 2;
    ctx.strokeText(placement.label, labelX, labelY);

    ctx.strokeStyle = style.textColor;
    ctx.lineWidth = S.lineWidth;
    ctx.lineJoin = "miter";
    bracket();
    ctx.stroke();
    ctx.fillStyle = style.textColor;
    ctx.fillText(placement.label, labelX, labelY);
    ctx.restore();
  }

  return { paintScaleBar };
});
