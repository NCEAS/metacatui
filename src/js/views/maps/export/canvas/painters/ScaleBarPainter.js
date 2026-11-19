"use strict";

/**
 * Draws the scale bar: a bracket with the distance above it.
 * @module views/maps/export/canvas/painters/ScaleBarPainter
 * @since 2.41.0
 */
define(["views/maps/export/constants"], (constants) => {
  const { STYLE, FONT_FAMILY } = constants;

  /**
   * @param {CanvasRenderingContext2D} ctx The context (CSS pixel units).
   * @param {object} placement The result of `PlacementLayout.placeScaleBar`.
   * @param {object} [style] The style.
   */
  function paintScaleBar(ctx, placement, style = STYLE) {
    if (!placement) return;
    const S = style.scaleBar;
    const centerX = placement.x + placement.width / 2;
    const left = centerX - placement.barWidth / 2;
    const right = centerX + placement.barWidth / 2;
    const bottom = placement.y + placement.height;
    const top = bottom - S.tickHeight;
    const labelY = top - S.textGap / 2;

    ctx.save();
    ctx.lineCap = "square";
    ctx.lineJoin = "miter";
    ctx.font = `bold ${S.fontPx}px ${FONT_FAMILY}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";

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
    ctx.strokeText(placement.label, centerX, labelY);

    ctx.strokeStyle = style.textColor;
    ctx.lineWidth = S.lineWidth;
    ctx.lineJoin = "miter";
    bracket();
    ctx.stroke();
    ctx.fillStyle = style.textColor;
    ctx.fillText(placement.label, centerX, labelY);
    ctx.restore();
  }

  return { paintScaleBar };
});
